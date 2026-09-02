from unittest.mock import MagicMock, patch
import pytest
from app.services.embedding_service import EmbeddingService


def test_embedding_service_empty_query_raises_value_error():
    mock_repo = MagicMock()
    service = EmbeddingService(repository=mock_repo, provider="ollama")

    with pytest.raises(ValueError, match="Texto de consulta não pode ser vazio"):
        service.generate_query_embedding("")

    with pytest.raises(ValueError, match="Texto de consulta não pode ser vazio"):
        service.generate_query_embedding("   ")


def test_embedding_service_ollama_does_not_fallback_to_gemini():
    """Garante que falhas no Ollama levantam erro explícito e NÃO misturam vetores com Gemini."""
    mock_repo = MagicMock()
    service = EmbeddingService(repository=mock_repo, provider="ollama")

    # Simula falha no modelo do Ollama
    mock_model = MagicMock()
    mock_model.get_query_embedding.side_effect = ConnectionError("Ollama offline")
    service.embed_model = mock_model

    with pytest.raises(RuntimeError, match="Falha no provedor de embedding Ollama"):
        service.generate_query_embedding("Como funciona o contrato?")


def test_embedding_service_gemini_provider_uses_gemini_only():
    """Garante que o provedor Gemini gera vetores via SDK oficial sem invocar Ollama."""
    mock_repo = MagicMock()
    service = EmbeddingService(repository=mock_repo, provider="gemini")

    mock_client = MagicMock()
    mock_response = MagicMock()
    mock_response.embeddings = [MagicMock(values=[0.42] * 768)]
    mock_client.models.embed_content.return_value = mock_response
    service.gemini_client = mock_client

    vec = service.generate_query_embedding("Pergunta teste para Gemini")

    assert len(vec) == 768
    assert vec[0] == 0.42
    mock_client.models.embed_content.assert_called_once()
