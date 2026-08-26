import json
import logging
from typing import Generator, List, Optional
import uuid

from app.database.models.user import User
from app.repositories.chat_repository import ChatRepository
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
    Agente RAG responsável pela orquestração entre recuperação semântica,
    persistência de histórico no PostgreSQL e geração de respostas (síncronas ou streaming) via Gemini.
    """

    def __init__(
        self,
        document_service: DocumentService,
        ai_service: Optional[AIService] = None,
        chat_repository: Optional[ChatRepository] = None,
    ):
        self.document_service = document_service
        self.ai_service = ai_service or AIService()
        self.chat_repository = chat_repository

    def _prepare_rag_context(self, request: ChatRequest, current_user: User):
        """Recupera trechos relevantes e monta o prompt contextualizado."""
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

        return full_prompt, citations

    def ask(self, request: ChatRequest, current_user: User) -> ChatResponse:
        logger.info(
            f"[DocumentAgent] Pergunta síncrona do usuário {current_user.email}: '{request.message}'"
        )

        # 1. Persistência de Thread & Pergunta do Usuário
        thread_id = request.thread_id
        if self.chat_repository:
            if not thread_id:
                thread = self.chat_repository.get_or_create_thread(
                    owner_id=current_user.id,
                    notebook_id=request.notebook_id,
                    title=request.message[:40],
                )
                thread_id = thread.id
            self.chat_repository.add_message(
                thread_id=thread_id,
                role="user",
                content=request.message,
            )

        full_prompt, citations = self._prepare_rag_context(request, current_user)

        answer = self.ai_service.generate_response(
            prompt=full_prompt,
            system_instruction=SYSTEM_PROMPT,
        )

        # 2. Persistência da Resposta do Assistente
        if self.chat_repository and thread_id:
            citations_data = [c.model_dump(mode="json") for c in citations]
            self.chat_repository.add_message(
                thread_id=thread_id,
                role="assistant",
                content=answer,
                citations=citations_data,
                model_used=self.ai_service.model_name,
            )

        return ChatResponse(
            answer=answer,
            citations=citations,
            model=self.ai_service.model_name,
            thread_id=thread_id,
        )

    def ask_stream(
        self, request: ChatRequest, current_user: User
    ) -> Generator[str, None, None]:
        """
        Gera eventos SSE (Server-Sent Events) transmitindo fontes e tokens progressivamente,
        enquanto persiste as mensagens de usuário e assistente no banco de dados.
        """
        logger.info(
            f"[DocumentAgent] Pergunta streaming do usuário {current_user.email}: '{request.message}'"
        )

        # 1. Resolve ou cria thread e persiste mensagem do usuário
        thread_id = request.thread_id
        if self.chat_repository:
            if not thread_id:
                thread = self.chat_repository.get_or_create_thread(
                    owner_id=current_user.id,
                    notebook_id=request.notebook_id,
                    title=request.message[:40],
                )
                thread_id = thread.id
            self.chat_repository.add_message(
                thread_id=thread_id,
                role="user",
                content=request.message,
            )

        full_prompt, citations = self._prepare_rag_context(request, current_user)

        # 2. Emite evento de Citações / Fontes encontradas
        citations_data = [c.model_dump(mode="json") for c in citations]
        yield f"event: citations\ndata: {json.dumps(citations_data, ensure_ascii=False)}\n\n"

        # 3. Emite tokens progressivos da resposta da IA
        accumulated_text = []
        try:
            for token in self.ai_service.generate_response_stream(
                prompt=full_prompt,
                system_instruction=SYSTEM_PROMPT,
            ):
                accumulated_text.append(token)
                delta_payload = json.dumps({"text": token}, ensure_ascii=False)
                yield f"event: delta\ndata: {delta_payload}\n\n"
        except Exception as e:
            logger.error(f"[DocumentAgent] Erro durante streaming: {e}", exc_info=True)
            err_payload = json.dumps({"error": str(e)}, ensure_ascii=False)
            yield f"event: error\ndata: {err_payload}\n\n"
            return

        final_answer = "".join(accumulated_text)

        # 4. Persiste a resposta final no banco de dados
        message_id_str = ""
        if self.chat_repository and thread_id:
            assistant_msg = self.chat_repository.add_message(
                thread_id=thread_id,
                role="assistant",
                content=final_answer,
                citations=citations_data,
                model_used=self.ai_service.model_name,
            )
            message_id_str = str(assistant_msg.id)

        # 5. Emite evento de conclusão
        done_payload = json.dumps(
            {
                "thread_id": str(thread_id) if thread_id else None,
                "message_id": message_id_str,
                "model": self.ai_service.model_name,
            },
            ensure_ascii=False,
        )
        yield f"event: done\ndata: {done_payload}\n\n"
