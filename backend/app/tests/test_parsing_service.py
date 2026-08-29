import pytest
from unittest.mock import patch, MagicMock
from app.services.parsing_service import ParsingService


def test_parsing_service_extract_structured_pages_mock():
    parser = ParsingService()

    # Mock do PyMuPDF (fitz)
    with patch("fitz.open") as mock_fitz_open:
        mock_doc = MagicMock()
        mock_doc.__len__.return_value = 1

        mock_page = MagicMock()
        mock_page.rect.width = 600
        mock_page.rect.height = 800

        # Mock de tabela
        mock_table = MagicMock()
        mock_table.bbox = (50, 100, 550, 300)
        mock_table.to_markdown.return_value = "| Coluna 1 | Coluna 2 |\n|---|---|\n| Valor A | Valor B |"
        
        mock_tabs = MagicMock()
        mock_tabs.tables = [mock_table]
        mock_page.find_tables.return_value = mock_tabs

        # Mock de blocos de texto
        mock_page.get_text.return_value = [
            (50, 350, 550, 450, "Este é um parágrafo textual após a tabela.", 0, 0)
        ]

        mock_doc.__getitem__.return_value = mock_page
        mock_fitz_open.return_value = mock_doc

        elements = parser.extract_structured_pages("test.pdf")

        assert len(elements) == 2
        # Elemento 1: Tabela
        assert elements[0]["chunk_type"] == "table"
        assert "| Coluna 1 |" in elements[0]["text"]
        assert elements[0]["page_number"] == 1
        assert len(elements[0]["bounding_box"]) == 4

        # Elemento 2: Texto
        assert elements[1]["chunk_type"] == "text"
        assert "parágrafo textual" in elements[1]["text"]
        assert elements[1]["page_number"] == 1


def test_parsing_empty_pdf_raises_value_error():
    parser = ParsingService()

    with patch("fitz.open") as mock_fitz_open:
        mock_doc = MagicMock()
        mock_doc.__len__.return_value = 1
        mock_page = MagicMock()
        mock_page.rect.width = 600
        mock_page.rect.height = 800
        mock_page.find_tables.return_value = None
        mock_page.get_text.return_value = []
        mock_doc.__getitem__.return_value = mock_page
        mock_fitz_open.return_value = mock_doc

        with patch("pypdfium2.PdfDocument") as mock_pdfium_doc:
            mock_p_doc = MagicMock()
            mock_p_doc.__len__.return_value = 0
            mock_pdfium_doc.return_value = mock_p_doc

            with pytest.raises(ValueError, match="Documento vazio"):
                parser.extract_text("empty.pdf")