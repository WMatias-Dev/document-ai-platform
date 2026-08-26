import logging
import time
from typing import Generator, List, Optional
from google import genai
from app.core.config import settings

logger = logging.getLogger(__name__)

# Modelos com cotas independentes no Google AI Studio para resiliência contínua
FALLBACK_MODELS = [
    "gemini-3.5-flash-lite",
    "gemini-flash-lite-latest",
    "gemini-3.1-flash-lite",
    "gemini-3.7-flash",
    "gemini-3.6-flash",
    "gemini-3.5-flash",
    "gemini-flash-latest",
]


class AIService:
    """
    Serviço responsável pela integração com modelos de linguagem (Google Gemini).
    Possui pool multi-modelo resiliente para tolerância a falhas (503) e limites de cota (429).
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
        Gera uma resposta utilizando o pool de modelos Gemini, alternando automaticamente
        caso o modelo encontre sobrecarga (503) ou exaustão de cota (429).
        """
        if not self.client:
            raise ValueError(
                "Cliente Gemini não inicializado. Verifique se GOOGLE_API_KEY está configurada no .env."
            )

        config = {}
        if system_instruction:
            config["system_instruction"] = system_instruction

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
                    f"Tentativa com {candidate_model} falhou: {err_str[:120]}. Alternando para próximo modelo disponível..."
                )
                time.sleep(0.3)

        logger.error(f"Todos os modelos Gemini falharam: {last_error}", exc_info=True)
        raise RuntimeError(f"Falha na comunicação com o Gemini: {str(last_error)}")

    def generate_response_stream(
        self, prompt: str, system_instruction: Optional[str] = None
    ) -> Generator[str, None, None]:
        """
        Gera tokens progressivos em streaming utilizando o pool resiliente do Gemini.
        """
        if not self.client:
            raise ValueError(
                "Cliente Gemini não inicializado. Verifique se GOOGLE_API_KEY está configurada no .env."
            )

        config = {}
        if system_instruction:
            config["system_instruction"] = system_instruction

        models_to_try = [self.model_name] + [
            m for m in FALLBACK_MODELS if m != self.model_name
        ]

        last_error = None
        for candidate_model in models_to_try:
            try:
                logger.info(f"Streaming resposta com o modelo Gemini: {candidate_model}")
                response_stream = self.client.models.generate_content_stream(
                    model=candidate_model,
                    contents=prompt,
                    config=config if config else None,
                )
                self.model_name = candidate_model
                for chunk in response_stream:
                    if chunk.text:
                        yield chunk.text
                return
            except Exception as e:
                last_error = e
                err_str = str(e)
                logger.warning(
                    f"Streaming com {candidate_model} falhou: {err_str[:120]}. Alternando para próximo modelo disponível..."
                )
                time.sleep(0.3)

        logger.error(f"Todos os modelos Gemini falharam no streaming: {last_error}", exc_info=True)
        raise RuntimeError(f"Falha no streaming do Gemini: {str(last_error)}")
