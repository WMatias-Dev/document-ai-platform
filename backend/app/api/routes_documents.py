import json
import os
import uuid
from typing import List, Optional
from sqlalchemy.orm import Session

from fastapi import (
    APIRouter,
    UploadFile,
    File,
    HTTPException,
    Depends,
    status,
    BackgroundTasks,
    Header,
    Query,
)
from fastapi.responses import StreamingResponse
from app.core.ingestion_queue import ingestion_queue

from app.database.dependencies import (
    get_current_user,
    get_document_service,
    get_user_by_token,
    get_db,
)
from app.database.models.document import DocumentStatus
from app.database.models.user import User
from app.schemas.document_schema import (
    DocumentCreate,
    DocumentResponse,
    DocumentSearchRequest,
    DocumentSearchResponse,
)
from app.services.document_service import DocumentService

router = APIRouter(prefix="/documents", tags=["Documents"])

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
ALLOWED_MIME_TYPES = ["application/pdf"]


@router.post(
    "/upload",
    status_code=status.HTTP_202_ACCEPTED,
    summary="Upload e processamento inicial de documento",
)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    notebook_id: uuid.UUID | None = None,
    current_user: User = Depends(get_current_user),
    document_service: DocumentService = Depends(get_document_service),
):
    if file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Apenas arquivos PDF são permitidos.",
        )

    if file.filename is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nome do arquivo não informado.",
        )

    if file.size is not None:
        if file.size > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"O arquivo excede o limite de {MAX_FILE_SIZE / (1024 * 1024):.0f} MB.",
            )
    else:
        file.file.seek(0, 2)
        file_size = file.file.tell()
        file.file.seek(0)
        if file_size > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"O arquivo excede o limite de {MAX_FILE_SIZE / (1024 * 1024):.0f} MB.",
            )

    return await document_service.process_upload(
        file=file,
        owner_id=current_user.id,
        background_tasks=background_tasks,
        notebook_id=notebook_id,
    )


@router.get(
    "/{document_id}/progress",
    summary="Acompanhamento do progresso de processamento em tempo real (SSE)",
)
async def get_document_progress(
    document_id: uuid.UUID,
    token: Optional[str] = Query(None),
    authorization: Optional[str] = Header(None),
    service: DocumentService = Depends(get_document_service),
    db: Session = Depends(get_db),
):
    """
    Transmite eventos Server-Sent Events (SSE) com status percentual da ingestão
    (parsing -> chunking -> embedding -> ready).
    Suporta autenticação via Bearer Header ou Query Parameter (?token=...).
    """
    auth_token = None
    if authorization and authorization.startswith("Bearer "):
        auth_token = authorization.split(" ")[1]
    elif token:
        auth_token = token

    if not auth_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token de autenticação não fornecido via Header ou Query.",
        )

    current_user = get_user_by_token(auth_token, db)
    doc = service.get_document(document_id=document_id, current_user=current_user)

    # Se o documento já concluiu ou falhou antes da conexão SSE se estabelecer
    if doc.status == DocumentStatus.COMPLETED:
        async def immediate_completed():
            payload = {
                "document_id": str(document_id),
                "status": "ready",
                "progress": 100,
                "message": "Documento indexado e pronto para pesquisa.",
            }
            yield f"data: {json.dumps(payload)}\n\n"

        return StreamingResponse(
            immediate_completed(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )

    if doc.status == DocumentStatus.ERROR:
        async def immediate_error():
            payload = {
                "document_id": str(document_id),
                "status": "error",
                "progress": 0,
                "message": "Falha no processamento do documento.",
            }
            yield f"data: {json.dumps(payload)}\n\n"

        return StreamingResponse(
            immediate_error(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )

    async def sse_stream():
        async for event in ingestion_queue.subscribe(document_id):
            yield f"data: {json.dumps(event)}\n\n"

    return StreamingResponse(
        sse_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
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


@router.get("/{document_id}/file", summary="Retorna o arquivo binário do PDF")
def get_document_file(
    document_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    service: DocumentService = Depends(get_document_service),
):
    from fastapi.responses import FileResponse
    doc = service.get_document(document_id=document_id, current_user=current_user)
    if not doc.file_path or not os.path.exists(doc.file_path):
        raise HTTPException(status_code=404, detail="Arquivo físico do PDF não encontrado.")

    return FileResponse(
        path=doc.file_path,
        media_type="application/pdf",
        filename=doc.filename or f"documento_{document_id}.pdf",
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


@router.post(
    "/search",
    response_model=DocumentSearchResponse,
    summary="Busca semântica por similaridade vetorial nos documentos",
)
def search_documents(
    search_in: DocumentSearchRequest,
    current_user: User = Depends(get_current_user),
    service: DocumentService = Depends(get_document_service),
):
    """
    Realiza busca vetorial por similaridade semântica utilizando o embedding da pergunta.
    Garante isolamento de dados: o usuário só recebe trechos dos seus próprios documentos.
    """
    return service.search_documents(
        search_in=search_in,
        current_user=current_user,
    )