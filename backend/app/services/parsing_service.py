import logging
import pypdfium2 as pdfium

logger = logging.getLogger(__name__)


class ParsingService:
    def extract_text(self, file_path: str) -> str:
        """Extrai o texto integral de um arquivo PDF utilizando pypdfium2."""
        logger.info(f"Iniciando extração de texto do arquivo: {file_path}")

        pdf = None

        try:
            pdf = pdfium.PdfDocument(file_path)
            text_parts = []

            for i in range(len(pdf)):
                page = pdf[i]
                textpage = page.get_textpage()
                text_parts.append(textpage.get_text_bounded())

            full_text = "\n".join(text_parts).strip()

            if not full_text:
                logger.warning(
                    f"Nenhum texto extraível encontrado em {file_path}. Pode ser um PDF escaneado ou vazio."
                )
                raise ValueError(
                    "O documento está vazio ou contém apenas imagens (OCR não suportado nesta etapa)."
                )

            logger.info(
                f"Extração concluída. Total de caracteres: {len(full_text)}"
            )
            return full_text

        except ValueError:
            raise
        except Exception as e:
            logger.error(
                f"Erro crítico ao ler o PDF {file_path}: {str(e)}",
                exc_info=True,
            )
            raise RuntimeError(f"Falha na leitura do arquivo PDF: {str(e)}")
        finally:
            if pdf is not None and hasattr(pdf, "close"):
                pdf.close()