"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiClient, getErrorMessage } from "@/lib/api-client";
import { NotebookItem } from "@/types/api";
import { FEATURED_TEMPLATES, Notebook } from "@/stores/useNotebookStore";
import { useChatStore } from "@/stores/useChatStore";
import { ArrowUpRight, Loader2 } from "lucide-react";

export function FeaturedNotebooks() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const setNotebookTitle = useChatStore((state) => state.setNotebookTitle);
  const [creatingTemplateId, setCreatingTemplateId] = useState<string | null>(null);

  const createFromTemplateMutation = useMutation({
    mutationFn: async (template: Notebook) => {
      const res = await apiClient.post<NotebookItem>("/notebooks/", {
        title: template.title,
        description: `Modelo: ${template.category}`,
        emoji: "📑",
      });
      return res.data;
    },
    onSuccess: (newNotebook) => {
      setNotebookTitle(newNotebook.title);
      queryClient.invalidateQueries({ queryKey: ["notebooks"] });
      toast.success("Caderno criado a partir do modelo.", {
        description: `"${newNotebook.title}" pronto para uso.`,
      });
      router.push(`/notebook/${newNotebook.id}`);
    },
    onError: (err: any) => {
      const msg = getErrorMessage(err, "Erro ao instanciar modelo de caderno.");
      toast.error("Falha ao abrir modelo", { description: msg });
      setCreatingTemplateId(null);
    },
  });

  const handleOpenFeatured = (template: Notebook) => {
    if (createFromTemplateMutation.isPending) return;
    setCreatingTemplateId(template.id);
    createFromTemplateMutation.mutate(template);
  };

  return (
    <section className="space-y-3">
      {/* Section Header */}
      <div className="flex items-center justify-between border-b border-[#242628] pb-2">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-mono font-semibold uppercase tracking-wider text-[#85888C]">
            Modelos de Investigação Documental
          </h2>
          <span className="text-[10px] font-mono text-[#55585D]">
            [Clique para Instanciar Caderno]
          </span>
        </div>
      </div>

      {/* Grid of Clean Research Templates */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {FEATURED_TEMPLATES.map((item, idx) => {
          const isCurrentLoading =
            createFromTemplateMutation.isPending &&
            creatingTemplateId === item.id;

          return (
            <div
              key={item.id}
              onClick={() => handleOpenFeatured(item)}
              className={`group flex flex-col justify-between rounded border border-[#242628] bg-[#161719] hover:bg-[#1C1D20] hover:border-[#383B40] p-4 transition-all cursor-pointer min-h-[140px] ${
                isCurrentLoading ? "opacity-70 pointer-events-none" : ""
              }`}
            >
              {/* Top Category & Identifier */}
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-[#85888C]">
                  {item.category}
                </span>
                <span className="text-[10px] font-mono text-[#55585D]">
                  MOD-0{idx + 1}
                </span>
              </div>

              {/* Title with subtle hover */}
              <div className="my-2.5">
                <h3 className="text-xs font-medium text-[#E3E3E3] group-hover:text-white line-clamp-2 leading-relaxed">
                  {item.title}
                </h3>
              </div>

              {/* Metadata Footer */}
              <div className="flex items-center justify-between text-[10px] font-mono text-[#85888C] pt-2 border-t border-[#242628]/60">
                <span>{item.sourceCount} fontes base</span>
                <div className="flex items-center gap-0.5 text-[#85888C] group-hover:text-[#E3E3E3] transition-colors">
                  {isCurrentLoading ? (
                    <span className="flex items-center gap-1 text-[#D97706]">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Instanciando...
                    </span>
                  ) : (
                    <>
                      <span>Criar</span>
                      <ArrowUpRight className="h-3 w-3" />
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
