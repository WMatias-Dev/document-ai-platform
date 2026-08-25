import logging
import time
from typing import Optional, List
from google import genai
from app.core.config import settings

logger = logging.getLogger(__name__)

# Modelos oficiais para fallback em caso de alta demanda temporária (503)
FALLBACK_MODELS = [
    "gemini-3.7-flash",
    "gemini-3.6-flash",
    "gemini-3.5-flash",
    "gemini-flash-latest",
]


class AIService:
    """
    Serviço responsável pela integração com modelos de linguagem (Google Gemini).
    Possui tolerância a falhas e fallback automático em picos de demanda.
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
        Gera uma resposta utilizando o modelo Gemini configurado, com fallback automático
        caso o modelo principal apresente sobrecarga temporária (503 UNAVAILABLE).
        """
        if not self.client:
            raise ValueError(
                "Cliente Gemini não inicializado. Verifique se GOOGLE_API_KEY está configurada no .env."
            )

        config = {}
        if system_instruction:
            config["system_instruction"] = system_instruction

        # Lista ordenada de tentativas: Modelo principal seguido de fallbacks
        models_to_try = [self.model_name] + [
            m for m in FALLBACK_MODELS if m != self.model_name
        ]

        last_error = None
        for candidate_model in models_to_try:
            try:
                logger.info(f"Gerando resposta com o modelo Gemini: {candidate_model}")
                response = self.client.models.generate_content(
                    model=candidate_model,
                    contents=prompt,
                    config=config if config else None,
                )
                self.model_name = candidate_model
                return response.text or ""
            except Exception as e:
                last_error = e
                err_str = str(e)
                logger.warning(
                    f"Tentativa com {candidate_model} falhou: {err_str}. Tentando próximo modelo..."
                )
                time.sleep(0.5)

        logger.error(f"Todos os modelos Gemini falharam: {last_error}", exc_info=True)
        raise RuntimeError(f"Falha na comunicação com o Gemini: {str(last_error)}")
