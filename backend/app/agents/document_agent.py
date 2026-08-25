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
Sua missão é responder à dúvida do usuário com precisão, clareza e fidelidade máxima aos documentos do usuário.

Diretrizes Obrigatórias:
1. Baseie sua resposta ESTRITAMENTE nas informações presentes no 'Contexto dos Documentos' fornecido.
2. Não invente, não deduza sem embasamento e não alucine fatos ausentes nos documentos.
3. Se as informações fornecidas no contexto não forem suficientes para responder à pergunta, diga claramente: "Não encontrei informações suficientes nos seus documentos para responder a essa pergunta."
4. Faça referência aos nomes dos documentos ao citar dados relevantes.
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
        """
        Executa o pipeline RAG:
        1. Recupera os trechos mais relevantes via busca vetorial.
        2. Monta o contexto enriquecido e o histórico conversacional.
        3. Invoca o Gemini 3.7 Flash para síntese da resposta.
        4. Retorna a resposta acompanhada das citações das fontes.
        """
        logger.info(
            f"[DocumentAgent] Pergunta recebida do usuário {current_user.email}: '{request.message}'"
        )

        # 1. Recuperação Semântica (Vector Retrieval)
        search_request = DocumentSearchRequest(
            query=request.message,
            document_id=request.document_id,
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

        # 2. Montagem do Contexto Documental
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

        # 3. Formatação do Histórico Conversacional
        history_text = ""
        if request.history:
            formatted_history = []
            for msg in request.history[-6:]:  # Considera as últimas 6 mensagens
                role_name = "Usuário" if msg.role == "user" else "Assistente"
                formatted_history.append(f"{role_name}: {msg.content}")
            history_text = "Histórico da Conversa:\n" + "\n".join(formatted_history) + "\n\n"

        # 4. Construção do Prompt Completo
        full_prompt = (
            f"Contexto dos Documentos:\n{context_text}\n\n"
            f"{history_text}"
            f"Pergunta do Usuário: {request.message}\n\n"
            f"Resposta:"
        )

        # 5. Geração de Resposta com Gemini 3.7 Flash
        answer = self.ai_service.generate_response(
            prompt=full_prompt,
            system_instruction=SYSTEM_PROMPT,
        )

        return ChatResponse(
            answer=answer,
            citations=citations,
            model=self.ai_service.model_name,
        )
