import logging
from typing import Any, Dict, List

logger = logging.getLogger(__name__)


class ChunkingService:
    """
    Serviço de particionamento (chunking) estruturado e hierárquico.
    Preserva tabelas de forma atômica para não corromper cabeçalhos e dados,
    e particiona blocos de texto respeitando páginas e bounding boxes.
    """

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

    def chunk_structured_document(
        self,
        parsed_elements: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        """
        Gera chunks preservando metadados de layout, número de página e tabelas atômicas.
        """
        if not parsed_elements:
            return []

        chunks: List[Dict[str, Any]] = []

        for elem in parsed_elements:
            chunk_type = elem.get("chunk_type", "text")
            text = elem.get("text", "").strip()
            page_num = elem.get("page_number", 1)
            bbox = elem.get("bounding_box", [0.0, 0.0, 1.0, 1.0])

            if not text:
                continue

            # 1. Tabelas são preservadas de forma ATÔMICA
            if chunk_type == "table":
                chunks.append({
                    "chunk_type": "table",
                    "page_number": page_num,
                    "text_content": text,
                    "bounding_box": bbox,
                })
                continue

            # 2. Blocos de texto que cabem em um único chunk
            if len(text) <= self.chunk_size:
                chunks.append({
                    "chunk_type": "text",
                    "page_number": page_num,
                    "text_content": text,
                    "bounding_box": bbox,
                })
                continue

            # 3. Blocos de texto longos são fatiados com overlap
            sub_chunks = self.chunk_text(text)
            for sub in sub_chunks:
                chunks.append({
                    "chunk_type": "text",
                    "page_number": page_num,
                    "text_content": sub,
                    "bounding_box": bbox,
                })

        logger.info(
            f"[ChunkingService] Documento estruturado particionado em {len(chunks)} chunks (tabelas preservadas)."
        )
        return chunks

    def chunk_text(self, text: str) -> List[str]:
        """Chunking clássico baseado em janela deslizante com overlap."""
        cleaned_text = text.strip() if text else ""
        if not cleaned_text:
            return []

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

        # Se o último chunk for menor que min_chunk_size, mescla no anterior
        if len(chunks) > 1 and len(chunks[-1]) < self.min_chunk_size:
            last_chunk = chunks.pop()
            residual = (
                last_chunk[self.overlap:]
                if len(last_chunk) > self.overlap
                else last_chunk
            )
            chunks[-1] = chunks[-1] + residual

        return chunks