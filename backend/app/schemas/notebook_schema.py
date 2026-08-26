import uuid
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict
from app.schemas.document_schema import DocumentResponse


class NotebookBase(BaseModel):
    title: str
    description: Optional[str] = None
    emoji: Optional[str] = "📑"


class NotebookCreate(NotebookBase):
    pass


class NotebookUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    emoji: Optional[str] = None


class NotebookResponse(NotebookBase):
    id: uuid.UUID
    owner_id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    source_count: int = 0

    model_config = ConfigDict(from_attributes=True)


class NotebookDetailResponse(NotebookResponse):
    documents: List[DocumentResponse] = []

    model_config = ConfigDict(from_attributes=True)
