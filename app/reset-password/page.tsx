'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabaseBrowser';
import { Topbar } from '@/components/Topbar';
import { Button } from '@/components/Button';

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      // Ao abrir o link de recovery, o Supabase normalmente cria sessão automaticamente
      const { data } = await supabase.auth.getSession();
      setHasSession(!!data.session);
      setReady(true);
    })();
  }, [supabase]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setMsg(null);

    if (password.length < 6) {
      setErr('A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (password !== confirm) {
      setErr('As senhas não conferem.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      setMsg('Senha atualizada com sucesso! Você já pode fazer login.');
      await supabase.auth.signOut();
      setTimeout(() => router.push('/login'), 900);
    } catch (e: any) {
      setErr(e?.message || 'Não foi possível atualizar a senha.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Topbar title="Redefinir senha" />
      <main className="flex-1 flex flex-col p-6 items-center justify-center">
        <div className="w-full max-w-sm space-y-6">
          {!ready ? (
            <div className="text-slate-600 dark:text-slate-300">Carregando...</div>
          ) : !hasSession ? (
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-4 text-sm text-slate-700 dark:text-slate-200">
              Abra esta página a partir do link enviado por e-mail (redefinição de senha).
              <div className="mt-3">
                <Button fullWidth onClick={() => router.push('/login')}>
                  Voltar ao login
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Nova senha
                </label>
                <div className="relative mt-1">
                  <input
                    type={show ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 pr-20 text-slate-900 dark:text-white focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShow((v) => !v)}
                    className="absolute inset-y-0 right-2 my-auto h-8 rounded-md px-2 text-xs text-slate-600 hover:text-slate-800 dark:text-slate-300 dark:hover:text-white"
                  >
                    {show ? 'Ocultar' : 'Mostrar'}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Confirmar nova senha
                </label>
                <input
                  type={show ? 'text' : 'password'}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  placeholder="••••••••"
                  required
                />
              </div>

              {err && (
                <div className="rounded-lg bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-600 dark:text-red-400">
                  {err}
                </div>
              )}

              {msg && (
                <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 p-3 text-sm text-emerald-700 dark:text-emerald-300">
                  {msg}
                </div>
              )}

              <Button type="submit" fullWidth disabled={loading}>
                {loading ? 'Salvando...' : 'Atualizar senha'}
              </Button>
            </form>
          )}
        </div>
      </main>
    </>
  );
}
