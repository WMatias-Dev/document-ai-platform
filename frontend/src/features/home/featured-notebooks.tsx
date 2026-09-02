"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiClient, getErrorMessage } from "@/lib/api-client";
import { NotebookItem } from "@/types/api";
import { FEATURED_TEMPLATES, Notebook } from "@/stores/useNotebookStore";
import { useChatStore } from "@/stores/useChatStore";
import { ArrowUpRight, Loader2, Sparkles } from "lucide-react";

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
      <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
        <div className="flex items-center gap-2">
          <div className="flex h-5 w-5 items-center justify-center rounded-md bg-emerald-50 text-emerald-600">
            <Sparkles className="h-3 w-3" />
          </div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-700">
            Modelos de Investigação Documental
          </h2>
        </div>
        <span className="text-[11px] font-sans text-slate-500">
          Modelos pré-configurados para início rápido
        </span>
      </div>

      {/* Grid of Clean Research Templates */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {FEATURED_TEMPLATES.map((item, idx) => {
          const isCurrentLoading =
            createFromTemplateMutation.isPending &&
            creatingTemplateId === item.id;

          return (
            <div
              key={item.id}
              onClick={() => handleOpenFeatured(item)}
              className={`group flex flex-col justify-between rounded-xl border border-slate-200/90 bg-white hover:border-emerald-300 hover:shadow-md hover:shadow-emerald-500/5 p-4 transition-all cursor-pointer min-h-[145px] shadow-xs active:scale-[0.98] ${
                isCurrentLoading ? "opacity-70 pointer-events-none" : ""
              }`}
            >
              {/* Top Category & Identifier */}
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-mono font-medium uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 rounded-full">
                  {item.category}
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  MOD-0{idx + 1}
                </span>
              </div>

              {/* Title with subtle hover */}
              <div className="my-2">
                <h3 className="text-xs font-semibold text-slate-800 group-hover:text-emerald-700 line-clamp-2 leading-snug">
                  {item.title}
                </h3>
              </div>

              {/* Metadata Footer */}
              <div className="flex items-center justify-between text-[11px] font-sans text-slate-500 pt-2 border-t border-slate-100">
                <span>{item.sourceCount} fontes base</span>
                <div className="flex items-center gap-1 font-medium text-slate-600 group-hover:text-emerald-600 transition-colors">
                  {isCurrentLoading ? (
                    <span className="flex items-center gap-1 text-emerald-600">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Criando...
                    </span>
                  ) : (
                    <>
                      <span>Usar modelo</span>
                      <ArrowUpRight className="h-3.5 w-3.5" />
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
