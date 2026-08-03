import uuid
import pypdfium2 as pdfium
import logging
from app.repositories.document_repository import DocumentRepository
from app.database.models.document import DocumentStatus
from app.services.chunking_service import ChunkingService

logger = logging.getLogger(__name__)

class ParsingService:
    def __init__(self, repository: DocumentRepository):
        self.repository = repository

    def process_document(self, document_id: uuid.UUID) -> None:
        """
        Lê o arquivo PDF físico, extrai o texto e atualiza o banco de dados.
        Trata erros silenciosamente para não quebrar o sistema.
        """
        # 1. Busca o documento no banco
        document = self.repository.get_by_id(document_id)
        if not document or not document.file_path:
            return

        # 2. Atualiza o status para mostrar que o processamento começou
        self.repository.update_status(document_id, DocumentStatus.PARSING)

        try:
            logger.info(f"Iniciando extração de texto para o documento ID: {document_id}")
            
            # 3. Inicializa o motor do pypdfium2 e extrai o texto
            pdf = pdfium.PdfDocument(document.file_path)
            extracted_text_blocks = []

            for page in pdf:
                text_page = page.get_textpage()
                text = text_page.get_text_range()
                if text:
                    extracted_text_blocks.append(text)

            # Junta todas as páginas com uma quebra de linha
            final_text = "\n\n".join(extracted_text_blocks).strip()

            # 4. Verifica se o pdf tem texto util
            if not final_text:
                logger.warning(f"O arquivo {document.file_path} não contém texto legível.")
                self.repository.update_document_content(
                    document_id, 
                    content=None, 
                    status=DocumentStatus.ERROR
                )
                return

            # 5. Sucesso: Salva o texto no banco e conclui a etapa
            logger.info(f"Extração concluída com sucesso para ID: {document_id}")
            self.repository.update_document_content(
                document_id, 
                content=final_text, 
                status=DocumentStatus.COMPLETED
            )

            # 6. INICIA A FASE 4 IMEDIATAMENTE APÓS A FASE 3
            chunking_service = ChunkingService(self.repository)
            chunking_service.process_document(document_id)

        except Exception as e:
            # Em caso de PDF corrompido, protegido por senha ou erro de I/O
            logger.error(f"Erro de parsing no arquivo ID {document_id}: {str(e)}")
            self.repository.update_document_content(
                document_id, 
                content=None, 
                status=DocumentStatus.ERROR
            )