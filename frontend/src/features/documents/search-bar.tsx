"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";
import { DocumentSearchResponse, SearchResultChunk } from "@/types/api";
import { Search, Loader2, Sparkles, ChevronDown, ChevronUp, FileText } from "lucide-react";

export function SearchBar() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResultChunk[]>([]);
  const [expandedChunkId, setExpandedChunkId] = useState<string | null>(null);

  const searchMutation = useMutation({
    mutationFn: async (searchQuery: string) => {
      const res = await apiClient.post<DocumentSearchResponse>(
        "/documents/search",
        {
          query: searchQuery,
          limit: 4,
        }
      );
      return res.data;
    },
    onSuccess: (data) => {
      setResults(data.results);
      if (data.results.length === 0) {
        toast.info("Nenhum resultado", {
          description: "Nenhum trecho com similaridade suficiente foi encontrado.",
        });
      } else {
        toast.success("Busca vetorial concluída!", {
          description: `${data.total_results} trechos recuperados do pgvector.`,
        });
      }
    },
    onError: (err: any) => {
      const msg = err.response?.data?.detail || "Erro ao realizar busca vetorial.";
      toast.error("Falha na busca", { description: msg });
    },
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    searchMutation.mutate(query.trim());
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-xl shadow-xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-white flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-blue-400" /> Teste de Busca Semântica Vetorial (HNSW)
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Faça uma pergunta em linguagem natural para consultar os embeddings gerados pelo nomic-embed-text.
          </p>
        </div>
      </div>

      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ex: Qual o prazo de vigência estabelecido no contrato?"
            className="w-full rounded-xl border border-slate-800 bg-slate-950/70 pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
          />
        </div>
        <button
          type="submit"
          disabled={searchMutation.isPending || !query.trim()}
          className="flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {searchMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Buscando...
            </>
          ) : (
            "Buscar"
          )}
        </button>
      </form>

      {/* Resultados da Busca Vetorial */}
      {results.length > 0 && (
        <div className="space-y-3 pt-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Trechos Mais Relevantes Recuperados:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {results.map((chunk) => {
              const isExpanded = expandedChunkId === chunk.chunk_id;
              const similarityPercent = (chunk.similarity_score * 100).toFixed(1);

              return (
                <div
                  key={chunk.chunk_id}
                  className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 transition-all hover:border-slate-700"
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <FileText className="h-4 w-4 text-blue-400 shrink-0" />
                      <span className="text-xs font-medium text-slate-200 truncate">
                        {chunk.document_title}
                      </span>
                      <span className="text-[10px] rounded bg-slate-800 px-1.5 py-0.5 text-slate-400">
                        Chunk #{chunk.chunk_index}
                      </span>
                    </div>

                    <span className="shrink-0 rounded-md bg-blue-500/10 px-2 py-0.5 text-xs font-semibold text-blue-400 border border-blue-500/20">
                      {similarityPercent}% similar
                    </span>
                  </div>

                  <p
                    className={`text-xs text-slate-300 leading-relaxed font-mono ${
                      !isExpanded ? "line-clamp-3" : ""
                    }`}
                  >
                    "{chunk.text_content}"
                  </p>

                  <button
                    onClick={() =>
                      setExpandedChunkId(isExpanded ? null : chunk.chunk_id)
                    }
                    className="mt-2 text-[11px] text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1 cursor-pointer"
                  >
                    {isExpanded ? (
                      <>
                        <ChevronUp className="h-3 w-3" /> Recolher
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-3 w-3" /> Ver trecho completo
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
