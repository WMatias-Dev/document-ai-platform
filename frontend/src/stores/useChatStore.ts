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
  activeNotebookId: string | null;
  notebookTitle: string;
  messages: DisplayMessage[];
  selectedDocumentId: string | null;
  selectedSourceIds: string[];
  selectedCitation: DocumentCitation | null;
  selectedSearchChunk: SearchResultChunk | null;
  activeStudioTab: StudioTab;
  isAddSourceModalOpen: boolean;
  isChatLoading: boolean;

  setActiveNotebookId: (id: string | null) => void;
  setNotebookTitle: (title: string) => void;
  setIsChatLoading: (loading: boolean) => void;
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
  activeNotebookId: null,
  notebookTitle: "Caderno Sem Título",
  messages: [],
  selectedDocumentId: null,
  selectedSourceIds: [],
  selectedCitation: null,
  selectedSearchChunk: null,
  activeStudioTab: "overview",
  isAddSourceModalOpen: false,
  isChatLoading: false,

  setActiveNotebookId: (id) => set({ activeNotebookId: id }),
  setNotebookTitle: (title) => set({ notebookTitle: title }),
  setIsChatLoading: (loading) => set({ isChatLoading: loading }),

  addMessage: (msg) =>
    set((state) => ({
      messages: [
        ...state.messages,
        {
          ...msg,
          id: "msg-" + Math.random().toString(36).substring(2, 9),
          createdAt: new Date(),
        },
      ],
    })),

  clearMessages: () =>
    set({
      messages: [],
      selectedCitation: null,
      selectedSearchChunk: null,
    }),

  setSelectedDocumentId: (id) => set({ selectedDocumentId: id }),

  toggleSourceSelection: (id) =>
    set((state) => ({
      selectedSourceIds: state.selectedSourceIds.includes(id)
        ? state.selectedSourceIds.filter((sid) => sid !== id)
        : [...state.selectedSourceIds, id],
    })),

  selectAllSources: (ids) => set({ selectedSourceIds: ids }),

  clearSourceSelections: () => set({ selectedSourceIds: [] }),

  isCitationSheetOpen: false,

  setActiveStudioTab: (tab) => set({ activeStudioTab: tab }),

  openCitation: (citation) =>
    set({
      selectedCitation: citation,
      isCitationSheetOpen: true,
    }),

  closeCitation: () =>
    set({
      isCitationSheetOpen: false,
      selectedCitation: null,
    }),

  openCitationInStudio: (citation) =>
    set({
      selectedCitation: citation,
      activeStudioTab: "citation",
    }),

  openSearchResultInStudio: (chunk) => {
    const asCitation: DocumentCitation = {
      chunk_id: chunk.chunk_id,
      document_id: chunk.document_id,
      document_title: chunk.document_title,
      chunk_index: chunk.chunk_index,
      text_snippet: chunk.text_content,
      similarity_score: chunk.similarity_score,
    };
    set({
      selectedCitation: asCitation,
      selectedSearchChunk: chunk,
      activeStudioTab: "citation",
    });
  },

  setAddSourceModalOpen: (open) => set({ isAddSourceModalOpen: open }),
}));
