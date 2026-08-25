import logging
import os
import uuid
from typing import List
from llama_index.embeddings.ollama import OllamaEmbedding
from app.repositories.document_repository import DocumentRepository
from app.database.models.document import DocumentStatus
from app.database.models.document_chunk import DocumentChunk

logger = logging.getLogger(__name__)


class EmbeddingService:
    def __init__(self, repository: DocumentRepository):
        self.repository = repository
        
        ollama_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
        
        self.embed_model = OllamaEmbedding(
            model_name="nomic-embed-text",
            base_url=ollama_url
        )

    def process_document(self, document_id: uuid.UUID) -> None:
        """
        Gera os embeddings vetoriais para todos os chunks de um documento.
        """
        self.repository.update_status(document_id, DocumentStatus.EMBEDDING)

        try:
            chunks: List[DocumentChunk] = self.repository.get_chunks_by_document(document_id)
            
            if not chunks:
                logger.warning(f"Nenhum chunk encontrado para gerar embeddings no documento {document_id}.")
                return

            texts = [chunk.text_content for chunk in chunks]
            embeddings = self.embed_model.get_text_embedding_batch(texts)

            for i, chunk in enumerate(chunks):
                chunk.embedding = embeddings[i]

            self.repository.save_chunks(chunks)

        except Exception as e:
            logger.error(f"Erro ao gerar embeddings para doc {document_id}: {e}", exc_info=True)
            raise

    def generate_query_embedding(self, query_text: str) -> List[float]:
        """
        Gera o vetor de embedding para uma consulta em linguagem natural.
        """
        if not query_text or not query_text.strip():
            raise ValueError("Texto de consulta não pode ser vazio.")

        try:
            return self.embed_model.get_query_embedding(query_text.strip())
        except Exception as e:
            logger.error(f"Erro ao gerar embedding da consulta: {e}", exc_info=True)
            raise RuntimeError(f"Falha ao gerar vetor para busca: {str(e)}")