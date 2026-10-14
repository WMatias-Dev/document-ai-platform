import html
import re
from typing import List


class SanitizationService:
    """
    Higieniza textos de documentos e formata o contexto RAG em envelopes estruturados.
    Impede que conteúdo não confiável de PDFs feche ou altere a estrutura dos blocos de evidências,
    desativa delimitadores de templates de IA e neutraliza caracteres de controle.

    AVISO DE SEGURANÇA:
    A sanitização contextual previne quebras estruturais de envelope (envelope breakout) e
    desativa tokens de controle conhecidos. No entanto, ela NÃO elimina todas as formas de
    prompt injection (ex: ataques semânticos, persuasão em linguagem natural ou engenharia social
    embutida no texto). Conteúdos recuperados devem ser sempre tratados pelo LLM como dados passivos.
    """

    # Caracteres invisíveis (zero-width) e de controle ASCII.
    ZERO_WIDTH_AND_CONTROL_CHARS_PATTERN = re.compile(
        r"[\u200B-\u200D\uFEFF\u200E\u200F\u202A-\u202E\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]"
    )

    # Delimitadores de template de LLM e tags de controle conhecidas (suportando atributos e espaços opcionais)
    PROMPT_INJECTION_DELIMITERS_PATTERN = re.compile(
        r"<\s*/?\s*(system|instruction|admin|developer|context|override|prompt|im_start|im_end)(?:\s+[^>]*|\s*/?)?>",
        re.IGNORECASE,
    )

    RAW_SYSTEM_TOKENS_PATTERN = re.compile(
        r"(\[INST\]|\[/INST\]|<<SYS>>|<</SYS>>|<\|im_start\|>|<\|im_end\|>|<\|system\|>|<\|user\|>|<\|assistant\|>)",
        re.IGNORECASE,
    )

    # Proteção contextual estrita para o envelope <document_evidence>:
    # Captura tags de abertura ou fechamento, com casing variado, variações de espaços, barras extras ou atributos
    EVIDENCE_TAG_PATTERN = re.compile(
        r"<\s*/?\s*document[-_]?evidence(?:\s+[^>]*|\s*/?)?>",
        re.IGNORECASE,
    )

    # Variações codificadas em entidades HTML/XML (ex: &lt;/document_evidence&gt;, &#60;..., &#x3c;..., incluindo atributos com &quot;)
    ENTITY_EVIDENCE_TAG_PATTERN = re.compile(
        r"(&lt;|&#60;|&#x3c;)\s*/?\s*document[-_]?evidence(?:(?!(?:&gt;|&#62;|&#x3e;|>))[\s\S])*?(&gt;|&#62;|&#x3e;)",
        re.IGNORECASE,
    )

    # Tags de evidência malformadas sem delimitador de fechamento '>' (ex: '</document_evidence\n')
    MALFORMED_EVIDENCE_PATTERN = re.compile(
        r"<\s*/?\s*document[-_]?evidence(?=[\s\r\n\"\'`]|/|$)",
        re.IGNORECASE,
    )

    @classmethod
    def sanitize_text(cls, raw_text: str) -> str:
        """
        Recebe texto bruto de um PDF ou mensagem e devolve o texto higienizado sem caracteres
        de controle, sem tokens de template e sem tags de envelope RAG.
        O texto semântico é preservado como evidência passiva.
        """
        if not raw_text:
            return ""

        # 1. Removo caracteres invisíveis e de controle para impedir ocultação de texto
        cleaned = cls.ZERO_WIDTH_AND_CONTROL_CHARS_PATTERN.sub("", raw_text)

        # 2. Desativo tokens de sistema brutos (ex: [INST] vira [INST_escaped])
        cleaned = cls.RAW_SYSTEM_TOKENS_PATTERN.sub(
            lambda m: f"[{m.group(0).strip('<>[]|')}_escaped]", cleaned
        )

        # 3. Desativo delimitadores de controle de template de chat
        cleaned = cls.PROMPT_INJECTION_DELIMITERS_PATTERN.sub(
            lambda m: f"[{m.group(1).lower()}_escaped]", cleaned
        )

        # 4. Desativo tags que tentem abrir ou fechar o envelope de evidências RAG
        cleaned = cls.EVIDENCE_TAG_PATTERN.sub(
            lambda m: f"[{m.group(0).strip('<>').strip()}_escaped]", cleaned
        )

        # 5. Desativo variações com entidades HTML/XML
        cleaned = cls.ENTITY_EVIDENCE_TAG_PATTERN.sub(
            lambda m: f"[entity_{m.group(0).strip('&;').strip()}_escaped]", cleaned
        )

        # 6. Desativo delimitadores malformados sem '>'
        cleaned = cls.MALFORMED_EVIDENCE_PATTERN.sub(
            r"[malformed_evidence_tag_escaped]", cleaned
        )

        # 7. Padronizo quebras de linha e evito múltiplos \n consecutivos
        cleaned = re.sub(r"\r\n|\r", "\n", cleaned)
        cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)

        return cleaned.strip()

    @classmethod
    def format_safe_rag_context(cls, citations: List[dict]) -> str:
        """
        Recebe a lista de citações recuperadas e formata em blocos XML rigorosamente isolados.
        Garante que os atributos de metadados não sofram injeção e que os snippets internos
        não consigam romper a estrutura do envelope <document_evidence>.
        """
        if not citations:
            return "Nenhum documento relevante encontrado."

        blocks = []
        for i, cite in enumerate(citations, 1):
            # Sanitiza título evitando quebras de linha ou injeção de atributos XML
            raw_title = str(cite.get("document_title", "Documento"))
            clean_title = re.sub(r"[\r\n\"]+", " ", raw_title).strip()
            title = html.escape(clean_title, quote=True)

            # Sanitiza página
            raw_page = str(cite.get("page_number", 1))
            clean_page = re.sub(r"[\r\n\"]+", " ", raw_page).strip()
            page = html.escape(clean_page, quote=True)

            raw_snippet = cite.get("text_snippet", "")
            safe_snippet = cls.sanitize_text(raw_snippet)

            block = (
                f'<document_evidence index="{i}" title="{title}" page="{page}">\n'
                f"{safe_snippet}\n"
                f"</document_evidence>"
            )
            blocks.append(block)

        return "\n\n".join(blocks)
