import enum
import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Text, ForeignKey, Enum, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base

# Enum para garantir a observabilidade do fluxo de processamento
class DocumentStatus(str, enum.Enum):
    RECEIVED = "RECEIVED"
    PARSING = "PARSING"
    CHUNKING = "CHUNKING"
    EMBEDDING = "EMBEDDING"
    COMPLETED = "COMPLETED"
    ERROR = "ERROR"

class Document(Base):
    __tablename__ = "documents"

    # Chave Primária
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), 
        primary_key=True, 
        default=uuid.uuid4, 
        index=True
    )

    # Dados lógicos do documento (Mantidos da sua versão)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    content: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    # Metadados do arquivo físico
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    file_path: Mapped[str] = mapped_column(String(255), nullable=False)
    content_type: Mapped[str] = mapped_column(String(100), nullable=False)
    
    # Controle de estado
    status: Mapped[DocumentStatus] = mapped_column(
        Enum(DocumentStatus), 
        default=DocumentStatus.RECEIVED, 
        nullable=False
    )
    
    # Rastreabilidade temporal
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # Chave estrangeira (Mantida da sua versão)
    owner_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), 
        nullable=False
    )

    # Relacionamento ORM
    owner = relationship("User", back_populates="documents")
    chunks = relationship("DocumentChunk", back_populates="document", cascade="all, delete-orphan")