import uuid
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database.models.notebook import Notebook
from app.database.models.document import Document
from app.schemas.notebook_schema import NotebookCreate, NotebookUpdate


class NotebookRepository:
    """Repositório de acesso a dados para cadernos de estudo e pesquisa.

    Centraliza as operações de persistência e consulta SQL para a entidade Notebook,
    garantindo que o isolamento multi-tenant por owner_id seja sempre respeitado.
    """

    def __init__(self, db: Session):
        self.db = db

    def create(self, notebook_in: NotebookCreate, owner_id: uuid.UUID) -> Notebook:
        """Cria e persiste um novo caderno associado ao usuário proprietário."""
        # Se nenhum emoji de identificação for fornecido, define um ícone padrão amigável
        notebook = Notebook(
            title=notebook_in.title,
            description=notebook_in.description,
            emoji=notebook_in.emoji or "📑",
            owner_id=owner_id,
        )
        self.db.add(notebook)
        self.db.commit()
        # Atualiza a instância com campos gerados no banco, como ID e timestamps
        self.db.refresh(notebook)
        return notebook

    def get_by_id(self, notebook_id: uuid.UUID, owner_id: uuid.UUID) -> Optional[Notebook]:
        """Busca um caderno pelo identificador, filtrando pelo proprietário."""
        # Filtrar por owner_id previne acesso indevido por referência direta (IDOR)
        return (
            self.db.query(Notebook)
            .filter(Notebook.id == notebook_id, Notebook.owner_id == owner_id)
            .first()
        )

    def get_all_by_owner(self, owner_id: uuid.UUID) -> List[tuple[Notebook, int]]:
        """Retorna os cadernos do usuário acompanhados da contagem de fontes."""
        # O outerjoin garante que cadernos vazios (sem documentos) também sejam retornados com contagem 0.
        # A agregação via SQL evita o problema de N+1 queries se contássemos documentos por requisição individual.
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
        """Lista os documentos pertencentes a um caderno específico do usuário."""
        # Garante que mesmo conhecendo o notebook_id, apenas o dono legítimo liste os documentos anexados
        return (
            self.db.query(Document)
            .filter(Document.notebook_id == notebook_id, Document.owner_id == owner_id)
            .order_by(Document.created_at.desc())
            .all()
        )

    def update(
        self, notebook: Notebook, updates: NotebookUpdate
    ) -> Notebook:
        """Aplica alterações parciais nos campos de título, descrição ou emoji do caderno."""
        # Atualiza apenas os campos enviados no payload, preservando o valor anterior quando None
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
        """Remove o caderno do banco de dados e confirma a transação."""
        # TODO: Garantir que remoções em cascata de documentos e embeddings estejam tratadas nas chaves estrangeiras
        self.db.delete(notebook)
        self.db.commit()
