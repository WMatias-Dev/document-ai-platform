"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/useAuthStore";
import { BookOpen, Settings, LogOut, ShieldCheck } from "lucide-react";

export function HomeHeader() {
  const router = useRouter();
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[#242628] bg-[#0C0D0E]/95 backdrop-blur-sm px-6 sm:px-10 h-14 flex items-center justify-between">
      {/* Left: Brand / Platform Identity */}
      <Link href="/" className="flex items-center gap-3 group">
        <div className="flex h-7 w-7 items-center justify-center rounded bg-[#161719] border border-[#242628] text-[#E3E3E3]">
          <BookOpen className="h-3.5 w-3.5" />
        </div>
        <div className="flex items-center gap-2.5">
          <span className="font-medium text-sm tracking-tight text-[#E3E3E3]">
            Document AI
          </span>
          <span className="h-3 w-[1px] bg-[#242628]" />
          <span className="text-[11px] font-mono uppercase tracking-widest text-[#85888C]">
            Research Workspace
          </span>
        </div>
      </Link>

      {/* Right: Operational Controls & User Profile */}
      <div className="flex items-center gap-3">
        <div className="hidden sm:flex items-center gap-1.5 rounded border border-[#242628] bg-[#161719] px-2.5 py-1 text-[11px] font-mono text-[#85888C]">
          <ShieldCheck className="h-3 w-3 text-[#10B981]" />
          <span>Ambiente Autenticado</span>
        </div>

        <button
          onClick={() => alert("Configurações do ambiente de pesquisa documental.")}
          title="Configurações"
          className="rounded p-1.5 text-[#85888C] hover:text-[#E3E3E3] hover:bg-[#161719] transition-colors cursor-pointer"
        >
          <Settings className="h-4 w-4" />
        </button>

        <div className="h-3 w-[1px] bg-[#242628] mx-0.5" />

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded border border-[#242628] bg-[#161719] px-2.5 py-1 text-xs text-[#E3E3E3]">
            <div className="h-4 w-4 rounded-sm bg-[#242628] flex items-center justify-center text-[10px] font-mono font-medium text-[#E3E3E3] uppercase">
              {user?.name ? user.name[0] : "U"}
            </div>
            <span className="max-w-[120px] truncate text-xs font-mono text-[#85888C] hidden md:inline">
              {user?.email || user?.name}
            </span>
          </div>

          <button
            onClick={handleLogout}
            title="Encerrar sessão"
            className="rounded p-1.5 text-[#85888C] hover:text-[#EF4444] hover:bg-[#161719] transition-colors cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
