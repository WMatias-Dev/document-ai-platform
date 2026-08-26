from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
import jwt

from app.core.config import settings
from app.database.connection import SessionLocal
from app.database.models.user import User
from app.repositories.user_repository import UserRepository
from app.repositories.document_repository import DocumentRepository
from app.repositories.notebook_repository import NotebookRepository
from app.services.storage_service import StorageService
from app.services.parsing_service import ParsingService
from app.services.chunking_service import ChunkingService
from app.services.embedding_service import EmbeddingService
from app.services.document_service import DocumentService
from app.services.notebook_service import NotebookService


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
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Não foi possível validar as credenciais.",
        headers={"WWW-Authenticate": "Bearer"}
    )

    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM]
        )
        email: str | None = payload.get("sub")
        if email is None:
            raise credentials_exception

    except jwt.PyJWTError:
        raise credentials_exception

    user_repo = UserRepository(db)
    user = user_repo.get_by_email(email)

    if user is None:
        raise credentials_exception

    return user


def get_document_service(db: Session = Depends(get_db)) -> DocumentService:
    repository = DocumentRepository(db)
    storage = StorageService()
    parser = ParsingService()
    chunker = ChunkingService()
    embedder = EmbeddingService(repository=repository)

    return DocumentService(
        repository=repository,
        storage=storage,
        parser=parser,
        chunker=chunker,
        embedder=embedder,
        session_factory=SessionLocal,
    )


def get_notebook_service(db: Session = Depends(get_db)) -> NotebookService:
    return NotebookService(db=db)