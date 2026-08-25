from app.core.security import hash_password
from app.database.models.user import User


def create_test_user(db_session, email="teste@auth.com", password="senha_segura"):
    """Função auxiliar para criar um usuário no banco de testes."""
    user = User(
        name="Usuário Teste",
        email=email,
        password_hash=hash_password(password)
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def test_login_success(db_session, client):
    """Testa o login com credenciais corretas e espera um token JWT (HTTP 200)"""
    create_test_user(db_session)
    
    response = client.post(
        "/auth/login",
        data={"username": "teste@auth.com", "password": "senha_segura"}
    )
    
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


def test_login_wrong_password(db_session, client):
    """Testa o login com senha incorreta (HTTP 401)"""
    create_test_user(db_session)
    
    response = client.post(
        "/auth/login",
        data={"username": "teste@auth.com", "password": "senha_errada"}
    )
    
    assert response.status_code == 401
    assert response.json()["detail"] == "E-mail ou senha incorretos"


def test_login_nonexistent_user(client):
    """Testa o login com um usuário que não existe (HTTP 401)"""
    response = client.post(
        "/auth/login",
        data={"username": "fantasma@auth.com", "password": "senha_segura"}
    )
    
    assert response.status_code == 401


def test_get_user_me_success(db_session, client):
    create_test_user(db_session)
    
    login_response = client.post(
        "/auth/login",
        data={"username": "teste@auth.com", "password": "senha_segura"}
    )
    token = login_response.json()["access_token"]
    
    response = client.get(
        "/auth/me",
        headers={"Authorization": f"Bearer {token}"}
    )
    
    assert response.status_code == 200
    assert response.json()["email"] == "teste@auth.com"


def test_get_user_me_without_token(client):
    """Testa a rota protegida sem enviar o token (HTTP 401)"""
    response = client.get("/auth/me")
    assert response.status_code == 401