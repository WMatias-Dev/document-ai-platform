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
  
  // Isolamento por Caderno: Record<notebookId, mensagens[]>
  messagesByNotebook: Record<string, DisplayMessage[]>;
  threadsByNotebook: Record<string, string | null>;

  selectedDocumentId: string | null;
  selectedSourceIds: string[];
  selectedCitation: DocumentCitation | null;
  selectedSearchChunk: SearchResultChunk | null;
  activeStudioTab: StudioTab;
  isAddSourceModalOpen: boolean;
  isChatLoading: boolean;
  isStreaming: boolean;
  isCitationSheetOpen: boolean;

  // Setters de Caderno e Thread
  setActiveNotebookId: (id: string | null) => void;
  setNotebookTitle: (title: string) => void;
  setActiveThreadId: (id: string | null) => void;
  setActiveThreadIdForNotebook: (notebookId: string | null, threadId: string | null) => void;
  getActiveThreadId: (notebookId?: string | null) => string | null;

  // Indicadores de Estado
  setIsChatLoading: (loading: boolean) => void;
  setIsStreaming: (streaming: boolean) => void;

  // Seletores e Mutações de Mensagens Isoladas por Caderno
  getMessages: (notebookId?: string | null) => DisplayMessage[];
  setMessagesForNotebook: (notebookId: string | null, messages: DisplayMessage[]) => void;
  addMessageToNotebook: (notebookId: string | null, msg: Omit<DisplayMessage, "id" | "createdAt">) => string;
  updateLastMessageForNotebook: (notebookId: string | null, content: string, citations?: DocumentCitation[], model?: string) => void;
  clearMessagesForNotebook: (notebookId: string | null) => void;

  // Métodos de conveniência que operam no activeNotebookId
  setMessages: (messages: DisplayMessage[]) => void;
  addMessage: (msg: Omit<DisplayMessage, "id" | "createdAt">) => string;
  updateLastMessageContent: (content: string, citations?: DocumentCitation[], model?: string) => void;
  clearMessages: () => void;

  // Seleção de Fontes e Documentos
  setSelectedDocumentId: (id: string | null) => void;
  toggleSourceSelection: (id: string) => void;
  selectAllSources: (ids: string[]) => void;
  clearSourceSelections: () => void;

  // Studio e Citações
  setActiveStudioTab: (tab: StudioTab) => void;
  openCitation: (citation: DocumentCitation) => void;
  closeCitation: () => void;
  openCitationInStudio: (citation: DocumentCitation) => void;
  openSearchResultInStudio: (chunk: SearchResultChunk) => void;
  setAddSourceModalOpen: (open: boolean) => void;
}

const getNotebookKey = (id?: string | null) => id || "global";

export const useChatStore = create<ChatState>((set, get) => ({
  activeNotebookId: null,
  notebookTitle: "Caderno Sem Título",
  messagesByNotebook: {},
  threadsByNotebook: {},

  selectedDocumentId: null,
  selectedSourceIds: [],
  selectedCitation: null,
  selectedSearchChunk: null,
  activeStudioTab: "overview",
  isAddSourceModalOpen: false,
  isChatLoading: false,
  isStreaming: false,
  isCitationSheetOpen: false,

  setActiveNotebookId: (id) => set({ activeNotebookId: id }),
  setNotebookTitle: (title) => set({ notebookTitle: title }),

  setActiveThreadId: (id) => {
    const key = getNotebookKey(get().activeNotebookId);
    set((state) => ({
      threadsByNotebook: {
        ...state.threadsByNotebook,
        [key]: id,
      },
    }));
  },

  setActiveThreadIdForNotebook: (notebookId, threadId) => {
    const key = getNotebookKey(notebookId);
    set((state) => ({
      threadsByNotebook: {
        ...state.threadsByNotebook,
        [key]: threadId,
      },
    }));
  },

  getActiveThreadId: (notebookId) => {
    const key = getNotebookKey(notebookId !== undefined ? notebookId : get().activeNotebookId);
    return get().threadsByNotebook[key] || null;
  },

  setIsChatLoading: (loading) => set({ isChatLoading: loading }),
  setIsStreaming: (streaming) => set({ isStreaming: streaming }),

  // Seletor de Mensagens
  getMessages: (notebookId) => {
    const key = getNotebookKey(notebookId !== undefined ? notebookId : get().activeNotebookId);
    return get().messagesByNotebook[key] || [];
  },

  // Mutações Isoladas
  setMessagesForNotebook: (notebookId, messages) => {
    const key = getNotebookKey(notebookId);
    set((state) => ({
      messagesByNotebook: {
        ...state.messagesByNotebook,
        [key]: messages,
      },
    }));
  },

  addMessageToNotebook: (notebookId, msg) => {
    const key = getNotebookKey(notebookId);
    const newId = "msg-" + Math.random().toString(36).substring(2, 9);
    const newMessage: DisplayMessage = {
      ...msg,
      id: newId,
      createdAt: new Date(),
    };

    set((state) => {
      const currentList = state.messagesByNotebook[key] || [];
      return {
        messagesByNotebook: {
          ...state.messagesByNotebook,
          [key]: [...currentList, newMessage],
        },
      };
    });

    return newId;
  },

  updateLastMessageForNotebook: (notebookId, content, citations, model) => {
    const key = getNotebookKey(notebookId);
    set((state) => {
      const currentList = state.messagesByNotebook[key] || [];
      if (currentList.length === 0) return state;

      const updated = [...currentList];
      const lastIndex = updated.length - 1;
      updated[lastIndex] = {
        ...updated[lastIndex],
        content,
        citations: citations !== undefined ? citations : updated[lastIndex].citations,
        model: model !== undefined ? model : updated[lastIndex].model,
      };

      return {
        messagesByNotebook: {
          ...state.messagesByNotebook,
          [key]: updated,
        },
      };
    });
  },

  clearMessagesForNotebook: (notebookId) => {
    const key = getNotebookKey(notebookId);
    set((state) => ({
      messagesByNotebook: {
        ...state.messagesByNotebook,
        [key]: [],
      },
      selectedCitation: null,
      selectedSearchChunk: null,
    }));
  },

  // Atalhos para o Caderno Ativo
  setMessages: (messages) => {
    const key = getNotebookKey(get().activeNotebookId);
    get().setMessagesForNotebook(key, messages);
  },

  addMessage: (msg) => {
    const key = getNotebookKey(get().activeNotebookId);
    return get().addMessageToNotebook(key, msg);
  },

  updateLastMessageContent: (content, citations, model) => {
    const key = getNotebookKey(get().activeNotebookId);
    get().updateLastMessageForNotebook(key, content, citations, model);
  },

  clearMessages: () => {
    const key = getNotebookKey(get().activeNotebookId);
    get().clearMessagesForNotebook(key);
  },

  // Seleções
  setSelectedDocumentId: (id) => set({ selectedDocumentId: id }),

  toggleSourceSelection: (id) =>
    set((state) => ({
      selectedSourceIds: state.selectedSourceIds.includes(id)
        ? state.selectedSourceIds.filter((sid) => sid !== id)
        : [...state.selectedSourceIds, id],
    })),

  selectAllSources: (ids) => set({ selectedSourceIds: ids }),

  clearSourceSelections: () => set({ selectedSourceIds: [] }),

  // Visualizador e Studio
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
