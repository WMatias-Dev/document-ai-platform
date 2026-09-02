import uuid
import pytest
from fastapi import HTTPException
from app.database.models.document import Document
from app.database.models.user import User
from app.services.document_service import DocumentService
from unittest.mock import MagicMock


def test_tenant_isolation_prevents_cross_user_access():
    """
    Valida que a camada de aplicação impede que o Usuário B acesse documentos do Usuário A.
    """
    user_a_id = uuid.uuid4()
    user_b_id = uuid.uuid4()
    doc_id = uuid.uuid4()

    user_a = User(id=user_a_id, name="Usuário A", email="a@test.com", password_hash="hash")
    user_b = User(id=user_b_id, name="Usuário B", email="b@test.com", password_hash="hash")

    doc_a = Document(id=doc_id, title="Doc Confidencial A.pdf", owner_id=user_a_id)

    mock_repo = MagicMock()
    mock_repo.get_by_id.return_value = doc_a

    service = DocumentService(
        repository=mock_repo,
        storage=MagicMock(),
        parser=MagicMock(),
        chunker=MagicMock(),
        embedder=MagicMock(),
    )

    # Usuário A pode acessar seu próprio documento
    doc = service.get_document(document_id=doc_id, current_user=user_a)
    assert doc.id == doc_id
    assert doc.owner_id == user_a_id

    # Usuário B é barrado com 403 Forbidden
    with pytest.raises(HTTPException) as exc_info:
        service.get_document(document_id=doc_id, current_user=user_b)

    assert exc_info.value.status_code == 403
