import uuid
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session

from app.database.models.document import Document, DocumentStatus
from app.database.models.document_chunk import DocumentChunk
from app.schemas.document_schema import DocumentCreate


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