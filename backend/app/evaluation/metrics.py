import math
import re
from typing import Any, Dict, List, Optional, Set, Tuple


def _normalize_text(text: str) -> str:
    """Normaliza o texto removendo pontuação e espaços múltiplos para comparação robusta."""
    if not text:
        return ""
    text = text.lower()
    text = re.sub(r"[^\w\s]", " ", text)
    return " ".join(text.split())


def _token_jaccard_similarity(text_a: str, text_b: str) -> float:
    """Calcula a similaridade de Jaccard baseada em tokens normalizados."""
    tokens_a: Set[str] = set(_normalize_text(text_a).split())
    tokens_b: Set[str] = set(_normalize_text(text_b).split())

    if not tokens_a or not tokens_b:
        return 0.0

    intersection = len(tokens_a.intersection(tokens_b))
    union = len(tokens_a.union(tokens_b))
    return intersection / union if union > 0 else 0.0


def _substring_overlap_ratio(snippet: str, chunk_text: str) -> float:
    """
    Verifica a proporção de palavras-chave do snippet canônico presentes no chunk recuperado.
    Permite match exato ou sobreposição semântica estrutural sem quebrar por chunk_size.
    """
    norm_snippet = _normalize_text(snippet)
    norm_chunk = _normalize_text(chunk_text)

    if not norm_snippet or not norm_chunk:
        return 0.0

    # Substring literal contida
    if norm_snippet in norm_chunk:
        return 1.0

    # Match por contenção de tokens canônicos
    snippet_tokens = norm_snippet.split()
    if not snippet_tokens:
        return 0.0

    chunk_tokens_set = set(norm_chunk.split())
    matches = sum(1 for token in snippet_tokens if token in chunk_tokens_set)
    return matches / len(snippet_tokens)


def is_chunk_relevant(
    chunk_text: str,
    canonical_snippets: List[str],
    token_overlap_threshold: float = 0.65,
) -> bool:
    """
    Determina de forma determinística se um chunk recuperado é relevante para a pergunta,
    comparando-o com os snippets de texto canônicos do Ground Truth.
    """
    if not chunk_text or not canonical_snippets:
        return False

    for snippet in canonical_snippets:
        ratio = _substring_overlap_ratio(snippet, chunk_text)
        if ratio >= token_overlap_threshold:
            return True

        jaccard = _token_jaccard_similarity(snippet, chunk_text)
        if jaccard >= 0.50:
            return True

    return False


def calculate_recall_at_k(
    retrieved_chunks: List[str],
    canonical_snippets: List[str],
    k: int = 5,
    token_overlap_threshold: float = 0.65,
) -> float:
    """
    Calcula Recall@K: Proporção de snippets canônicos essenciais presentes
    dentre os K primeiros chunks recuperados.
    
    Retorna 1.0 se todos os snippets foram cobertos no top-k, ou a fração correspondente.
    Se não houver snippets canônicos definidos, retorna 0.0.
    """
    if not canonical_snippets:
        return 0.0

    top_k_chunks = retrieved_chunks[:k]
    if not top_k_chunks:
        return 0.0

    covered_snippets_count = 0
    for snippet in canonical_snippets:
        snippet_found = False
        for chunk in top_k_chunks:
            if is_chunk_relevant(chunk, [snippet], token_overlap_threshold):
                snippet_found = True
                break
        if snippet_found:
            covered_snippets_count += 1

    return covered_snippets_count / len(canonical_snippets)


def calculate_mrr_at_k(
    retrieved_chunks: List[str],
    canonical_snippets: List[str],
    k: int = 5,
    token_overlap_threshold: float = 0.65,
) -> float:
    """
    Calcula Mean Reciprocal Rank (MRR@K) para uma query individual:
    1 / (posição do primeiro chunk relevante no top-K), indexado em 1.
    Retorna 0.0 se nenhum chunk relevante estiver no top-K.
    """
    if not canonical_snippets or not retrieved_chunks:
        return 0.0

    top_k_chunks = retrieved_chunks[:k]
    for rank, chunk in enumerate(top_k_chunks, start=1):
        if is_chunk_relevant(chunk, canonical_snippets, token_overlap_threshold):
            return 1.0 / rank

    return 0.0


def calculate_percentiles(values: List[float]) -> Dict[str, Optional[float]]:
    """
    Calcula percentis reais (P50, P95, P99), média, mínimo e máximo.
    Retorna None para métricas com dados insuficientes em vez de inventar números.
    """
    if not values:
        return {
            "count": 0,
            "p50": None,
            "p95": None,
            "p99": None,
            "mean": None,
            "min": None,
            "max": None,
        }

    sorted_vals = sorted(values)
    n = len(sorted_vals)

    def _get_percentile(p: float) -> float:
        if n == 1:
            return round(sorted_vals[0], 4)
        k = (n - 1) * (p / 100.0)
        f = math.floor(k)
        c = math.ceil(k)
        if f == c:
            return round(sorted_vals[int(k)], 4)
        d0 = sorted_vals[int(f)] * (c - k)
        d1 = sorted_vals[int(c)] * (k - f)
        return round(d0 + d1, 4)

    mean_val = round(sum(sorted_vals) / n, 4)

    return {
        "count": n,
        "p50": _get_percentile(50),
        "p95": _get_percentile(95),
        "p99": _get_percentile(99),
        "mean": mean_val,
        "min": round(sorted_vals[0], 4),
        "max": round(sorted_vals[-1], 4),
    }


def calculate_reliability_stats(
    total_requests: int,
    successful_requests: int,
    failed_requests: int,
    empty_retrievals: int,
    error_breakdown: Optional[Dict[str, int]] = None,
) -> Dict[str, Any]:
    """
    Calcula taxas reais de confiabilidade do RAG:
    - Success Rate: successful / total
    - Error Rate: failed / total
    - Empty Retrieval Rate: empty / total
    """
    if total_requests <= 0:
        return {
            "total_requests": 0,
            "success_rate": None,
            "error_rate": None,
            "empty_retrieval_rate": None,
            "error_breakdown": error_breakdown or {},
        }

    return {
        "total_requests": total_requests,
        "successful_requests": successful_requests,
        "failed_requests": failed_requests,
        "empty_retrievals": empty_retrievals,
        "success_rate": round(successful_requests / total_requests, 4),
        "error_rate": round(failed_requests / total_requests, 4),
        "empty_retrieval_rate": round(empty_retrievals / total_requests, 4),
        "error_breakdown": error_breakdown or {},
    }
