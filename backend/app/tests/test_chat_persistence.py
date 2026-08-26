import uuid
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database.base import Base
from app.database.models.user import User
from app.database.models.notebook import Notebook
from app.database.models.chat_thread import ChatThread
from app.database.models.chat_message import ChatMessage
from app.repositories.chat_repository import ChatRepository


@pytest.fixture
def db_session():
    # SQLite em memória para teste isolado
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()

    # Cria usuário de teste
    test_user = User(
        id=uuid.uuid4(),
        name="Tester",
        email="test@documentai.com",
        password_hash="fakehash12345678",
    )
    session.add(test_user)

    # Cria caderno de teste
    test_notebook = Notebook(
        id=uuid.uuid4(),
        title="Caderno de Testes",
        owner_id=test_user.id,
    )
    session.add(test_notebook)
    session.commit()

    yield session
    session.close()


def test_chat_thread_creation_and_persistence(db_session):
    repo = ChatRepository(db_session)
    user = db_session.query(User).first()
    notebook = db_session.query(Notebook).first()

    # 1. Cria ou obtém thread
    thread = repo.get_or_create_thread(
        owner_id=user.id,
        notebook_id=notebook.id,
        title="Dúvida Contratual",
    )

    assert thread.id is not None
    assert thread.title == "Dúvida Contratual"
    assert thread.notebook_id == notebook.id
    assert thread.owner_id == user.id

    # 2. Adiciona mensagem do usuário
    user_msg = repo.add_message(
        thread_id=thread.id,
        role="user",
        content="Qual a vigência do contrato?",
    )
    assert user_msg.role == "user"
    assert user_msg.content == "Qual a vigência do contrato?"

    # 3. Adiciona mensagem do assistente com citações
    citations = [
        {
            "chunk_id": str(uuid.uuid4()),
            "document_title": "Contrato.pdf",
            "chunk_index": 1,
            "text_snippet": "Prazo de 12 meses",
            "similarity_score": 0.89,
        }
    ]
    assistant_msg = repo.add_message(
        thread_id=thread.id,
        role="assistant",
        content="A vigência é de 12 meses.",
        citations=citations,
        model_used="gemini-3.7-flash",
    )
    assert assistant_msg.role == "assistant"
    assert len(assistant_msg.citations) == 1

    # 4. Recupera histórico completo da thread
    messages = repo.get_thread_messages(thread_id=thread.id, owner_id=user.id)
    assert len(messages) == 2
    assert messages[0].role == "user"
    assert messages[1].role == "assistant"
    assert messages[1].citations[0]["document_title"] == "Contrato.pdf"
