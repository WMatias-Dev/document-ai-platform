from fastapi import FastAPI

from app.database.base import Base
from app.database.connection import engine

from app.api.routes_users import router as user_router

from app.database import models

print("Criando tabelas...")
Base.metadata.create_all(bind=engine)
print("Tabelas criadas!")

app = FastAPI(
    title="Plataforma IA para Documentos",
    description="Sistema Inteligente de gestão documental com IA Generativa",
    version="1.0.0"
)

app.include_router(
    user_router
)


@app.get("/")
def root():
    return{
        "message": "API da Plataforma IA para Documentos está funcionando!"
    }