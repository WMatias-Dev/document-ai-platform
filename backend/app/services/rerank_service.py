import logging
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


class RerankService:
    """
    Serviço de Reranking ultra-leve baseado em FlashRank (ONNX Runtime / CPU).
    Zero dependência de GPU pesada ou PyTorch. Memória: ~15MB. Latência média: ~5-10ms.
    """

    def __init__(self, model_name: str = "ms-marco-TinyBERT-L-2-v2"):
        self.model_name = model_name
        self.ranker = None
        self.is_available = False
        self._initialize_ranker()

    def _initialize_ranker(self) -> None:
        try:
            from flashrank import Ranker
            self.ranker = Ranker(model_name=self.model_name)
            self.is_available = True
            logger.info(f"[RerankService] FlashRank inicializado com sucesso (modelo: {self.model_name}).")
        except Exception as e:
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
        Reordena candidatos a partir de atenção cruzada bidirecional (Cross-Encoder).
        Cada item em 'candidates' deve possuir a chave 'text' (ou 'text_content').
        """
        if not candidates:
            return []

        if not self.is_available or not self.ranker:
            # Fallback seguro: retorna os primeiros top_n candidatos sem quebrar o fluxo
            return candidates[:top_n]

        try:
            from flashrank import RerankRequest

            # Formata os candidatos preservando o payload completo nos metadados
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

            reranked: List[Dict[str, Any]] = []
            for res in ranked_results[:top_n]:
                meta_item = dict(res["meta"])
                meta_item["rerank_score"] = round(float(res["score"]), 6)
                reranked.append(meta_item)

            return reranked

        except Exception as e:
            logger.error(f"[RerankService] Falha durante o rerank: {e}. Aplicando fallback.", exc_info=True)
            return candidates[:top_n]
