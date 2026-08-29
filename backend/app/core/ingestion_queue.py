import asyncio
import logging
import uuid
from typing import Any, AsyncGenerator, Callable, Dict, List, Optional
from collections import defaultdict

logger = logging.getLogger(__name__)


class IngestionQueue:
    """
    Fila de Ingestão Assíncrona 100% Local (Zero Redis).
    - Utiliza asyncio.Queue + asyncio.Semaphore para controle estrito de concorrência.
    - Evita consumo excessivo de CPU/RAM na máquina do desenvolvedor.
    - Notifica o progresso em tempo real via canais SSE em memória.
    """

    def __init__(self, max_concurrency: int = 2):
        self.max_concurrency = max_concurrency
        self.queue: asyncio.Queue = asyncio.Queue()
        self.semaphore = asyncio.Semaphore(max_concurrency)
        self.subscribers: Dict[str, List[asyncio.Queue]] = defaultdict(list)
        self.worker_task: Optional[asyncio.Task] = None
        self.is_running: bool = False

    async def start(self) -> None:
        """Inicia o worker de segundo plano no loop de eventos do FastAPI."""
        if not self.is_running:
            self.is_running = True
            self.worker_task = asyncio.create_task(self._worker_loop())
            logger.info(
                f"[IngestionQueue] Worker de ingestão local iniciado (concorrência máxima: {self.max_concurrency})."
            )

    async def stop(self) -> None:
        """Encerra o worker graciosamente no shutdown."""
        self.is_running = False
        if self.worker_task:
            self.worker_task.cancel()
            try:
                await self.worker_task
            except asyncio.CancelledError:
                pass
            logger.info("[IngestionQueue] Worker de ingestão local encerrado.")

    async def enqueue(
        self,
        document_id: uuid.UUID,
        file_path: str,
        pipeline_func: Callable[[uuid.UUID, str], Any],
    ) -> None:
        """Enfileira um documento para processamento desacoplado."""
        await self.queue.put({
            "document_id": document_id,
            "file_path": file_path,
            "pipeline_func": pipeline_func,
        })
        await self.emit_progress(
            document_id=document_id,
            status="queued",
            progress=5,
            message="Documento enfileirado para processamento local.",
        )
        logger.info(f"[IngestionQueue] Documento {document_id} adicionado à fila local.")

    async def emit_progress(
        self,
        document_id: uuid.UUID,
        status: str,
        progress: int,
        message: str,
    ) -> None:
        """Dispara atualizações de progresso para todos os ouvintes SSE do documento."""
        doc_key = str(document_id)
        payload = {
            "document_id": doc_key,
            "status": status,
            "progress": progress,
            "message": message,
        }

        if doc_key in self.subscribers:
            for sub_queue in list(self.subscribers[doc_key]):
                try:
                    await sub_queue.put(payload)
                except Exception:
                    pass

    async def subscribe(self, document_id: uuid.UUID) -> AsyncGenerator[Dict[str, Any], None]:
        """Gera eventos SSE assíncronos para o frontend."""
        doc_key = str(document_id)
        sub_queue: asyncio.Queue = asyncio.Queue()
        self.subscribers[doc_key].append(sub_queue)

        try:
            while True:
                # Aguarda próximo evento com timeout para heartbeat
                try:
                    event = await asyncio.wait_for(sub_queue.get(), timeout=30.0)
                    yield event
                    if event.get("status") in ["ready", "error", "completed"]:
                        break
                except asyncio.TimeoutError:
                    yield {"event": "ping"}
        finally:
            if doc_key in self.subscribers and sub_queue in self.subscribers[doc_key]:
                self.subscribers[doc_key].remove(sub_queue)
                if not self.subscribers[doc_key]:
                    del self.subscribers[doc_key]

    async def _worker_loop(self) -> None:
        """Loop contínuo que processa tarefas respeitando o semáforo de concorrência."""
        while self.is_running:
            try:
                task_data = await self.queue.get()
                document_id = task_data["document_id"]
                file_path = task_data["file_path"]
                pipeline_func = task_data["pipeline_func"]

                # Executa a tarefa sob proteção de semáforo
                asyncio.create_task(
                    self._execute_with_semaphore(document_id, file_path, pipeline_func)
                )
                self.queue.task_done()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"[IngestionQueue] Erro no loop de tarefas: {e}", exc_info=True)

    async def _execute_with_semaphore(
        self,
        document_id: uuid.UUID,
        file_path: str,
        pipeline_func: Callable[[uuid.UUID, str], Any],
    ) -> None:
        async with self.semaphore:
            try:
                logger.info(f"[IngestionQueue] Iniciando pipeline para documento {document_id}...")
                # Executa a pipeline no executor de thread para não bloquear o event loop
                loop = asyncio.get_running_loop()
                await loop.run_in_executor(None, pipeline_func, document_id, file_path)
            except Exception as e:
                logger.error(
                    f"[IngestionQueue] Falha crítica na execução do documento {document_id}: {e}",
                    exc_info=True,
                )
                await self.emit_progress(
                    document_id=document_id,
                    status="error",
                    progress=0,
                    message=f"Erro no processamento: {str(e)}",
                )


# Instância compartilhada da fila de ingestão
ingestion_queue = IngestionQueue(max_concurrency=2)
