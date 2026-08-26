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
  FolderKanban,
  FileSpreadsheet,
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
    <div className="min-h-screen bg-[#0C0D0E] text-[#E3E3E3] flex flex-col selection:bg-[#D97706]/20 selection:text-[#FDE68A]">
      {/* 1. Header de Ferramenta */}
      <HomeHeader />

      {/* 2. Conteúdo Principal */}
      <main className="flex-1 mx-auto w-full max-w-7xl px-6 sm:px-10 py-8 space-y-8">
        {/* Barra de Controles e Filtros */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-[#242628]">
          {/* Navegação de Abas Austeras */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveTab("all")}
              className={`rounded px-3 py-1 text-xs font-mono transition-colors cursor-pointer ${
                activeTab === "all"
                  ? "bg-[#161719] text-[#E3E3E3] border border-[#242628]"
                  : "text-[#85888C] hover:text-[#E3E3E3]"
              }`}
            >
              Acervo de Cadernos ({notebooks.length})
            </button>

            <button
              onClick={() => setActiveTab("models")}
              className={`rounded px-3 py-1 text-xs font-mono transition-colors cursor-pointer ${
                activeTab === "models"
                  ? "bg-[#161719] text-[#E3E3E3] border border-[#242628]"
                  : "text-[#85888C] hover:text-[#E3E3E3]"
              }`}
            >
              Modelos de Análise
            </button>
          </div>

          {/* Ações Técnicas */}
          <div className="flex items-center gap-2.5">
            {/* Campo de Busca Rápida */}
            <div className="flex items-center gap-1.5 rounded border border-[#242628] bg-[#161719] px-2.5 py-1">
              <Search className="h-3.5 w-3.5 text-[#85888C]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filtrar cadernos..."
                className="bg-transparent text-xs text-[#E3E3E3] placeholder-[#55585D] focus:outline-none w-32 sm:w-48 font-sans"
              />
            </div>

            {/* Ordenação */}
            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as SortOption)}
              className="rounded border border-[#242628] bg-[#161719] px-2 py-1 text-xs font-mono text-[#85888C] focus:outline-none cursor-pointer"
            >
              <option value="recent" className="bg-[#161719] text-[#E3E3E3]">
                Mais Recentes ▾
              </option>
              <option value="alpha" className="bg-[#161719] text-[#E3E3E3]">
                Nome (A-Z) ▾
              </option>
            </select>

            {/* Alternador de Grade / Lista */}
            <div className="hidden sm:flex items-center rounded border border-[#242628] bg-[#161719] p-0.5 text-[#85888C]">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-1 rounded transition-colors ${
                  viewMode === "grid" ? "bg-[#242628] text-[#E3E3E3]" : "hover:text-[#E3E3E3]"
                }`}
                title="Visualização em Grade"
              >
                <LayoutGrid className="h-3 w-3" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`p-1 rounded transition-colors ${
                  viewMode === "list" ? "bg-[#242628] text-[#E3E3E3]" : "hover:text-[#E3E3E3]"
                }`}
                title="Visualização em Lista"
              >
                <List className="h-3 w-3" />
              </button>
            </div>

            {/* Ação Primária: + Novo Caderno */}
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded bg-[#E3E3E3] hover:bg-white text-[#0C0D0E] font-medium px-3.5 py-1 text-xs transition-all cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Novo Caderno</span>
            </button>
          </div>
        </div>

        {/* 3. Seção de Modelos de Investigação */}
        {(activeTab === "all" || activeTab === "models") && !searchQuery && (
          <FeaturedNotebooks />
        )}

        {/* 4. Seção Principal de Cadernos do Acervo */}
        {(activeTab === "all") && (
          <section className="space-y-3">
            <div className="flex items-center justify-between border-b border-[#242628] pb-2">
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-mono font-semibold uppercase tracking-wider text-[#85888C]">
                  Cadernos em Custódia
                </h2>
                <span className="text-[10px] font-mono text-[#55585D]">
                  [{filteredNotebooks.length} Registros]
                </span>
              </div>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center p-12 text-[#85888C] gap-2 text-xs font-mono">
                <Loader2 className="h-4 w-4 animate-spin text-[#85888C]" />
                <span>Consultando acervo...</span>
              </div>
            ) : (
              <div
                className={`grid gap-3 ${
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
