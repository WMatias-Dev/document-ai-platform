import os

from dotenv import load_dotenv

load_dotenv(".env.test", override=True)

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.database.base import Base
# Importar o modelo garante que a subclasse Base conheça as tabelas
from app.database.models.user import User  # noqa: F401

# 2. String de conexão
DATABASE_TEST_URL = (
    f"postgresql://{settings.POSTGRES_USER}:"
    f"{settings.POSTGRES_PASSWORD}@"
    f"{settings.POSTGRES_HOST}:"
    f"{settings.POSTGRES_PORT}/"
    f"{settings.POSTGRES_DB}"
)

print(f"DEBUG: DATABASE_TEST_URL = {DATABASE_TEST_URL}") # Para depuração

# 3. Criação do Engine de Teste que estava faltando
engine_test = create_engine(DATABASE_TEST_URL)

TestingSessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine_test,
)


@pytest.fixture(scope="function")
def db_session():
    # Cria todas as tabelas no banco de testes
    Base.metadata.create_all(bind=engine_test)

    session = TestingSessionLocal()

    try:
        yield session
    finally:
        session.close()
        # Dropa as tabelas ao término do teste para isolar a suíte
        Base.metadata.drop_all(bind=engine_test)