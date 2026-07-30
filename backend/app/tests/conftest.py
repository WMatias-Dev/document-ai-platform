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
    autocommit=false,
    autoflush=false,
)