from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.database.base import Base
from app.database.connection import engine
from app.database import models  # noqa: F401
from app.api.routes_users import router as user_router


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

app.include_router(user_router)


@app.get("/")
def root():
    return {
        "message": "API da Plataforma IA para Documentos está funcionando!"
    }