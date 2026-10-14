import uuid
from typing import List, Optional
from sqlalchemy.orm import Session
from app.database.models.chat_thread import ChatThread
from app.database.models.chat_message import ChatMessage


class ChatRepository:
    """
    Gerencia a persistência de conversas (threads) e mensagens trocadas com o assistente no banco de dados.
    """

    def __init__(self, db: Session):
        self.db = db

    def get_or_create_thread(
        self,
        owner_id: uuid.UUID,
        notebook_id: Optional[uuid.UUID] = None,
        title: str = "Nova Conversa",
    ) -> ChatThread:
        """Retorna a conversa mais recente do caderno ou cria uma nova se ainda não existir."""
        # Filtro por owner_id para reaproveitar apenas conversas pertencentes ao próprio usuário logado
        query = self.db.query(ChatThread).filter(ChatThread.owner_id == owner_id)
        if notebook_id:
            query = query.filter(ChatThread.notebook_id == notebook_id)

        thread = query.order_by(ChatThread.updated_at.desc()).first()
        # Se não houver conversa aberta para esse caderno, crio uma nova com o título informado
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
        """Lista todas as conversas do usuário ordenadas pela data da última mensagem."""
        query = self.db.query(ChatThread).filter(ChatThread.owner_id == owner_id)
        if notebook_id:
            query = query.filter(ChatThread.notebook_id == notebook_id)
        # Ordeno por updated_at descendente para o frontend exibir as conversas ativas no topo
        return query.order_by(ChatThread.updated_at.desc()).all()

    def get_thread_by_id(
        self, thread_id: uuid.UUID, owner_id: uuid.UUID
    ) -> Optional[ChatThread]:
        """Busca uma conversa específica validando obrigatoriamente se pertence ao usuário."""
        # Exijo o owner_id na query para garantir isolamento multi-tenant e evitar acesso a chats alheios
        return (
            self.db.query(ChatThread)
            .filter(ChatThread.id == thread_id, ChatThread.owner_id == owner_id)
            .first()
        )

    def get_thread_messages(
        self, thread_id: uuid.UUID, owner_id: uuid.UUID
    ) -> List[ChatMessage]:
        """Devolve todas as mensagens de uma conversa em ordem cronológica de envio."""
        # Valido primeiro se a thread pertence ao usuário antes de listar qualquer mensagem do banco
        thread = self.get_thread_by_id(thread_id, owner_id)
        if not thread:
            return []
        # TODO: implementar paginação com limit/offset se a conversa tiver centenas de mensagens acumuladas
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
        """Registra uma mensagem (user ou assistant) e atualiza o timestamp da conversa pai."""
        message = ChatMessage(
            id=uuid.uuid4(),
            thread_id=thread_id,
            role=role,
            content=content,
            citations=citations,
            model_used=model_used,
        )
        self.db.add(message)

        # Atualizo o updated_at da thread para ela subir para o topo da lista de conversas recentes
        thread = self.db.query(ChatThread).filter(ChatThread.id == thread_id).first()
        if thread:
            from datetime import datetime, timezone
            thread.updated_at = datetime.now(timezone.utc)

        self.db.commit()
        self.db.refresh(message)
        return message
