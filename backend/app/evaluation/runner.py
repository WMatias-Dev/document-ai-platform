import argparse
import json
import logging
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional

from app.core.config import settings
from app.database.connection import SessionLocal
from app.database.dependencies import get_document_service
from app.database.models.user import User
from app.evaluation.judges import AnswerRelevancyEvaluator, FaithfulnessEvaluator, is_valid_refusal
from app.evaluation.metrics import (
    calculate_mrr_at_k,
    calculate_percentiles,
    calculate_recall_at_k,
    calculate_reliability_stats,
)
from app.evaluation.schemas import (
    EvaluationRun,
    EvaluationTrace,
    LatencyBreakdown,
    PerformanceMetrics,
    PipelineLatencyMetrics,
    RAGQualityMetrics,
    ReliabilityMetrics,
)
from app.evaluation.storage import EvaluationStorage
from app.repositories.user_repository import UserRepository
from app.schemas.document_schema import DocumentSearchRequest
from app.services.ai_service import AIService
from app.services.document_service import DocumentService

logging.basicConfig(level=logging.INFO, format="%(asctime)s - [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)


def _warmup_pipeline(ai_service: AIService) -> None:
    """
    Executa uma requisição de aquecimento (warm-up) para inicializar a conexão SSL/TLS
    com a API do Gemini e carregar os pesos na memória, eliminando a latência de Cold Start.
    """
    logger.info("[Warmup] Executando requisição de aquecimento para eliminar Cold Start...")
    try:
        t0 = time.perf_counter()
        ai_service.generate_response(
            prompt="Responda apenas com 'OK'.",
            system_instruction="Sistema de warm-up.",
        )
        t_warmup = (time.perf_counter() - t0) * 1000.0
        logger.info(f"[Warmup] Conexão aquecida em {t_warmup:.1f}ms. Iniciando benchmark oficial.")
    except Exception as e:
        logger.warning(f"[Warmup] Falha no warm-up (prosseguindo mesmo assim): {e}")


def run_evaluation(
    dataset_path: Path,
    run_name: str = "Evaluation Run",
    is_baseline: bool = False,
    top_k: int = 5,
    evaluate_llm_judges: bool = True,
    custom_run_id: Optional[str] = None,
    perform_warmup: bool = True,
    current_user: Optional[User] = None,
    document_service: Optional[DocumentService] = None,
) -> EvaluationRun:
    """
    Executa a avaliação REAL do RAG sobre um dataset canônico de ground truth,
    medindo busca híbrida e reranking reais, cronometrando latências exatas e avaliando com juízes LLM.
    """
    if not dataset_path.exists():
        raise FileNotFoundError(f"Dataset não encontrado em: {dataset_path}")

    with open(dataset_path, "r", encoding="utf-8") as f:
        test_cases = json.load(f)

    logger.info(f"Iniciando avaliação real: '{run_name}' | Casos: {len(test_cases)} | Top-K: {top_k}")

    db = None
    created_db = False
    doc_service = document_service

    # Inicializa sessão e serviço de busca real caso não tenham sido injetados
    if doc_service is None:
        try:
            db = SessionLocal()
            created_db = True
            doc_service = get_document_service(db=db)
        except Exception as db_err:
            logger.warning(f"[run_evaluation] Não foi possível conectar ao banco de dados: {db_err}. Operando em modo de contingência.")
            doc_service = None

    # Determina o usuário para contexto de busca
    eval_user = current_user
    if eval_user is None and db is not None:
        try:
            user_repo = UserRepository(db)
            eval_user = user_repo.get_by_email("admin@test.com")
            if not eval_user:
                users = db.query(User).limit(1).all()
                eval_user = users[0] if users else None
        except Exception:
            eval_user = None

    if eval_user is None:
        eval_user = User(
            id=uuid.UUID("00000000-0000-0000-0000-000000000001"),
            email="eval_runner@platform.local",
            name="Evaluation Runner User",
            password_hash="eval_hash",
        )

    ai_service = AIService()

    # 1. Warm-up automático de conexão
    if perform_warmup:
        _warmup_pipeline(ai_service)

    faithfulness_judge = FaithfulnessEvaluator(ai_service=ai_service)
    relevancy_judge = AnswerRelevancyEvaluator(ai_service=ai_service)

    traces: List[EvaluationTrace] = []
    total_latencies: List[float] = []
    retrieval_latencies: List[float] = []
    generation_latencies: List[float] = []
    recalls: List[float] = []
    mrrs: List[float] = []
    faithfulness_scores: List[float] = []
    relevancy_scores: List[float] = []

    successful_count = 0
    failed_count = 0
    empty_retrieval_count = 0
    error_breakdown: Dict[str, int] = {}

    try:
        for idx, case in enumerate(test_cases, 1):
            q_id = case.get("id", f"q-{idx}")
            question = case["question"]
            expected_answer = case.get("expected_answer")
            canonical_snippets = case.get("canonical_text_snippets", [])

            logger.info(f"[{idx}/{len(test_cases)}] Executando caso {q_id}: '{question[:50]}...'")

            # Pausa para controle de taxa
            if idx > 1:
                time.sleep(0.3)

            t_total_start = time.perf_counter()

            # 2. Retrieval REAL com cronometragem de alta precisão
            t_ret_start = time.perf_counter()
            retrieved_chunks: List[str] = []

            if doc_service is not None:
                try:
                    search_req = DocumentSearchRequest(
                        query=question,
                        limit=top_k,
                    )
                    search_resp = doc_service.search_documents(
                        search_in=search_req,
                        current_user=eval_user,
                    )
                    retrieved_chunks = [item.text_content for item in search_resp.results]
                except Exception as search_err:
                    logger.warning(f"Falha na busca real para {q_id}: {search_err}")
                    retrieved_chunks = []
            else:
                logger.warning(f"DocumentService indisponível; retrieval vazio para {q_id}.")
                retrieved_chunks = []

            t_ret_end = time.perf_counter()
            ret_latency_ms = round((t_ret_end - t_ret_start) * 1000.0, 2)
            retrieval_latencies.append(ret_latency_ms)

            if not retrieved_chunks:
                empty_retrieval_count += 1

            # 3. Geração LLM Real com Gemini
            t_gen_start = time.perf_counter()
            if retrieved_chunks:
                context_str = "\n".join(f"- {c}" for c in retrieved_chunks)
            else:
                context_str = "Nenhum documento relevante encontrado para esta consulta."

            prompt = (
                f"Contexto dos Documentos:\n{context_str}\n\n"
                f"Pergunta: {question}\n\n"
                f"Resposta fundamentada:"
            )

            try:
                generated_answer = ai_service.generate_response(
                    prompt=prompt,
                    system_instruction="Responda estritamente com base nas cláusulas explícitas do contexto fornecido em Português. Não deduza fatos não descritos.",
                )
                status = "SUCCESS"
                successful_count += 1
                error_type = None
                error_msg = None
            except Exception as e:
                generated_answer = ""
                status = "ERROR"
                failed_count += 1
                error_type = "llm_error"
                error_msg = str(e)
                error_breakdown[error_type] = error_breakdown.get(error_type, 0) + 1
                logger.error(f"Erro ao gerar resposta LLM para {q_id}: {e}")

            t_gen_end = time.perf_counter()
            gen_latency_ms = round((t_gen_end - t_gen_start) * 1000.0, 2)
            generation_latencies.append(gen_latency_ms)

            t_total_end = time.perf_counter()
            total_latency_ms = round((t_total_end - t_total_start) * 1000.0, 2)
            total_latencies.append(total_latency_ms)

            # 4. Cálculo de Métricas com penalização estrita de falhas
            if status == "ERROR":
                recall = 0.0
                mrr = 0.0
                faith_score = 0.0
                rel_score = 0.0
            else:
                # Métricas de Retrieval reais
                if canonical_snippets:
                    recall = calculate_recall_at_k(retrieved_chunks, canonical_snippets, k=top_k)
                    mrr = calculate_mrr_at_k(retrieved_chunks, canonical_snippets, k=top_k)
                else:
                    # Caso negativo (out of scope): se o modelo fez recusa correta, pontua 1.0
                    recall = 1.0 if is_valid_refusal(generated_answer) else 0.0
                    mrr = 1.0 if is_valid_refusal(generated_answer) else 0.0

                # 5. Juízes de Qualidade (Faithfulness & Answer Relevancy)
                faith_score = None
                rel_score = None
                if evaluate_llm_judges:
                    faith_res = faithfulness_judge.evaluate(
                        answer=generated_answer,
                        context_chunks=retrieved_chunks,
                    )
                    faith_score = faith_res.get("score", 0.0)

                    rel_res = relevancy_judge.evaluate(
                        question=question,
                        answer=generated_answer,
                    )
                    rel_score = rel_res.get("score", 0.0)

            recalls.append(recall)
            mrrs.append(mrr)
            if faith_score is not None:
                faithfulness_scores.append(faith_score)
            if rel_score is not None:
                relevancy_scores.append(rel_score)

            traces.append(
                EvaluationTrace(
                    query_id=q_id,
                    question=question,
                    expected_answer=expected_answer,
                    generated_answer=generated_answer,
                    model_used=str(getattr(ai_service, "model_name", "gemini") or "gemini"),
                    retrieved_chunk_count=len(retrieved_chunks),
                    retrieved_snippets=retrieved_chunks,
                    recall_at_5=round(recall, 4),
                    mrr_at_5=round(mrr, 4),
                    faithfulness_score=faith_score,
                    answer_relevancy_score=rel_score,
                    latency=LatencyBreakdown(
                        total_latency_ms=total_latency_ms,
                        retrieval_latency_ms=ret_latency_ms,
                        llm_generation_latency_ms=gen_latency_ms,
                    ),
                    status=status,
                    error_type=error_type,
                    error_message=error_msg,
                )
            )

    finally:
        if created_db and db is not None:
            try:
                db.close()
            except Exception:
                pass

    # 6. Agregação Estatística Consolidada
    perf_stats = calculate_percentiles(total_latencies)
    reliability_stats = calculate_reliability_stats(
        total_requests=len(test_cases),
        successful_requests=successful_count,
        failed_requests=failed_count,
        empty_retrievals=empty_retrieval_count,
        error_breakdown=error_breakdown,
    )

    avg_recall = round(sum(recalls) / len(recalls), 4) if recalls else None
    avg_mrr = round(sum(mrrs) / len(mrrs), 4) if mrrs else None
    avg_faith = round(sum(faithfulness_scores) / len(faithfulness_scores), 4) if faithfulness_scores else None
    avg_rel = round(sum(relevancy_scores) / len(relevancy_scores), 4) if relevancy_scores else None

    now_utc = datetime.now(timezone.utc)
    run_id = custom_run_id or f"run-{now_utc.strftime('%Y%m%d-%H%M%S')}-{uuid.uuid4().hex[:6]}"

    eval_run = EvaluationRun(
        run_id=run_id,
        name=run_name,
        is_baseline=is_baseline,
        timestamp=now_utc.isoformat(),
        dataset_version=dataset_path.stem,
        dataset_size=len(test_cases),
        model_name=str(getattr(ai_service, "model_name", "gemini") or "gemini"),
        embedding_model=getattr(settings, "OLLAMA_EMBED_MODEL", "nomic-embed-text"),
        chunk_size=1000,
        chunk_overlap=200,
        top_k=top_k,
        rag_quality=RAGQualityMetrics(
            recall_at_5=avg_recall,
            mrr_at_5=avg_mrr,
            faithfulness=avg_faith,
            answer_relevancy=avg_rel,
        ),
        performance=PerformanceMetrics(
            sample_count=perf_stats["count"],
            p50_ms=perf_stats["p50"],
            p95_ms=perf_stats["p95"],
            p99_ms=perf_stats["p99"],
            mean_ms=perf_stats["mean"],
            min_ms=perf_stats["min"],
            max_ms=perf_stats["max"],
        ),
        pipeline=PipelineLatencyMetrics(
            avg_retrieval_time_ms=round(sum(retrieval_latencies) / len(retrieval_latencies), 2) if retrieval_latencies else None,
            avg_generation_time_ms=round(sum(generation_latencies) / len(generation_latencies), 2) if generation_latencies else None,
        ),
        reliability=ReliabilityMetrics(
            total_queries=reliability_stats["total_requests"],
            successful_queries=reliability_stats["successful_requests"],
            failed_queries=reliability_stats["failed_requests"],
            empty_retrievals=reliability_stats["empty_retrievals"],
            success_rate=reliability_stats["success_rate"],
            error_rate=reliability_stats["error_rate"],
            empty_retrieval_rate=reliability_stats["empty_retrieval_rate"],
            error_breakdown=reliability_stats["error_breakdown"],
        ),
        traces=traces,
    )

    storage = EvaluationStorage()
    saved_path = storage.save_run(eval_run)
    logger.info(f"Avaliação real concluída e persistida em: {saved_path}")

    return eval_run


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Document AI Platform - Real RAG Evaluation Runner")
    parser.add_argument(
        "--dataset",
        type=str,
        default="backend/app/evaluation/datasets/contracts_eval_v1.json",
        help="Caminho relativo para o arquivo JSON do dataset",
    )
    parser.add_argument("--name", type=str, default="Baseline Real v1.3", help="Nome da execução")
    parser.add_argument("--baseline", action="store_true", help="Marcar como execução Baseline oficial")
    parser.add_argument("--top_k", type=int, default=5, help="Top-K chunks para cálculo de Recall@K e MRR@K")

    args = parser.parse_args()
    dataset_file = Path(args.dataset)
    if not dataset_file.is_absolute():
        dataset_file = Path.cwd() / dataset_file

    result = run_evaluation(
        dataset_path=dataset_file,
        run_name=args.name,
        is_baseline=args.baseline,
        top_k=args.top_k,
    )

    print("\n" + "=" * 65)
    print(f"📊 RESULTADOS DA AVALIAÇÃO REAL: {result.name} [{result.run_id}]")
    print("=" * 65)
    print(f"RAG Quality   -> Recall@5: {result.rag_quality.recall_at_5} | MRR@5: {result.rag_quality.mrr_at_5} | Faithfulness: {result.rag_quality.faithfulness} | Relevancy: {result.rag_quality.answer_relevancy}")
    print(f"Performance   -> P50: {result.performance.p50_ms}ms | P95: {result.performance.p95_ms}ms | P99: {result.performance.p99_ms}ms (N={result.performance.sample_count})")
    print(f"Reliability   -> Success: {result.reliability.success_rate * 100}% | Error: {result.reliability.error_rate * 100}% | Empty: {result.reliability.empty_retrieval_rate * 100}%")
    print("=" * 65 + "\n")
