"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/useAuthStore";
import { useChatStore } from "@/stores/useChatStore";
import {
  ArrowLeft,
  Share2,
  LogOut,
  CheckCircle2,
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
    <header className="h-12 w-full border-b border-slate-200/80 bg-white px-4 flex items-center justify-between shrink-0 select-none z-30 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
      {/* Left: Back Link & Editable Title */}
      <div className="flex items-center gap-2.5">
        <Link
          href="/"
          title="Voltar ao catálogo de cadernos"
          className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-50 border border-slate-200 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 hover:border-emerald-200 transition-all active:scale-[0.98]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
        </Link>

        <span className="h-3.5 w-[1px] bg-slate-200" />

        <div className="flex items-center gap-2">
          {isEditingTitle ? (
            <input
              id="notebook-inline-title"
              name="notebook-title"
              type="text"
              value={tempTitle}
              onChange={(e) => setTempTitle(e.target.value)}
              onBlur={handleTitleSubmit}
              onKeyDown={(e) => e.key === "Enter" && handleTitleSubmit()}
              autoFocus
              className="bg-slate-50 text-xs font-semibold text-slate-800 px-2 py-0.5 rounded-lg border border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          ) : (
            <h1
              onClick={() => {
                setTempTitle(notebookTitle);
                setIsEditingTitle(true);
              }}
              title="Clique para renomear"
              className="text-xs font-semibold text-slate-800 hover:text-emerald-700 cursor-pointer px-1.5 py-0.5 rounded-md hover:bg-slate-100/80 transition-colors max-w-[220px] sm:max-w-md truncate"
            >
              {notebookTitle}
            </h1>
          )}

          <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200/60 px-2.5 py-0.5 text-[10px] font-mono text-emerald-700">
            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
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
          className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-2.5 py-1 text-[11px] font-sans font-medium text-slate-600 hover:text-slate-900 transition-all cursor-pointer shadow-2xs active:scale-[0.98]"
        >
          <Share2 className="h-3.5 w-3.5 text-slate-500" />
          <span>Exportar Dossiê</span>
        </button>

        <span className="h-3.5 w-[1px] bg-slate-200 mx-0.5 hidden sm:block" />

        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-700">
            <div className="h-4 w-4 rounded-md bg-emerald-600 flex items-center justify-center text-[9px] font-mono font-bold text-white uppercase">
              {user?.name ? user.name[0] : "U"}
            </div>
            <span className="max-w-[120px] truncate text-[11px] font-sans font-medium text-slate-600 hidden md:inline">
              {user?.email || user?.name}
            </span>
          </div>

          <button
            onClick={handleLogout}
            title="Encerrar sessão"
            className="rounded-lg p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
}
