import os
import uuid
import aiofiles
from fastapi import UploadFile
from pathlib import Path

class StorageService:
    def __init__(self, upload_dir: str = "./uploads"):
        # Usamos pathlib para manipulação segura de caminhos
        self.upload_dir = Path(upload_dir)
        # Garante que o diretório base exista ao iniciar o serviço
        self.upload_dir.mkdir(parents=True, exist_ok=True)

    def _generate_safe_filepath(self, original_filename: str) -> Path:
        """
        Gera um caminho de arquivo 100% seguro, ignorando o nome original 
        para evitar path traversal e caracteres inválidos.
        """
        # Extrai apenas a extensão e força para minúsculo (ex: '.PDF' vira '.pdf')
        ext = os.path.splitext(original_filename)[1].lower()
        
        if ext != ".pdf":
            raise ValueError("Apenas arquivos PDF são suportados.")
        
        # Gera um nome aleatório (ex: 'f47ac10b58cc4372a5670e02b2c3d479.pdf')
        safe_name = f"{uuid.uuid4().hex}{ext}"
        
        file_path = self.upload_dir / safe_name
        
        # Double-check de segurança: resolve o caminho absoluto e verifica 
        # se ele realmente está dentro da pasta de uploads permitida.
        absolute_path = file_path.resolve()
        if self.upload_dir.resolve() not in absolute_path.parents:
            raise PermissionError("Tentativa de gravação fora do diretório permitido.")
            
        return absolute_path

    async def save_file(self, file: UploadFile) -> str:
        """
        Salva o arquivo físico lendo em blocos para não estourar a memória (RAM).
        Retorna o caminho absoluto do arquivo salvo.
        """
        if not file.filename:
            raise ValueError("Nome de arquivo ausente.")

        safe_path = self._generate_safe_filepath(file.filename)

        try:
            # aiofiles permite I/O não bloqueante, essencial para FastAPI
            async with aiofiles.open(safe_path, 'wb') as out_file:
                # Lê o arquivo em pedaços (chunks) de 1MB por vez
                # Isso protege o servidor se enviarem um PDF de 500MB
                while content := await file.read(1024 * 1024):
                    await out_file.write(content)
        except Exception as e:
            # Se algo der errado na escrita, podemos logar o erro aqui
            raise IOError(f"Falha ao salvar o arquivo no disco: {str(e)}")

        return str(safe_path)

    def delete_file(self, file_path: str) -> bool:
        """
        Remove o arquivo físico. Útil para limpar o disco se o pipeline 
        falhar nas etapas seguintes (ex: extração de texto falhou).
        """
        try:
            path = Path(file_path)
            if path.exists() and path.is_file():
                path.unlink()
                return True
        except Exception:
            # Em um cenário real, enviaríamos isso para um logger
            pass
        return False