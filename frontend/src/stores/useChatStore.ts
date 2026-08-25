import { create } from "zustand";
import { ChatMessage, DocumentCitation, SearchResultChunk } from "@/types/api";

export interface DisplayMessage extends ChatMessage {
  id: string;
  citations?: DocumentCitation[];
  model?: string;
  createdAt: Date;
}

export type StudioTab = "overview" | "citation" | "search";

interface ChatState {
  notebookTitle: string;
  messages: DisplayMessage[];
  selectedDocumentId: string | null;
  selectedSourceIds: string[];
  selectedCitation: DocumentCitation | null;
  selectedSearchChunk: SearchResultChunk | null;
  activeStudioTab: StudioTab;
  isAddSourceModalOpen: boolean;

  setNotebookTitle: (title: string) => void;
  addMessage: (msg: Omit<DisplayMessage, "id" | "createdAt">) => void;
  clearMessages: () => void;
  setSelectedDocumentId: (id: string | null) => void;
  toggleSourceSelection: (id: string) => void;
  selectAllSources: (ids: string[]) => void;
  clearSourceSelections: () => void;
  isCitationSheetOpen: boolean;
  setActiveStudioTab: (tab: StudioTab) => void;
  openCitation: (citation: DocumentCitation) => void;
  closeCitation: () => void;
  openCitationInStudio: (citation: DocumentCitation) => void;
  openSearchResultInStudio: (chunk: SearchResultChunk) => void;
  setAddSourceModalOpen: (open: boolean) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  notebookTitle: "Caderno Sem Título",
  messages: [],
  selectedDocumentId: null,
  selectedSourceIds: [],
  selectedCitation: null,
  selectedSearchChunk: null,
  activeStudioTab: "overview",
  isAddSourceModalOpen: false,

  setNotebookTitle: (title) => set({ notebookTitle: title }),

  addMessage: (msg) =>
    set((state) => ({
      messages: [
        ...state.messages,
        {
          ...msg,
          id: Math.random().toString(36).substring(2, 9),
          createdAt: new Date(),
        },
      ],
    })),

  clearMessages: () => set({ messages: [] }),

  setSelectedDocumentId: (id) =>
    set({
      selectedDocumentId: id,
      selectedSourceIds: id ? [id] : [],
    }),

  toggleSourceSelection: (id) =>
    set((state) => {
      const exists = state.selectedSourceIds.includes(id);
      const next = exists
        ? state.selectedSourceIds.filter((item) => item !== id)
        : [...state.selectedSourceIds, id];
      return {
        selectedSourceIds: next,
        selectedDocumentId: next.length === 1 ? next[0] : null,
      };
    }),

  selectAllSources: (ids) =>
    set({ selectedSourceIds: ids, selectedDocumentId: null }),

  clearSourceSelections: () =>
    set({ selectedSourceIds: [], selectedDocumentId: null }),

  isCitationSheetOpen: false,
  setActiveStudioTab: (tab) => set({ activeStudioTab: tab }),
  openCitation: (citation) =>
    set({
      selectedCitation: citation,
      activeStudioTab: "citation",
      isCitationSheetOpen: true,
    }),
  closeCitation: () =>
    set({ selectedCitation: null, isCitationSheetOpen: false }),

  openCitationInStudio: (citation) =>
    set({
      selectedCitation: citation,
      activeStudioTab: "citation",
    }),

  openSearchResultInStudio: (chunk) =>
    set({
      selectedSearchChunk: chunk,
      activeStudioTab: "search",
    }),

  setAddSourceModalOpen: (open) => set({ isAddSourceModalOpen: open }),
}));
