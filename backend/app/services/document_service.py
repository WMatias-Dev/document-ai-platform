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
from app.services.storage_service import StorageService

logger = logging.getLogger(__name__)


class DocumentService:
    def __init__(
        self,
        repository: DocumentRepository,
        storage: StorageService,
        parser: ParsingService,
        chunker: ChunkingService,
        embedder: EmbeddingService,
        session_factory: Optional[Callable[[], Session]] = None,
    ):
        self.repository = repository
        self.storage = storage
        self.parser = parser
        self.chunker = chunker
        self.embedder = embedder
        self.session_factory = session_factory

    async def process_upload(
        self,
        file: UploadFile,
        owner_id: uuid.UUID,
        background_tasks: BackgroundTasks,
        notebook_id: Optional[uuid.UUID] = None,
    ) -> dict:
        """
        Recebe o upload, persiste o arquivo físico e registra os metadados iniciais no banco,
        vinculando opcionalmente ao notebook_id especificado.
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

        background_tasks.add_task(
            self._run_pipeline,
            document_record.id,
            str(file_path),
        )

        return {
            "document_id": document_record.id,
            "status": "processing",
            "notebook_id": notebook_id,
        }

    def _run_pipeline(self, document_id: uuid.UUID, file_path: str) -> None:
        """
        Orquestra o pipeline em background (parsing, chunking, embeddings).
        Usa uma sessão dedicada caso instanciada com session_factory.
        """
        db = self.session_factory() if self.session_factory else None
        repo = DocumentRepository(db) if db else self.repository
        embedder = EmbeddingService(repository=repo) if db else self.embedder

        try:
            repo.update_status(document_id=document_id, status=DocumentStatus.PARSING)
            extracted_text = self.parser.extract_text(file_path)

            repo.update_document_content(
                document_id=document_id,
                content=extracted_text,
                status=DocumentStatus.PARSING,
            )

            repo.update_status(document_id=document_id, status=DocumentStatus.CHUNKING)
            raw_chunks = self.chunker.chunk_text(extracted_text)

            chunks_data = [
                {
                    "document_id": document_id,
                    "chunk_index": idx,
                    "text_content": chunk,
                }
                for idx, chunk in enumerate(raw_chunks)
            ]
            repo.create_chunks(chunks_data)

            if hasattr(embedder, "process_document"):
                embedder.process_document(document_id)

            repo.update_status(document_id=document_id, status=DocumentStatus.COMPLETED)

        except Exception as e:
            logger.error(
                f"Erro no pipeline do documento {document_id}: {e}", exc_info=True
            )
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

        if hasattr(self.repository, "hybrid_search_rrf"):
            raw_results = self.repository.hybrid_search_rrf(
                query_text=search_in.query,
                query_embedding=query_embedding,
                user_id=current_user.id,
                notebook_id=search_in.notebook_id,
                document_id=search_in.document_id,
                source_ids=search_in.source_ids,
                limit=search_in.limit,
            )
        else:
            raw_results = self.repository.similarity_search(
                query_embedding=query_embedding,
                user_id=current_user.id,
                notebook_id=search_in.notebook_id,
                document_id=search_in.document_id,
                source_ids=search_in.source_ids,
                limit=search_in.limit,
            )

        results = [
            SearchResultChunk(
                chunk_id=chunk.id,
                document_id=chunk.document_id,
                document_title=chunk.document.title if chunk.document else "",
                chunk_index=chunk.chunk_index,
                text_content=chunk.text_content,
                similarity_score=round(score, 6),
            )
            for chunk, score in raw_results
        ]

        return DocumentSearchResponse(
            query=search_in.query,
            total_results=len(results),
            results=results,
        )