import uuid
from unittest.mock import MagicMock
import pytest

from app.agents.document_agent import DocumentAgent
from app.database.models.user import User
from app.schemas.chat_schema import ChatMessage, ChatRequest
from app.schemas.document_schema import DocumentSearchResponse, SearchResultChunk


def test_document_agent_ask_with_citations():
    mock_doc_service = MagicMock()
    mock_ai_service = MagicMock()
    mock_ai_service.model_name = "gemini-3.7-flash"
    mock_ai_service.generate_response.return_value = (
        "De acordo com o Contrato, o prazo de vigência é de 12 meses."
    )

    user_id = uuid.uuid4()
    doc_id = uuid.uuid4()
    chunk_id = uuid.uuid4()

    current_user = User(id=user_id, name="William", email="william@test.com", password_hash="hash")

    fake_chunk = SearchResultChunk(
        chunk_id=chunk_id,
        document_id=doc_id,
        document_title="Contrato_Prestacao.pdf",
        chunk_index=0,
        text_content="A vigência deste instrumento contratual é de 12 (doze) meses a contar da data de assinatura.",
        similarity_score=0.92,
    )

    mock_doc_service.search_documents.return_value = DocumentSearchResponse(
        query="Qual o prazo do contrato?",
        total_results=1,
        results=[fake_chunk],
    )

    agent = DocumentAgent(
        document_service=mock_doc_service,
        ai_service=mock_ai_service,
    )

    request = ChatRequest(
        message="Qual o prazo do contrato?",
        max_chunks=3,
    )

    response = agent.ask(request=request, current_user=current_user)

    assert response.model == "gemini-3.7-flash"
    assert "12 meses" in response.answer
    assert len(response.citations) == 1
    assert response.citations[0].document_title == "Contrato_Prestacao.pdf"
    assert response.citations[0].similarity_score == 0.92

    mock_doc_service.search_documents.assert_called_once()
    mock_ai_service.generate_response.assert_called_once()


def test_document_agent_ask_without_citations():
    mock_doc_service = MagicMock()
    mock_ai_service = MagicMock()
    mock_ai_service.model_name = "gemini-3.7-flash"
    mock_ai_service.generate_response.return_value = (
        "Não encontrei informações suficientes nos seus documentos para responder a essa pergunta."
    )

    user_id = uuid.uuid4()
    current_user = User(id=user_id, name="William", email="william@test.com", password_hash="hash")

    mock_doc_service.search_documents.return_value = DocumentSearchResponse(
        query="Qual a receita de bolo de chocolate?",
        total_results=0,
        results=[],
    )

    agent = DocumentAgent(
        document_service=mock_doc_service,
        ai_service=mock_ai_service,
    )

    request = ChatRequest(
        message="Qual a receita de bolo de chocolate?",
    )

    response = agent.ask(request=request, current_user=current_user)

    assert len(response.citations) == 0
    assert "Não encontrei informações" in response.answer


def test_document_agent_with_history():
    mock_doc_service = MagicMock()
    mock_ai_service = MagicMock()
    mock_ai_service.model_name = "gemini-3.7-flash"
    mock_ai_service.generate_response.return_value = "O valor total é R$ 50.000,00."

    user_id = uuid.uuid4()
    current_user = User(id=user_id, name="William", email="william@test.com", password_hash="hash")

    mock_doc_service.search_documents.return_value = DocumentSearchResponse(
        query="E qual o valor total?",
        total_results=0,
        results=[],
    )

    agent = DocumentAgent(
        document_service=mock_doc_service,
        ai_service=mock_ai_service,
    )

    history = [
        ChatMessage(role="user", content="Olá, gostaria de analisar minha proposta."),
        ChatMessage(role="assistant", content="Claro! Envie suas dúvidas sobre a proposta."),
    ]

    request = ChatRequest(
        message="E qual o valor total?",
        history=history,
    )

    response = agent.ask(request=request, current_user=current_user)

    assert response.answer == "O valor total é R$ 50.000,00."
    prompt_sent = mock_ai_service.generate_response.call_args[1]["prompt"]
    assert "Histórico da Conversa:" in prompt_sent
    assert "Olá, gostaria de analisar minha proposta." in prompt_sent
