import uuid
from unittest.mock import MagicMock
import pytest
from fastapi import HTTPException

from app.database.models.document import Document
from app.database.models.document_chunk import DocumentChunk
from app.database.models.user import User
from app.schemas.document_schema import DocumentSearchRequest
from app.services.document_service import DocumentService
from app.services.embedding_service import EmbeddingService


def test_embedding_service_empty_query_raises_error():
    mock_repo = MagicMock()
    service = EmbeddingService(mock_repo)

    with pytest.raises(ValueError, match="Texto de consulta não pode ser vazio"):
        service.generate_query_embedding("")

    with pytest.raises(ValueError, match="Texto de consulta não pode ser vazio"):
        service.generate_query_embedding("   ")


def test_search_documents_success_flow():
    mock_repo = MagicMock()
    mock_storage = MagicMock()
    mock_parser = MagicMock()
    mock_chunker = MagicMock()
    mock_embedder = MagicMock()

    user_id = uuid.uuid4()
    doc_id = uuid.uuid4()
    chunk_id = uuid.uuid4()

    current_user = User(id=user_id, name="Usuário", email="user@test.com", password_hash="hash")

    fake_doc = Document(id=doc_id, title="Contrato de Prestação de Serviços.pdf", owner_id=user_id)
    fake_chunk = DocumentChunk(
        id=chunk_id,
        document_id=doc_id,
        chunk_index=0,
        text_content="O prazo de vigência deste contrato é de 12 meses.",
        document=fake_doc,
    )

    mock_embedder.generate_query_embedding.return_value = [0.1] * 768
    mock_repo.hybrid_search_rrf.return_value = [(fake_chunk, 0.016393)]

    service = DocumentService(
        repository=mock_repo,
        storage=mock_storage,
        parser=mock_parser,
        chunker=mock_chunker,
        embedder=mock_embedder,
    )

    search_request = DocumentSearchRequest(query="Qual o prazo de vigência?", limit=3)
    response = service.search_documents(search_in=search_request, current_user=current_user)

    assert response.query == "Qual o prazo de vigência?"
    assert response.total_results == 1
    assert len(response.results) == 1

    result_item = response.results[0]
    assert result_item.chunk_id == chunk_id
    assert result_item.document_id == doc_id
    assert result_item.document_title == "Contrato de Prestação de Serviços.pdf"
    assert result_item.similarity_score > 0.9  # FlashRank atribuiu alta confiança (~0.99)
    assert "12 meses" in result_item.text_content

    mock_embedder.generate_query_embedding.assert_called_once_with("Qual o prazo de vigência?")
    mock_repo.hybrid_search_rrf.assert_called_once_with(
        query_text="Qual o prazo de vigência?",
        query_embedding=[0.1] * 768,
        user_id=user_id,
        notebook_id=None,
        document_id=None,
        source_ids=None,
        limit=15,
    )


def test_search_documents_forbidden_on_other_user_document():
    mock_repo = MagicMock()
    mock_storage = MagicMock()
    mock_parser = MagicMock()
    mock_chunker = MagicMock()
    mock_embedder = MagicMock()

    user_a_id = uuid.uuid4()
    user_b_id = uuid.uuid4()
    doc_id = uuid.uuid4()

    current_user_a = User(id=user_a_id, name="User A", email="a@test.com", password_hash="hash")
    doc_of_user_b = Document(id=doc_id, title="Doc do B.pdf", owner_id=user_b_id)

    mock_repo.get_by_id.return_value = doc_of_user_b

    service = DocumentService(
        repository=mock_repo,
        storage=mock_storage,
        parser=mock_parser,
        chunker=mock_chunker,
        embedder=mock_embedder,
    )

    search_request = DocumentSearchRequest(
        query="pergunta",
        document_id=doc_id,
    )

    with pytest.raises(HTTPException) as exc_info:
        service.search_documents(search_in=search_request, current_user=current_user_a)

    assert exc_info.value.status_code == 403
    assert "Você não tem permissão" in exc_info.value.detail
    mock_embedder.generate_query_embedding.assert_not_called()
