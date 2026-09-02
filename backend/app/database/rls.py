"""
Módulo de RLS desativado.
O isolamento multi-tenant da plataforma é garantido pela camada de aplicação
via cláusulas explícitas 'WHERE owner_id = :current_user_id' nos repositórios e serviços.
"""
import logging
from sqlalchemy.engine import Engine

logger = logging.getLogger(__name__)


def setup_row_level_security(engine: Engine) -> None:
    """Função legada mantida como no-op para retrocompatibilidade."""
    logger.debug("[RLS] Row-Level Security desativado em favor do isolamento explícito na camada de aplicação.")
