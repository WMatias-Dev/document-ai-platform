"use client";

import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";
import { ChatResponse, DocumentItem } from "@/types/api";
import { useChatStore } from "@/stores/useChatStore";
import {
  Send,
  Loader2,
  FileText,
  Trash2,
  BookmarkCheck,
  Scale,
  Calendar,
  Layers,
  FileSpreadsheet,
  BookOpen,
} from "lucide-react";

export function ChatPanel() {
  const {
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
    queryKey: ["documents"],
    queryFn: async () => {
      const res = await apiClient.get("/documents/");
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

      const targetDocId =
        selectedSourceIds.length === 1 ? selectedSourceIds[0] : null;

      const res = await apiClient.post<ChatResponse>("/chat/", {
        message: messageText,
        document_id: targetDocId,
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
      const msg = err.response?.data?.detail || "Erro ao consultar o acervo documental.";
      toast.error("Não foi possível obter resposta", { description: msg });
      addMessage({
        role: "assistant",
        content:
          "Ocorreu uma falha ao consultar as fontes documentais. Por favor, tente novamente.",
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

  const activeSourcesCount = selectedSourceIds.length;
  const sourcesBadgeLabel =
    activeSourcesCount === 0
      ? `${completedDocs.length} fontes ativas`
      : activeSourcesCount === 1
      ? "1 fonte selecionada"
      : `${activeSourcesCount} fontes selecionadas`;

  return (
    <main className="flex-1 h-full flex flex-col bg-[#131314] relative overflow-hidden">
      {/* Scrollable Conversation Feed */}
      <div className="flex-1 overflow-y-auto px-6 sm:px-12 py-8 space-y-6 pb-32">
        {messages.length === 0 ? (
          /* Editorial Document Workspace Empty State */
          <div className="flex min-h-[65vh] flex-col items-center justify-center text-center max-w-2xl mx-auto space-y-8 animate-in fade-in duration-200 select-none">
            <div className="space-y-2">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#1e1f20] border border-white/[0.08] text-zinc-400 mx-auto">
                <FileText className="h-5 w-5" />
              </div>
              <h2 className="text-xl sm:text-2xl font-medium tracking-tight text-zinc-100">
                Análise e Consulta Documental
              </h2>
              <p className="text-xs text-zinc-400 max-w-md mx-auto leading-relaxed">
                Faça perguntas diretamente sobre o conteúdo dos seus documentos.
                As respostas são fundamentadas e acompanhadas de referências de página e trecho.
              </p>
            </div>

            {/* Contextual Action Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-xl text-left">
              <button
                onClick={() =>
                  handlePromptSuggestion(
                    "Identifique as partes envolvidas, o objeto principal e as obrigações fundamentais descritas no documento."
                  )
                }
                className="flex items-start gap-3 rounded-2xl border border-white/[0.07] bg-[#1e1f20]/60 hover:bg-[#1e1f20] hover:border-white/15 p-4 text-left transition-all cursor-pointer group"
              >
                <div className="p-2 rounded-lg bg-zinc-800 text-zinc-300 shrink-0 group-hover:text-white">
                  <Scale className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-zinc-200 group-hover:text-white">
                    Partes e Obrigações
                  </h4>
                  <p className="text-[11px] text-zinc-400 mt-0.5 leading-snug">
                    Mapear signatários, responsabilidades e objeto.
                  </p>
                </div>
              </button>

              <button
                onClick={() =>
                  handlePromptSuggestion(
                    "Monte uma tabela comparativa com todas as datas, prazos de entrega e valores financeiros mencionados nas fontes."
                  )
                }
                className="flex items-start gap-3 rounded-2xl border border-white/[0.07] bg-[#1e1f20]/60 hover:bg-[#1e1f20] hover:border-white/15 p-4 text-left transition-all cursor-pointer group"
              >
                <div className="p-2 rounded-lg bg-zinc-800 text-zinc-300 shrink-0 group-hover:text-white">
                  <Calendar className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-zinc-200 group-hover:text-white">
                    Prazos e Valores
                  </h4>
                  <p className="text-[11px] text-zinc-400 mt-0.5 leading-snug">
                    Tabela estruturada de datas limites e quantias.
                  </p>
                </div>
              </button>

              <button
                onClick={() =>
                  handlePromptSuggestion(
                    "Identifique cláusulas de rescisão, multas aplicáveis e hipóteses de inadimplemento presentes nas fontes."
                  )
                }
                className="flex items-start gap-3 rounded-2xl border border-white/[0.07] bg-[#1e1f20]/60 hover:bg-[#1e1f20] hover:border-white/15 p-4 text-left transition-all cursor-pointer group"
              >
                <div className="p-2 rounded-lg bg-zinc-800 text-zinc-300 shrink-0 group-hover:text-white">
                  <BookOpen className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-zinc-200 group-hover:text-white">
                    Rescisão e Penalidades
                  </h4>
                  <p className="text-[11px] text-zinc-400 mt-0.5 leading-snug">
                    Condições de encerramento e sanções previstas.
                  </p>
                </div>
              </button>

              <button
                onClick={() =>
                  handlePromptSuggestion(
                    "Liste os termos técnicos, definições e siglas estabelecidas ao longo do texto."
                  )
                }
                className="flex items-start gap-3 rounded-2xl border border-white/[0.07] bg-[#1e1f20]/60 hover:bg-[#1e1f20] hover:border-white/15 p-4 text-left transition-all cursor-pointer group"
              >
                <div className="p-2 rounded-lg bg-zinc-800 text-zinc-300 shrink-0 group-hover:text-white">
                  <FileSpreadsheet className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-zinc-200 group-hover:text-white">
                    Definições e Glossário
                  </h4>
                  <p className="text-[11px] text-zinc-400 mt-0.5 leading-snug">
                    Termos jurídicos, técnicos e abreviações.
                  </p>
                </div>
              </button>
            </div>

            {completedDocs.length === 0 && (
              <div className="rounded-xl border border-dashed border-white/10 bg-[#1e1f20]/40 p-3.5 max-w-md text-xs text-zinc-400">
                Nenhum documento anexado a este caderno.{" "}
                <button
                  onClick={() => setAddSourceModalOpen(true)}
                  className="text-zinc-200 underline font-medium hover:text-white cursor-pointer ml-1"
                >
                  Adicionar PDF
                </button>
              </div>
            )}
          </div>
        ) : (
          /* Message Stream */
          messages.map((msg) => {
            const isUser = msg.role === "user";

            return (
              <div
                key={msg.id}
                className={`flex gap-3 max-w-3xl mx-auto ${
                  isUser ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`rounded-2xl p-5 ${
                    isUser
                      ? "bg-[#282a2c] text-white border border-white/10 max-w-[85%]"
                      : "bg-[#1e1f20] text-zinc-200 border border-white/[0.06] flex-1"
                  }`}
                >
                  {isUser ? (
                    <p className="text-sm leading-relaxed whitespace-pre-wrap font-normal">
                      {msg.content}
                    </p>
                  ) : (
                    <div className="prose prose-invert prose-sm max-w-none text-zinc-200 leading-relaxed font-normal">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  )}

                  {/* Footnote-style Citations */}
                  {!isUser && msg.citations && msg.citations.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-white/[0.06] flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] font-medium text-zinc-500 mr-1">
                        Fontes citadas:
                      </span>
                      {msg.citations.map((cite, idx) => (
                        <button
                          key={cite.chunk_id || idx}
                          onClick={() => openCitationInStudio(cite)}
                          title={`Clique para inspecionar o trecho no Estúdio (${(
                            cite.similarity_score * 100
                          ).toFixed(0)}% similaridade)`}
                          className="inline-flex items-center gap-1.5 rounded-md bg-[#131314] hover:bg-[#282a2c] border border-white/10 px-2.5 py-1 text-[11px] text-zinc-300 hover:text-white transition-all cursor-pointer group"
                        >
                          <span className="font-mono text-zinc-400 font-semibold">
                            [{idx + 1}]
                          </span>
                          <span className="truncate max-w-[150px]">
                            {cite.document_title}
                          </span>
                          <span className="text-[10px] text-zinc-500 font-mono">
                            #p.{cite.chunk_index}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}

        {/* Loading State */}
        {chatMutation.isPending && (
          <div className="flex gap-3 max-w-3xl mx-auto justify-start">
            <div className="rounded-2xl bg-[#1e1f20] border border-white/[0.06] p-4 text-xs text-zinc-400 flex items-center gap-2.5">
              <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
              <span>Consultando acervo e sintetizando referências...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Floating Bottom Input Bar */}
      <div className="absolute bottom-4 left-0 right-0 px-4 sm:px-12 flex justify-center pointer-events-none">
        <form
          onSubmit={handleSubmit}
          className="pointer-events-auto w-full max-w-3xl flex items-center gap-2 rounded-2xl border border-white/10 bg-[#1e1f20]/95 backdrop-blur-xl p-2 pl-4 shadow-2xl transition-all focus-within:border-white/20"
        >
          {/* Active Sources Pill */}
          <div className="hidden sm:inline-flex items-center gap-1.5 rounded-lg bg-[#131314] px-2.5 py-1 text-[11px] font-medium text-zinc-400 border border-white/5 shrink-0">
            <BookmarkCheck className="h-3.5 w-3.5 text-zinc-500" />
            <span>{sourcesBadgeLabel}</span>
          </div>

          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={chatMutation.isPending}
            placeholder="Faça uma pergunta sobre os documentos..."
            className="flex-1 bg-transparent px-2 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none disabled:opacity-50"
          />

          {messages.length > 0 && (
            <button
              type="button"
              onClick={clearMessages}
              title="Limpar histórico da conversa"
              className="p-2 rounded-xl text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-colors cursor-pointer"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}

          <button
            type="submit"
            disabled={chatMutation.isPending || !inputText.trim()}
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-zinc-200 hover:bg-white text-zinc-900 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0"
          >
            {chatMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin text-zinc-900" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
          </button>
        </form>
      </div>
    </main>
  );
}
