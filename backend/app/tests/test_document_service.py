import uuid
from unittest.mock import MagicMock

from app.database.models.document import DocumentStatus
from app.services.document_service import DocumentService


def test_background_pipeline_failure_updates_status_to_failed():
    """
    Garante que falhas no parsing interrompam o pipeline e atualizem
    o status do documento para ERROR no repositório.
    """
    mock_repo = MagicMock()
    mock_storage = MagicMock()
    mock_parser = MagicMock()
    mock_chunker = MagicMock()
    mock_embedder = MagicMock()

    mock_parser.extract_text.side_effect = RuntimeError("Erro simulado no PDF")

    service = DocumentService(
        repository=mock_repo,
        storage=mock_storage,
        parser=mock_parser,
        chunker=mock_chunker,
        embedder=mock_embedder,
    )

    doc_id = uuid.uuid4()
    file_path = "caminhos/falso_documento.pdf"

    service._run_pipeline(document_id=doc_id, file_path=file_path)

    mock_repo.update_status.assert_called_with(
        document_id=doc_id,
        status=DocumentStatus.ERROR,
    )
    mock_chunker.chunk_text.assert_not_called()
    mock_embedder.process_document.assert_not_called()


def test_background_pipeline_embedding_failure_updates_status_to_failed():
    """
    Garante que se a geração de embeddings falhar, o pipeline marca o documento como ERROR.
    """
    mock_repo = MagicMock()
    mock_storage = MagicMock()
    mock_parser = MagicMock()
    mock_chunker = MagicMock()
    mock_embedder = MagicMock()

    mock_parser.extract_text.return_value = "Texto extraído com sucesso"
    mock_chunker.chunk_text.return_value = ["Chunk 1", "Chunk 2"]
    mock_embedder.process_document.side_effect = ConnectionError("Ollama fora do ar")

    service = DocumentService(
        repository=mock_repo,
        storage=mock_storage,
        parser=mock_parser,
        chunker=mock_chunker,
        embedder=mock_embedder,
    )

    doc_id = uuid.uuid4()
    file_path = "caminhos/falso_documento.pdf"

    service._run_pipeline(document_id=doc_id, file_path=file_path)

    mock_repo.update_status.assert_called_with(
        document_id=doc_id,
        status=DocumentStatus.ERROR,
    )


def test_background_pipeline_success_flow():
    """
    Garante que quando todas as etapas são bem-sucedidas, o status final é COMPLETED.
    """
    mock_repo = MagicMock()
    mock_storage = MagicMock()
    mock_parser = MagicMock()
    mock_chunker = MagicMock()
    mock_embedder = MagicMock()

    mock_parser.extract_text.return_value = "Texto extraído com sucesso"
    mock_chunker.chunk_text.return_value = ["Chunk 1", "Chunk 2"]

    service = DocumentService(
        repository=mock_repo,
        storage=mock_storage,
        parser=mock_parser,
        chunker=mock_chunker,
        embedder=mock_embedder,
    )

    doc_id = uuid.uuid4()
    file_path = "caminhos/falso_documento.pdf"

    service._run_pipeline(document_id=doc_id, file_path=file_path)

    mock_embedder.process_document.assert_called_once_with(doc_id)
    mock_repo.update_status.assert_called_with(
        document_id=doc_id,
        status=DocumentStatus.COMPLETED,
    )