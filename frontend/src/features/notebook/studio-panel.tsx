"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiClient, getErrorMessage } from "@/lib/api-client";
import {
  ChatResponse,
  DocumentSearchResponse,
  SearchResultChunk,
} from "@/types/api";
import { useChatStore } from "@/stores/useChatStore";
import { QuickTasks } from "./quick-tasks";
import {
  Search,
  BookOpen,
  Copy,
  Check,
  Quote,
  Loader2,
} from "lucide-react";

import { PDFHighlighter } from "./pdf-highlighter";
import { NotesEditor } from "./notes-editor";

export function StudioPanel() {
  const {
    activeNotebookId,
    activeStudioTab,
    setActiveStudioTab,
    selectedCitation,
    selectedSearchChunk,
    openSearchResultInStudio,
    addMessage,
    selectedSourceIds,
    getMessages,
    isChatLoading,
    setIsChatLoading,
  } = useChatStore();

  const messages = getMessages(activeNotebookId);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResultChunk[]>([]);
  const [isCopied, setIsCopied] = useState(false);
  const [runningTaskId, setRunningTaskId] = useState<string | null>(null);
  const [showPdfViewer, setShowPdfViewer] = useState(true);

  // Mutação RAG para execução de tarefas analíticas
  const taskMutation = useMutation({
    mutationFn: async (promptText: string) => {
      const historyPayload = messages.slice(-6).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const isUUID =
        !!activeNotebookId &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          activeNotebookId
        );

      const res = await apiClient.post<ChatResponse>("/chat/", {
        message: promptText,
        notebook_id: isUUID ? activeNotebookId : null,
        source_ids: selectedSourceIds.length > 0 ? selectedSourceIds : null,
        history: historyPayload,
        max_chunks: 25,
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
      setIsChatLoading(false);
      setRunningTaskId(null);
      toast.success("Tarefa analítica concluída.");
    },
    onError: (err: any) => {
      setIsChatLoading(false);
      setRunningTaskId(null);
      const msg = getErrorMessage(
        err,
        "Erro ao executar tarefa analítica no acervo."
      );
      toast.error("Falha na execução da tarefa", { description: msg });
      addMessage({
        role: "assistant",
        content:
          "Ocorreu uma falha ao recuperar e processar as fontes para esta tarefa. Por favor, tente novamente.",
      });
    },
  });

  // Mutação de busca semântica direta
  const searchMutation = useMutation({
    mutationFn: async (query: string) => {
      const isUUID =
        !!activeNotebookId &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          activeNotebookId
        );

      const res = await apiClient.post<DocumentSearchResponse>(
        "/documents/search",
        {
          query,
          limit: 4,
          notebook_id: isUUID ? activeNotebookId : null,
          source_ids: selectedSourceIds.length > 0 ? selectedSourceIds : null,
        }
      );
      return res.data;
    },
    onSuccess: (data) => {
      setSearchResults(data.results);
      if (data.results.length === 0) {
        toast.info("Nenhum trecho correspondente no banco vetorial.");
      }
    },
    onError: (err: any) => {
      const msg = getErrorMessage(err, "Erro na busca vetorial.");
      toast.error("Falha na busca", { description: msg });
    },
  });

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    searchMutation.mutate(searchQuery.trim());
  };

  const handleQuickTask = (taskId: string, prompt: string) => {
    if (taskMutation.isPending || isChatLoading) return;

    setRunningTaskId(taskId);
    setIsChatLoading(true);

    addMessage({
      role: "user",
      content: prompt,
    });

    taskMutation.mutate(prompt);
  };

  const handleCopySnippet = (text: string) => {
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    toast.success("Trecho copiado para a área de transferência.");
    setTimeout(() => setIsCopied(false), 2000);
  };

  const isAnyTaskRunning = taskMutation.isPending || isChatLoading;

  return (
    <aside className="w-80 h-full border-l border-slate-200/80 bg-slate-50/60 flex flex-col shrink-0 select-none">
      {/* Studio Tab Navigation */}
      <div className="p-2.5 border-b border-slate-200/80 bg-white/80">
        <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100/80 border border-slate-200/60">
          <button
            onClick={() => setActiveStudioTab("notes")}
            className={`flex-1 py-1.5 px-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              activeStudioTab === "notes"
                ? "bg-white text-emerald-800 shadow-2xs font-semibold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Notas
          </button>

          <button
            onClick={() => setActiveStudioTab("citation")}
            className={`flex-1 py-1.5 px-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              activeStudioTab === "citation"
                ? "bg-white text-emerald-800 shadow-2xs font-semibold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Evidência
          </button>

          <button
            onClick={() => setActiveStudioTab("overview")}
            className={`flex-1 py-1.5 px-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              activeStudioTab === "overview"
                ? "bg-white text-emerald-800 shadow-2xs font-semibold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Tarefas
          </button>

          <button
            onClick={() => setActiveStudioTab("search")}
            className={`flex-1 py-1.5 px-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              activeStudioTab === "search"
                ? "bg-white text-emerald-800 shadow-2xs font-semibold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Busca
          </button>
        </div>
      </div>

      {/* Tab Contents */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
        {/* ABA: CADERNO DE NOTAS & SÍNTESE */}
        {activeStudioTab === "notes" && (
          <div className="h-full flex flex-col animate-in fade-in duration-100 min-h-[420px]">
            <NotesEditor />
          </div>
        )}

        {/* ABA 1: EVIDÊNCIA CITADA / LEITOR DE TRECHO */}
        {activeStudioTab === "citation" && (
          <div className="space-y-3.5 animate-in fade-in duration-100">
            {selectedCitation ? (
              <>
                <div className="rounded-xl border border-slate-200/90 bg-white p-3.5 space-y-2 text-xs shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-sans text-slate-500">
                      Documento de Origem
                    </span>
                    <span className="font-medium text-slate-800 truncate max-w-[160px]">
                      {selectedCitation.document_title}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-sans text-slate-500">
                      Posição no Arquivo
                    </span>
                    <span className="font-mono text-xs text-slate-700">
                      Trecho #p.{selectedCitation.chunk_index}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-sans text-slate-500">
                      Similaridade Cosseno
                    </span>
                    <span className="rounded-md bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-emerald-700 font-mono text-[11px] font-semibold">
                      {(selectedCitation.similarity_score * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>

                {/* Visualizador de PDF com Destaque de Bounding Box */}
                {selectedCitation.document_id && (
                  <div className="space-y-1">
                    <PDFHighlighter
                      documentId={selectedCitation.document_id}
                      documentTitle={selectedCitation.document_title}
                      pageNumber={selectedCitation.page_number || selectedCitation.chunk_index + 1}
                      boundingBox={selectedCitation.bounding_box}
                      snippetText={selectedCitation.text_snippet}
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-700">
                      Fragmento Textual Original
                    </span>
                    <button
                      onClick={() => handleCopySnippet(selectedCitation.text_snippet)}
                      className="inline-flex items-center gap-1 text-xs font-sans text-slate-500 hover:text-emerald-700 transition-colors cursor-pointer"
                    >
                      {isCopied ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-600" />
                          <span>Copiado</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          <span>Copiar</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Highlight Box Marca-Texto Suave */}
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3.5 text-xs font-serif text-emerald-950 leading-relaxed max-h-[30vh] overflow-y-auto whitespace-pre-wrap shadow-2xs">
                    "{selectedCitation.text_snippet}"
                  </div>
                </div>
              </>
            ) : (
              <div className="p-6 text-center rounded-2xl border border-dashed border-slate-200 bg-white">
                <Quote className="h-5 w-5 text-slate-400 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-700">
                  Nenhuma citação selecionada
                </p>
                <p className="text-[11px] font-sans text-slate-400 mt-1 leading-relaxed">
                  Clique nas referências [1], [2] nas respostas do chat para inspecionar o trecho original com bounding box aqui.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ABA 2: TAREFAS DE ANÁLISE PRONTAS */}
        {activeStudioTab === "overview" && (
          <div className="space-y-3 animate-in fade-in duration-100">
            <div className="border-b border-slate-200/80 pb-2 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700">
                Tarefas Rápidas de Análise
              </span>
              {isAnyTaskRunning && (
                <span className="text-[11px] font-sans text-emerald-700 flex items-center gap-1 font-medium">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Processando...
                </span>
              )}
            </div>

            <QuickTasks
              onExecuteTask={handleQuickTask}
              runningTaskId={runningTaskId}
              isDisabled={isAnyTaskRunning}
            />
          </div>
        )}

        {/* ABA 3: BUSCA DIRETA NO ACERVO */}
        {activeStudioTab === "search" && (
          <div className="space-y-3 animate-in fade-in duration-100">
            <form onSubmit={handleSearchSubmit} className="space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input
                  id="studio-search-query"
                  name="searchQuery"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar trecho por significado..."
                  className="w-full rounded-xl border border-slate-200 bg-white pl-8.5 pr-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 font-sans shadow-2xs"
                />
              </div>
              <button
                type="submit"
                disabled={searchMutation.isPending || !searchQuery.trim()}
                className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 py-2 text-xs font-medium text-white transition-all cursor-pointer disabled:opacity-40 shadow-xs active:scale-[0.98]"
              >
                {searchMutation.isPending ? "Consultando..." : "Localizar Fragmentos"}
              </button>
            </form>

            <div className="space-y-2">
              {searchResults.map((chunk) => (
                <div
                  key={chunk.chunk_id}
                  onClick={() => openSearchResultInStudio(chunk)}
                  className="rounded-xl border border-slate-200/80 bg-white hover:border-emerald-300 hover:shadow-sm p-3 text-left transition-all cursor-pointer space-y-1.5 shadow-2xs active:scale-[0.98]"
                >
                  <div className="flex items-center justify-between text-[11px] font-sans">
                    <span className="font-semibold text-slate-800 truncate max-w-[150px]">
                      {chunk.document_title}
                    </span>
                    <span className="font-mono font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md">
                      {(chunk.similarity_score * 100).toFixed(0)}%
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 line-clamp-2 font-serif">
                    "{chunk.text_content}"
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
