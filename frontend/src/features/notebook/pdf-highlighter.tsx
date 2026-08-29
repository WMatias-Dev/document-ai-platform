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
      className={`rounded-lg border border-[#242628] bg-[#161719] overflow-hidden flex flex-col transition-all duration-200 ${
        isFullscreen
          ? "fixed inset-4 z-50 bg-[#0C0D0E]/95 backdrop-blur-md shadow-2xl border-[#383B40]"
          : "w-full h-[420px]"
      }`}
    >
      {/* Top Toolbar */}
      <div className="p-2 border-b border-[#242628] bg-[#1C1D20] flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-1.5 min-w-0">
          <FileText className="h-3.5 w-3.5 text-[#D97706] shrink-0" />
          <span className="font-sans font-medium text-[#E3E3E3] truncate text-[11px]">
            {documentTitle}
          </span>
        </div>

        {/* Controles de Navegação */}
        <div className="flex items-center gap-1 shrink-0">
          <div className="flex items-center rounded border border-[#242628] bg-[#0C0D0E] px-1 py-0.5 text-[10px] font-mono text-[#E3E3E3]">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="p-0.5 hover:text-[#D97706] disabled:opacity-30 cursor-pointer"
              title="Página Anterior"
            >
              <ChevronLeft className="h-3 w-3" />
            </button>
            <span className="px-1 text-[#85888C]">Pág. {currentPage}</span>
            <button
              onClick={() => setCurrentPage((p) => p + 1)}
              className="p-0.5 hover:text-[#D97706] cursor-pointer"
              title="Próxima Página"
            >
              <ChevronRight className="h-3 w-3" />
            </button>
          </div>

          <div className="flex items-center gap-0.5">
            <button
              onClick={() => setZoom((z) => Math.max(50, z - 15))}
              className="p-1 rounded hover:bg-[#242628] text-[#85888C] hover:text-[#E3E3E3] cursor-pointer"
              title="Reduzir Zoom"
            >
              <ZoomOut className="h-3 w-3" />
            </button>
            <button
              onClick={() => setZoom((z) => Math.min(150, z + 15))}
              className="p-1 rounded hover:bg-[#242628] text-[#85888C] hover:text-[#E3E3E3] cursor-pointer"
              title="Aumentar Zoom"
            >
              <ZoomIn className="h-3 w-3" />
            </button>
            <button
              onClick={() => setIsFullscreen((f) => !f)}
              className="p-1 rounded hover:bg-[#242628] text-[#85888C] hover:text-[#E3E3E3] cursor-pointer"
              title={isFullscreen ? "Restaurar" : "Tela Cheia"}
            >
              {isFullscreen ? (
                <Minimize2 className="h-3 w-3" />
              ) : (
                <Maximize2 className="h-3 w-3" />
              )}
            </button>
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1 rounded hover:bg-[#242628] text-[#85888C] hover:text-[#E3E3E3]"
              title="Abrir em Nova Aba"
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </div>

      {/* Selector de Modo */}
      <div className="flex items-center justify-between px-2.5 py-1 border-b border-[#242628] bg-[#161719]/60 text-[10px] font-mono">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setViewMode("highlight")}
            className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
              viewMode === "highlight"
                ? "bg-[#D97706]/20 text-[#FDE68A] border border-[#D97706]/40 font-medium"
                : "text-[#85888C] hover:text-[#E3E3E3]"
            }`}
          >
            <span className="inline-flex items-center gap-1">
              <Sparkles className="h-2.5 w-2.5 text-[#D97706]" />
              Evidência Marcada
            </span>
          </button>
          <button
            onClick={() => setViewMode("raw")}
            className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
              viewMode === "raw"
                ? "bg-[#242628] text-[#E3E3E3] font-medium"
                : "text-[#85888C] hover:text-[#E3E3E3]"
            }`}
          >
            PDF Completo
          </button>
        </div>

        {hasBBox && (
          <span className="text-[#85888C] text-[9px]">
            Coordenadas rastreadas
          </span>
        )}
      </div>

      {/* Canvas / PDF Viewport com Bounding Box Overlay */}
      <div className="flex-1 relative bg-[#0C0D0E] overflow-auto flex items-center justify-center p-2">
        <div
          style={{ transform: `scale(${zoom / 100})`, transformOrigin: "top center" }}
          className="relative w-full h-full min-h-[300px] flex items-center justify-center transition-transform duration-100"
        >
          {/* Iframe PDF Viewer nativo */}
          <iframe
            src={`${pdfUrl}&toolbar=0&navpanes=0`}
            className="w-full h-full rounded border-0 bg-[#161719]"
            title={documentTitle}
          />

          {/* Bounding Box Highlight Overlay */}
          {viewMode === "highlight" && hasBBox && (
            <div
              style={boxStyle}
              className="absolute pointer-events-none rounded border-2 border-[#D97706] bg-[#D97706]/20 shadow-[0_0_15px_rgba(217,119,6,0.45)] animate-pulse z-10"
            >
              <div className="absolute -top-4 left-0 bg-[#D97706] text-[#0C0D0E] text-[8px] font-mono px-1 py-0.2 rounded font-bold uppercase tracking-wider">
                Evidência #p.{currentPage}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Snippet Footer */}
      {snippetText && (
        <div className="p-2 border-t border-[#242628] bg-[#161719] text-[11px] font-serif text-[#FDE68A] italic line-clamp-2">
          "{snippetText}"
        </div>
      )}
    </div>
  );
}
