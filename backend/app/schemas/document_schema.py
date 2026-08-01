import uuid
from typing import Optional
from pydantic import BaseModel, ConfigDict

# 1. Classe Base: Agrupa os campos comuns para não repetirmos código
class DocumentBase(BaseModel):
    title: str
    content: Optional[str] = None

# 2. Schema de Criação (O que o usuário envia no POST)
class DocumentCreate(DocumentBase):
    # Passa em branco pois ele herda title e content
    # O owner_id nao entra aqui
    pass 

# 3. Schema de Resposta (O que a API devolve para o usuário)
class DocumentResponse(DocumentBase):
    id: uuid.UUID
    owner_id: uuid.UUID

    # Esta é a configuração que permite ao Pydantic ler o modelo do SQLAlchemy
    model_config = ConfigDict(from_attributes=True)