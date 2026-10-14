import asyncio
import logging
import uuid
from typing import Any, AsyncGenerator, Callable, Dict, List, Optional
from collections import defaultdict

logger = logging.getLogger(__name__)


class IngestionQueue:
    """
    Fila em memória para processar PDFs em segundo plano e transmitir progresso via SSE.
    Usa asyncio.Queue e semáforo para limitar processamento concorrente sem precisar de Redis.
    """

    def __init__(self, max_concurrency: int = 2):
        # Limito a 2 documentos em paralelo para não travar a CPU durante parsing e embeddings
        self.max_concurrency = max_concurrency
        self.queue: asyncio.Queue = asyncio.Queue()
        self.semaphore = asyncio.Semaphore(max_concurrency)
        # Dicionário de ouvintes SSE indexado pelo document_id para enviar eventos em tempo real
        self.subscribers: Dict[str, List[asyncio.Queue]] = defaultdict(list)
        self.worker_task: Optional[asyncio.Task] = None
        self.is_running: bool = False

    async def start(self) -> None:
        """Inicia a task do worker em segundo plano no ciclo de vida do FastAPI."""
        if not self.is_running:
            self.is_running = True
            self.worker_task = asyncio.create_task(self._worker_loop())
            logger.info(
                f"[IngestionQueue] Worker de ingestão local iniciado (concorrência máxima: {self.max_concurrency})."
            )

    async def stop(self) -> None:
        """Cancela a task do worker durante o encerramento da aplicação."""
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
        """
        Recebe o id do documento, caminho do arquivo e a função de processamento.
        Coloca a tarefa na fila e notifica os ouvintes que o documento foi enfileirado.
        """
        # TODO: tarefas em memória são perdidas se o processo for reiniciado antes de concluir
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
        """
        Publica um evento de progresso para todas as conexões SSE que estejam ouvindo esse documento.
        """
        doc_key = str(document_id)
        payload = {
            "document_id": doc_key,
            "status": status,
            "progress": progress,
            "message": message,
        }

        # Envio cópia para cada fila individual do cliente conectado
        if doc_key in self.subscribers:
            for sub_queue in list(self.subscribers[doc_key]):
                try:
                    await sub_queue.put(payload)
                except Exception:
                    pass

    async def subscribe(self, document_id: uuid.UUID) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Gera eventos para a rota SSE até o documento atingir status final ('ready', 'error' ou 'completed').
        Envia um ping a cada 30s para evitar que o navegador ou proxy encerrem a conexão por inatividade.
        """
        doc_key = str(document_id)
        sub_queue: asyncio.Queue = asyncio.Queue()
        self.subscribers[doc_key].append(sub_queue)

        try:
            while True:
                # Se demorar mais de 30s entre etapas (ex: embedding lento), envio ping de heartbeat
                try:
                    event = await asyncio.wait_for(sub_queue.get(), timeout=30.0)
                    yield event
                    if event.get("status") in ["ready", "error", "completed"]:
                        break
                except asyncio.TimeoutError:
                    yield {"event": "ping"}
        finally:
            # Limpo a fila do assinante ao desconectar para evitar vazamento de memória
            if doc_key in self.subscribers and sub_queue in self.subscribers[doc_key]:
                self.subscribers[doc_key].remove(sub_queue)
                if not self.subscribers[doc_key]:
                    del self.subscribers[doc_key]

    async def _worker_loop(self) -> None:
        """Consome itens da fila indefinidamente enquanto o worker estiver ativo."""
        while self.is_running:
            try:
                task_data = await self.queue.get()
                document_id = task_data["document_id"]
                file_path = task_data["file_path"]
                pipeline_func = task_data["pipeline_func"]

                # Crio a task separada para o semáforo controlar a concorrência sem travar a leitura da fila
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
                # Rodo a pipeline síncrona no thread pool padrão para não travar o event loop do FastAPI
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


# Instância única da fila compartilhada na aplicação
ingestion_queue = IngestionQueue(max_concurrency=2)
