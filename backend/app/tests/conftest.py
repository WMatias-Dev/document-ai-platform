import os
from dotenv import load_dotenv

# 1. Força o carregamento do arquivo de testes, substituindo qualquer variável existente
load_dotenv(".env.test", override=True)

# 2. AGORA você pode fazer os imports da sua aplicação
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient

from app.main import app
from app.core.config import settings

# Pode manter seus prints para validar! Agora eles devem mostrar localhost e 5433
print("=" * 60)
print("HOST:", settings.POSTGRES_HOST)
print("PORT:", settings.POSTGRES_PORT)
print("DB:", settings.POSTGRES_DB)
print("=" * 60)

from app.database.base import Base
from app.database.models.user import User  # noqa: F401

# Banco de testes
DATABASE_TEST_URL = (
    f"postgresql://{settings.POSTGRES_USER}:"
    f"{settings.POSTGRES_PASSWORD}@"
    f"{settings.POSTGRES_HOST}:"
    f"{settings.POSTGRES_PORT}/"
    f"{settings.POSTGRES_DB}"
)

engine_test = create_engine(DATABASE_TEST_URL)

TestingSessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine_test,
)


@pytest.fixture(scope="function")
def db_session():
    """Cria uma sessão limpa para cada teste."""

    Base.metadata.create_all(bind=engine_test)

    session = TestingSessionLocal()

    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine_test)


@pytest.fixture(scope="function")
def client():
    """Cliente HTTP para testar a API."""

    with TestClient(app) as client:
        yield client