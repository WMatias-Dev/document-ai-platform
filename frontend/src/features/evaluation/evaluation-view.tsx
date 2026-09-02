"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiClient, getErrorMessage } from "@/lib/api-client";
import { EvaluationRun, EvaluationRunSummary, EvaluationTrace } from "@/types/api";
import {
  ArrowLeft,
  Activity,
  Play,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Zap,
  ShieldCheck,
  Search,
  Database,
  BarChart3,
  HelpCircle,
  FileText,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Minus,
  Check,
  XCircle,
  ShieldAlert,
  X,
} from "lucide-react";

export function getScoreColor(score?: number | null): string {
  if (score === null || score === undefined) return "text-slate-400";
  if (score >= 0.9) return "text-emerald-600 font-bold"; // Excelente (>= 90%)
  if (score >= 0.75) return "text-amber-600 font-semibold"; // Alerta (75% - 89%)
  return "text-red-600 font-bold"; // Crítico (< 75%)
}

export function EvaluationView() {
  const queryClient = useQueryClient();
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [selectedTrace, setSelectedTrace] = useState<EvaluationTrace | null>(null);

  // 1. Listagem de Execuções
  const { data: runs = [], isLoading: isLoadingRuns } = useQuery<EvaluationRunSummary[]>({
    queryKey: ["evaluation_runs"],
    queryFn: async () => {
      const res = await apiClient.get("/evaluation/runs");
      return res.data;
    },
  });

  // Define o run selecionado por padrão como o mais recente
  const currentRunId = selectedRunId || (runs.length > 0 ? runs[0].run_id : null);

  // 2. Detalhes da Execução Selecionada
  const { data: activeRun, isLoading: isLoadingDetail } = useQuery<EvaluationRun>({
    queryKey: ["evaluation_run", currentRunId],
    queryFn: async () => {
      if (!currentRunId) throw new Error("No run ID");
      const res = await apiClient.get(`/evaluation/runs/${currentRunId}`);
      return res.data;
    },
    enabled: !!currentRunId,
  });

  // 3. Busca o Baseline para Comparação
  const { data: baselineRun } = useQuery<EvaluationRun>({
    queryKey: ["evaluation_baseline"],
    queryFn: async () => {
      const res = await apiClient.get("/evaluation/baseline");
      return res.data;
    },
  });

  // 4. Mutação para Disparar Nova Avaliação
  const runMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post("/evaluation/run", {
        name: `Avaliação #${runs.length + 1} — ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`,
        dataset_name: "contracts_eval_v1.json",
        is_baseline: false,
        top_k: 5,
      });
      return res.data;
    },
    onSuccess: (newRun: EvaluationRun) => {
      toast.success("Avaliação concluída com sucesso.", {
        description: `Execução ${newRun.run_id} persistida.`,
      });
      queryClient.invalidateQueries({ queryKey: ["evaluation_runs"] });
      setSelectedRunId(newRun.run_id);
    },
    onError: (err: any) => {
      const msg = getErrorMessage(err, "Falha ao executar avaliação.");
      toast.error("Erro na avaliação", { description: msg });
    },
  });

  const renderDelta = (current?: number | null, baseline?: number | null, isHigherBetter: boolean = true) => {
    if (typeof current !== "number" || typeof baseline !== "number" || currentRunId === baselineRun?.run_id) {
      return null;
    }
    const diff = current - baseline;
    if (Math.abs(diff) < 0.0001) {
      return (
        <span className="inline-flex items-center gap-0.5 text-[10px] font-mono text-slate-400">
          <Minus className="h-2.5 w-2.5" /> 0.0%
        </span>
      );
    }

    const isPositive = diff > 0;
    const isGood = isHigherBetter ? isPositive : !isPositive;
    const colorClass = isGood ? "text-emerald-600 font-medium" : "text-red-600 font-medium";
    const Icon = isPositive ? TrendingUp : TrendingDown;

    return (
      <span className={`inline-flex items-center gap-0.5 text-[10px] font-mono ${colorClass}`}>
        <Icon className="h-2.5 w-2.5" />
        {isPositive ? "+" : ""}{(diff * 100).toFixed(1)}% vs base
      </span>
    );
  };

  // Quality Gates Logic
  const qgRecall = typeof activeRun?.rag_quality.recall_at_5 === "number" ? activeRun.rag_quality.recall_at_5 >= 0.9 : null;
  const qgMrr = typeof activeRun?.rag_quality.mrr_at_5 === "number" ? activeRun.rag_quality.mrr_at_5 >= 0.85 : null;
  const qgFaith = typeof activeRun?.rag_quality.faithfulness === "number" ? activeRun.rag_quality.faithfulness >= 0.9 : null;
  const qgRel = typeof activeRun?.rag_quality.answer_relevancy === "number" ? activeRun.rag_quality.answer_relevancy >= 0.95 : null;
  const qgSuccess = typeof activeRun?.reliability.success_rate === "number" ? activeRun.reliability.success_rate >= 0.95 : null;

  const isOverallApproved =
    qgRecall === true &&
    qgMrr === true &&
    qgFaith === true &&
    qgRel === true &&
    qgSuccess === true;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col selection:bg-emerald-100 selection:text-emerald-800">
      {/* Top Header */}
      <header className="h-14 border-b border-slate-200/80 bg-white px-6 sm:px-10 flex items-center justify-between shrink-0 select-none shadow-xs">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            title="Voltar para a tela inicial"
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-50 border border-slate-200 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 hover:border-emerald-200 transition-all active:scale-[0.98]"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <span className="h-4 w-[1px] bg-slate-200" />
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <Activity className="h-4 w-4" />
            </div>
            <h1 className="text-sm font-semibold text-slate-800">
              Observabilidade & Avaliação RAG
            </h1>
            <span className="text-[11px] font-sans font-medium text-emerald-800 bg-emerald-50 border border-emerald-200/60 px-2.5 py-0.5 rounded-full hidden sm:inline">
              Métricas em Tempo Real
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Seletor de Execução */}
          <select
            id="evaluation-run-select"
            name="runId"
            value={currentRunId || ""}
            onChange={(e) => setSelectedRunId(e.target.value)}
            disabled={runs.length === 0}
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-sans text-slate-700 focus:outline-none focus:border-emerald-500 cursor-pointer max-w-[240px] truncate shadow-2xs"
          >
            {runs.map((r) => (
              <option key={r.run_id} value={r.run_id}>
                {r.is_baseline ? "⭐ [BASELINE] " : ""}{r.name}
              </option>
            ))}
          </select>

          {/* Botão de Disparo */}
          <button
            onClick={() => runMutation.mutate()}
            disabled={runMutation.isPending}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-4 py-2 text-xs transition-all shadow-sm hover:shadow-emerald-600/20 cursor-pointer disabled:opacity-50 active:scale-[0.98]"
          >
            {runMutation.isPending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Avaliando...</span>
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5 fill-current" />
                <span>Nova Avaliação</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 sm:px-10 py-6 space-y-6">
        {isLoadingRuns || isLoadingDetail ? (
          <div className="flex items-center justify-center p-16 text-slate-500 text-xs font-sans gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
            <span>Carregando dados de telemetria e métricas...</span>
          </div>
        ) : !activeRun ? (
          <div className="p-8 text-center rounded-2xl border border-slate-200 bg-white space-y-3 max-w-md mx-auto mt-12 shadow-xs">
            <AlertTriangle className="h-6 w-6 text-amber-500 mx-auto" />
            <h3 className="text-sm font-semibold text-slate-800">
              Nenhuma Execução Encontrada
            </h3>
            <p className="text-xs font-sans text-slate-500">
              Execute a primeira bateria de testes sobre o dataset canônico.
            </p>
            <button
              onClick={() => runMutation.mutate()}
              disabled={runMutation.isPending}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 text-white font-medium px-4 py-2 text-xs transition-all cursor-pointer shadow-sm active:scale-[0.98]"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              Executar Baseline
            </button>
          </div>
        ) : (
          <>
            {/* Execução Metadata Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl border border-slate-200/90 bg-white text-xs shadow-xs">
              <div className="flex items-center gap-3">
                <span className="font-semibold text-slate-800">
                  {activeRun.name}
                </span>
                {activeRun.is_baseline && (
                  <span className="text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
                    Baseline Oficial
                  </span>
                )}
                <span className="text-slate-200">|</span>
                <span className="text-slate-500">Dataset: {activeRun.dataset_version} ({activeRun.dataset_size} queries)</span>
              </div>
              <div className="flex items-center gap-4 text-slate-500 text-xs">
                <span>Modelo: <strong className="text-slate-800">{activeRun.model_name}</strong></span>
                <span>Embedding: <strong className="text-slate-800">{activeRun.embedding_model}</strong></span>
                <span>Data: {new Date(activeRun.timestamp).toLocaleString("pt-BR")}</span>
              </div>
            </div>

            {/* Quality Gates Overview Bar */}
            <div className="rounded-2xl border border-slate-200/90 bg-white p-5 space-y-4 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  {isOverallApproved ? (
                    <ShieldCheck className="h-5 w-5 text-emerald-600" />
                  ) : (
                    <ShieldAlert className="h-5 w-5 text-red-500" />
                  )}
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-800">
                    Quality Gates de Produção
                  </span>
                </div>
                <div>
                  {isOverallApproved ? (
                    <span className="text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full flex items-center gap-1.5">
                      <Check className="h-3.5 w-3.5" /> Aprovado na Homologação
                    </span>
                  ) : (
                    <span className="text-xs font-semibold text-red-700 bg-red-50 border border-red-200 px-3 py-1 rounded-full flex items-center gap-1.5">
                      <XCircle className="h-3.5 w-3.5" /> Reprovado nos Critérios
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/60">
                  <span className="text-xs font-medium text-slate-600">Recall@5 (≥90%)</span>
                  {qgRecall === true ? (
                    <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                      <Check className="h-3 w-3" /> Pass
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[11px] font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded-md border border-red-200">
                      <XCircle className="h-3 w-3" /> Fail
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/60">
                  <span className="text-xs font-medium text-slate-600">MRR@5 (≥0.85)</span>
                  {qgMrr === true ? (
                    <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                      <Check className="h-3 w-3" /> Pass
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[11px] font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded-md border border-red-200">
                      <XCircle className="h-3 w-3" /> Fail
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/60">
                  <span className="text-xs font-medium text-slate-600">Faithfulness (≥90%)</span>
                  {qgFaith === true ? (
                    <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                      <Check className="h-3 w-3" /> Pass
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[11px] font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded-md border border-red-200">
                      <XCircle className="h-3 w-3" /> Fail
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/60">
                  <span className="text-xs font-medium text-slate-600">Relevancy (≥95%)</span>
                  {qgRel === true ? (
                    <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                      <Check className="h-3 w-3" /> Pass
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[11px] font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded-md border border-red-200">
                      <XCircle className="h-3 w-3" /> Fail
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/60">
                  <span className="text-xs font-medium text-slate-600">Success (≥95%)</span>
                  {qgSuccess === true ? (
                    <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                      <Check className="h-3 w-3" /> Pass
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[11px] font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded-md border border-red-200">
                      <XCircle className="h-3 w-3" /> Fail
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Metric Groups Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* 1. RAG QUALITY */}
              <div className="rounded-2xl border border-slate-200/90 bg-white p-4.5 space-y-3.5 shadow-xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                    1. RAG Quality
                  </span>
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                </div>

                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-600">Recall@5</span>
                    <div className="text-right">
                      <span className={`font-mono text-xs ${getScoreColor(activeRun.rag_quality.recall_at_5)}`}>
                        {typeof activeRun.rag_quality.recall_at_5 === "number"
                          ? `${(activeRun.rag_quality.recall_at_5 * 100).toFixed(1)}%`
                          : "N/A"}
                      </span>
                      {renderDelta(activeRun.rag_quality.recall_at_5, baselineRun?.rag_quality.recall_at_5)}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-600">MRR@5</span>
                    <div className="text-right">
                      <span className={`font-mono text-xs ${getScoreColor(activeRun.rag_quality.mrr_at_5)}`}>
                        {typeof activeRun.rag_quality.mrr_at_5 === "number"
                          ? activeRun.rag_quality.mrr_at_5.toFixed(3)
                          : "N/A"}
                      </span>
                      {renderDelta(activeRun.rag_quality.mrr_at_5, baselineRun?.rag_quality.mrr_at_5)}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-600">Faithfulness</span>
                    <div className="text-right">
                      <span className={`font-mono text-xs ${getScoreColor(activeRun.rag_quality.faithfulness)}`}>
                        {typeof activeRun.rag_quality.faithfulness === "number"
                          ? `${(activeRun.rag_quality.faithfulness * 100).toFixed(1)}%`
                          : "N/A"}
                      </span>
                      {renderDelta(activeRun.rag_quality.faithfulness, baselineRun?.rag_quality.faithfulness)}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-600">Answer Relevancy</span>
                    <div className="text-right">
                      <span className={`font-mono text-xs ${getScoreColor(activeRun.rag_quality.answer_relevancy)}`}>
                        {typeof activeRun.rag_quality.answer_relevancy === "number"
                          ? `${(activeRun.rag_quality.answer_relevancy * 100).toFixed(1)}%`
                          : "N/A"}
                      </span>
                      {renderDelta(activeRun.rag_quality.answer_relevancy, baselineRun?.rag_quality.answer_relevancy)}
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. PERFORMANCE */}
              <div className="rounded-2xl border border-slate-200/90 bg-white p-4.5 space-y-3.5 shadow-xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                    2. Performance (N={activeRun.performance.sample_count})
                  </span>
                  <Clock className="h-4 w-4 text-emerald-600" />
                </div>

                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-600">P50 Latency</span>
                    <span className="font-mono text-xs font-semibold text-slate-800">
                      {typeof activeRun.performance.p50_ms === "number" ? `${(activeRun.performance.p50_ms / 1000).toFixed(2)}s` : "N/A"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-600">P95 Latency</span>
                    <span className="font-mono text-xs font-semibold text-slate-800">
                      {typeof activeRun.performance.p95_ms === "number" ? `${(activeRun.performance.p95_ms / 1000).toFixed(2)}s` : "N/A"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-600">P99 Latency</span>
                    <span className="font-mono text-xs font-semibold text-slate-800">
                      {typeof activeRun.performance.p99_ms === "number" ? `${(activeRun.performance.p99_ms / 1000).toFixed(2)}s` : "N/A"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-600">Média Real</span>
                    <span className="font-mono text-xs text-slate-500">
                      {typeof activeRun.performance.mean_ms === "number" ? `${(activeRun.performance.mean_ms / 1000).toFixed(2)}s` : "N/A"}
                    </span>
                  </div>
                </div>
              </div>

              {/* 3. PIPELINE BREAKDOWN */}
              <div className="rounded-2xl border border-slate-200/90 bg-white p-4.5 space-y-3.5 shadow-xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                    3. Pipeline Breakdown
                  </span>
                  <Zap className="h-4 w-4 text-emerald-600" />
                </div>

                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-600">Retrieval Time</span>
                    <span className="font-mono text-xs font-semibold text-slate-800">
                      {typeof activeRun.pipeline.avg_retrieval_time_ms === "number"
                        ? `${activeRun.pipeline.avg_retrieval_time_ms.toFixed(1)} ms`
                        : "N/A"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-600">LLM Generation Time</span>
                    <span className="font-mono text-xs font-semibold text-slate-800">
                      {typeof activeRun.pipeline.avg_generation_time_ms === "number"
                        ? `${(activeRun.pipeline.avg_generation_time_ms / 1000).toFixed(2)} s`
                        : "N/A"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-600">Parsing Ingestão</span>
                    <span className="font-mono text-xs text-slate-500">
                      pypdfium2
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-600">Embedding Ingestão</span>
                    <span className="font-mono text-xs text-slate-500">
                      nomic (768d)
                    </span>
                  </div>
                </div>
              </div>

              {/* 4. RELIABILITY */}
              <div className="rounded-2xl border border-slate-200/90 bg-white p-4.5 space-y-3.5 shadow-xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                    4. Reliability
                  </span>
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                </div>

                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-600">Success Rate</span>
                    <span className={`font-mono text-xs ${getScoreColor(activeRun.reliability.success_rate)}`}>
                      {typeof activeRun.reliability.success_rate === "number"
                        ? `${(activeRun.reliability.success_rate * 100).toFixed(1)}%`
                        : "N/A"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-600">Error Rate</span>
                    <span className="font-mono text-xs text-slate-500">
                      {typeof activeRun.reliability.error_rate === "number"
                        ? `${(activeRun.reliability.error_rate * 100).toFixed(1)}%`
                        : "N/A"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-600">Empty Retrieval Rate</span>
                    <span className="font-mono text-xs text-slate-500">
                      {typeof activeRun.reliability.empty_retrieval_rate === "number"
                        ? `${(activeRun.reliability.empty_retrieval_rate * 100).toFixed(1)}%`
                        : "N/A"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] font-sans text-slate-400">
                    <span>{activeRun.reliability.successful_queries} / {activeRun.reliability.total_queries} queries</span>
                    <span>{activeRun.reliability.failed_queries} falhas</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Traces Table */}
            <section className="rounded-2xl border border-slate-200/90 bg-white overflow-hidden space-y-0 shadow-xs">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-800">
                    Query Traces & Avaliação por Amostra
                  </h2>
                  <span className="text-xs font-mono text-slate-400">
                    ({activeRun.traces.length} Casos Auditados)
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-sans">
                  <thead className="border-b border-slate-100 bg-slate-50/80 text-[11px] font-sans uppercase text-slate-500 font-semibold">
                    <tr>
                      <th className="py-3 px-4">ID</th>
                      <th className="py-3 px-4">Pergunta</th>
                      <th className="py-3 px-4 text-center">Recall@5</th>
                      <th className="py-3 px-4 text-center">MRR@5</th>
                      <th className="py-3 px-4 text-center">Faithfulness</th>
                      <th className="py-3 px-4 text-center">Relevancy</th>
                      <th className="py-3 px-4 text-right">Latência</th>
                      <th className="py-3 px-4 text-center">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-xs">
                    {activeRun.traces.map((trace) => (
                      <tr key={trace.query_id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4 font-semibold text-slate-500">
                          {trace.query_id}
                        </td>
                        <td className="py-3 px-4 font-sans text-xs text-slate-800 max-w-[280px] truncate">
                          {trace.question}
                        </td>
                        <td className={`py-3 px-4 text-center ${getScoreColor(trace.recall_at_5)}`}>
                          {(trace.recall_at_5 * 100).toFixed(0)}%
                        </td>
                        <td className={`py-3 px-4 text-center ${getScoreColor(trace.mrr_at_5)}`}>
                          {trace.mrr_at_5.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {typeof trace.faithfulness_score === "number" ? (
                            <span className={getScoreColor(trace.faithfulness_score)}>
                              {(trace.faithfulness_score * 100).toFixed(0)}%
                            </span>
                          ) : (
                            <span className="text-slate-400">N/A</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {typeof trace.answer_relevancy_score === "number" ? (
                            <span className={getScoreColor(trace.answer_relevancy_score)}>
                              {(trace.answer_relevancy_score * 100).toFixed(0)}%
                            </span>
                          ) : (
                            <span className="text-slate-400">N/A</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-500 font-sans">
                          {(trace.latency.total_latency_ms / 1000).toFixed(2)}s
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => setSelectedTrace(trace)}
                            className="inline-flex items-center gap-1 text-xs font-sans text-emerald-700 hover:text-emerald-900 font-medium hover:underline cursor-pointer"
                          >
                            Inspecionar
                            <ChevronRight className="h-3 w-3" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </main>

      {/* Trace Inspection Modal */}
      {selectedTrace && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-100">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-mono uppercase text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 rounded-full font-semibold">
                  Trace #{selectedTrace.query_id}
                </span>
                <h3 className="text-sm font-semibold text-slate-800 mt-1.5">
                  {selectedTrace.question}
                </h3>
              </div>
              <button
                onClick={() => setSelectedTrace(null)}
                className="rounded-lg p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs font-sans">
              <div>
                <span className="text-xs font-semibold text-slate-700">
                  Resposta Gerada pelo Modelo ({selectedTrace.model_used}):
                </span>
                <div className="mt-1 rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-slate-800 font-serif leading-relaxed">
                  {selectedTrace.generated_answer || (
                    <span className="text-red-600 font-mono">
                      [FALHA NA EXECUÇÃO]: {selectedTrace.error_message || "Erro desconhecido"}
                    </span>
                  )}
                </div>
              </div>

              {selectedTrace.expected_answer && (
                <div>
                  <span className="text-xs font-semibold text-slate-700">
                    Resposta Esperada (Ground Truth):
                  </span>
                  <div className="mt-1 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 text-slate-600 font-serif leading-relaxed">
                    {selectedTrace.expected_answer}
                  </div>
                </div>
              )}

              <div>
                <span className="text-xs font-semibold text-slate-700">
                  Evidências Recuperadas ({selectedTrace.retrieved_chunk_count} Chunks):
                </span>
                <div className="mt-1.5 space-y-2">
                  {selectedTrace.retrieved_snippets.length > 0 ? (
                    selectedTrace.retrieved_snippets.map((snippet, idx) => (
                      <div key={idx} className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 text-xs font-serif text-emerald-950 leading-relaxed shadow-2xs">
                        "{snippet}"
                      </div>
                    ))
                  ) : (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-sans text-slate-500">
                      Nenhuma evidência recuperada (Consulta Adversarial / Fora de Escopo).
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs font-mono text-slate-500">
                <span>Retrieval: {selectedTrace.latency.retrieval_latency_ms}ms</span>
                <span>Geração: {selectedTrace.latency.llm_generation_latency_ms}ms</span>
                <span>Total: {selectedTrace.latency.total_latency_ms}ms</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
