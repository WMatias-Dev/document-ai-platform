import logging
from typing import List

logger = logging.getLogger(__name__)


class ChunkingService:
    def __init__(
        self,
        chunk_size: int = 1000,
        overlap: int = 200,
        min_chunk_size: int = 50,
    ):
        self.chunk_size = chunk_size
        self.overlap = overlap
        self.min_chunk_size = min_chunk_size

        if self.overlap >= self.chunk_size:
            raise ValueError("O overlap deve ser menor que o tamanho do chunk.")

    def chunk_text(self, text: str) -> List[str]:
        cleaned_text = text.strip() if text else ""
        if not cleaned_text:
            logger.warning("Texto vazio recebido para chunking.")
            return []

        logger.info(
            f"Iniciando chunking (tamanho: {self.chunk_size}, overlap: {self.overlap})."
        )

        text_length = len(cleaned_text)

        if text_length <= self.chunk_size:
            return [cleaned_text]

        chunks: List[str] = []
        start = 0

        while start < text_length:
            end = start + self.chunk_size
            chunk = cleaned_text[start:end]
            chunks.append(chunk)

            if end >= text_length:
                break

            start += self.chunk_size - self.overlap

        # Se o último chunk for menor que min_chunk_size, mesclamos o residual no anterior
        # para evitar fragmentos minúsculos isolados e não perder dados
        if len(chunks) > 1 and len(chunks[-1]) < self.min_chunk_size:
            last_chunk = chunks.pop()
            residual = (
                last_chunk[self.overlap:]
                if len(last_chunk) > self.overlap
                else last_chunk
            )
            chunks[-1] = chunks[-1] + residual

        logger.info(f"Chunking concluído. {len(chunks)} chunks gerados.")
        return chunks