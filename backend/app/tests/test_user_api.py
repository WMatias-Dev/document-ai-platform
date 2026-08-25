def test_register_user(client):
    response = client.post(
        "/users/register",
        json={
            "name": "João API",
            "email": "joao.api@test.com",
            "password": "123456",
        },
    )

    assert response.status_code == 200

    data = response.json()
    assert data["email"] == "joao.api@test.com"