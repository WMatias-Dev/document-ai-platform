import pytest
from unittest.mock import MagicMock
from app.evaluation.judges import FaithfulnessEvaluator, AnswerRelevancyEvaluator


def test_faithfulness_judge_json_failure_returns_none_score():
    """
    Quando o LLM juiz de fidelidade falha ao gerar JSON válido,
    NÃO deve retornar 1.0 (falso positivo). Deve retornar score: None e indicar falha do juiz.
    """
    mock_ai = MagicMock()
    mock_ai.generate_response.return_value = "Esta é uma resposta de texto que não é JSON."
    
    evaluator = FaithfulnessEvaluator(ai_service=mock_ai)
    result = evaluator.evaluate(
        answer="A vigência do contrato é de 12 meses.",
        context_chunks=["O prazo de vigência é de 12 meses."],
    )
    
    assert result["score"] is None, f"Esperado score None em falha de JSON, mas recebeu {result.get('score')}"
    assert result.get("judge_failure") is True


def test_relevancy_judge_json_failure_returns_none_score():
    """
    Quando o LLM juiz de relevância falha ao gerar JSON válido,
    NÃO deve retornar 0.95 arbitrário. Deve retornar score: None e indicar falha do juiz.
    """
    mock_ai = MagicMock()
    mock_ai.generate_response.return_value = "Texto inválido sem JSON algum."
    
    evaluator = AnswerRelevancyEvaluator(ai_service=mock_ai)
    result = evaluator.evaluate(
        question="Qual a vigência?",
        answer="A vigência é de 12 meses.",
    )
    
    assert result["score"] is None, f"Esperado score None em falha de JSON, mas recebeu {result.get('score')}"
    assert result.get("judge_failure") is True


def test_runner_records_judge_failures_and_excludes_from_average(tmp_path):
    """
    Garante que falhas do juiz (score None) são excluídas da média das notas
    e contabilizadas no campo judge_failures no relatório de RAG quality.
    """
    import json
    import uuid
    from unittest.mock import patch
    from app.database.models.user import User
    from app.evaluation.runner import run_evaluation
    from app.schemas.document_schema import DocumentSearchResponse, SearchResultChunk

    dataset_file = tmp_path / "test_dataset.json"
    dataset_content = [
        {
            "id": "q1",
            "question": "Pergunta 1",
            "expected_answer": "Resp 1",
            "canonical_text_snippets": ["snippet 1"],
        },
        {
            "id": "q2",
            "question": "Pergunta 2",
            "expected_answer": "Resp 2",
            "canonical_text_snippets": ["snippet 2"],
        },
    ]
    dataset_file.write_text(json.dumps(dataset_content), encoding="utf-8")

    mock_doc_service = MagicMock()
    mock_chunk = SearchResultChunk(
        chunk_id=uuid.uuid4(),
        document_id=uuid.uuid4(),
        document_title="Doc.pdf",
        chunk_index=0,
        text_content="snippet 1 e snippet 2 presentes",
        similarity_score=0.9,
    )
    mock_doc_service.search_documents.return_value = DocumentSearchResponse(
        query="q", total_results=1, results=[mock_chunk]
    )

    test_user = User(id=uuid.uuid4(), name="Tester", email="tester@test.com", password_hash="hash")

    with patch("app.evaluation.runner.AIService") as mock_ai_class, \
         patch("app.evaluation.runner.FaithfulnessEvaluator") as mock_faith_class, \
         patch("app.evaluation.runner.AnswerRelevancyEvaluator") as mock_rel_class:

        mock_ai_instance = MagicMock()
        mock_ai_instance.model_name = "gemini-3.5-flash"
        mock_ai_instance.generate_response.return_value = "Resposta válida"
        mock_ai_class.return_value = mock_ai_instance

        # q1: juiz responde 0.8
        # q2: juiz falha (score None, judge_failure=True)
        mock_faith_inst = MagicMock()
        mock_faith_inst.evaluate.side_effect = [
            {"score": 0.8, "judge_failure": False},
            {"score": None, "judge_failure": True},
        ]
        mock_faith_class.return_value = mock_faith_inst

        mock_rel_inst = MagicMock()
        mock_rel_inst.evaluate.side_effect = [
            {"score": 0.9, "judge_failure": False},
            {"score": None, "judge_failure": True},
        ]
        mock_rel_class.return_value = mock_rel_inst

        run_result = run_evaluation(
            dataset_path=dataset_file,
            run_name="Test Judge Failure Handling",
            evaluate_llm_judges=True,
            perform_warmup=False,
            current_user=test_user,
            document_service=mock_doc_service,
            runs_dir=tmp_path / "runs",
        )

        # Média deve ser calculada apenas sobre o caso válido (0.8 e 0.9), ignorando None
        assert run_result.rag_quality.faithfulness == 0.8
        assert run_result.rag_quality.answer_relevancy == 0.9
        # Deve registrar a contagem de falhas do juiz no relatório
        assert hasattr(run_result.rag_quality, "judge_failures")
        assert run_result.rag_quality.judge_failures == 2

