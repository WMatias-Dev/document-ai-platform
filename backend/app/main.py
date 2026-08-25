import logging
import time

from contextlib import asynccontextmanager
from fastapi import FastAPI
from sqlalchemy import text

from app.database.base import Base
from app.database.connection import engine
from app.database import models
from app.api.routes_users import router as user_router
from app.api.routes_auth import router as auth_router
from app.api.routes_documents import router as documents_router
from app.api.routes_chat import router as chat_router
from app.database.models.user import User
from app.database.models.document import Document
from app.database.models.document_chunk import DocumentChunk

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# oconfiguração do lifespan
@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Preparando banco de dados...")
    
    # 1. Ativa o motor de IA no PostgreSQL automaticamente
    with engine.begin() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
        
    print("Criando tabelas...")
    # 2. Cria as tabelas
    Base.metadata.create_all(bind=engine)
    print("Tabelas criadas com sucesso!")

    yield


app = FastAPI(
    title="Plataforma IA para Documentos",
    description="Sistema Inteligente de gestão documental com IA Generativa",
    version="1.0.0",
    lifespan=lifespan,
)

# registro de rotas
app.include_router(user_router)
app.include_router(auth_router)
app.include_router(documents_router)
app.include_router(chat_router)

@app.get("/")
def root():
    return {
        "message": "API da Plataforma IA para Documentos está funcionando!"
    }