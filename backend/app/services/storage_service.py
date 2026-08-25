import os
import uuid
import aiofiles
from fastapi import UploadFile
from pathlib import Path

class StorageService:
    def __init__(self, upload_dir: str = "./uploads"):
        self.upload_dir = Path(upload_dir)
        self.upload_dir.mkdir(parents=True, exist_ok=True)

    def _generate_safe_filepath(self, original_filename: str) -> Path:
        ext = os.path.splitext(original_filename)[1].lower()
        if ext != ".pdf":
            raise ValueError("Apenas arquivos PDF são suportados.")

        safe_name = f"{uuid.uuid4().hex}{ext}"
        file_path = self.upload_dir / safe_name

        # Prevenção contra path traversal
        absolute_path = file_path.resolve()
        if self.upload_dir.resolve() not in absolute_path.parents:
            raise PermissionError("Tentativa de gravação fora do diretório permitido.")

        return absolute_path

    async def save_file(self, file: UploadFile) -> str:
        if not file.filename:
            raise ValueError("Nome de arquivo ausente.")

        safe_path = self._generate_safe_filepath(file.filename)

        try:
            async with aiofiles.open(safe_path, "wb") as out_file:
                # Streaming em blocos de 1MB para limitar o uso de memória
                while content := await file.read(1024 * 1024):
                    await out_file.write(content)
        except Exception as e:
            raise IOError(f"Falha ao salvar o arquivo no disco: {str(e)}")

        return str(safe_path)

    def delete_file(self, file_path: str) -> bool:
        try:
            path = Path(file_path)
            if path.exists() and path.is_file():
                path.unlink()
                return True
        except Exception:
            pass
        return False