import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class LatencyBreakdown(BaseModel):
    total_latency_ms: float
    query_embedding_latency_ms: Optional[float] = None
    retrieval_latency_ms: Optional[float] = None
    llm_generation_latency_ms: Optional[float] = None


class EvaluationTrace(BaseModel):
    query_id: str
    question: str
    expected_answer: Optional[str] = None
    generated_answer: str
    model_used: str
    retrieved_chunk_count: int
    retrieved_snippets: List[str] = Field(default_factory=list)
    recall_at_5: float
    mrr_at_5: float
    faithfulness_score: Optional[float] = None
    answer_relevancy_score: Optional[float] = None
    latency: LatencyBreakdown
    status: str = "SUCCESS"  # SUCCESS, ERROR, EMPTY_RETRIEVAL
    error_type: Optional[str] = None
    error_message: Optional[str] = None


class RAGQualityMetrics(BaseModel):
    recall_at_5: Optional[float] = None
    mrr_at_5: Optional[float] = None
    faithfulness: Optional[float] = None
    answer_relevancy: Optional[float] = None


class PerformanceMetrics(BaseModel):
    sample_count: int
    p50_ms: Optional[float] = None
    p95_ms: Optional[float] = None
    p99_ms: Optional[float] = None
    mean_ms: Optional[float] = None
    min_ms: Optional[float] = None
    max_ms: Optional[float] = None


class PipelineLatencyMetrics(BaseModel):
    avg_parsing_time_ms: Optional[float] = None
    avg_embedding_time_ms: Optional[float] = None
    avg_retrieval_time_ms: Optional[float] = None
    avg_generation_time_ms: Optional[float] = None


class ReliabilityMetrics(BaseModel):
    total_queries: int
    successful_queries: int
    failed_queries: int
    empty_retrievals: int
    success_rate: Optional[float] = None
    error_rate: Optional[float] = None
    empty_retrieval_rate: Optional[float] = None
    error_breakdown: Dict[str, int] = Field(default_factory=dict)


class EvaluationRun(BaseModel):
    run_id: str
    name: str
    is_baseline: bool = False
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    dataset_version: str
    dataset_size: int
    model_name: str
    embedding_model: str
    chunk_size: int
    chunk_overlap: int
    top_k: int
    
    # Grupos de Métricas Oficiais
    rag_quality: RAGQualityMetrics
    performance: PerformanceMetrics
    pipeline: PipelineLatencyMetrics
    reliability: ReliabilityMetrics
    
    # Detalhamento por Item (Traces)
    traces: List[EvaluationTrace] = Field(default_factory=list)


class EvaluationRunSummary(BaseModel):
    run_id: str
    name: str
    is_baseline: bool
    timestamp: datetime
    dataset_version: str
    dataset_size: int
    model_name: str
    recall_at_5: Optional[float]
    mrr_at_5: Optional[float]
    faithfulness: Optional[float]
    answer_relevancy: Optional[float]
    p50_latency_ms: Optional[float]
    p95_latency_ms: Optional[float]
    success_rate: Optional[float]
    empty_retrieval_rate: Optional[float]
