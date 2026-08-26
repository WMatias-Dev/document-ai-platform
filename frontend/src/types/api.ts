export type DocumentStatus =
  | "RECEIVED"
  | "PARSING"
  | "CHUNKING"
  | "EMBEDDING"
  | "COMPLETED"
  | "ERROR";

export interface User {
  id: string;
  name: string;
  email: string;
}

export interface AuthTokens {
  access_token: string;
  token_type: string;
}

export interface NotebookItem {
  id: string;
  title: string;
  description?: string | null;
  emoji: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
  source_count: number;
}

export interface DocumentItem {
  id: string;
  title: string;
  filename: string;
  file_path?: string | null;
  content_type?: string | null;
  status: DocumentStatus;
  owner_id: string;
  notebook_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface NotebookDetailResponse extends NotebookItem {
  documents: DocumentItem[];
}

export interface UploadResponse {
  document_id: string;
  status: string;
  message?: string;
  filename?: string;
  notebook_id?: string | null;
}

export interface SearchResultChunk {
  chunk_id: string;
  document_id: string;
  document_title: string;
  chunk_index: number;
  text_content: string;
  similarity_score: number;
}

export interface DocumentSearchRequest {
  query: string;
  notebook_id?: string | null;
  document_id?: string | null;
  source_ids?: string[] | null;
  limit?: number;
}

export interface DocumentSearchResponse {
  query: string;
  total_results: number;
  results: SearchResultChunk[];
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface DocumentCitation {
  chunk_id: string;
  document_id: string;
  document_title: string;
  chunk_index: number;
  text_snippet: string;
  similarity_score: number;
}

export interface ChatRequest {
  message: string;
  thread_id?: string | null;
  notebook_id?: string | null;
  document_id?: string | null;
  source_ids?: string[] | null;
  history?: ChatMessage[];
  max_chunks?: number;
}

export interface ChatResponse {
  answer: string;
  citations: DocumentCitation[];
  model: string;
  thread_id?: string | null;
}

export interface ChatMessageDetail {
  id: string;
  thread_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  citations?: DocumentCitation[] | null;
  model_used?: string | null;
  created_at: string;
}

export interface ChatThreadItem {
  id: string;
  title: string;
  notebook_id?: string | null;
  owner_id: string;
  created_at: string;
  updated_at: string;
  messages?: ChatMessageDetail[];
}

// ==========================================
// RAG Evaluation & Observability Types
// ==========================================

export interface LatencyBreakdown {
  total_latency_ms: number;
  query_embedding_latency_ms?: number | null;
  retrieval_latency_ms?: number | null;
  llm_generation_latency_ms?: number | null;
}

export interface EvaluationTrace {
  query_id: string;
  question: string;
  expected_answer?: string | null;
  generated_answer: string;
  model_used: string;
  retrieved_chunk_count: number;
  retrieved_snippets: string[];
  recall_at_5: number;
  mrr_at_5: number;
  faithfulness_score?: number | null;
  answer_relevancy_score?: number | null;
  latency: LatencyBreakdown;
  status: string;
  error_type?: string | null;
  error_message?: string | null;
}

export interface RAGQualityMetrics {
  recall_at_5?: number | null;
  mrr_at_5?: number | null;
  faithfulness?: number | null;
  answer_relevancy?: number | null;
}

export interface PerformanceMetrics {
  sample_count: number;
  p50_ms?: number | null;
  p95_ms?: number | null;
  p99_ms?: number | null;
  mean_ms?: number | null;
  min_ms?: number | null;
  max_ms?: number | null;
}

export interface PipelineLatencyMetrics {
  avg_parsing_time_ms?: number | null;
  avg_embedding_time_ms?: number | null;
  avg_retrieval_time_ms?: number | null;
  avg_generation_time_ms?: number | null;
}

export interface ReliabilityMetrics {
  total_queries: number;
  successful_queries: number;
  failed_queries: number;
  empty_retrievals: number;
  success_rate?: number | null;
  error_rate?: number | null;
  empty_retrieval_rate?: number | null;
  error_breakdown: Record<string, number>;
}

export interface EvaluationRun {
  run_id: string;
  name: string;
  is_baseline: boolean;
  timestamp: string;
  dataset_version: string;
  dataset_size: number;
  model_name: string;
  embedding_model: string;
  chunk_size: number;
  chunk_overlap: number;
  top_k: number;
  rag_quality: RAGQualityMetrics;
  performance: PerformanceMetrics;
  pipeline: PipelineLatencyMetrics;
  reliability: ReliabilityMetrics;
  traces: EvaluationTrace[];
}

export interface EvaluationRunSummary {
  run_id: string;
  name: string;
  is_baseline: boolean;
  timestamp: string;
  dataset_version: string;
  dataset_size: number;
  model_name: string;
  recall_at_5?: number | null;
  mrr_at_5?: number | null;
  faithfulness?: number | null;
  answer_relevancy?: number | null;
  p50_latency_ms?: number | null;
  p95_latency_ms?: number | null;
  success_rate?: number | null;
  empty_retrieval_rate?: number | null;
}
