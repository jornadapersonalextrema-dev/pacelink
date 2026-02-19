'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';

function pad2(n: number) {
  return String(n).padStart(2, '0');
}
function isoFromParts(y: number, m: number, d: number) {
  return `${y}-${pad2(m)}-${pad2(d)}`;
}
function addDaysISO(iso: string, days: number) {
  const [y, m, d] = iso.split('-').map((x) => Number(x));
  const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
  dt.setUTCDate(dt.getUTCDate() + days);
  return isoFromParts(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}
function formatBRShort(iso: string) {
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}`;
}
function formatBRLong(iso: string) {
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}
function kmFmt(v: any) {
  const n = Number(v || 0);
  if (!isFinite(n)) return '0,0';
  return n.toFixed(1).replace('.', ',');
}

type SummaryResponse = {
  ok: boolean;
  error?: string;
  student?: { id: string; name: string; public_slug: string | null; portal_token?: string | null };
  week?: { id: string; week_start: string; week_end: string; label: string | null };
  weeks?: { id: string; week_start: string; week_end: string; label: string | null }[];
  counts?: { planned: number; ready: number; completed: number; pending: number; canceled?: number };
  workouts?: any[];
  latest_execution_by_workout?: Record<string, any>;
};

export default function StudentPortalPage() {
  const params = useParams<{ studentSlug: string }>();
  const router = useRouter();
  const search = useSearchParams();

  const studentSlug = params?.studentSlug || '';
  const t = search.get('t') || '';
  const preview = search.get('preview') === '1';
  const wParam = search.get('w') || '';

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<SummaryResponse | null>(null);
  const [requestedWeekId, setRequestedWeekId] = useState<string | null>(wParam ? wParam : null);
  const [error, setError] = useState<string | null>(null);

  const chipsRef = useRef<HTMLDivElement | null>(null);
  const activeChipRef = useRef<HTMLButtonElement | null>(null);

  const token = useMemo(() => t, [t]);

  useEffect(() => {
    if (!studentSlug || !token) return;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const q = new URLSearchParams();
        q.set('slug', studentSlug);
        q.set('t', token);
        if (requestedWeekId) q.set('weekId', requestedWeekId);

        const res = await fetch(`/api/portal/summary?${q.toString()}`, { cache: 'no-store' });
        const json = (await res.json()) as SummaryResponse;
        if (!json.ok) throw new Error(json.error || 'Falha ao carregar portal.');
        setData(json);
      } catch (e: any) {
        setError(e?.message || 'Erro inesperado.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [studentSlug, token, requestedWeekId]);

  const week = data?.week;
  const workouts = data?.workouts || [];
  const latest = data?.latest_execution_by_workout || {};

  useEffect(() => {
    if (!activeChipRef.current) return;
    const el = activeChipRef.current;
    requestAnimationFrame(() => {
      try {
        el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      } catch {
        // ignore
      }
    });
  }, [data?.weeks?.length, week?.id]);

  const weekDays = useMemo(() => {
    if (!week) return [];

    const out: Array<{
      dow: number;
      dateISO: string;
      title: string;
      items: any[];
      plannedKm: number;
      realKm: number;
      completed: number;
      pending: number;
      canceled: number;
    }> = [];

    for (let i = 0; i < 7; i++) {
      const dow = i + 1; // Mon=1..Sun=7
      const dateISO = addDaysISO(week.week_start, i);
      const title = formatBRLong(dateISO);

      const items = workouts.filter((w) => Number(w.planned_day || 0) === dow);

      const plannedKm = items.reduce((acc, w) => acc + Number(w.total_km || 0), 0);
      const realKm = items.reduce((acc, w) => {
        const ex = latest[w.id];
        if (ex?.status === 'completed') return acc + Number(ex.actual_total_km || 0);
        return acc;
      }, 0);

      const canceled = items.filter((w) => w.status === 'canceled').length;
      const completed = items.filter((w) => latest[w.id]?.status === 'completed').length;
      const ready = items.filter((w) => w.status === 'ready').length;
      const pending = Math.max(0, ready - completed);

      out.push({ dow, dateISO, title, items, plannedKm, realKm, completed, pending, canceled });
    }

    return out;
  }, [week?.week_start, week?.id, JSON.stringify(workouts.map((w) => [w.id, w.planned_day, w.status, w.total_km]))]);

  if (!token) {
    return (
      <div className="min-h-screen bg-slate-950 text-white p-6">
        <div className="max-w-2xl mx-auto">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            Link inválido: token ausente. Reenvie o acesso.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 to-emerald-950 text-white">
      <header className="px-6 py-5 border-b border-white/10">
        <div className="mx-auto max-w-3xl">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <div className="text-xs text-white/60">Portal do Aluno</div>
              <div className="text-xl font-semibold leading-tight break-words">{data?.student?.name || 'Aluno'}</div>

              <div className="text-sm text-white/70 mt-1">
                {week ? `Semana ${week.label || `${formatBRShort(week.week_start)} – ${formatBRShort(week.week_end)}`}` : '—'}
              </div>

              {preview ? (
                <div className="mt-1 text-xs text-amber-200">
                  Modo de teste (prévia do treinador): registro de execução desabilitado.
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
              <button
                className="underline text-white/70 hover:text-white"
                onClick={() => {
                  const studentId = data?.student?.id;
                  if (!studentId) return;
                  const q = new URLSearchParams();
                  if (token) q.set('t', token);
                  if (preview) q.set('preview', '1');
                  if (week?.id) q.set('w', week.id);
                  router.push(`/students/${studentId}/reports/4w?${q.toString()}`);
                }}
              >
                Relatório 4 semanas
              </button>

              <button className="underline text-white/70 hover:text-white" onClick={() => window.location.reload()}>
                Atualizar
              </button>
            </div>
          </div>

          {data?.weeks?.length ? (
            <div ref={chipsRef} className="mt-3 flex items-center gap-2 overflow-x-auto pb-1">
              {[...data.weeks]
                .sort((a, b) => String(b.week_start).localeCompare(String(a.week_start)))
                .map((w) => {
                  const active = week?.id === w.id;
                  return (
                    <button
                      key={w.id}
                      ref={(el) => {
                        if (week?.id === w.id) activeChipRef.current = el;
                      }}
                      onClick={() => {
                        setRequestedWeekId(w.id);
                        const q = new URLSearchParams();
                        if (token) q.set('t', token);
                        if (preview) q.set('preview', '1');
                        q.set('w', w.id);
                        router.replace(`/p/${encodeURIComponent(studentSlug)}?${q.toString()}`);
                      }}
                      className={
                        'rounded-full px-4 py-2 text-sm font-semibold whitespace-nowrap border ' +
                        (active
                          ? 'bg-emerald-500 text-black border-emerald-500'
                          : 'bg-white/5 text-white/80 border-white/10 hover:bg-white/10')
                      }
                    >
                      {w.label || `${formatBRShort(w.week_start)} – ${formatBRShort(w.week_end)}`}
                    </button>
                  );
                })}
            </div>
          ) : null}
        </div>
      </header>

      <main className="px-6 py-6">
        <div className="mx-auto max-w-3xl space-y-6">
          {error ? <div className="rounded-xl bg-amber-900/40 border border-amber-400/30 p-4">{error}</div> : null}

          {loading ? (
            <div className="text-white/70">Carregando…</div>
          ) : (
            <>
              <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
                <div className="text-sm font-semibold text-white/80 mb-3">Resumo da semana</div>
                <div className="flex flex-wrap gap-2">
                  <span className="px-3 py-1 rounded-full bg-white/10 text-sm">
                    Treinos: <b>{data?.counts?.planned ?? 0}</b>
                  </span>
                  <span className="px-3 py-1 rounded-full bg-white/10 text-sm">
                    Disponíveis: <b>{data?.counts?.ready ?? 0}</b>
                  </span>
                  <span className="px-3 py-1 rounded-full bg-white/10 text-sm">
                    Concluídos: <b>{data?.counts?.completed ?? 0}</b>
                  </span>
                  <span className="px-3 py-1 rounded-full bg-white/10 text-sm">
                    Pendentes: <b>{data?.counts?.pending ?? 0}</b>
                  </span>
                  <span className="px-3 py-1 rounded-full bg-white/10 text-sm">
                    Cancelados: <b>{data?.counts?.canceled ?? 0}</b>
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="text-xl font-black">Calendário da semana</div>

                {workouts.length === 0 ? (
                  <div className="text-white/70">Nenhum treino publicado nesta semana.</div>
                ) : (
                  <div className="space-y-4">
                    {weekDays.map((d) => (
                      <div key={d.dateISO} className="rounded-2xl bg-white/5 border border-white/10 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm text-white/70">{d.title}</div>
                            <div className="text-lg font-bold">{d.items.length} treino(s)</div>
                            <div className="text-sm text-white/70">
                              previsto {kmFmt(d.plannedKm)} km · real {kmFmt(d.realKm)} km
                            </div>
                          </div>

                          <div className="text-xs text-white/60 text-right">
                            Concluídos: <b>{d.completed}</b> · Pendentes: <b>{d.pending}</b> · Cancelados: <b>{d.canceled}</b>
                          </div>
                        </div>

                        {d.items.length ? (
                          <div className="mt-3 space-y-2">
                            {d.items.map((w) => (
                              <button
                                key={w.id}
                                onClick={() => {
                                  if (preview) return;
                                  router.push(
                                    `/p/${encodeURIComponent(studentSlug)}/workouts/${w.id}?t=${encodeURIComponent(token)}`
                                  );
                                }}
                                className="w-full text-left rounded-xl bg-black/20 border border-white/10 p-3 hover:bg-black/30 disabled:opacity-50"
                                disabled={preview}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="font-bold break-words">{w.title || 'Treino'}</div>
                                    <div className="text-xs text-white/60">
                                      {w.status_label || ''}{w.portal_progress_label ? ` · ${w.portal_progress_label}` : ''}
                                    </div>
                                  </div>
                                  <div className="text-sm underline text-white/70 shrink-0">Ver treino →</div>
                                </div>
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div className="mt-3 text-white/60">Sem treinos</div>
                        )}
                      </div>
                    ))}
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
