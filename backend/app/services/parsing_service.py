import logging
import pypdfium2 as pdfium

logger = logging.getLogger(__name__)


class ParsingService:
    def extract_text(self, file_path: str) -> str:
        """Abre o PDF físico, extrai o texto página por página e

        valida se o conteúdo extraído é utilizável.
        """
        logger.info(f"Iniciando extração de texto do arquivo: {file_path}")

        pdf = None  # Inicialização segura para evitar UnboundLocalError no finally caso não use o 'with'

        try:
            # Carrega o documento usando pypdfium2
            pdf = pdfium.PdfDocument(file_path)
            text_parts = []

            # Itera sobre todas as páginas do PDF
            for i in range(len(pdf)):
                page = pdf[i]
                textpage = page.get_textpage()
                # Extrai o texto da página
                text_parts.append(textpage.get_text_bounded())

            # Une tudo com quebras de linha e remove espaços em branco nas pontas
            full_text = "\n".join(text_parts).strip()

            # Validação: o PDF contém texto legível?
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
            # Re-dispara o erro de validação sem alterar a pilha de chamadas
            raise
        except Exception as e:
            # Captura exceções na leitura/formato do PDF (ex: arquivo corrompido ou criptografado)
            logger.error(
                f"Erro crítico ao ler o PDF {file_path}: {str(e)}",
                exc_info=True,
            )
            raise RuntimeError(f"Falha na leitura do arquivo PDF: {str(e)}")
        finally:
            # Garante o fechamento do arquivo caso tenha sido instanciado
            if pdf is not None and hasattr(pdf, "close"):
                pdf.close()