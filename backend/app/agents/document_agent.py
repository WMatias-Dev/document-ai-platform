import logging
from typing import List, Optional
from app.database.models.user import User
from app.schemas.chat_schema import (
    ChatMessage,
    ChatRequest,
    ChatResponse,
    DocumentCitation,
)
from app.schemas.document_schema import DocumentSearchRequest
from app.services.ai_service import AIService
from app.services.document_service import DocumentService

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """Você é um assistente especialista em análise e inteligência documental da plataforma Document AI.
Sua missão é responder à dúvida do usuário com precisão cirúrgica, clareza e fidelidade absoluta aos documentos fornecidos.

Diretrizes Estritas de Auditoria e Fidelidade:
1. Baseie sua resposta UNICAMENTE nas cláusulas e afirmações explícitas presentes no 'Contexto dos Documentos'.
2. PROIBIÇÃO DE DEDUÇÕES: Não infira prazos, exceções, penalidades ou procedimentos que não estejam taxativamente descritos no texto.
3. Se a informação solicitada não constar textualmente no contexto, declare expressamente: "Esta informação não consta nos documentos fornecidos."
4. Ao citar valores, prazos ou regras, utilize a redação e os números exatos descritos nas fontes.
5. Responda em Português do Brasil de forma estruturada e profissional.
"""


class DocumentAgent:
    """
    Agente RAG responsável pela orquestração entre recuperação semântica e geração via Gemini 3.7.
    """

    def __init__(
        self,
        document_service: DocumentService,
        ai_service: Optional[AIService] = None,
    ):
        self.document_service = document_service
        self.ai_service = ai_service or AIService()

    def ask(self, request: ChatRequest, current_user: User) -> ChatResponse:
        logger.info(
            f"[DocumentAgent] Pergunta recebida do usuário {current_user.email}: '{request.message}'"
        )

        search_request = DocumentSearchRequest(
            query=request.message,
            notebook_id=request.notebook_id,
            document_id=request.document_id,
            source_ids=request.source_ids,
            limit=request.max_chunks,
        )

        search_response = self.document_service.search_documents(
            search_in=search_request,
            current_user=current_user,
        )

        citations: List[DocumentCitation] = [
            DocumentCitation(
                chunk_id=item.chunk_id,
                document_id=item.document_id,
                document_title=item.document_title,
                chunk_index=item.chunk_index,
                text_snippet=item.text_content,
                similarity_score=item.similarity_score,
            )
            for item in search_response.results
        ]

        if citations:
            context_blocks = []
            for i, cite in enumerate(citations, 1):
                block = (
                    f"--- Fonte [{i}] Documento: '{cite.document_title}' (Trecho {cite.chunk_index}) ---\n"
                    f"{cite.text_snippet}\n"
                )
                context_blocks.append(block)
            context_text = "\n".join(context_blocks)
        else:
            context_text = "Nenhum trecho de documento relevante foi encontrado para esta consulta."

        history_text = ""
        if request.history:
            formatted_history = []
            for msg in request.history[-6:]:
                role_name = "Usuário" if msg.role == "user" else "Assistente"
                formatted_history.append(f"{role_name}: {msg.content}")
            history_text = "Histórico da Conversa:\n" + "\n".join(formatted_history) + "\n\n"

        full_prompt = (
            f"Contexto dos Documentos:\n{context_text}\n\n"
            f"{history_text}"
            f"Pergunta do Usuário: {request.message}\n\n"
            f"Resposta:"
        )

        answer = self.ai_service.generate_response(
            prompt=full_prompt,
            system_instruction=SYSTEM_PROMPT,
        )

        return ChatResponse(
            answer=answer,
            citations=citations,
            model=self.ai_service.model_name,
        )
