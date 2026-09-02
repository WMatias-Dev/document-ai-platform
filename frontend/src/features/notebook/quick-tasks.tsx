"use client";

import React from "react";
import {
  BookOpen,
  HelpCircle,
  FileSpreadsheet,
  Clock,
  AlertTriangle,
  Sparkles,
  Loader2,
  LucideIcon,
  ArrowRight,
} from "lucide-react";

export interface QuickTaskItem {
  id: string;
  title: string;
  subtitle: string;
  prompt: string;
  icon: LucideIcon;
}

export const UNIVERSAL_QUICK_TASKS: QuickTaskItem[] = [
  {
    id: "task-exec-summary",
    title: "Resumo Executivo",
    subtitle: "Síntese estruturada dos tópicos centrais e conclusões.",
    prompt:
      "Elabore um resumo executivo claro e estruturado com os tópicos centrais e conclusões do documento.",
    icon: BookOpen,
  },
  {
    id: "task-study-faq",
    title: "Guia de Estudos & FAQ",
    subtitle: "Perguntas frequentes e conceitos-chave.",
    prompt:
      "Gere uma lista de perguntas frequentes (FAQ) e conceitos-chave para facilitar o entendimento do conteúdo.",
    icon: HelpCircle,
  },
  {
    id: "task-data-tables",
    title: "Extração de Dados & Tabelas",
    subtitle: "Mapeamento numérico e quantitativo em tabela Markdown.",
    prompt:
      "Mapeie dados quantitativos, números, valores ou termos técnicos organizando-os em uma tabela Markdown.",
    icon: FileSpreadsheet,
  },
  {
    id: "task-timeline",
    title: "Linha do Tempo / Fases",
    subtitle: "Ordem cronológica, marcos e etapas do processo.",
    prompt:
      "Estruture a ordem cronológica, marcos, etapas de processo ou datas mencionadas.",
    icon: Clock,
  },
  {
    id: "task-critical-points",
    title: "Pontos Críticos & Riscos",
    subtitle: "Alertas, inconsistências e riscos potenciais.",
    prompt:
      "Identifique alertas, inconsistências, potenciais riscos ou lacunas descritas no material.",
    icon: AlertTriangle,
  },
  {
    id: "task-bullet-briefing",
    title: "Briefing em Tópicos",
    subtitle: "Top 5 principais insights sintetizados.",
    prompt:
      "Gere um briefing conciso com os 5 principais insights em bullet points.",
    icon: Sparkles,
  },
];

interface QuickTasksProps {
  onExecuteTask: (taskId: string, prompt: string) => void;
  runningTaskId: string | null;
  isDisabled: boolean;
}

export function QuickTasks({
  onExecuteTask,
  runningTaskId,
  isDisabled,
}: QuickTasksProps) {
  return (
    <div className="space-y-2">
      {UNIVERSAL_QUICK_TASKS.map((task) => {
        const Icon = task.icon;
        const isRunning = runningTaskId === task.id;

        return (
          <button
            key={task.id}
            onClick={() => onExecuteTask(task.id, task.prompt)}
            disabled={isDisabled}
            className={`w-full flex items-start gap-2.5 rounded-xl border border-slate-200/90 bg-white hover:border-emerald-300 hover:shadow-sm p-3 text-left transition-all cursor-pointer group shadow-2xs active:scale-[0.98] ${
              isRunning ? "border-emerald-500 bg-emerald-50/50 ring-1 ring-emerald-500/20" : ""
            } disabled:opacity-60 disabled:cursor-not-allowed`}
          >
            <div className="mt-0.5 shrink-0">
              {isRunning ? (
                <Loader2 className="h-4 w-4 text-emerald-600 animate-spin" />
              ) : (
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100">
                  <Icon className="h-3.5 w-3.5" />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="text-xs font-semibold text-slate-800 group-hover:text-emerald-800 flex items-center justify-between">
                <span>{task.title}</span>
                <span className="text-[10px] font-mono text-slate-400 group-hover:text-emerald-600">
                  Executar ↵
                </span>
              </h4>
              <p className="text-[11px] font-sans text-slate-500 mt-0.5 leading-snug">
                {task.subtitle}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
