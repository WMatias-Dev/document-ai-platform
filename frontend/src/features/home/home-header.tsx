"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/useAuthStore";
import { FileText, Settings, LogOut, SlidersHorizontal } from "lucide-react";

export function HomeHeader() {
  const router = useRouter();
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/[0.06] bg-[#131314]/90 backdrop-blur-md px-6 sm:px-10 h-16 flex items-center justify-between">
      {/* Left: Brand */}
      <Link href="/" className="flex items-center gap-3 group">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800 border border-white/10 text-zinc-200">
          <FileText className="h-4 w-4" />
        </div>
        <div className="flex items-center gap-2">
          <span className="font-semibold text-base tracking-tight text-white">
            Document AI
          </span>
          <span className="text-xs text-zinc-500 font-medium hidden sm:inline">
            Workspace
          </span>
        </div>
      </Link>

      {/* Right: Controls & User Profile */}
      <div className="flex items-center gap-3">
        <span className="inline-flex items-center rounded-md bg-[#1e1f20] px-2 py-0.5 text-xs font-medium text-zinc-400 border border-white/5">
          Pro Edition
        </span>

        <button
          onClick={() => alert("Configurações da Plataforma")}
          title="Configurações"
          className="rounded-lg p-2 text-zinc-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
        >
          <Settings className="h-4 w-4" />
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
            className="rounded-lg p-1.5 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
