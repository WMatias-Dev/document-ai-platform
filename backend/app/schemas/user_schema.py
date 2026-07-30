from pydantic import BaseModel, ConfigDict, EmailStr

#responsavel pelo cadastro
class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: int
    name: str
    email: EmailStr

    model_config = ConfigDict(
        from_attributes = True
    )