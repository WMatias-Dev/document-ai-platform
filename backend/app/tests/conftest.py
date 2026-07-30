import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database.base import Base
from app.database.models.user import User

DATABASE_TEST_URL = (
    "postgresql://admin:admin"
    "@localhost:5433/documents_test"
)

engine_test = create_engine(
    DATABASE_TEST_URL
)

TestingSessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine_test,
)

@pytest.fixture()
def db_session():
    Base.metadata.create_all(
        bind=engine_test
    )

    session = TestingSessionLocal()

    try:
        yield session

    finally:
        session.close()

        Base.metadata.drop_all(
            bind=engine_test
        )