import logging
from typing import Any, Dict, List
from app.services.sanitization_service import SanitizationService

logger = logging.getLogger(__name__)


class ChunkingService:
    """
    Divide o texto do documento em trechos menores (chunks) com sobreposição.
    Mantém tabelas inteiras para não quebrar colunas e preserva página e bounding box.
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

        # O overlap precisa ser estritamente menor que o chunk_size para a janela deslizante avançar
        if self.overlap >= self.chunk_size:
            raise ValueError("O overlap deve ser menor que o tamanho do chunk.")

    def chunk_structured_document(
        self,
        parsed_elements: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        """Recebe os elementos do parser e divide em chunks preservando tabelas inteiras e metadados de página."""
        if not parsed_elements:
            return []

        chunks: List[Dict[str, Any]] = []

        for elem in parsed_elements:
            chunk_type = elem.get("chunk_type", "text")
            raw_text = elem.get("text", "")
            # Sanitizo cada bloco antes de gerar os chunks para remover caracteres de controle e tags maliciosas
            text = SanitizationService.sanitize_text(raw_text)
            page_num = elem.get("page_number", 1)
            bbox = elem.get("bounding_box", [0.0, 0.0, 1.0, 1.0])

            if not text:
                continue

            # Não corto tabelas no meio mesmo se passarem do chunk_size para não perder a relação entre linhas e cabeçalhos
            if chunk_type == "table":
                chunks.append({
                    "chunk_type": "table",
                    "page_number": page_num,
                    "text_content": text,
                    "bounding_box": bbox,
                })
                continue

            # Se o bloco textual já cabe no limite, mantenho ele inteiro com as coordenadas originais daquele parágrafo
            if len(text) <= self.chunk_size:
                chunks.append({
                    "chunk_type": "text",
                    "page_number": page_num,
                    "text_content": text,
                    "bounding_box": bbox,
                })
                continue

            # Para blocos longos que foram fatiados, cada sub-chunk herda o bounding box do bloco pai
            # TODO: refinar o cálculo de bbox dos sub-chunks para destacar apenas a linha específica em vez do bloco inteiro
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
        """Fatia uma string longa em pedaços usando janela deslizante com tamanho fixo e sobreposição."""
        cleaned_text = text.strip() if text else ""
        if not cleaned_text:
            return []

        text_length = len(cleaned_text)

        if text_length <= self.chunk_size:
            return [cleaned_text]

        chunks: List[str] = []
        start = 0

        # TODO: o corte atual é por caractere fixo; melhorar para cortar em quebras de frase ou parágrafo
        while start < text_length:
            end = start + self.chunk_size
            chunk = cleaned_text[start:end]
            chunks.append(chunk)

            if end >= text_length:
                break

            # Avanço a janela descontando a sobreposição para garantir que o contexto entre chunks não se perca
            start += self.chunk_size - self.overlap

        # Se a sobra final for muito pequena (ex: menos de 50 caracteres), junto no chunk anterior para não gerar lixo vetorial
        if len(chunks) > 1 and len(chunks[-1]) < self.min_chunk_size:
            last_chunk = chunks.pop()
            # Desconto a sobreposição ao mesclar para não duplicar o trecho repetido dentro do mesmo chunk
            residual = (
                last_chunk[self.overlap:]
                if len(last_chunk) > self.overlap
                else last_chunk
            )
            chunks[-1] = chunks[-1] + residual

        return chunks