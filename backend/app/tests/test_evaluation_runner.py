from pathlib import Path
import json
import uuid
from unittest.mock import MagicMock, patch
import pytest

from app.database.models.user import User
from app.evaluation.runner import run_evaluation
from app.schemas.document_schema import DocumentSearchResponse, SearchResultChunk


def test_runner_executes_real_retrieval(tmp_path):
    """
    Garante que o runner executa a busca real via DocumentService,
    sem copiar canonical_snippets nem simular latência com sleep.
    """
    # 1. Cria um dataset temporário de teste
    dataset_file = tmp_path / "test_dataset.json"
    dataset_content = [
        {
            "id": "test-001",
            "question": "Qual é a vigência do contrato?",
            "expected_answer": "12 meses.",
            "canonical_text_snippets": ["vigência de 12 meses"],
        }
    ]
    dataset_file.write_text(json.dumps(dataset_content), encoding="utf-8")

    # 2. Mock do DocumentService
    mock_doc_service = MagicMock()
    mock_chunk = SearchResultChunk(
        chunk_id=uuid.uuid4(),
        document_id=uuid.uuid4(),
        document_title="Contrato.pdf",
        chunk_index=0,
        text_content="O contrato tem vigência de 12 meses a contar da assinatura.",
        similarity_score=0.95,
        page_number=1,
    )
    mock_search_resp = DocumentSearchResponse(
        query="Qual é a vigência do contrato?",
        total_results=1,
        results=[mock_chunk],
    )
    mock_doc_service.search_documents.return_value = mock_search_resp

    test_user = User(
        id=uuid.uuid4(),
        name="Tester",
        email="tester@test.com",
        password_hash="hash",
    )

    with patch("app.evaluation.runner.AIService") as mock_ai_class:
        mock_ai_instance = MagicMock()
        mock_ai_instance.model_name = "gemini-3.7-flash"
        mock_ai_instance.generate_response.return_value = "A vigência é de 12 meses."
        mock_ai_class.return_value = mock_ai_instance

        # 3. Executa a avaliação
        run_result = run_evaluation(
            dataset_path=dataset_file,
            run_name="Test Real Retrieval",
            top_k=5,
            evaluate_llm_judges=False,
            perform_warmup=False,
            current_user=test_user,
            document_service=mock_doc_service,
        )

        # 4. Asserções
        mock_doc_service.search_documents.assert_called_once()
        call_args = mock_doc_service.search_documents.call_args[1]
        assert call_args["search_in"].query == "Qual é a vigência do contrato?"
        assert call_args["current_user"] == test_user

        assert len(run_result.traces) == 1
        trace = run_result.traces[0]
        # Garante que o chunk recuperado veio do DocumentService
        assert trace.retrieved_snippets == ["O contrato tem vigência de 12 meses a contar da assinatura."]
        assert trace.recall_at_5 == 1.0
        assert trace.mrr_at_5 == 1.0
        assert trace.status == "SUCCESS"


def test_contracts_eval_v2_schema_and_edge_cases():
    """Valida a integridade, taxonomia e formatação do dataset contracts_eval_v2.json."""
    dataset_path = (
        Path(__file__).resolve().parent.parent
        / "evaluation"
        / "datasets"
        / "contracts_eval_v2.json"
    )
    assert dataset_path.exists(), "contracts_eval_v2.json deve existir."

    with open(dataset_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    assert len(data) >= 12, "Dataset v2 deve conter pelo menos 12 casos (Lote 1)."

    valid_categories = {
        "single_hop_factual",
        "multi_hop_conflict",
        "table_boundary",
        "out_of_scope_adversarial",
    }

    for case in data:
        assert "id" in case
        assert "question" in case and len(case["question"]) > 10
        assert "expected_answer" in case and len(case["expected_answer"]) > 10
        assert case.get("category") in valid_categories, f"Categoria inválida no caso {case['id']}"

        snippets = case.get("canonical_text_snippets", [])
        if case["category"] == "out_of_scope_adversarial":
            # Casos adversários fora de escopo devem ter lista vazia de snippets canônicos
            assert len(snippets) == 0, f"Caso adversário {case['id']} não deve ter snippets canônicos."
        else:
            # Casos positivos devem ter ao menos 1 snippet comprovatório
            assert len(snippets) >= 1, f"Caso {case['id']} deve ter snippets canônicos."
            for snip in snippets:
                assert len(snip.strip()) >= 8
