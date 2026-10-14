import logging
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


class RerankService:
    """
    Reordena os candidatos retornados pela busca usando um modelo cross-encoder (FlashRank).
    Executa em CPU com ONNX para não precisar de GPU nem de PyTorch instalado.
    """

    def __init__(self, model_name: str = "ms-marco-TinyBERT-L-2-v2"):
        # Escolhi o TinyBERT por ser pequeno (~15MB) e rodar rápido em CPU
        self.model_name = model_name
        self.ranker = None
        self.is_available = False
        self._initialize_ranker()

    def _initialize_ranker(self) -> None:
        """Tenta carregar o modelo FlashRank. Se a biblioteca faltar ou der erro, ativa fallback."""
        try:
            from flashrank import Ranker
            self.ranker = Ranker(model_name=self.model_name)
            self.is_available = True
            logger.info(f"[RerankService] FlashRank inicializado com sucesso (modelo: {self.model_name}).")
        except Exception as e:
            # Se faltar flashrank ou o modelo falhar ao baixar, continuo sem quebrar a aplicação
            logger.warning(
                f"[RerankService] FlashRank não pôde ser carregado: {e}. "
                f"Modo fallback transparente ativado."
            )
            self.ranker = None
            self.is_available = False

    def rerank(
        self,
        query: str,
        candidates: List[Dict[str, Any]],
        top_n: int = 5,
    ) -> List[Dict[str, Any]]:
        """
        Recebe a pergunta, uma lista de chunks candidatos e a quantidade desejada no corte.
        Devolve os chunks reordenados pela relevância do cross-encoder com a chave 'rerank_score'.
        """
        if not candidates:
            return []

        if not self.is_available or not self.ranker:
            # Se o ranker estiver indisponível, devolvo a ordem original da busca híbrida
            return candidates[:top_n]

        try:
            from flashrank import RerankRequest

            # O FlashRank exige id e text; guardo o item original em 'meta' para não perder bounding box ou metadados
            passages = [
                {
                    "id": str(item.get("id", idx)),
                    "text": item.get("text", item.get("text_content", "")),
                    "meta": item,
                }
                for idx, item in enumerate(candidates)
            ]

            rerank_request = RerankRequest(query=query, passages=passages)
            ranked_results = self.ranker.rerank(rerank_request)

            # Reconstruo a lista preservando todos os campos originais e adicionando a nota do reranker
            # TODO: o modelo TinyBERT foi treinado em inglês; pode ter perda de precisão em textos jurídicos em português
            reranked: List[Dict[str, Any]] = []
            for res in ranked_results[:top_n]:
                meta_item = dict(res["meta"])
                meta_item["rerank_score"] = round(float(res["score"]), 6)
                reranked.append(meta_item)

            return reranked

        except Exception as e:
            logger.error(f"[RerankService] Falha durante o rerank: {e}. Aplicando fallback.", exc_info=True)
            # Em caso de exceção no meio do cálculo, não travo a resposta do chat
            return candidates[:top_n]
