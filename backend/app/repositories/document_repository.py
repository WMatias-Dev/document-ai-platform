import logging
import uuid
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session

from app.database.models.document import Document, DocumentStatus
from app.database.models.document_chunk import DocumentChunk
from app.schemas.document_schema import DocumentCreate

logger = logging.getLogger(__name__)


class DocumentRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, document_in: DocumentCreate, owner_id: uuid.UUID) -> Document:
        db_document = Document(
            title=document_in.title,
            content=getattr(document_in, "content", None),
            filename=document_in.filename,
            file_path=getattr(document_in, "file_path", ""),
            content_type=getattr(document_in, "content_type", "application/pdf"),
            owner_id=owner_id,
            notebook_id=getattr(document_in, "notebook_id", None),
        )
        self.db.add(db_document)
        self.db.commit()
        self.db.refresh(db_document)
        return db_document

    def get_by_id(self, document_id: uuid.UUID) -> Optional[Document]:
        return self.db.query(Document).filter(Document.id == document_id).first()

    def get_all_by_owner(self, owner_id: uuid.UUID) -> List[Document]:
        return self.db.query(Document).filter(Document.owner_id == owner_id).all()

    def get_all_by_notebook(
        self, notebook_id: uuid.UUID, owner_id: uuid.UUID
    ) -> List[Document]:
        return (
            self.db.query(Document)
            .filter(
                Document.notebook_id == notebook_id, Document.owner_id == owner_id
            )
            .all()
        )

    def delete(self, document: Document) -> None:
        self.db.delete(document)
        self.db.commit()

    def create_uploaded_document(self, document_data: dict) -> Document:
        db_document = Document(**document_data)
        self.db.add(db_document)
        self.db.commit()
        self.db.refresh(db_document)
        return db_document

    def update_status(self, document_id: uuid.UUID, status: DocumentStatus) -> None:
        document = self.get_by_id(document_id)
        if document:
            document.status = status
            self.db.commit()
            self.db.refresh(document)

    def update_document_content(
        self, document_id: uuid.UUID, content: Optional[str], status: DocumentStatus
    ) -> None:
        document = self.get_by_id(document_id)
        if document:
            document.content = content
            document.status = status
            self.db.commit()
            self.db.refresh(document)

    def create_chunks(self, chunks_data: List[Dict[str, Any]]) -> None:
        chunks = [DocumentChunk(**data) for data in chunks_data]
        self.db.add_all(chunks)
        self.db.commit()

    def get_chunks_by_document(self, document_id: uuid.UUID) -> List[DocumentChunk]:
        return (
            self.db.query(DocumentChunk)
            .filter(DocumentChunk.document_id == document_id)
            .all()
        )

    def save_chunks(self, chunks: List[DocumentChunk]) -> None:
        self.db.add_all(chunks)
        self.db.commit()

    def similarity_search(
        self,
        query_embedding: List[float],
        user_id: uuid.UUID,
        notebook_id: Optional[uuid.UUID] = None,
        document_id: Optional[uuid.UUID] = None,
        source_ids: Optional[List[uuid.UUID]] = None,
        limit: int = 5,
    ) -> List[tuple[DocumentChunk, float]]:
        """
        Executa busca vetorial por similaridade de cosseno nos chunks
        garantindo isolamento de ownership e filtro estrito por Notebook / Fontes.
        """
        distance_expr = DocumentChunk.embedding.cosine_distance(
            query_embedding
        ).label("distance")

        query = (
            self.db.query(DocumentChunk, distance_expr)
            .join(Document, Document.id == DocumentChunk.document_id)
            .filter(Document.owner_id == user_id)
            .filter(DocumentChunk.embedding.isnot(None))
        )

        # Filtro estrito por Notebook
        if notebook_id:
            query = query.filter(Document.notebook_id == notebook_id)

        # Filtro por lista de fontes específicas (checkboxes selecionados)
        if source_ids and len(source_ids) > 0:
            query = query.filter(Document.id.in_(source_ids))
        elif document_id:
            query = query.filter(Document.id == document_id)

        results = query.order_by(distance_expr.asc()).limit(limit).all()

        return [(chunk, 1.0 - float(dist)) for chunk, dist in results]

    def hybrid_search_rrf(
        self,
        query_text: str,
        query_embedding: List[float],
        user_id: uuid.UUID,
        notebook_id: Optional[uuid.UUID] = None,
        document_id: Optional[uuid.UUID] = None,
        source_ids: Optional[List[uuid.UUID]] = None,
        limit: int = 5,
        k: int = 60,
        dense_weight: float = 0.6,
        sparse_weight: float = 0.4,
    ) -> List[tuple[DocumentChunk, float]]:
        """
        Executa busca híbrida unindo Dense (HNSW / Cosseno) + Sparse (FTS 'simple')
        com fusão por Reciprocal Rank Fusion (RRF).
        Resiliente a erros de transação com rollback automático.
        """
        from collections import defaultdict
        fetch_k = max(30, limit * 4)

        # 1. Recupera candidatos densos via similarity_search
        try:
            dense_results = self.similarity_search(
                query_embedding=query_embedding,
                user_id=user_id,
                notebook_id=notebook_id,
                document_id=document_id,
                source_ids=source_ids,
                limit=fetch_k,
            )
        except Exception as e:
            logger.error(f"[hybrid_search_rrf] Erro no braço denso: {e}")
            try:
                self.db.rollback()
            except Exception:
                pass
            dense_results = []

        # 2. Recupera candidatos esparsos (PostgreSQL Full-Text Search)
        sparse_results = []
        if query_text and query_text.strip():
            try:
                from sqlalchemy import func
                clean_query = query_text.strip()
                ts_query = func.plainto_tsquery("simple", clean_query)
                ts_vector = func.to_tsvector("simple", DocumentChunk.text_content)
                sparse_rank = func.ts_rank_cd(ts_vector, ts_query)

                target_source_ids = (
                    source_ids
                    if source_ids and len(source_ids) > 0
                    else ([document_id] if document_id else None)
                )

                sparse_query = (
                    self.db.query(DocumentChunk, sparse_rank)
                    .join(Document, Document.id == DocumentChunk.document_id)
                    .filter(Document.owner_id == user_id)
                    .filter(ts_vector.op("@@")(ts_query))
                )
                if notebook_id:
                    sparse_query = sparse_query.filter(Document.notebook_id == notebook_id)
                if target_source_ids:
                    sparse_query = sparse_query.filter(Document.id.in_(target_source_ids))

                sparse_results = (
                    sparse_query.order_by(sparse_rank.desc()).limit(fetch_k).all()
                )
            except Exception as e:
                logger.warning(f"[hybrid_search_rrf] Braço esparso ignorado: {e}")
                try:
                    self.db.rollback()
                except Exception:
                    pass
                sparse_results = []

        # Se não há candidatos esparsos, retorna diretamente os densos
        if not sparse_results:
            return dense_results[:limit]

        # 3. Fusão RRF (Reciprocal Rank Fusion)
        rrf_scores = defaultdict(float)
        chunk_map = {}

        for rank, (chunk, _score) in enumerate(dense_results, start=1):
            chunk_map[chunk.id] = chunk
            rrf_scores[chunk.id] += dense_weight * (1.0 / (k + rank))

        for rank, item in enumerate(sparse_results, start=1):
            chunk = item[0] if isinstance(item, (tuple, list)) else item
            chunk_map[chunk.id] = chunk
            rrf_scores[chunk.id] += sparse_weight * (1.0 / (k + rank))

        sorted_chunks = sorted(
            rrf_scores.items(), key=lambda item: item[1], reverse=True
        )[:limit]

        return [(chunk_map[chunk_id], score) for chunk_id, score in sorted_chunks]