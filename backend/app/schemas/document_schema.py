import uuid
from typing import Optional
from pydantic import BaseModel, ConfigDict


# 1. Classe Base: Agrupa os campos comuns
class DocumentBase(BaseModel):
    title: str
    content: Optional[str] = None


# 2. Schema de Criação: Inclui dados do arquivo físico e metadados de armazenamento
class DocumentCreate(DocumentBase):
    filename: str
    file_path: Optional[str] = None
    content_type: Optional[str] = "application/pdf"


# 3. Schema de Resposta para Leitura Completa
class DocumentResponse(DocumentBase):
    id: uuid.UUID
    owner_id: uuid.UUID
    filename: Optional[str] = None
    file_path: Optional[str] = None
    content_type: Optional[str] = None
    status: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


# 4. Schema de Resposta do Upload Async
class DocumentUploadResponse(BaseModel):
    id: uuid.UUID
    filename: str
    status: str
    message: str


# 5. Schemas para Busca Semântica (Vector Retrieval)
class DocumentSearchRequest(BaseModel):
    query: str
    document_id: Optional[uuid.UUID] = None
    limit: int = 5


class SearchResultChunk(BaseModel):
    chunk_id: uuid.UUID
    document_id: uuid.UUID
    document_title: str
    chunk_index: int
    text_content: str
    similarity_score: float

    model_config = ConfigDict(from_attributes=True)


class DocumentSearchResponse(BaseModel):
    query: str
    total_results: int
    results: list[SearchResultChunk]