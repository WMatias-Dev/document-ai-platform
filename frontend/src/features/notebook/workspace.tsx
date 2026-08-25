"use client";

import { NotebookHeader } from "@/components/shared/notebook-header";
import { SourcesPanel } from "./sources-panel";
import { ChatPanel } from "./chat-panel";
import { StudioPanel } from "./studio-panel";
import { AddSourceModal } from "./add-source-modal";

export function NotebookWorkspace() {
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
