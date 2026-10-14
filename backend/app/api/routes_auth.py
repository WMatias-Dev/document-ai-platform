from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.database.dependencies import get_db, get_current_user
from app.core.security import verify_password, create_access_token
from app.repositories.user_repository import UserRepository
from app.schemas.user_schema import UserResponse
from app.database.models.user import User

router = APIRouter(
    prefix="/auth",
    tags=["Autenticação"]
)

@router.post("/login")
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    """Autentica o usuário por e-mail e senha e devolve o token JWT de acesso."""
    user_repo = UserRepository(db)
    # O padrão OAuth2 usa o campo 'username', mas aqui mapeamos para o e-mail do usuário
    user = user_repo.get_by_email(form_data.username)

    # Mensagem genérica para não revelar se o e-mail existe ou se apenas a senha estava errada
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="E-mail ou senha incorretos",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # O subject ('sub') do token guarda o e-mail que identifica o usuário nas próximas requisições
    access_token = create_access_token(data={"sub": user.email})
    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/me", response_model=UserResponse)
def get_user_me(current_user: User = Depends(get_current_user)):
    """Retorna os dados do perfil do usuário autenticado no token Bearer da requisição."""
    # A dependência get_current_user valida a assinatura do JWT e rejeita requisições expiradas
    return current_user