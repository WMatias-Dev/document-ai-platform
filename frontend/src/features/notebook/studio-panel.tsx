"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";
import { DocumentSearchResponse, SearchResultChunk } from "@/types/api";
import { useChatStore } from "@/stores/useChatStore";
import {
  Search,
  BookOpen,
  Copy,
  Check,
  Scale,
  FileSpreadsheet,
  FileSearch,
  Quote,
} from "lucide-react";

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
          notebook_id: activeNotebookId,
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
    <aside className="w-80 h-full border-l border-[#242628] bg-[#0C0D0E] flex flex-col shrink-0 select-none">
      {/* Studio Tab Navigation */}
      <div className="p-2.5 border-b border-[#242628]">
        <div className="flex items-center gap-1 p-0.5 rounded bg-[#161719] border border-[#242628]">
          <button
            onClick={() => setActiveStudioTab("citation")}
            className={`flex-1 py-1 px-1.5 rounded text-[11px] font-mono transition-colors cursor-pointer ${
              activeStudioTab === "citation"
                ? "bg-[#242628] text-[#E3E3E3] font-medium"
                : "text-[#85888C] hover:text-[#E3E3E3]"
            }`}
          >
            Evidência Citada
          </button>

          <button
            onClick={() => setActiveStudioTab("overview")}
            className={`flex-1 py-1 px-1.5 rounded text-[11px] font-mono transition-colors cursor-pointer ${
              activeStudioTab === "overview"
                ? "bg-[#242628] text-[#E3E3E3] font-medium"
                : "text-[#85888C] hover:text-[#E3E3E3]"
            }`}
          >
            Tarefas Prontas
          </button>

          <button
            onClick={() => setActiveStudioTab("search")}
            className={`flex-1 py-1 px-1.5 rounded text-[11px] font-mono transition-colors cursor-pointer ${
              activeStudioTab === "search"
                ? "bg-[#242628] text-[#E3E3E3] font-medium"
                : "text-[#85888C] hover:text-[#E3E3E3]"
            }`}
          >
            Busca Direta
          </button>
        </div>
      </div>

      {/* Tab Contents */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* ABA 1: EVIDÊNCIA CITADA / LEITOR DE TRECHO */}
        {activeStudioTab === "citation" && (
          <div className="space-y-3 animate-in fade-in duration-100">
            {selectedCitation ? (
              <>
                <div className="rounded border border-[#242628] bg-[#161719] p-3 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono uppercase text-[#85888C]">
                      Documento de Origem
                    </span>
                    <span className="font-sans font-medium text-[#E3E3E3] truncate max-w-[150px]">
                      {selectedCitation.document_title}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono uppercase text-[#85888C]">
                      Posição no Arquivo
                    </span>
                    <span className="font-mono text-[11px] text-[#E3E3E3]">
                      Trecho #p.{selectedCitation.chunk_index}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono uppercase text-[#85888C]">
                      Similaridade Cosseno
                    </span>
                    <span className="rounded bg-[#0C0D0E] border border-[#242628] px-1.5 py-0.5 text-[#10B981] font-mono text-[10px]">
                      {(selectedCitation.similarity_score * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-[#85888C]">
                      Fragmento Textual Original
                    </span>
                    <button
                      onClick={() => handleCopySnippet(selectedCitation.text_snippet)}
                      className="inline-flex items-center gap-1 text-[10px] font-mono text-[#85888C] hover:text-[#E3E3E3] transition-colors cursor-pointer"
                    >
                      {isCopied ? (
                        <>
                          <Check className="h-3 w-3 text-[#10B981]" />
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

                  {/* Highlight Box Marca-Texto Ocre */}
                  <div className="rounded border-l-2 border-l-[#D97706] border border-[#242628] bg-[#D97706]/10 p-3 text-xs font-serif text-[#FDE68A] leading-relaxed max-h-[55vh] overflow-y-auto whitespace-pre-wrap">
                    "{selectedCitation.text_snippet}"
                  </div>
                </div>
              </>
            ) : (
              <div className="p-6 text-center rounded border border-dashed border-[#242628] bg-[#161719]/30">
                <Quote className="h-4 w-4 text-[#55585D] mx-auto mb-1.5" />
                <p className="text-xs font-sans text-[#E3E3E3]">
                  Nenhuma citação selecionada
                </p>
                <p className="text-[10px] font-mono text-[#85888C] mt-1 leading-relaxed">
                  Clique nas referências [1], [2] nas respostas para exibir o trecho original aqui.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ABA 2: TAREFAS DE ANÁLISE PRONTAS */}
        {activeStudioTab === "overview" && (
          <div className="space-y-2.5 animate-in fade-in duration-100">
            <div className="border-b border-[#242628] pb-1.5">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#85888C]">
                Tarefas Rápidas de Análise
              </span>
            </div>

            <div className="space-y-1.5">
              <button
                onClick={() =>
                  handleQuickTask(
                    "Elabore um Resumo Executivo estruturado em tópicos dos documentos selecionados, contendo: Visão Geral, Principais Cláusulas/Tópicos e Conclusões."
                  )
                }
                className="w-full flex items-start gap-2 rounded border border-[#242628] bg-[#161719] hover:bg-[#222427] hover:border-[#383B40] p-2.5 text-left transition-colors cursor-pointer group"
              >
                <BookOpen className="h-3.5 w-3.5 text-[#85888C] shrink-0 mt-0.5 group-hover:text-[#E3E3E3]" />
                <div>
                  <h4 className="text-xs font-sans font-medium text-[#E3E3E3] group-hover:text-white">
                    Resumo Executivo
                  </h4>
                  <p className="text-[10px] font-mono text-[#85888C] mt-0.5">
                    Síntese completa e estruturada.
                  </p>
                </div>
              </button>

              <button
                onClick={() =>
                  handleQuickTask(
                    "Identifique todos os riscos, prazos fatais e cláusulas de penalidade/rescisão presentes nas fontes selecionadas."
                  )
                }
                className="w-full flex items-start gap-2 rounded border border-[#242628] bg-[#161719] hover:bg-[#222427] hover:border-[#383B40] p-2.5 text-left transition-colors cursor-pointer group"
              >
                <Scale className="h-3.5 w-3.5 text-[#85888C] shrink-0 mt-0.5 group-hover:text-[#E3E3E3]" />
                <div>
                  <h4 className="text-xs font-sans font-medium text-[#E3E3E3] group-hover:text-white">
                    Mapeamento de Riscos
                  </h4>
                  <p className="text-[10px] font-mono text-[#85888C] mt-0.5">
                    Prazos críticos e multas.
                  </p>
                </div>
              </button>

              <button
                onClick={() =>
                  handleQuickTask(
                    "Estruture uma Tabela Comparativa em Markdown com as métricas, datas, partes e valores mencionados no texto."
                  )
                }
                className="w-full flex items-start gap-2 rounded border border-[#242628] bg-[#161719] hover:bg-[#222427] hover:border-[#383B40] p-2.5 text-left transition-colors cursor-pointer group"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-[#85888C] shrink-0 mt-0.5 group-hover:text-[#E3E3E3]" />
                <div>
                  <h4 className="text-xs font-sans font-medium text-[#E3E3E3] group-hover:text-white">
                    Tabela de Valores
                  </h4>
                  <p className="text-[10px] font-mono text-[#85888C] mt-0.5">
                    Organização tabular de dados.
                  </p>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* ABA 3: BUSCA DIRETA NO ACERVO */}
        {activeStudioTab === "search" && (
          <div className="space-y-2.5 animate-in fade-in duration-100">
            <form onSubmit={handleSearchSubmit} className="space-y-1.5">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-[#85888C]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar trecho por significado..."
                  className="w-full rounded border border-[#242628] bg-[#161719] pl-7 pr-3 py-1.5 text-xs text-[#E3E3E3] placeholder-[#55585D] focus:outline-none focus:border-[#383B40] font-sans"
                />
              </div>
              <button
                type="submit"
                disabled={searchMutation.isPending || !searchQuery.trim()}
                className="w-full rounded bg-[#242628] hover:bg-[#383B40] py-1 text-[11px] font-mono text-[#E3E3E3] transition-colors cursor-pointer disabled:opacity-40"
              >
                {searchMutation.isPending ? "Consultando..." : "Localizar Fragmentos"}
              </button>
            </form>

            <div className="space-y-1.5">
              {searchResults.map((chunk) => (
                <div
                  key={chunk.chunk_id}
                  onClick={() => openSearchResultInStudio(chunk)}
                  className="rounded border border-[#242628] bg-[#161719] hover:bg-[#222427] p-2 text-left transition-colors cursor-pointer space-y-1"
                >
                  <div className="flex items-center justify-between text-[10px] font-mono">
                    <span className="text-[#E3E3E3] truncate max-w-[130px]">
                      {chunk.document_title}
                    </span>
                    <span className="text-[#10B981]">
                      {(chunk.similarity_score * 100).toFixed(0)}%
                    </span>
                  </div>
                  <p className="text-[11px] text-[#85888C] line-clamp-2 font-serif">
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
