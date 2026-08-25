"use client";

import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";
import { DocumentItem } from "@/types/api";
import { useChatStore } from "@/stores/useChatStore";
import { StatusBadge } from "../documents/status-badge";
import {
  X,
  UploadCloud,
  FileText,
  Loader2,
  Sparkles,
  Link2,
  FileUp,
} from "lucide-react";

export function AddSourceModal() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { isAddSourceModalOpen, setAddSourceModalOpen, toggleSourceSelection } =
    useChatStore();
  const [dragActive, setDragActive] = useState(false);
  const [currentProcessingId, setCurrentProcessingId] = useState<string | null>(
    null
  );

  // Polling de status do documento
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
      if (status === "COMPLETED" || status === "ERROR") return false;
      return 1500;
    },
  });

  useEffect(() => {
    if (processingDoc?.status === "COMPLETED") {
      toast.success("Fonte adicionada!", {
        description: `"${processingDoc.title}" pronta para consulta com Gemini 3.7.`,
      });
      toggleSourceSelection(processingDoc.id);
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    }
  }, [processingDoc?.status, processingDoc?.id, processingDoc?.title, queryClient, toggleSourceSelection]);

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
      toast.info("Upload iniciado", {
        description: "Processando fatiamento e embeddings HNSW...",
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
        description: "Selecione um arquivo PDF.",
      });
      return;
    }
    uploadMutation.mutate(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  if (!isAddSourceModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-[#1e1f20] p-6 shadow-2xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/5 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0842a0]/40 text-[#a8c7fa] border border-[#a8c7fa]/20">
              <FileUp className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">
                Adicionar fontes ao Caderno
              </h3>
              <p className="text-xs text-zinc-400">
                As fontes permitem que o Gemini 3.7 Flash fundamente suas respostas em fatos.
              </p>
            </div>
          </div>

          <button
            onClick={() => setAddSourceModalOpen(false)}
            className="rounded-full p-2 text-zinc-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
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
              ? "border-[#a8c7fa] bg-[#a8c7fa]/10 scale-[1.01]"
              : "border-white/10 bg-[#131314]/60 hover:border-white/20 hover:bg-[#131314]"
          } ${uploadMutation.isPending ? "opacity-60 pointer-events-none" : ""}`}
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

          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#282a2c] text-[#a8c7fa] mb-3">
            {uploadMutation.isPending ? (
              <Loader2 className="h-7 w-7 animate-spin" />
            ) : (
              <UploadCloud className="h-7 w-7" />
            )}
          </div>

          <h4 className="text-sm font-semibold text-white">
            Fazer upload de fontes (PDF)
          </h4>
          <p className="text-xs text-zinc-400 mt-1 max-w-sm">
            Arraste e solte seus arquivos PDF ou clique para selecionar do computador.
          </p>
        </div>

        {/* Progress Feedback Card */}
        {processingDoc && (
          <div className="rounded-2xl border border-white/10 bg-[#131314] p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <FileText className="h-5 w-5 text-[#a8c7fa] shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-medium text-white truncate">
                  {processingDoc.title}
                </p>
                <p className="text-[11px] text-zinc-400 flex items-center gap-1 mt-0.5">
                  <Sparkles className="h-3 w-3 text-[#a8c7fa]" /> Indexando no pgvector...
                </p>
              </div>
            </div>

            <StatusBadge status={processingDoc.status} />
          </div>
        )}

        {/* Actions Footer */}
        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={() => setAddSourceModalOpen(false)}
            className="rounded-full px-5 py-2 text-xs font-medium text-zinc-300 hover:bg-white/5 transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
