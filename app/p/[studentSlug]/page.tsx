'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '../../../lib/supabaseBrowser';

type WeekRow = { id: string; week_start: string; week_end: string | null; label: string | null };

type SummaryResponse = {
  ok: boolean;
  error?: string;
  student?: { id: string; name: string; public_slug: string | null; portal_token?: string | null };
  weeks?: WeekRow[];
  week?: WeekRow | null;
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

function weekLabel(w: WeekRow) {
  const end = w.week_end || addDaysISO(w.week_start, 6);
  return w.label || `${formatBRShort(w.week_start)} – ${formatBRShort(end)}`;
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

  const supabase = useMemo(() => createClient(), []);
  const [hasSession, setHasSession] = useState(false);

  const studentSlug = params.studentSlug;
  const t = search.get('t') || '';
  const preview = search.get('preview') === '1';

  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<string | null>(null);
  const [data, setData] = useState<SummaryResponse | null>(null);

  const [weekId, setWeekId] = useState<string | null>(null);

  const token = useMemo(() => t, [t]);

  // Se o aluno estiver logado (Auth), mostramos o botão “Sair” também no portal /p/...
  useEffect(() => {
    let alive = true;

    async function check() {
      const { data } = await supabase.auth.getSession();
      if (!alive) return;
      setHasSession(!!data.session);
    }

    void check();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setHasSession(!!session);
    });

    return () => {
      alive = false;
      listener.subscription.unsubscribe();
    };
  }, [supabase]);

  async function onLogout() {
    try {
      await supabase.auth.signOut();
    } finally {
      router.push('/aluno/login');
    }
  }

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      setBanner(null);

      try {
        let url = `/api/portal/summary?slug=${encodeURIComponent(studentSlug)}&t=${encodeURIComponent(token)}`;
        if (weekId) url += `&weekId=${encodeURIComponent(weekId)}`;

        const res = await fetch(url, { cache: 'no-store' });
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
  }, [studentSlug, token, weekId]);

  const week = data?.week || null;
  const weeks = data?.weeks || [];
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
      // d.workouts.sort((a, b) => Number(a.planned_order || 0) - Number(b.planned_order || 0));
    }

    return days;
  }, [week?.week_start, workouts, latest]);

  function goToWorkout(workoutId: string) {
    const q = new URLSearchParams({ t: token });
    if (preview) q.set('preview', '1');
    router.push(`/p/${studentSlug}/workouts/${workoutId}?${q.toString()}`);
  }

  // Bottom-sheet para dias com 2+ treinos
  const [sheetDay, setSheetDay] = useState<DayAgg | null>(null);

  // Estado/refs de drag do sheet
  const [sheetTranslateY, setSheetTranslateY] = useState(0);
  const [sheetDragging, setSheetDragging] = useState(false);

  const dragRef = useRef<{
    active: boolean;
    pointerId: number;
    startY: number;
    startTime: number;
    lastY: number;
    lastTime: number;
  }>({
    active: false,
    pointerId: -1,
    startY: 0,
    startTime: 0,
    lastY: 0,
    lastTime: 0,
  });

  function vibrateClose() {
    try {
      if (typeof navigator !== 'undefined' && typeof (navigator as any).vibrate === 'function') {
        (navigator as any).vibrate(10);
      }
    } catch {}
  }

  function closeSheetAnimated() {
    setSheetDragging(true);
    setSheetTranslateY(420);
    window.setTimeout(() => {
      setSheetDay(null);
      setSheetTranslateY(0);
      setSheetDragging(false);
      vibrateClose();
    }, 140);
  }

  function onSheetPointerDown(e: React.PointerEvent) {
    dragRef.current.active = true;
    dragRef.current.pointerId = e.pointerId;
    dragRef.current.startY = e.clientY;
    dragRef.current.startTime = performance.now();
    dragRef.current.lastY = e.clientY;
    dragRef.current.lastTime = dragRef.current.startTime;
    setSheetDragging(true);
    try {
      (e.currentTarget as any).setPointerCapture?.(e.pointerId);
    } catch {}
  }

  function onSheetPointerMove(e: React.PointerEvent) {
    if (!dragRef.current.active) return;
    if (dragRef.current.pointerId !== e.pointerId) return;

    const dy = e.clientY - dragRef.current.startY;
    dragRef.current.lastY = e.clientY;
    dragRef.current.lastTime = performance.now();

    setSheetTranslateY(Math.max(0, dy));
  }

  function onSheetPointerUp(e: React.PointerEvent) {
    if (!dragRef.current.active) return;
    if (dragRef.current.pointerId !== e.pointerId) return;

    dragRef.current.active = false;
    const dy = e.clientY - dragRef.current.startY;

    const dt = (performance.now() - dragRef.current.startTime) || 1;
    const v = dy / dt; // px/ms

    const shouldClose = dy > 160 || (dy > 70 && v > 0.9);

    if (shouldClose) {
      closeSheetAnimated();
      return;
    }

    setSheetDragging(false);
    setSheetTranslateY(0);
  }

  // Chips
  const chipsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!week?.id) return;
    if (!chipsRef.current) return;

    // Centraliza chip ativo no scroll
    const root = chipsRef.current;
    const active = root.querySelector<HTMLButtonElement>(`button[data-week-id="${week.id}"]`);
    if (!active) return;

    const rootRect = root.getBoundingClientRect();
    const btnRect = active.getBoundingClientRect();
    const delta = btnRect.left - rootRect.left - (rootRect.width / 2 - btnRect.width / 2);

    root.scrollTo({ left: root.scrollLeft + delta, behavior: 'smooth' });
  }, [week?.id, weeks.length]);

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
              <div className="mt-1 text-xs text-amber-200">
                Modo de teste (prévia do treinador): registro de execução desabilitado.
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
            <button
              className="text-sm underline text-white/70 hover:text-white"
              onClick={() => {
                const studentId = data?.student?.id;
                if (!studentId) return;
                const q = new URLSearchParams();
                if (token) q.set('t', token);
                if (preview) q.set('preview', '1');
                router.push(`/students/${studentId}/reports/4w?${q.toString()}`);
              }}
            >
              Relatório 4 semanas
            </button>

            <button className="text-sm underline text-white/70 hover:text-white" onClick={() => window.location.reload()}>
              Atualizar
            </button>

            {!preview && hasSession ? (
              <button className="text-sm underline text-white/70 hover:text-white" onClick={onLogout}>
                Sair
              </button>
            ) : null}
          </div>
        </div>
      </header>

      <main className="px-6 py-6">
        <div className="mx-auto max-w-3xl space-y-4">
          {banner ? (
            <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-4 text-sm text-amber-200">
              {banner}
            </div>
          ) : null}

          {weeks.length ? (
            <div
              ref={chipsRef}
              className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scroll-smooth"
              style={{ WebkitOverflowScrolling: 'touch' as any }}
            >
              {weeks.map((w) => {
                const active = w.id === week?.id;
                return (
                  <button
                    key={w.id}
                    data-week-id={w.id}
                    onClick={() => setWeekId(w.id)}
                    className={[
                      'shrink-0 rounded-full px-4 py-2 text-sm font-semibold border',
                      active
                        ? 'bg-emerald-500 text-black border-emerald-400'
                        : 'bg-white/5 text-white/80 border-white/10 hover:bg-white/10',
                    ].join(' ')}
                  >
                    {`Semana ${weekLabel(w)}`}
                  </button>
                );
              })}
            </div>
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
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {weekDays.map((d) => {
                      const hasWorkout = d.workouts_count > 0;

                      const actionLabel =
                        !hasWorkout
                          ? 'Sem treinos'
                          : d.workouts_count === 1
                            ? 'Ver treino →'
                            : `Ver ${d.workouts_count} treinos →`;

                      return (
                        <button
                          key={d.day}
                          disabled={!hasWorkout}
                          onClick={() => {
                            if (!hasWorkout) return;

                            if (d.workouts_count === 1) {
                              const only = d.workouts[0];
                              if (!only?.id) return;
                              goToWorkout(String(only.id));
                              return;
                            }

                            setSheetDay(d);
                          }}
                          className={[
                            'text-left rounded-2xl border p-4 transition',
                            hasWorkout
                              ? 'border-white/10 bg-white/5 hover:bg-white/10'
                              : 'border-white/5 bg-white/3 opacity-70 cursor-default',
                          ].join(' ')}
                        >
                          <div className="text-sm text-white/60">{formatBRFull(d.day)}</div>

                          <div className="mt-2 flex items-end justify-between gap-3">
                            <div>
                              <div className="text-lg font-extrabold">{d.workouts_count} treino(s)</div>
                              <div className="text-sm text-white/70 mt-1">
                                previsto <b>{kmLabel(d.planned_km)}</b> km · real <b>{kmLabel(d.actual_km)}</b> km
                              </div>
                            </div>

                            <div className="text-right text-xs text-white/60">
                              <div>
                                Concluídos: <b className="text-white/80">{d.completed}</b> · Pendentes:{' '}
                                <b className="text-white/80">{d.pending}</b>
                              </div>
                              <div>
                                Cancelados: <b className="text-white/80">{d.canceled}</b>
                              </div>
                              <div className="mt-2 text-sm underline text-white/70">{actionLabel}</div>
                            </div>
                          </div>

                          {d.workouts_count === 1 && d.workouts[0] ? (
                            <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-3">
                              <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="text-sm font-semibold truncate">
                                    {d.workouts[0].title || TEMPLATE_LABEL[d.workouts[0].template_type] || 'Treino'}
                                  </div>
                                  <div className="text-xs text-white/60 mt-0.5">
                                    {d.workouts[0].status === 'canceled'
                                      ? 'Cancelado'
                                      : d.workouts[0].execution_label
                                        ? `Disponível · ${d.workouts[0].execution_label}`
                                        : 'Disponível'}
                                  </div>
                                </div>
                                <div className="text-sm text-white/70">Ver treino →</div>
                              </div>
                            </div>
                          ) : null}
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

      {sheetDay ? (
        <div className="fixed inset-0 z-50">
          <button
            className="absolute inset-0 bg-black/60"
            onClick={closeSheetAnimated}
            aria-label="Fechar"
          />

          <div
            className={[
              'absolute left-0 right-0 bottom-0 mx-auto max-w-3xl rounded-t-3xl border border-white/10 bg-[#0b1220] p-4',
              sheetDragging ? 'transition-none' : 'transition-transform duration-150 ease-out',
            ].join(' ')}
            style={{ transform: `translateY(${sheetTranslateY}px)` }}
          >
            <div
              className="mx-auto mb-2 h-1.5 w-14 rounded-full bg-white/20"
              onPointerDown={onSheetPointerDown}
              onPointerMove={onSheetPointerMove}
              onPointerUp={onSheetPointerUp}
              onPointerCancel={onSheetPointerUp}
            />

            <div className="flex items-center justify-between gap-3">
              <div className="font-semibold">Treinos em {formatBRFull(sheetDay.day)}</div>
              <button className="text-sm underline text-white/70" onClick={closeSheetAnimated}>
                Fechar
              </button>
            </div>

            <div className="mt-3 space-y-2">
              {sheetDay.workouts.map((w: any) => (
                <button
                  key={w.id}
                  onClick={() => goToWorkout(String(w.id))}
                  className="w-full text-left rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate">
                        {w.title || TEMPLATE_LABEL[w.template_type] || 'Treino'}
                      </div>
                      <div className="text-xs text-white/60 mt-0.5">
                        {w.status === 'canceled'
                          ? 'Cancelado'
                          : w.execution_label
                            ? `Disponível · ${w.execution_label}`
                            : 'Disponível'}
                      </div>
                    </div>
                    <div className="text-sm text-white/70">Ver treino →</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
