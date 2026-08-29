from unittest.mock import MagicMock
from app.database.rls import setup_row_level_security, RLS_STATEMENTS


def test_setup_row_level_security_executes_all_policies():
    mock_engine = MagicMock()
    mock_conn = MagicMock()
    mock_engine.begin.return_value.__enter__.return_value = mock_conn

    setup_row_level_security(mock_engine)

    # Verifica se todas as statements de RLS foram executadas
    assert mock_conn.execute.call_count == len(RLS_STATEMENTS)


def test_rls_statements_contain_tenant_isolation_policies():
    combined = " ".join(RLS_STATEMENTS)
    assert "ENABLE ROW LEVEL SECURITY" in combined
    assert "document_tenant_isolation" in combined
    assert "chunk_tenant_isolation" in combined
    assert "notebook_tenant_isolation" in combined
    assert "thread_tenant_isolation" in combined
    assert "app.current_user_id" in combined
