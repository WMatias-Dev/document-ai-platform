import uuid
import logging
from typing import List
from fastapi import UploadFile, BackgroundTasks, HTTPException, status

from app.database.models.document import Document, DocumentStatus
from app.database.models.user import User
from app.schemas.document_schema import DocumentCreate
from app.repositories.document_repository import DocumentRepository

from app.services.storage_service import StorageService
from app.services.parsing_service import ParsingService

logger = logging.getLogger(__name__)


class DocumentService:
    def __init__(
        self,
        repository: DocumentRepository,
        storage: StorageService,
        parser: ParsingService,
    ):
        self.repository = repository
        self.storage = storage
        self.parser = parser

    async def process_upload(
        self,
        file: UploadFile,
        owner_id: uuid.UUID,
        background_tasks: BackgroundTasks,
    ) -> dict:
        """
        Recebe o upload, persiste o arquivo físico e registra os metadados iniciais.
        """
        # Salva o arquivo no storage
        file_path = await self.storage.save_file(file)

        # Instancia DocumentCreate com os parâmetros do Schema
        document_in = DocumentCreate(
            title=file.filename or "Documento Sem Nome"
        )

        # Salva o registro no banco via repositório
        document_record = self.repository.create(
            document_in=document_in,
            owner_id=owner_id,
        )

        # Dispara o processamento em background
        background_tasks.add_task(
            self._run_pipeline,
            document_record.id,
            str(file_path),
        )

        return {"document_id": document_record.id, "status": "processing"}

    def _run_pipeline(self, document_id: uuid.UUID, file_path: str) -> None:
        """
        Executa o pipeline de parsing em background (que encadeia chunking e embedding).
        """
        try:
            # 1. Processamento
            self.parser.process_document(document_id)

            # 2. Atualiza status para concluído
            self.repository.update_status(
                document_id=document_id,
                status=DocumentStatus.COMPLETED,
            )

        except Exception as e:
            logger.error(f"Erro no processamento do documento {document_id}: {e}", exc_info=True)
            # 3. Atualiza para status de falha (ERROR)
            self.repository.update_status(
                document_id=document_id,
                status=DocumentStatus.ERROR,
            )

    def create_document(self, document_in: DocumentCreate, current_user: User) -> Document:
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

        # Passa a entidade `document` conforme esperado pelo repositório
        self.repository.delete(document)
        logger.info(f"[Documento {document_id}] Apagado com sucesso.")