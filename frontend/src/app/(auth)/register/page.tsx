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
              Cadastro de Pesquisador
            </p>
          </div>
        </div>

        {/* Form Container */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-7 shadow-lg shadow-slate-200/50 space-y-5">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-sm font-semibold text-slate-800">
              Nova Credencial
            </h2>
            <p className="text-xs font-sans text-slate-500 mt-0.5">
              Crie sua conta para gerenciar seus cadernos de pesquisa.
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label htmlFor="register-name-input" className="block text-xs font-medium text-slate-700 mb-1.5">
                Nome Completo
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  id="register-name-input"
                  {...register("name")}
                  type="text"
                  placeholder="Seu nome ou instituição"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-9 pr-3.5 py-2 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all font-sans"
                />
              </div>
              {errors.name && (
                <p className="text-[11px] font-sans text-red-500 mt-1">
                  {errors.name.message}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="register-email-input" className="block text-xs font-medium text-slate-700 mb-1.5">
                E-mail Institucional
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  id="register-email-input"
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
              <label htmlFor="register-password-input" className="block text-xs font-medium text-slate-700 mb-1.5">
                Senha de Acesso
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  id="register-password-input"
                  {...register("password")}
                  type="password"
                  placeholder="Mínimo 6 caracteres"
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
                  <span>Cadastrando credencial...</span>
                </>
              ) : (
                <>
                  <span>Criar Credencial</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </>
              )}
            </button>
          </form>

          <div className="pt-2 border-t border-slate-100 text-center text-xs font-sans text-slate-500">
            Já possui credencial?{" "}
            <Link
              href="/login"
              className="text-emerald-700 hover:text-emerald-800 hover:underline font-semibold ml-0.5"
            >
              Fazer login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
