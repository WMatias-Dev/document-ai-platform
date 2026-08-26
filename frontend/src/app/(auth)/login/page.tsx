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
      toast.success("Sessão iniciada com sucesso.", {
        description: `Conectado como ${userRes.data.email}`,
      });

      // Redireciona diretamente para a tela inicial (Catálogo de Cadernos)
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
    <div className="flex min-h-screen items-center justify-center bg-[#0C0D0E] px-4 py-12 selection:bg-[#D97706]/20 selection:text-[#FDE68A]">
      <div className="w-full max-w-sm space-y-6">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="flex h-9 w-9 items-center justify-center rounded bg-[#161719] border border-[#242628] text-[#E3E3E3]">
            <BookOpen className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-base font-sans font-medium text-[#E3E3E3] tracking-tight">
              Document AI Platform
            </h1>
            <p className="text-[11px] font-mono text-[#85888C] uppercase tracking-wider mt-0.5">
              Research Workspace
            </p>
          </div>
        </div>

        {/* Form Container */}
        <div className="rounded border border-[#242628] bg-[#161719] p-6 shadow-xl space-y-5">
          <div className="border-b border-[#242628] pb-3">
            <h2 className="text-xs font-mono font-medium uppercase tracking-wider text-[#E3E3E3]">
              Acesso ao Ambiente
            </h2>
            <p className="text-[11px] font-sans text-[#85888C] mt-0.5">
              Insira suas credenciais para acessar seus cadernos de pesquisa.
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3.5">
            <div>
              <label className="block text-[10px] font-mono uppercase tracking-wider text-[#85888C] mb-1">
                E-mail Institucional
              </label>
              <div className="relative">
                <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#55585D]" />
                <input
                  {...register("email")}
                  type="email"
                  placeholder="usuario@empresa.com"
                  className="w-full rounded border border-[#242628] bg-[#0C0D0E] pl-8 pr-3 py-1.5 text-xs text-[#E3E3E3] placeholder-[#55585D] focus:border-[#383B40] focus:outline-none transition-colors font-sans"
                />
              </div>
              {errors.email && (
                <p className="text-[10px] font-mono text-[#EF4444] mt-1">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div>
              <label className="block text-[10px] font-mono uppercase tracking-wider text-[#85888C] mb-1">
                Chave de Acesso / Senha
              </label>
              <div className="relative">
                <Lock className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#55585D]" />
                <input
                  {...register("password")}
                  type="password"
                  placeholder="••••••••"
                  className="w-full rounded border border-[#242628] bg-[#0C0D0E] pl-8 pr-3 py-1.5 text-xs text-[#E3E3E3] placeholder-[#55585D] focus:border-[#383B40] focus:outline-none transition-colors font-sans"
                />
              </div>
              {errors.password && (
                <p className="text-[10px] font-mono text-[#EF4444] mt-1">
                  {errors.password.message}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 flex items-center justify-center gap-1.5 rounded bg-[#E3E3E3] hover:bg-white text-[#0C0D0E] py-2 text-xs font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Validando credenciais...</span>
                </>
              ) : (
                <>
                  <span>Entrar no Acervo</span>
                  <ArrowRight className="h-3 w-3" />
                </>
              )}
            </button>
          </form>

          <div className="pt-2 border-t border-[#242628] text-center text-[11px] font-sans text-[#85888C]">
            Ainda não possui credencial?{" "}
            <Link
              href="/register"
              className="text-[#E3E3E3] hover:underline font-medium ml-0.5"
            >
              Criar conta
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
