import uuid
from typing import List

from fastapi import (
    APIRouter,
    UploadFile,
    File,
    HTTPException,
    Depends,
    status,
)
from sqlalchemy.orm import Session

# Dependências de banco e autenticação
from app.database.dependencies import get_db
from app.api.routes_auth import get_current_user
from app.database.models.user import User

# Schemas, Repositório e Serviço
from app.schemas.document_schema import (
    DocumentCreate,
    DocumentResponse,
    DocumentUploadResponse,
)
from app.repositories.document_repository import DocumentRepository
from app.services.document_service import DocumentService


router = APIRouter(prefix="/documents", tags=["Documents"])

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
ALLOWED_MIME_TYPES = ["application/pdf"]


def get_document_service(db: Session = Depends(get_db)):
    repository = DocumentRepository(db)
    return DocumentService(repository)


@router.post(
    "/upload",
    response_model=DocumentUploadResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def upload_document(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    # service: DocumentService = Depends(get_document_service),
):
    # 1. Validação do tipo do arquivo
    if file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Apenas arquivos PDF são permitidos.",
        )

    # 2. Validação do tamanho do arquivo
    if file.size is not None:
        if file.size > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"O arquivo excede o limite de {MAX_FILE_SIZE / (1024 * 1024):.0f} MB.",
            )
    else:
        # Compatibilidade com versões antigas do FastAPI
        file.file.seek(0, 2)
        file_size = file.file.tell()
        file.file.seek(0)

        if file_size > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"O arquivo excede o limite de {MAX_FILE_SIZE / (1024 * 1024):.0f} MB.",
            )

    # 3. Validação do nome do arquivo
    if file.filename is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nome do arquivo não informado.",
        )

    # 4. Futuramente:
    # document = await service.process_initial_upload(
    #     file=file,
    #     user_id=current_user.id,
    # )

    # 5. Mock da resposta
    return DocumentUploadResponse(
        id=uuid.uuid4(),
        filename=file.filename,
        status="RECEIVED",
        message="Upload concluído. Documento na fila de processamento.",
    )


@router.post(
    "/",
    response_model=DocumentResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_document(
    document_in: DocumentCreate,
    current_user: User = Depends(get_current_user),
    service: DocumentService = Depends(get_document_service),
):
    return service.create_document(
        document_in=document_in,
        current_user=current_user,
    )


@router.get("/", response_model=List[DocumentResponse])
def list_documents(
    current_user: User = Depends(get_current_user),
    service: DocumentService = Depends(get_document_service),
):
    return service.get_user_documents(current_user=current_user)


@router.get("/{document_id}", response_model=DocumentResponse)
def get_document(
    document_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    service: DocumentService = Depends(get_document_service),
):
    return service.get_document(
        document_id=document_id,
        current_user=current_user,
    )


@router.delete(
    "/{document_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_document(
    document_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    service: DocumentService = Depends(get_document_service),
):
    service.delete_document(
        document_id=document_id,
        current_user=current_user,
    )