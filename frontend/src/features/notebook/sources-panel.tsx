"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";
import { DocumentItem } from "@/types/api";
import { useChatStore } from "@/stores/useChatStore";
import {
  Plus,
  FileText,
  Trash2,
  CheckSquare,
  Square,
  Loader2,
  Layers,
} from "lucide-react";

export function SourcesPanel() {
  const queryClient = useQueryClient();
  const {
    selectedSourceIds,
    toggleSourceSelection,
    selectAllSources,
    clearSourceSelections,
    setAddSourceModalOpen,
  } = useChatStore();

  const { data: documents = [], isLoading } = useQuery<DocumentItem[]>({
    queryKey: ["documents"],
    queryFn: async () => {
      const res = await apiClient.get("/documents/");
      return res.data;
    },
  });

  const completedDocs = documents.filter((d) => d.status === "COMPLETED");

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/documents/${id}`);
    },
    onSuccess: () => {
      toast.success("Documento removido.");
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
    onError: () => {
      toast.error("Erro ao remover documento.");
    },
  });

  const allCompletedIds = completedDocs.map((d) => d.id);
  const isAllSelected =
    completedDocs.length > 0 &&
    allCompletedIds.every((id) => selectedSourceIds.includes(id));

  const handleToggleAll = () => {
    if (isAllSelected) {
      clearSourceSelections();
    } else {
      selectAllSources(allCompletedIds);
    }
  };

  return (
    <aside className="w-80 h-full border-r border-white/[0.06] bg-[#131314] flex flex-col shrink-0 select-none">
      {/* Top Header */}
      <div className="p-4 border-b border-white/[0.06] space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-medium text-white tracking-wide">
              Fontes Documentais
            </h2>
            <span className="text-xs text-zinc-500 font-mono">
              ({documents.length})
            </span>
          </div>

          <button
            onClick={() => setAddSourceModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#1e1f20] hover:bg-[#282a2c] text-zinc-200 border border-white/[0.08] px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Adicionar</span>
          </button>
        </div>

        {/* Select All */}
        {completedDocs.length > 0 && (
          <div
            onClick={handleToggleAll}
            className="flex items-center justify-between rounded-xl bg-[#1e1f20]/40 hover:bg-[#1e1f20] px-3 py-2 text-xs text-zinc-300 transition-colors cursor-pointer border border-white/[0.04]"
          >
            <div className="flex items-center gap-2">
              {isAllSelected ? (
                <CheckSquare className="h-4 w-4 text-zinc-200" />
              ) : (
                <Square className="h-4 w-4 text-zinc-500" />
              )}
              <span className="text-xs text-zinc-300">
                Selecionar todas as fontes
              </span>
            </div>
            <span className="text-[11px] text-zinc-500 font-mono">
              {selectedSourceIds.length} ativas
            </span>
          </div>
        )}
      </div>

      {/* Sources List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-8 text-zinc-500">
            <Loader2 className="h-4 w-4 animate-spin text-zinc-400 mb-2" />
            <p className="text-xs">Carregando acervo...</p>
          </div>
        ) : documents.length === 0 ? (
          <div className="p-6 text-center rounded-2xl border border-dashed border-white/10 bg-[#1e1f20]/20 mt-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1e1f20] text-zinc-500 mx-auto mb-2">
              <Layers className="h-4 w-4" />
            </div>
            <p className="text-xs font-medium text-zinc-300">
              Nenhuma fonte anexada
            </p>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              Anexe documentos em PDF para iniciar a análise.
            </p>
            <button
              onClick={() => setAddSourceModalOpen(true)}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[#1e1f20] hover:bg-[#282a2c] text-zinc-300 border border-white/10 px-3 py-1 text-xs transition-colors cursor-pointer"
            >
              <Plus className="h-3 w-3" /> Anexar PDF
            </button>
          </div>
        ) : (
          documents.map((doc) => {
            const isCompleted = doc.status === "COMPLETED";
            const isSelected = selectedSourceIds.includes(doc.id);

            return (
              <div
                key={doc.id}
                className={`group relative flex items-center justify-between gap-2.5 rounded-xl p-2.5 border transition-all ${
                  isSelected
                    ? "bg-[#282a2c] border-white/20 shadow-sm"
                    : "bg-[#1e1f20]/60 hover:bg-[#1e1f20] border-white/[0.04]"
                } ${!isCompleted ? "opacity-75" : ""}`}
              >
                <div
                  onClick={() => isCompleted && toggleSourceSelection(doc.id)}
                  className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer"
                >
                  {isCompleted ? (
                    isSelected ? (
                      <CheckSquare className="h-4 w-4 text-zinc-200 shrink-0" />
                    ) : (
                      <Square className="h-4 w-4 text-zinc-500 shrink-0 group-hover:text-zinc-300" />
                    )
                  ) : (
                    <Loader2 className="h-4 w-4 text-zinc-400 animate-spin shrink-0" />
                  )}

                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-zinc-800 text-zinc-400 border border-white/5">
                    <FileText className="h-3.5 w-3.5" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-zinc-200 truncate leading-snug">
                      {doc.title}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {isCompleted ? (
                        <span className="text-[10px] text-zinc-400 flex items-center gap-1 font-mono">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          Indexado
                        </span>
                      ) : (
                        <span className="text-[10px] text-amber-400/90 flex items-center gap-1 font-mono">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-ping" />
                          Processando...
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => deleteMutation.mutate(doc.id)}
                  title="Remover fonte"
                  className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
