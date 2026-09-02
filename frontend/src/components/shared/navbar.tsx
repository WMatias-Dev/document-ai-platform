"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/useAuthStore";
import {
  BookOpen,
  BarChart3,
  LogOut,
  User as UserIcon,
  Sparkles,
} from "lucide-react";

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  if (!isAuthenticated) return null;

  const navItems = [
    {
      name: "Cadernos de Pesquisa",
      href: "/notebook",
      icon: BookOpen,
    },
    {
      name: "Observabilidade & RAG",
      href: "/evaluation",
      icon: BarChart3,
    },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 bg-white/80 backdrop-blur-md transition-all shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* Brand */}
        <Link href="/notebook" className="flex items-center gap-2.5 group">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-600 group-hover:bg-emerald-100/80 transition-all shadow-xs group-hover:scale-105">
            <BookOpen className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-sans font-semibold text-sm tracking-tight text-slate-800">
              Document AI Platform
            </span>
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-mono text-emerald-700 border border-emerald-200/60 flex items-center gap-1">
              <Sparkles className="h-2.5 w-2.5 text-emerald-600" /> v2.0
            </span>
          </div>
        </Link>

        {/* Navigation Tabs */}
        <nav className="hidden md:flex items-center gap-1.5 bg-slate-100/70 p-1 rounded-xl border border-slate-200/60">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href === "/notebook" && pathname === "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? "bg-white text-emerald-700 shadow-xs border border-slate-200/60 font-semibold"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
                }`}
              >
                <Icon className={`h-3.5 w-3.5 ${isActive ? "text-emerald-600" : "text-slate-500"}`} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* User Profile & Logout */}
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-xl border border-slate-200/80 bg-slate-50/80 text-xs font-sans text-slate-600">
            <UserIcon className="h-3.5 w-3.5 text-emerald-600" />
            <span className="truncate max-w-[130px] font-medium text-slate-700">
              {user?.name || user?.email || "Pesquisador"}
            </span>
          </div>

          <button
            onClick={handleLogout}
            title="Encerrar sessão"
            className="flex items-center gap-1 px-2.5 py-1 rounded-xl border border-slate-200 hover:border-red-200 bg-white hover:bg-red-50 text-xs text-slate-600 hover:text-red-600 transition-all cursor-pointer shadow-xs active:scale-[0.98]"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Sair</span>
          </button>
        </div>
      </div>
    </header>
  );
}
