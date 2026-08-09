import uuid
from unittest.mock import MagicMock

from app.database.models.document import DocumentStatus
from app.services.document_service import DocumentService


def test_background_pipeline_failure_updates_status_to_failed():
    """
    Garante que falhas no parsing interrompam o pipeline e atualizem
    o status do documento para ERROR no repositório.
    """
    # 1. SETUP: Criamos os 5 Mocks necessários
    mock_repo = MagicMock()
    mock_storage = MagicMock()
    mock_parser = MagicMock()
    mock_chunker = MagicMock()
    mock_embedder = MagicMock()

    # Forçamos o parser a lançar uma exceção simulada
    mock_parser.extract_text.side_effect = RuntimeError("Erro simulado no PDF")

    # Instanciamos o serviço com as dependências mockadas
    service = DocumentService(
        repository=mock_repo,
        storage=mock_storage,
        parser=mock_parser,
        chunker=mock_chunker,
        embedder=mock_embedder,
    )

    doc_id = uuid.uuid4()
    file_path = "caminhos/falso_documento.pdf"

    # 2. AÇÃO: Executamos o método interno do pipeline
    service._run_pipeline(document_id=doc_id, file_path=file_path)

    # 3. ASSERÇÕES:
    # Usamos assert_called_with para validar a ÚLTIMA chamada recebida pelo repositório
    mock_repo.update_status.assert_called_with(
        document_id=doc_id,
        status=DocumentStatus.ERROR
    )

    # Verifica se os passos subsequentes NUNCA foram executados
    mock_chunker.chunk_text.assert_not_called()
    if hasattr(mock_embedder, "process_document"):
        mock_embedder.process_document.assert_not_called()