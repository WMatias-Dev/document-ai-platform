"use client";

import { useChatStore } from "@/stores/useChatStore";
import { X, FileText, Sparkles, ExternalLink } from "lucide-react";

export function CitationSheet() {
  const { selectedCitation, isCitationSheetOpen, closeCitation } = useChatStore();

  if (!isCitationSheetOpen || !selectedCitation) return null;

  const similarityPercent = (selectedCitation.similarity_score * 100).toFixed(1);

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-sm transition-opacity">
      <div className="fixed inset-y-0 right-0 flex max-w-full pl-10">
        <div className="w-screen max-w-md border-l border-slate-800 bg-[#090d16] p-6 shadow-2xl flex flex-col justify-between">
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">
                    Trecho de Referência (Chunk)
                  </h3>
                  <p className="text-xs text-slate-400">
                    Fonte utilizada pelo Gemini 3.7 Flash
                  </p>
                </div>
              </div>

              <button
                onClick={closeCitation}
                className="rounded-lg p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Metadata Card */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Documento</span>
                <span className="text-xs font-semibold text-white truncate max-w-[200px]">
                  {selectedCitation.document_title}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Índice do Chunk</span>
                <span className="text-xs font-mono text-slate-300">
                  #{selectedCitation.chunk_index}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Score de Similaridade</span>
                <span className="rounded-md bg-blue-500/10 px-2 py-0.5 text-xs font-bold text-blue-400 border border-blue-500/20">
                  {similarityPercent}% Relevância
                </span>
              </div>
            </div>

            {/* Snippet Content */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Texto Integral do Fragmento
              </label>
              <div className="max-h-[50vh] overflow-y-auto rounded-xl border border-slate-800 bg-slate-950 p-4 text-xs font-mono text-slate-300 leading-relaxed whitespace-pre-wrap selection:bg-blue-500/30">
                {selectedCitation.text_snippet}
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800">
            <button
              onClick={closeCitation}
              className="w-full rounded-xl bg-slate-800 hover:bg-slate-700 py-2.5 text-xs font-semibold text-white transition-colors cursor-pointer"
            >
              Fechar Painel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
