"use client";

import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";
import { DocumentItem } from "@/types/api";
import { useChatStore } from "@/stores/useChatStore";
import { X, Upload, Loader2, FileCheck } from "lucide-react";

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
      toast.success("Documento indexado!", {
        description: `"${processingDoc.title}" pronto para consulta.`,
      });
      toggleSourceSelection(processingDoc.id);
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      if (activeNotebookId) {
        queryClient.invalidateQueries({
          queryKey: ["notebook_documents", activeNotebookId],
        });
        queryClient.invalidateQueries({ queryKey: ["notebooks"] });
      }
    }
  }, [
    processingDoc?.status,
    processingDoc?.id,
    processingDoc?.title,
    queryClient,
    toggleSourceSelection,
    activeNotebookId,
  ]);

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);

      const url = activeNotebookId
        ? `/documents/upload?notebook_id=${activeNotebookId}`
        : "/documents/upload";

      const res = await apiClient.post(url, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return res.data;
    },
    onSuccess: (data) => {
      setCurrentProcessingId(data.document_id);
      toast.info("Processando arquivo PDF...", {
        description: "Extraindo texto e gerando vetores em background.",
      });
    },
    onError: (err: any) => {
      const msg =
        err.response?.data?.detail || "Erro ao fazer upload do documento.";
      toast.error(msg);
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
    uploadMutation.mutate(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-lg rounded border border-[#242628] bg-[#161719] p-6 shadow-2xl space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#242628] pb-3">
          <div>
            <h3 className="text-sm font-sans font-medium text-[#E3E3E3]">
              Anexar Fonte Documental
            </h3>
            <p className="text-[11px] font-mono text-[#85888C]">
              [Ingestão e Indexação Vetorial]
            </p>
          </div>

          <button
            onClick={() => setAddSourceModalOpen(false)}
            className="rounded p-1 text-[#85888C] hover:text-[#E3E3E3] hover:bg-[#242628] transition-colors cursor-pointer"
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
          className={`flex flex-col items-center justify-center rounded border border-dashed p-8 text-center transition-all cursor-pointer ${
            dragActive
              ? "border-[#D97706] bg-[#D97706]/5"
              : "border-[#242628] bg-[#0C0D0E] hover:border-[#383B40] hover:bg-[#161719]"
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

          <div className="flex h-10 w-10 items-center justify-center rounded bg-[#161719] border border-[#242628] text-[#85888C] mb-2.5">
            <Upload className="h-4 w-4" />
          </div>

          <p className="text-xs font-sans font-medium text-[#E3E3E3]">
            Arraste um PDF ou clique para selecionar
          </p>
          <span className="text-[10px] font-mono text-[#85888C] mt-1">
            Limite máximo de 10 MB por arquivo
          </span>
        </div>

        {/* Real-time Status Notice */}
        {processingDoc && (
          <div className="rounded border border-[#242628] bg-[#0C0D0E] p-3 flex items-center justify-between text-xs font-mono">
            <div className="flex items-center gap-2 truncate max-w-[300px]">
              <span className="text-[#E3E3E3]">{processingDoc.title}</span>
            </div>
            {processingDoc.status === "COMPLETED" ? (
              <span className="text-[#10B981] flex items-center gap-1">
                <FileCheck className="h-3.5 w-3.5" />
                Indexado
              </span>
            ) : processingDoc.status === "ERROR" ? (
              <span className="text-[#EF4444]">Falha</span>
            ) : (
              <span className="text-[#F59E0B] flex items-center gap-1">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {processingDoc.status}
              </span>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end pt-2 border-t border-[#242628]">
          <button
            onClick={() => setAddSourceModalOpen(false)}
            className="rounded px-4 py-1.5 text-xs font-sans text-[#85888C] hover:text-[#E3E3E3] hover:bg-[#242628] transition-colors cursor-pointer"
          >
            Concluir
          </button>
        </div>
      </div>
    </div>
  );
}
