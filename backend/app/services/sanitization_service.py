import re
import html
from typing import List


class SanitizationService:
    """
    Limpa textos de documentos antes de indexar e monta o contexto RAG.
    Evita que instruções embutidas em PDFs tentem sobrescrever o prompt do sistema.
    """

    # Caracteres invisíveis (zero-width) e de controle ASCII.
    # PDFs maliciosos podem usar isso para esconder instruções sem o usuário ver na tela.
    ZERO_WIDTH_AND_CONTROL_CHARS_PATTERN = re.compile(
        r"[\u200B-\u200D\uFEFF\u200E\u200F\u202A-\u202E\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]"
    )

    # Tags e delimitadores comuns de templates de chat (Llama, ChatML, etc.).
    # Se o texto do PDF contiver algo como <system> ou [INST], renomeio para evitar injeção.
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
        Recebe texto bruto de um PDF e devolve o texto limpo sem caracteres de controle nem tokens de sistema.
        Cuidado: não remove ataques semânticos em linguagem natural, apenas desativa delimitadores conhecidos.
        """
        if not raw_text:
            return ""

        # Removo caracteres invisíveis para não passar texto escondido
        cleaned = cls.ZERO_WIDTH_AND_CONTROL_CHARS_PATTERN.sub("", raw_text)

        # Troco tokens de controle por versões inofensivas, ex: [INST] vira [INST_escaped]
        cleaned = cls.RAW_SYSTEM_TOKENS_PATTERN.sub(lambda m: f"[{m.group(0).strip('<>[]|')}_escaped]", cleaned)

        cleaned = cls.PROMPT_INJECTION_DELIMITERS_PATTERN.sub(r"[\1_escaped]", cleaned)

        # Padronizo quebras de linha e evito múltiplos \n vazios para não inflar contagem de tokens
        cleaned = re.sub(r"\r\n|\r", "\n", cleaned)
        cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)

        # TODO: sanitização baseada em regex não pega injeções em linguagem natural (ex: 'ignore previous instructions')
        return cleaned.strip()

    @classmethod
    def format_safe_rag_context(cls, citations: List[dict]) -> str:
        """
        Recebe a lista de citações recuperadas e devolve uma string formatada em XML para o prompt do LLM.
        Usa tags <document_evidence> para o modelo distinguir dados recuperados das instruções de sistema.
        """
        if not citations:
            return "Nenhum documento relevante encontrado."

        blocks = []
        for i, cite in enumerate(citations, 1):
            # html.escape no título para evitar que caracteres como < ou > fechem a tag antes da hora
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
