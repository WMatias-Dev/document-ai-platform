"use client";

import { useEffect, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { useChatStore } from "@/stores/useChatStore";
import { toast } from "sonner";
import {
  Bold,
  Italic,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  Quote,
  Code,
  Download,
  Copy,
  Trash2,
  Check,
  FileEdit,
  Sparkles,
} from "lucide-react";

export function NotesEditor() {
  const { activeNotebookId, notebookTitle, getNoteForNotebook, updateNoteForNotebook } =
    useChatStore();

  const [isCopied, setIsCopied] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date>(new Date());

  const initialContent = getNoteForNotebook(activeNotebookId);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Placeholder.configure({
        placeholder:
          "Escreva suas sínteses, hipóteses e notas de pesquisa aqui...\nVocê também pode clicar em '+ Nota' em qualquer resposta do chat!",
      }),
    ],
    content: initialContent || "",
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "prose prose-slate prose-sm max-w-none focus:outline-none min-h-[300px] text-xs font-serif text-slate-800 leading-relaxed p-3.5 selection:bg-emerald-100 selection:text-emerald-800",
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      updateNoteForNotebook(activeNotebookId, html);
      setLastSaved(new Date());
    },
  });

  // Atualiza o editor caso o conteúdo no store mude externamente
  useEffect(() => {
    const currentStoreContent = getNoteForNotebook(activeNotebookId);
    if (editor && currentStoreContent !== editor.getHTML()) {
      editor.commands.setContent(currentStoreContent || "");
      setLastSaved(new Date());
    }
  }, [activeNotebookId, editor, getNoteForNotebook]);

  if (!editor) {
    return (
      <div className="p-8 text-center text-xs font-sans text-slate-400">
        Carregando editor de notas...
      </div>
    );
  }

  const handleCopyAll = () => {
    const text = editor.getText();
    if (!text.trim()) {
      toast.error("A nota está vazia.");
      return;
    }
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    toast.success("Conteúdo copiado!");
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleDownloadMarkdown = () => {
    const text = editor.getText();
    if (!text.trim()) {
      toast.error("A nota está vazia para download.");
      return;
    }
    const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Notas_${notebookTitle.replace(/\s+/g, "_")}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Arquivo Markdown baixado com sucesso!");
  };

  const handleClear = () => {
    if (confirm("Deseja realmente limpar as notas deste caderno?")) {
      editor.commands.clearContent();
      updateNoteForNotebook(activeNotebookId, "");
      toast.info("Notas limpas.");
    }
  };

  return (
    <div className="flex flex-col h-full rounded-2xl border border-slate-200/90 bg-white overflow-hidden text-xs shadow-xs">
      {/* Top Action Bar */}
      <div className="p-2.5 border-b border-slate-200/80 bg-slate-50/70 flex items-center justify-between gap-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <FileEdit className="h-4 w-4 text-emerald-600 shrink-0" />
          <span className="font-semibold text-xs text-slate-800 truncate">
            Caderno de Sínteses
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={handleCopyAll}
            className="p-1.5 rounded-lg hover:bg-slate-200/60 text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
            title="Copiar Texto"
          >
            {isCopied ? (
              <Check className="h-3.5 w-3.5 text-emerald-600" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
          <button
            onClick={handleDownloadMarkdown}
            className="p-1.5 rounded-lg hover:bg-slate-200/60 text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
            title="Baixar em Markdown (.md)"
          >
            <Download className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={handleClear}
            className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
            title="Limpar Notas"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Formatting Toolbar */}
      <div className="px-2.5 py-1.5 border-b border-slate-100 bg-white flex flex-wrap items-center gap-0.5">
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`p-1 rounded-md transition-colors cursor-pointer ${
            editor.isActive("bold")
              ? "bg-emerald-50 text-emerald-700 font-bold"
              : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
          }`}
          title="Negrito (Ctrl+B)"
        >
          <Bold className="h-3.5 w-3.5" />
        </button>

        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`p-1 rounded-md transition-colors cursor-pointer ${
            editor.isActive("italic")
              ? "bg-emerald-50 text-emerald-700"
              : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
          }`}
          title="Itálico (Ctrl+I)"
        >
          <Italic className="h-3.5 w-3.5" />
        </button>

        <div className="h-3.5 w-[1px] bg-slate-200 mx-0.5" />

        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={`p-1 rounded-md transition-colors cursor-pointer ${
            editor.isActive("heading", { level: 1 })
              ? "bg-emerald-50 text-emerald-700"
              : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
          }`}
          title="Título Principal"
        >
          <Heading1 className="h-3.5 w-3.5" />
        </button>

        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`p-1 rounded-md transition-colors cursor-pointer ${
            editor.isActive("heading", { level: 2 })
              ? "bg-emerald-50 text-emerald-700"
              : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
          }`}
          title="Subtítulo"
        >
          <Heading2 className="h-3.5 w-3.5" />
        </button>

        <div className="h-3.5 w-[1px] bg-slate-200 mx-0.5" />

        <button
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`p-1 rounded-md transition-colors cursor-pointer ${
            editor.isActive("bulletList")
              ? "bg-emerald-50 text-emerald-700"
              : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
          }`}
          title="Lista em Tópicos"
        >
          <List className="h-3.5 w-3.5" />
        </button>

        <button
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`p-1 rounded-md transition-colors cursor-pointer ${
            editor.isActive("orderedList")
              ? "bg-emerald-50 text-emerald-700"
              : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
          }`}
          title="Lista Numerada"
        >
          <ListOrdered className="h-3.5 w-3.5" />
        </button>

        <button
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={`p-1 rounded-md transition-colors cursor-pointer ${
            editor.isActive("blockquote")
              ? "bg-emerald-50 text-emerald-700"
              : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
          }`}
          title="Citação / Evidência"
        >
          <Quote className="h-3.5 w-3.5" />
        </button>

        <button
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          className={`p-1 rounded-md transition-colors cursor-pointer ${
            editor.isActive("codeBlock")
              ? "bg-emerald-50 text-emerald-700"
              : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
          }`}
          title="Bloco de Código"
        >
          <Code className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Editor Content Area */}
      <div className="flex-1 overflow-y-auto bg-white">
        <EditorContent editor={editor} />
      </div>

      {/* Footer Status */}
      <div className="px-3 py-1.5 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between text-[11px] font-sans text-slate-400">
        <span className="flex items-center gap-1 text-emerald-700 font-medium">
          <Sparkles className="h-3 w-3 text-emerald-600" />
          Salvo automaticamente
        </span>
        <span className="font-mono">{lastSaved.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
      </div>
    </div>
  );
}
