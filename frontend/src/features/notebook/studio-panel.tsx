"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";
import { DocumentSearchResponse, SearchResultChunk } from "@/types/api";
import { useChatStore } from "@/stores/useChatStore";
import {
  FileText,
  Search,
  BookOpen,
  Copy,
  Check,
  HelpCircle,
  FileSpreadsheet,
  BookmarkCheck,
  Scale,
} from "lucide-react";

export function StudioPanel() {
  const {
    activeStudioTab,
    setActiveStudioTab,
    selectedCitation,
    selectedSearchChunk,
    openSearchResultInStudio,
    addMessage,
    selectedSourceIds,
  } = useChatStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResultChunk[]>([]);
  const [isCopied, setIsCopied] = useState(false);

  const searchMutation = useMutation({
    mutationFn: async (query: string) => {
      const res = await apiClient.post<DocumentSearchResponse>(
        "/documents/search",
        {
          query,
          limit: 4,
          document_id:
            selectedSourceIds.length === 1 ? selectedSourceIds[0] : null,
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
  });

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    searchMutation.mutate(searchQuery.trim());
  };

  const handleQuickTask = (prompt: string) => {
    addMessage({
      role: "user",
      content: prompt,
    });
  };

  const handleCopySnippet = (text: string) => {
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    toast.success("Trecho copiado para a área de transferência.");
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <aside className="w-88 h-full border-l border-white/[0.06] bg-[#131314] flex flex-col shrink-0 select-none">
      {/* Studio Tab Navigation */}
      <div className="p-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-1 p-1 rounded-xl bg-[#1e1f20] border border-white/5">
          <button
            onClick={() => setActiveStudioTab("overview")}
            className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              activeStudioTab === "overview"
                ? "bg-[#282a2c] text-white shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Tarefas
          </button>

          <button
            onClick={() => setActiveStudioTab("citation")}
            className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeStudioTab === "citation"
                ? "bg-[#282a2c] text-white shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <BookmarkCheck className="h-3.5 w-3.5 text-zinc-400" />
            Trecho Citado
          </button>

          <button
            onClick={() => setActiveStudioTab("search")}
            className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeStudioTab === "search"
                ? "bg-[#282a2c] text-white shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Search className="h-3.5 w-3.5 text-zinc-400" />
            Busca Direta
          </button>
        </div>
      </div>

      {/* Tab Contents */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* ABA 1: TAREFAS DE ANÁLISE */}
        {activeStudioTab === "overview" && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Tarefas Prontas de Análise
              </h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                Executar ações analíticas diretas sobre o acervo:
              </p>
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              <button
                onClick={() =>
                  handleQuickTask(
                    "Elabore um Resumo Executivo estruturado em tópicos dos documentos selecionados, contendo: Visão Geral, Principais Cláusulas/Tópicos e Conclusões."
                  )
                }
                className="flex items-start gap-3 rounded-2xl border border-white/[0.06] bg-[#1e1f20] hover:bg-[#282a2c] p-3.5 text-left transition-all cursor-pointer group"
              >
                <div className="p-2 rounded-lg bg-zinc-800 text-zinc-300 shrink-0 group-hover:text-white">
                  <BookOpen className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-xs font-medium text-zinc-200 group-hover:text-white">
                    Resumo Executivo
                  </h4>
                  <p className="text-[11px] text-zinc-400 mt-0.5 leading-snug">
                    Síntese completa e estruturada dos documentos.
                  </p>
                </div>
              </button>

              <button
                onClick={() =>
                  handleQuickTask(
                    "Identifique todos os riscos, prazos fatais e cláusulas de penalidade/rescisão presentes nas fontes selecionadas."
                  )
                }
                className="flex items-start gap-3 rounded-2xl border border-white/[0.06] bg-[#1e1f20] hover:bg-[#282a2c] p-3.5 text-left transition-all cursor-pointer group"
              >
                <div className="p-2 rounded-lg bg-zinc-800 text-zinc-300 shrink-0 group-hover:text-white">
                  <Scale className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-xs font-medium text-zinc-200 group-hover:text-white">
                    Mapeamento de Riscos
                  </h4>
                  <p className="text-[11px] text-zinc-400 mt-0.5 leading-snug">
                    Prazos críticos, multas e responsabilidades.
                  </p>
                </div>
              </button>

              <button
                onClick={() =>
                  handleQuickTask(
                    "Estruture uma Tabela Comparativa em Markdown com as métricas, datas, partes e valores mencionados no texto."
                  )
                }
                className="flex items-start gap-3 rounded-2xl border border-white/[0.06] bg-[#1e1f20] hover:bg-[#282a2c] p-3.5 text-left transition-all cursor-pointer group"
              >
                <div className="p-2 rounded-lg bg-zinc-800 text-zinc-300 shrink-0 group-hover:text-white">
                  <FileSpreadsheet className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-xs font-medium text-zinc-200 group-hover:text-white">
                    Tabela de Dados e Valores
                  </h4>
                  <p className="text-[11px] text-zinc-400 mt-0.5 leading-snug">
                    Organização tabular de valores e cronogramas.
                  </p>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* ABA 2: TRECHO CITADO / LEITOR SINCRONIZADO */}
        {activeStudioTab === "citation" && (
          <div className="space-y-4 animate-in fade-in duration-150">
            {selectedCitation ? (
              <>
                <div className="rounded-2xl border border-white/[0.06] bg-[#1e1f20] p-3.5 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400">Documento de Origem</span>
                    <span className="font-medium text-white truncate max-w-[180px]">
                      {selectedCitation.document_title}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400">Posição no Documento</span>
                    <span className="font-mono text-zinc-300">
                      Trecho #p.{selectedCitation.chunk_index}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400">Índice de Relevância</span>
                    <span className="rounded bg-zinc-800 px-2 py-0.5 text-zinc-300 font-mono text-[11px]">
                      {(selectedCitation.similarity_score * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                      Texto Original Destacado
                    </label>
                    <button
                      onClick={() => handleCopySnippet(selectedCitation.text_snippet)}
                      className="inline-flex items-center gap-1 text-[11px] text-zinc-400 hover:text-white transition-colors cursor-pointer"
                    >
                      {isCopied ? (
                        <>
                          <Check className="h-3 w-3 text-emerald-400" />
                          <span>Copiado</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" />
                          <span>Copiar</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="rounded-2xl border border-white/[0.06] bg-[#131314] p-4 text-xs font-mono text-zinc-300 leading-relaxed max-h-[60vh] overflow-y-auto whitespace-pre-wrap border-l-2 border-l-amber-400/40 bg-amber-500/[0.02]">
                    "{selectedCitation.text_snippet}"
                  </div>
                </div>
              </>
            ) : (
              <div className="p-8 text-center rounded-2xl border border-dashed border-white/10 bg-[#1e1f20]/40">
                <BookmarkCheck className="h-5 w-5 text-zinc-500 mx-auto mb-2" />
                <p className="text-xs font-medium text-zinc-300">
                  Nenhuma citação selecionada
                </p>
                <p className="text-[11px] text-zinc-500 mt-1">
                  Clique nas referências [1], [2] nas respostas para inspecionar o trecho original aqui.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ABA 3: BUSCA DIRETA */}
        {activeStudioTab === "search" && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <form onSubmit={handleSearchSubmit} className="space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar trecho por significado..."
                  className="w-full rounded-xl border border-white/[0.08] bg-[#1e1f20] pl-9 pr-4 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white/20"
                />
              </div>
              <button
                type="submit"
                disabled={searchMutation.isPending || !searchQuery.trim()}
                className="w-full rounded-xl bg-[#282a2c] hover:bg-[#333538] py-1.5 text-xs font-medium text-zinc-200 transition-colors cursor-pointer disabled:opacity-40"
              >
                {searchMutation.isPending ? "Consultando..." : "Localizar Trechos"}
              </button>
            </form>

            <div className="space-y-2">
              {searchResults.map((chunk) => (
                <div
                  key={chunk.chunk_id}
                  onClick={() => openSearchResultInStudio(chunk)}
                  className="rounded-xl border border-white/[0.06] bg-[#1e1f20] hover:bg-[#282a2c] p-3 text-left transition-all cursor-pointer space-y-1.5"
                >
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-medium text-zinc-200 truncate max-w-[150px]">
                      {chunk.document_title}
                    </span>
                    <span className="text-zinc-400 font-mono">
                      {(chunk.similarity_score * 100).toFixed(0)}%
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 line-clamp-2 font-mono">
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
