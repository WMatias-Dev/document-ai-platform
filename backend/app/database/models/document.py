import uuid
from sqlalchemy import String, Text, ForeignKey, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base

class Document(Base):
    __tablename__ = "documents"

    #Chave Primária usando UUID
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True
    )

    #Dados do documento
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=True)

    #Chave estrangeira
    #O id na tabela User precisa ser UUID para funcionar corretamente
    owner_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False
    )

    #relacionamento orm
    owner = relationship("User", back_populates="documents")