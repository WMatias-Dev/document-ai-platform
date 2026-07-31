from fastapi.testclient import TestClient

from app.main import app
from app.api.routes_users import get_db

from app.tests.conftest import TestingSessionLocal
from app.database.base import Base
from app.tests.conftest import engine_test


def override_get_db():
    db = TestingSessionLocal()

    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


client = TestClient(app)


def test_register_user():

    Base.metadata.create_all(bind=engine_test)

    response = client.post(
        "/users/register",
        json={
            "name": "João API",
            "email": "joao.api@test.com",
            "password": "123456"
        }
    )

    assert response.status_code == 200

    data = response.json()

    assert data["email"] == "joao.api@test.com"