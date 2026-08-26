"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/useAuthStore";
import { useChatStore } from "@/stores/useChatStore";
import {
  ArrowLeft,
  Share2,
  Settings,
  LogOut,
  CheckCircle2,
  FolderOpen,
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
    <header className="h-12 w-full border-b border-[#242628] bg-[#0C0D0E] px-4 flex items-center justify-between shrink-0 select-none z-30">
      {/* Left: Back Link & Editable Title */}
      <div className="flex items-center gap-2.5">
        <Link
          href="/"
          title="Voltar ao acervo"
          className="flex h-7 w-7 items-center justify-center rounded bg-[#161719] border border-[#242628] text-[#85888C] hover:text-[#E3E3E3] hover:border-[#383B40] transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
        </Link>

        <span className="h-3 w-[1px] bg-[#242628]" />

        <div className="flex items-center gap-2">
          {isEditingTitle ? (
            <input
              type="text"
              value={tempTitle}
              onChange={(e) => setTempTitle(e.target.value)}
              onBlur={handleTitleSubmit}
              onKeyDown={(e) => e.key === "Enter" && handleTitleSubmit()}
              autoFocus
              className="bg-[#161719] text-xs font-medium text-[#E3E3E3] px-2 py-0.5 rounded border border-[#383B40] focus:outline-none"
            />
          ) : (
            <h1
              onClick={() => {
                setTempTitle(notebookTitle);
                setIsEditingTitle(true);
              }}
              title="Clique para renomear"
              className="text-xs font-medium text-[#E3E3E3] hover:text-white cursor-pointer px-1 py-0.5 rounded hover:bg-[#161719] transition-colors max-w-[220px] sm:max-w-md truncate"
            >
              {notebookTitle}
            </h1>
          )}

          <span className="hidden sm:inline-flex items-center gap-1 rounded bg-[#161719] border border-[#242628] px-2 py-0.5 text-[10px] font-mono text-[#85888C]">
            <CheckCircle2 className="h-2.5 w-2.5 text-[#10B981]" />
            {selectedSourceIds.length > 0
              ? `${selectedSourceIds.length} ${
                  selectedSourceIds.length === 1 ? "fonte ativa" : "fontes ativas"
                }`
              : "Todo o acervo do caderno"}
          </span>
        </div>
      </div>

      {/* Right: Technical Controls & Profile */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => alert("Link de compartilhamento de dossiê copiado.")}
          className="hidden sm:inline-flex items-center gap-1 rounded border border-[#242628] bg-[#161719] hover:bg-[#222427] px-2.5 py-1 text-[11px] font-sans text-[#85888C] hover:text-[#E3E3E3] transition-colors cursor-pointer"
        >
          <Share2 className="h-3 w-3" />
          <span>Exportar Dossiê</span>
        </button>

        <span className="h-3 w-[1px] bg-[#242628] mx-0.5 hidden sm:block" />

        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-1.5 rounded border border-[#242628] bg-[#161719] px-2 py-0.5 text-xs text-[#E3E3E3]">
            <div className="h-3.5 w-3.5 rounded-sm bg-[#242628] flex items-center justify-center text-[9px] font-mono font-medium text-[#E3E3E3] uppercase">
              {user?.name ? user.name[0] : "U"}
            </div>
            <span className="max-w-[100px] truncate text-[11px] font-mono text-[#85888C] hidden md:inline">
              {user?.email || user?.name}
            </span>
          </div>

          <button
            onClick={handleLogout}
            title="Encerrar sessão"
            className="rounded p-1 text-[#85888C] hover:text-[#EF4444] hover:bg-[#161719] transition-colors cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
}
