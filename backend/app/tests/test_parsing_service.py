import pytest
from unittest.mock import patch, MagicMock

from app.services.parsing_service import ParsingService


def test_parsing_empty_pdf_raises_value_error():
    """
    Testa se um PDF com páginas sem conteúdo legível dispara ValueError.
    Garante que o mock do PDF possua o método .close() esperado no bloco finally.
    """
    parser = ParsingService()
    
    # Mockando a biblioteca pypdfium2 no módulo do serviço
    with patch("app.services.parsing_service.pdfium.PdfDocument") as mock_pdf_class:
        # Mock da página individual
        mock_page = MagicMock()
        mock_page.get_textpage().get_text_bounded.return_value = "   "
        
        # Mock do objeto PdfDocument (evita criar uma lista pura)
        mock_pdf_doc = MagicMock()
        # Permite que 'for page in pdf:' funcione iterando sobre o mock_page
        mock_pdf_doc.__iter__.return_value = iter([mock_page])
        
        # Faz o construtor do pdfium retornar o mock_pdf_doc configurado
        mock_pdf_class.return_value = mock_pdf_doc
        
        with pytest.raises(ValueError, match="O documento está vazio ou contém apenas imagens"):
            parser.extract_text("fake_path.pdf")
            
        # Opcional: Garante que o recurso foi fechado corretamente no bloco finally
        mock_pdf_doc.close.assert_called_once()


def test_parsing_corrupted_file_raises_runtime_error():
    """
    Testa se arquivos corrompidos geram RuntimeError encapsulado ao falhar no pdfium.
    """
    parser = ParsingService()
    
    # Simula exceção durante a abertura/construção do PDF
    with patch("app.services.parsing_service.pdfium.PdfDocument", side_effect=Exception("File format invalid")):
        with pytest.raises(RuntimeError, match="Falha na leitura do arquivo PDF"):
            parser.extract_text("corrupted_file.pdf")