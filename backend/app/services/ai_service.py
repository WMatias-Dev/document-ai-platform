import logging
from typing import Optional
from google import genai
from app.core.config import settings

logger = logging.getLogger(__name__)


class AIService:
    """
    Serviço responsável pela integração com modelos de linguagem (Google Gemini).
    """

    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None):
        self.api_key = api_key or settings.GOOGLE_API_KEY
        self.model_name = model or settings.GEMINI_MODEL

        if not self.api_key:
            logger.warning(
                "GOOGLE_API_KEY não configurada. Funcionalidades do Gemini ficarão desabilitadas."
            )
            self.client = None
        else:
            self.client = genai.Client(api_key=self.api_key)

    def generate_response(
        self, prompt: str, system_instruction: Optional[str] = None
    ) -> str:
        """
        Gera uma resposta utilizando o modelo Gemini configurado.
        """
        if not self.client:
            raise ValueError(
                "Cliente Gemini não inicializado. Verifique se GOOGLE_API_KEY está configurada no .env."
            )

        try:
            config = {}
            if system_instruction:
                config["system_instruction"] = system_instruction

            response = self.client.models.generate_content(
                model=self.model_name,
                contents=prompt,
                config=config if config else None,
            )
            return response.text or ""
        except Exception as e:
            logger.error(f"Erro ao chamar API do Gemini: {e}", exc_info=True)
            raise RuntimeError(f"Falha na comunicação com o Gemini: {str(e)}")
