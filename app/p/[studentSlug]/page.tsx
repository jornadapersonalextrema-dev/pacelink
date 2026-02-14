'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
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
      // Se existir um campo de ordem, pode ordenar aqui sem quebrar:
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
  const [sheetClosing, setSheetClosing] = useState(false);

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

  function closeSheetAnimated() {
    if (!sheetDay) return;
    setSheetClosing(true);
    setSheetDragging(false);

    const h =
      typeof window !== 'undefined'
        ? Math.max(window.innerHeight || 0, document.documentElement?.clientHeight || 0)
        : 800;

    setSheetTranslateY(h);

    window.setTimeout(() => {
      setSheetDay(null);
      setSheetTranslateY(0);
      setSheetClosing(false);
      dragRef.current.active = false;
      dragRef.current.pointerId = -1;
    }, 220);
  }

  useEffect(() => {
    // quando muda a semana, fecha sheet
    setSheetDay(null);
  }, [week?.id]);

  useEffect(() => {
    // ao abrir sheet, reset animação/posição
    if (sheetDay) {
      setSheetTranslateY(0);
      setSheetDragging(false);
      setSheetClosing(false);
      dragRef.current.active = false;
      dragRef.current.pointerId = -1;
    }
  }, [sheetDay?.day]);

  useEffect(() => {
    // trava scroll do body quando sheet abre
    if (!sheetDay) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [sheetDay]);

  function onSheetGrabPointerDown(e: React.PointerEvent) {
    // apenas botão esquerdo/mão ou toque
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    dragRef.current.active = true;
    dragRef.current.pointerId = e.pointerId;
    dragRef.current.startY = e.clientY;
    dragRef.current.lastY = e.clientY;
    dragRef.current.startTime = performance.now();
    dragRef.current.lastTime = dragRef.current.startTime;

    setSheetDragging(true);

    try {
      (e.currentTarget as any).setPointerCapture?.(e.pointerId);
    } catch {
      // ignore
    }
  }

  function onSheetGrabPointerMove(e: React.PointerEvent) {
    if (!dragRef.current.active) return;
    if (dragRef.current.pointerId !== e.pointerId) return;

    const dy = e.clientY - dragRef.current.startY;
    const clamped = Math.max(0, dy);

    setSheetTranslateY(clamped);

    dragRef.current.lastY = e.clientY;
    dragRef.current.lastTime = performance.now();
  }

  function onSheetGrabPointerEnd(e: React.PointerEvent) {
    if (!dragRef.current.active) return;
    if (dragRef.current.pointerId !== e.pointerId) return;

    const dy = Math.max(0, dragRef.current.lastY - dragRef.current.startY);
    const dt = Math.max(1, dragRef.current.lastTime - dragRef.current.startTime); // ms
    const v = dy / dt; // px/ms

    dragRef.current.active = false;
    dragRef.current.pointerId = -1;

    // thresholds:
    // - dy grande fecha
    // - ou "flick" (velocidade) fecha mesmo com dy médio
    const shouldClose = dy > 160 || (dy > 70 && v > 0.9);

    if (shouldClose) {
      closeSheetAnimated();
      return;
    }

    // voltar suavemente
    setSheetDragging(false);
    setSheetTranslateY(0);
  }

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

          <div className="flex items-center gap-3">
            <button
              className="text-sm underline text-white/70"
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

            <button className="text-sm underline text-white/70" onClick={() => window.location.reload()}>
              Atualizar
            </button>
          </div>
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
                          className={`rounded-xl border px-4 py-3 text-left transition ${
                            hasWorkout
                              ? 'bg-black/20 border-white/10 hover:bg-black/30'
                              : 'bg-black/10 border-white/5 opacity-60 cursor-default'
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

                          <div className="mt-2 text-xs text-white/70">{actionLabel}</div>
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

      {/* Bottom-sheet (somente quando tiver 2+ treinos no mesmo dia) */}
      {sheetDay ? (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={`Treinos de ${formatBRFull(sheetDay.day)}`}>
          {/* backdrop */}
          <button
            className="absolute inset-0 bg-black/70"
            aria-label="Fechar"
            onClick={() => closeSheetAnimated()}
          />

          {/* sheet container */}
          <div className="absolute inset-x-0 bottom-0">
            <div className="mx-auto max-w-3xl px-4 pb-6">
              <div
                className="rounded-2xl border border-white/10 bg-background-dark shadow-2xl overflow-hidden"
                style={{
                  transform: `translateY(${sheetTranslateY}px)`,
                  transition: sheetDragging ? 'none' : 'transform 200ms ease-out',
                }}
              >
                {/* Grabber/drag area (não interfere no scroll da lista) */}
                <div
                  className="pt-3 pb-2 border-b border-white/10"
                  style={{ touchAction: 'none' }}
                  onPointerDown={onSheetGrabPointerDown}
                  onPointerMove={onSheetGrabPointerMove}
                  onPointerUp={onSheetGrabPointerEnd}
                  onPointerCancel={onSheetGrabPointerEnd}
                >
                  <div className="h-1.5 w-12 rounded-full bg-white/20 mx-auto" />
                  <div className="mt-2 px-4 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs text-white/60">Treinos de</div>
                      <div className="font-semibold truncate">{formatBRFull(sheetDay.day)}</div>
                    </div>

                    <button
                      className="text-sm underline text-white/70"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        closeSheetAnimated();
                      }}
                    >
                      Fechar
                    </button>
                  </div>
                </div>

                {/* content */}
                <div className="p-4 space-y-3 max-h-[70vh] overflow-auto">
                  {sheetDay.workouts.map((w: any) => {
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
                          const id = String(w.id || '');
                          if (!id) return;
                          // fecha animado e navega
                          closeSheetAnimated();
                          // garante que navegue depois do sheet começar a fechar (evita flicker)
                          window.setTimeout(() => goToWorkout(id), 120);
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

                {/* safe area */}
                <div className="pb-2" />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
