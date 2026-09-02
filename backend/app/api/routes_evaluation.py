import logging
from pathlib import Path
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from app.database.dependencies import get_current_user
from app.database.models.user import User
from app.evaluation.runner import run_evaluation
from app.evaluation.schemas import EvaluationRun, EvaluationRunSummary
from app.evaluation.storage import EvaluationStorage

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/evaluation", tags=["Evaluation & Observability"])
storage = EvaluationStorage()


class TriggerEvaluationRequest(BaseModel):
    name: Optional[str] = "Manual Run"
    dataset_name: Optional[str] = "contracts_eval_v1.json"
    is_baseline: Optional[bool] = False
    top_k: Optional[int] = 5


@router.get("/runs", response_model=List[EvaluationRunSummary])
def list_evaluation_runs(current_user: User = Depends(get_current_user)):
    """
    Retorna a lista de todas as execuções de avaliação registradas, ordenadas por data.
    """
    return storage.list_runs()


@router.get("/runs/{run_id}", response_model=EvaluationRun)
def get_evaluation_run(run_id: str, current_user: User = Depends(get_current_user)):
    """
    Retorna os detalhes completos de uma execução, incluindo traces e métricas por query.
    """
    run = storage.get_run(run_id)
    if not run:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Execução de avaliação '{run_id}' não encontrada.",
        )
    return run


@router.get("/baseline", response_model=Optional[EvaluationRun])
def get_baseline_run(current_user: User = Depends(get_current_user)):
    """
    Retorna a execução oficial marcada como Baseline para comparação de experimentos.
    """
    baseline = storage.get_baseline_run()
    if not baseline:
        # Se não houver explícita, retorna a mais antiga ou primeira
        runs = storage.list_runs()
        if runs:
            return storage.get_run(runs[-1].run_id)
        return None
    return baseline


@router.post("/run", response_model=EvaluationRun)
def trigger_evaluation(
    payload: TriggerEvaluationRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Dispara uma nova avaliação real de RAG sobre o dataset selecionado e retorna as métricas consolidadas.
    """
    dataset_path = Path(__file__).resolve().parent.parent / "evaluation" / "datasets" / payload.dataset_name

    if not dataset_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Dataset '{payload.dataset_name}' não encontrado no diretório de avaliação.",
        )

    try:
        eval_run = run_evaluation(
            dataset_path=dataset_path,
            run_name=payload.name or "Avaliação Sob Demanda",
            is_baseline=payload.is_baseline or False,
            top_k=payload.top_k or 5,
            current_user=current_user,
        )
        return eval_run
    except Exception as e:
        logger.error(f"Erro ao executar avaliação: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Falha na execução da avaliação: {str(e)}",
        )
