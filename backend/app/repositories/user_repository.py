from sqlalchemy.orm import Session

from app.database.models.user import User

class UserRepository:
    """Repositório de acesso a dados para a entidade de usuários.

    Centraliza as operações de leitura e persistência na tabela User,
    isolando as consultas SQLAlchemy da lógica de negócio e serviços.
    """

    def __init__(self, db: Session):
        self.db = db

    def get_by_email(self, email: str) -> User | None:
        """Busca um usuário cadastrado a partir de seu endereço de e-mail."""
        # Utilizado no fluxo de login e na validação prévia de e-mail duplicado
        return (
            self.db.query(User)
            .filter(User.email == email)
            .first()
        )

    def create(
        self,
        *,
        name: str,
        email: str,
        password_hash: str,
    ) -> User:
        """Persiste um novo usuário no banco de dados a partir dos dados fornecidos."""
        # O uso de argumentos nomeados obrigatórios (*) evita inversão acidental de campos sensíveis
        user = User(
            name=name,
            email=email,
            password_hash=password_hash,
        )

        self.db.add(user)
        self.db.commit()
        # Hidrata a instância com valores gerados pelo banco (ex: id UUID e timestamps)
        self.db.refresh(user)

        return user