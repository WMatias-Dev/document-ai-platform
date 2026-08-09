from app.services.chunking_service import ChunkingService

def test_chunking_overlap_logic():
    # Tamanho de 100 caracteres, voltando 20 para o contexto
    chunker = ChunkingService(chunk_size=100, overlap=20)
    
    # Criamos um texto de 180 caracteres: 80 'A's + 20 'B's + 80 'C's
    text = ("A" * 80) + ("B" * 20) + ("C" * 80)
    
    chunks = chunker.chunk_text(text)
    
    assert len(chunks) == 2
    # O primeiro chunk tem que terminar com os 20 'B's
    assert chunks[0].endswith("B" * 20)
    # O segundo chunk TEM QUE começar com os exatos mesmos 20 'B's (Overlap)
    assert chunks[1].startswith("B" * 20)

def test_chunking_discards_small_trailing_chunks():
    chunker = ChunkingService(chunk_size=100, overlap=20)
    
    # Chunk 1: 0 a 100
    # Chunk 2 (start = 80): 80 a 180
    # Chunk 3 (start = 160): 160 a 190 (Sobram apenas 30 caracteres)
    text = "X" * 190
    
    chunks = chunker.chunk_text(text)
    
    # Como definimos que pedaços menores que 50 caracteres vão pro lixo, o Chunk 3 deve sumir.
    assert len(chunks) == 2
    assert all(len(c) >= 50 for c in chunks)