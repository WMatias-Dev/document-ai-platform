from app.services.chunking_service import ChunkingService


def test_chunking_overlap_logic():
    # Tamanho de 100 caracteres, voltando 20 para o contexto
    chunker = ChunkingService(chunk_size=100, overlap=20, min_chunk_size=50)

    # Criamos um texto de 180 caracteres: 80 'A's + 20 'B's + 80 'C's
    text = ("A" * 80) + ("B" * 20) + ("C" * 80)

    chunks = chunker.chunk_text(text)

    assert len(chunks) == 2
    # O primeiro chunk tem que terminar com os 20 'B's
    assert chunks[0].endswith("B" * 20)
    # O segundo chunk TEM QUE começar com os exatos mesmos 20 'B's (Overlap)
    assert chunks[1].startswith("B" * 20)


def test_chunking_merges_small_trailing_chunk():
    chunker = ChunkingService(chunk_size=100, overlap=20, min_chunk_size=50)

    # Chunk 1: 0 a 100
    # Chunk 2 (start = 80): 80 a 180
    # Chunk 3 (start = 160): 160 a 190 (Sobram apenas 30 caracteres 'Y')
    text = ("X" * 180) + ("Y" * 10)

    chunks = chunker.chunk_text(text)

    # O pedaço menor que 50 é mesclado no chunk 2 sem perda de dados
    assert len(chunks) == 2
    assert chunks[1].endswith("Y" * 10)


def test_chunking_short_text_preserved():
    chunker = ChunkingService(chunk_size=1000, overlap=200, min_chunk_size=50)

    # Texto curto com menos de 50 caracteres não deve ser descartado
    short_text = "Nota fiscal #12345 aprovada."
    chunks = chunker.chunk_text(short_text)

    assert len(chunks) == 1
    assert chunks[0] == short_text


def test_chunking_empty_text():
    chunker = ChunkingService(chunk_size=1000, overlap=200)
    assert chunker.chunk_text("") == []
    assert chunker.chunk_text("   ") == []