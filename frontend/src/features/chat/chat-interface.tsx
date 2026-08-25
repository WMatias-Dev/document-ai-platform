"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";
import { DocumentItem, ChatResponse } from "@/types/api";
import { useChatStore } from "@/stores/useChatStore";
import { CitationSheet } from "./citation-sheet";
import {
  Send,
  Loader2,
  Sparkles,
  Bot,
  User as UserIcon,
  FileText,
  Filter,
  Trash2,
  Layers,
} from "lucide-react";

export function ChatInterface() {
  const {
    messages,
    addMessage,
    clearMessages,
    selectedDocumentId,
    setSelectedDocumentId,
    openCitation,
  } = useChatStore();

  const [inputMessage, setInputMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 1. Carrega os documentos disponíveis para o filtro de contexto
  const { data: documents = [] } = useQuery<DocumentItem[]>({
    queryKey: ["documents"],
    queryFn: async () => {
      const res = await apiClient.get("/documents/");
      return res.data;
    },
  });

  const completedDocs = documents.filter((d) => d.status === "COMPLETED");

  // Scroll automático para a última mensagem
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 2. Mutação de Pergunta RAG
  const chatMutation = useMutation({
    mutationFn: async (messageText: string) => {
      // Monta histórico de contexto simples para o backend
      const historyPayload = messages.slice(-6).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await apiClient.post<ChatResponse>("/chat/", {
        message: messageText,
        document_id: selectedDocumentId || null,
        history: historyPayload,
        max_chunks: 5,
      });

      return res.data;
    },
    onSuccess: (data) => {
      addMessage({
        role: "assistant",
        content: data.answer,
        citations: data.citations,
        model: data.model,
      });
    },
    onError: (err: any) => {
      const msg = err.response?.data?.detail || "Erro ao consultar o assistente.";
      toast.error("Falha na resposta", { description: msg });
      addMessage({
        role: "assistant",
        content:
          "Desculpe, ocorreu um erro ao processar sua pergunta com o modelo de inteligência artificial. Verifique se o backend está ativo.",
      });
    },
  });

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || chatMutation.isPending) return;

    const userText = inputMessage.trim();
    setInputMessage("");

    // Adiciona a mensagem do usuário na tela
    addMessage({
      role: "user",
      content: userText,
    });

    // Dispara a mutação para o backend
    chatMutation.mutate(userText);
  };

  const selectedDocTitle =
    completedDocs.find((d) => d.id === selectedDocumentId)?.title ||
    "Base Completa de Documentos";

  return (
    <div className="flex h-[calc(100vh-8.5rem)] flex-col rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-xl shadow-2xl overflow-hidden">
      {/* Chat Top Header & Context Selector */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 bg-slate-950/60 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 shadow-md shadow-blue-500/20 text-white">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-white">
                Chat Inteligente RAG
              </h2>
              <span className="rounded-md bg-blue-500/10 px-2 py-0.5 text-xs font-semibold text-blue-400 border border-blue-500/20 flex items-center gap-1">
                <Sparkles className="h-3 w-3" /> Gemini 3.7 Flash
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Perguntas respondidas com base estrita nos seus PDFs indexados
            </p>
          </div>
        </div>

        {/* Filter and Clear Actions */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-xl bg-slate-900 border border-slate-800 px-3 py-1.5 text-xs">
            <Filter className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <span className="text-slate-400 hidden sm:inline">Contexto:</span>
            <select
              value={selectedDocumentId || ""}
              onChange={(e) =>
                setSelectedDocumentId(e.target.value ? e.target.value : null)
              }
              className="bg-transparent text-white focus:outline-none cursor-pointer max-w-[200px] truncate"
            >
              <option value="" className="bg-slate-900 text-white">
                Todos os Documentos
              </option>
              {completedDocs.map((doc) => (
                <option
                  key={doc.id}
                  value={doc.id}
                  className="bg-slate-900 text-white"
                >
                  {doc.title}
                </option>
              ))}
            </select>
          </div>

          {messages.length > 0 && (
            <button
              onClick={clearMessages}
              title="Limpar histórico de conversa"
              className="p-2 rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-500/10 border border-slate-800 hover:border-red-500/20 transition-colors cursor-pointer"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Messages Feed Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center max-w-md mx-auto">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 mb-4 shadow-inner">
              <Sparkles className="h-7 w-7" />
            </div>
            <h3 className="text-base font-semibold text-white">
              Como posso ajudar você hoje?
            </h3>
            <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
              Faça perguntas sobre os documentos enviados. O sistema busca os
              trechos mais relevantes via embeddings de 768 dimensões e responde
              com citações comprovadas.
            </p>

            <div className="grid grid-cols-1 gap-2 mt-6 w-full text-left">
              <button
                onClick={() =>
                  setInputMessage(
                    "Faça um resumo dos principais pontos do documento."
                  )
                }
                className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-xs text-slate-300 hover:border-blue-500/40 hover:bg-slate-900 transition-colors cursor-pointer"
              >
                💡 "Faça um resumo dos principais pontos do documento."
              </button>
              <button
                onClick={() =>
                  setInputMessage(
                    "Quais são as cláusulas de rescisão ou prazos estabelecidos?"
                  )
                }
                className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-xs text-slate-300 hover:border-blue-500/40 hover:bg-slate-900 transition-colors cursor-pointer"
              >
                🔍 "Quais são as cláusulas de rescisão ou prazos estabelecidos?"
              </button>
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            const isUser = msg.role === "user";

            return (
              <div
                key={msg.id}
                className={`flex gap-3.5 ${
                  isUser ? "justify-end" : "justify-start"
                }`}
              >
                {!isUser && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white shadow-md shadow-blue-600/20 mt-1">
                    <Bot className="h-4 w-4" />
                  </div>
                )}

                <div
                  className={`max-w-[82%] rounded-2xl p-4 shadow-lg ${
                    isUser
                      ? "bg-blue-600 text-white rounded-br-none"
                      : "bg-slate-950/80 border border-slate-800 text-slate-200 rounded-bl-none"
                  }`}
                >
                  {isUser ? (
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      {msg.content}
                    </p>
                  ) : (
                    <div className="prose prose-invert prose-sm max-w-none text-slate-200 leading-relaxed">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  )}

                  {/* Citations Badges under Assistant Answer */}
                  {!isUser && msg.citations && msg.citations.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-2">
                      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5 text-blue-400" /> Fontes
                        Consultadas ({msg.citations.length}):
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {msg.citations.map((cite, index) => (
                          <button
                            key={cite.chunk_id || index}
                            onClick={() => openCitation(cite)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/70 px-2.5 py-1 text-[11px] text-slate-300 hover:text-white transition-colors cursor-pointer group"
                          >
                            <span className="truncate max-w-[140px] font-medium">
                              {cite.document_title}
                            </span>
                            <span className="rounded bg-blue-500/20 text-blue-400 px-1 py-0.2 font-mono text-[10px]">
                              {(cite.similarity_score * 100).toFixed(0)}%
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {isUser && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-slate-300 border border-slate-700 mt-1">
                    <UserIcon className="h-4 w-4" />
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* Typing / Processing Indicator */}
        {chatMutation.isPending && (
          <div className="flex gap-3.5 justify-start">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white shadow-md shadow-blue-600/20 mt-1">
              <Bot className="h-4 w-4" />
            </div>
            <div className="rounded-2xl rounded-bl-none border border-slate-800 bg-slate-950/80 p-4 text-slate-300 flex items-center gap-3">
              <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
              <span className="text-xs text-slate-400">
                Consultando base vetorial e gerando resposta com Gemini 3.7...
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Form Box */}
      <div className="border-t border-slate-800 bg-slate-950/80 p-4">
        <form onSubmit={handleSendMessage} className="flex gap-3 items-center">
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            disabled={chatMutation.isPending}
            placeholder={`Pergunte algo sobre ${selectedDocTitle}...`}
            className="flex-1 rounded-xl border border-slate-800 bg-slate-900/90 px-4 py-3 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors disabled:opacity-50"
          />

          <button
            type="submit"
            disabled={chatMutation.isPending || !inputMessage.trim()}
            className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shrink-0"
          >
            {chatMutation.isPending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </button>
        </form>
      </div>

      {/* Citation Details Sheet Drawer */}
      <CitationSheet />
    </div>
  );
}
