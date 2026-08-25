"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useNotebookStore } from "@/stores/useNotebookStore";
import { useChatStore } from "@/stores/useChatStore";
import { X, Sparkles, Plus, BookOpen, FileUp } from "lucide-react";

interface CreateNotebookModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const EMOJI_PRESETS = ["📑", "🧠", "📊", "💡", "🔬", "⚖️", "🚀", "📁"];

export function CreateNotebookModal({
  isOpen,
  onClose,
}: CreateNotebookModalProps) {
  const router = useRouter();
  const createNotebook = useNotebookStore((state) => state.createNotebook);
  const setNotebookTitle = useChatStore((state) => state.setNotebookTitle);

  const [title, setTitle] = useState("");
  const [selectedEmoji, setSelectedEmoji] = useState("📑");

  if (!isOpen) return null;

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const finalTitle = title.trim() || "Novo Caderno";
    const id = createNotebook(finalTitle, selectedEmoji);
    setNotebookTitle(finalTitle);

    toast.success("Caderno criado com sucesso!", {
      description: `"${finalTitle}" pronto para receber fontes.`,
    });

    onClose();
    router.push(`/notebook/${id}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#1e1f20] p-6 shadow-2xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/5 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#0842a0]/40 text-[#a8c7fa] border border-[#a8c7fa]/20 text-lg">
              {selectedEmoji}
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">
                Criar novo notebook
              </h3>
              <p className="text-xs text-zinc-400">
                Organize seus documentos em um espaço de trabalho dedicado.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-full p-2 text-zinc-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">
              Título do Notebook
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Análise de Contratos de Fornecedores"
              autoFocus
              className="w-full rounded-2xl border border-white/10 bg-[#131314] px-4 py-3 text-sm text-white placeholder-zinc-500 focus:border-[#a8c7fa]/60 focus:outline-none focus:ring-1 focus:ring-[#a8c7fa]/40 transition-colors"
            />
          </div>

          {/* Emoji Preset Selection */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">
              Ícone / Emoji do Projeto
            </label>
            <div className="flex items-center gap-2">
              {EMOJI_PRESETS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setSelectedEmoji(emoji)}
                  className={`h-9 w-9 rounded-xl text-base flex items-center justify-center transition-all cursor-pointer ${
                    selectedEmoji === emoji
                      ? "bg-[#0842a0] border border-[#a8c7fa] scale-110 shadow-md"
                      : "bg-[#131314] hover:bg-[#282a2c] border border-white/5"
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Quick Tip */}
          <div className="rounded-2xl border border-white/5 bg-[#131314]/80 p-3 flex items-start gap-2.5 text-xs text-zinc-400">
            <Sparkles className="h-4 w-4 text-[#a8c7fa] shrink-0 mt-0.5" />
            <p>
              Você poderá adicionar PDFs, consultar embeddings com busca HNSW e
              gerar resumos com o Gemini 3.7 logo após criar.
            </p>
          </div>

          {/* Footer Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full px-5 py-2.5 text-xs font-medium text-zinc-300 hover:bg-white/5 transition-colors cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-full bg-[#a8c7fa] hover:bg-[#c2e7ff] text-[#041e49] font-semibold px-6 py-2.5 text-xs transition-all shadow-md hover:scale-105 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              Criar Notebook
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
