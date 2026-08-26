import uuid
from typing import List
from fastapi import APIRouter, Depends, status

from app.database.dependencies import get_current_user, get_notebook_service
from app.database.models.user import User
from app.schemas.notebook_schema import (
    NotebookCreate,
    NotebookUpdate,
    NotebookResponse,
    NotebookDetailResponse,
)
from app.schemas.document_schema import DocumentResponse
from app.services.notebook_service import NotebookService

router = APIRouter(prefix="/notebooks", tags=["Notebooks & Projetos"])


@router.post(
    "/",
    response_model=NotebookResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Cria um novo notebook/caderno",
)
def create_notebook(
    notebook_in: NotebookCreate,
    current_user: User = Depends(get_current_user),
    service: NotebookService = Depends(get_notebook_service),
):
    return service.create_notebook(notebook_in=notebook_in, owner_id=current_user.id)


@router.get(
    "/",
    response_model=List[NotebookResponse],
    status_code=status.HTTP_200_OK,
    summary="Lista todos os cadernos do usuário com contagem de fontes",
)
def list_notebooks(
    current_user: User = Depends(get_current_user),
    service: NotebookService = Depends(get_notebook_service),
):
    return service.list_notebooks(owner_id=current_user.id)


@router.get(
    "/{notebook_id}",
    response_model=NotebookDetailResponse,
    status_code=status.HTTP_200_OK,
    summary="Obtém detalhes do caderno e sua lista de documentos vinculados",
)
def get_notebook(
    notebook_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    service: NotebookService = Depends(get_notebook_service),
):
    return service.get_notebook_detail(
        notebook_id=notebook_id, owner_id=current_user.id
    )


@router.get(
    "/{notebook_id}/documents",
    response_model=List[DocumentResponse],
    status_code=status.HTTP_200_OK,
    summary="Lista exclusivamente os documentos pertencentes ao caderno especificado",
)
def get_notebook_documents(
    notebook_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    service: NotebookService = Depends(get_notebook_service),
):
    return service.get_notebook_documents(
        notebook_id=notebook_id, owner_id=current_user.id
    )


@router.put(
    "/{notebook_id}",
    response_model=NotebookResponse,
    status_code=status.HTTP_200_OK,
    summary="Atualiza o título ou metadados do caderno",
)
def update_notebook(
    notebook_id: uuid.UUID,
    updates: NotebookUpdate,
    current_user: User = Depends(get_current_user),
    service: NotebookService = Depends(get_notebook_service),
):
    return service.update_notebook(
        notebook_id=notebook_id, updates=updates, owner_id=current_user.id
    )


@router.delete(
    "/{notebook_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Exclui um caderno e todas as suas fontes vinculadas (cascade)",
)
def delete_notebook(
    notebook_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    service: NotebookService = Depends(get_notebook_service),
):
    service.delete_notebook(notebook_id=notebook_id, owner_id=current_user.id)
