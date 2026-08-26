import uuid
from typing import List, Optional
from sqlalchemy.orm import Session
from app.database.models.chat_thread import ChatThread
from app.database.models.chat_message import ChatMessage


class ChatRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_or_create_thread(
        self,
        owner_id: uuid.UUID,
        notebook_id: Optional[uuid.UUID] = None,
        title: str = "Nova Conversa",
    ) -> ChatThread:
        """
        Retorna a thread mais recente vinculada ao caderno/usuário, ou cria uma nova caso não exista.
        """
        query = self.db.query(ChatThread).filter(ChatThread.owner_id == owner_id)
        if notebook_id:
            query = query.filter(ChatThread.notebook_id == notebook_id)

        thread = query.order_by(ChatThread.updated_at.desc()).first()
        if not thread:
            thread = ChatThread(
                id=uuid.uuid4(),
                owner_id=owner_id,
                notebook_id=notebook_id,
                title=title,
            )
            self.db.add(thread)
            self.db.commit()
            self.db.refresh(thread)

        return thread

    def list_threads(
        self, owner_id: uuid.UUID, notebook_id: Optional[uuid.UUID] = None
    ) -> List[ChatThread]:
        """
        Lista todas as conversas do usuário, opcionalmente filtradas pelo caderno.
        """
        query = self.db.query(ChatThread).filter(ChatThread.owner_id == owner_id)
        if notebook_id:
            query = query.filter(ChatThread.notebook_id == notebook_id)
        return query.order_by(ChatThread.updated_at.desc()).all()

    def get_thread_by_id(
        self, thread_id: uuid.UUID, owner_id: uuid.UUID
    ) -> Optional[ChatThread]:
        return (
            self.db.query(ChatThread)
            .filter(ChatThread.id == thread_id, ChatThread.owner_id == owner_id)
            .first()
        )

    def get_thread_messages(
        self, thread_id: uuid.UUID, owner_id: uuid.UUID
    ) -> List[ChatMessage]:
        thread = self.get_thread_by_id(thread_id, owner_id)
        if not thread:
            return []
        return (
            self.db.query(ChatMessage)
            .filter(ChatMessage.thread_id == thread_id)
            .order_by(ChatMessage.created_at.asc())
            .all()
        )

    def add_message(
        self,
        thread_id: uuid.UUID,
        role: str,
        content: str,
        citations: Optional[list] = None,
        model_used: Optional[str] = None,
    ) -> ChatMessage:
        message = ChatMessage(
            id=uuid.uuid4(),
            thread_id=thread_id,
            role=role,
            content=content,
            citations=citations,
            model_used=model_used,
        )
        self.db.add(message)

        # Atualiza a data da thread
        thread = self.db.query(ChatThread).filter(ChatThread.id == thread_id).first()
        if thread:
            from datetime import datetime, timezone
            thread.updated_at = datetime.now(timezone.utc)

        self.db.commit()
        self.db.refresh(message)
        return message
