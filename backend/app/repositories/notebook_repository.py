import uuid
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database.models.notebook import Notebook
from app.database.models.document import Document
from app.schemas.notebook_schema import NotebookCreate, NotebookUpdate


class NotebookRepository:
    """Repositório de acesso a dados para Cadernos/Notebooks."""

    def __init__(self, db: Session):
        self.db = db

    def create(self, notebook_in: NotebookCreate, owner_id: uuid.UUID) -> Notebook:
        notebook = Notebook(
            title=notebook_in.title,
            description=notebook_in.description,
            emoji=notebook_in.emoji or "📑",
            owner_id=owner_id,
        )
        self.db.add(notebook)
        self.db.commit()
        self.db.refresh(notebook)
        return notebook

    def get_by_id(self, notebook_id: uuid.UUID, owner_id: uuid.UUID) -> Optional[Notebook]:
        return (
            self.db.query(Notebook)
            .filter(Notebook.id == notebook_id, Notebook.owner_id == owner_id)
            .first()
        )

    def get_all_by_owner(self, owner_id: uuid.UUID) -> List[tuple[Notebook, int]]:
        """Retorna os cadernos do usuário acompanhados da contagem de fontes."""
        results = (
            self.db.query(Notebook, func.count(Document.id).label("source_count"))
            .outerjoin(Document, Document.notebook_id == Notebook.id)
            .filter(Notebook.owner_id == owner_id)
            .group_by(Notebook.id)
            .order_by(Notebook.updated_at.desc())
            .all()
        )
        return results

    def get_documents(self, notebook_id: uuid.UUID, owner_id: uuid.UUID) -> List[Document]:
        return (
            self.db.query(Document)
            .filter(Document.notebook_id == notebook_id, Document.owner_id == owner_id)
            .order_by(Document.created_at.desc())
            .all()
        )

    def update(
        self, notebook: Notebook, updates: NotebookUpdate
    ) -> Notebook:
        if updates.title is not None:
            notebook.title = updates.title
        if updates.description is not None:
            notebook.description = updates.description
        if updates.emoji is not None:
            notebook.emoji = updates.emoji

        self.db.commit()
        self.db.refresh(notebook)
        return notebook

    def delete(self, notebook: Notebook) -> None:
        self.db.delete(notebook)
        self.db.commit()
