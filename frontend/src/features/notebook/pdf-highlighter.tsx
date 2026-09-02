"use client";

import { useState, useEffect } from "react";
import {
  FileText,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  Sparkles,
} from "lucide-react";

interface PDFHighlighterProps {
  documentId: string;
  documentTitle: string;
  pageNumber?: number;
  boundingBox?: [number, number, number, number] | null;
  snippetText?: string;
}

export function PDFHighlighter({
  documentId,
  documentTitle,
  pageNumber = 1,
  boundingBox,
  snippetText,
}: PDFHighlighterProps) {
  const [currentPage, setCurrentPage] = useState(pageNumber);
  const [zoom, setZoom] = useState(100);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [viewMode, setViewMode] = useState<"highlight" | "raw">("highlight");

  useEffect(() => {
    if (pageNumber) {
      setCurrentPage(pageNumber);
    }
  }, [pageNumber]);

  // URL do binário do PDF no FastAPI
  const pdfUrl = `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/documents/${documentId}/file#page=${currentPage}`;

  // Coordenadas normalizadas [x0, y0, x1, y1] (0.0 a 1.0)
  const hasBBox = Array.isArray(boundingBox) && boundingBox.length === 4;
  const [x0, y0, x1, y1] = hasBBox ? boundingBox : [0.1, 0.2, 0.9, 0.4];

  const boxStyle = {
    top: `${Math.max(0, Math.min(100, y0 * 100))}%`,
    left: `${Math.max(0, Math.min(100, x0 * 100))}%`,
    width: `${Math.max(5, Math.min(100, (x1 - x0) * 100))}%`,
    height: `${Math.max(3, Math.min(100, (y1 - y0) * 100))}%`,
  };

  return (
    <div
      className={`rounded-2xl border border-slate-200/90 bg-white overflow-hidden flex flex-col transition-all duration-200 shadow-xs ${
        isFullscreen
          ? "fixed inset-4 z-50 bg-white/95 backdrop-blur-md shadow-2xl border-slate-300"
          : "w-full h-[420px]"
      }`}
    >
      {/* Top Toolbar */}
      <div className="p-2.5 border-b border-slate-200/80 bg-slate-50/70 flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-1.5 min-w-0">
          <FileText className="h-4 w-4 text-emerald-600 shrink-0" />
          <span className="font-medium text-slate-800 truncate text-xs">
            {documentTitle}
          </span>
        </div>

        {/* Controles de Navegação */}
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="flex items-center rounded-lg border border-slate-200 bg-white px-1.5 py-0.5 text-xs text-slate-700 shadow-2xs">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="p-0.5 hover:text-emerald-700 disabled:opacity-30 cursor-pointer"
              title="Página Anterior"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="px-1 text-[11px] font-mono text-slate-500">Pág. {currentPage}</span>
            <button
              onClick={() => setCurrentPage((p) => p + 1)}
              className="p-0.5 hover:text-emerald-700 cursor-pointer"
              title="Próxima Página"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-0.5">
            <button
              onClick={() => setZoom((z) => Math.max(50, z - 15))}
              className="p-1 rounded-md hover:bg-slate-200/60 text-slate-500 hover:text-slate-900 cursor-pointer"
              title="Reduzir Zoom"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setZoom((z) => Math.min(150, z + 15))}
              className="p-1 rounded-md hover:bg-slate-200/60 text-slate-500 hover:text-slate-900 cursor-pointer"
              title="Aumentar Zoom"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setIsFullscreen((f) => !f)}
              className="p-1 rounded-md hover:bg-slate-200/60 text-slate-500 hover:text-slate-900 cursor-pointer"
              title={isFullscreen ? "Restaurar" : "Tela Cheia"}
            >
              {isFullscreen ? (
                <Minimize2 className="h-3.5 w-3.5" />
              ) : (
                <Maximize2 className="h-3.5 w-3.5" />
              )}
            </button>
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1 rounded-md hover:bg-slate-200/60 text-slate-500 hover:text-slate-900"
              title="Abrir em Nova Aba"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </div>

      {/* Selector de Modo */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-100 bg-white text-xs">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setViewMode("highlight")}
            className={`px-2.5 py-0.5 rounded-lg transition-colors cursor-pointer text-xs ${
              viewMode === "highlight"
                ? "bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <span className="inline-flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-emerald-600" />
              Evidência Marcada
            </span>
          </button>
          <button
            onClick={() => setViewMode("raw")}
            className={`px-2.5 py-0.5 rounded-lg transition-colors cursor-pointer text-xs ${
              viewMode === "raw"
                ? "bg-slate-100 text-slate-800 font-medium"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            PDF Completo
          </button>
        </div>

        {hasBBox && (
          <span className="text-slate-400 text-[11px] font-sans">
            Coordenadas rastreadas
          </span>
        )}
      </div>

      {/* Canvas / PDF Viewport com Bounding Box Overlay */}
      <div className="flex-1 relative bg-slate-100/60 overflow-auto flex items-center justify-center p-2">
        <div
          style={{ transform: `scale(${zoom / 100})`, transformOrigin: "top center" }}
          className="relative w-full h-full min-h-[300px] flex items-center justify-center transition-transform duration-100"
        >
          {/* Iframe PDF Viewer nativo */}
          <iframe
            src={`${pdfUrl}&toolbar=0&navpanes=0`}
            className="w-full h-full rounded-xl border border-slate-200 bg-white"
            title={documentTitle}
          />

          {/* Bounding Box Highlight Overlay */}
          {viewMode === "highlight" && hasBBox && (
            <div
              style={boxStyle}
              className="absolute pointer-events-none rounded-lg border-2 border-emerald-500 bg-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.35)] animate-pulse z-10"
            >
              <div className="absolute -top-4.5 left-0 bg-emerald-600 text-white text-[9px] font-mono px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider shadow-xs">
                Evidência #p.{currentPage}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Snippet Footer */}
      {snippetText && (
        <div className="p-2.5 border-t border-slate-100 bg-emerald-50/40 text-xs font-serif text-emerald-950 italic line-clamp-2">
          "{snippetText}"
        </div>
      )}
    </div>
  );
}
