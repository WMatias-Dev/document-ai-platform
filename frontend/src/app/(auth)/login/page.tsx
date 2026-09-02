"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { apiClient, getErrorMessage } from "@/lib/api-client";
import { useAuthStore } from "@/stores/useAuthStore";
import { BookOpen, Lock, Mail, Loader2, ArrowRight } from "lucide-react";

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
      const formData = new URLSearchParams();
      formData.append("username", data.email);
      formData.append("password", data.password);

      const loginRes = await apiClient.post("/auth/login", formData, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });

      const token = loginRes.data.access_token;

      const userRes = await apiClient.get("/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      });

      setAuth(userRes.data, token);
      toast.success("Sessão iniciada com sucesso.", {
        description: `Conectado como ${userRes.data.email}`,
      });

      router.push("/");
    } catch (err: any) {
      const msg = getErrorMessage(
        err,
        "Credenciais inválidas. Verifique os dados."
      );
      toast.error("Falha na autenticação", { description: msg });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12 selection:bg-emerald-100 selection:text-emerald-800">
      <div className="w-full max-w-sm space-y-6">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center space-y-2.5">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 border border-emerald-200/80 text-emerald-600 shadow-sm">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-sans font-semibold text-slate-800 tracking-tight">
              Document AI Platform
            </h1>
            <p className="text-xs font-sans text-slate-500 mt-0.5">
              Ambiente de Pesquisa & Análise Inteligente
            </p>
          </div>
        </div>

        {/* Form Container */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-7 shadow-lg shadow-slate-200/50 space-y-5">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-sm font-semibold text-slate-800">
              Acesso à Plataforma
            </h2>
            <p className="text-xs font-sans text-slate-500 mt-0.5">
              Insira suas credenciais para acessar seus cadernos de pesquisa.
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label htmlFor="login-email-input" className="block text-xs font-medium text-slate-700 mb-1.5">
                E-mail Institucional
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  id="login-email-input"
                  {...register("email")}
                  type="email"
                  placeholder="seu.email@empresa.com"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-9 pr-3.5 py-2 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all font-sans"
                />
              </div>
              {errors.email && (
                <p className="text-[11px] font-sans text-red-500 mt-1">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="login-password-input" className="block text-xs font-medium text-slate-700 mb-1.5">
                Senha de Acesso
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  id="login-password-input"
                  {...register("password")}
                  type="password"
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-9 pr-3.5 py-2 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all font-sans"
                />
              </div>
              {errors.password && (
                <p className="text-[11px] font-sans text-red-500 mt-1">
                  {errors.password.message}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 text-xs font-medium transition-all shadow-sm hover:shadow-emerald-600/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-[0.98]"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Validando credenciais...</span>
                </>
              ) : (
                <>
                  <span>Entrar no Acervo</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </>
              )}
            </button>
          </form>

          <div className="pt-2 border-t border-slate-100 text-center text-xs font-sans text-slate-500">
            Ainda não possui credencial?{" "}
            <Link
              href="/register"
              className="text-emerald-700 hover:text-emerald-800 hover:underline font-semibold ml-0.5"
            >
              Criar conta
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
