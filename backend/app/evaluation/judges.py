import json
import logging
import re
from typing import Any, Dict, List, Optional, Tuple
from app.services.ai_service import AIService

logger = logging.getLogger(__name__)

FAITHFULNESS_PROMPT_TEMPLATE = """Você é um auditor rigoroso de avaliação de sistemas RAG (Retrieval-Augmented Generation).
Sua tarefa é avaliar a FIDELIDADE (FAITHFULNESS) de uma resposta gerada por IA, verificando se cada afirmação factual é estritamente sustentada pelo contexto recuperado dos documentos.

Contexto Recuperado dos Documentos:
\"\"\"
{context}
\"\"\"

Resposta Gerada:
\"\"\"
{answer}
\"\"\"

Instruções Estritas:
1. Decomponha a resposta em declarações factuais atômicas (claims individuais).
2. Para cada declaração, verifique se ela é sustentada de forma inequívoca pelas evidências do Contexto.
3. Se uma declaração não estiver no contexto, ou for dedução/suposição sem prova, marque "supported": false.
4. Responda ESTRITAMENTE em formato JSON com o seguinte schema:

{{
  "claims": [
    {{
      "statement": "texto da afirmação atômica",
      "supported": true,
      "evidence_snippet": "trecho do contexto que comprova ou null se não suportado"
    }}
  ],
  "reasoning": "Breve justificativa técnica do auditor"
}}
"""

ANSWER_RELEVANCY_PROMPT_TEMPLATE = """Você é um auditor rigoroso de avaliação de sistemas de IA.
Sua tarefa é avaliar a RELEVÂNCIA DA RESPOSTA (ANSWER RELEVANCY) em relação à pergunta original feita pelo usuário.

Pergunta do Usuário:
\"\"\"
{question}
\"\"\"

Resposta Gerada:
\"\"\"
{answer}
\"\"\"

Instruções Estritas:
1. Avalie se a resposta atende diretamente e completamente ao que foi questionado.
2. Identifique se a resposta foge do tema, omite dados solicitados ou inclui informações irrelevantes que não respondem à dúvida.
3. Responda ESTRITAMENTE em formato JSON com o seguinte schema:

{{
  "score": 0.0 a 1.0 (onde 1.0 é perfeitamente relevante e 0.0 é totalmente irrelevante/evasiva),
  "is_complete": true/false,
  "evasion_detected": true/false,
  "reasoning": "Breve justificativa técnica"
}}
"""


class FaithfulnessEvaluator:
    """
    Avaliador de Fidelidade factual baseado em Decomposição Atômica de Afirmações
    e verificação booleana determinística contra o contexto recuperado.
    """

    def __init__(self, ai_service: Optional[AIService] = None):
        self.ai_service = ai_service or AIService()

    def evaluate(
        self, answer: str, context_chunks: List[str]
    ) -> Dict[str, Any]:
        if not answer or not answer.strip():
            return {
                "score": 0.0,
                "total_claims": 0,
                "supported_claims": 0,
                "claims": [],
                "reasoning": "Resposta vazia.",
            }

        joined_context = "\n---\n".join(context_chunks) if context_chunks else ""
        if not joined_context.strip():
            return {
                "score": 0.0,
                "total_claims": 1,
                "supported_claims": 0,
                "claims": [
                    {
                        "statement": "Nenhum contexto disponível.",
                        "supported": False,
                        "evidence_snippet": None,
                    }
                ],
                "reasoning": "Nenhum contexto recuperado para embasar a resposta.",
            }

        prompt = FAITHFULNESS_PROMPT_TEMPLATE.format(
            context=joined_context,
            answer=answer,
        )

        try:
            raw_response = self.ai_service.generate_response(
                prompt=prompt,
                system_instruction="Você é um avaliador JSON estrito. Retorne apenas JSON válido sem marcações markdown.",
            )

            # Extração de JSON limpo
            json_match = re.search(r"\{[\s\S]*\}", raw_response)
            if not json_match:
                raise ValueError("Nenhum JSON detectado na resposta do juiz.")

            parsed = json.loads(json_match.group(0))
            claims = parsed.get("claims", [])

            if not claims:
                return {
                    "score": 1.0,
                    "total_claims": 0,
                    "supported_claims": 0,
                    "claims": [],
                    "reasoning": parsed.get("reasoning", "Nenhuma afirmação factual isolada."),
                }

            supported_count = sum(1 for c in claims if c.get("supported") is True)
            total_count = len(claims)
            score = round(supported_count / total_count, 4)

            return {
                "score": score,
                "total_claims": total_count,
                "supported_claims": supported_count,
                "claims": claims,
                "reasoning": parsed.get("reasoning", ""),
            }

        except Exception as e:
            logger.error(f"[FaithfulnessEvaluator] Erro na avaliação: {e}", exc_info=True)
            return {
                "score": None,
                "total_claims": 0,
                "supported_claims": 0,
                "claims": [],
                "reasoning": f"Falha na execução do juiz LLM: {str(e)}",
            }


class AnswerRelevancyEvaluator:
    """
    Avaliador de Relevância da Resposta em relação à Pergunta do Usuário.
    """

    def __init__(self, ai_service: Optional[AIService] = None):
        self.ai_service = ai_service or AIService()

    def evaluate(self, question: str, answer: str) -> Dict[str, Any]:
        if not question or not answer:
            return {
                "score": 0.0,
                "is_complete": False,
                "evasion_detected": True,
                "reasoning": "Pergunta ou resposta ausente.",
            }

        prompt = ANSWER_RELEVANCY_PROMPT_TEMPLATE.format(
            question=question,
            answer=answer,
        )

        try:
            raw_response = self.ai_service.generate_response(
                prompt=prompt,
                system_instruction="Você é um avaliador JSON estrito. Retorne apenas JSON válido sem formatação extra.",
            )

            json_match = re.search(r"\{[\s\S]*\}", raw_response)
            if not json_match:
                raise ValueError("Nenhum JSON detectado na resposta do juiz.")

            parsed = json.loads(json_match.group(0))
            score = float(parsed.get("score", 0.0))

            return {
                "score": round(max(0.0, min(1.0, score)), 4),
                "is_complete": bool(parsed.get("is_complete", True)),
                "evasion_detected": bool(parsed.get("evasion_detected", False)),
                "reasoning": parsed.get("reasoning", ""),
            }

        except Exception as e:
            logger.error(f"[AnswerRelevancyEvaluator] Erro na avaliação: {e}", exc_info=True)
            return {
                "score": None,
                "is_complete": False,
                "evasion_detected": False,
                "reasoning": f"Falha no juiz de relevância: {str(e)}",
            }
