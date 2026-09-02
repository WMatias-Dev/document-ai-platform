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
from app.api.routes_notebooks import router as notebooks_router
from app.api.routes_evaluation import router as evaluation_router
from app.database.models.user import User
from app.database.models.document import Document
from app.database.models.document_chunk import DocumentChunk
from app.database.models.chat_thread import ChatThread
from app.database.models.chat_message import ChatMessage

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

from app.core.ingestion_queue import ingestion_queue

# Configuração do lifespan
@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Preparando banco de dados...")
    
    try:
        # 1. Ativa os motores de IA e busca textual no PostgreSQL automaticamente
        with engine.begin() as conn:
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS pg_trgm;"))
            
        print("Criando tabelas e aplicando migrações de schema...")
        # 2. Cria as tabelas e migra colunas faltantes
        Base.metadata.create_all(bind=engine)
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE IF EXISTS document_chunks ADD COLUMN IF NOT EXISTS page_number INTEGER DEFAULT 1;"))
            conn.execute(text("ALTER TABLE IF EXISTS document_chunks ADD COLUMN IF NOT EXISTS chunk_type TEXT DEFAULT 'text';"))
            conn.execute(text("ALTER TABLE IF EXISTS document_chunks ADD COLUMN IF NOT EXISTS bounding_box JSONB;"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_document_chunks_fts ON document_chunks USING gin (text_content gin_trgm_ops);"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_document_chunks_fts_tsvector ON document_chunks USING gin (to_tsvector('simple', text_content));"))
        print("Tabelas e migrações aplicadas com sucesso!")
    except Exception as db_err:
        logger.warning(f"[lifespan] Aviso ao conectar/migrar banco no startup: {db_err}")

    # 3. Inicia a fila de ingestão assíncrona local
    await ingestion_queue.start()

    yield

    # 4. Encerra a fila no shutdown
    await ingestion_queue.stop()


from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="Plataforma IA para Documentos",
    description="Sistema Inteligente de gestão documental com IA Generativa",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
        "http://localhost:3002",
        "http://127.0.0.1:3002",
        "http://192.168.1.4:3000",
        "http://192.168.1.4:3001",
    ],
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|0\.0\.0\.0)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(user_router)
app.include_router(auth_router)
app.include_router(documents_router)
app.include_router(chat_router)
app.include_router(notebooks_router)
app.include_router(evaluation_router)

@app.get("/")
def root():
    return {
        "message": "API da Plataforma IA para Documentos está funcionando!"
    }