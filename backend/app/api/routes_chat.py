import logging
from fastapi import APIRouter, Depends, status

from app.agents.document_agent import DocumentAgent
from app.database.dependencies import get_current_user, get_document_service
from app.database.models.user import User
from app.schemas.chat_schema import ChatRequest, ChatResponse
from app.services.document_service import DocumentService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/chat", tags=["Chat & IA"])


def get_document_agent(
    doc_service: DocumentService = Depends(get_document_service),
) -> DocumentAgent:
    """Fábrica de injeção de dependência para o Agente RAG."""
    return DocumentAgent(document_service=doc_service)


@router.post(
    "/",
    response_model=ChatResponse,
    status_code=status.HTTP_200_OK,
    summary="Conversa inteligente e RAG sobre os documentos do usuário",
)
def chat_with_documents(
    request: ChatRequest,
    current_user: User = Depends(get_current_user),
    agent: DocumentAgent = Depends(get_document_agent),
):
    """
    Envia uma mensagem para o assistente de IA (Gemini 3.7 Flash).
    O assistente busca trechos relevantes nos PDFs do usuário, sintetiza
    uma resposta fundamentada e retorna os links/citações das fontes.
    """
    return agent.ask(request=request, current_user=current_user)
