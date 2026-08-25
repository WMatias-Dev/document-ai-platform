"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/useAuthStore";
import { useChatStore } from "@/stores/useChatStore";
import {
  FileText,
  Share2,
  Settings,
  LogOut,
  ChevronLeft,
  SlidersHorizontal,
  BookmarkCheck,
  ArrowLeft,
} from "lucide-react";

export function NotebookHeader() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const { notebookTitle, setNotebookTitle, selectedSourceIds } = useChatStore();
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState(notebookTitle);

  const handleTitleSubmit = () => {
    if (tempTitle.trim()) {
      setNotebookTitle(tempTitle.trim());
    }
    setIsEditingTitle(false);
  };

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  return (
    <header className="h-14 w-full border-b border-white/[0.06] bg-[#131314] px-4 flex items-center justify-between shrink-0 select-none">
      {/* Left: Navigation, Icon & Editable Title */}
      <div className="flex items-center gap-3">
        <Link
          href="/"
          title="Voltar aos notebooks"
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1e1f20] hover:bg-[#282a2c] text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>

        <div className="h-4 w-[1px] bg-white/10 mx-0.5" />

        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1e1f20] border border-white/5 text-zinc-300">
            <FileText className="h-4 w-4 text-zinc-400" />
          </div>

          {isEditingTitle ? (
            <input
              type="text"
              value={tempTitle}
              onChange={(e) => setTempTitle(e.target.value)}
              onBlur={handleTitleSubmit}
              onKeyDown={(e) => e.key === "Enter" && handleTitleSubmit()}
              autoFocus
              className="bg-[#1e1f20] text-sm font-medium text-white px-2 py-1 rounded-md border border-white/20 focus:outline-none focus:ring-1 focus:ring-zinc-400"
            />
          ) : (
            <h1
              onClick={() => {
                setTempTitle(notebookTitle);
                setIsEditingTitle(true);
              }}
              title="Clique para renomear"
              className="text-sm font-medium text-zinc-200 hover:text-white cursor-pointer px-1.5 py-0.5 rounded hover:bg-white/5 transition-colors max-w-[240px] sm:max-w-md truncate"
            >
              {notebookTitle}
            </h1>
          )}

          <span className="hidden sm:inline-flex items-center gap-1 rounded-md bg-[#1e1f20] px-2 py-0.5 text-[11px] font-medium text-zinc-400 border border-white/5">
            <BookmarkCheck className="h-3 w-3 text-zinc-500" />
            {selectedSourceIds.length > 0
              ? `${selectedSourceIds.length} ${
                  selectedSourceIds.length === 1 ? "fonte ativa" : "fontes ativas"
                }`
              : "Todas as fontes"}
          </span>
        </div>
      </div>

      {/* Right: Functional Workspace Controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => alert("Link de compartilhamento copiado.")}
          className="hidden sm:inline-flex items-center gap-1.5 rounded-lg bg-[#1e1f20] hover:bg-[#282a2c] px-3 py-1.5 text-xs font-medium text-zinc-300 border border-white/5 transition-colors cursor-pointer"
        >
          <Share2 className="h-3.5 w-3.5 text-zinc-400" />
          <span>Compartilhar</span>
        </button>

        <div className="h-4 w-[1px] bg-white/10 mx-1 hidden sm:block" />

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg bg-[#1e1f20] border border-white/5 px-2.5 py-1 text-xs text-zinc-300">
            <div className="h-5 w-5 rounded-full bg-zinc-700 flex items-center justify-center text-[10px] font-semibold text-zinc-200 uppercase">
              {user?.name ? user.name[0] : "U"}
            </div>
            <span className="max-w-[120px] truncate text-xs font-medium hidden md:inline text-zinc-300">
              {user?.name || user?.email}
            </span>
          </div>

          <button
            onClick={handleLogout}
            title="Encerrar sessão"
            className="rounded-lg p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-white/5 transition-colors cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
