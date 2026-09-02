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
    Utiliza um provedor canônico único definido por configuração (Ollama ou Google Gemini),
    garantindo homogeneidade estrita do espaço latente e evitando contaminação vetorial.
    """

    def __init__(
        self,
        repository: DocumentRepository,
        batch_size: int = 24,
        provider: Optional[str] = None,
    ):
        self.repository = repository
        self.batch_size = batch_size
        self.provider = (provider or getattr(settings, "EMBEDDING_PROVIDER", "ollama")).lower().strip()
        self.ollama_url = os.getenv("OLLAMA_BASE_URL", getattr(settings, "OLLAMA_BASE_URL", "http://localhost:11434"))
        self.ollama_model_name = getattr(settings, "OLLAMA_EMBED_MODEL", "nomic-embed-text")
        self.gemini_api_key = getattr(settings, "GEMINI_API_KEY", None) or os.getenv("GEMINI_API_KEY") or getattr(settings, "GOOGLE_API_KEY", None) or os.getenv("GOOGLE_API_KEY")
        
        self.embed_model = None
        self.gemini_client = None
        self._init_provider()

    def _init_provider(self) -> None:
        """Inicializa exclusivamente o provedor configurado."""
        if self.provider == "gemini":
            if not self.gemini_api_key:
                logger.warning("[EmbeddingService] Provedor Gemini selecionado, mas GOOGLE_API_KEY / GEMINI_API_KEY não configurada.")
            else:
                try:
                    from google import genai
                    self.gemini_client = genai.Client(api_key=self.gemini_api_key)
                    logger.info("[EmbeddingService] Provedor Gemini Embeddings (text-embedding-004) inicializado com sucesso.")
                except Exception as e:
                    logger.error(f"[EmbeddingService] Falha ao inicializar cliente Gemini: {e}")
                    self.gemini_client = None
        else:
            # Padrão: Ollama
            try:
                from llama_index.embeddings.ollama import OllamaEmbedding
                self.embed_model = OllamaEmbedding(
                    model_name=self.ollama_model_name,
                    base_url=self.ollama_url,
                    request_timeout=30.0,
                )
                logger.info(f"[EmbeddingService] Provedor Ollama ({self.ollama_model_name}) inicializado em {self.ollama_url}.")
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
            logger.info(f"[EmbeddingService] Gerando embeddings ({self.provider}) para {total} chunks em lotes de {self.batch_size}...")

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
        """Gera embedding para a query de pesquisa do usuário utilizando o provedor canônico."""
        if not query_text or not query_text.strip():
            raise ValueError("Texto de consulta não pode ser vazio.")

        cleaned_query = query_text.strip()

        if self.provider == "gemini":
            return self._generate_gemini_single_embedding(cleaned_query)

        # Provedor Ollama
        if not self.embed_model:
            self._init_provider()

        if not self.embed_model:
            raise RuntimeError(f"Provedor Ollama indisponível em {self.ollama_url}. Não é permitido chavear para outro modelo para evitar contaminação do espaço vetorial.")

        try:
            return self.embed_model.get_query_embedding(cleaned_query)
        except Exception as err:
            logger.error(f"[EmbeddingService] Falha ao gerar query embedding via Ollama: {err}", exc_info=True)
            raise RuntimeError(f"Falha no provedor de embedding Ollama: {err}")

    def _generate_batch_embeddings(self, texts: List[str]) -> List[List[float]]:
        """Gera embeddings em lote utilizando estritamente o provedor canônico."""
        if self.provider == "gemini":
            return self._generate_gemini_batch_embeddings(texts)

        # Provedor Ollama
        if not self.embed_model:
            self._init_provider()

        if not self.embed_model:
            raise RuntimeError(f"Provedor Ollama indisponível em {self.ollama_url}. Não é permitido chavear para outro modelo.")

        try:
            return self.embed_model.get_text_embedding_batch(texts)
        except Exception as err:
            logger.error(f"[EmbeddingService] Falha ao gerar lote de embeddings via Ollama: {err}", exc_info=True)
            raise RuntimeError(f"Falha no provedor de embedding Ollama: {err}")

    def _generate_gemini_batch_embeddings(self, texts: List[str]) -> List[List[float]]:
        """Gera embeddings em lote via Google GenAI SDK (768 dimensões)."""
        if not self.gemini_client:
            self._init_provider()

        if not self.gemini_client:
            raise RuntimeError("Provedor Gemini selecionado, mas cliente não está inicializado (verifique GOOGLE_API_KEY).")

        try:
            from google.genai import types
            config = types.EmbedContentConfig(output_dimensionality=768)
            results: List[List[float]] = []
            for txt in texts:
                resp = self.gemini_client.models.embed_content(
                    model="gemini-embedding-001",
                    contents=txt,
                    config=config,
                )
                if hasattr(resp, "embeddings") and resp.embeddings:
                    results.append(resp.embeddings[0].values[:768])
                elif hasattr(resp, "embedding") and resp.embedding:
                    results.append(resp.embedding.values[:768])
                else:
                    results.append([0.0] * 768)

            return results
        except Exception as gemini_err:
            logger.error(f"[EmbeddingService] Falha no Gemini Embeddings: {gemini_err}", exc_info=True)
            raise RuntimeError(f"Erro no provedor Gemini Embeddings: {gemini_err}")

    def _generate_gemini_single_embedding(self, text: str) -> List[float]:
        """Gera embedding único via Google GenAI SDK (768 dimensões)."""
        if not self.gemini_client:
            self._init_provider()

        if not self.gemini_client:
            raise RuntimeError("Provedor Gemini selecionado, mas cliente não está inicializado (verifique GOOGLE_API_KEY).")

        try:
            from google.genai import types
            config = types.EmbedContentConfig(output_dimensionality=768)
            resp = self.gemini_client.models.embed_content(
                model="gemini-embedding-001",
                contents=text,
                config=config,
            )
            if hasattr(resp, "embeddings") and resp.embeddings:
                return resp.embeddings[0].values[:768]
            elif hasattr(resp, "embedding") and resp.embedding:
                return resp.embedding.values[:768]
            return [0.0] * 768
        except Exception as e:
            logger.error(f"[EmbeddingService] Falha ao gerar embedding com Gemini: {e}", exc_info=True)
            raise RuntimeError(f"Falha no provedor Gemini Embeddings: {str(e)}")