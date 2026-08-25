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

export interface DocumentItem {
  id: string;
  title: string;
  filename: string;
  file_path?: string | null;
  content_type?: string | null;
  status: DocumentStatus;
  owner_id: string;
}

export interface UploadResponse {
  document_id: string;
  status: string;
  message?: string;
  filename?: string;
}

export interface SearchResultChunk {
  chunk_id: string;
  document_id: string;
  document_title: string;
  chunk_index: number;
  text_content: string;
  similarity_score: number;
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
  document_id?: string | null;
  history?: ChatMessage[];
  max_chunks?: number;
}

export interface ChatResponse {
  answer: string;
  citations: DocumentCitation[];
  model: string;
}
