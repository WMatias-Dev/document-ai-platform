"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/useAuthStore";
import { BookOpen, LogOut, BarChart3, User as UserIcon } from "lucide-react";

export function HomeHeader() {
  const router = useRouter();
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 bg-white/80 backdrop-blur-md px-6 sm:px-10 h-14 flex items-center justify-between shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      {/* Left: Brand / Platform Identity */}
      <Link href="/" className="flex items-center gap-3 group">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-600 group-hover:bg-emerald-100 transition-all shadow-xs group-hover:scale-105">
          <BookOpen className="h-4 w-4" />
        </div>
        <div className="flex items-center gap-2.5">
          <span className="font-semibold text-sm tracking-tight text-slate-800">
            Document AI Platform
          </span>
          <span className="h-3 w-[1px] bg-slate-200" />
          <span className="text-[11px] font-sans font-medium text-slate-500">
            Catálogo de Cadernos
          </span>
        </div>
      </Link>

      {/* Right: Operational Controls & User Profile */}
      <div className="flex items-center gap-3">
        <Link
          href="/evaluation"
          title="Métricas do Sistema RAG"
          className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-emerald-50/50 hover:border-emerald-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-emerald-700 transition-all shadow-2xs active:scale-[0.98]"
        >
          <BarChart3 className="h-3.5 w-3.5 text-emerald-600" />
          <span>Observabilidade RAG</span>
        </Link>

        <div className="h-3.5 w-[1px] bg-slate-200 mx-0.5" />

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-700">
            <div className="h-4 w-4 rounded-md bg-emerald-600 flex items-center justify-center text-[10px] font-mono font-bold text-white uppercase">
              {user?.name ? user.name[0] : "U"}
            </div>
            <span className="max-w-[120px] truncate text-xs font-medium text-slate-600 hidden md:inline">
              {user?.name || user?.email}
            </span>
          </div>

          <button
            onClick={handleLogout}
            title="Encerrar sessão"
            className="rounded-xl p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
