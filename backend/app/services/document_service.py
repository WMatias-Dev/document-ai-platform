"""
Módulo do Serviço de Processamento de Documentos.

Lida com as regras de negócio de processamento e gerenciamento de arquivos enviados,
como a extração de texto, chunking (divisão do texto em partes) e fluxo de salvamento.

TODO (Etapa 3.0 & 4.0):
- Integrar com leitores de PDF para extrair o texto de arquivos carregados.
- Implementar estratégia de chunking (ex: RecursiveCharacterTextSplitter) para busca de RAG eficaz.
"""
import uuid
from typing import List
from fastapi import HTTPException, status
from app.repositories.document_repository import DocumentRepository
from app.schemas.document_schema import DocumentCreate
from app.database.models.document import Document
from app.database.models.user import User

class DocumentService:
    def __init__(self, repository: DocumentRepository):
        self.repository = repository

    def create_document(self, document_in: DocumentCreate, current_user: User) -> Document:
        #retorna os dados do usuario de forma segura
        return self.repository.create(document_in=document_in, owner_id=current_user.id)

    def get_document(self, document_id: uuid.UUID, current_user: User) -> Document:
        #Busca o documento no banco
        document = self.repository.get_by_id(document_id)

        #veridicando se o documento existe no banco
        if not document:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="documento não encontrado."
            )

        #Confere se o usuario logado é o dono do documento
        if document.owner_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Você não tem permissão para acessar este documento."
            )

        return document

    #lista os documentos do dono
    def get_user_documents(self, current_user: User) -> List[Document]:
        return self.repository.get_all_by_owner(owner_id=current_user.id)

    #reaproveitnado o metodo ja com as validações
    def delete_document(self, document_id: uuid.UUID, current_user: User) -> None:
        document = self.get_document(document_id=document_id, current_user=current_user)

        self.repository.delete(document)