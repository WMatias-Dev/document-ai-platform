"use client";

import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiClient, getErrorMessage } from "@/lib/api-client";
import { useChatStore } from "@/stores/useChatStore";
import { useDocumentProgress } from "@/hooks/useDocumentProgress";
import { X, Upload, Loader2, FileCheck, FileText, CheckCircle2, AlertCircle } from "lucide-react";

export function AddSourceModal() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    activeNotebookId,
    isAddSourceModalOpen,
    setAddSourceModalOpen,
    toggleSourceSelection,
  } = useChatStore();
  const [dragActive, setDragActive] = useState(false);
  const [currentProcessingId, setCurrentProcessingId] = useState<string | null>(null);
  const [uploadingFileName, setUploadingFileName] = useState<string>("");

  // Hook reativo via Server-Sent Events (SSE) sem polling
  const { progress, error: streamError, reset } = useDocumentProgress({
    documentId: currentProcessingId,
    onComplete: (data) => {
      toast.success("Documento indexado com sucesso!", {
        description: `"${uploadingFileName || "Documento"}" pronto para pesquisa e citações.`,
      });
      if (currentProcessingId) {
        toggleSourceSelection(currentProcessingId);
      }
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      if (activeNotebookId) {
        queryClient.invalidateQueries({
          queryKey: ["notebook_documents", activeNotebookId],
        });
        queryClient.invalidateQueries({ queryKey: ["notebooks"] });
      }
    },
    onError: (errMsg) => {
      toast.error("Erro na ingestão do documento", { description: errMsg });
    },
  });

  const isUUID =
    !!activeNotebookId &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      activeNotebookId
    );

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);

      const url = isUUID
        ? `/documents/upload?notebook_id=${activeNotebookId}`
        : "/documents/upload";

      const res = await apiClient.post(url, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return res.data;
    },
    onSuccess: (data) => {
      setCurrentProcessingId(data.document_id);
    },
    onError: (err: any) => {
      const msg = getErrorMessage(
        err,
        "Erro ao fazer upload do documento."
      );
      toast.error("Falha no envio", { description: msg });
      setCurrentProcessingId(null);
    },
  });

  if (!isAddSourceModalOpen) return null;

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFile = (file: File) => {
    if (file.type !== "application/pdf") {
      toast.error("Formato inválido. Apenas arquivos PDF são aceitos.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("O arquivo excede o limite de 10 MB.");
      return;
    }
    setUploadingFileName(file.name);
    reset();
    uploadMutation.mutate(file);
  };

  const isCompleted = progress?.status === "ready" || progress?.status === "completed";
  const isError = progress?.status === "error" || !!streamError;
  const currentProgressPercent = isCompleted ? 100 : (progress?.progress || (uploadMutation.isPending ? 10 : 0));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-600">
              <Upload className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-800">
                Anexar Documento ao Caderno
              </h3>
              <p className="text-xs font-sans text-slate-500">
                Ingestão estruturada e indexação vetorial em tempo real
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              setAddSourceModalOpen(false);
              setCurrentProcessingId(null);
              reset();
            }}
            className="rounded-lg p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Dropzone Area */}
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => !uploadMutation.isPending && fileInputRef.current?.click()}
          className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition-all cursor-pointer ${
            dragActive
              ? "border-emerald-500 bg-emerald-50/50 scale-[0.99]"
              : "border-slate-200 bg-slate-50/50 hover:border-emerald-300 hover:bg-emerald-50/20"
          } ${uploadMutation.isPending ? "opacity-60 pointer-events-none" : ""}`}
        >
          <input
            id="pdf-upload-input"
            name="file"
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleFile(e.target.files[0]);
              }
            }}
          />

          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white border border-slate-200 text-emerald-600 mb-3 shadow-2xs">
            <Upload className="h-5 w-5" />
          </div>

          <p className="text-xs font-semibold text-slate-800">
            Arraste seu PDF aqui ou clique para selecionar
          </p>
          <span className="text-[11px] font-sans text-slate-400 mt-1">
            Suporta arquivos PDF de até 10 MB
          </span>
        </div>

        {/* Real-time SSE Ingestion Status */}
        {(currentProcessingId || uploadMutation.isPending) && (
          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 space-y-3 font-sans text-xs animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 truncate max-w-[310px]">
                <div className={`flex h-8 w-8 items-center justify-center rounded-xl shrink-0 ${
                  isCompleted
                    ? "bg-emerald-100 text-emerald-700"
                    : isError
                    ? "bg-rose-100 text-rose-700"
                    : "bg-slate-200/80 text-slate-700"
                }`}>
                  {isCompleted ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  ) : isError ? (
                    <AlertCircle className="h-4 w-4 text-rose-600" />
                  ) : (
                    <FileText className="h-4 w-4 text-slate-600" />
                  )}
                </div>
                <div className="truncate">
                  <span className="font-semibold text-slate-800 truncate block">
                    {uploadingFileName || "Processando arquivo..."}
                  </span>
                  <span className="text-[11px] text-slate-500 truncate block">
                    {progress?.message || (uploadMutation.isPending ? "Transmitindo arquivo para o servidor..." : "Iniciando processamento...")}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {isCompleted ? (
                  <span className="text-emerald-700 font-semibold flex items-center gap-1 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 text-[11px]">
                    <FileCheck className="h-3.5 w-3.5" />
                    Concluído
                  </span>
                ) : isError ? (
                  <span className="text-rose-700 font-medium bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200 text-[11px]">
                    Falha
                  </span>
                ) : (
                  <span className="text-emerald-700 font-semibold bg-emerald-100/70 px-2.5 py-1 rounded-full text-[11px] flex items-center gap-1.5">
                    <Loader2 className="h-3 w-3 animate-spin text-emerald-600" />
                    {currentProgressPercent}%
                  </span>
                )}
              </div>
            </div>

            {/* Barra de Progresso Animada */}
            <div className="w-full bg-slate-200/90 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ease-out rounded-full ${
                  isError
                    ? "bg-rose-500"
                    : isCompleted
                    ? "bg-emerald-500"
                    : "bg-emerald-600"
                }`}
                style={{ width: `${Math.max(currentProgressPercent, 8)}%` }}
              />
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end pt-2 border-t border-slate-100">
          <button
            onClick={() => {
              setAddSourceModalOpen(false);
              setCurrentProcessingId(null);
              reset();
            }}
            className="rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 text-xs font-medium transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
