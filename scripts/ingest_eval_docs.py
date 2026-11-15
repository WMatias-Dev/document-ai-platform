"""
Script de ingestão dos documentos de avaliação (eval_docs).
Executa o pipeline real de ponta a ponta:
1. Parsing do PDF via PyMuPDF (extract_structured_pages)
2. Chunking semântico com preservação de tabelas e bounding boxes (ChunkingService)
3. Geração de embeddings e persistência vetorial (EmbeddingService)

Comando para reproduzir:
    python scripts/ingest_eval_docs.py
"""

import os
import sys
import uuid
from pathlib import Path

# Ajusta caminhos para execução a partir da raiz do repositório
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR / "backend"))

# Configura host/porta caso não estejam definidos
if not os.environ.get("POSTGRES_HOST"):
    os.environ["POSTGRES_HOST"] = "localhost"
if not os.environ.get("POSTGRES_PORT"):
    os.environ["POSTGRES_PORT"] = "5434"

from app.database.connection import SessionLocal
from app.database.models.document import Document, DocumentStatus
from app.database.models.document_chunk import DocumentChunk
from app.database.models.user import User
from app.repositories.document_repository import DocumentRepository
from app.services.chunking_service import ChunkingService
from app.services.embedding_service import EmbeddingService
from app.services.parsing_service import ParsingService


def ingest_eval_docs():
    db = SessionLocal()
    try:
        user_id = uuid.UUID("00000000-0000-0000-0000-000000000001")
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            user = User(
                id=user_id,
                email="admin@test.com",
                name="Admin User",
                password_hash="test_hash",
            )
            db.add(user)
            db.commit()
            print("Usuário de avaliação 'admin@test.com' criado.")
        else:
            print("Usuário de avaliação 'admin@test.com' localizado.")

        docs_to_ingest = [
            ("Contrato_Prestacao_Servicos_Cloud.pdf", "data/eval_docs/Contrato_Prestacao_Servicos_Cloud.pdf"),
            ("Anexo_SLA_Seguranca.pdf", "data/eval_docs/Anexo_SLA_Seguranca.pdf"),
        ]

        parser = ParsingService()
        chunker = ChunkingService()
        repo = DocumentRepository(db)
        embedder = EmbeddingService(repository=repo)

        for filename, rel_path in docs_to_ingest:
            abs_path = BASE_DIR / rel_path
            if not abs_path.exists():
                raise FileNotFoundError(f"Arquivo PDF de avaliação não encontrado: {abs_path}")

            print(f"\n--- Ingerindo {filename} pelo pipeline real ---")

            # Remove versões antigas do mesmo documento para o usuário
            existing_docs = (
                db.query(Document)
                .filter(Document.owner_id == user_id, Document.filename == filename)
                .all()
            )
            for d in existing_docs:
                db.delete(d)
            db.commit()

            # Cria registro do documento
            doc = Document(
                id=uuid.uuid4(),
                title=filename,
                filename=filename,
                file_path=str(abs_path),
                content_type="application/pdf",
                owner_id=user_id,
                status=DocumentStatus.PARSING,
            )
            db.add(doc)
            db.commit()
            db.refresh(doc)

            # 1. Parsing Real com PyMuPDF
            print(f"1. Extraindo elementos estruturados com PyMuPDF de: {abs_path}")
            parsed_elements = parser.extract_structured_pages(str(abs_path))
            extracted_text = "\n\n".join(elem["text"] for elem in parsed_elements)
            print(f"   Páginas/elementos extraídos: {len(parsed_elements)}")

            doc.content = extracted_text
            doc.status = DocumentStatus.CHUNKING
            db.commit()

            # 2. Chunking Real com ChunkingService (chunk_size=1000, overlap=200)
            print("2. Gerando chunks com ChunkingService...")
            chunks = chunker.chunk_structured_document(parsed_elements)
            print(f"   Total de chunks gerados: {len(chunks)}")

            # 3. Geração de Embeddings e persistência
            print("3. Gerando embeddings para os chunks...")
            for idx, c in enumerate(chunks):
                emb = embedder.generate_query_embedding(c["text_content"])
                chunk_record = DocumentChunk(
                    document_id=doc.id,
                    chunk_index=idx,
                    page_number=c.get("page_number", 1),
                    chunk_type=c.get("chunk_type", "text"),
                    bounding_box=c.get("bounding_box", [0.0, 0.0, 1.0, 1.0]),
                    text_content=c["text_content"],
                    embedding=emb,
                )
                db.add(chunk_record)

            doc.status = DocumentStatus.COMPLETED
            db.commit()
            print(f"   Documento '{filename}' indexado com sucesso com {len(chunks)} chunks!")

        print("\nIngestão completa de todos os documentos de avaliação finalizada com sucesso!")

    finally:
        db.close()


if __name__ == "__main__":
    ingest_eval_docs()
