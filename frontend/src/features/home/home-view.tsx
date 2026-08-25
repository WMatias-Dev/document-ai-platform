"use client";

import { useState, useEffect } from "react";
import { useNotebookStore } from "@/stores/useNotebookStore";
import { HomeHeader } from "./home-header";
import { FeaturedNotebooks } from "./featured-notebooks";
import { NotebookCard, CreateNotebookCard } from "./notebook-card";
import { CreateNotebookModal } from "./create-notebook-modal";
import {
  Plus,
  Search,
  LayoutGrid,
  List,
  SlidersHorizontal,
  FolderPlus,
  Layers,
} from "lucide-react";

type FilterTab = "all" | "my" | "featured" | "collections";
type SortOption = "recent" | "alpha";

export function HomeView() {
  const { notebooks, initStore } = useNotebookStore();

  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [sortOption, setSortOption] = useState<SortOption>("recent");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  useEffect(() => {
    initStore();
  }, [initStore]);

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
      return 0; // Ordem cronológica padrão
    });

  return (
    <div className="min-h-screen bg-[#131314] text-zinc-100 flex flex-col selection:bg-[#a8c7fa]/30">
      {/* 1. Header Superior */}
      <HomeHeader />

      {/* 2. Conteúdo Principal */}
      <main className="flex-1 mx-auto w-full max-w-7xl px-6 sm:px-10 py-8 space-y-10">
        {/* Barra de Filtros e Controles (Sub-header) */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-white/5">
          {/* Navigation Pills */}
          <div className="flex items-center gap-1.5 p-1 rounded-full bg-[#1e1f20] border border-white/5 text-xs">
            <button
              onClick={() => setActiveTab("all")}
              className={`rounded-full px-4 py-1.5 font-medium transition-all cursor-pointer ${
                activeTab === "all"
                  ? "bg-white/10 text-white shadow-sm font-semibold"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Todos
            </button>

            <button
              onClick={() => setActiveTab("my")}
              className={`rounded-full px-4 py-1.5 font-medium transition-all cursor-pointer ${
                activeTab === "my"
                  ? "bg-white/10 text-white shadow-sm font-semibold"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Meus notebooks
            </button>

            <button
              onClick={() => setActiveTab("featured")}
              className={`rounded-full px-4 py-1.5 font-medium transition-all cursor-pointer ${
                activeTab === "featured"
                  ? "bg-white/10 text-white shadow-sm font-semibold"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Destaques / Modelos
            </button>

            <button
              onClick={() => setActiveTab("collections")}
              className={`rounded-full px-4 py-1.5 font-medium transition-all cursor-pointer ${
                activeTab === "collections"
                  ? "bg-white/10 text-white shadow-sm font-semibold"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Coleções
            </button>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-3">
            {/* Expandable Search Input */}
            <div className="relative flex items-center">
              {isSearchOpen ? (
                <div className="flex items-center gap-1 rounded-full bg-[#1e1f20] border border-white/10 px-3 py-1.5 animate-in fade-in duration-200">
                  <Search className="h-3.5 w-3.5 text-zinc-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Pesquisar notebooks..."
                    autoFocus
                    onBlur={() => !searchQuery && setIsSearchOpen(false)}
                    className="bg-transparent text-xs text-white placeholder-zinc-500 focus:outline-none w-36 sm:w-48"
                  />
                </div>
              ) : (
                <button
                  onClick={() => setIsSearchOpen(true)}
                  className="rounded-full p-2 text-zinc-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                  title="Pesquisar notebooks"
                >
                  <Search className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Sort Selector */}
            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as SortOption)}
              className="rounded-full bg-[#1e1f20] border border-white/5 px-3 py-1.5 text-xs text-zinc-300 focus:outline-none cursor-pointer"
            >
              <option value="recent" className="bg-[#1e1f20] text-white">
                Mais recentes ▾
              </option>
              <option value="alpha" className="bg-[#1e1f20] text-white">
                Nome (A-Z) ▾
              </option>
            </select>

            {/* View Mode Toggle */}
            <div className="hidden sm:flex items-center rounded-full bg-[#1e1f20] border border-white/5 p-0.5 text-zinc-400">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-1.5 rounded-full transition-colors ${
                  viewMode === "grid" ? "bg-white/10 text-white" : "hover:text-white"
                }`}
                title="Visualização em Grade"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`p-1.5 rounded-full transition-colors ${
                  viewMode === "list" ? "bg-white/10 text-white" : "hover:text-white"
                }`}
                title="Visualização em Lista"
              >
                <List className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Primary Action Button: + Criar novo */}
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-full bg-[#a8c7fa] hover:bg-[#c2e7ff] text-[#041e49] font-semibold px-5 py-2 text-xs transition-all shadow-lg shadow-blue-500/10 hover:scale-105 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Criar novo</span>
            </button>
          </div>
        </div>

        {/* 3. Seção 1: Notebooks em Destaque */}
        {(activeTab === "all" || activeTab === "featured") && !searchQuery && (
          <FeaturedNotebooks />
        )}

        {/* 4. Seção 2: Meus Projetos / Recentes */}
        {(activeTab === "all" || activeTab === "my") && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-white tracking-tight">
                  Notebooks recentes
                </h2>
                <span className="text-xs text-zinc-400 font-mono">
                  ({filteredNotebooks.length})
                </span>
              </div>
            </div>

            {/* Grid of Projects */}
            <div
              className={`grid gap-4 ${
                viewMode === "grid"
                  ? "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
                  : "grid-cols-1"
              }`}
            >
              {/* Card Fixo de Criar Novo */}
              {!searchQuery && (
                <CreateNotebookCard
                  onClick={() => setIsCreateModalOpen(true)}
                />
              )}

              {/* Cards dos Cadernos do Usuário */}
              {filteredNotebooks.map((nb) => (
                <NotebookCard key={nb.id} notebook={nb} />
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Modal de Criação de Notebook */}
      <CreateNotebookModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />
    </div>
  );
}
