"""
Módulo de Rotas de Gestão de Documentos.

Responsável por listar, carregar (upload), visualizar e deletar documentos
enviados pelos usuários.

TODO (Etapa 3.0 & 4.0):
- Implementar upload de arquivos PDF (POST /documents/upload).
- Implementar endpoints CRUD básicos de listagem e exclusão de documentos.
- Conectar o upload com o processamento do texto do PDF.
"""
import uuid
from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

#dependências de banco e autenticação
from app.database.dependencies import get_db
from app.api.routes_auth import get_current_user # Assumindo que sua dependência ficou aqui ou no auth
from app.database.models.user import User

# Schemas, Repositório e Serviço
from app.schemas.document_schema import DocumentCreate, DocumentResponse
from app.repositories.document_repository import DocumentRepository
from app.services.document_service import DocumentService

router = APIRouter(prefix="/documents", tags=["Documents"])

# Função auxiliar para injetar o serviço prontinho nas rotas
def get_document_service(db: Session = Depends(get_db)):
    repository = DocumentRepository(db)
    return DocumentService(repository)

@router.post("/", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
def create_document(
    document_in: DocumentCreate,
    current_user: User = Depends(get_current_user),
    service: DocumentService = Depends(get_document_service)
):
    # Rota simples que repassa a requisição e o usuário logado para o serviço
    return service.create_document(document_in=document_in, current_user=current_user)

@router.get("/", response_model=List[DocumentResponse])
def list_documents(
    current_user: User = Depends(get_current_user),
    service: DocumentService = Depends(get_document_service)
):
    return service.get_user_documents(current_user=current_user)

@router.get("/{document_id}", response_model=DocumentResponse)
def get_document(
    document_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    service: DocumentService = Depends(get_document_service)
):
    return service.get_document(document_id=document_id, current_user=current_user)

@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(
    document_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    service: DocumentService = Depends(get_document_service)
):
    service.delete_document(document_id=document_id, current_user=current_user)
    return None