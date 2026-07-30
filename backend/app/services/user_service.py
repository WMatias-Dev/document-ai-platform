from app.core.security import hash_password
from app.repositories.user_repository import UserRepository
from app.schemas.user_schema import UserCreate


class UserService:
    def __init__(
        self,
        repository: UserRepository,
    ):
        self.repository = repository

    # Agora o método está indentado dentro da classe UserService
    def create_user(
        self,
        user_data: UserCreate,
    ):
        existing_user = self.repository.get_by_email(user_data.email)

        if existing_user:
            raise ValueError("email já cadastrado")

        password_hash = hash_password(user_data.password)

        return self.repository.create(
            name=user_data.name,
            email=user_data.email,
            password_hash=password_hash,
        )