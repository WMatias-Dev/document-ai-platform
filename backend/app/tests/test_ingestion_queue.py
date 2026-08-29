import asyncio
import uuid
import pytest
from app.core.ingestion_queue import IngestionQueue


@pytest.mark.asyncio
async def test_ingestion_queue_lifecycle_and_execution():
    queue = IngestionQueue(max_concurrency=1)
    await queue.start()

    assert queue.is_running is True

    executed = []

    def fake_pipeline(doc_id: uuid.UUID, path: str):
        executed.append((doc_id, path))

    doc_id = uuid.uuid4()
    file_path = "/tmp/test.pdf"

    await queue.enqueue(
        document_id=doc_id,
        file_path=file_path,
        pipeline_func=fake_pipeline,
    )

    # Aguarda o worker processar
    await asyncio.sleep(0.1)

    assert len(executed) == 1
    assert executed[0] == (doc_id, file_path)

    await queue.stop()
    assert queue.is_running is False


@pytest.mark.asyncio
async def test_ingestion_queue_pub_sub_progress():
    queue = IngestionQueue(max_concurrency=1)
    doc_id = uuid.uuid4()

    received_events = []

    async def reader():
        async for event in queue.subscribe(doc_id):
            received_events.append(event)
            if event.get("status") == "ready":
                break

    reader_task = asyncio.create_task(reader())
    await asyncio.sleep(0.01)

    await queue.emit_progress(doc_id, "parsing", 25, "Lendo páginas...")
    await queue.emit_progress(doc_id, "chunking", 50, "Criando chunks...")
    await queue.emit_progress(doc_id, "ready", 100, "Concluído.")

    await asyncio.wait_for(reader_task, timeout=2.0)

    assert len(received_events) == 3
    assert received_events[0]["status"] == "parsing"
    assert received_events[1]["progress"] == 50
    assert received_events[2]["status"] == "ready"
