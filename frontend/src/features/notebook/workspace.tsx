"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { NotebookDetailResponse } from "@/types/api";
import { useChatStore } from "@/stores/useChatStore";
import { NotebookHeader } from "@/components/shared/notebook-header";
import { SourcesPanel } from "./sources-panel";
import { ChatPanel } from "./chat-panel";
import { StudioPanel } from "./studio-panel";
import { AddSourceModal } from "./add-source-modal";

export function NotebookWorkspace() {
  const params = useParams();
  const notebookId = params?.id as string | undefined;

  const { setActiveNotebookId, setNotebookTitle } = useChatStore();

  useEffect(() => {
    if (notebookId && notebookId !== "default") {
      setActiveNotebookId(notebookId);
    } else {
      setActiveNotebookId(null);
    }
  }, [notebookId, setActiveNotebookId]);

  const { data: notebookDetail } = useQuery<NotebookDetailResponse>({
    queryKey: ["notebook", notebookId],
    queryFn: async () => {
      if (!notebookId || notebookId === "default") throw new Error("No ID");
      const res = await apiClient.get(`/notebooks/${notebookId}`);
      return res.data;
    },
    enabled: !!notebookId && notebookId !== "default",
  });

  useEffect(() => {
    if (notebookDetail?.title) {
      setNotebookTitle(notebookDetail.title);
    }
  }, [notebookDetail?.title, setNotebookTitle]);

  return (
    <div className="h-screen w-screen flex flex-col bg-[#131314] overflow-hidden">
      {/* 1. Header Minimalista */}
      <NotebookHeader />

      {/* 2. Layout de 3 Colunas Fluídas Estilo NotebookLM */}
      <div className="flex-1 flex overflow-hidden">
        {/* Coluna Esquerda: Fontes & Upload */}
        <SourcesPanel />

        {/* Coluna Central: Conversa / Chat RAG */}
        <ChatPanel />

        {/* Coluna Direita: Estúdio / Citações / Busca HNSW */}
        <StudioPanel />
      </div>

      {/* 3. Modal de Adicionar Fontes */}
      <AddSourceModal />
    </div>
  );
}
