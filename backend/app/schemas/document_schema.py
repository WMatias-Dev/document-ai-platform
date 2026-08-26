import uuid
from typing import Optional
from pydantic import BaseModel, ConfigDict


class DocumentBase(BaseModel):
    title: str
    content: Optional[str] = None


class DocumentCreate(DocumentBase):
    filename: str
    file_path: Optional[str] = None
    content_type: Optional[str] = "application/pdf"
    notebook_id: Optional[uuid.UUID] = None


class DocumentResponse(DocumentBase):
    id: uuid.UUID
    owner_id: uuid.UUID
    notebook_id: Optional[uuid.UUID] = None
    filename: Optional[str] = None
    file_path: Optional[str] = None
    content_type: Optional[str] = None
    status: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class DocumentUploadResponse(BaseModel):
    id: uuid.UUID
    filename: str
    status: str
    message: str
    notebook_id: Optional[uuid.UUID] = None


class DocumentSearchRequest(BaseModel):
    query: str
    notebook_id: Optional[uuid.UUID] = None
    document_id: Optional[uuid.UUID] = None
    source_ids: Optional[list[uuid.UUID]] = None
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