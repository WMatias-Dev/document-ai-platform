"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { NotebookItem } from "@/types/api";
import { HomeHeader } from "./home-header";
import { FeaturedNotebooks } from "./featured-notebooks";
import { NotebookCard, CreateNotebookCard } from "./notebook-card";
import { CreateNotebookModal } from "./create-notebook-modal";
import {
  Plus,
  Search,
  LayoutGrid,
  List,
  Loader2,
} from "lucide-react";

type FilterTab = "all" | "models";
type SortOption = "recent" | "alpha";

export function HomeView() {
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [sortOption, setSortOption] = useState<SortOption>("recent");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Consulta ao backend
  const { data: notebooks = [], isLoading } = useQuery<NotebookItem[]>({
    queryKey: ["notebooks"],
    queryFn: async () => {
      const res = await apiClient.get("/notebooks/");
      return res.data;
    },
  });

  // Filtragem e busca
  const filteredNotebooks = notebooks
    .filter((nb) => {
      if (searchQuery.trim()) {
        return nb.title
          .toLowerCase()
          .includes(searchQuery.toLowerCase().trim());
      }
      return true;
    })
    .sort((a, b) => {
      if (sortOption === "alpha") {
        return a.title.localeCompare(b.title);
      }
      return 0;
    });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col selection:bg-emerald-100 selection:text-emerald-800">
      {/* 1. Header Global */}
      <HomeHeader />

      {/* 2. Conteúdo Principal */}
      <main className="flex-1 mx-auto w-full max-w-7xl px-6 sm:px-10 py-8 space-y-8">
        {/* Barra de Controles e Filtros */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-slate-200/80">
          {/* Navegação de Abas */}
          <div className="flex items-center gap-1.5 bg-slate-200/60 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab("all")}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all cursor-pointer ${
                activeTab === "all"
                  ? "bg-white text-emerald-800 shadow-xs font-semibold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Meus Cadernos ({notebooks.length})
            </button>

            <button
              onClick={() => setActiveTab("models")}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all cursor-pointer ${
                activeTab === "models"
                  ? "bg-white text-emerald-800 shadow-xs font-semibold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Modelos de Análise
            </button>
          </div>

          {/* Ações e Filtros */}
          <div className="flex items-center gap-2.5">
            {/* Campo de Busca */}
            <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 shadow-2xs focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20 transition-all">
              <Search className="h-4 w-4 text-slate-400" />
              <input
                id="search-notebooks-input"
                name="search-notebooks"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filtrar cadernos..."
                className="bg-transparent text-xs text-slate-800 placeholder-slate-400 focus:outline-none w-36 sm:w-48 font-sans"
              />
            </div>

            {/* Ordenação */}
            <select
              id="sort-notebooks-select"
              name="sort"
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as SortOption)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-sans text-slate-700 focus:outline-none focus:border-emerald-500 cursor-pointer shadow-2xs"
            >
              <option value="recent">Mais Recentes</option>
              <option value="alpha">Nome (A-Z)</option>
            </select>

            {/* Alternador de Grade / Lista */}
            <div className="hidden sm:flex items-center rounded-xl border border-slate-200 bg-white p-1 text-slate-500 shadow-2xs">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-1 rounded-lg transition-colors ${
                  viewMode === "grid" ? "bg-slate-100 text-emerald-700" : "hover:text-slate-900"
                }`}
                title="Visualização em Grade"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`p-1 rounded-lg transition-colors ${
                  viewMode === "list" ? "bg-slate-100 text-emerald-700" : "hover:text-slate-900"
                }`}
                title="Visualização em Lista"
              >
                <List className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Ação Primária: + Novo Caderno */}
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-4 py-2 text-xs transition-all shadow-sm hover:shadow-emerald-600/20 cursor-pointer active:scale-[0.98]"
            >
              <Plus className="h-4 w-4" />
              <span>Novo Caderno</span>
            </button>
          </div>
        </div>

        {/* 3. Seção de Modelos de Investigação */}
        {(activeTab === "all" || activeTab === "models") && !searchQuery && (
          <FeaturedNotebooks />
        )}

        {/* 4. Seção Principal de Cadernos */}
        {(activeTab === "all") && (
          <section className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Cadernos em Andamento
                </h2>
                <span className="text-xs font-mono font-medium text-slate-400">
                  ({filteredNotebooks.length})
                </span>
              </div>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center p-12 text-slate-500 gap-2 text-xs font-sans">
                <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
                <span>Carregando cadernos...</span>
              </div>
            ) : (
              <div
                className={`grid gap-4 ${
                  viewMode === "grid"
                    ? "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
                    : "grid-cols-1"
                }`}
              >
                {/* Card Fixo de Novo Caderno */}
                {!searchQuery && (
                  <CreateNotebookCard
                    onClick={() => setIsCreateModalOpen(true)}
                  />
                )}

                {/* Cards de Cadernos Reais */}
                {filteredNotebooks.map((nb, index) => (
                  <NotebookCard key={nb.id} notebook={nb} index={index} />
                ))}
              </div>
            )}
          </section>
        )}
      </main>

      {/* Modal de Criação */}
      <CreateNotebookModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />
    </div>
  );
}
