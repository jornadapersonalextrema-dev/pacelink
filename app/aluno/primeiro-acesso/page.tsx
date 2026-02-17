'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabaseBrowser';

export default function PrimeiroAcessoPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      setHasSession(!!data.session);
    })();
  }, [supabase]);

  async function onSetPassword(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    if (!password || password.length < 8) {
      setMsg('A senha deve ter pelo menos 8 caracteres.');
      return;
    }
    if (password !== password2) {
      setMsg('As senhas não conferem.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      setMsg('Senha atualizada com sucesso! Redirecionando…');
      setTimeout(() => router.push('/aluno'), 800);
    } catch (err: any) {
      setMsg(err?.message || 'Não foi possível atualizar a senha.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6">
      <div className="text-2xl font-extrabold">Primeiro acesso</div>
      <div className="mt-1 opacity-80">Defina sua senha para acessar o Portal do Aluno.</div>

      {hasSession === false ? (
        <div className="mt-6 rounded-2xl bg-amber-500/20 border border-amber-400/30 px-4 py-4 text-amber-100">
          Não encontramos uma sessão ativa.
          <div className="mt-2 opacity-90">
            Abra novamente o link do convite (enviado por e-mail) ou faça login.
          </div>
          <div className="mt-4">
            <Link
              href="/aluno/login"
              className="inline-block rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 px-4 py-2 font-semibold"
            >
              Ir para login
            </Link>
          </div>
        </div>
      ) : null}

      <form onSubmit={onSetPassword} className="mt-6 space-y-4">
        <div>
          <label className="text-sm font-semibold opacity-90">Nova senha</label>
          <input
            className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 outline-none"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            placeholder="mínimo 8 caracteres"
            autoComplete="new-password"
          />
        </div>

        <div>
          <label className="text-sm font-semibold opacity-90">Confirmar nova senha</label>
          <input
            className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 outline-none"
            value={password2}
            onChange={(e) => setPassword2(e.target.value)}
            type="password"
            placeholder="repita a senha"
            autoComplete="new-password"
          />
        </div>

        {msg ? (
          <div className="rounded-xl bg-amber-500/20 border border-amber-400/30 px-4 py-3 text-amber-100">{msg}</div>
        ) : null}

        <button
          disabled={loading || hasSession === false}
          className="w-full rounded-2xl bg-emerald-400 hover:bg-emerald-300 disabled:opacity-60 text-slate-950 px-4 py-3 font-extrabold"
          type="submit"
        >
          Salvar senha
        </button>

        <Link href="/aluno/login" className="inline-block text-sm underline opacity-80 hover:opacity-100">
          Voltar para login
        </Link>
      </form>
    </div>
  );
}
