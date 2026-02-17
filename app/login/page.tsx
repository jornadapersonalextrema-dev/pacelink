'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabaseBrowser';
import { Topbar } from '@/components/Topbar';
import { Button } from '@/components/Button';
import Link from 'next/link';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Forgot password modal
  const [fpOpen, setFpOpen] = useState(false);
  const [fpEmail, setFpEmail] = useState('');
  const [fpLoading, setFpLoading] = useState(false);
  const [fpMsg, setFpMsg] = useState<string | null>(null);
  const [fpErr, setFpErr] = useState<string | null>(null);

  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const normalizeAuthError = (msg?: string) => {
    if (!msg) return 'Erro ao fazer login';
    if (msg.toLowerCase().includes('invalid login credentials')) return 'Email ou senha inválidos.';
    if (msg.toLowerCase().includes('email not confirmed')) return 'Email ainda não confirmado. Verifique sua caixa de entrada.';
    return msg;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) throw authError;

      router.push('/students');
    } catch (err: any) {
      setError(normalizeAuthError(err?.message));
    } finally {
      setLoading(false);
    }
  };

  const openForgotPassword = () => {
    setFpMsg(null);
    setFpErr(null);
    setFpEmail((email || '').trim());
    setFpOpen(true);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setFpLoading(true);
    setFpMsg(null);
    setFpErr(null);

    try {
      const emailToReset = (fpEmail || '').trim();
      if (!emailToReset) {
        setFpErr('Informe um e-mail válido.');
        return;
      }

      const redirectTo = `${window.location.origin}/reset-password`;

      const { error: rpErr } = await supabase.auth.resetPasswordForEmail(emailToReset, {
        redirectTo,
      });

      if (rpErr) throw rpErr;

      setFpMsg('Enviamos um e-mail para redefinir sua senha. Abra o link recebido para criar uma nova senha.');
    } catch (err: any) {
      setFpErr(err?.message || 'Não foi possível enviar o e-mail de redefinição.');
    } finally {
      setFpLoading(false);
    }
  };

  return (
    <>
      <Topbar title="Acesso Treinador" />
      <main className="flex-1 flex flex-col p-6 items-center justify-center">
        <div className="w-full max-w-sm space-y-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Bem-vindo</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              Faça login para gerenciar seus alunos
            </p>
          </div>

          <form className="mt-8 space-y-6" onSubmit={handleLogin}>
            <div className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white placeholder-slate-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  placeholder="exemplo@email.com"
                />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label htmlFor="password" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Senha
                  </label>

                  <button
                    type="button"
                    onClick={openForgotPassword}
                    className="text-xs text-brand-600 hover:text-brand-500 dark:text-brand-400"
                  >
                    Esqueci minha senha
                  </button>
                </div>

                <div className="relative mt-1">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 pr-20 text-slate-900 dark:text-white placeholder-slate-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute inset-y-0 right-2 my-auto h-8 rounded-md px-2 text-xs text-slate-600 hover:text-slate-800 dark:text-slate-300 dark:hover:text-white"
                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  >
                    {showPassword ? 'Ocultar' : 'Mostrar'}
                  </button>
                </div>
              </div>
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-600 dark:text-red-400">
                {error}
              </div>
            )}

            <Button type="submit" fullWidth disabled={loading}>
              {loading ? 'Entrando...' : 'Entrar'}
            </Button>

            <div className="text-center mt-4">
              <Link href="/signup" className="text-sm text-brand-600 hover:text-brand-500 dark:text-brand-400">
                Primeiro acesso? Cadastre-se
              </Link>
            </div>
          </form>
        </div>

        {/* Modal - Esqueci minha senha */}
        {fpOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/40"
              onClick={() => !fpLoading && setFpOpen(false)}
            />
            <div className="relative w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Redefinir senha</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    Enviaremos um e-mail com um link para você criar uma nova senha.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={fpLoading}
                  onClick={() => setFpOpen(false)}
                  className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white"
                >
                  ✕
                </button>
              </div>

              <form className="mt-4 space-y-3" onSubmit={handleForgotPassword}>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Email
                  </label>
                  <input
                    type="email"
                    required
                    value={fpEmail}
                    onChange={(e) => setFpEmail(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white placeholder-slate-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    placeholder="exemplo@email.com"
                  />
                </div>

                {fpErr && (
                  <div className="rounded-lg bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-600 dark:text-red-400">
                    {fpErr}
                  </div>
                )}

                {fpMsg && (
                  <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 p-3 text-sm text-emerald-700 dark:text-emerald-300">
                    {fpMsg}
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <Button type="submit" fullWidth disabled={fpLoading}>
                    {fpLoading ? 'Enviando...' : 'Enviar link'}
                  </Button>
                  <button
                    type="button"
                    disabled={fpLoading}
                    onClick={() => setFpOpen(false)}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
