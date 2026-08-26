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
} from "lucide-react";

export function getScoreColor(score?: number | null): string {
  if (score === null || score === undefined) return "text-[#85888C]";
  if (score >= 0.9) return "text-[#10B981]"; // Excelente (>= 90%)
  if (score >= 0.75) return "text-[#F59E0B]"; // Alerta (75% - 89%)
  return "text-[#EF4444] font-semibold"; // Crítico (< 75%)
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
        <span className="inline-flex items-center gap-0.5 text-[10px] font-mono text-[#85888C]">
          <Minus className="h-2.5 w-2.5" /> 0.0%
        </span>
      );
    }

    const isPositive = diff > 0;
    const isGood = isHigherBetter ? isPositive : !isPositive;
    const colorClass = isGood ? "text-[#10B981]" : "text-[#EF4444]";
    const Icon = isPositive ? TrendingUp : TrendingDown;

    return (
      <span className={`inline-flex items-center gap-0.5 text-[10px] font-mono ${colorClass}`}>
        <Icon className="h-2.5 w-2.5" />
        {isPositive ? "+" : ""}{(diff * 100).toFixed(1)}% vs base
      </span>
    );
  };

  // Quality Gates Logic Rigorosa
  const qgRecall = typeof activeRun?.rag_quality.recall_at_5 === "number" ? activeRun.rag_quality.recall_at_5 >= 0.9 : null;
  const qgMrr = typeof activeRun?.rag_quality.mrr_at_5 === "number" ? activeRun.rag_quality.mrr_at_5 >= 0.85 : null;
  const qgFaith = typeof activeRun?.rag_quality.faithfulness === "number" ? activeRun.rag_quality.faithfulness >= 0.9 : null;
  const qgRel = typeof activeRun?.rag_quality.answer_relevancy === "number" ? activeRun.rag_quality.answer_relevancy >= 0.95 : null;
  const qgSuccess = typeof activeRun?.reliability.success_rate === "number" ? activeRun.reliability.success_rate >= 0.95 : null;

  // Status Geral Consolidado
  const isOverallApproved =
    qgRecall === true &&
    qgMrr === true &&
    qgFaith === true &&
    qgRel === true &&
    qgSuccess === true;

  return (
    <div className="min-h-screen bg-[#0C0D0E] text-[#E3E3E3] flex flex-col selection:bg-[#D97706]/20 selection:text-[#FDE68A]">
      {/* Top Header */}
      <header className="h-12 border-b border-[#242628] bg-[#0C0D0E] px-6 flex items-center justify-between shrink-0 select-none">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex h-7 w-7 items-center justify-center rounded bg-[#161719] border border-[#242628] text-[#85888C] hover:text-[#E3E3E3] transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </Link>
          <span className="h-3 w-[1px] bg-[#242628]" />
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-[#D97706]" />
            <h1 className="text-xs font-sans font-medium text-[#E3E3E3]">
              System Evaluation & Observability
            </h1>
            <span className="text-[10px] font-mono text-[#85888C] bg-[#161719] border border-[#242628] px-2 py-0.5 rounded">
              Ambiente de Métricas Reais
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Seletor de Execução */}
          <select
            value={currentRunId || ""}
            onChange={(e) => setSelectedRunId(e.target.value)}
            disabled={runs.length === 0}
            className="rounded border border-[#242628] bg-[#161719] px-2 py-1 text-xs font-mono text-[#E3E3E3] focus:outline-none cursor-pointer max-w-[220px] truncate"
          >
            {runs.map((r) => (
              <option key={r.run_id} value={r.run_id} className="bg-[#161719] text-[#E3E3E3]">
                {r.is_baseline ? "⭐ [BASELINE] " : ""}{r.name}
              </option>
            ))}
          </select>

          {/* Botão de Disparo */}
          <button
            onClick={() => runMutation.mutate()}
            disabled={runMutation.isPending}
            className="inline-flex items-center gap-1.5 rounded bg-[#E3E3E3] hover:bg-white text-[#0C0D0E] font-medium px-3 py-1 text-xs transition-all cursor-pointer disabled:opacity-50"
          >
            {runMutation.isPending ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Avaliando...</span>
              </>
            ) : (
              <>
                <Play className="h-3 w-3 fill-current" />
                <span>Nova Avaliação</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 sm:px-10 py-6 space-y-6">
        {isLoadingRuns || isLoadingDetail ? (
          <div className="flex items-center justify-center p-16 text-[#85888C] text-xs font-mono gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-[#85888C]" />
            <span>Carregando dados de telemetria e métricas...</span>
          </div>
        ) : !activeRun ? (
          <div className="p-8 text-center rounded border border-[#242628] bg-[#161719] space-y-3 max-w-md mx-auto mt-12">
            <AlertTriangle className="h-5 w-5 text-[#F59E0B] mx-auto" />
            <h3 className="text-xs font-medium text-[#E3E3E3]">
              Nenhuma Execução Encontrada
            </h3>
            <p className="text-[11px] font-mono text-[#85888C]">
              Execute a primeira bateria de testes sobre o dataset canônico.
            </p>
            <button
              onClick={() => runMutation.mutate()}
              disabled={runMutation.isPending}
              className="inline-flex items-center gap-1.5 rounded bg-[#E3E3E3] text-[#0C0D0E] font-medium px-3.5 py-1.5 text-xs transition-all cursor-pointer"
            >
              <Play className="h-3 w-3 fill-current" />
              Executar Baseline
            </button>
          </div>
        ) : (
          <>
            {/* Execução Metadata Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded border border-[#242628] bg-[#161719] text-[11px] font-mono">
              <div className="flex items-center gap-3">
                <span className="text-[#E3E3E3] font-medium">
                  {activeRun.name}
                </span>
                {activeRun.is_baseline && (
                  <span className="text-[10px] bg-[#D97706]/10 text-[#D97706] border border-[#D97706]/30 px-1.5 py-0.2 rounded font-mono">
                    Baseline Oficial
                  </span>
                )}
                <span className="text-[#55585D]">|</span>
                <span className="text-[#85888C]">Dataset: {activeRun.dataset_version} ({activeRun.dataset_size} queries)</span>
              </div>
              <div className="flex items-center gap-3 text-[#85888C]">
                <span>Modelo: <strong className="text-[#E3E3E3]">{activeRun.model_name}</strong></span>
                <span>Embedding: <strong className="text-[#E3E3E3]">{activeRun.embedding_model}</strong></span>
                <span>Data: {new Date(activeRun.timestamp).toLocaleString("pt-BR")}</span>
              </div>
            </div>

            {/* Quality Gates Overview Bar */}
            <div className="rounded border border-[#242628] bg-[#161719] p-3.5 space-y-3">
              <div className="flex items-center justify-between border-b border-[#242628] pb-2.5">
                <div className="flex items-center gap-2">
                  {isOverallApproved ? (
                    <ShieldCheck className="h-4 w-4 text-[#10B981]" />
                  ) : (
                    <ShieldAlert className="h-4 w-4 text-[#EF4444]" />
                  )}
                  <span className="text-xs font-mono uppercase tracking-wider text-[#E3E3E3] font-medium">
                    Quality Gates de Produção
                  </span>
                </div>
                <div>
                  {isOverallApproved ? (
                    <span className="text-[11px] font-mono text-[#10B981] bg-[#10B981]/10 border border-[#10B981]/30 px-2 py-0.5 rounded flex items-center gap-1">
                      <Check className="h-3 w-3" /> Status: Aprovado na Homologação
                    </span>
                  ) : (
                    <span className="text-[11px] font-mono text-[#EF4444] bg-[#EF4444]/10 border border-[#EF4444]/30 px-2 py-0.5 rounded flex items-center gap-1 font-semibold">
                      <XCircle className="h-3 w-3" /> Status: Reprovado nos Critérios
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                <div className="flex items-center justify-between p-2 rounded bg-[#0C0D0E] border border-[#242628]">
                  <span className="text-[11px] text-[#85888C]">Recall@5 (≥90%)</span>
                  {qgRecall === true ? (
                    <span className="flex items-center gap-1 text-[10px] font-mono text-[#10B981] bg-[#10B981]/10 px-1.5 py-0.5 rounded">
                      <Check className="h-2.5 w-2.5" /> Pass
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] font-mono text-[#EF4444] bg-[#EF4444]/10 px-1.5 py-0.5 rounded font-semibold">
                      <XCircle className="h-2.5 w-2.5" /> Fail
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between p-2 rounded bg-[#0C0D0E] border border-[#242628]">
                  <span className="text-[11px] text-[#85888C]">MRR@5 (≥0.85)</span>
                  {qgMrr === true ? (
                    <span className="flex items-center gap-1 text-[10px] font-mono text-[#10B981] bg-[#10B981]/10 px-1.5 py-0.5 rounded">
                      <Check className="h-2.5 w-2.5" /> Pass
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] font-mono text-[#EF4444] bg-[#EF4444]/10 px-1.5 py-0.5 rounded font-semibold">
                      <XCircle className="h-2.5 w-2.5" /> Fail
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between p-2 rounded bg-[#0C0D0E] border border-[#242628]">
                  <span className="text-[11px] text-[#85888C]">Faithfulness (≥90%)</span>
                  {qgFaith === true ? (
                    <span className="flex items-center gap-1 text-[10px] font-mono text-[#10B981] bg-[#10B981]/10 px-1.5 py-0.5 rounded">
                      <Check className="h-2.5 w-2.5" /> Pass
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] font-mono text-[#EF4444] bg-[#EF4444]/10 px-1.5 py-0.5 rounded font-semibold">
                      <XCircle className="h-2.5 w-2.5" /> Fail
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between p-2 rounded bg-[#0C0D0E] border border-[#242628]">
                  <span className="text-[11px] text-[#85888C]">Relevancy (≥95%)</span>
                  {qgRel === true ? (
                    <span className="flex items-center gap-1 text-[10px] font-mono text-[#10B981] bg-[#10B981]/10 px-1.5 py-0.5 rounded">
                      <Check className="h-2.5 w-2.5" /> Pass
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] font-mono text-[#EF4444] bg-[#EF4444]/10 px-1.5 py-0.5 rounded font-semibold">
                      <XCircle className="h-2.5 w-2.5" /> Fail
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between p-2 rounded bg-[#0C0D0E] border border-[#242628]">
                  <span className="text-[11px] text-[#85888C]">Success Rate (≥95%)</span>
                  {qgSuccess === true ? (
                    <span className="flex items-center gap-1 text-[10px] font-mono text-[#10B981] bg-[#10B981]/10 px-1.5 py-0.5 rounded">
                      <Check className="h-2.5 w-2.5" /> Pass
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] font-mono text-[#EF4444] bg-[#EF4444]/10 px-1.5 py-0.5 rounded font-semibold">
                      <XCircle className="h-2.5 w-2.5" /> Fail
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Metric Groups Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              {/* 1. RAG QUALITY */}
              <div className="rounded border border-[#242628] bg-[#161719] p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-[#242628] pb-2">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-[#85888C]">
                    1. RAG Quality
                  </span>
                  <ShieldCheck className="h-3.5 w-3.5 text-[#10B981]" />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#85888C]">Recall@5</span>
                    <div className="text-right">
                      <span className={`font-mono text-xs font-semibold ${getScoreColor(activeRun.rag_quality.recall_at_5)}`}>
                        {typeof activeRun.rag_quality.recall_at_5 === "number"
                          ? `${(activeRun.rag_quality.recall_at_5 * 100).toFixed(1)}%`
                          : "N/A"}
                      </span>
                      {renderDelta(activeRun.rag_quality.recall_at_5, baselineRun?.rag_quality.recall_at_5)}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#85888C]">MRR@5</span>
                    <div className="text-right">
                      <span className={`font-mono text-xs font-semibold ${getScoreColor(activeRun.rag_quality.mrr_at_5)}`}>
                        {typeof activeRun.rag_quality.mrr_at_5 === "number"
                          ? activeRun.rag_quality.mrr_at_5.toFixed(3)
                          : "N/A"}
                      </span>
                      {renderDelta(activeRun.rag_quality.mrr_at_5, baselineRun?.rag_quality.mrr_at_5)}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#85888C]">Faithfulness</span>
                    <div className="text-right">
                      <span className={`font-mono text-xs font-semibold ${getScoreColor(activeRun.rag_quality.faithfulness)}`}>
                        {typeof activeRun.rag_quality.faithfulness === "number"
                          ? `${(activeRun.rag_quality.faithfulness * 100).toFixed(1)}%`
                          : "N/A"}
                      </span>
                      {renderDelta(activeRun.rag_quality.faithfulness, baselineRun?.rag_quality.faithfulness)}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#85888C]">Answer Relevancy</span>
                    <div className="text-right">
                      <span className={`font-mono text-xs font-semibold ${getScoreColor(activeRun.rag_quality.answer_relevancy)}`}>
                        {typeof activeRun.rag_quality.answer_relevancy === "number"
                          ? `${(activeRun.rag_quality.answer_relevancy * 100).toFixed(1)}%`
                          : "N/A"}
                      </span>
                      {renderDelta(activeRun.rag_quality.answer_relevancy, baselineRun?.rag_quality.answer_relevancy)}
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. PERFORMANCE (Percentis) */}
              <div className="rounded border border-[#242628] bg-[#161719] p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-[#242628] pb-2">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-[#85888C]">
                    2. Performance (N={activeRun.performance.sample_count})
                  </span>
                  <Clock className="h-3.5 w-3.5 text-[#3B82F6]" />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#85888C]">P50 Latency</span>
                    <span className="font-mono text-xs font-semibold text-[#E3E3E3]">
                      {typeof activeRun.performance.p50_ms === "number" ? `${(activeRun.performance.p50_ms / 1000).toFixed(2)}s` : "N/A"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#85888C]">P95 Latency</span>
                    <span className="font-mono text-xs font-semibold text-[#E3E3E3]">
                      {typeof activeRun.performance.p95_ms === "number" ? `${(activeRun.performance.p95_ms / 1000).toFixed(2)}s` : "N/A"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#85888C]">P99 Latency</span>
                    <span className="font-mono text-xs font-semibold text-[#E3E3E3]">
                      {typeof activeRun.performance.p99_ms === "number" ? `${(activeRun.performance.p99_ms / 1000).toFixed(2)}s` : "N/A"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#85888C]">Média Real</span>
                    <span className="font-mono text-xs text-[#85888C]">
                      {typeof activeRun.performance.mean_ms === "number" ? `${(activeRun.performance.mean_ms / 1000).toFixed(2)}s` : "N/A"}
                    </span>
                  </div>
                </div>
              </div>

              {/* 3. PIPELINE LATENCIES */}
              <div className="rounded border border-[#242628] bg-[#161719] p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-[#242628] pb-2">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-[#85888C]">
                    3. Pipeline Breakdown
                  </span>
                  <Zap className="h-3.5 w-3.5 text-[#F59E0B]" />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#85888C]">Retrieval Time</span>
                    <span className="font-mono text-xs text-[#E3E3E3]">
                      {typeof activeRun.pipeline.avg_retrieval_time_ms === "number"
                        ? `${activeRun.pipeline.avg_retrieval_time_ms.toFixed(1)} ms`
                        : "N/A"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#85888C]">LLM Generation Time</span>
                    <span className="font-mono text-xs text-[#E3E3E3]">
                      {typeof activeRun.pipeline.avg_generation_time_ms === "number"
                        ? `${(activeRun.pipeline.avg_generation_time_ms / 1000).toFixed(2)} s`
                        : "N/A"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#85888C]">Parsing Ingestão</span>
                    <span className="font-mono text-xs text-[#85888C]">
                      pypdfium2
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#85888C]">Embedding Ingestão</span>
                    <span className="font-mono text-xs text-[#85888C]">
                      nomic (768d)
                    </span>
                  </div>
                </div>
              </div>

              {/* 4. RELIABILITY */}
              <div className="rounded border border-[#242628] bg-[#161719] p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-[#242628] pb-2">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-[#85888C]">
                    4. Reliability
                  </span>
                  <CheckCircle2 className="h-3.5 w-3.5 text-[#10B981]" />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#85888C]">Success Rate</span>
                    <span className={`font-mono text-xs font-semibold ${getScoreColor(activeRun.reliability.success_rate)}`}>
                      {typeof activeRun.reliability.success_rate === "number"
                        ? `${(activeRun.reliability.success_rate * 100).toFixed(1)}%`
                        : "N/A"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#85888C]">Error Rate</span>
                    <span className="font-mono text-xs text-[#85888C]">
                      {typeof activeRun.reliability.error_rate === "number"
                        ? `${(activeRun.reliability.error_rate * 100).toFixed(1)}%`
                        : "N/A"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#85888C]">Empty Retrieval Rate</span>
                    <span className="font-mono text-xs text-[#85888C]">
                      {typeof activeRun.reliability.empty_retrieval_rate === "number"
                        ? `${(activeRun.reliability.empty_retrieval_rate * 100).toFixed(1)}%`
                        : "N/A"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[10px] font-mono text-[#55585D]">
                    <span>{activeRun.reliability.successful_queries} / {activeRun.reliability.total_queries} queries</span>
                    <span>{activeRun.reliability.failed_queries} falhas</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Traces Table (Densidade Técnica e Rastreabilidade) */}
            <section className="rounded border border-[#242628] bg-[#161719] overflow-hidden space-y-0">
              <div className="p-3 border-b border-[#242628] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h2 className="text-xs font-mono font-medium uppercase tracking-wider text-[#85888C]">
                    Query Traces & Avaliação por Amostra
                  </h2>
                  <span className="text-[10px] font-mono text-[#55585D]">
                    [{activeRun.traces.length} Casos Auditados]
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-sans">
                  <thead className="border-b border-[#242628] bg-[#0C0D0E] text-[10px] font-mono uppercase text-[#85888C]">
                    <tr>
                      <th className="py-2.5 px-3">ID</th>
                      <th className="py-2.5 px-3">Pergunta</th>
                      <th className="py-2.5 px-3 text-center">Recall@5</th>
                      <th className="py-2.5 px-3 text-center">MRR@5</th>
                      <th className="py-2.5 px-3 text-center">Faithfulness</th>
                      <th className="py-2.5 px-3 text-center">Relevancy</th>
                      <th className="py-2.5 px-3 text-right">Latência</th>
                      <th className="py-2.5 px-3 text-center">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#242628]/60 font-mono text-[11px]">
                    {activeRun.traces.map((trace) => (
                      <tr key={trace.query_id} className="hover:bg-[#202225] transition-colors">
                        <td className="py-2.5 px-3 font-semibold text-[#85888C]">
                          {trace.query_id}
                        </td>
                        <td className="py-2.5 px-3 font-sans text-xs text-[#E3E3E3] max-w-[280px] truncate">
                          {trace.question}
                        </td>
                        <td className={`py-2.5 px-3 text-center ${getScoreColor(trace.recall_at_5)}`}>
                          {(trace.recall_at_5 * 100).toFixed(0)}%
                        </td>
                        <td className={`py-2.5 px-3 text-center ${getScoreColor(trace.mrr_at_5)}`}>
                          {trace.mrr_at_5.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {typeof trace.faithfulness_score === "number" ? (
                            <span className={getScoreColor(trace.faithfulness_score)}>
                              {(trace.faithfulness_score * 100).toFixed(0)}%
                            </span>
                          ) : (
                            <span className="text-[#85888C]">N/A</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {typeof trace.answer_relevancy_score === "number" ? (
                            <span className={getScoreColor(trace.answer_relevancy_score)}>
                              {(trace.answer_relevancy_score * 100).toFixed(0)}%
                            </span>
                          ) : (
                            <span className="text-[#85888C]">N/A</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right text-[#85888C]">
                          {(trace.latency.total_latency_ms / 1000).toFixed(2)}s
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <button
                            onClick={() => setSelectedTrace(trace)}
                            className="inline-flex items-center gap-1 text-[10px] text-[#85888C] hover:text-[#E3E3E3] hover:underline cursor-pointer"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-100">
          <div className="w-full max-w-2xl rounded border border-[#242628] bg-[#161719] p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#242628] pb-3">
              <div>
                <span className="text-[10px] font-mono uppercase text-[#85888C]">
                  Trace Audit #{selectedTrace.query_id}
                </span>
                <h3 className="text-sm font-sans font-medium text-[#E3E3E3] mt-0.5">
                  {selectedTrace.question}
                </h3>
              </div>
              <button
                onClick={() => setSelectedTrace(null)}
                className="rounded p-1 text-[#85888C] hover:text-[#E3E3E3] hover:bg-[#242628] cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-[10px] font-mono uppercase text-[#85888C]">
                  Resposta Gerada pelo Modelo ({selectedTrace.model_used}):
                </span>
                <div className="mt-1 rounded border border-[#242628] bg-[#0C0D0E] p-3 text-[#E3E3E3] font-serif leading-relaxed">
                  {selectedTrace.generated_answer || (
                    <span className="text-[#EF4444] font-mono">
                      [FALHA NA EXECUÇÃO]: {selectedTrace.error_message || "Erro desconhecido"}
                    </span>
                  )}
                </div>
              </div>

              {selectedTrace.expected_answer && (
                <div>
                  <span className="text-[10px] font-mono uppercase text-[#85888C]">
                    Resposta Esperada (Ground Truth):
                  </span>
                  <div className="mt-1 rounded border border-[#242628] bg-[#0C0D0E] p-3 text-[#85888C] font-serif leading-relaxed">
                    {selectedTrace.expected_answer}
                  </div>
                </div>
              )}

              <div>
                <span className="text-[10px] font-mono uppercase text-[#85888C]">
                  Evidências Recuperadas ({selectedTrace.retrieved_chunk_count} Chunks):
                </span>
                <div className="mt-1 space-y-1.5">
                  {selectedTrace.retrieved_snippets.length > 0 ? (
                    selectedTrace.retrieved_snippets.map((snippet, idx) => (
                      <div key={idx} className="rounded border-l-2 border-l-[#D97706] border border-[#242628] bg-[#D97706]/10 p-2.5 text-[11px] font-serif text-[#FDE68A]">
                        "{snippet}"
                      </div>
                    ))
                  ) : (
                    <div className="rounded border border-[#242628] bg-[#0C0D0E] p-2 text-[11px] font-mono text-[#85888C]">
                      Nenhuma evidência recuperada (Consulta Adversarial / Fora de Escopo).
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-[#242628] text-[11px] font-mono text-[#85888C]">
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
