from app.repositories.user_repository import UserRepository

def test_create_user(db_session):

    repository = UserRepository(
        db_session
    )

    user = repository.create(
        name="Jõao",
        email="joao@test.com",
        password_hash="hash123",
    )

    assert user.id is not None
    assert user.email == "joao@test.com"