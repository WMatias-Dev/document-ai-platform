import uuid
from typing import List, Optional
from sqlalchemy.orm import Session
from app.database.models.document import Document
from app.schemas.document_schema import DocumentCreate

class DocumentRepository:
    def __init__(self, db: Session):
        self.db = db

    #Relacionando os dois dados com uma identidade segura
    def create(self, document_in: DocumentCreate, owner_id: uuid.UUID) -> Document:
        db_document = Document(
            title=document_in.title,
            content=document_in.content,
            owner_id=owner_id
        )
        self.db.add(db_document)
        self.db.commit()
        self.db.refresh(db_document)
        return db_document

    def get_by_id(self, document_id: uuid.UUID) -> Optional[Document]:
        # Apenas busca pelo ID, não pergunta de quem é
        return self.db.query(Document).filter(Document.id == document_id).first()

    def get_all_by_owner(self, owner_id: uuid.UUID) -> List[Document]:
        # Retorna todos os documentos que pertencem a um usuário específico
        return self.db.query(Document).filter(Document.owner_id == owner_id).all()

    def delete(self, document: Document) -> None:
        # Recebe a entidade já validada pelo serviço e apenas deleta
        self.db.delete(document)
        self.db.commit()

    def create_uploaded_document(self, document_data: dict) -> Document:
        """
        Salva os metadados do documento recém-upado no banco de dados.
        """
        # 1. Cria a instância do modelo SQLAlchemy desempacotando o dicionário
        db_document = Document(**document_data)
        
        # 2. Adiciona à sessão, comita e atualiza (refresh) para pegar o ID gerado (UUID)
        self.db.add(db_document)
        self.db.commit()
        self.db.refresh(db_document)
        
        return db_document