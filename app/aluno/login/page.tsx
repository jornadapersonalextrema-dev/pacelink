'use client';

import React, { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { Topbar } from '../../../components/Topbar';
import { Button } from '../../../components/Button';
import { Card } from '../../../components/Card';

import { createClient } from '../../../lib/supabaseBrowser';

function toLoginEmail(identifier: string): string {
  const raw = (identifier || '').trim();
  if (!raw) return '';
  if (raw.includes('@')) return raw.toLowerCase();

  // Se não tem "@", tratamos como WhatsApp (somente números)
  const digits = raw.replace(/\D/g, '');
  return digits ? `wa${digits}@pacelink.local` : raw;
}

export default function AlunoLoginPage() {
  const router = useRouter();
  const search = useSearchParams();
  const supabase = useMemo(() => createClient(), []);

  const next = search.get('next') || '/aluno';

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const email = toLoginEmail(identifier);

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) throw authError;

      router.replace(next);
    } catch (err: any) {
      setError(err?.message || 'Erro ao fazer login');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Topbar title="Acesso do Aluno" showBack onBack={() => router.push('/login')} />

      <main className="flex-1 p-6 flex items-center justify-center">
        <div className="w-full max-w-sm space-y-4">
          <Card>
            <div className="p-4 space-y-3">
              <div>
                <div className="text-lg font-semibold">Entrar</div>
                <div className="text-sm text-white/60">
                  Use seu <b>WhatsApp</b> (somente números) ou seu <b>e-mail</b>.
                </div>
              </div>

              <form className="space-y-3" onSubmit={handleLogin}>
                <div className="space-y-2">
                  <label className="block text-sm text-white/70">WhatsApp ou e-mail</label>
                  <input
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    className="w-full rounded-lg bg-white/10 ring-1 ring-white/15 px-3 py-2 text-white placeholder-white/40"
                    placeholder="Ex.: 19999999999 ou aluno@email.com"
                    autoComplete="username"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm text-white/70">Senha</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-lg bg-white/10 ring-1 ring-white/15 px-3 py-2 text-white placeholder-white/40"
                    placeholder="••••••••"
                    autoComplete="current-password"
                    required
                  />
                </div>

                {error && (
                  <div className="rounded-lg bg-red-500/10 ring-1 ring-red-400/30 p-3 text-sm text-red-200">
                    {error}
                  </div>
                )}

                <Button type="submit" fullWidth disabled={loading}>
                  {loading ? 'Entrando...' : 'Entrar'}
                </Button>
              </form>
            </div>
          </Card>

          <div className="text-xs text-white/50">
            Se você não tem acesso ainda, peça ao treinador para criar seu usuário e senha inicial.
          </div>
        </div>
      </main>
    </>
  );
}
