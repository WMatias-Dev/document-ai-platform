import pytest
from app.evaluation.metrics import (
    calculate_mrr_at_k,
    calculate_percentiles,
    calculate_recall_at_k,
    calculate_reliability_stats,
    is_chunk_relevant,
)


def test_is_chunk_relevant_exact_and_partial():
    canonical = ["vigência inicial de 12 meses", "aviso prévio de 30 dias"]

    # Match com substring
    chunk_1 = "O contrato terá vigência inicial de 12 meses a contar da data."
    assert is_chunk_relevant(chunk_1, canonical) is True

    # Match irrelevante
    chunk_2 = "O pagamento será efetuado em conta bancária todo dia 10."
    assert is_chunk_relevant(chunk_2, canonical) is False

    # Vazio
    assert is_chunk_relevant("", canonical) is False
    assert is_chunk_relevant(chunk_1, []) is False


def test_recall_at_5_deterministic():
    canonical = ["cláusula de rescisão", "multa de 20%"]

    # Caso 1: Ambos os snippets encontrados no top 2 -> Recall 1.0
    chunks_ideal = [
        "Aqui está a cláusula de rescisão contratual.",
        "Aplica-se multa de 20% sobre as parcelas vincendas.",
        "Texto extra 1",
        "Texto extra 2",
        "Texto extra 3",
    ]
    assert calculate_recall_at_k(chunks_ideal, canonical, k=5) == 1.0

    # Caso 2: Apenas 1 dos 2 snippets no top 5 -> Recall 0.5
    chunks_partial = [
        "Texto irrelevante",
        "Aqui está a cláusula de rescisão contratual.",
        "Texto irrelevante 2",
        "Texto irrelevante 3",
        "Texto irrelevante 4",
    ]
    assert calculate_recall_at_k(chunks_partial, canonical, k=5) == 0.5

    # Caso 3: Snippet aparece na posição 6 (fora do top 5) -> Recall 0.0
    chunks_outside_top5 = [
        "Irrelevante 1",
        "Irrelevante 2",
        "Irrelevante 3",
        "Irrelevante 4",
        "Irrelevante 5",
        "cláusula de rescisão",
    ]
    assert calculate_recall_at_k(chunks_outside_top5, canonical, k=5) == 0.0

    # Caso 4: Nenhum resultado recuperado
    assert calculate_recall_at_k([], canonical, k=5) == 0.0


def test_mrr_at_5_deterministic():
    canonical = ["prazo de entrega de 15 dias"]

    # Posição 1 -> MRR = 1/1 = 1.0
    c_pos1 = ["O prazo de entrega de 15 dias úteis.", "outro", "outro", "outro", "outro"]
    assert calculate_mrr_at_k(c_pos1, canonical, k=5) == 1.0

    # Posição 2 -> MRR = 1/2 = 0.5
    c_pos2 = ["outro", "O prazo de entrega de 15 dias úteis.", "outro", "outro", "outro"]
    assert calculate_mrr_at_k(c_pos2, canonical, k=5) == 0.5

    # Posição 5 -> MRR = 1/5 = 0.2
    c_pos5 = ["outro 1", "outro 2", "outro 3", "outro 4", "O prazo de entrega de 15 dias úteis."]
    assert calculate_mrr_at_k(c_pos5, canonical, k=5) == 0.2

    # Fora do top 5 (Posição 6) -> MRR = 0.0
    c_pos6 = ["outro 1", "outro 2", "outro 3", "outro 4", "outro 5", "prazo de entrega de 15 dias"]
    assert calculate_mrr_at_k(c_pos6, canonical, k=5) == 0.0

    # Nenhum relevante
    assert calculate_mrr_at_k(["abc", "def"], canonical, k=5) == 0.0


def test_percentiles_deterministic():
    # Dataset conhecido
    latencies = [10.0, 20.0, 30.0, 40.0, 50.0, 60.0, 70.0, 80.0, 90.0, 100.0]
    res = calculate_percentiles(latencies)

    assert res["count"] == 10
    assert res["min"] == 10.0
    assert res["max"] == 100.0
    assert res["mean"] == 55.0
    assert res["p50"] == 55.0
    assert res["p95"] == 95.5

    # Dataset vazio
    empty_res = calculate_percentiles([])
    assert empty_res["count"] == 0
    assert empty_res["p50"] is None
    assert empty_res["p95"] is None


def test_reliability_stats_deterministic():
    res = calculate_reliability_stats(
        total_requests=10,
        successful_requests=8,
        failed_requests=2,
        empty_retrievals=1,
        error_breakdown={"llm_error": 1, "timeout": 1},
    )

    assert res["total_requests"] == 10
    assert res["success_rate"] == 0.8
    assert res["error_rate"] == 0.2
    assert res["empty_retrieval_rate"] == 0.1
    assert res["error_breakdown"]["llm_error"] == 1

    # Zero requests
    zero_res = calculate_reliability_stats(0, 0, 0, 0)
    assert zero_res["total_requests"] == 0
    assert zero_res["success_rate"] is None
