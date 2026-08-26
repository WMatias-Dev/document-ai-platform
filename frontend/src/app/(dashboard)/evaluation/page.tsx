import { EvaluationView } from "@/features/evaluation/evaluation-view";

export const metadata = {
  title: "System Evaluation — Document AI Platform",
  description: "Métricas reais de qualidade, performance e confiabilidade do RAG",
};

export default function EvaluationPage() {
  return <EvaluationView />;
}
