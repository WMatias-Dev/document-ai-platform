import logging
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


class ParsingService:
    """
    Extrai texto, tabelas e coordenadas visuais de arquivos PDF.
    Usa PyMuPDF como leitor principal e pypdfium2 como alternativa se o primeiro falhar.
    """

    def extract_structured_pages(self, file_path: str) -> List[Dict[str, Any]]:
        """Lê o PDF e devolve blocos de texto e tabelas em Markdown com coordenadas normalizadas de 0 a 1."""
        logger.info(f"[ParsingService] Iniciando extração estruturada (PyMuPDF): {file_path}")
        extracted_elements: List[Dict[str, Any]] = []

        try:
            import fitz  # PyMuPDF

            doc = fitz.open(file_path)
            total_pages = len(doc)

            for page_idx in range(total_pages):
                page = doc[page_idx]
                page_num = page_idx + 1
                rect = page.rect
                # Evito divisão por zero caso o PDF tenha dimensões de página corrompidas ou zeradas
                width, height = max(1.0, float(rect.width)), max(1.0, float(rect.height))

                table_bboxes = []

                # Converto tabelas para Markdown porque a LLM entende a estrutura de linhas e colunas muito melhor
                try:
                    tabs = page.find_tables()
                    if tabs and hasattr(tabs, "tables"):
                        for tab in tabs.tables:
                            bbox = tab.bbox  # (x0, y0, x1, y1)
                            table_bboxes.append(bbox)
                            table_md = tab.to_markdown()

                            if table_md and table_md.strip():
                                # Normalizo as coordenadas dividindo por largura/altura para o frontend destacar no PDF
                                extracted_elements.append({
                                    "page_number": page_num,
                                    "chunk_type": "table",
                                    "text": table_md.strip(),
                                    "bounding_box": [
                                        round(bbox[0] / width, 4),
                                        round(bbox[1] / height, 4),
                                        round(bbox[2] / width, 4),
                                        round(bbox[3] / height, 4),
                                    ],
                                })
                except Exception as table_err:
                    logger.debug(f"Detecção de tabelas ignorada na página {page_num}: {table_err}")

                # Extraio blocos textuais da página mantendo a posição de cada parágrafo
                blocks = page.get_text("blocks")
                for b in blocks:
                    if len(b) < 5:
                        continue
                    bbox = (b[0], b[1], b[2], b[3])
                    text = b[4].strip()

                    if not text:
                        continue

                    # Ignoro blocos de texto comuns que fiquem dentro de uma tabela para não duplicar informação
                    if any(self._intersects(bbox, t_box) for t_box in table_bboxes):
                        continue

                    extracted_elements.append({
                        "page_number": page_num,
                        "chunk_type": "text",
                        "text": text,
                        "bounding_box": [
                            round(bbox[0] / width, 4),
                            round(bbox[1] / height, 4),
                            round(bbox[2] / width, 4),
                            round(bbox[3] / height, 4),
                        ],
                    })

            doc.close()

            # TODO: se o PDF for escaneado (apenas imagens), precisa de OCR com Tesseract para não vir vazio
            if not extracted_elements:
                raise ValueError("Nenhum texto ou tabela extraível encontrado no PDF.")

            logger.info(
                f"[ParsingService] Extração concluída. {len(extracted_elements)} blocos/tabelas estruturados extraídos."
            )
            return extracted_elements

        except Exception as e:
            # Se o PyMuPDF quebrar por arquivo malformado, tento extrair com a biblioteca secundária
            logger.warning(f"[ParsingService] PyMuPDF falhou ({e}), tentando fallback pypdfium2...")
            return self._fallback_extract_pages(file_path)

    def extract_text(self, file_path: str) -> str:
        """Extrai todo o texto do documento concatenado em uma única string."""
        try:
            elements = self.extract_structured_pages(file_path)
            return "\n\n".join(item["text"] for item in elements)
        except Exception:
            return self._extract_text_pypdfium(file_path)

    def _intersects(self, box_a: tuple, box_b: tuple) -> bool:
        """Verifica se há sobreposição entre duas caixas delimitadoras 2D."""
        ax0, ay0, ax1, ay1 = box_a
        bx0, by0, bx1, by1 = box_b
        # Testo separação nos eixos X e Y: se não houver vão separando, há intersecção
        return not (ax1 <= bx0 or ax0 >= bx1 or ay1 <= by0 or ay0 >= by1)

    def _fallback_extract_pages(self, file_path: str) -> List[Dict[str, Any]]:
        """Extrai o texto por página com pypdfium2 quando o PyMuPDF não consegue abrir o arquivo."""
        import pypdfium2 as pdfium
        pdf = pdfium.PdfDocument(file_path)
        elements = []

        try:
            for i in range(len(pdf)):
                page = pdf[i]
                textpage = page.get_textpage()
                page_text = textpage.get_text_bounded().strip()
                if page_text:
                    # O pypdfium2 básico não isola blocos individuais, então atribuo as coordenadas da página inteira
                    elements.append({
                        "page_number": i + 1,
                        "chunk_type": "text",
                        "text": page_text,
                        "bounding_box": [0.0, 0.0, 1.0, 1.0],
                    })

            if not elements:
                raise ValueError("Documento vazio ou escaneado.")
            return elements
        finally:
            pdf.close()

    def _extract_text_pypdfium(self, file_path: str) -> str:
        """Lê o texto integral via pypdfium2 para contingência."""
        import pypdfium2 as pdfium
        pdf = pdfium.PdfDocument(file_path)
        try:
            parts = []
            for i in range(len(pdf)):
                textpage = pdf[i].get_textpage()
                parts.append(textpage.get_text_bounded())
            full_text = "\n".join(parts).strip()
            if not full_text:
                raise ValueError("Documento vazio.")
            return full_text
        finally:
            pdf.close()