"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";
import { NotebookItem } from "@/types/api";
import { useChatStore } from "@/stores/useChatStore";
import {
  Plus,
  MoreVertical,
  Trash2,
  Edit2,
  ArrowRight,
  BookOpen,
} from "lucide-react";

interface NotebookCardProps {
  notebook: NotebookItem;
  index: number;
}

export function NotebookCard({ notebook, index }: NotebookCardProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const setNotebookTitle = useChatStore((state) => state.setNotebookTitle);

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [newTitle, setNewTitle] = useState(notebook.title);

  const updateMutation = useMutation({
    mutationFn: async (title: string) => {
      const res = await apiClient.put(`/notebooks/${notebook.id}`, { title });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notebooks"] });
      toast.success("Caderno renomeado.");
    },
    onError: () => {
      toast.error("Erro ao renomear caderno.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiClient.delete(`/notebooks/${notebook.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notebooks"] });
      toast.success("Caderno removido.");
    },
    onError: () => {
      toast.error("Erro ao excluir caderno.");
    },
  });

  const handleOpenNotebook = () => {
    if (isEditing) return;
    setNotebookTitle(notebook.title);
    router.push(`/notebook/${notebook.id}`);
  };

  const handleRename = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTitle.trim() && newTitle.trim() !== notebook.title) {
      updateMutation.mutate(newTitle.trim());
    }
    setIsEditing(false);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMenuOpen(false);
    deleteMutation.mutate();
  };

  const docCode = `ACV-${String(index + 1).padStart(2, "0")}`;

  return (
    <div
      onClick={handleOpenNotebook}
      className="group relative flex flex-col justify-between rounded-xl border border-slate-200/90 bg-white hover:border-emerald-300 hover:shadow-md hover:shadow-emerald-500/5 p-4.5 transition-all cursor-pointer min-h-[165px] select-none shadow-xs active:scale-[0.98]"
    >
      {/* Top Header: Code Tag & Context Actions */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono font-medium uppercase tracking-wider text-slate-500 bg-slate-100/80 px-2 py-0.5 rounded-md border border-slate-200/60">
            {docCode}
          </span>
        </div>

        {/* Context Menu */}
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsMenuOpen(!isMenuOpen);
            }}
            className="rounded-lg p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <MoreVertical className="h-4 w-4" />
          </button>

          {isMenuOpen && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute right-0 top-7 z-30 w-36 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl space-y-0.5 animate-in fade-in duration-100"
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsMenuOpen(false);
                  setIsEditing(true);
                }}
                className="w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-sans text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors text-left cursor-pointer"
              >
                <Edit2 className="h-3.5 w-3.5 text-slate-400" />
                Renomear
              </button>

              <div className="h-[1px] bg-slate-100 my-1" />

              <button
                onClick={handleDelete}
                className="w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-sans text-red-600 hover:bg-red-50 transition-colors text-left cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Excluir
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Middle: Title */}
      <div className="my-2.5">
        {isEditing ? (
          <form onSubmit={handleRename} onClick={(e) => e.stopPropagation()}>
            <input
              id={`notebook-rename-${notebook.id}`}
              name="rename"
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onBlur={handleRename}
              autoFocus
              className="w-full bg-slate-50 text-xs font-semibold text-slate-800 px-2 py-1 rounded-lg border border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </form>
        ) : (
          <h3 className="text-sm font-semibold text-slate-800 group-hover:text-emerald-700 line-clamp-2 leading-snug">
            {notebook.title}
          </h3>
        )}
      </div>

      {/* Bottom Footer: Sources Count & Activity */}
      <div className="flex items-center justify-between text-xs font-sans text-slate-500 pt-2.5 border-t border-slate-100">
        <span>
          {notebook.source_count}{" "}
          {notebook.source_count === 1 ? "fonte indexada" : "fontes indexadas"}
        </span>
        <div className="flex items-center gap-1 font-medium text-slate-600 group-hover:text-emerald-600 transition-colors">
          <span>Abrir</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </div>
      </div>
    </div>
  );
}

/* Card Fixo de Criação de Caderno */
export function CreateNotebookCard({ onClick }: { onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="group flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 hover:border-emerald-300 bg-slate-50/60 hover:bg-emerald-50/30 p-6 text-center transition-all cursor-pointer min-h-[165px] select-none active:scale-[0.98]"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-400 group-hover:text-emerald-600 group-hover:border-emerald-200 group-hover:scale-105 transition-all mb-2.5 shadow-2xs">
        <Plus className="h-5 w-5" />
      </div>

      <h3 className="text-xs font-semibold text-slate-700 group-hover:text-emerald-800 transition-colors">
        Criar Novo Caderno
      </h3>
      <p className="text-[11px] font-sans text-slate-400 mt-1">
        Novo espaço para análise e síntese
      </p>
    </div>
  );
}
