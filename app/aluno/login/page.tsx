'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabaseBrowser';

export default function AlunoLoginPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onLogin(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;

      router.push('/aluno');
    } catch (err: any) {
      setMsg(err?.message || 'Não foi possível entrar.');
    } finally {
      setLoading(false);
    }
  }

  async function onForgot() {
    setMsg(null);
    const em = email.trim();
    if (!em) {
      setMsg('Informe seu e-mail para receber o link de redefinição de senha.');
      return;
    }

    setLoading(true);
    try {
      const redirectTo = `${window.location.origin}/aluno/primeiro-acesso`;
      const { error } = await supabase.auth.resetPasswordForEmail(em, { redirectTo });
      if (error) throw error;

      setMsg('Link de redefinição enviado para o seu e-mail. Verifique sua caixa de entrada.');
    } catch (err: any) {
      setMsg(err?.message || 'Não foi possível enviar o e-mail.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6">
      <div className="text-2xl font-extrabold">Portal do Aluno</div>
      <div className="mt-1 opacity-80">Entre com seu e-mail e senha.</div>

      <form onSubmit={onLogin} className="mt-6 space-y-4">
        <div>
          <label className="text-sm font-semibold opacity-90">E-mail</label>
          <input
            className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 outline-none"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            placeholder="seuemail@exemplo.com"
            autoComplete="email"
          />
        </div>

        <div>
          <label className="text-sm font-semibold opacity-90">Senha</label>
          <input
            className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 outline-none"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            placeholder="••••••••"
            autoComplete="current-password"
          />
        </div>

        {msg ? (
          <div className="rounded-xl bg-amber-500/20 border border-amber-400/30 px-4 py-3 text-amber-100">{msg}</div>
        ) : null}

        <button
          disabled={loading}
          className="w-full rounded-2xl bg-emerald-400 hover:bg-emerald-300 disabled:opacity-60 text-slate-950 px-4 py-3 font-extrabold"
          type="submit"
        >
          Entrar
        </button>

        <button
          type="button"
          disabled={loading}
          onClick={onForgot}
          className="w-full rounded-2xl bg-white/10 hover:bg-white/15 disabled:opacity-60 border border-white/10 px-4 py-3 font-semibold"
        >
          Esqueci minha senha
        </button>

        <div className="text-sm opacity-70">
          Primeiro acesso? Use o link do convite enviado pelo seu treinador (no seu e-mail).
        </div>

        <Link href="/" className="inline-block text-sm underline opacity-80 hover:opacity-100">
          Voltar
        </Link>
      </form>
    </div>
  );
}
