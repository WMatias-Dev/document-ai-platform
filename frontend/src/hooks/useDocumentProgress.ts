"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { API_BASE_URL } from "@/lib/api-client";

export type IngestionPhase =
  | "idle"
  | "queued"
  | "parsing"
  | "chunking"
  | "embedding"
  | "ready"
  | "error";

export interface ProgressEventPayload {
  document_id: string;
  status: IngestionPhase | string;
  progress: number;
  message: string;
}

interface UseDocumentProgressOptions {
  documentId: string | null;
  onComplete?: (data: ProgressEventPayload) => void;
  onError?: (errorMsg: string) => void;
  enabled?: boolean;
}

export function useDocumentProgress({
  documentId,
  onComplete,
  onError,
  enabled = true,
}: UseDocumentProgressOptions) {
  const [progress, setProgress] = useState<ProgressEventPayload | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onCompleteRef = useRef(onComplete);
  const onErrorRef = useRef(onError);
  onCompleteRef.current = onComplete;
  onErrorRef.current = onError;

  const reset = useCallback(() => {
    setProgress(null);
    setIsConnected(false);
    setError(null);
  }, []);

  useEffect(() => {
    if (!documentId || !enabled) {
      reset();
      return;
    }

    const token =
      (typeof window !== "undefined"
        ? localStorage.getItem("doc_ai_token")
        : "") || "";

    const controller = new AbortController();
    let isAborted = false;

    async function startStream() {
      try {
        setIsConnected(true);
        setError(null);

        const url = `${API_BASE_URL}/documents/${documentId}/progress${
          token ? `?token=${encodeURIComponent(token)}` : ""
        }`;

        const response = await fetch(url, {
          headers: {
            Accept: "text/event-stream",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Falha no stream de ingestão: HTTP ${response.status}`);
        }

        if (!response.body) {
          throw new Error("Stream de eventos indisponível.");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = "";

        while (!isAborted) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith(":")) continue;

            if (trimmed.startsWith("data:")) {
              const dataStr = trimmed.slice(5).trim();
              try {
                const parsed: ProgressEventPayload = JSON.parse(dataStr);
                setProgress(parsed);

                if (parsed.status === "ready" || parsed.status === "completed") {
                  onCompleteRef.current?.(parsed);
                } else if (parsed.status === "error") {
                  setError(parsed.message || "Erro no processamento.");
                  onErrorRef.current?.(parsed.message || "Erro no processamento.");
                }
              } catch {
                // Linha ping de heartbeat ou formato irregular ignorado
              }
            }
          }
        }
      } catch (err: any) {
        if (err.name !== "AbortError") {
          const errMsg = err.message || "Falha na conexão de progresso em tempo real.";
          setError(errMsg);
          onErrorRef.current?.(errMsg);
        }
      } finally {
        setIsConnected(false);
      }
    }

    startStream();

    return () => {
      isAborted = true;
      controller.abort();
    };
  }, [documentId, enabled, reset]);

  return {
    progress,
    isConnected,
    error,
    reset,
  };
}
