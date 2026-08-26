"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import { apiClient, getErrorMessage } from "@/lib/api-client";
import { DocumentItem, DocumentCitation, ChatThreadItem, ChatMessageDetail } from "@/types/api";
import { useChatStore } from "@/stores/useChatStore";
import { useAuthStore } from "@/stores/useAuthStore";
import {
  Loader2,
  Trash2,
  BookmarkCheck,
  Scale,
  Calendar,
  BookOpen,
  FileSpreadsheet,
  CornerDownLeft,
  Search,
  Sparkles,
} from "lucide-react";

export function ChatPanel() {
  const queryClient = useQueryClient();
  const { token } = useAuthStore();
  const {
    activeNotebookId,
    messages,
    setMessages,
    addMessage,
    updateLastMessageContent,
    clearMessages,
    selectedSourceIds,
    openCitationInStudio,
    setAddSourceModalOpen,
    activeThreadId,
    setActiveThreadId,
    isStreaming,
    setIsStreaming,
  } = useChatStore();

  const [inputText, setInputText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isFetchingHistory = useRef(false);

  const isUUID =
    !!activeNotebookId &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      activeNotebookId
    );

  // 1. Carrega Documentos do Caderno
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

  // 2. Carregamento Automático de Histórico de Conversa Persistido no PostgreSQL
  useEffect(() => {
    async function loadHistory() {
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
          setActiveThreadId(latestThread.id);

          const msgsRes = await apiClient.get<ChatMessageDetail[]>(
            `/chat/threads/${latestThread.id}/messages`
          );
          const savedMsgs = msgsRes.data;

          if (savedMsgs && savedMsgs.length > 0) {
            setMessages(
              savedMsgs.map((m) => ({
                id: m.id,
                role: m.role,
                content: m.content,
                citations: (m.citations as DocumentCitation[]) || [],
                model: m.model_used || "gemini-3.7-flash",
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
  }, [activeNotebookId, isUUID, setActiveThreadId, setMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  // 3. Executor de Chat com Streaming SSE em Tempo Real
  const executeStreamChat = useCallback(
    async (queryText: string) => {
      if (!queryText.trim() || isStreaming) return;

      setIsStreaming(true);

      // Adiciona mensagem do usuário na tela
      addMessage({
        role: "user",
        content: queryText,
      });

      // Cria mensagem placeholder do assistente para streaming progressivo
      addMessage({
        role: "assistant",
        content: "",
        citations: [],
      });

      const historyPayload = messages.slice(-6).map((m) => ({
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
          throw new Error(`Erro na conexão SSE: HTTP ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("ReadableStream não suportado pelo navegador.");

        const decoder = new TextDecoder();
        let accumulatedText = "";
        let currentCitations: DocumentCitation[] = [];
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n\n");
          buffer = lines.pop() || "";

          for (const block of lines) {
            if (!block.trim()) continue;
            const eventMatch = block.match(/^event:\s*(\w+)/m);
            const dataMatch = block.match(/^data:\s*(.+)$/m);

            if (!eventMatch || !dataMatch) continue;

            const eventType = eventMatch[1];
            const dataRaw = dataMatch[1];

            try {
              const dataObj = JSON.parse(dataRaw);

              if (eventType === "citations") {
                currentCitations = dataObj;
                updateLastMessageContent(accumulatedText, currentCitations);
              } else if (eventType === "delta") {
                accumulatedText += dataObj.text || "";
                updateLastMessageContent(accumulatedText, currentCitations);
              } else if (eventType === "done") {
                if (dataObj.thread_id && !activeThreadId) {
                  setActiveThreadId(dataObj.thread_id);
                }
                updateLastMessageContent(
                  accumulatedText,
                  currentCitations,
                  dataObj.model
                );
              } else if (eventType === "error") {
                toast.error("Erro na geração da IA", {
                  description: dataObj.error,
                });
              }
            } catch (pErr) {
              console.warn("Erro ao fazer parse de evento SSE:", pErr);
            }
          }
        }
      } catch (err: any) {
        console.error("Falha no streaming do chat:", err);
        const msg = getErrorMessage(err, "Falha ao conectar com o serviço de IA.");
        toast.error("Erro no chat", { description: msg });
        updateLastMessageContent(
          "Ocorreu uma instabilidade na transmissão da resposta. Por favor, tente novamente."
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
      messages,
      selectedSourceIds,
      token,
      addMessage,
      updateLastMessageContent,
      setActiveThreadId,
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

  const handlePromptSuggestion = (text: string) => {
    executeStreamChat(text);
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
                apresentada no formato de memorando técnico com streaming em tempo real e citações auditáveis.
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

                {/* Editorial Body (Source Serif 4) with streaming pulsing cursor */}
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
            disabled={isStreaming}
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
            disabled={isStreaming || !inputText.trim()}
            className="flex items-center gap-1 rounded bg-[#E3E3E3] hover:bg-white text-[#0C0D0E] font-medium px-2.5 py-1 text-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0"
          >
            {isStreaming ? (
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
