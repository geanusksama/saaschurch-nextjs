"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Mail, Lock, Eye, EyeOff, Loader } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });

      if (authError || !data.session) {
        setError("Email ou senha inválidos.");
        return;
      }

      const sessionToken = data.session.access_token;
      const fallbackUser = {
        id: data.user.id,
        email: data.user.email,
        fullName: data.user.user_metadata?.full_name || data.user.email,
        profileType: data.user.user_metadata?.profile_type || "church",
      };

      const profileResponse = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });

      if (!profileResponse.ok) {
        if (profileResponse.status === 401 || profileResponse.status === 403) {
          throw new Error("Sessão inválida. Faça login novamente.");
        }
        throw new Error("Não foi possível carregar seu perfil.");
      }

      const profileData = await profileResponse.json().catch(() => {
        throw new Error("A resposta da API não retornou JSON válido.");
      });

      const resolvedUser = { ...fallbackUser, ...profileData };

      localStorage.setItem("mrm_token", sessionToken);
      localStorage.setItem("mrm_user", JSON.stringify(resolvedUser));
      localStorage.removeItem("mrm_selected_context");
      localStorage.removeItem("mrm_active_field_id");
      localStorage.removeItem("mrm_active_field_name");

      if (resolvedUser.campoId) localStorage.setItem("mrm_active_field_id", resolvedUser.campoId);
      if (resolvedUser.campoName) localStorage.setItem("mrm_active_field_name", resolvedUser.campoName);

      if (resolvedUser.profileType === "pending") {
        router.push("/pending-activation");
        return;
      }

      router.push("/app-ui");
    } catch (err) {
      localStorage.removeItem("mrm_token");
      localStorage.removeItem("mrm_user");
      setError(err instanceof Error ? err.message : "Não foi possível concluir o login.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-blue-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-2xl mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-2xl">M</span>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Bem-vindo ao MRM</h1>
          <p className="text-purple-200">Entre na sua conta para continuar</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 caret-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Senha</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full pl-10 pr-12 py-3 border border-slate-200 rounded-lg bg-white text-slate-900 placeholder:text-slate-500 caret-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2">
                <input type="checkbox" className="w-4 h-4 text-purple-600 border-slate-300 rounded" />
                <span className="text-sm text-slate-600">Lembrar de mim</span>
              </label>
              <Link href="/forgot-password" className="text-sm text-purple-600 hover:text-purple-700 font-medium">
                Esqueceu a senha?
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader className="w-5 h-5 animate-spin" />
                  Entrando...
                </>
              ) : (
                "Entrar"
              )}
            </button>
          </form>

          {error && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="mt-6 text-center text-sm text-slate-500">
            Não tem conta?{" "}
            <Link href="/register" className="text-purple-600 hover:text-purple-700 font-medium">
              Criar conta
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
