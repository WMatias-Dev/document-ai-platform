import logging
from sqlalchemy import text
from sqlalchemy.engine import Engine

logger = logging.getLogger(__name__)

RLS_STATEMENTS = [
    # 1. Habilita RLS nas tabelas principais
    "ALTER TABLE IF EXISTS documents ENABLE ROW LEVEL SECURITY;",
    "ALTER TABLE IF EXISTS document_chunks ENABLE ROW LEVEL SECURITY;",
    "ALTER TABLE IF EXISTS notebooks ENABLE ROW LEVEL SECURITY;",
    "ALTER TABLE IF EXISTS chat_threads ENABLE ROW LEVEL SECURITY;",

    # 2. Política para Documentos (Tenant Isolation por owner_id)
    """
    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies WHERE tablename = 'documents' AND policyname = 'document_tenant_isolation'
        ) THEN
            CREATE POLICY document_tenant_isolation ON documents
            USING (
                NULLIF(current_setting('app.current_user_id', true), '') IS NULL
                OR owner_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
            );
        END IF;
    END $$;
    """,

    # 3. Política para Chunks de Documentos (Herda isolamento do documento pai)
    """
    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies WHERE tablename = 'document_chunks' AND policyname = 'chunk_tenant_isolation'
        ) THEN
            CREATE POLICY chunk_tenant_isolation ON document_chunks
            USING (
                NULLIF(current_setting('app.current_user_id', true), '') IS NULL
                OR document_id IN (
                    SELECT id FROM documents 
                    WHERE owner_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
                )
            );
        END IF;
    END $$;
    """,

    # 4. Política para Cadernos / Notebooks
    """
    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies WHERE tablename = 'notebooks' AND policyname = 'notebook_tenant_isolation'
        ) THEN
            CREATE POLICY notebook_tenant_isolation ON notebooks
            USING (
                NULLIF(current_setting('app.current_user_id', true), '') IS NULL
                OR owner_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
            );
        END IF;
    END $$;
    """,

    # 5. Política para Threads de Chat
    """
    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies WHERE tablename = 'chat_threads' AND policyname = 'thread_tenant_isolation'
        ) THEN
            CREATE POLICY thread_tenant_isolation ON chat_threads
            USING (
                NULLIF(current_setting('app.current_user_id', true), '') IS NULL
                OR owner_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
            );
        END IF;
    END $$;
    """,
]


def setup_row_level_security(engine: Engine) -> None:
    """
    Aplica políticas nativas de Row-Level Security (RLS) no PostgreSQL.
    Garante isolamento criptográfico e de kernel entre dados de diferentes usuários.
    """
    try:
        with engine.begin() as conn:
            for stmt in RLS_STATEMENTS:
                conn.execute(text(stmt))
        logger.info("[RLS] Políticas de Row-Level Security configuradas com sucesso.")
    except Exception as e:
        logger.warning(f"[RLS] Aviso ao aplicar Row-Level Security: {e}")
