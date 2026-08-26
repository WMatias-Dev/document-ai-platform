import json
import logging
import os
from pathlib import Path
from typing import List, Optional
from app.evaluation.schemas import EvaluationRun, EvaluationRunSummary

logger = logging.getLogger(__name__)

RUNS_DIR = Path(__file__).resolve().parent / "runs"


class EvaluationStorage:
    """
    Persistência e recuperação de runs de avaliação do RAG no filesystem versionado.
    Permite comparação de experimentos e definição de baseline.
    """

    def __init__(self, runs_dir: Optional[Path] = None):
        self.runs_dir = runs_dir or RUNS_DIR
        self.runs_dir.mkdir(parents=True, exist_ok=True)

    def save_run(self, run: EvaluationRun) -> Path:
        filename = f"{run.run_id}.json"
        file_path = self.runs_dir / filename
        
        # Converte para JSON serializável
        run_dict = json.loads(run.model_dump_json())
        
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(run_dict, f, indent=2, ensure_ascii=False)
            
        logger.info(f"[EvaluationStorage] Run {run.run_id} persistida com sucesso em {file_path}")
        return file_path

    def get_run(self, run_id: str) -> Optional[EvaluationRun]:
        file_path = self.runs_dir / f"{run_id}.json"
        if not file_path.exists():
            return None

        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            return EvaluationRun.model_validate(data)
        except Exception as e:
            logger.error(f"[EvaluationStorage] Erro ao ler run {run_id}: {e}", exc_info=True)
            return None

    def list_runs(self) -> List[EvaluationRunSummary]:
        summaries: List[EvaluationRunSummary] = []
        
        for file_path in sorted(self.runs_dir.glob("*.json"), reverse=True):
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                run = EvaluationRun.model_validate(data)
                
                summaries.append(
                    EvaluationRunSummary(
                        run_id=run.run_id,
                        name=run.name,
                        is_baseline=run.is_baseline,
                        timestamp=run.timestamp,
                        dataset_version=run.dataset_version,
                        dataset_size=run.dataset_size,
                        model_name=run.model_name,
                        recall_at_5=run.rag_quality.recall_at_5,
                        mrr_at_5=run.rag_quality.mrr_at_5,
                        faithfulness=run.rag_quality.faithfulness,
                        answer_relevancy=run.rag_quality.answer_relevancy,
                        p50_latency_ms=run.performance.p50_ms,
                        p95_latency_ms=run.performance.p95_ms,
                        success_rate=run.reliability.success_rate,
                        empty_retrieval_rate=run.reliability.empty_retrieval_rate,
                    )
                )
            except Exception as e:
                logger.warning(f"[EvaluationStorage] Falha ao parsear arquivo de run {file_path}: {e}")

        return summaries

    def get_baseline_run(self) -> Optional[EvaluationRun]:
        for run_summary in self.list_runs():
            if run_summary.is_baseline:
                return self.get_run(run_summary.run_id)
        return None
