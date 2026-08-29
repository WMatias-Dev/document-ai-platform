import logging
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


class ParsingService:
    """
    Serviço de extração e reconhecimento estruturado de PDFs.
    Utiliza PyMuPDF (fitz) em C puro para velocidade extrema, detecção de tabelas e bounding boxes,
    com fallback seguro para pypdfium2.
    """

    def extract_structured_pages(self, file_path: str) -> List[Dict[str, Any]]:
        """
        Extrai blocos estruturados de texto e tabelas em Markdown com coordenadas normalizadas [x0, y0, x1, y1].
        """
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
                width, height = max(1.0, float(rect.width)), max(1.0, float(rect.height))

                table_bboxes = []

                # 1. Detecção e extração de Tabelas estruturadas
                try:
                    tabs = page.find_tables()
                    if tabs and hasattr(tabs, "tables"):
                        for tab in tabs.tables:
                            bbox = tab.bbox  # (x0, y0, x1, y1)
                            table_bboxes.append(bbox)
                            table_md = tab.to_markdown()

                            if table_md and table_md.strip():
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

                # 2. Extração de blocos de texto estruturados
                blocks = page.get_text("blocks")
                for b in blocks:
                    if len(b) < 5:
                        continue
                    bbox = (b[0], b[1], b[2], b[3])
                    text = b[4].strip()

                    if not text:
                        continue

                    # Ignora texto que colide exatamente com tabelas já extraídas
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

            if not extracted_elements:
                raise ValueError("Nenhum texto ou tabela extraível encontrado no PDF.")

            logger.info(
                f"[ParsingService] Extração concluída. {len(extracted_elements)} blocos/tabelas estruturados extraídos."
            )
            return extracted_elements

        except Exception as e:
            logger.warning(f"[ParsingService] PyMuPDF falhou ({e}), tentando fallback pypdfium2...")
            return self._fallback_extract_pages(file_path)

    def extract_text(self, file_path: str) -> str:
        """
        Extrai o texto integral como string (para auditoria ou fallback).
        """
        try:
            elements = self.extract_structured_pages(file_path)
            return "\n\n".join(item["text"] for item in elements)
        except Exception:
            return self._extract_text_pypdfium(file_path)

    def _intersects(self, box_a: tuple, box_b: tuple) -> bool:
        """Verifica se há sobreposição entre duas caixas delimitadoras."""
        ax0, ay0, ax1, ay1 = box_a
        bx0, by0, bx1, by1 = box_b
        return not (ax1 <= bx0 or ax0 >= bx1 or ay1 <= by0 or ay0 >= by1)

    def _fallback_extract_pages(self, file_path: str) -> List[Dict[str, Any]]:
        """Fallback usando pypdfium2 para extração por página."""
        import pypdfium2 as pdfium
        pdf = pdfium.PdfDocument(file_path)
        elements = []

        try:
            for i in range(len(pdf)):
                page = pdf[i]
                textpage = page.get_textpage()
                page_text = textpage.get_text_bounded().strip()
                if page_text:
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