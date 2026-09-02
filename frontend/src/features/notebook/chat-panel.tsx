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
  FileEdit,
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
    appendNoteToNotebook,
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
            max_chunks: 25,
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

  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleCopyMessage = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    toast.success("Mensagem copiada!");
    setTimeout(() => setCopiedIndex(null), 2000);
  };

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
    <div className="flex-1 flex flex-col h-full bg-slate-100/60 min-w-0 select-text">
      {/* 1. Header do Chat (Estilo Mensageiro Moderno) */}
      <div className="h-14 border-b border-slate-200/80 bg-white/95 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between shrink-0 shadow-2xs z-10">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-xs">
              <Sparkles className="h-4 w-4" />
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 border-2 border-white" />
            </span>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xs sm:text-sm font-semibold text-slate-800">
                Assistente Documental
              </h2>
              {isStreaming && (
                <span className="inline-flex items-center gap-1 text-[10px] font-sans font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/70">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  digitando...
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 flex items-center gap-1">
              <span>{completedDocs.length} fonte(s) ativa(s)</span>
              {selectedSourceIds.length > 0 && (
                <span className="text-emerald-700 font-medium">
                  • {selectedSourceIds.length} selecionada(s)
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <button
              onClick={handleClearHistory}
              disabled={isStreaming}
              className="flex items-center gap-1.5 text-xs font-sans text-slate-400 hover:text-red-600 hover:bg-red-50/70 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer disabled:opacity-40"
              title="Limpar histórico de conversa"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Limpar Chat</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Área de Mensagens (Bate-papo com Balões) */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
        {messages.length === 0 ? (
          /* Estado Vazio de Início de Conversa */
          <div className="h-full flex flex-col items-center justify-center text-center max-w-xl mx-auto space-y-6 py-6">
            <div className="space-y-2">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-white mx-auto shadow-md shadow-emerald-500/20">
                <Sparkles className="h-7 w-7" />
              </div>
              <h3 className="text-base sm:text-lg font-semibold text-slate-800">
                Como posso ajudar na sua pesquisa hoje?
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                Faça perguntas diretas sobre os documentos ou escolha uma das ações rápidas abaixo:
              </p>
            </div>

            {/* Sugestões Rápidas em Chips */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full text-left">
              {UNIVERSAL_QUICK_TASKS.map((task) => {
                const Icon = task.icon;
                return (
                  <button
                    key={task.id}
                    onClick={() => handlePromptSuggestion(task.prompt)}
                    disabled={isStreaming}
                    className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/30 hover:shadow-xs p-3 transition-all cursor-pointer group disabled:opacity-50 text-left"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100 shrink-0">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-xs font-semibold text-slate-700 group-hover:text-emerald-800 truncate">
                        {task.title}
                      </h4>
                      <p className="text-[11px] text-slate-400 group-hover:text-slate-500 truncate">
                        {task.subtitle}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            {completedDocs.length === 0 && (
              <div className="rounded-xl border border-dashed border-emerald-300 bg-emerald-50/60 p-3 max-w-sm text-xs text-emerald-800">
                Nenhum arquivo anexado a este caderno.{" "}
                <button
                  onClick={() => setAddSourceModalOpen(true)}
                  className="text-emerald-700 font-semibold underline hover:text-emerald-900 cursor-pointer ml-1"
                >
                  Anexar PDF agora
                </button>
              </div>
            )}
          </div>
        ) : (
          /* Lista de Balões de Conversa */
          messages.map((msg, index) => {
            const isUser = msg.role === "user";
            const isLatestAssistant =
              !isUser && index === messages.length - 1 && isStreaming;

            if (isUser) {
              return (
                <div
                  key={msg.id || index}
                  className="flex justify-end items-end gap-2 max-w-2xl ml-auto"
                >
                  <div className="flex flex-col items-end max-w-[85%] sm:max-w-[75%]">
                    <div className="bg-emerald-600 text-white rounded-2xl rounded-br-xs px-4 py-3 shadow-xs">
                      <p className="text-xs sm:text-sm font-sans whitespace-pre-wrap leading-relaxed">
                        {msg.content}
                      </p>
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 px-1">
                      {new Date(msg.createdAt || Date.now()).toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={msg.id || index}
                className="flex items-start gap-2.5 max-w-3xl mr-auto"
              >
                {/* Avatar do Assistente */}
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shrink-0 shadow-2xs mt-0.5">
                  <Sparkles className="h-4 w-4" />
                </div>

                {/* Balão do Assistente */}
                <div className="flex-1 min-w-0 max-w-[92%] sm:max-w-[85%]">
                  <div className="bg-white border border-slate-200/90 rounded-2xl rounded-tl-xs px-4 sm:px-5 py-3.5 shadow-xs space-y-3">
                    {/* Header do Balão com Ações */}
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2 text-[11px] text-slate-400">
                      <span className="font-semibold text-slate-700">
                        Assistente Documental
                      </span>
                      <div className="flex items-center gap-1.5">
                        {msg.model && (
                          <span className="font-mono text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
                            {msg.model}
                          </span>
                        )}
                        <button
                          onClick={() => handleCopyMessage(msg.content, index)}
                          className="hover:text-slate-700 p-1 rounded transition-colors cursor-pointer"
                          title="Copiar resposta"
                        >
                          {copiedIndex === index ? (
                            <span className="text-emerald-600 font-medium">Copiado!</span>
                          ) : (
                            <FileEdit className="h-3.5 w-3.5" />
                          )}
                        </button>
                        <button
                          onClick={() => {
                            appendNoteToNotebook(activeNotebookId, msg.content);
                            toast.success("Adicionado ao Caderno de Notas!");
                          }}
                          className="hover:text-emerald-700 bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors cursor-pointer border border-emerald-200/50"
                          title="Salvar como Nota de Síntese"
                        >
                          + Nota
                        </button>
                      </div>
                    </div>

                    {/* Conteúdo Markdown da Resposta */}
                    <div className="text-xs sm:text-sm text-slate-800 leading-relaxed space-y-2.5 font-sans prose prose-slate max-w-none prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-li:my-0.5">
                      {msg.content ? (
                        <>
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {msg.content}
                          </ReactMarkdown>
                          {isLatestAssistant && (
                            <span className="inline-block animate-pulse text-emerald-600 font-mono ml-1 text-sm">
                              ▍
                            </span>
                          )}
                        </>
                      ) : isLatestAssistant ? (
                        /* Indicador de Digitação (Typing Dots) */
                        <div className="flex items-center gap-1.5 py-2 px-1">
                          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-bounce [animation-delay:-0.3s]" />
                          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-bounce [animation-delay:-0.15s]" />
                          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-bounce" />
                          <span className="text-xs text-slate-400 ml-2">Consultando documentos...</span>
                        </div>
                      ) : null}
                    </div>

                    {/* Pills de Citações / Fontes */}
                    {msg.citations && msg.citations.length > 0 && (
                      <div className="mt-3 pt-2.5 border-t border-slate-100 space-y-1.5">
                        <div className="flex items-center justify-between text-[11px] font-medium text-slate-400">
                          <span>Fontes consultadas</span>
                          <span className="font-mono text-emerald-700 text-[10px] bg-emerald-50 px-1.5 py-0.5 rounded-full">
                            {msg.citations.length} trecho(s)
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                          {msg.citations.map((cite, idx) => (
                            <button
                              key={cite.chunk_id || idx}
                              onClick={() => openCitationInStudio(cite)}
                              title={`Abrir página ${cite.page_number || cite.chunk_index} de ${cite.document_title}`}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-emerald-50 hover:border-emerald-300 px-2 py-1 text-[11px] text-slate-700 hover:text-emerald-900 transition-all cursor-pointer shadow-2xs group"
                            >
                              <span className="font-mono font-bold text-emerald-600 text-[10px]">
                                #{idx + 1}
                              </span>
                              <span className="truncate max-w-[120px] sm:max-w-[160px] font-medium">
                                {cite.document_title}
                              </span>
                              <span className="text-[10px] text-slate-400 group-hover:text-emerald-700 font-mono">
                                p.{cite.page_number || cite.chunk_index}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <span className="text-[10px] text-slate-400 mt-1 block px-1">
                    {new Date(msg.createdAt || Date.now()).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 3. Barra de Entrada Fixa (Input de Bate-Papo Moderno) */}
      <div className="p-3 sm:p-4 border-t border-slate-200/80 bg-white/95 backdrop-blur-md shrink-0 shadow-lg shadow-slate-200/50">
        <div className="max-w-3xl mx-auto space-y-2">
          {selectedSourceIds.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200/60">
              <span className="font-medium">
                Filtrando em {selectedSourceIds.length} documento(s) selecionado(s)
              </span>
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            className="relative flex items-center rounded-2xl border border-slate-200 bg-slate-50 focus-within:bg-white focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20 transition-all shadow-xs"
          >
            <textarea
              id="chat-prompt-input"
              name="prompt"
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
                  ? "Anexe documentos ao caderno para conversar..."
                  : "Digite uma mensagem ou faça uma pergunta sobre os documentos..."
              }
              disabled={isStreaming}
              className="w-full resize-none bg-transparent px-4 py-3 text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none font-sans max-h-32 leading-relaxed"
            />

            <div className="flex items-center gap-1.5 pr-2.5">
              <button
                type="submit"
                disabled={!inputText.trim() || isStreaming}
                className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-xs disabled:opacity-40 disabled:hover:bg-emerald-600 cursor-pointer active:scale-95"
                title="Enviar mensagem (Enter)"
              >
                {isStreaming ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CornerDownLeft className="h-4 w-4" />
                )}
              </button>
            </div>
          </form>

          <div className="flex items-center justify-between text-[10px] sm:text-[11px] text-slate-400 px-1">
            <span>Pressione <strong className="font-semibold text-slate-500">Enter</strong> para enviar • <strong className="font-semibold text-slate-500">Shift + Enter</strong> para nova linha</span>
            <span className="hidden sm:inline">RAG com 25 chunks & pgvector</span>
          </div>
        </div>
      </div>
    </div>
  );
}
