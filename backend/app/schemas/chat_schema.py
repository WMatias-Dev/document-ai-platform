import uuid
from typing import List, Literal, Optional
from pydantic import BaseModel, ConfigDict, Field


class ChatMessage(BaseModel):
    """Representa uma mensagem no histórico de conversa."""
    role: Literal["user", "assistant", "system"]
    content: str


class DocumentCitation(BaseModel):
    """Metadados e trecho da fonte citada pela IA."""
    chunk_id: uuid.UUID
    document_id: uuid.UUID
    document_title: str
    chunk_index: int
    text_snippet: str
    similarity_score: float

    model_config = ConfigDict(from_attributes=True)


class ChatRequest(BaseModel):
    """Requisição de pergunta para o Agente RAG."""
    message: str = Field(..., min_length=1, description="Pergunta ou mensagem do usuário.")
    notebook_id: Optional[uuid.UUID] = Field(
        None, description="Filtro opcional para consultar apenas documentos pertencentes a um caderno."
    )
    document_id: Optional[uuid.UUID] = Field(
        None, description="Filtro opcional para consultar apenas um documento específico."
    )
    source_ids: Optional[List[uuid.UUID]] = Field(
        None, description="Lista opcional de IDs de documentos selecionados via checkbox."
    )
    history: Optional[List[ChatMessage]] = Field(
        default_factory=list,
        description="Histórico recente de mensagens para manter o contexto da conversa.",
    )
    max_chunks: int = Field(
        default=5,
        ge=1,
        le=20,
        description="Quantidade máxima de trechos relevantes a serem recuperados.",
    )


class ChatResponse(BaseModel):
    """Resposta gerada pelo Gemini com citações das fontes consultadas."""
    answer: str
    citations: List[DocumentCitation]
    model: str
