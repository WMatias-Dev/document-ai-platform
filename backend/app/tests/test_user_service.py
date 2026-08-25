from unittest.mock import MagicMock
import pytest

from app.schemas.user_schema import UserCreate
from app.services.user_service import UserService


def test_create_user_duplicate_email():
    mock_repository = MagicMock()
    mock_repository.get_by_email.return_value = MagicMock()
    service = UserService(mock_repository)

    user_data = UserCreate(
        name="João",
        email="joao@test.com",
        password="123456",
    )

    with pytest.raises(ValueError) as exc_info:
        service.create_user(user_data)

    assert "email já cadastrado" in str(exc_info.value)
    mock_repository.create.assert_not_called()


def test_create_user_success():
    mock_repository = MagicMock()
    mock_repository.get_by_email.return_value = None
    mock_repository.create.return_value = MagicMock(
        name="João", email="joao@test.com"
    )
    service = UserService(mock_repository)

    user_data = UserCreate(
        name="João",
        email="joao@test.com",
        password="123456",
    )

    result = service.create_user(user_data)

    mock_repository.get_by_email.assert_called_once_with("joao@test.com")
    mock_repository.create.assert_called_once()
    assert result is not None