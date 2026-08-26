import uuid
from typing import List
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.database.models.document import Document
from app.repositories.notebook_repository import NotebookRepository
from app.schemas.notebook_schema import (
    NotebookCreate,
    NotebookUpdate,
    NotebookResponse,
    NotebookDetailResponse,
)
from app.schemas.document_schema import DocumentResponse


class NotebookService:
    """Serviço de regras de negócio para Notebooks."""

    def __init__(self, db: Session):
        self.db = db
        self.repository = NotebookRepository(db)

    def create_notebook(
        self, notebook_in: NotebookCreate, owner_id: uuid.UUID
    ) -> NotebookResponse:
        notebook = self.repository.create(notebook_in=notebook_in, owner_id=owner_id)
        return NotebookResponse(
            id=notebook.id,
            title=notebook.title,
            description=notebook.description,
            emoji=notebook.emoji,
            owner_id=notebook.owner_id,
            created_at=notebook.created_at,
            updated_at=notebook.updated_at,
            source_count=0,
        )

    def list_notebooks(self, owner_id: uuid.UUID) -> List[NotebookResponse]:
        results = self.repository.get_all_by_owner(owner_id=owner_id)
        return [
            NotebookResponse(
                id=nb.id,
                title=nb.title,
                description=nb.description,
                emoji=nb.emoji,
                owner_id=nb.owner_id,
                created_at=nb.created_at,
                updated_at=nb.updated_at,
                source_count=count,
            )
            for nb, count in results
        ]

    def get_notebook_detail(
        self, notebook_id: uuid.UUID, owner_id: uuid.UUID
    ) -> NotebookDetailResponse:
        notebook = self.repository.get_by_id(notebook_id=notebook_id, owner_id=owner_id)
        if not notebook:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Notebook não encontrado.",
            )

        docs = self.repository.get_documents(notebook_id=notebook_id, owner_id=owner_id)
        doc_responses = [
            DocumentResponse(
                id=d.id,
                title=d.title,
                content=d.content,
                filename=d.filename,
                file_path=d.file_path,
                content_type=d.content_type,
                status=d.status.value if d.status else None,
                owner_id=d.owner_id,
                notebook_id=d.notebook_id,
            )
            for d in docs
        ]

        return NotebookDetailResponse(
            id=notebook.id,
            title=notebook.title,
            description=notebook.description,
            emoji=notebook.emoji,
            owner_id=notebook.owner_id,
            created_at=notebook.created_at,
            updated_at=notebook.updated_at,
            source_count=len(docs),
            documents=doc_responses,
        )

    def get_notebook_documents(
        self, notebook_id: uuid.UUID, owner_id: uuid.UUID
    ) -> List[DocumentResponse]:
        notebook = self.repository.get_by_id(notebook_id=notebook_id, owner_id=owner_id)
        if not notebook:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Notebook não encontrado.",
            )

        docs = self.repository.get_documents(notebook_id=notebook_id, owner_id=owner_id)
        return [
            DocumentResponse(
                id=d.id,
                title=d.title,
                content=d.content,
                filename=d.filename,
                file_path=d.file_path,
                content_type=d.content_type,
                status=d.status.value if d.status else None,
                owner_id=d.owner_id,
                notebook_id=d.notebook_id,
            )
            for d in docs
        ]

    def update_notebook(
        self, notebook_id: uuid.UUID, updates: NotebookUpdate, owner_id: uuid.UUID
    ) -> NotebookResponse:
        notebook = self.repository.get_by_id(notebook_id=notebook_id, owner_id=owner_id)
        if not notebook:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Notebook não encontrado.",
            )

        updated = self.repository.update(notebook=notebook, updates=updates)
        docs = self.repository.get_documents(notebook_id=notebook_id, owner_id=owner_id)
        return NotebookResponse(
            id=updated.id,
            title=updated.title,
            description=updated.description,
            emoji=updated.emoji,
            owner_id=updated.owner_id,
            created_at=updated.created_at,
            updated_at=updated.updated_at,
            source_count=len(docs),
        )

    def delete_notebook(self, notebook_id: uuid.UUID, owner_id: uuid.UUID) -> None:
        notebook = self.repository.get_by_id(notebook_id=notebook_id, owner_id=owner_id)
        if not notebook:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Notebook não encontrado.",
            )
        self.repository.delete(notebook=notebook)
