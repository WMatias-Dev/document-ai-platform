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
  FilePlus2,
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

  const { data: documents = [], isLoading } = useQuery<DocumentItem[]>({
    queryKey: activeNotebookId
      ? ["notebook_documents", activeNotebookId]
      : ["documents"],
    queryFn: async () => {
      const url = activeNotebookId
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
    <aside className="w-72 h-full border-r border-[#242628] bg-[#0C0D0E] flex flex-col shrink-0 select-none">
      {/* Top Header */}
      <div className="p-3 border-b border-[#242628] space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-mono uppercase tracking-wider text-[#85888C]">
              Fontes em Custódia
            </span>
            <span className="text-[10px] font-mono text-[#55585D]">
              [{documents.length}]
            </span>
          </div>

          <button
            onClick={() => setAddSourceModalOpen(true)}
            className="inline-flex items-center gap-1 rounded bg-[#161719] hover:bg-[#222427] text-[#E3E3E3] border border-[#242628] hover:border-[#383B40] px-2 py-1 text-[11px] font-sans transition-colors cursor-pointer"
          >
            <Plus className="h-3 w-3" />
            <span>Anexar PDF</span>
          </button>
        </div>

        {/* Select All Row */}
        {completedDocs.length > 0 && (
          <div
            onClick={handleToggleAll}
            className="flex items-center justify-between rounded bg-[#161719]/40 hover:bg-[#161719] px-2 py-1.5 text-xs text-[#85888C] hover:text-[#E3E3E3] transition-colors cursor-pointer border border-[#242628]/60"
          >
            <div className="flex items-center gap-1.5">
              {isAllSelected ? (
                <CheckSquare className="h-3.5 w-3.5 text-[#E3E3E3]" />
              ) : (
                <Square className="h-3.5 w-3.5 text-[#55585D]" />
              )}
              <span className="text-[11px] font-sans">
                Selecionar todas as fontes
              </span>
            </div>
            <span className="text-[10px] font-mono text-[#55585D]">
              {selectedSourceIds.length} ativas
            </span>
          </div>
        )}
      </div>

      {/* Sources Linear List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-8 text-[#85888C]">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-[#85888C] mb-1.5" />
            <p className="text-[11px] font-mono">Indexando acervo...</p>
          </div>
        ) : documents.length === 0 ? (
          <div className="p-4 text-center rounded border border-dashed border-[#242628] bg-[#161719]/20 mt-3">
            <FileText className="h-4 w-4 text-[#55585D] mx-auto mb-1.5" />
            <p className="text-xs font-sans text-[#E3E3E3]">
              Nenhuma fonte anexada
            </p>
            <p className="text-[10px] font-mono text-[#85888C] mt-0.5">
              Anexe PDFs para indexação
            </p>
            <button
              onClick={() => setAddSourceModalOpen(true)}
              className="mt-2.5 inline-flex items-center gap-1 rounded bg-[#161719] hover:bg-[#222427] text-[#E3E3E3] border border-[#242628] px-2 py-1 text-[11px] font-sans transition-colors cursor-pointer"
            >
              <Plus className="h-3 w-3" /> Anexar
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
                className={`group flex items-center justify-between gap-2 rounded px-2.5 py-2 border transition-all ${
                  isSelected
                    ? "bg-[#161719] border-[#383B40]"
                    : "bg-[#0C0D0E] hover:bg-[#161719]/60 border-[#242628]/80"
                }`}
              >
                <div
                  onClick={() => isCompleted && toggleSourceSelection(doc.id)}
                  className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer"
                >
                  {isCompleted ? (
                    isSelected ? (
                      <CheckSquare className="h-3.5 w-3.5 text-[#E3E3E3] shrink-0" />
                    ) : (
                      <Square className="h-3.5 w-3.5 text-[#55585D] shrink-0 group-hover:text-[#85888C]" />
                    )
                  ) : (
                    <Loader2 className="h-3.5 w-3.5 text-[#F59E0B] animate-spin shrink-0" />
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-sans font-medium text-[#E3E3E3] truncate leading-tight">
                      {doc.title}
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-[10px] font-mono text-[#85888C]">
                      <span>{docCode}</span>
                      <span>·</span>
                      {isCompleted ? (
                        <span className="text-[#10B981] flex items-center gap-1">
                          <span className="h-1 w-1 rounded-full bg-[#10B981]" />
                          Pronto
                        </span>
                      ) : (
                        <span className="text-[#F59E0B] flex items-center gap-1">
                          <span className="h-1 w-1 rounded-full bg-[#F59E0B] animate-pulse" />
                          Indexando
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => deleteMutation.mutate(doc.id)}
                  title="Excluir fonte"
                  className="opacity-0 group-hover:opacity-100 p-1 rounded text-[#85888C] hover:text-[#EF4444] hover:bg-[#EF4444]/10 transition-all cursor-pointer"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
