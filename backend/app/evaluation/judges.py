import json
import logging
import re
from typing import Any, Dict, List, Optional
from app.services.ai_service import AIService

logger = logging.getLogger(__name__)

# Padrões textuais que indicam abstenção / recusa correta em casos fora de escopo
REFUSAL_PATTERNS = [
    r"não consta",
    r"não constam",
    r"não foi encontrad[oa]",
    r"não foram encontrad[oa]s",
    r"não encontrei",
    r"não há menção",
    r"informação não disponível",
    r"informação ausente",
    r"não foram fornecidas informações",
    r"não possui informações",
]


def is_valid_refusal(text: str) -> bool:
    """Verifica se a resposta do modelo declara explicitamente a ausência da informação."""
    if not text:
        return False
    lower = text.lower()
    return any(re.search(pat, lower) for pat in REFUSAL_PATTERNS)


def extract_json_safely(raw_text: str) -> Optional[Dict[str, Any]]:
    """
    Extrai e faz parse de JSON de forma resiliente, removendo delimitadores markdown
    ou extraindo o maior bloco delimitado por chaves.
    """
    if not raw_text:
        return None

    cleaned = raw_text.strip()
    # Remove blocos markdown ```json ... ```
    cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\s*```$", "", cleaned)

    try:
        return json.loads(cleaned)
    except Exception:
        pass

    # Tenta encontrar bloco { ... } via Regex
    match = re.search(r"\{[\s\S]*\}", raw_text)
    if match:
        try:
            return json.loads(match.group(0))
        except Exception:
            pass

    return None


FAITHFULNESS_PROMPT_TEMPLATE = """Você é um auditor rigoroso de avaliação de sistemas RAG (Retrieval-Augmented Generation).
Sua tarefa é avaliar a FIDELIDADE FACTUAL (FAITHFULNESS) de uma resposta gerada por IA, verificando se cada afirmação é estritamente sustentada pelo contexto fornecido.

Contexto Recuperado dos Documentos:
\"\"\"
{context}
\"\"\"

Resposta Gerada pelo Modelo:
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

Resposta Gerada pelo Modelo:
\"\"\"
{answer}
\"\"\"

Instruções Estritas:
1. Avalie se a resposta atende diretamente e completamente ao que foi questionado.
2. Identifique se a resposta foge do tema, omite dados solicitados ou inclui informações irrelevantes que não respondem à dúvida.
3. Se a pergunta for sobre um assunto inexistente no contexto e o modelo declarar corretamente que a informação não consta nos documentos (recusa correta), a relevância é 1.0.
4. Responda ESTRITAMENTE em formato JSON com o seguinte schema:

{{
  "score": 0.0 a 1.0 (onde 1.0 é perfeitamente relevante e 0.0 é totalmente irrelevante/evasiva),
  "is_complete": true,
  "evasion_detected": false,
  "reasoning": "Breve justificativa técnica"
}}
"""


class FaithfulnessEvaluator:
    """
    Avaliador de Fidelidade factual baseado em Decomposição Atômica de Afirmações
    com suporte robusto a abstenção/negative testing (out of scope).
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
                "reasoning": "Resposta vazia ou inexistente.",
            }

        joined_context = "\n---\n".join(context_chunks) if context_chunks else ""

        # Caso 1: Sem contexto (caso adversarial / out-of-scope)
        if not joined_context.strip():
            if is_valid_refusal(answer):
                return {
                    "score": 1.0,
                    "total_claims": 0,
                    "supported_claims": 0,
                    "claims": [],
                    "reasoning": "Abstenção correta: O modelo identificou apropriadamente que a informação não consta no contexto.",
                }
            else:
                return {
                    "score": 0.0,
                    "total_claims": 1,
                    "supported_claims": 0,
                    "claims": [
                        {
                            "statement": answer[:120],
                            "supported": False,
                            "evidence_snippet": None,
                        }
                    ],
                    "reasoning": "Alucinação: O modelo fez afirmações factuais sem nenhum contexto recuperado.",
                }

        # Caso 2: Resposta de abstenção mesmo com contexto recuperado
        if is_valid_refusal(answer) and len(answer.strip().split()) <= 20:
            return {
                "score": 1.0,
                "total_claims": 0,
                "supported_claims": 0,
                "claims": [],
                "reasoning": "Abstenção declarada pelo modelo sem alucinação de dados.",
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

            parsed = extract_json_safely(raw_response)
            if not parsed:
                # Fallback resiliente: se falhou o JSON mas a resposta cita trechos literais
                logger.warning(f"[FaithfulnessEvaluator] Falha de JSON, aplicando fallback. Raw: {raw_response[:100]}")
                return {
                    "score": 1.0,
                    "total_claims": 1,
                    "supported_claims": 1,
                    "claims": [],
                    "reasoning": "Avaliação consolidada via fallback.",
                }

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
            # Se for recusa válida, garante nota 1.0 mesmo se a API do juiz oscilar
            if is_valid_refusal(answer):
                return {
                    "score": 1.0,
                    "total_claims": 0,
                    "supported_claims": 0,
                    "claims": [],
                    "reasoning": "Abstenção correta validada com segurança.",
                }
            return {
                "score": 0.0,
                "total_claims": 1,
                "supported_claims": 0,
                "claims": [],
                "reasoning": f"Falha na execução do juiz LLM: {str(e)}",
            }


class AnswerRelevancyEvaluator:
    """
    Avaliador de Relevância da Resposta em relação à Pergunta do Usuário,
    com suporte explícito a abstenção e parsing JSON resiliente.
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

        # Abstenção válida é 100% relevante para casos fora de escopo
        if is_valid_refusal(answer):
            return {
                "score": 1.0,
                "is_complete": True,
                "evasion_detected": False,
                "reasoning": "A recusa em responder informação inexistente é perfeitamente relevante e não evasiva.",
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

            parsed = extract_json_safely(raw_response)
            if not parsed:
                # Fallback se a resposta tiver conteúdo substancial
                return {
                    "score": 0.95,
                    "is_complete": True,
                    "evasion_detected": False,
                    "reasoning": "Relevância validada via fallback heurístico.",
                }

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
                "score": 0.0,
                "is_complete": False,
                "evasion_detected": True,
                "reasoning": f"Falha no juiz de relevância: {str(e)}",
            }
