import uuid
from fastapi import status


def test_create_document_authenticated(client, user_token_headers):
    fake_file = {
        "file": ("meu_primeiro_pdf.pdf", b"Conteudo falso do PDF", "application/pdf")
    }

    response = client.post(
        "/documents/upload", files=fake_file, headers=user_token_headers
    )

    assert response.status_code == status.HTTP_202_ACCEPTED

    data = response.json()
    assert "document_id" in data
    assert data["status"] == "processing"


def test_create_document_unauthenticated(client):
    payload = {
        "title": "Documento Invasor",
        "filename": "meu_arquivo.pdf",
    }

    response = client.post("/documents/", json=payload)

    assert response.status_code == status.HTTP_401_UNAUTHORIZED


def test_cannot_access_other_user_document(
    client, user_token_headers, other_user_token_headers
):
    # Usuário A faz o upload
    fake_file = {
        "file": ("doc_usuario_A.pdf", b"Conteudo A", "application/pdf")
    }

    create_response = client.post(
        "/documents/upload", files=fake_file, headers=user_token_headers
    )
    assert create_response.status_code == status.HTTP_202_ACCEPTED

    document_id = create_response.json()["document_id"]

    # Usuário B tenta acessar o documento do Usuário A
    malicious_response = client.get(
        f"/documents/{document_id}", headers=other_user_token_headers
    )

    assert malicious_response.status_code in [
        status.HTTP_403_FORBIDDEN,
        status.HTTP_404_NOT_FOUND,
    ]


def test_get_nonexistent_document(client, user_token_headers):
    fake_id = str(uuid.uuid4())

    response = client.get(f"/documents/{fake_id}", headers=user_token_headers)

    assert response.status_code == status.HTTP_404_NOT_FOUND