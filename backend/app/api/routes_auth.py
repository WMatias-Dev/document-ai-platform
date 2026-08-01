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
    """
    Autenticação de usuario q ira gerar um token JWT
    O OAuth2PasswordRequestForm aqui atua como uma padronização de login
    o campo username enviado pelo cliente será o email do usuario
    """
    user_repo = UserRepository(db)
    user = user_repo.get_by_email(form_data.username)

    #confere se o usuario existe e a senha confere com o hash salvos no banco
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="E-mail ou senha incorretos",
            headers={"WWW-Authenticate": "Bearer"},
        )

    #o token é gerado incluido o email no payload
    access_token = create_access_token(data={"sub": user.email})

    #retorna o formato exigido pelo fastAPI
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/me", response_model=UserResponse)
def get_user_me(current_user: User = Depends(get_current_user)):
    """
    Retorna os dados do usuario logado
    ao depender de 'get_current_user' o fasAPI consegue bloquear qualquer acesso invalido
    """
    return current_user