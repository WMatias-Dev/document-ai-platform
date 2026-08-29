import pytest
from unittest.mock import MagicMock
from app.services.rerank_service import RerankService


def test_rerank_service_empty_candidates():
    service = RerankService()
    results = service.rerank(query="qualquer query", candidates=[], top_n=5)
    assert results == []


def test_rerank_service_fallback_when_unavailable():
    service = RerankService()
    service.is_available = False
    service.ranker = None

    candidates = [
        {"id": "1", "text": "Primeiro chunk"},
        {"id": "2", "text": "Segundo chunk"},
        {"id": "3", "text": "Terceiro chunk"},
    ]

    results = service.rerank(query="teste", candidates=candidates, top_n=2)
    assert len(results) == 2
    assert results[0]["id"] == "1"
    assert results[1]["id"] == "2"


def test_rerank_service_actual_cross_encoder_scoring():
    service = RerankService()
    
    candidates = [
        {"id": "1", "text": "O clima hoje está ensolarado e a temperatura é de 28 graus na praia."},
        {"id": "2", "text": "A taxa de juros do contrato de financiamento foi fixada em 12% ao ano."},
        {"id": "3", "text": "O prazo limite para pagamento da parcela sem juros é dia 10 de cada mês."},
    ]

    # Query específica sobre contrato financeiro
    results = service.rerank(
        query="Qual é a taxa de juros anual do contrato?",
        candidates=candidates,
        top_n=2
    )

    assert len(results) <= 2
    # O chunk 2 deve ser o primeiro colocado por ser a resposta exata
    assert results[0]["id"] == "2"
    assert "rerank_score" in results[0]
    assert results[0]["rerank_score"] > 0
