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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-600">
              <FolderPlus className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-800">
                Novo Caderno de Pesquisa
              </h3>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label htmlFor="notebook-title-input" className="block text-xs font-medium text-slate-700 mb-1.5">
              Título do Caderno
            </label>
            <input
              id="notebook-title-input"
              name="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Auditoria Contratual e Cláusulas"
              autoFocus
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all font-sans"
            />
          </div>

          <div>
            <label htmlFor="notebook-desc-input" className="block text-xs font-medium text-slate-700 mb-1.5">
              Descrição (Opcional)
            </label>
            <textarea
              id="notebook-desc-input"
              name="description"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Análise comparativa de prazos, multas e obrigações..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all font-sans resize-none"
            />
          </div>

          {/* Operational Scope Notice */}
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3 flex items-start gap-2.5 text-xs text-emerald-800">
            <FileCheck className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              As fontes anexadas pertencerão exclusivamente a este caderno, garantindo isolamento estrito de contexto e citações na busca RAG.
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={createMutation.isPending}
              className="flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 text-xs font-medium transition-all shadow-sm hover:shadow-emerald-600/20 disabled:opacity-50 cursor-pointer active:scale-[0.98]"
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Criando...</span>
                </>
              ) : (
                <>
                  <Plus className="h-3.5 w-3.5" />
                  <span>Criar Caderno</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
