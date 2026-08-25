"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Notebook, useNotebookStore } from "@/stores/useNotebookStore";
import { useChatStore } from "@/stores/useChatStore";
import {
  Plus,
  MoreVertical,
  Layers,
  Trash2,
  Copy,
  Edit2,
  FileText,
} from "lucide-react";

interface NotebookCardProps {
  notebook: Notebook;
}

export function NotebookCard({ notebook }: NotebookCardProps) {
  const router = useRouter();
  const { deleteNotebook, duplicateNotebook, updateNotebook } =
    useNotebookStore();
  const setNotebookTitle = useChatStore((state) => state.setNotebookTitle);

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [newTitle, setNewTitle] = useState(notebook.title);

  const handleOpenNotebook = () => {
    if (isEditing) return;
    setNotebookTitle(notebook.title);
    router.push(`/notebook/${notebook.id}`);
  };

  const handleRename = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTitle.trim()) {
      updateNotebook(notebook.id, { title: newTitle.trim() });
      toast.success("Notebook renomeado!");
    }
    setIsEditing(false);
  };

  const handleDuplicate = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMenuOpen(false);
    const newId = duplicateNotebook(notebook.id);
    toast.success("Notebook duplicado com sucesso!");
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMenuOpen(false);
    deleteNotebook(notebook.id);
    toast.success("Notebook excluído.");
  };

  return (
    <div
      onClick={handleOpenNotebook}
      className="group relative flex flex-col justify-between rounded-3xl border border-white/10 bg-[#222327] hover:border-white/20 p-5 transition-all hover:-translate-y-1 hover:shadow-xl cursor-pointer min-h-[190px] select-none"
    >
      {/* Top Header: Emoji & 3-dots Menu */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#1e1f20] border border-white/5 text-lg shadow-sm">
          {notebook.emoji || "📑"}
        </div>

        {/* 3-dots Context Menu */}
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsMenuOpen(!isMenuOpen);
            }}
            className="rounded-full p-1.5 text-zinc-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
          >
            <MoreVertical className="h-4 w-4" />
          </button>

          {isMenuOpen && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute right-0 top-8 z-30 w-44 rounded-2xl border border-white/10 bg-[#1e1f20] p-1.5 shadow-2xl space-y-1 animate-in fade-in zoom-in-95 duration-150"
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsMenuOpen(false);
                  setIsEditing(true);
                }}
                className="w-full flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-zinc-300 hover:text-white hover:bg-white/5 transition-colors text-left cursor-pointer"
              >
                <Edit2 className="h-3.5 w-3.5" />
                Renomear
              </button>

              <button
                onClick={handleDuplicate}
                className="w-full flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-zinc-300 hover:text-white hover:bg-white/5 transition-colors text-left cursor-pointer"
              >
                <Copy className="h-3.5 w-3.5" />
                Duplicar
              </button>

              <div className="h-[1px] bg-white/5 my-1" />

              <button
                onClick={handleDelete}
                className="w-full flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-red-400 hover:bg-red-500/10 transition-colors text-left cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Excluir
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Middle: Title or Inline Rename Input */}
      <div className="my-3">
        {isEditing ? (
          <form onSubmit={handleRename} onClick={(e) => e.stopPropagation()}>
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onBlur={handleRename}
              autoFocus
              className="w-full bg-[#131314] text-sm font-semibold text-white px-2 py-1 rounded-lg border border-[#a8c7fa] focus:outline-none"
            />
          </form>
        ) : (
          <h3 className="text-base font-semibold text-white group-hover:text-[#a8c7fa] transition-colors line-clamp-2 leading-snug">
            {notebook.title}
          </h3>
        )}
      </div>

      {/* Bottom Footer: Date and Sources Count */}
      <div className="flex items-center justify-between text-[11px] text-zinc-400 font-medium pt-3 border-t border-white/5">
        <span>{notebook.updatedAt}</span>
        <span className="flex items-center gap-1 font-mono text-zinc-300">
          <Layers className="h-3 w-3 text-zinc-400" />
          {notebook.sourceCount} fontes
        </span>
      </div>
    </div>
  );
}

/* Card Fixo de Criar Novo Notebook */
export function CreateNotebookCard({ onClick }: { onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="group relative flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-white/15 bg-[#1e1f20]/40 hover:bg-[#1e1f20] hover:border-white/30 p-6 text-center transition-all hover:-translate-y-1 hover:shadow-xl cursor-pointer min-h-[190px] select-none"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#282a2c] text-[#a8c7fa] group-hover:bg-[#0842a0] group-hover:text-white group-hover:scale-110 transition-all shadow-md mb-3">
        <Plus className="h-6 w-6" />
      </div>

      <h3 className="text-sm font-semibold text-white group-hover:text-[#a8c7fa] transition-colors">
        Criar novo notebook
      </h3>
      <p className="text-xs text-zinc-400 mt-1">
        Comece a fundamentar suas pesquisas
      </p>
    </div>
  );
}
