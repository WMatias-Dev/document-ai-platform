"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/stores/useAuthStore";
import { FileText, Lock, Mail, Loader2, Sparkles } from "lucide-react";

const loginSchema = z.object({
  email: z.string().email("Insira um e-mail válido"),
  password: z.string().min(6, "A senha deve ter pelo menos 6 caracteres"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormValues) => {
    setIsLoading(true);
    try {
      // 1. Login via OAuth2 Form Urlencoded
      const formData = new URLSearchParams();
      formData.append("username", data.email);
      formData.append("password", data.password);

      const loginRes = await apiClient.post("/auth/login", formData, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });

      const token = loginRes.data.access_token;

      // 2. Busca os dados do usuário autenticado (/auth/me)
      const userRes = await apiClient.get("/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      });

      setAuth(userRes.data, token);
      toast.success("Bem-vindo de volta!", {
        description: `Conectado como ${userRes.data.email}`,
      });

      router.push("/documents");
    } catch (err: any) {
      const msg =
        err.response?.data?.detail || "E-mail ou senha incorretos.";
      toast.error("Falha na autenticação", { description: msg });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#090d16] px-4 py-12">
      {/* Background Glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Card Header */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 shadow-xl shadow-blue-500/25 mb-4">
            <FileText className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Document AI Platform
          </h1>
          <p className="text-sm text-slate-400 mt-1.5 flex items-center gap-1.5">
            Busca Vetorial HNSW & RAG com <Sparkles className="h-3.5 w-3.5 text-blue-400" /> Gemini 3.7
          </p>
        </div>

        {/* Login Form Card */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8 backdrop-blur-xl shadow-2xl">
          <h2 className="text-lg font-semibold text-white mb-6">
            Entre na sua conta
          </h2>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                E-mail
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  {...register("email")}
                  type="email"
                  placeholder="exemplo@empresa.com"
                  className="w-full rounded-xl border border-slate-800 bg-slate-950/70 pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
                />
              </div>
              {errors.email && (
                <p className="text-xs text-red-400 mt-1">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Senha
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  {...register("password")}
                  type="password"
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-slate-800 bg-slate-950/70 pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
                />
              </div>
              {errors.password && (
                <p className="text-xs text-red-400 mt-1">
                  {errors.password.message}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Autenticando...
                </>
              ) : (
                "Entrar no Sistema"
              )}
            </button>
          </form>

          <div className="mt-6 text-center text-xs text-slate-400">
            Ainda não tem conta?{" "}
            <Link
              href="/register"
              className="text-blue-400 hover:text-blue-300 font-medium underline underline-offset-4"
            >
              Cadastre-se gratuitamente
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
