from pwdlib import PasswordHash
from datetime import datetime, timedelta, timezone
import jwt
from app.core.config import settings

# Uso o algoritmo recomendado pelo pwdlib (Argon2id ou bcrypt) com salt automático contra rainbow tables
password_hash = PasswordHash.recommended()


def hash_password(password: str) -> str:
    """Gera o hash da senha em texto plano com salt embutido."""
    return password_hash.hash(password)


def verify_password(
    plain_password: str,
    hashed_password: str
) -> bool:
    """Compara a senha informada com o hash gravado usando verificação em tempo constante."""
    return password_hash.verify(
        plain_password,
        hashed_password
    )


def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    """Gera um token JWT assinado com expiração em UTC para autenticação na API."""
    # Faço cópia rasa para não alterar o dicionário original recebido por parâmetro
    to_encode = data.copy()

    # Sempre uso UTC para evitar divergências de fuso horário entre servidor e cliente
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode.update({"exp": expire})

    # Assino o payload com a chave secreta e algoritmo definidos nas configurações
    encoded_jwt = jwt.encode(
        to_encode,
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM
    )

    return encoded_jwt