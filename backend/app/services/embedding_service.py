import os
import uuid
from typing import List
from llama_index.embeddings.ollama import OllamaEmbedding
from app.repositories.document_repository import DocumentRepository
from app.database.models.document import DocumentStatus
from app.database.models.document_chunk import DocumentChunk

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
        # 1. Atualizamos o status para refletir o estágio atual
        self.repository.update_status(document_id, DocumentStatus.EMBEDDING)

        try:
            # 2. Busca todos os chunks desse documento que ainda não têm vetor
            chunks: List[DocumentChunk] = self.repository.get_chunks_by_document(document_id)
            
            if not chunks:
                self.repository.update_status(document_id, DocumentStatus.COMPLETED)
                return

            # 3. Geração de Embeddings em lote
            # Extraímos apenas os textos para enviar ao modelo
            texts = [chunk.text_content for chunk in chunks]
            
            # O LlamaIndex fará a chamada para o Ollama
            embeddings = self.embed_model.get_text_embedding_batch(texts)

            # 4. Associa os vetores gerados de volta aos objetos do banco de dados
            for i, chunk in enumerate(chunks):
                chunk.embedding = embeddings[i]

            # 5. Salva as alterações no banco de dados e finaliza o pipeline
            self.repository.save_chunks(chunks)
            self.repository.update_status(document_id, DocumentStatus.COMPLETED)

        except Exception as e:
            self.repository.update_status(document_id, DocumentStatus.ERROR)
            # logger.error(f"Erro ao gerar embeddings para doc {document_id}: {e}")