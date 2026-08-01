from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.database.base import Base
from app.database.connection import engine
from app.database import models
from app.api.routes_users import router as user_router
from app.api.routes_auth import router as auth_router

#oconfiguração do lifespan
@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Criando tabelas...")
    Base.metadata.create_all(bind=engine)
    print("Tabelas criadas!")

    yield


app = FastAPI(
    title="Plataforma IA para Documentos",
    description="Sistema Inteligente de gestão documental com IA Generativa",
    version="1.0.0",
    lifespan=lifespan,
)

#registro de rotas
app.include_router(user_router)
app.include_router(auth_router)

@app.get("/")
def root():
    return {
        "message": "API da Plataforma IA para Documentos está funcionando!"
    }