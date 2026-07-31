from pwdlib import PasswordHash
from datetime import datetime, timedelta, timezone
import jwt
from app.core.config import settings

password_hash = PasswordHash.recommended()


def hash_password(password: str) -> str:
    return password_hash.hash(password)


def verify_password(
    plain_password: str,
    hashed_password: str
) -> bool:
    return password_hash.verify(
        plain_password,
        hashed_password
    )

def create_acess_token(data: dict, expires_delta: timedelta | None = None) -> str:
    """
    Gera um token JWT assinado
    """
    #copia os dados para nãoa alterar o original
    to_encode = data.copy()

    #Calcula a data de expiração em UTC
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    #Adicionando a expiração no payload
    to_encode.update({"exp": expire})

    #assinatura do token utilizando a chave e o algoritmo definido pelo .env
    encoded_jwt = jwt.encode(
        to_encode,
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM
    )

    return encoded_jwt