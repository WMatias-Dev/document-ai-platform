import { DocumentStatus } from "@/types/api";
import { CheckCircle2, AlertCircle, Loader2, Clock } from "lucide-react";

interface StatusBadgeProps {
  status: DocumentStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  switch (status) {
    case "COMPLETED":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-400 border border-emerald-500/20">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Pronto para Chat
        </span>
      );

    case "RECEIVED":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-500/10 px-2.5 py-1 text-xs font-medium text-slate-400 border border-slate-500/20">
          <Clock className="h-3.5 w-3.5" />
          Recebido
        </span>
      );

    case "PARSING":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-2.5 py-1 text-xs font-medium text-blue-400 border border-blue-500/20 animate-pulse">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Extraindo Texto
        </span>
      );

    case "CHUNKING":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/10 px-2.5 py-1 text-xs font-medium text-indigo-400 border border-indigo-500/20 animate-pulse">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Fatiando Chunks
        </span>
      );

    case "EMBEDDING":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-500/10 px-2.5 py-1 text-xs font-medium text-purple-400 border border-purple-500/20 animate-pulse">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Indexando Vetores
        </span>
      );

    case "ERROR":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-400 border border-red-500/20">
          <AlertCircle className="h-3.5 w-3.5" />
          Erro no Processamento
        </span>
      );

    default:
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-400">
          {status}
        </span>
      );
  }
}
