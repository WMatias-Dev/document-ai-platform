import pytest
from app.repositories.user_repository import UserRepository
from app.schemas.user_schema import UserCreate
from app.services.user_service import UserService


def test_create_user_duplicate_email(db_session):
    repository = UserRepository(db_session)
    service = UserService(repository)

    user_data = UserCreate(
        name="João",
        email="joao@test.com",
        password="123456",
    )

    # 1. Cria o primeiro usuário
    service.create_user(user_data)

    # 2. Captura a exceção correta (ValueError)
    with pytest.raises(ValueError) as exc_info:
        service.create_user(user_data)

    # 3. Valida a mensagem exata retornada pela Service
    assert "email já cadastrado" in str(exc_info.value)