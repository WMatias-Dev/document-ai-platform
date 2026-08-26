"use client";

import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";
import { ChatResponse, DocumentItem, DocumentCitation } from "@/types/api";
import { useChatStore } from "@/stores/useChatStore";
import {
  Send,
  Loader2,
  Trash2,
  BookmarkCheck,
  Scale,
  Calendar,
  BookOpen,
  FileSpreadsheet,
  CornerDownLeft,
  Search,
} from "lucide-react";

export function ChatPanel() {
  const {
    activeNotebookId,
    messages,
    addMessage,
    clearMessages,
    selectedSourceIds,
    openCitationInStudio,
    setAddSourceModalOpen,
  } = useChatStore();

  const [inputText, setInputText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: documents = [] } = useQuery<DocumentItem[]>({
    queryKey: activeNotebookId
      ? ["notebook_documents", activeNotebookId]
      : ["documents"],
    queryFn: async () => {
      const url = activeNotebookId
        ? `/notebooks/${activeNotebookId}/documents`
        : "/documents/";
      const res = await apiClient.get(url);
      return res.data;
    },
  });

  const completedDocs = documents.filter((d) => d.status === "COMPLETED");

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const chatMutation = useMutation({
    mutationFn: async (messageText: string) => {
      const historyPayload = messages.slice(-6).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await apiClient.post<ChatResponse>("/chat/", {
        message: messageText,
        notebook_id: activeNotebookId,
        source_ids: selectedSourceIds.length > 0 ? selectedSourceIds : null,
        history: historyPayload,
        max_chunks: 5,
      });

      return res.data;
    },
    onSuccess: (data) => {
      addMessage({
        role: "assistant",
        content: data.answer,
        citations: data.citations,
        model: data.model,
      });
    },
    onError: (err: any) => {
      const msg =
        err.response?.data?.detail || "Erro ao consultar o acervo documental.";
      toast.error("Falha na consulta", { description: msg });
      addMessage({
        role: "assistant",
        content:
          "Ocorreu uma falha ao recuperar evidências nos documentos. Por favor, reformule a consulta ou verifique as fontes selecionadas.",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || chatMutation.isPending) return;

    const query = inputText.trim();
    setInputText("");

    addMessage({
      role: "user",
      content: query,
    });

    chatMutation.mutate(query);
  };

  const handlePromptSuggestion = (text: string) => {
    addMessage({
      role: "user",
      content: text,
    });
    chatMutation.mutate(text);
  };

  const activeCount = selectedSourceIds.length;
  const sourcesBadgeLabel =
    activeCount === 0
      ? `${completedDocs.length} fontes ativas no caderno`
      : activeCount === 1
      ? "1 fonte selecionada"
      : `${activeCount} fontes selecionadas`;

  return (
    <main className="flex-1 h-full flex flex-col bg-[#0C0D0E] relative overflow-hidden">
      {/* Scrollable Research Memo & Dossier Feed */}
      <div className="flex-1 overflow-y-auto px-6 sm:px-12 py-8 space-y-10 pb-36">
        {messages.length === 0 ? (
          /* Structured Editorial Empty State */
          <div className="flex min-h-[60vh] flex-col items-center justify-center text-center max-w-xl mx-auto space-y-6 animate-in fade-in duration-150 select-none">
            <div className="space-y-1.5">
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#85888C] bg-[#161719] px-2 py-0.5 rounded border border-[#242628]">
                Bancada de Investigação Documental
              </span>
              <h2 className="text-lg font-serif font-medium tracking-tight text-[#E3E3E3] pt-2">
                Consulta e Extração de Evidências
              </h2>
              <p className="text-xs font-sans text-[#85888C] max-w-md mx-auto leading-relaxed">
                Formule perguntas sobre o acervo anexado. Cada resposta é
                apresentada no formato de memorando técnico com citações e
                trechos auditáveis.
              </p>
            </div>

            {/* Contextual Analytical Suggestions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full text-left">
              <button
                onClick={() =>
                  handlePromptSuggestion(
                    "Identifique as partes envolvidas, o objeto principal e as obrigações fundamentais descritas no documento."
                  )
                }
                className="flex items-start gap-2.5 rounded border border-[#242628] bg-[#161719] hover:bg-[#1C1D20] hover:border-[#383B40] p-3 transition-all cursor-pointer group"
              >
                <Scale className="h-3.5 w-3.5 text-[#85888C] shrink-0 mt-0.5 group-hover:text-[#E3E3E3]" />
                <div>
                  <h4 className="text-xs font-sans font-medium text-[#E3E3E3] group-hover:text-white">
                    Partes e Obrigações
                  </h4>
                  <p className="text-[10px] font-mono text-[#85888C] mt-0.5">
                    Mapear signatários e objeto.
                  </p>
                </div>
              </button>

              <button
                onClick={() =>
                  handlePromptSuggestion(
                    "Monte uma tabela comparativa com todas as datas, prazos de entrega e valores financeiros mencionados nas fontes."
                  )
                }
                className="flex items-start gap-2.5 rounded border border-[#242628] bg-[#161719] hover:bg-[#1C1D20] hover:border-[#383B40] p-3 transition-all cursor-pointer group"
              >
                <Calendar className="h-3.5 w-3.5 text-[#85888C] shrink-0 mt-0.5 group-hover:text-[#E3E3E3]" />
                <div>
                  <h4 className="text-xs font-sans font-medium text-[#E3E3E3] group-hover:text-white">
                    Prazos e Valores
                  </h4>
                  <p className="text-[10px] font-mono text-[#85888C] mt-0.5">
                    Tabela estruturada de datas e quantias.
                  </p>
                </div>
              </button>

              <button
                onClick={() =>
                  handlePromptSuggestion(
                    "Identifique cláusulas de rescisão, multas aplicáveis e hipóteses de inadimplemento presentes nas fontes."
                  )
                }
                className="flex items-start gap-2.5 rounded border border-[#242628] bg-[#161719] hover:bg-[#1C1D20] hover:border-[#383B40] p-3 transition-all cursor-pointer group"
              >
                <BookOpen className="h-3.5 w-3.5 text-[#85888C] shrink-0 mt-0.5 group-hover:text-[#E3E3E3]" />
                <div>
                  <h4 className="text-xs font-sans font-medium text-[#E3E3E3] group-hover:text-white">
                    Rescisão e Penalidades
                  </h4>
                  <p className="text-[10px] font-mono text-[#85888C] mt-0.5">
                    Sanções e regras de término.
                  </p>
                </div>
              </button>

              <button
                onClick={() =>
                  handlePromptSuggestion(
                    "Liste os termos técnicos, definições e siglas estabelecidas ao longo do texto."
                  )
                }
                className="flex items-start gap-2.5 rounded border border-[#242628] bg-[#161719] hover:bg-[#1C1D20] hover:border-[#383B40] p-3 transition-all cursor-pointer group"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-[#85888C] shrink-0 mt-0.5 group-hover:text-[#E3E3E3]" />
                <div>
                  <h4 className="text-xs font-sans font-medium text-[#E3E3E3] group-hover:text-white">
                    Glossário e Definições
                  </h4>
                  <p className="text-[10px] font-mono text-[#85888C] mt-0.5">
                    Termos jurídicos e abreviações.
                  </p>
                </div>
              </button>
            </div>

            {completedDocs.length === 0 && (
              <div className="rounded border border-dashed border-[#242628] bg-[#161719]/40 p-3 max-w-sm text-xs font-sans text-[#85888C]">
                Nenhum PDF vinculado a este caderno.{" "}
                <button
                  onClick={() => setAddSourceModalOpen(true)}
                  className="text-[#E3E3E3] underline font-medium hover:text-white cursor-pointer ml-1"
                >
                  Anexar documento
                </button>
              </div>
            )}
          </div>
        ) : (
          /* Continuous Research Memo / Dossier Entries */
          messages.map((msg, index) => {
            const isUser = msg.role === "user";

            if (isUser) {
              return (
                <div
                  key={msg.id || index}
                  className="max-w-3xl mx-auto border-b border-[#242628] pb-3 pt-2"
                >
                  <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-[#85888C]">
                    <Search className="h-3 w-3 text-[#D97706]" />
                    <span>Consulta Documental</span>
                  </div>
                  <h3 className="text-sm font-sans font-medium text-[#E3E3E3] mt-1.5 leading-snug">
                    {msg.content}
                  </h3>
                </div>
              );
            }

            return (
              <div
                key={msg.id || index}
                className="max-w-3xl mx-auto space-y-4 rounded border border-[#242628] bg-[#161719] p-6 shadow-sm"
              >
                {/* Memo Header */}
                <div className="flex items-center justify-between border-b border-[#242628] pb-3 text-[10px] font-mono text-[#85888C]">
                  <span className="uppercase tracking-widest text-[#85888C]">
                    Parecer de Análise Sintetizada
                  </span>
                  <span className="text-[#55585D]">
                    {new Date(msg.createdAt || Date.now()).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>

                {/* Editorial Body (Source Serif 4) */}
                <div className="font-serif text-sm text-[#E3E3E3] leading-relaxed space-y-3 prose prose-invert max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {msg.content}
                  </ReactMarkdown>
                </div>

                {/* Academic Footnotes & Citations Table */}
                {msg.citations && msg.citations.length > 0 && (
                  <div className="mt-5 pt-3.5 border-t border-[#242628] space-y-2">
                    <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-[#85888C]">
                      <span>Evidências e Fontes Citadas</span>
                      <span>[{msg.citations.length} Referências]</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {msg.citations.map((cite, idx) => (
                        <button
                          key={cite.chunk_id || idx}
                          onClick={() => openCitationInStudio(cite)}
                          title="Inspecionar trecho original no painel lateral de evidências"
                          className="flex items-center justify-between rounded border border-[#242628] bg-[#0C0D0E] hover:bg-[#222427] hover:border-[#383B40] px-2.5 py-1.5 text-left transition-colors cursor-pointer group"
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-[10px] font-mono font-semibold text-[#D97706]">
                              [{idx + 1}]
                            </span>
                            <span className="text-xs font-sans font-medium text-[#E3E3E3] truncate max-w-[140px]">
                              {cite.document_title}
                            </span>
                          </div>
                          <span className="text-[10px] font-mono text-[#85888C]">
                            p.{cite.chunk_index}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* Loading Indicator */}
        {chatMutation.isPending && (
          <div className="max-w-3xl mx-auto rounded border border-[#242628] bg-[#161719] p-4 flex items-center gap-2.5 text-xs font-mono text-[#85888C]">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-[#D97706]" />
            <span>Recuperando fragmentos no banco vetorial e sintetizando parecer...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Anchored Bottom Command Bar */}
      <div className="absolute bottom-0 left-0 right-0 border-t border-[#242628] bg-[#161719]/95 backdrop-blur-sm p-3 px-6 sm:px-12 z-20">
        <form
          onSubmit={handleSubmit}
          className="max-w-3xl mx-auto flex items-center gap-2 rounded border border-[#242628] bg-[#0C0D0E] px-3 py-1.5 focus-within:border-[#383B40] transition-colors"
        >
          {/* Active Sources Scope Pill */}
          <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-mono text-[#85888C] bg-[#161719] px-2 py-0.5 rounded border border-[#242628] shrink-0">
            <BookmarkCheck className="h-3 w-3 text-[#10B981]" />
            <span>{sourcesBadgeLabel}</span>
          </span>

          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={chatMutation.isPending}
            placeholder="Formule uma pergunta ou requisição sobre os documentos..."
            className="flex-1 bg-transparent px-1 py-1 text-xs text-[#E3E3E3] placeholder-[#55585D] focus:outline-none disabled:opacity-50 font-sans"
          />

          {messages.length > 0 && (
            <button
              type="button"
              onClick={clearMessages}
              title="Limpar histórico de pesquisa"
              className="p-1 rounded text-[#85888C] hover:text-[#E3E3E3] hover:bg-[#161719] transition-colors cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}

          <button
            type="submit"
            disabled={chatMutation.isPending || !inputText.trim()}
            className="flex items-center gap-1 rounded bg-[#E3E3E3] hover:bg-white text-[#0C0D0E] font-medium px-2.5 py-1 text-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0"
          >
            {chatMutation.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <>
                <span className="font-mono text-[10px]">Executar</span>
                <CornerDownLeft className="h-3 w-3" />
              </>
            )}
          </button>
        </form>
      </div>
    </main>
  );
}
