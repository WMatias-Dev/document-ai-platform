from fastapi import status

# 1. Teste de Fluxo
def test_create_document_authenticated(client, user_token_headers):
    # O user_token_headers já injeta o JWT no cabeçalho da requisição
    payload = {"title": "Meu Primeiro PDF", "content": "Texto do documento"}
    
    response = client.post("/documents/", json=payload, headers=user_token_headers)
    
    assert response.status_code == status.HTTP_201_CREATED
    data = response.json()
    assert data["title"] == "Meu Primeiro PDF"
    assert "id" in data
    assert "owner_id" in data

# 2. Teste de Segurança a acesso sem token
def test_create_document_unauthenticated(client):
    payload = {"title": "Documento Invasor"}
    
    # Tentando acessar a rota sem enviar o cabeçalho de autenticação
    response = client.post("/documents/", json=payload)
    
    assert response.status_code == status.HTTP_401_UNAUTHORIZED

# 3. Teste de Segurança do isolamento de Dados (Bloqueio 403)
def test_cannot_access_other_user_document(client, user_token_headers, other_user_token_headers):
    # Usuário A cria um documento
    create_response = client.post(
        "/documents/", 
        json={"title": "Doc do Usuário A"}, 
        headers=user_token_headers
    )
    document_id = create_response.json()["id"]

    # Usuário B tenta acessar o documento do Usuário A
    malicious_response = client.get(
        f"/documents/{document_id}", 
        headers=other_user_token_headers
    )
    
    # O serviço deve bloquear a ação retornando 403 Forbidden
    assert malicious_response.status_code == status.HTTP_403_FORBIDDEN
    assert malicious_response.json()["detail"] == "Você não tem permissão para acessar este documento."

# 4. Teste de Comportamento: Recurso Inexistente (404)
def test_get_nonexistent_document(client, user_token_headers):
    import uuid
    fake_id = str(uuid.uuid4())
    
    response = client.get(f"/documents/{fake_id}", headers=user_token_headers)
    
    assert response.status_code == status.HTTP_404_NOT_FOUND