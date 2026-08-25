
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.dependencies import get_db
from app.schemas.user_schema import UserCreate, UserResponse
from app.repositories.user_repository import UserRepository
from app.services.user_service import UserService

router = APIRouter(
    prefix="/users",
    tags=["Users"]
)

def get_user_service(db: Session = Depends(get_db)) -> UserService:
    repository = UserRepository(db)
    return UserService(repository)


@router.post(
    "/register",
    response_model=UserResponse
)
def register_user(
    user: UserCreate,
    service: UserService = Depends(get_user_service)
):
    try:
        return service.create_user(user)
    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error)
        )