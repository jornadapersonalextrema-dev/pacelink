'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';

type SummaryResponse = {
  ok: boolean;
  error?: string;
  student?: { id: string; name: string; public_slug: string | null };
  week?: { id: string; week_start: string; week_end: string | null; label: string | null };
  counts?: { planned: number; ready: number; completed: number; pending: number };
  workouts?: any[];
  latest_execution_by_workout?: Record<string, any>;
};

const TEMPLATE_LABEL: Record<string, string> = {
  easy_run: 'Rodagem',
  progressive: 'Progressivo',
  alternated: 'Alternado',
  run: 'Treino',
};

function formatBRShort(iso: string | null) {
  if (!iso) return '—';
  const [y, m, d] = String(iso).split('-');
  if (!y || !m || !d) return String(iso);
  return `${d}/${m}`;
}

function kmLabel(km: number | null) {
  if (km == null) return '—';
  return Number(km).toFixed(1).replace('.', ',');
}

export default function StudentPortalHomePage() {
  const router = useRouter();
  const params = useParams<{ studentSlug: string }>();
  const search = useSearchParams();

  const studentSlug = params.studentSlug;
  const t = search.get('t') || '';
  const preview = search.get('preview') === '1';

  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<string | null>(null);
  const [data, setData] = useState<SummaryResponse | null>(null);

  const token = useMemo(() => t, [t]);

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      setBanner(null);

      try {
        const res = await fetch(`/api/portal/summary?slug=${encodeURIComponent(studentSlug)}&t=${encodeURIComponent(token)}`, {
          cache: 'no-store',
        });

        const json = (await res.json()) as SummaryResponse;
        if (!alive) return;

        if (!json.ok) {
          setBanner(json.error || 'Erro ao carregar.');
          setData(null);
        } else {
          setData(json);
        }
      } catch (e: any) {
        if (!alive) return;
        setBanner(e?.message || 'Erro ao carregar.');
      } finally {
        if (alive) setLoading(false);
      }
    }

    if (!studentSlug || !token) {
      setBanner('Link inválido. Peça ao treinador para reenviar o acesso.');
      setLoading(false);
      return;
    }

    void load();
    return () => {
      alive = false;
    };
  }, [studentSlug, token]);

  const week = data?.week;
  const counts = data?.counts;
  const workouts = data?.workouts || [];
  const latest = data?.latest_execution_by_workout || {};

  return (
    <div className="min-h-screen bg-gradient-to-b from-background-dark to-black text-white">
      <header className="px-6 py-5 border-b border-white/10">
        <div className="mx-auto max-w-3xl flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs text-white/60">Portal do Aluno</div>
            <div className="text-xl font-semibold truncate">{data?.student?.name || 'Aluno'}</div>
            <div className="text-sm text-white/70 mt-1">
              {week ? (week.label || `Semana ${formatBRShort(week.week_start)} – ${formatBRShort(week.week_end)}`) : '—'}
            </div>
            {preview ? (
              <div className="mt-1 text-xs text-amber-200">Modo preview (QA do treinador): registro de execução desabilitado.</div>
            ) : null}
          </div>

          <button className="text-sm underline text-white/70" onClick={() => window.location.reload()}>
            Atualizar
          </button>
        </div>
      </header>

      <main className="px-6 py-6">
        <div className="mx-auto max-w-3xl space-y-4">
          {banner ? (
            <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-4 text-sm text-amber-200">{banner}</div>
          ) : null}

          {loading ? (
            <div className="text-sm text-white/70">Carregando…</div>
          ) : (
            <>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-sm text-white/70">Resumo da semana</div>
                <div className="mt-2 flex flex-wrap gap-3 text-sm">
                  <span className="rounded-full bg-white/10 px-3 py-1">Treinos: <b>{counts?.planned ?? 0}</b></span>
                  <span className="rounded-full bg-white/10 px-3 py-1">Disponíveis: <b>{counts?.ready ?? 0}</b></span>
                  <span className="rounded-full bg-white/10 px-3 py-1">Concluídos: <b>{counts?.completed ?? 0}</b></span>
                  <span className="rounded-full bg-white/10 px-3 py-1">Pendentes: <b>{counts?.pending ?? 0}</b></span>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="font-semibold">Treinos disponíveis</div>

                {workouts.length === 0 ? (
                  <div className="mt-3 text-sm text-white/70">Nenhum treino publicado para esta semana ainda.</div>
                ) : (
                  <div className="mt-3 space-y-3">
                    {workouts.map((w: any) => {
                      const ex = latest[w.id];
                      const progress =
                        ex?.status === 'completed'
                          ? `Concluído (${formatBRShort(ex.performed_at || ex.completed_at || null)})`
                          : ex?.status === 'in_progress'
                            ? 'Em andamento'
                            : '—';

                      const title = w.title || TEMPLATE_LABEL[w.template_type] || 'Treino';
                      const tpl = TEMPLATE_LABEL[w.template_type] || w.template_type;

                      return (
                        <button
                          key={w.id}
                          className="w-full text-left rounded-xl border border-white/10 bg-black/20 hover:bg-black/30 transition p-4"
                          onClick={() => {
                            const q = new URLSearchParams({ t: token });
                            if (preview) q.set('preview', '1');
                            router.push(`/p/${studentSlug}/workouts/${w.id}?${q.toString()}`);
                          }}
                        >
                          <div className="text-xs text-white/60">
                            {tpl} · {kmLabel(w.total_km)} km · {progress}
                          </div>
                          <div className="mt-1 font-semibold">{title}</div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
