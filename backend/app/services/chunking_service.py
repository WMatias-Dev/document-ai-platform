import logging
from typing import List

logger = logging.getLogger(__name__)

class ChunkingService:
    def __init__(self, chunk_size: int = 1000, overlap: int = 200):
        # O guia exige definir claramente o tamanho máximo e a sobreposição
        self.chunk_size = chunk_size
        self.overlap = overlap

        # Validação de sanidade: o overlap nunca pode ser maior que o próprio chunk
        if self.overlap >= self.chunk_size:
            raise ValueError("O overlap deve ser menor que o tamanho do chunk.")

    def chunk_text(self, text: str) -> List[str]:
        """
        Divide o texto extraído em pedaços menores mantendo o contexto
        através de sobreposição (overlap).
        """
        logger.info(f"Iniciando chunking (tamanho: {self.chunk_size}, overlap: {self.overlap}).")
        
        if not text or not text.strip():
            logger.warning("Texto vazio recebido para chunking.")
            return []
            
        chunks = []
        start = 0
        text_length = len(text)
        
        # Estratégia de Janela Deslizante
        while start < text_length:
            end = start + self.chunk_size
            
            # Extrai o pedaço atual
            chunk = text[start:end]
            chunks.append(chunk)
            
            # Se já pegamos até o fim (ou além) do texto, podemos parar
            if end >= text_length:
                break
                
            # Avança o ponteiro de início, mas recua o valor do overlap 
            # para garantir a preservação do contexto
            start += (self.chunk_size - self.overlap)
            
        logger.info(f"Chunking concluído. {len(chunks)} chunks gerados.")
        
        # Proteção contra chunks excessivamente pequenos que degradam a IA
        # Se o último chunk for muito pequeno (ex: < 50 chars), podemos descartá-lo 
        # ou juntá-lo ao anterior. Por simplicidade inicial, apenas filtramos se for irrisório.
        valid_chunks = [c for c in chunks if len(c.strip()) > 50]
        
        return valid_chunks