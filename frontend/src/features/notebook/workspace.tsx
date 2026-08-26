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

const isValidUUID = (id?: string | null) =>
  !!id &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

export function NotebookWorkspace() {
  const params = useParams();
  const rawId = params?.id as string | undefined;
  const isUUID = isValidUUID(rawId);
  const notebookId = isUUID ? rawId : undefined;

  const { setActiveNotebookId, setNotebookTitle } = useChatStore();

  useEffect(() => {
    if (notebookId) {
      setActiveNotebookId(notebookId);
    } else {
      setActiveNotebookId(null);
    }
  }, [notebookId, setActiveNotebookId]);

  const { data: notebookDetail } = useQuery<NotebookDetailResponse>({
    queryKey: ["notebook", notebookId],
    queryFn: async () => {
      if (!notebookId) throw new Error("No ID");
      const res = await apiClient.get(`/notebooks/${notebookId}`);
      return res.data;
    },
    enabled: isUUID,
  });

  useEffect(() => {
    if (notebookDetail?.title) {
      setNotebookTitle(notebookDetail.title);
    }
  }, [notebookDetail?.title, setNotebookTitle]);

  return (
    <div className="h-screen w-screen flex flex-col bg-[#0C0D0E] overflow-hidden">
      {/* 1. Header Minimalista */}
      <NotebookHeader />

      {/* 2. Layout de 3 Colunas de Bancada */}
      <div className="flex-1 flex overflow-hidden">
        {/* Coluna Esquerda: Fontes em Custódia */}
        <SourcesPanel />

        {/* Coluna Central: Dossiê / Consulta RAG */}
        <ChatPanel />

        {/* Coluna Direita: Inspetor de Evidências */}
        <StudioPanel />
      </div>

      {/* 3. Modal de Ingestão de Fontes */}
      <AddSourceModal />
    </div>
  );
}
