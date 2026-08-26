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
  Folder,
  ArrowRight,
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
      className="group relative flex flex-col justify-between rounded border border-[#242628] bg-[#161719] hover:bg-[#1C1D20] hover:border-[#383B40] p-4 transition-all cursor-pointer min-h-[160px] select-none"
    >
      {/* Top Header: Code Tag & Context Actions */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono uppercase tracking-wider text-[#85888C] bg-[#0C0D0E] px-1.5 py-0.5 rounded border border-[#242628]">
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
            className="rounded p-1 text-[#85888C] hover:text-[#E3E3E3] hover:bg-[#242628] transition-colors cursor-pointer"
          >
            <MoreVertical className="h-3.5 w-3.5" />
          </button>

          {isMenuOpen && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute right-0 top-6 z-30 w-36 rounded border border-[#242628] bg-[#161719] p-1 shadow-2xl space-y-0.5 animate-in fade-in duration-100"
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsMenuOpen(false);
                  setIsEditing(true);
                }}
                className="w-full flex items-center gap-2 rounded px-2 py-1.5 text-xs font-sans text-[#E3E3E3] hover:bg-[#242628] transition-colors text-left cursor-pointer"
              >
                <Edit2 className="h-3 w-3 text-[#85888C]" />
                Renomear
              </button>

              <div className="h-[1px] bg-[#242628] my-0.5" />

              <button
                onClick={handleDelete}
                className="w-full flex items-center gap-2 rounded px-2 py-1.5 text-xs font-sans text-[#EF4444] hover:bg-[#EF4444]/10 transition-colors text-left cursor-pointer"
              >
                <Trash2 className="h-3 w-3" />
                Excluir
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Middle: Title */}
      <div className="my-2">
        {isEditing ? (
          <form onSubmit={handleRename} onClick={(e) => e.stopPropagation()}>
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onBlur={handleRename}
              autoFocus
              className="w-full bg-[#0C0D0E] text-xs font-sans text-[#E3E3E3] px-2 py-1 rounded border border-[#383B40] focus:outline-none"
            />
          </form>
        ) : (
          <h3 className="text-sm font-medium text-[#E3E3E3] group-hover:text-white line-clamp-2 leading-snug">
            {notebook.title}
          </h3>
        )}
      </div>

      {/* Bottom Footer: Sources Count & Activity */}
      <div className="flex items-center justify-between text-[10px] font-mono text-[#85888C] pt-2.5 border-t border-[#242628]/60">
        <span>
          {notebook.source_count}{" "}
          {notebook.source_count === 1 ? "fonte indexada" : "fontes indexadas"}
        </span>
        <div className="flex items-center gap-1 text-[#85888C] group-hover:text-[#E3E3E3] transition-colors">
          <span>Acessar</span>
          <ArrowRight className="h-3 w-3" />
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
      className="group flex flex-col items-center justify-center rounded border border-dashed border-[#242628] bg-[#0C0D0E] hover:bg-[#161719] hover:border-[#383B40] p-6 text-center transition-all cursor-pointer min-h-[160px] select-none"
    >
      <div className="flex h-9 w-9 items-center justify-center rounded bg-[#161719] border border-[#242628] text-[#85888C] group-hover:text-[#E3E3E3] group-hover:border-[#383B40] transition-colors mb-2.5">
        <Plus className="h-4 w-4" />
      </div>

      <h3 className="text-xs font-medium text-[#E3E3E3] group-hover:text-white transition-colors">
        Criar Novo Caderno de Pesquisa
      </h3>
      <p className="text-[10px] font-mono text-[#85888C] mt-1">
        [Novo Espaço de Evidências]
      </p>
    </div>
  );
}
