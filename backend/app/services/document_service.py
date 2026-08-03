import os
import shutil
import uuid
import logging
from typing import List
from fastapi import HTTPException, status, UploadFile

from app.repositories.document_repository import DocumentRepository
from app.schemas.document_schema import DocumentCreate
from app.database.models.document import Document, DocumentStatus
from app.database.models.user import User

logger = logging.getLogger(__name__)

# Diretório raiz para os uploads físicos
UPLOAD_DIR = "uploads"

class DocumentService:
    def __init__(self, repository: DocumentRepository):
        self.repository = repository
        os.makedirs(UPLOAD_DIR, exist_ok=True)

    def process_initial_upload(self, file: UploadFile, user_id: uuid.UUID) -> Document:
        """
        Processa o recebimento do arquivo físico, salva no disco e registra no banco.
        """
        logger.info(f"[Usuário {user_id}] Iniciando upload do arquivo: {file.filename}")

        # 1. Segurança: Gerar um nome único
        file_extension = file.filename.split(".")[-1] if file.filename and "." in file.filename else "pdf"
        unique_filename = f"{uuid.uuid4()}.{file_extension}"
        file_path = os.path.join(UPLOAD_DIR, unique_filename)

        # 2. Persistência Física: Salvar o arquivo no disco
        try:
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            logger.info(f"Arquivo físico salvo com sucesso em: {file_path}")
        except Exception as e:
            logger.error(f"Falha ao salvar o arquivo físico no disco para o usuário {user_id}: {str(e)}", exc_info=True)
            raise RuntimeError(f"Falha ao salvar o arquivo no disco: {str(e)}")
        finally:
            file.file.close()

        # 3. Persistência Lógica: Preparar os metadados
        document_data = {
            "title": file.filename or "Documento Sem Nome",
            "filename": file.filename or "unknown.pdf",
            "file_path": file_path,
            "content_type": file.content_type or "application/pdf",
            "status": DocumentStatus.RECEIVED,
            "owner_id": user_id
        }

        # 4. Delegando para o repositório salvar no banco
        created_doc = self.repository.create_uploaded_document(document_data)
        logger.info(f"[Documento {created_doc.id}] Metadados registrados no banco com status RECEIVED.")
        
        return created_doc

    def create_document(self, document_in: DocumentCreate, current_user: User) -> Document:
        return self.repository.create(document_in=document_in, owner_id=current_user.id)

    def get_document(self, document_id: uuid.UUID, current_user: User) -> Document:
        document = self.repository.get_by_id(document_id)

        if not document:
            logger.warning(f"Tentativa de acesso a documento inexistente. ID: {document_id}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="documento não encontrado."
            )

        if document.owner_id != current_user.id:
            logger.warning(f"[Segurança] Usuário {current_user.id} tentou acessar o documento pertencente a outro usuário. ID: {document_id}")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Você não tem permissão para acessar este documento."
            )

        return document

    def get_user_documents(self, current_user: User) -> List[Document]:
        return self.repository.get_all_by_owner(owner_id=current_user.id)

    def delete_document(self, document_id: uuid.UUID, current_user: User) -> None:
        document = self.get_document(document_id=document_id, current_user=current_user)
        
        # 1. Remove o arquivo físico do disco
        if document.file_path and os.path.exists(document.file_path):
            try:
                os.remove(document.file_path)
                logger.info(f"[Documento {document_id}] Arquivo físico removido do disco: {document.file_path}")
            except Exception as e:
                logger.error(f"[Documento {document_id}] Erro ao excluir arquivo físico do disco: {e}", exc_info=True)
        
        # 2. Removendo o registro do banco
        self.repository.delete(document)
        logger.info(f"[Documento {document_id}] Registro excluído do banco de dados com sucesso.")