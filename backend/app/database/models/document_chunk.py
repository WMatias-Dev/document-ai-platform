import uuid
from sqlalchemy import Text, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import UUID
from pgvector.sqlalchemy import Vector
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.base import Base

class DocumentChunk(Base):
    __tablename__ = "document_chunks"

    # Chave Primária
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), 
        primary_key=True, 
        default=uuid.uuid4, 
        index=True
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    document_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("documents.id", ondelete="CASCADE"), nullable=False)
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
    text_content: Mapped[str] = mapped_column(Text, nullable=False)

    # Chave estrangeira ligando ao documento pai
    document_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("documents.id", ondelete="CASCADE"), 
        nullable=False
    )

    # Ordem do pedaço (para reconstruir o texto se necessário)
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
    
    # O fragmento de texto em si
    text_content: Mapped[str] = mapped_column(Text, nullable=False)

    #COLUNA VETORIAL (nomic-embed-text gera 768 dimensões)
    embedding: Mapped[list[float]] = mapped_column(Vector(768), nullable=True)

    # Relacionamento ORM bidirecional
    document = relationship("Document", back_populates="chunks")