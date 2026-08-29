import logging
import uuid
from typing import Callable, List, Optional
from fastapi import BackgroundTasks, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.database.models.document import Document, DocumentStatus
from app.database.models.user import User
from app.repositories.document_repository import DocumentRepository
from app.schemas.document_schema import (
    DocumentCreate,
    DocumentSearchRequest,
    DocumentSearchResponse,
    SearchResultChunk,
)
from app.services.chunking_service import ChunkingService
from app.services.embedding_service import EmbeddingService
from app.services.parsing_service import ParsingService
from app.services.rerank_service import RerankService
from app.services.storage_service import StorageService

logger = logging.getLogger(__name__)


from app.core.ingestion_queue import ingestion_queue

class DocumentService:
    def __init__(
        self,
        repository: DocumentRepository,
        storage: StorageService,
        parser: ParsingService,
        chunker: ChunkingService,
        embedder: EmbeddingService,
        reranker: Optional[RerankService] = None,
        session_factory: Optional[Callable[[], Session]] = None,
    ):
        self.repository = repository
        self.storage = storage
        self.parser = parser
        self.chunker = chunker
        self.embedder = embedder
        self.reranker = reranker or RerankService()
        self.session_factory = session_factory

    async def process_upload(
        self,
        file: UploadFile,
        owner_id: uuid.UUID,
        background_tasks: Optional[BackgroundTasks] = None,
        notebook_id: Optional[uuid.UUID] = None,
    ) -> dict:
        """
        Recebe o upload, persiste o arquivo físico, cria o registro e despacha
        para a fila assíncrona local (zero bloqueio de thread).
        """
        try:
            file_path = await self.storage.save_file(file)
        except ValueError as ve:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve)
            )
        except Exception as e:
            logger.error(f"Falha ao salvar arquivo físico: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Erro interno ao salvar arquivo.",
            )

        filename_real = file.filename or "documento.pdf"

        document_in = DocumentCreate(
            title=filename_real,
            filename=filename_real,
            file_path=str(file_path),
            content_type=file.content_type or "application/pdf",
            notebook_id=notebook_id,
        )

        document_record = self.repository.create(
            document_in=document_in,
            owner_id=owner_id,
        )

        # Enfileira na fila assíncrona local com semáforo
        await ingestion_queue.enqueue(
            document_id=document_record.id,
            file_path=str(file_path),
            pipeline_func=self._run_pipeline,
        )

        return {
            "document_id": document_record.id,
            "status": "queued",
            "notebook_id": notebook_id,
        }

    def _run_pipeline(self, document_id: uuid.UUID, file_path: str) -> None:
        """
        Orquestra o pipeline em background com controle de progresso granular.
        """
        db = self.session_factory() if self.session_factory else None
        repo = DocumentRepository(db) if db else self.repository
        embedder = EmbeddingService(repository=repo) if db else self.embedder

        def _notify(status_str: str, progress_num: int, msg: str):
            try:
                import asyncio
                loop = asyncio.get_event_loop()
                if loop.is_running():
                    asyncio.create_task(ingestion_queue.emit_progress(document_id, status_str, progress_num, msg))
                else:
                    loop.run_until_complete(ingestion_queue.emit_progress(document_id, status_str, progress_num, msg))
            except Exception:
                pass

        try:
            repo.update_status(document_id=document_id, status=DocumentStatus.PARSING)
            _notify("parsing", 25, "Extraindo layout e tabelas estruturadas com PyMuPDF...")

            if hasattr(self.parser, "extract_structured_pages"):
                parsed_elements = self.parser.extract_structured_pages(file_path)
                extracted_text = "\n\n".join(elem["text"] for elem in parsed_elements)
            else:
                extracted_text = self.parser.extract_text(file_path)
                parsed_elements = [{"text": extracted_text, "page_number": 1, "chunk_type": "text", "bounding_box": [0.0, 0.0, 1.0, 1.0]}]

            repo.update_document_content(
                document_id=document_id,
                content=extracted_text,
                status=DocumentStatus.PARSING,
            )

            repo.update_status(document_id=document_id, status=DocumentStatus.CHUNKING)
            _notify("chunking", 50, "Particionando texto e preservando tabelas em Markdown...")

            if hasattr(self.chunker, "chunk_structured_document"):
                structured_chunks = self.chunker.chunk_structured_document(parsed_elements)
            else:
                raw_texts = self.chunker.chunk_text(extracted_text)
                structured_chunks = [
                    {"text_content": txt, "page_number": 1, "chunk_type": "text", "bounding_box": [0.0, 0.0, 1.0, 1.0]}
                    for txt in raw_texts
                ]

            chunks_data = [
                {
                    "document_id": document_id,
                    "chunk_index": idx,
                    "page_number": chunk.get("page_number", 1),
                    "chunk_type": chunk.get("chunk_type", "text"),
                    "text_content": chunk.get("text_content", chunk.get("text", "")),
                    "bounding_box": chunk.get("bounding_box"),
                }
                for idx, chunk in enumerate(structured_chunks)
            ]
            repo.create_chunks(chunks_data)

            _notify("embedding", 75, "Gerando embeddings vetoriais (768d)...")
            if hasattr(embedder, "process_document"):
                embedder.process_document(document_id)

            repo.update_status(document_id=document_id, status=DocumentStatus.COMPLETED)
            _notify("ready", 100, "Documento indexado e pronto para pesquisa.")

        except Exception as e:
            logger.error(
                f"Erro no pipeline do documento {document_id}: {e}", exc_info=True
            )
            _notify("error", 0, f"Falha no processamento: {str(e)}")
            try:
                repo.update_status(
                    document_id=document_id,
                    status=DocumentStatus.ERROR,
                )
            except Exception as update_err:
                logger.error(
                    f"Falha ao atualizar status para ERROR no documento {document_id}: {update_err}"
                )
        finally:
            if db is not None:
                db.close()

    def create_document(
        self, document_in: DocumentCreate, current_user: User
    ) -> Document:
        return self.repository.create(document_in=document_in, owner_id=current_user.id)

    def get_document(self, document_id: uuid.UUID, current_user: User) -> Document:
        document = self.repository.get_by_id(document_id)

        if not document:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Documento não encontrado.",
            )

        if document.owner_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Você não tem permissão para acessar este documento.",
            )

        return document

    def get_user_documents(self, current_user: User) -> List[Document]:
        return self.repository.get_all_by_owner(owner_id=current_user.id)

    def delete_document(self, document_id: uuid.UUID, current_user: User) -> None:
        document = self.get_document(document_id=document_id, current_user=current_user)

        if hasattr(self.storage, "delete_file") and document.file_path:
            self.storage.delete_file(document.file_path)

        self.repository.delete(document)
        logger.info(f"[Documento {document_id}] Apagado com sucesso.")

    def search_documents(
        self, search_in: DocumentSearchRequest, current_user: User
    ) -> DocumentSearchResponse:
        if search_in.document_id:
            self.get_document(search_in.document_id, current_user)

        query_embedding = self.embedder.generate_query_embedding(search_in.query)

        # 1. Recupera um pool de candidatos mais amplo para o Rerank (Top-15 ou 3x o limit)
        candidate_limit = max(15, search_in.limit * 3)

        if hasattr(self.repository, "hybrid_search_rrf"):
            raw_results = self.repository.hybrid_search_rrf(
                query_text=search_in.query,
                query_embedding=query_embedding,
                user_id=current_user.id,
                notebook_id=search_in.notebook_id,
                document_id=search_in.document_id,
                source_ids=search_in.source_ids,
                limit=candidate_limit,
            )
        else:
            raw_results = self.repository.similarity_search(
                query_embedding=query_embedding,
                user_id=current_user.id,
                notebook_id=search_in.notebook_id,
                document_id=search_in.document_id,
                source_ids=search_in.source_ids,
                limit=candidate_limit,
            )

        if not raw_results:
            return DocumentSearchResponse(
                query=search_in.query,
                total_results=0,
                results=[],
            )

        # 2. Formata candidatos para o Cross-Encoder
        candidates = [
            {
                "chunk_id": chunk.id,
                "document_id": chunk.document_id,
                "document_title": chunk.document.title if chunk.document else "",
                "chunk_index": chunk.chunk_index,
                "page_number": getattr(chunk, "page_number", 1),
                "chunk_type": getattr(chunk, "chunk_type", "text"),
                "bounding_box": getattr(chunk, "bounding_box", None),
                "text": chunk.text_content,
                "score": float(score),
            }
            for chunk, score in raw_results
        ]

        # 3. Executa Rerank (se habilitado) para filtrar até search_in.limit
        if self.reranker:
            reranked_candidates = self.reranker.rerank(
                query=search_in.query,
                candidates=candidates,
                top_n=search_in.limit,
            )
        else:
            reranked_candidates = candidates[:search_in.limit]

        results = [
            SearchResultChunk(
                chunk_id=item["chunk_id"],
                document_id=item["document_id"],
                document_title=item["document_title"],
                chunk_index=item["chunk_index"],
                page_number=item.get("page_number") or 1,
                chunk_type=item.get("chunk_type") or "text",
                bounding_box=item.get("bounding_box"),
                text_content=item["text"],
                similarity_score=round(item.get("rerank_score", item.get("score", 0.0)), 6),
            )
            for item in reranked_candidates
        ]

        return DocumentSearchResponse(
            query=search_in.query,
            total_results=len(results),
            results=results,
        )