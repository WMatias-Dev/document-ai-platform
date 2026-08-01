import os
import shutil
import uuid
from typing import List
from fastapi import HTTPException, status, UploadFile

from app.repositories.document_repository import DocumentRepository
from app.schemas.document_schema import DocumentCreate
from app.database.models.document import Document, DocumentStatus
from app.database.models.user import User

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
        # 1. Segurança: Gerar um nome único
        file_extension = file.filename.split(".")[-1] if file.filename and "." in file.filename else "pdf"
        unique_filename = f"{uuid.uuid4()}.{file_extension}"
        file_path = os.path.join(UPLOAD_DIR, unique_filename)

        # 2. Persistência Física: Salvar o arquivo no disco
        try:
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
        except Exception as e:
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
        return self.repository.create_uploaded_document(document_data)

    
    def create_document(self, document_in: DocumentCreate, current_user: User) -> Document:
        # retorna os dados do usuario de forma segura
        return self.repository.create(document_in=document_in, owner_id=current_user.id)

    def get_document(self, document_id: uuid.UUID, current_user: User) -> Document:
        # Busca o documento no banco
        document = self.repository.get_by_id(document_id)

        # veridicando se o documento existe no banco
        if not document:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="documento não encontrado."
            )

        # Confere se o usuario logado é o dono do documento
        if document.owner_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Você não tem permissão para acessar este documento."
            )

        return document

    # lista os documentos do dono
    def get_user_documents(self, current_user: User) -> List[Document]:
        return self.repository.get_all_by_owner(owner_id=current_user.id)

    # reaproveitando o metodo ja com as validações
    def delete_document(self, document_id: uuid.UUID, current_user: User) -> None:
        document = self.get_document(document_id=document_id, current_user=current_user)
        
        # 1. Remove o arquivo físico do disco
        if document.file_path and os.path.exists(document.file_path):
            try:
                os.remove(document.file_path)
            except Exception as e:
                # Log o erro, dependendo da criticidade você pode decidir não excluir do banco
                print(f"Erro ao excluir arquivo físico: {e}")
        
        # 2. Remove o registro do banco
        self.repository.delete(document)