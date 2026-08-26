import logging
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse

from app.agents.document_agent import DocumentAgent
from app.database.dependencies import (
    get_chat_repository,
    get_current_user,
    get_document_service,
)
from app.database.models.user import User
from app.repositories.chat_repository import ChatRepository
from app.schemas.chat_schema import (
    ChatMessageResponse,
    ChatRequest,
    ChatResponse,
    ChatThreadResponse,
)
from app.services.document_service import DocumentService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/chat", tags=["Chat & IA"])


def get_document_agent(
    doc_service: DocumentService = Depends(get_document_service),
    chat_repo: ChatRepository = Depends(get_chat_repository),
) -> DocumentAgent:
    """Fábrica de injeção de dependência para o Agente RAG com persistência."""
    return DocumentAgent(document_service=doc_service, chat_repository=chat_repo)


@router.post(
    "/stream",
    summary="Chat RAG com Streaming SSE e persistência de histórico",
)
def chat_stream_with_documents(
    request: ChatRequest,
    current_user: User = Depends(get_current_user),
    agent: DocumentAgent = Depends(get_document_agent),
):
    """
    Transmite a resposta do Gemini em tempo real através de Server-Sent Events (SSE),
    emitindo eventos 'citations', 'delta', 'done' e persistindo as mensagens no banco.
    """
    try:
        return StreamingResponse(
            agent.ask_stream(request=request, current_user=current_user),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )
    except Exception as e:
        logger.error(f"Erro ao iniciar streaming do chat RAG: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro no streaming da IA: {str(e)}",
        )


@router.post(
    "/",
    response_model=ChatResponse,
    status_code=status.HTTP_200_OK,
    summary="Conversa RAG síncrona sobre os documentos do usuário",
)
def chat_with_documents(
    request: ChatRequest,
    current_user: User = Depends(get_current_user),
    agent: DocumentAgent = Depends(get_document_agent),
):
    """
    Envia uma mensagem para o assistente de IA de forma síncrona.
    """
    try:
        return agent.ask(request=request, current_user=current_user)
    except Exception as e:
        logger.error(f"Erro no processamento do chat RAG: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro no processamento da IA: {str(e)}",
        )


@router.get(
    "/threads",
    response_model=List[ChatThreadResponse],
    summary="Lista as conversas/threads do usuário",
)
def list_threads(
    notebook_id: Optional[uuid.UUID] = Query(None, description="Filtro por ID do caderno"),
    current_user: User = Depends(get_current_user),
    chat_repo: ChatRepository = Depends(get_chat_repository),
):
    """
    Retorna a lista de todas as conversas ativas do usuário para um caderno ou globais.
    """
    return chat_repo.list_threads(owner_id=current_user.id, notebook_id=notebook_id)


@router.get(
    "/threads/{thread_id}/messages",
    response_model=List[ChatMessageResponse],
    summary="Recupera o histórico de mensagens de uma conversa",
)
def get_thread_messages(
    thread_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    chat_repo: ChatRepository = Depends(get_chat_repository),
):
    """
    Retorna todas as mensagens e citações salvas de uma thread no banco de dados.
    """
    messages = chat_repo.get_thread_messages(thread_id=thread_id, owner_id=current_user.id)
    return messages
