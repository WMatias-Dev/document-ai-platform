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
}
