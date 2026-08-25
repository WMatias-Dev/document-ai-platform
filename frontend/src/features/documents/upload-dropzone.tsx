"use client";

import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";
import { DocumentItem } from "@/types/api";
import { StatusBadge } from "./status-badge";
import {
  UploadCloud,
  FileText,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
} from "lucide-react";

export function UploadDropzone() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [currentProcessingId, setCurrentProcessingId] = useState<string | null>(
    null
  );

  // 1. Polling do status do documento recém-upado
  const { data: processingDoc } = useQuery<DocumentItem>({
    queryKey: ["document", currentProcessingId],
    queryFn: async () => {
      if (!currentProcessingId) throw new Error("No ID");
      const res = await apiClient.get(`/documents/${currentProcessingId}`);
      return res.data;
    },
    enabled: !!currentProcessingId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === "COMPLETED" || status === "ERROR") {
        return false; // Para o polling
      }
      return 1500; // Polling a cada 1.5s
    },
  });

  // Notificação e finalização do polling
  useEffect(() => {
    if (processingDoc?.status === "COMPLETED") {
      toast.success("Documento pronto!", {
        description: `O arquivo "${processingDoc.title}" foi indexado no pgvector com sucesso.`,
      });
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    } else if (processingDoc?.status === "ERROR") {
      toast.error("Falha no processamento", {
        description: "Não foi possível extrair o texto ou gerar os vetores deste PDF.",
      });
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    }
  }, [processingDoc?.status, processingDoc?.title, queryClient]);

  // 2. Mutação de Upload
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);

      const res = await apiClient.post("/documents/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return res.data;
    },
    onSuccess: (data) => {
      toast.info("Upload aceito!", {
        description: "Iniciando pipeline de parsing, fatiamento e embeddings...",
      });
      setCurrentProcessingId(data.document_id);
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
    onError: (err: any) => {
      const msg =
        err.response?.data?.detail || "Erro ao realizar upload do arquivo.";
      toast.error("Falha no upload", { description: msg });
    },
  });

  const handleFile = (file: File) => {
    if (file.type !== "application/pdf") {
      toast.error("Formato inválido", {
        description: "Por favor, selecione um arquivo no formato PDF.",
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("Arquivo muito grande", {
        description: "O tamanho máximo suportado é de 10 MB.",
      });
      return;
    }

    uploadMutation.mutate(file);
  };

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

  const isUploading = uploadMutation.isPending;
  const isProcessing =
    processingDoc &&
    processingDoc.status !== "COMPLETED" &&
    processingDoc.status !== "ERROR";

  return (
    <div className="space-y-4">
      {/* Dropzone Container */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => !isUploading && fileInputRef.current?.click()}
        className={`relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition-all cursor-pointer ${
          dragActive
            ? "border-blue-500 bg-blue-500/10 scale-[1.01]"
            : "border-slate-800 bg-slate-900/40 hover:border-slate-700 hover:bg-slate-900/60"
        } ${isUploading ? "opacity-60 pointer-events-none" : ""}`}
      >
        <input
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

        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 mb-3 shadow-inner">
          {isUploading ? (
            <Loader2 className="h-7 w-7 animate-spin" />
          ) : (
            <UploadCloud className="h-7 w-7" />
          )}
        </div>

        <h3 className="text-base font-semibold text-white">
          Arraste e solte seu PDF aqui
        </h3>
        <p className="text-xs text-slate-400 mt-1 max-w-sm">
          Arquivos PDF de até 10 MB. O sistema extrairá o texto, criará chunks com
          overlap e gerará embeddings com índice HNSW.
        </p>

        <button
          type="button"
          disabled={isUploading}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700/80 px-4 py-2 text-xs font-medium text-slate-200 transition-colors"
        >
          <FileText className="h-4 w-4" />
          Selecionar Arquivo do Computador
        </button>
      </div>

      {/* Real-Time Processing Card (Polling Feedback) */}
      {processingDoc && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-4 backdrop-blur-md shadow-xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <FileText className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {processingDoc.title}
              </p>
              <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                <Sparkles className="h-3 w-3 text-blue-400" /> Pipeline de Ingestão Ativo
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <StatusBadge status={processingDoc.status} />
            {processingDoc.status === "COMPLETED" && (
              <button
                onClick={() => setCurrentProcessingId(null)}
                className="text-xs text-slate-400 hover:text-white underline cursor-pointer"
              >
                Dispensar
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
