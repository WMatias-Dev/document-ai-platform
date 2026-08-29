import re
import html
from typing import List


class SanitizationService:
    """
    Serviço de higienização de texto e blindagem contra Indirect Prompt Injections.
    Garante que documentos maliciosos (com texto oculto ou comandos de evasão)
    não quebrem as instruções de sistema do modelo RAG.
    """

    # Caracteres invisíveis, zero-width e de controle que podem ocultar injeções
    ZERO_WIDTH_AND_CONTROL_CHARS_PATTERN = re.compile(
        r"[\u200B-\u200D\uFEFF\u200E\u200F\u202A-\u202E\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]"
    )

    # Delimitadores e tags comumente usados para fingir mensagens de sistema de LLMs
    PROMPT_INJECTION_DELIMITERS_PATTERN = re.compile(
        r"<\s*/?\s*(system|instruction|admin|developer|context|override|prompt|im_start|im_end)\s*>",
        re.IGNORECASE,
    )

    RAW_SYSTEM_TOKENS_PATTERN = re.compile(
        r"(\[INST\]|\[/INST\]|<<SYS>>|<</SYS>>|<\|im_start\|>|<\|im_end\|>|<\|system\|>|<\|user\|>|<\|assistant\|>)",
        re.IGNORECASE,
    )

    @classmethod
    def sanitize_text(cls, raw_text: str) -> str:
        """
        Higieniza o conteúdo textual extraído do PDF antes de indexar no banco.
        Execução ultra-leve em CPU (<0.2ms).
        """
        if not raw_text:
            return ""

        # 1. Remove caracteres invisíveis e de controle
        cleaned = cls.ZERO_WIDTH_AND_CONTROL_CHARS_PATTERN.sub("", raw_text)

        # 2. Escapa delimitadores de controle de LLM
        cleaned = cls.RAW_SYSTEM_TOKENS_PATTERN.sub(lambda m: f"[{m.group(0).strip('<>[]|')}_escaped]", cleaned)

        # 3. Neutraliza tags de sistema simuladas
        cleaned = cls.PROMPT_INJECTION_DELIMITERS_PATTERN.sub(r"[\1_escaped]", cleaned)

        # 4. Normaliza espaços múltiplos e quebras de linha excessivas
        cleaned = re.sub(r"\r\n|\r", "\n", cleaned)
        cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)

        return cleaned.strip()

    @classmethod
    def format_safe_rag_context(cls, citations: List[dict]) -> str:
        """
        Empacota as citações em tags XML passivas e imutáveis para alimentar o LLM,
        evitando que o modelo execute comandos dentro dos textos citados.
        """
        if not citations:
            return "Nenhum documento relevante encontrado."

        blocks = []
        for i, cite in enumerate(citations, 1):
            title = html.escape(cite.get("document_title", "Documento"))
            page = cite.get("page_number", 1)
            raw_snippet = cite.get("text_snippet", "")
            safe_snippet = cls.sanitize_text(raw_snippet)

            block = (
                f'<document_evidence index="{i}" title="{title}" page="{page}">\n'
                f"{safe_snippet}\n"
                f"</document_evidence>"
            )
            blocks.append(block)

        return "\n\n".join(blocks)
