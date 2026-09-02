"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";
import { DocumentItem } from "@/types/api";
import { useChatStore } from "@/stores/useChatStore";
import {
  Plus,
  Trash2,
  CheckSquare,
  Square,
  Loader2,
  FileText,
  FileCheck2,
} from "lucide-react";

export function SourcesPanel() {
  const queryClient = useQueryClient();
  const {
    activeNotebookId,
    selectedSourceIds,
    toggleSourceSelection,
    selectAllSources,
    clearSourceSelections,
    setAddSourceModalOpen,
  } = useChatStore();

  const isUUID =
    !!activeNotebookId &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      activeNotebookId
    );

  const { data: documents = [], isLoading } = useQuery<DocumentItem[]>({
    queryKey: isUUID
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

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/documents/${id}`);
    },
    onSuccess: () => {
      toast.success("Fonte removida.");
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      if (activeNotebookId) {
        queryClient.invalidateQueries({
          queryKey: ["notebook_documents", activeNotebookId],
        });
        queryClient.invalidateQueries({ queryKey: ["notebooks"] });
      }
    },
    onError: () => {
      toast.error("Erro ao remover fonte.");
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
    <aside className="w-72 h-full border-r border-slate-200/80 bg-slate-50/60 flex flex-col shrink-0 select-none">
      {/* Top Header */}
      <div className="p-3.5 border-b border-slate-200/80 space-y-2 bg-white/70">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-800">
              Fontes em Custódia
            </span>
            <span className="text-[11px] font-mono font-medium text-slate-400">
              ({documents.length})
            </span>
          </div>

          <button
            onClick={() => setAddSourceModalOpen(true)}
            className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 text-xs font-medium transition-all shadow-2xs cursor-pointer active:scale-[0.98]"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Anexar PDF</span>
          </button>
        </div>

        {/* Select All Row */}
        {completedDocs.length > 0 && (
          <div
            onClick={handleToggleAll}
            className="flex items-center justify-between rounded-lg bg-slate-100/70 hover:bg-slate-100 px-2.5 py-1.5 text-xs text-slate-600 hover:text-slate-900 transition-colors cursor-pointer border border-slate-200/60"
          >
            <div className="flex items-center gap-2">
              {isAllSelected ? (
                <CheckSquare className="h-4 w-4 text-emerald-600" />
              ) : (
                <Square className="h-4 w-4 text-slate-400" />
              )}
              <span className="text-xs font-medium">
                Selecionar todas as fontes
              </span>
            </div>
            <span className="text-[10px] font-mono font-medium text-slate-500">
              {selectedSourceIds.length} ativas
            </span>
          </div>
        )}
      </div>

      {/* Sources Linear List */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-8 text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin text-emerald-600 mb-2" />
            <p className="text-xs font-sans">Carregando acervo...</p>
          </div>
        ) : documents.length === 0 ? (
          <div className="p-5 text-center rounded-xl border border-dashed border-slate-200 bg-white mt-3">
            <FileText className="h-5 w-5 text-slate-400 mx-auto mb-2" />
            <p className="text-xs font-semibold text-slate-700">
              Nenhuma fonte anexada
            </p>
            <p className="text-[11px] font-sans text-slate-400 mt-0.5">
              Anexe documentos em PDF para ativar a pesquisa RAG
            </p>
            <button
              onClick={() => setAddSourceModalOpen(true)}
              className="mt-3 inline-flex items-center gap-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-3 py-1 text-xs font-medium transition-colors cursor-pointer"
            >
              <Plus className="h-3 w-3" /> Anexar Documento
            </button>
          </div>
        ) : (
          documents.map((doc, idx) => {
            const isCompleted = doc.status === "COMPLETED";
            const isSelected = selectedSourceIds.includes(doc.id);
            const docCode = `FNT-0${idx + 1}`;

            return (
              <div
                key={doc.id}
                className={`group flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 border transition-all ${
                  isSelected
                    ? "bg-white border-emerald-300 shadow-2xs ring-1 ring-emerald-500/10"
                    : "bg-white/80 hover:bg-white border-slate-200/80 hover:border-slate-300"
                }`}
              >
                <div
                  onClick={() => isCompleted && toggleSourceSelection(doc.id)}
                  className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer"
                >
                  {isCompleted ? (
                    isSelected ? (
                      <CheckSquare className="h-4 w-4 text-emerald-600 shrink-0" />
                    ) : (
                      <Square className="h-4 w-4 text-slate-300 shrink-0 group-hover:text-slate-400" />
                    )
                  ) : (
                    <Loader2 className="h-4 w-4 text-amber-500 animate-spin shrink-0" />
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-slate-800 truncate leading-snug">
                      {doc.title}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1 text-[10px] font-sans text-slate-400">
                      <span className="font-mono">{docCode}</span>
                      <span>•</span>
                      {isCompleted ? (
                        <span className="text-emerald-700 font-medium flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          Pronto
                        </span>
                      ) : (
                        <span className="text-amber-600 font-medium flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                          Indexando
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => deleteMutation.mutate(doc.id)}
                  title="Excluir fonte"
                  className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all cursor-pointer"
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
