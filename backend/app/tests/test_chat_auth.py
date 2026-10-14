import uuid
from unittest.mock import MagicMock, patch
import pytest
from fastapi import status
from sqlalchemy.orm import Session

from app.database.models.chat_message import ChatMessage
from app.database.models.chat_thread import ChatThread
from app.database.models.user import User
from app.repositories.chat_repository import ChatRepository
from app.schemas.document_schema import DocumentSearchResponse


@pytest.fixture
def mock_ai_and_search():
    """Mocka AIService e DocumentService para evitar chamadas externas de LLM e embeddings."""
    with patch("app.services.ai_service.AIService.generate_response") as mock_gen, \
         patch("app.services.ai_service.AIService.generate_response_stream") as mock_stream, \
         patch("app.services.document_service.DocumentService.search_documents") as mock_search:
        
        mock_gen.return_value = "Resposta de teste autorizada da IA."
        mock_stream.return_value = iter(["Resposta ", "streaming ", "autorizada."])
        mock_search.return_value = DocumentSearchResponse(
            query="teste",
            total_results=0,
            results=[],
        )
        yield {
            "generate_response": mock_gen,
            "generate_response_stream": mock_stream,
            "search_documents": mock_search,
        }


def test_chat_authorization_owner_and_idor_prevention(
    client, db_session: Session, user_token_headers, other_user_token_headers, mock_ai_and_search
):
    """
    Testes de integração para os endpoints /chat/ e /chat/stream:
    1. Proprietário consegue continuar a própria conversa.
    2. Outro usuário não consegue escrever na thread alheia (retorna 404).
    3. A tentativa negada não insere mensagens nem altera o histórico da vítima.
    4. O endpoint de streaming aplica a mesma autorização antes de iniciar a geração.
    5. Uma thread inexistente também é tratada com 404.
    6. Mocks garantem ausência de dependência de LLMs externas.
    """
    # 1. Obter o Usuário A (proprietário legítimo) do banco de teste
    owner_user = db_session.query(User).filter(User.email == "teste@exemplo.com").first()
    attacker_user = db_session.query(User).filter(User.email == "invasor@exemplo.com").first()
    assert owner_user is not None
    assert attacker_user is not None
    assert owner_user.id != attacker_user.id

    # 2. Criar thread legítima do Usuário A
    chat_repo = ChatRepository(db_session)
    victim_thread = chat_repo.get_or_create_thread(
        owner_id=owner_user.id,
        title="Thread Privada da Vítima",
    )
    initial_user_msg = chat_repo.add_message(
        thread_id=victim_thread.id,
        role="user",
        content="Mensagem original da vítima",
    )
    initial_assistant_msg = chat_repo.add_message(
        thread_id=victim_thread.id,
        role="assistant",
        content="Resposta inicial confidencial",
    )

    initial_messages = chat_repo.get_thread_messages(victim_thread.id, owner_user.id)
    assert len(initial_messages) == 2

    # --- CENÁRIO 1: O proprietário consegue continuar a própria conversa (síncrono) ---
    owner_payload = {
        "message": "Segunda pergunta do proprietário",
        "thread_id": str(victim_thread.id),
    }
    owner_resp = client.post("/chat/", json=owner_payload, headers=user_token_headers)
    assert owner_resp.status_code == status.HTTP_200_OK
    data = owner_resp.json()
    assert data["thread_id"] == str(victim_thread.id)
    assert data["answer"] == "Resposta de teste autorizada da IA."

    # Verifica persistência das novas mensagens da conversa do proprietário
    messages_after_owner = chat_repo.get_thread_messages(victim_thread.id, owner_user.id)
    assert len(messages_after_owner) == 4
    assert messages_after_owner[2].content == "Segunda pergunta do proprietário"

    # --- CENÁRIO 2: Outro usuário não consegue escrever na thread alheia (síncrono) ---
    attacker_payload = {
        "message": "Tentativa de injeção de IDOR maliciosa",
        "thread_id": str(victim_thread.id),
    }
    attacker_resp = client.post("/chat/", json=attacker_payload, headers=other_user_token_headers)
    assert attacker_resp.status_code == status.HTTP_404_NOT_FOUND
    assert "Conversa não encontrada" in attacker_resp.json()["detail"]

    # --- CENÁRIO 3: A tentativa negada não insere mensagens nem altera o histórico da vítima ---
    messages_after_attack = chat_repo.get_thread_messages(victim_thread.id, owner_user.id)
    assert len(messages_after_attack) == 4
    all_contents = [m.content for m in messages_after_attack]
    assert "Tentativa de injeção de IDOR maliciosa" not in all_contents

    # Confirmação direta no banco consultando a tabela ChatMessage
    direct_db_messages = (
        db_session.query(ChatMessage)
        .filter(ChatMessage.thread_id == victim_thread.id)
        .all()
    )
    assert len(direct_db_messages) == 4

    # --- CENÁRIO 4: Streaming SSE aplica a mesma autorização antes de iniciar a geração ---
    attacker_stream_payload = {
        "message": "Tentativa de IDOR via streaming SSE",
        "thread_id": str(victim_thread.id),
    }
    attacker_stream_resp = client.post(
        "/chat/stream", json=attacker_stream_payload, headers=other_user_token_headers
    )
    assert attacker_stream_resp.status_code == status.HTTP_404_NOT_FOUND
    assert "Conversa não encontrada" in attacker_stream_resp.json()["detail"]

    # Histórico da vítima continua rigorosamente inalterado
    direct_db_messages_stream = (
        db_session.query(ChatMessage)
        .filter(ChatMessage.thread_id == victim_thread.id)
        .all()
    )
    assert len(direct_db_messages_stream) == 4

    # Proprietário consegue usar o streaming em sua própria thread normalmente
    owner_stream_payload = {
        "message": "Pergunta streaming autorizada",
        "thread_id": str(victim_thread.id),
    }
    owner_stream_resp = client.post(
        "/chat/stream", json=owner_stream_payload, headers=user_token_headers
    )
    assert owner_stream_resp.status_code == status.HTTP_200_OK
    assert "text/event-stream" in owner_stream_resp.headers["content-type"]
    assert "event: done" in owner_stream_resp.text

    # --- CENÁRIO 5: Thread inexistente também é tratada corretamente com 404 ---
    nonexistent_id = str(uuid.uuid4())
    nonexistent_payload = {
        "message": "Pergunta em thread fantasma",
        "thread_id": nonexistent_id,
    }
    # Teste no endpoint síncrono
    ghost_sync_resp = client.post("/chat/", json=nonexistent_payload, headers=user_token_headers)
    assert ghost_sync_resp.status_code == status.HTTP_404_NOT_FOUND
    assert "Conversa não encontrada" in ghost_sync_resp.json()["detail"]

    # Teste no endpoint de streaming
    ghost_stream_resp = client.post("/chat/stream", json=nonexistent_payload, headers=user_token_headers)
    assert ghost_stream_resp.status_code == status.HTTP_404_NOT_FOUND
    assert "Conversa não encontrada" in ghost_stream_resp.json()["detail"]
