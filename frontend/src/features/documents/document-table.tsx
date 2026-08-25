"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";
import { DocumentItem } from "@/types/api";
import { useChatStore } from "@/stores/useChatStore";
import { StatusBadge } from "./status-badge";
import {
  FileText,
  Trash2,
  MessageSquare,
  Loader2,
  Layers,
  Sparkles,
} from "lucide-react";

export function DocumentTable() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const setSelectedDocumentId = useChatStore((state) => state.setSelectedDocumentId);
  const [documentToDelete, setDocumentToDelete] = useState<DocumentItem | null>(null);

  // 1. Busca lista de documentos do usuário
  const { data: documents = [], isLoading } = useQuery<DocumentItem[]>({
    queryKey: ["documents"],
    queryFn: async () => {
      const res = await apiClient.get("/documents/");
      return res.data;
    },
  });

  // 2. Mutação de Deleção
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/documents/${id}`);
    },
    onSuccess: () => {
      toast.success("Documento excluído com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      setDocumentToDelete(null);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.detail || "Erro ao excluir documento.";
      toast.error("Falha ao excluir", { description: msg });
    },
  });

  const handleOpenChat = (docId: string) => {
    setSelectedDocumentId(docId);
    router.push("/chat");
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-400">
        <Loader2 className="h-6 w-6 animate-spin text-blue-500 mb-2" />
        <p className="text-xs">Carregando documentos...</p>
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-12 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-800 text-slate-400 mx-auto mb-3">
          <Layers className="h-6 w-6" />
        </div>
        <h4 className="text-sm font-semibold text-white">
          Nenhum documento cadastrado
        </h4>
        <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
          Faça o upload do seu primeiro arquivo PDF acima para iniciar a indexação vetorial.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-xl shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-800 bg-slate-950/60 text-xs font-semibold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-6 py-4">Documento</th>
                <th className="px-6 py-4">Status de Ingestão</th>
                <th className="px-6 py-4">Tipo</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {documents.map((doc) => (
                <tr
                  key={doc.id}
                  className="hover:bg-slate-800/30 transition-colors group"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400">
                        <FileText className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-white truncate max-w-md">
                          {doc.title}
                        </p>
                        <p className="text-xs text-slate-500 truncate font-mono">
                          ID: {doc.id}
                        </p>
                      </div>
                    </div>
                  </td>

                  <td className="px-6 py-4">
                    <StatusBadge status={doc.status} />
                  </td>

                  <td className="px-6 py-4 text-xs text-slate-400 font-mono">
                    {doc.content_type || "application/pdf"}
                  </td>

                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleOpenChat(doc.id)}
                        disabled={doc.status !== "COMPLETED"}
                        title="Conversar com este documento no Chat RAG"
                        className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600/15 hover:bg-blue-600/25 border border-blue-500/30 px-3 py-1.5 text-xs font-medium text-blue-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Chat RAG</span>
                      </button>

                      <button
                        onClick={() => setDocumentToDelete(doc)}
                        title="Excluir documento"
                        className="inline-flex items-center justify-center rounded-lg p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-colors cursor-pointer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation Modal */}
      {documentToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-semibold text-white">
              Confirmar Exclusão
            </h3>
            <p className="text-xs text-slate-300">
              Tem certeza que deseja excluir o documento{" "}
              <strong className="text-white">"{documentToDelete.title}"</strong>?
              Esta ação removerá todos os seus chunks e embeddings do banco de dados vetorial.
            </p>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDocumentToDelete(null)}
                className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-medium text-slate-200 hover:bg-slate-700 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => deleteMutation.mutate(documentToDelete.id)}
                disabled={deleteMutation.isPending}
                className="inline-flex items-center gap-2 rounded-xl bg-red-600 hover:bg-red-500 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-red-600/20 transition-all disabled:opacity-50 cursor-pointer"
              >
                {deleteMutation.isPending ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Excluindo...
                  </>
                ) : (
                  "Sim, Excluir"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
