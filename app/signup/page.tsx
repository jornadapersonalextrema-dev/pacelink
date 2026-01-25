'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabaseBrowser';
import { Topbar } from '@/components/Topbar';
import { Button } from '@/components/Button';
import Link from 'next/link';

export default function SignupPage() {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const router = useRouter();
    const supabase = createClient();

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { error: authError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        display_name: name,
                    },
                },
            });

            if (authError) {
                throw authError;
            }

            setSuccess(true);
            setTimeout(() => {
                router.push('/login');
            }, 2000);
        } catch (err: any) {
            setError(err.message || 'Erro ao criar cadastro');
            setLoading(false);
        }
    };

    return (
        <>
            <Topbar title="Cadastro Treinador" />
            <main className="flex-1 flex flex-col p-6 items-center justify-center">
                <div className="w-full max-w-sm space-y-8">
                    <div className="text-center">
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Crie sua conta</h2>
                        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                            Preencha seus dados para começar
                        </p>
                    </div>

                    <form className="mt-8 space-y-6" onSubmit={handleSignup}>
                        <div className="space-y-4">
                            <div>
                                <label htmlFor="name" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                                    Nome
                                </label>
                                <input
                                    id="name"
                                    name="name"
                                    type="text"
                                    autoComplete="name"
                                    required
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="mt-1 block w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white placeholder-slate-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                                    placeholder="Seu Nome"
                                />
                            </div>

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
                                <label htmlFor="password" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                                    Senha
                                </label>
                                <input
                                    id="password"
                                    name="password"
                                    type="password"
                                    autoComplete="new-password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="mt-1 block w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white placeholder-slate-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                                    placeholder="••••••••"
                                />
                            </div>
                        </div>

                        {error && (
                            <div className="rounded-lg bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-600 dark:text-red-400">
                                {error}
                            </div>
                        )}

                        {success && (
                            <div className="rounded-lg bg-green-50 dark:bg-green-900/20 p-4 text-sm text-green-600 dark:text-green-400">
                                Cadastro criado com sucesso! Redirecionando...
                            </div>
                        )}

                        <Button type="submit" fullWidth disabled={loading || success}>
                            {loading ? 'Cadastrando...' : 'Cadastrar'}
                        </Button>

                        <div className="text-center mt-4">
                            <Link href="/login" className="text-sm text-brand-600 hover:text-brand-500 dark:text-brand-400">
                                Já tem uma conta? Faça login
                            </Link>
                        </div>
                    </form>
                </div>
            </main>
        </>
    );
}
