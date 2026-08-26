"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiClient, getErrorMessage } from "@/lib/api-client";
import { NotebookItem } from "@/types/api";
import { useChatStore } from "@/stores/useChatStore";
import { X, Plus, Loader2, FolderPlus, FileCheck } from "lucide-react";

interface CreateNotebookModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateNotebookModal({
  isOpen,
  onClose,
}: CreateNotebookModalProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const setNotebookTitle = useChatStore((state) => state.setNotebookTitle);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const createMutation = useMutation({
    mutationFn: async (payload: { title: string; description?: string }) => {
      const res = await apiClient.post<NotebookItem>("/notebooks/", {
        title: payload.title,
        description: payload.description || null,
        emoji: "📑",
      });
      return res.data;
    },
    onSuccess: (newNotebook) => {
      setNotebookTitle(newNotebook.title);
      queryClient.invalidateQueries({ queryKey: ["notebooks"] });
      toast.success("Caderno de pesquisa criado.");
      onClose();
      router.push(`/notebook/${newNotebook.id}`);
    },
    onError: (err: any) => {
      const msg = getErrorMessage(err, "Erro ao criar caderno.");
      toast.error(msg);
    },
  });

  if (!isOpen) return null;

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const finalTitle = title.trim() || "Caderno de Pesquisa Sem Título";
    createMutation.mutate({ title: finalTitle, description: description.trim() });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-md rounded border border-[#242628] bg-[#161719] p-6 shadow-2xl space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#242628] pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded bg-[#0C0D0E] border border-[#242628] text-[#E3E3E3]">
              <FolderPlus className="h-3.5 w-3.5" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-[#E3E3E3]">
                Novo Caderno de Pesquisa
              </h3>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded p-1 text-[#85888C] hover:text-[#E3E3E3] hover:bg-[#242628] transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-xs font-mono text-[#85888C] mb-1.5 uppercase">
              Título do Projeto / Escopo
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Auditoria de Contratos de Prestação de Serviços"
              autoFocus
              className="w-full rounded border border-[#242628] bg-[#0C0D0E] px-3 py-2 text-xs text-[#E3E3E3] placeholder-[#55585D] focus:border-[#383B40] focus:outline-none transition-colors font-sans"
            />
          </div>

          <div>
            <label className="block text-xs font-mono text-[#85888C] mb-1.5 uppercase">
              Descrição do Acervo (Opcional)
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Análise comparativa de cláusulas de rescisão e multas operacionais..."
              className="w-full rounded border border-[#242628] bg-[#0C0D0E] px-3 py-2 text-xs text-[#E3E3E3] placeholder-[#55585D] focus:border-[#383B40] focus:outline-none transition-colors font-sans resize-none"
            />
          </div>

          {/* Operational Scope Notice */}
          <div className="rounded border border-[#242628] bg-[#0C0D0E] p-3 flex items-start gap-2 text-[11px] text-[#85888C]">
            <FileCheck className="h-3.5 w-3.5 text-[#10B981] shrink-0 mt-0.5" />
            <p>
              As fontes anexadas pertencerão exclusivamente a este caderno,
              delimitando o escopo de busca e citações do RAG.
            </p>
          </div>

          {/* Footer Actions */}
          <div className="flex justify-end gap-2 pt-2 border-t border-[#242628]">
            <button
              type="button"
              onClick={onClose}
              className="rounded px-3 py-1.5 text-xs font-sans text-[#85888C] hover:text-[#E3E3E3] hover:bg-[#242628] transition-colors cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={createMutation.isPending}
              className="inline-flex items-center gap-1.5 rounded bg-[#E3E3E3] hover:bg-white text-[#0C0D0E] font-medium px-4 py-1.5 text-xs transition-all cursor-pointer disabled:opacity-50"
            >
              {createMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
              Criar Caderno
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
