'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../../lib/supabaseBrowser';

export default function AlunoLoginPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Se já estiver logado, manda pro portal
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data?.session) router.replace('/aluno');
    })();
  }, [router, supabase]);

  async function onLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMsg(null);

    const eTrim = email.trim().toLowerCase();
    if (!eTrim || !password) {
      setError('Informe e-mail e senha.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: eTrim,
        password,
      });

      if (error) {
        setError('Credenciais inválidas. Verifique e-mail e senha.');
        return;
      }

      router.replace('/aluno');
    } catch (err: any) {
      setError(err?.message || 'Erro ao fazer login.');
    } finally {
      setLoading(false);
    }
  }

  async function onForgotPassword() {
    setError(null);
    setMsg(null);

    const eTrim = email.trim().toLowerCase();
    if (!eTrim) {
      setError('Digite seu e-mail para receber o link de redefinição.');
      return;
    }

    setLoading(true);
    try {
      // Sem redirectTo: usa o Site URL/Redirect URLs configurados no Supabase Auth
      const { error } = await supabase.auth.resetPasswordForEmail(eTrim);
      if (error) {
        setError(error.message || 'Não foi possível enviar o e-mail de redefinição.');
        return;
      }

      setMsg('Se o e-mail estiver cadastrado, enviamos um link para redefinir sua senha.');
    } catch (err: any) {
      setError(err?.message || 'Erro ao enviar e-mail de redefinição.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background-dark to-black text-white flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="text-3xl font-black mb-2">Portal do Aluno</div>
        <div className="text-white/70 mb-8">Entre com seu e-mail e senha.</div>

        {error ? (
          <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        {msg ? (
          <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">
            {msg}
          </div>
        ) : null}

        <form onSubmit={onLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-white/80 mb-2">E-mail</label>
            <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 focus-within:ring-2 focus-within:ring-[#30e87a]/40">
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="seuemail@exemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-transparent outline-none text-white placeholder:text-white/40"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-white/80 mb-2">Senha</label>
            <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 focus-within:ring-2 focus-within:ring-[#30e87a]/40">
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-transparent outline-none text-white placeholder:text-white/40"
              />

              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/15 active:bg-white/20"
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {showPassword ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-emerald-400 py-4 text-lg font-black text-black hover:bg-emerald-300 disabled:opacity-60"
          >
            {loading ? 'Entrando…' : 'Entrar'}
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={onForgotPassword}
            className="w-full rounded-2xl border border-white/10 bg-white/5 py-4 text-base font-bold text-white/80 hover:bg-white/10 disabled:opacity-60"
          >
            Esqueci minha senha
          </button>
        </form>

        <div className="mt-6 text-sm text-white/60">
          Primeiro acesso? Use o link do convite enviado pelo seu treinador (no seu e-mail).
        </div>

        <button
          type="button"
          onClick={() => router.push('/login')}
          className="mt-6 text-sm underline text-white/70 hover:text-white"
        >
          Voltar
        </button>
      </div>
    </div>
  );
}
