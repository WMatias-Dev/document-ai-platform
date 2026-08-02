import uuid
from typing import List
from app.repositories.document_repository import DocumentRepository
from app.database.models.document import DocumentStatus

class ChunkingService:
    def __init__(self, repository: DocumentRepository, chunk_size: int = 1000, overlap: int = 200):
        self.repository = repository
        self.chunk_size = chunk_size
        self.overlap = overlap

    def process_document(self, document_id: uuid.UUID) -> None:
        """
        Fatia o texto do documento em pedaços menores com sobreposição (overlap)
        e salva no banco de dados.
        """
        # 1. Busca o documento já extraído
        document = self.repository.get_by_id(document_id)
        if not document or not document.content:
            return

        # 2. Atualiza o status para rastreabilidade
        self.repository.update_status(document_id, DocumentStatus.CHUNKING)

        try:
            # 3. Lógica matemática de fatiamento (Sliding Window)
            text = document.content
            chunks_data = []
            start = 0
            chunk_index = 0

            while start < len(text):
                end = start + self.chunk_size
                chunk_text = text[start:end]
                
                chunks_data.append({
                    "document_id": document_id,
                    "chunk_index": chunk_index,
                    "text_content": chunk_text
                })
                
                # Se alcançamos ou ultrapassamos o final do texto, interrompemos
                if end >= len(text):
                    break
                    
                # O próximo bloco começa antes do término do bloco atual, garantindo o overlap
                start += (self.chunk_size - self.overlap)
                chunk_index += 1

            # 4. Salva todos os pedaços de uma vez no banco
            self.repository.create_chunks(chunks_data)

            # 5. Volta o status para COMPLETED após fatiar tudo com sucesso
            self.repository.update_status(document_id, DocumentStatus.COMPLETED)

        except Exception as e:
            # Em caso de falha, registramos o erro para evitar a caixa preta
            self.repository.update_status(document_id, DocumentStatus.ERROR)
            # logger.error(f"Erro no chunking do doc {document_id}: {e}")