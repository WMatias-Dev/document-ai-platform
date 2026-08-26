"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { apiClient, getErrorMessage } from "@/lib/api-client";
import { BookOpen, Lock, Mail, User, Loader2, ArrowRight } from "lucide-react";

const registerSchema = z.object({
  name: z.string().min(2, "O nome deve ter pelo menos 2 caracteres"),
  email: z.string().email("Insira um e-mail válido"),
  password: z.string().min(6, "A senha deve ter pelo menos 6 caracteres"),
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterFormValues) => {
    setIsLoading(true);
    try {
      await apiClient.post("/users/register", {
        name: data.name,
        email: data.email,
        password: data.password,
      });

      toast.success("Credencial criada com sucesso!", {
        description: "Faça login com seus dados para acessar o acervo.",
      });

      router.push("/login");
    } catch (err: any) {
      const msg = getErrorMessage(
        err,
        "Erro ao registrar credencial. Verifique os dados."
      );
      toast.error("Falha no cadastro", { description: msg });
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
              Cadastro de Credencial
            </p>
          </div>
        </div>

        {/* Form Container */}
        <div className="rounded border border-[#242628] bg-[#161719] p-6 shadow-xl space-y-5">
          <div className="border-b border-[#242628] pb-3">
            <h2 className="text-xs font-mono font-medium uppercase tracking-wider text-[#E3E3E3]">
              Nova Credencial de Pesquisa
            </h2>
            <p className="text-[11px] font-sans text-[#85888C] mt-0.5">
              Crie seu usuário para isolamento de acervos documentais.
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3.5">
            <div>
              <label className="block text-[10px] font-mono uppercase tracking-wider text-[#85888C] mb-1">
                Nome do Pesquisador / Usuário
              </label>
              <div className="relative">
                <User className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#55585D]" />
                <input
                  {...register("name")}
                  type="text"
                  placeholder="Seu nome completo"
                  className="w-full rounded border border-[#242628] bg-[#0C0D0E] pl-8 pr-3 py-1.5 text-xs text-[#E3E3E3] placeholder-[#55585D] focus:border-[#383B40] focus:outline-none transition-colors font-sans"
                />
              </div>
              {errors.name && (
                <p className="text-[10px] font-mono text-[#EF4444] mt-1">
                  {errors.name.message}
                </p>
              )}
            </div>

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
                  placeholder="Mínimo 6 caracteres"
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
                  <span>Cadastrando...</span>
                </>
              ) : (
                <>
                  <span>Criar Credencial</span>
                  <ArrowRight className="h-3 w-3" />
                </>
              )}
            </button>
          </form>

          <div className="pt-2 border-t border-[#242628] text-center text-[11px] font-sans text-[#85888C]">
            Já possui credencial?{" "}
            <Link
              href="/login"
              className="text-[#E3E3E3] hover:underline font-medium ml-0.5"
            >
              Fazer login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
