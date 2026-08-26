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
  activeThreadId: string | null;
  messages: DisplayMessage[];
  selectedDocumentId: string | null;
  selectedSourceIds: string[];
  selectedCitation: DocumentCitation | null;
  selectedSearchChunk: SearchResultChunk | null;
  activeStudioTab: StudioTab;
  isAddSourceModalOpen: boolean;
  isChatLoading: boolean;
  isStreaming: boolean;

  setActiveNotebookId: (id: string | null) => void;
  setNotebookTitle: (title: string) => void;
  setActiveThreadId: (id: string | null) => void;
  setIsChatLoading: (loading: boolean) => void;
  setIsStreaming: (streaming: boolean) => void;
  setMessages: (messages: DisplayMessage[]) => void;
  addMessage: (msg: Omit<DisplayMessage, "id" | "createdAt">) => string;
  updateLastMessageContent: (content: string, citations?: DocumentCitation[], model?: string) => void;
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
  activeThreadId: null,
  messages: [],
  selectedDocumentId: null,
  selectedSourceIds: [],
  selectedCitation: null,
  selectedSearchChunk: null,
  activeStudioTab: "overview",
  isAddSourceModalOpen: false,
  isChatLoading: false,
  isStreaming: false,

  setActiveNotebookId: (id) => set({ activeNotebookId: id }),
  setNotebookTitle: (title) => set({ notebookTitle: title }),
  setActiveThreadId: (id) => set({ activeThreadId: id }),
  setIsChatLoading: (loading) => set({ isChatLoading: loading }),
  setIsStreaming: (streaming) => set({ isStreaming: streaming }),

  setMessages: (messages) => set({ messages }),

  addMessage: (msg) => {
    const newId = "msg-" + Math.random().toString(36).substring(2, 9);
    set((state) => ({
      messages: [
        ...state.messages,
        {
          ...msg,
          id: newId,
          createdAt: new Date(),
        },
      ],
    }));
    return newId;
  },

  updateLastMessageContent: (content, citations, model) =>
    set((state) => {
      if (state.messages.length === 0) return state;
      const updated = [...state.messages];
      const lastIndex = updated.length - 1;
      updated[lastIndex] = {
        ...updated[lastIndex],
        content,
        citations: citations !== undefined ? citations : updated[lastIndex].citations,
        model: model !== undefined ? model : updated[lastIndex].model,
      };
      return { messages: updated };
    }),

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
