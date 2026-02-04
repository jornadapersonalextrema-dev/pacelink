'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Topbar from '../../../components/Topbar';
import Button from '../../../components/Button';

const TEMPLATE_LABEL: Record<string, string> = {
  easy_run: 'Rodagem',
  progressive: 'Progressivo',
  alternated: 'Alternado',
};

type SummaryResponse = {
  ok: boolean;
  error?: string;
  student?: { id: string; name: string; public_slug: string | null };
  week?: { id: string; week_start: string; week_end: string | null; label: string | null };
  counts?: { planned: number; ready: number; completed: number; pending: number; in_progress: number };
  workouts?: Array<{
    id: string;
    title: string | null;
    template_type: string | null;
    total_km: number | null;
    planned_date: string | null;
    planned_day: number | null;
    status: string;
    locked_at: string | null;
    last_execution: any | null;
  }>;
};

function formatDateBR(dateStr?: string | null) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const [y, m, d] = parts;
  return `${d}/${m}/${y}`;
}

export default function PortalStudentHome() {
  const router = useRouter();
  const params = useParams<{ studentSlug: string }>();
  const search = useSearchParams();

  const studentSlug = params.studentSlug;
  const token = search.get('t') || '';
  const tokenSafe = useMemo(() => token.trim(), [token]);

  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<string | null>(null);
  const [data, setData] = useState<SummaryResponse | null>(null);

  async function load() {
    setLoading(true);
    setBanner(null);

    if (!tokenSafe) {
      setBanner('Link inválido: token ausente.');
      setLoading(false);
      return;
    }

    const res = await fetch(`/api/portal/summary?slug=${encodeURIComponent(studentSlug)}&t=${encodeURIComponent(tokenSafe)}`, {
      cache: 'no-store',
    });

    const json = (await res.json()) as SummaryResponse;

    if (!json.ok) {
      setBanner(json.error || 'Não foi possível carregar.');
      setData(null);
      setLoading(false);
      return;
    }

    setData(json);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentSlug, tokenSafe]);

  const workouts = data?.workouts || [];
  const c = data?.counts;

  return (
    <>
      <Topbar title="Meu Portal" />
      <main className="p-4">
        <div className="mx-auto max-w-3xl space-y-4">
          {banner ? (
            <div className="rounded-xl bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-700 dark:text-red-300">{banner}</div>
          ) : null}

          {loading ? (
            <div className="text-sm text-slate-600 dark:text-slate-300">Carregando…</div>
          ) : data?.student ? (
            <>
              <div className="rounded-2xl bg-white dark:bg-surface-dark shadow p-4">
                <div className="text-sm text-slate-600 dark:text-slate-300">Aluno</div>
                <div className="mt-1 text-2xl font-extrabold leading-tight break-words">{data.student.name}</div>
                <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                  {data.week?.label ? (
                    <>
                      <span className="font-semibold">{data.week.label}</span>
                    </>
                  ) : null}
                </div>

                <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="rounded-xl bg-slate-100 dark:bg-slate-900/40 p-3">
                    <div className="text-xs text-slate-500 dark:text-slate-400">Treinos na semana</div>
                    <div className="text-lg font-bold">{c?.ready ?? 0}</div>
                  </div>
                  <div className="rounded-xl bg-slate-100 dark:bg-slate-900/40 p-3">
                    <div className="text-xs text-slate-500 dark:text-slate-400">Concluídos</div>
                    <div className="text-lg font-bold">{c?.completed ?? 0}</div>
                  </div>
                  <div className="rounded-xl bg-slate-100 dark:bg-slate-900/40 p-3">
                    <div className="text-xs text-slate-500 dark:text-slate-400">Pendentes</div>
                    <div className="text-lg font-bold">{c?.pending ?? 0}</div>
                  </div>
                  <div className="rounded-xl bg-slate-100 dark:bg-slate-900/40 p-3">
                    <div className="text-xs text-slate-500 dark:text-slate-400">Em andamento</div>
                    <div className="text-lg font-bold">{c?.in_progress ?? 0}</div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl bg-white dark:bg-surface-dark shadow p-4">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-semibold">Treinos desta semana</h2>
                  <button className="text-sm underline text-slate-600 dark:text-slate-300" onClick={load}>
                    Atualizar
                  </button>
                </div>

                {workouts.length === 0 ? (
                  <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">Nenhum treino disponível nesta semana.</div>
                ) : (
                  <div className="mt-3 space-y-3">
                    {workouts.map((w) => {
                      const last = w.last_execution;
                      const status =
                        last?.status === 'completed'
                          ? 'Concluído'
                          : last?.status === 'in_progress'
                          ? 'Em andamento'
                          : 'Disponível';

                      const tpl = TEMPLATE_LABEL[w.template_type || ''] || w.template_type || 'Treino';

                      return (
                        <div key={w.id} className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-sm font-semibold break-words">{w.title || tpl}</div>
                              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                {tpl}
                                {w.total_km != null ? ` · ${String(w.total_km).replace('.', ',')} km` : ''}
                                {w.planned_date ? ` · Planejado: ${formatDateBR(w.planned_date)}` : ''}
                                {w.planned_day ? ` · Dia: ${w.planned_day}` : ''}
                              </div>
                              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                Status: <span className="font-semibold">{status}</span>
                              </div>
                            </div>

                            <div className="shrink-0">
                              <Button
                                onClick={() =>
                                  router.push(`/p/${encodeURIComponent(studentSlug)}/workouts/${w.id}?t=${encodeURIComponent(tokenSafe)}`)
                                }
                              >
                                Abrir
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>
      </main>
    </>
  );
}
