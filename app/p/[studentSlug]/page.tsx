'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';

type SummaryResponse = {
  ok: boolean;
  error?: string;
  student?: { id: string; name: string; public_slug: string | null };
  week?: { id: string; week_start: string; week_end: string | null; label: string | null };
  counts?: { planned: number; ready: number; completed: number; pending: number; canceled?: number };
  workouts?: any[];
  latest_execution_by_workout?: Record<string, any>;
};

const TEMPLATE_LABEL: Record<string, string> = {
  easy_run: 'Rodagem',
  progressive: 'Progressivo',
  alternated: 'Alternado',
  run: 'Treino',
};

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

function formatBRShort(iso: string | null) {
  if (!iso) return '—';
  const [y, m, d] = String(iso).split('-');
  if (!y || !m || !d) return String(iso);
  return `${d}/${m}`;
}

function formatBRFull(iso: string | null) {
  if (!iso) return '—';
  const [y, m, d] = String(iso).split('-');
  if (!y || !m || !d) return String(iso);
  return `${d}/${m}/${y}`;
}

function kmLabel(km: number | null) {
  if (km == null) return '—';
  return Number(km).toFixed(1).replace('.', ',');
}

type DayAgg = {
  day: string; // YYYY-MM-DD
  workouts: any[];
  workouts_count: number;
  planned_km: number;
  actual_km: number;
  completed: number;
  pending: number;
  canceled: number;
};

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
        const res = await fetch(
          `/api/portal/summary?slug=${encodeURIComponent(studentSlug)}&t=${encodeURIComponent(token)}`,
          { cache: 'no-store' }
        );

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

  const weekDays: DayAgg[] = useMemo(() => {
    if (!week?.week_start) return [];

    const base = week.week_start;
    const days: DayAgg[] = [];
    const byDay: Record<string, DayAgg> = {};

    for (let i = 0; i < 7; i++) {
      const iso = addDaysISO(base, i);
      byDay[iso] = {
        day: iso,
        workouts: [],
        workouts_count: 0,
        planned_km: 0,
        actual_km: 0,
        completed: 0,
        pending: 0,
        canceled: 0,
      };
      days.push(byDay[iso]);
    }

    for (const w of workouts) {
      const iso =
        w.planned_date ||
        (w.planned_day != null && week.week_start ? addDaysISO(week.week_start, Number(w.planned_day)) : null);

      if (!iso || !byDay[iso]) continue;

      const ex = latest[w.id];
      const plannedKm = Number(w.total_km || 0);

      byDay[iso].workouts.push(w);
      byDay[iso].workouts_count += 1;
      byDay[iso].planned_km += plannedKm;

      if (w.status === 'canceled') {
        byDay[iso].canceled += 1;
      } else if (ex?.status === 'completed') {
        byDay[iso].completed += 1;
        byDay[iso].actual_km += Number(ex.actual_total_km || 0);
      } else if (w.status === 'ready') {
        byDay[iso].pending += 1;
      }
    }

    for (const d of days) {
      d.planned_km = Math.round(d.planned_km * 10) / 10;
      d.actual_km = Math.round(d.actual_km * 10) / 10;
    }

    return days;
  }, [week?.week_start, workouts, latest]);

  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  useEffect(() => {
    setSelectedDay(null);
  }, [week?.id]);

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
              <div className="mt-1 text-xs text-amber-200">Modo de teste (prévia do treinador): registro de execução desabilitado.</div>
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
                  <span className="rounded-full bg-white/10 px-3 py-1">
                    Treinos: <b>{counts?.planned ?? 0}</b>
                  </span>
                  <span className="rounded-full bg-white/10 px-3 py-1">
                    Disponíveis: <b>{counts?.ready ?? 0}</b>
                  </span>
                  <span className="rounded-full bg-white/10 px-3 py-1">
                    Concluídos: <b>{counts?.completed ?? 0}</b>
                  </span>
                  <span className="rounded-full bg-white/10 px-3 py-1">
                    Pendentes: <b>{counts?.pending ?? 0}</b>
                  </span>
                  <span className="rounded-full bg-white/10 px-3 py-1">
                    Cancelados: <b>{counts?.canceled ?? 0}</b>
                  </span>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="font-semibold">Calendário da semana</div>

                {weekDays.length === 0 ? (
                  <div className="mt-3 text-sm text-white/70">Nenhuma semana encontrada.</div>
                ) : (
                  <>
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {weekDays.map((d) => {
                        const active = selectedDay === d.day;

                        return (
                          <button
                            key={d.day}
                            onClick={() => setSelectedDay(active ? null : d.day)}
                            className={`rounded-xl border px-4 py-3 text-left transition ${
                              active ? 'bg-white/10 border-white/20' : 'bg-black/20 border-white/10 hover:bg-black/30'
                            }`}
                          >
                            <div className="text-xs text-white/60">{formatBRFull(d.day)}</div>
                            <div className="mt-1 text-sm">
                              <b>{d.workouts_count}</b> treino(s){' '}
                              <span className="text-white/60">
                                · previsto {kmLabel(d.planned_km)} km · real {kmLabel(d.actual_km)} km
                              </span>
                            </div>
                            <div className="mt-1 text-xs text-white/60">
                              Concluídos: {d.completed} · Pendentes: {d.pending} · Cancelados: {d.canceled}
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {selectedDay ? (
                      <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4">
                        <div className="font-semibold">Treinos de {formatBRFull(selectedDay)}</div>

                        <div className="mt-3 space-y-3">
                          {(weekDays.find((x) => x.day === selectedDay)?.workouts || []).length === 0 ? (
                            <div className="text-sm text-white/70">Nenhum treino neste dia.</div>
                          ) : (
                            (weekDays.find((x) => x.day === selectedDay)?.workouts || []).map((w: any) => {
                              const ex = latest[w.id];

                              const progress =
                                w.portal_progress_label ||
                                (w.status === 'canceled'
                                  ? 'Cancelado'
                                  : ex?.status === 'completed'
                                    ? `Concluído (${formatBRShort(ex.performed_at || ex.completed_at || null)})`
                                    : ex?.status === 'running' || ex?.status === 'paused' || ex?.status === 'in_progress'
                                      ? 'Em andamento'
                                      : w.status === 'ready'
                                        ? 'Pendente'
                                        : '—');

                              const title = w.title || TEMPLATE_LABEL[w.template_type] || 'Treino';
                              const tpl = TEMPLATE_LABEL[w.template_type] || 'Treino';

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
                            })
                          )}
                        </div>
                      </div>
                    ) : null}
                  </>
                )}
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="font-semibold">Treinos da semana</div>

                {workouts.length === 0 ? (
                  <div className="mt-3 text-sm text-white/70">Nenhum treino publicado para esta semana ainda.</div>
                ) : (
                  <div className="mt-3 space-y-3">
                    {workouts.map((w: any) => {
                      const ex = latest[w.id];

                      const progress =
                        w.portal_progress_label ||
                        (w.status === 'canceled'
                          ? 'Cancelado'
                          : ex?.status === 'completed'
                            ? `Concluído (${formatBRShort(ex.performed_at || ex.completed_at || null)})`
                            : ex?.status === 'running' || ex?.status === 'paused' || ex?.status === 'in_progress'
                              ? 'Em andamento'
                              : w.status === 'ready'
                                ? 'Pendente'
                                : '—');

                      const title = w.title || TEMPLATE_LABEL[w.template_type] || 'Treino';
                      const tpl = TEMPLATE_LABEL[w.template_type] || 'Treino';

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
