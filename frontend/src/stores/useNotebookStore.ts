import { create } from "zustand";

export interface Notebook {
  id: string;
  title: string;
  description?: string;
  emoji?: string;
  color?: string;
  createdAt: string;
  updatedAt: string;
  sourceCount: number;
  documentIds?: string[];
  isFeatured?: boolean;
  category?: string;
  coverGradient?: string;
}

export const FEATURED_TEMPLATES: Notebook[] = [
  {
    id: "feat-1",
    title: "Guia de Inteligência Artificial & LLMs 2026",
    category: "DeepMind & AI Research",
    createdAt: "21 de abr. de 2026",
    updatedAt: "21 de abr. de 2026",
    sourceCount: 152,
    coverGradient: "from-blue-600/40 via-indigo-900/60 to-[#1e1f20]",
    isFeatured: true,
  },
  {
    id: "feat-2",
    title: "Análise Regulatória e LGPD para Empresas",
    category: "Jurídico & Compliance",
    createdAt: "18 de mai. de 2026",
    updatedAt: "18 de mai. de 2026",
    sourceCount: 84,
    coverGradient: "from-purple-600/40 via-purple-950/60 to-[#1e1f20]",
    isFeatured: true,
  },
  {
    id: "feat-3",
    title: "Engenharia de Software e Clean Architecture",
    category: "Dev & Arquitetura",
    createdAt: "05 de jun. de 2026",
    updatedAt: "05 de jun. de 2026",
    sourceCount: 67,
    coverGradient: "from-emerald-600/40 via-teal-950/60 to-[#1e1f20]",
    isFeatured: true,
  },
  {
    id: "feat-4",
    title: "Estratégia de Produto e Métricas de Crescimento",
    category: "Gestão & Negócios",
    createdAt: "12 de jul. de 2026",
    updatedAt: "12 de jul. de 2026",
    sourceCount: 110,
    coverGradient: "from-amber-600/40 via-orange-950/60 to-[#1e1f20]",
    isFeatured: true,
  },
];

interface NotebookStore {
  notebooks: Notebook[];
  activeNotebookId: string | null;
  createNotebook: (title: string, emoji?: string) => string;
  updateNotebook: (id: string, updates: Partial<Notebook>) => void;
  deleteNotebook: (id: string) => void;
  duplicateNotebook: (id: string) => string;
  setActiveNotebookId: (id: string | null) => void;
  initStore: () => void;
}

export const useNotebookStore = create<NotebookStore>((set, get) => ({
  notebooks: [],
  activeNotebookId: null,

  initStore: () => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("doc_ai_notebooks");
      if (saved) {
        try {
          set({ notebooks: JSON.parse(saved) });
        } catch {
          set({ notebooks: [] });
        }
      }
    }
  },

  createNotebook: (title: string, emoji: string = "📓") => {
    const id = "nb-" + Math.random().toString(36).substring(2, 9);
    const newNotebook: Notebook = {
      id,
      title: title.trim() || "Novo Caderno",
      emoji,
      createdAt: "Hoje",
      updatedAt: "Agora mesmo",
      sourceCount: 0,
      documentIds: [],
    };

    const next = [newNotebook, ...get().notebooks];
    set({ notebooks: next, activeNotebookId: id });
    if (typeof window !== "undefined") {
      localStorage.setItem("doc_ai_notebooks", JSON.stringify(next));
    }
    return id;
  },

  updateNotebook: (id: string, updates: Partial<Notebook>) => {
    const next = get().notebooks.map((nb) =>
      nb.id === id ? { ...nb, ...updates, updatedAt: "Agora mesmo" } : nb
    );
    set({ notebooks: next });
    if (typeof window !== "undefined") {
      localStorage.setItem("doc_ai_notebooks", JSON.stringify(next));
    }
  },

  deleteNotebook: (id: string) => {
    const next = get().notebooks.filter((nb) => nb.id !== id);
    set({ notebooks: next });
    if (typeof window !== "undefined") {
      localStorage.setItem("doc_ai_notebooks", JSON.stringify(next));
    }
  },

  duplicateNotebook: (id: string) => {
    const target = get().notebooks.find((nb) => nb.id === id);
    if (!target) return "";

    const newId = "nb-" + Math.random().toString(36).substring(2, 9);
    const duplicated: Notebook = {
      ...target,
      id: newId,
      title: `${target.title} (Cópia)`,
      createdAt: "Hoje",
      updatedAt: "Agora mesmo",
    };

    const next = [duplicated, ...get().notebooks];
    set({ notebooks: next });
    if (typeof window !== "undefined") {
      localStorage.setItem("doc_ai_notebooks", JSON.stringify(next));
    }
    return newId;
  },

  setActiveNotebookId: (id: string | null) => set({ activeNotebookId: id }),
}));
