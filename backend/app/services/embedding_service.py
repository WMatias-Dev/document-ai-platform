import logging
import os
import uuid
from typing import List, Optional
from app.repositories.document_repository import DocumentRepository
from app.database.models.document import DocumentStatus
from app.database.models.document_chunk import DocumentChunk
from app.core.config import settings

logger = logging.getLogger(__name__)


class EmbeddingService:
    """
    Serviço de geração e indexação vetorial de chunks em lote (Batching).
    Suporta Ollama local por padrão com fallback transparente para Google Gemini Embeddings.
    """

    def __init__(self, repository: DocumentRepository, batch_size: int = 24):
        self.repository = repository
        self.batch_size = batch_size
        self.ollama_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
        self.embed_model = None
        self._init_model()

    def _init_model(self) -> None:
        try:
            from llama_index.embeddings.ollama import OllamaEmbedding
            self.embed_model = OllamaEmbedding(
                model_name="nomic-embed-text",
                base_url=self.ollama_url,
                request_timeout=30.0,
            )
        except Exception as e:
            logger.warning(f"[EmbeddingService] Falha ao instanciar OllamaEmbedding: {e}")
            self.embed_model = None

    def process_document(self, document_id: uuid.UUID) -> None:
        """Processa todos os chunks de um documento em lotes eficientes."""
        self.repository.update_status(document_id, DocumentStatus.EMBEDDING)

        try:
            chunks: List[DocumentChunk] = self.repository.get_chunks_by_document(document_id)
            
            if not chunks:
                logger.warning(f"Nenhum chunk encontrado para gerar embeddings no documento {document_id}.")
                return

            unembedded = [c for c in chunks if c.embedding is None]
            if not unembedded:
                logger.info(f"Todos os chunks do documento {document_id} já possuem embeddings.")
                return

            total = len(unembedded)
            logger.info(f"[EmbeddingService] Gerando embeddings para {total} chunks em lotes de {self.batch_size}...")

            for i in range(0, total, self.batch_size):
                batch_chunks = unembedded[i : i + self.batch_size]
                texts = [c.text_content for c in batch_chunks]

                embeddings = self._generate_batch_embeddings(texts)

                for chunk, emb in zip(batch_chunks, embeddings):
                    chunk.embedding = emb

                # Salva o lote no banco de dados de forma incremental
                self.repository.save_chunks(batch_chunks)
                logger.info(f"[EmbeddingService] Lote {i // self.batch_size + 1}/{(total + self.batch_size - 1) // self.batch_size} persistido.")

        except Exception as e:
            logger.error(f"Erro ao gerar embeddings para doc {document_id}: {e}", exc_info=True)
            raise

    def generate_query_embedding(self, query_text: str) -> List[float]:
        """Gera embedding para a query de pesquisa do usuário."""
        if not query_text or not query_text.strip():
            raise ValueError("Texto de consulta não pode ser vazio.")

        cleaned_query = query_text.strip()

        try:
            if self.embed_model:
                return self.embed_model.get_query_embedding(cleaned_query)
        except Exception as ollama_err:
            logger.warning(f"[EmbeddingService] Ollama falhou na query: {ollama_err}. Tentando fallback...")

        # Fallback para Gemini Embedding API
        return self._generate_gemini_single_embedding(cleaned_query)

    def _generate_batch_embeddings(self, texts: List[str]) -> List[List[float]]:
        """Tenta gerar embeddings via Ollama local; se indisponível, usa fallback Gemini."""
        try:
            if self.embed_model:
                return self.embed_model.get_text_embedding_batch(texts)
        except Exception as ollama_err:
            logger.warning(f"[EmbeddingService] Ollama indisponível ({ollama_err}). Acionando fallback Gemini API...")

        return self._generate_gemini_batch_embeddings(texts)

    def _generate_gemini_batch_embeddings(self, texts: List[str]) -> List[List[float]]:
        """Gera embeddings em lote via Google GenAI SDK (768 dimensões)."""
        api_key = getattr(settings, "GEMINI_API_KEY", None) or os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise RuntimeError("Nenhum provedor de embeddings disponível (Ollama e GEMINI_API_KEY ausentes).")

        try:
            from google import genai
            client = genai.Client(api_key=api_key)
            
            results: List[List[float]] = []
            for txt in texts:
                resp = client.models.embed_content(
                    model="text-embedding-004",
                    contents=txt,
                )
                if hasattr(resp, "embeddings") and resp.embeddings:
                    results.append(resp.embeddings[0].values[:768])
                elif hasattr(resp, "embedding") and resp.embedding:
                    results.append(resp.embedding.values[:768])
                else:
                    results.append([0.0] * 768)

            return results
        except Exception as gemini_err:
            logger.error(f"[EmbeddingService] Falha no fallback Gemini Embeddings: {gemini_err}", exc_info=True)
            raise RuntimeError(f"Erro em todos os provedores de embeddings: {gemini_err}")

    def _generate_gemini_single_embedding(self, text: str) -> List[float]:
        """Gera embedding único via Google GenAI SDK."""
        api_key = getattr(settings, "GEMINI_API_KEY", None) or os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise RuntimeError("Ollama offline e GEMINI_API_KEY não configurada.")

        try:
            from google import genai
            client = genai.Client(api_key=api_key)
            resp = client.models.embed_content(
                model="text-embedding-004",
                contents=text,
            )
            if hasattr(resp, "embeddings") and resp.embeddings:
                return resp.embeddings[0].values[:768]
            elif hasattr(resp, "embedding") and resp.embedding:
                return resp.embedding.values[:768]
            return [0.0] * 768
        except Exception as e:
            logger.error(f"[EmbeddingService] Falha ao gerar embedding com Gemini: {e}", exc_info=True)
            raise RuntimeError(f"Falha ao gerar vetor: {str(e)}")