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

import uuid

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


from app.database.dependencies import get_db


@pytest.fixture(scope="function")
def db_session():
    """Cria uma sessão limpa para cada teste e configura o override de get_db."""

    Base.metadata.create_all(bind=engine_test)

    session = TestingSessionLocal()

    def override_get_db():
        try:
            yield session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db

    try:
        yield session
    finally:
        session.close()
        app.dependency_overrides.clear()
        Base.metadata.drop_all(bind=engine_test)


@pytest.fixture(scope="function")
def client():
    """Cliente HTTP para testar a API."""

    with TestClient(app) as test_client:
        yield test_client

@pytest.fixture(scope="function")
def user_token_headers(client):
    """
    Cria um usuário de teste, faz o login e retorna o cabeçalho com o token JWT.
    """
    # 1. Dados do usuário de teste
    user_data = {
        "name": "Usuário Teste",
        "email": "teste@exemplo.com",
        "password": "senha_segura_123"
    }
    
    # 2. Cria o usuário no banco chamando a rota de registro
    client.post("/users/register", json=user_data)
    
    # 3. Faz o login (OAuth2 exige envio como formulário/data, não json)
    login_data = {
        "username": "teste@exemplo.com", 
        "password": "senha_segura_123"
    }
    response = client.post("/auth/login", data=login_data)
    
    # 4. Extrai o token da resposta e monta o cabeçalho
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="function")
def other_user_token_headers(client):
    """
    Cria um SEGUNDO usuário para testar o isolamento de dados (Erro 403).
    """
    user_data = {
        "name": "Outro Usuário Invasor",
        "email": "invasor@exemplo.com",
        "password": "senha_segura_123"
    }
    
    client.post("/users/register", json=user_data)
    
    login_data = {
        "username": "invasor@exemplo.com", 
        "password": "senha_segura_123"
    }
    response = client.post("/auth/login", data=login_data)
    
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}