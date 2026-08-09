import pytest
from unittest.mock import MagicMock, AsyncMock
from fastapi import UploadFile

from app.services.storage_service import StorageService


@pytest.mark.asyncio
async def test_storage_rejects_non_pdf():
    """
    Garante que o StorageService rejeite arquivos que não possuem extensão .pdf,
    lançando um ValueError com a mensagem adequada.
    """
    # 1. SETUP
    storage_service = StorageService()

    # Criação do mock do arquivo com tipo diferente de PDF
    non_pdf_file = MagicMock(spec=UploadFile)
    non_pdf_file.filename = "malware.exe"
    
    # Configura o método de leitura para ser assíncrono (evita erro no 'await file.read')
    non_pdf_file.read = AsyncMock(return_value=b"conteudo")

    # 2. AÇÃO & ASSERÇÃO
    # Ajustado a string no parâmetro 'match' para coincidir com o método _generate_safe_filepath
    with pytest.raises(ValueError, match="Apenas arquivos PDF são suportados."):
        await storage_service.save_file(file=non_pdf_file)