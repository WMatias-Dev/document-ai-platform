"use client";

import { useRouter } from "next/navigation";
import { FEATURED_TEMPLATES, Notebook } from "@/stores/useNotebookStore";
import { useChatStore } from "@/stores/useChatStore";
import { ArrowUpRight, FolderGit2, FileText } from "lucide-react";

export function FeaturedNotebooks() {
  const router = useRouter();
  const setNotebookTitle = useChatStore((state) => state.setNotebookTitle);

  const handleOpenFeatured = (template: Notebook) => {
    setNotebookTitle(template.title);
    router.push(`/notebook/${template.id}`);
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
            [Estruturas Pré-configuradas]
          </span>
        </div>
      </div>

      {/* Grid of Clean Research Templates */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {FEATURED_TEMPLATES.map((item, idx) => (
          <div
            key={item.id}
            onClick={() => handleOpenFeatured(item)}
            className="group flex flex-col justify-between rounded border border-[#242628] bg-[#161719] hover:bg-[#1C1D20] hover:border-[#383B40] p-4 transition-all cursor-pointer min-h-[140px]"
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
                <span>Abrir</span>
                <ArrowUpRight className="h-3 w-3" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
