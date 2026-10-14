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
    """Fábrica de injeção de dependência para compor o Agente RAG.

    Instancia o agente a cada requisição injetando o serviço de busca de documentos
    e o repositório para persistência do histórico e citações.
    """
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
    """Transmite a resposta da IA em tempo real com eventos SSE e persiste o diálogo."""
    # O streaming reduz o Time To First Token (TTFT) percebido pelo usuário de segundos para milissegundos
    try:
        # X-Accel-Buffering e Cache-Control instruem proxies reversos a não reter tokens parciais em buffer
        return StreamingResponse(
            agent.ask_stream(request=request, current_user=current_user),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )
    except HTTPException:
        raise
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
    """Processa a pergunta de forma síncrona e retorna a resposta completa com fontes."""
    # Alternativa simplificada para integrações backend-to-backend ou clientes sem suporte a SSE
    try:
        return agent.ask(request=request, current_user=current_user)
    except HTTPException:
        raise
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
    """Retorna as sessões de chat do usuário autenticado, com filtro opcional por caderno."""
    # O filtro por owner_id garante isolamento multi-tenant impedindo visualização de conversas de terceiros
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
    """Recupera o histórico cronológico de mensagens e citações de uma thread do usuário."""
    thread = chat_repo.get_thread_by_id(thread_id=thread_id, owner_id=current_user.id)
    if not thread:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversa não encontrada.",
        )
    return chat_repo.get_thread_messages(thread_id=thread_id, owner_id=current_user.id)
