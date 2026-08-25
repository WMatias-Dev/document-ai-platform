from unittest.mock import MagicMock, patch
import pytest

from app.services.ai_service import AIService


def test_ai_service_raises_without_api_key():
    service = AIService(api_key=None)
    service.client = None

    with pytest.raises(ValueError, match="Cliente Gemini não inicializado"):
        service.generate_response("Olá Gemini")


def test_ai_service_generates_response_with_mock():
    with patch("app.services.ai_service.genai.Client") as mock_client_class:
        mock_client_instance = MagicMock()
        mock_response = MagicMock()
        mock_response.text = "Resposta simulada do Gemini"
        mock_client_instance.models.generate_content.return_value = mock_response
        mock_client_class.return_value = mock_client_instance

        service = AIService(api_key="fake-key", model="gemini-3.7-flash")
        result = service.generate_response(
            prompt="Qual o resumo do documento?",
            system_instruction="Você é um assistente útil.",
        )

        assert result == "Resposta simulada do Gemini"
        mock_client_instance.models.generate_content.assert_called_once()
