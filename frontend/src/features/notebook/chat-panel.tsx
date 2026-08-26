"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import { apiClient, getErrorMessage } from "@/lib/api-client";
import {
  DocumentItem,
  DocumentCitation,
  ChatThreadItem,
  ChatMessageDetail,
} from "@/types/api";
import { useChatStore } from "@/stores/useChatStore";
import { useAuthStore } from "@/stores/useAuthStore";
import { UNIVERSAL_QUICK_TASKS } from "./quick-tasks";
import {
  Loader2,
  Trash2,
  BookmarkCheck,
  CornerDownLeft,
  Search,
  Sparkles,
} from "lucide-react";

export function ChatPanel() {
  const queryClient = useQueryClient();
  const { token } = useAuthStore();
  const {
    activeNotebookId,
    messagesByNotebook,
    getMessages,
    setMessagesForNotebook,
    addMessageToNotebook,
    updateLastMessageForNotebook,
    clearMessagesForNotebook,
    getActiveThreadId,
    setActiveThreadIdForNotebook,
    selectedSourceIds,
    openCitationInStudio,
    setAddSourceModalOpen,
    isStreaming,
    setIsStreaming,
  } = useChatStore();

  const [inputText, setInputText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isFetchingHistory = useRef(false);

  // Mensagens e thread vinculadas unicamente ao notebookId atual
  const messages = getMessages(activeNotebookId);
  const activeThreadId = getActiveThreadId(activeNotebookId);

  const isUUID =
    !!activeNotebookId &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      activeNotebookId
    );

  // 1. Carrega Documentos do Caderno Atual
  const { data: documents = [] } = useQuery<DocumentItem[]>({
    queryKey: activeNotebookId
      ? ["notebook_documents", activeNotebookId]
      : ["documents"],
    queryFn: async () => {
      const url = isUUID
        ? `/notebooks/${activeNotebookId}/documents`
        : "/documents/";
      const res = await apiClient.get(url);
      return res.data;
    },
  });

  const completedDocs = documents.filter((d) => d.status === "COMPLETED");

  // 2. Carregamento Isolado do Histórico do Caderno Atual
  useEffect(() => {
    async function loadHistory() {
      // Se já temos mensagens em memória para este caderno, não recarrega
      const existing = messagesByNotebook[activeNotebookId || "global"];
      if (existing && existing.length > 0) return;

      if (isFetchingHistory.current) return;
      isFetchingHistory.current = true;

      try {
        const threadUrl = isUUID
          ? `/chat/threads?notebook_id=${activeNotebookId}`
          : "/chat/threads";
        const threadsRes = await apiClient.get<ChatThreadItem[]>(threadUrl);
        const threads = threadsRes.data;

        if (threads && threads.length > 0) {
          const latestThread = threads[0];
          setActiveThreadIdForNotebook(activeNotebookId, latestThread.id);

          const msgsRes = await apiClient.get<ChatMessageDetail[]>(
            `/chat/threads/${latestThread.id}/messages`
          );
          const savedMsgs = msgsRes.data;

          if (savedMsgs && savedMsgs.length > 0) {
            setMessagesForNotebook(
              activeNotebookId,
              savedMsgs.map((m) => ({
                id: m.id,
                role: m.role,
                content: m.content,
                citations: (m.citations as DocumentCitation[]) || [],
                model: m.model_used || "gemini-3.5-flash-lite",
                createdAt: new Date(m.created_at),
              }))
            );
          }
        }
      } catch (err) {
        console.error("Erro ao recuperar histórico do chat:", err);
      } finally {
        isFetchingHistory.current = false;
      }
    }

    loadHistory();
  }, [
    activeNotebookId,
    isUUID,
    messagesByNotebook,
    setActiveThreadIdForNotebook,
    setMessagesForNotebook,
  ]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  // 3. Executor de Chat com Streaming SSE e Isolamento Estrito
  const executeStreamChat = useCallback(
    async (queryText: string) => {
      if (!queryText.trim() || isStreaming) return;

      setIsStreaming(true);

      // Adiciona mensagem do usuário no histórico do caderno ativo
      addMessageToNotebook(activeNotebookId, {
        role: "user",
        content: queryText,
      });

      // Cria mensagem placeholder do assistente para streaming progressivo
      addMessageToNotebook(activeNotebookId, {
        role: "assistant",
        content: "",
        citations: [],
      });

      const currentMsgs = getMessages(activeNotebookId);
      const historyPayload = currentMsgs.slice(-6).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const apiBase =
        process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const authToken =
        token ||
        (typeof window !== "undefined"
          ? localStorage.getItem("doc_ai_token")
          : "") ||
        "";

      try {
        const response = await fetch(`${apiBase}/chat/stream`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            message: queryText,
            thread_id: activeThreadId || null,
            notebook_id: isUUID ? activeNotebookId : null,
            source_ids: selectedSourceIds.length > 0 ? selectedSourceIds : null,
            history: historyPayload,
            max_chunks: 5,
          }),
        });

        if (!response.ok) {
          throw new Error(`Falha no streaming: HTTP ${response.status}`);
        }

        if (!response.body) {
          throw new Error("Corpo da resposta vazio.");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let accumulatedText = "";
        let finalCitations: DocumentCitation[] = [];
        let modelUsed = "gemini-3.5-flash-lite";

        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          let currentEvent = "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            if (trimmed.startsWith("event:")) {
              currentEvent = trimmed.replace("event:", "").trim();
              continue;
            }

            if (trimmed.startsWith("data:")) {
              const dataStr = trimmed.replace("data:", "").trim();
              try {
                const parsed = JSON.parse(dataStr);

                if (currentEvent === "citations") {
                  finalCitations = parsed as DocumentCitation[];
                  updateLastMessageForNotebook(
                    activeNotebookId,
                    accumulatedText,
                    finalCitations,
                    modelUsed
                  );
                } else if (currentEvent === "delta") {
                  accumulatedText += parsed.text || "";
                  updateLastMessageForNotebook(
                    activeNotebookId,
                    accumulatedText,
                    finalCitations,
                    modelUsed
                  );
                } else if (currentEvent === "done") {
                  if (parsed.thread_id) {
                    setActiveThreadIdForNotebook(
                      activeNotebookId,
                      parsed.thread_id
                    );
                  }
                  if (parsed.model) {
                    modelUsed = parsed.model;
                  }
                  updateLastMessageForNotebook(
                    activeNotebookId,
                    accumulatedText,
                    finalCitations,
                    modelUsed
                  );
                } else if (currentEvent === "error") {
                  toast.error("Erro no processamento", {
                    description: parsed.detail || "Falha no pipeline RAG.",
                  });
                }
              } catch {
                // Linha de texto simples
              }
            }
          }
        }
      } catch (err: any) {
        console.error("Erro no streaming SSE:", err);
        const msg = getErrorMessage(err, "Falha de conexão com o chat RAG.");
        toast.error("Erro na consulta", { description: msg });
        updateLastMessageForNotebook(
          activeNotebookId,
          "Desculpe, ocorreu uma falha ao consultar as fontes deste caderno. Por favor, tente novamente.",
          [],
          "gemini-3.5-flash-lite"
        );
      } finally {
        setIsStreaming(false);
        queryClient.invalidateQueries({ queryKey: ["chat_threads"] });
      }
    },
    [
      isStreaming,
      activeNotebookId,
      activeThreadId,
      isUUID,
      selectedSourceIds,
      token,
      addMessageToNotebook,
      getMessages,
      updateLastMessageForNotebook,
      setActiveThreadIdForNotebook,
      setIsStreaming,
      queryClient,
    ]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isStreaming) return;
    const query = inputText.trim();
    setInputText("");
    executeStreamChat(query);
  };

  const handlePromptSuggestion = (promptText: string) => {
    if (isStreaming) return;
    executeStreamChat(promptText);
  };

  const handleClearHistory = () => {
    clearMessagesForNotebook(activeNotebookId);
    toast.info("Histórico de conversa deste caderno foi limpo.");
  };

  return (
    <div className="flex-1 flex flex-col bg-[#0C0D0E] h-full overflow-hidden border-r border-[#242628]">
      {/* 1. Header do Painel Central */}
      <div className="h-10 border-b border-[#242628] px-4 flex items-center justify-between shrink-0 bg-[#0C0D0E]">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono uppercase tracking-wider text-[#85888C]">
            Dossiê de Pesquisa & Chat
          </span>
          {isStreaming && (
            <span className="inline-flex items-center gap-1 text-[10px] font-mono text-[#D97706] bg-[#D97706]/10 px-2 py-0.5 rounded border border-[#D97706]/20 animate-pulse">
              <span className="h-1.5 w-1.5 rounded-full bg-[#D97706]" />
              Gerando Resposta...
            </span>
          )}
        </div>

        {messages.length > 0 && (
          <button
            onClick={handleClearHistory}
            className="flex items-center gap-1 text-[11px] font-mono text-[#85888C] hover:text-[#EF4444] transition-colors cursor-pointer"
            title="Limpar histórico deste caderno"
          >
            <Trash2 className="h-3 w-3" />
            <span>Limpar Histórico</span>
          </button>
        )}
      </div>

      {/* 2. Área de Conteúdo / Diálogo */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
        {messages.length === 0 ? (
          /* Estado Vazio com Catálogo Universal de Tarefas Rápidas (NotebookLM Style) */
          <div className="h-full flex flex-col items-center justify-center text-center max-w-2xl mx-auto space-y-6 py-8">
            <div className="space-y-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#161719] border border-[#242628] mx-auto text-[#D97706]">
                <BookmarkCheck className="h-5 w-5" />
              </div>
              <h3 className="text-base font-sans font-medium text-[#E3E3E3]">
                Assistente de Análise Documental
              </h3>
              <p className="text-xs font-serif text-[#85888C] max-w-md mx-auto leading-relaxed">
                Faça perguntas em linguagem natural ou execute uma tarefa de síntese com embasamento rigoroso nas fontes indexadas.
              </p>
            </div>

            {/* Grid 2x3 de Tarefas Prontas Universais */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full text-left">
              {UNIVERSAL_QUICK_TASKS.map((task) => {
                const Icon = task.icon;
                return (
                  <button
                    key={task.id}
                    onClick={() => handlePromptSuggestion(task.prompt)}
                    disabled={isStreaming}
                    className="flex items-start gap-2.5 rounded border border-[#242628] bg-[#161719] hover:bg-[#1C1D20] hover:border-[#383B40] p-3 transition-all cursor-pointer group disabled:opacity-50"
                  >
                    <Icon className="h-3.5 w-3.5 text-[#85888C] shrink-0 mt-0.5 group-hover:text-[#E3E3E3]" />
                    <div className="min-w-0 flex-1">
                      <h4 className="text-xs font-sans font-medium text-[#E3E3E3] group-hover:text-white flex items-center justify-between">
                        <span>{task.title}</span>
                        <span className="text-[10px] font-mono text-[#85888C] group-hover:text-[#E3E3E3]">
                          ↵
                        </span>
                      </h4>
                      <p className="text-[10px] font-mono text-[#85888C] mt-0.5 line-clamp-2">
                        {task.subtitle}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            {completedDocs.length === 0 && (
              <div className="rounded border border-dashed border-[#242628] bg-[#161719]/40 p-3 max-w-sm text-xs font-sans text-[#85888C]">
                Nenhum documento vinculado a este caderno.{" "}
                <button
                  onClick={() => setAddSourceModalOpen(true)}
                  className="text-[#E3E3E3] underline font-medium hover:text-white cursor-pointer ml-1"
                >
                  Anexar arquivo PDF
                </button>
              </div>
            )}
          </div>
        ) : (
          /* Entradas do Dossiê Contínuo */
          messages.map((msg, index) => {
            const isUser = msg.role === "user";
            const isLatestAssistant =
              !isUser && index === messages.length - 1 && isStreaming;

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
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-3 w-3 text-[#D97706]" />
                    <span className="uppercase tracking-widest text-[#85888C]">
                      Parecer de Análise Sintetizada
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {msg.model && (
                      <span className="text-[10px] font-mono text-[#55585D] hidden sm:inline">
                        {msg.model}
                      </span>
                    )}
                    <span className="text-[#55585D]">
                      {new Date(msg.createdAt || Date.now()).toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>

                {/* Editorial Body (Source Serif 4) com cursor de streaming pulsante */}
                <div className="font-serif text-sm text-[#E3E3E3] leading-relaxed space-y-3 prose prose-invert max-w-none">
                  {msg.content ? (
                    <>
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {msg.content}
                      </ReactMarkdown>
                      {isLatestAssistant && (
                        <span className="inline-block animate-pulse text-[#D97706] font-mono ml-0.5 text-base">
                          ▍
                        </span>
                      )}
                    </>
                  ) : isLatestAssistant ? (
                    <div className="flex items-center gap-2 text-xs font-mono text-[#85888C] py-2">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-[#D97706]" />
                      <span>Consultando evidências nos documentos...</span>
                    </div>
                  ) : null}
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
        <div ref={messagesEndRef} />
      </div>

      {/* 3. Barra Inferior de Entrada Fixa */}
      <div className="p-4 border-t border-[#242628] bg-[#0C0D0E] shrink-0">
        <div className="max-w-3xl mx-auto space-y-2">
          {selectedSourceIds.length > 0 && (
            <div className="flex items-center gap-2 text-[10px] font-mono text-[#D97706] bg-[#D97706]/10 px-2 py-0.5 rounded border border-[#D97706]/20">
              <span>Filtrando estritamente em {selectedSourceIds.length} fonte(s) selecionada(s)</span>
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            className="relative flex items-center rounded-lg border border-[#242628] bg-[#161719] focus-within:border-[#383B40] transition-colors shadow-sm"
          >
            <textarea
              rows={1}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
              placeholder={
                completedDocs.length === 0
                  ? "Anexe documentos ao caderno para habilitar a consulta..."
                  : "Pergunte sobre os documentos ou solicite uma análise estruturada..."
              }
              disabled={isStreaming}
              className="w-full resize-none bg-transparent px-3.5 py-3 text-xs text-[#E3E3E3] placeholder-[#55585D] focus:outline-none font-sans max-h-32"
            />

            <div className="flex items-center gap-1.5 pr-2.5">
              <button
                type="submit"
                disabled={!inputText.trim() || isStreaming}
                className="flex h-7 w-7 items-center justify-center rounded bg-[#E3E3E3] hover:bg-white text-[#0C0D0E] transition-colors disabled:opacity-40 disabled:hover:bg-[#E3E3E3] cursor-pointer"
                title="Enviar consulta (Enter)"
              >
                {isStreaming ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CornerDownLeft className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          </form>
          <div className="flex items-center justify-between text-[10px] font-mono text-[#55585D] px-1">
            <span>Enter para enviar • Shift + Enter para quebra de linha</span>
            <span>RAG com busca vetorial pgvector & Gemini 3.5</span>
          </div>
        </div>
      </div>
    </div>
  );
}
