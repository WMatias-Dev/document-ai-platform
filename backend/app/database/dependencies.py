from app.database.connection import SessionLocal
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
import jwt

from app.core.config import settings
from app.repositories.user_repository import UserRepository
from app.database.models.user import User

def get_db():
    db = SessionLocal()

    try:
        yield db

    finally:
        db.close()

oauth_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

def get_current_user(
    token: str = Depends(oauth_scheme),
    db: Session = Depends(get_db)
) -> User:
    """
    Decodifica o token, valida e retorna o login
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Não foi possível validar as credenciais",
        headers={"WWW-Authenticate": "Bearer"}
    )

    try:
        #tenta decodificar o token usando a chave secreta
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM]
        )
        email: str | None = payload.get("sub")
        if email is None:
            raise credentials_exception

    except jwt.PyJWTError:
        #garantindo q token expirado não passa
        raise credentials_exception

    #verifica se o usuario ainda existe no banco
    user_repo = UserRepository(db)
    user = user_repo.get_by_email(email)

    if user is None:
        raise credentials_exception

    return user