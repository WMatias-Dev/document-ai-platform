"use client";

import { useRouter } from "next/navigation";
import { FEATURED_TEMPLATES, Notebook } from "@/stores/useNotebookStore";
import { useChatStore } from "@/stores/useChatStore";
import { Sparkles, ArrowRight, Globe, Layers, BookOpen } from "lucide-react";

export function FeaturedNotebooks() {
  const router = useRouter();
  const setNotebookTitle = useChatStore((state) => state.setNotebookTitle);

  const handleOpenFeatured = (template: Notebook) => {
    setNotebookTitle(template.title);
    router.push(`/notebook/${template.id}`);
  };

  return (
    <section className="space-y-4">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-white tracking-tight">
            Notebooks em destaque
          </h2>
          <span className="rounded-full bg-white/5 border border-white/10 px-2.5 py-0.5 text-[11px] font-medium text-zinc-400">
            Templates
          </span>
        </div>

        <button
          onClick={() => alert("Catálogo completo de templates disponível em breve!")}
          className="inline-flex items-center gap-1 text-xs font-medium text-[#a8c7fa] hover:text-[#c2e7ff] transition-colors cursor-pointer"
        >
          <span>Ver tudo</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Grid of Featured Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {FEATURED_TEMPLATES.map((item) => (
          <div
            key={item.id}
            onClick={() => handleOpenFeatured(item)}
            className="group relative flex flex-col justify-between rounded-3xl border border-white/10 bg-[#1e1f20] hover:border-white/20 p-5 transition-all hover:-translate-y-1 hover:shadow-xl cursor-pointer overflow-hidden min-h-[190px]"
          >
            {/* Background Decorative Gradient */}
            <div
              className={`absolute inset-0 bg-gradient-to-br ${item.coverGradient} opacity-30 group-hover:opacity-50 transition-opacity pointer-events-none`}
            />

            {/* Top Category Badge */}
            <div className="relative z-10 flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-black/40 backdrop-blur-md px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#c2e7ff] border border-white/10">
                <Globe className="h-3 w-3 text-[#a8c7fa]" />
                {item.category}
              </span>
            </div>

            {/* Middle Title */}
            <div className="relative z-10 my-3">
              <h3 className="text-sm font-semibold text-white group-hover:text-[#a8c7fa] transition-colors line-clamp-2 leading-snug">
                {item.title}
              </h3>
            </div>

            {/* Bottom Metadata Footer */}
            <div className="relative z-10 flex items-center justify-between text-[11px] text-zinc-400 font-medium pt-2 border-t border-white/5">
              <span>{item.updatedAt}</span>
              <span className="flex items-center gap-1 font-mono text-zinc-300">
                <Layers className="h-3 w-3 text-zinc-400" />
                {item.sourceCount} fontes
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
