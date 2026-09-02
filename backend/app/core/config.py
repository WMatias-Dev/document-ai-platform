from pathlib import Path
import os

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parents[3]

ENV_FILE = os.getenv("ENV_FILE", ".env")


class Settings(BaseSettings):
    POSTGRES_USER: str
    POSTGRES_PASSWORD: str
    POSTGRES_DB: str
    POSTGRES_HOST: str
    POSTGRES_PORT: int
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int

    # Configuração de Provedor de Embeddings ("ollama" ou "gemini")
    EMBEDDING_PROVIDER: str = "ollama"

    # Configurações do Ollama (Embeddings e LLM)
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_EMBED_MODEL: str = "nomic-embed-text"
    OLLAMA_LLM_MODEL: str = "qwen2.5:7b"

    # Configurações do Google Gemini API
    GOOGLE_API_KEY: str | None = None
    GEMINI_MODEL: str = "gemini-3.7-flash"

    model_config = SettingsConfigDict(
        env_file=BASE_DIR / ENV_FILE,
        extra="ignore",
    )


settings = Settings()