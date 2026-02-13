'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '../../../lib/supabaseBrowser';

type StudentRow = {
  id: string;
  name: string;
  email: string | null;
  trainer_id: string;
  public_slug: string | null;
  portal_token: string | null;
  portal_enabled: boolean;
  p1k_sec_per_km: number | null;
};

type WeekRow = {
  id: string;
  week_start: string; // YYYY-MM-DD
  week_end: string | null; // YYYY-MM-DD
  label: string | null;
};

type WorkoutRow = {
  id: string;
  title: string | null;
  status: 'draft' | 'ready' | 'archived' | 'canceled';
  template_type: string | null;
  total_km: number | null;

  include_warmup: boolean | null;
  warmup_km: number | null;
  include_cooldown: boolean | null;
  cooldown_km: number | null;

  planned_date: string | null; // YYYY-MM-DD
  planned_day: number | null; // 0..6

  share_slug: string | null;
  week_id: string | null;

  blocks: any[];
};

type ExecutionRow = {
  id: string;
  workout_id: string;
  status: 'running' | 'paused' | 'completed';
  performed_at: string | null;
  last_event_at: string;
  started_at: string;
  completed_at: string | null;
};

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function toISODate(d: Date) {
  const yyyy = d.getFullYear();
  const mm = pad2(d.getMonth() + 1);
  const dd = pad2(d.getDate());
  return `${yyyy}-${mm}-${dd}`;
}

function addDaysISO(iso: string, days: number) {
  const d = new Date(iso + 'T12:00:00'); // evita problemas de fuso
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

function formatBRShort(iso: string | null | undefined) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}`;
}

function formatWeekRange(weekStart: string, weekEnd: string | null) {
  const we = weekEnd || addDaysISO(weekStart, 6);
  return `Semana ${formatBRShort(weekStart)} – ${formatBRShort(we)}`;
}

function mondayOfWeek(d: Date) {
  const day = d.getDay(); // 0..6 (Dom..Sáb)
  const diff = (day + 6) % 7; // dias desde segunda
  const out = new Date(d);
  out.setDate(d.getDate() - diff);
  out.setHours(0, 0, 0, 0);
  return out;
}

function formatPace(secPerKm: number | null) {
  if (!secPerKm || secPerKm <= 0) return '—';
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${pad2(s)}/km`;
}

function formatKm(v: number | null | undefined) {
  if (v == null) return '—';
  const n = Number(v);
  if (Number.isNaN(n)) return '—';
  return `${new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(n)} km`;
}

const DOW_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function plannedLabel(workout: WorkoutRow, weekStart?: string | null) {
  let iso = workout.planned_date || null;

  // fallback antigo: planned_day + week_start
  if (!iso && weekStart && workout.planned_day != null) {
    iso = addDaysISO(weekStart, Number(workout.planned_day));
  }
  if (!iso) return '—';

  const d = new Date(iso + 'T12:00:00');
  const dow = DOW_PT[d.getDay()];
  const [y, m, dd] = iso.split('-');
  return `${dow}, ${dd}/${m}`;
}

const TEMPLATE_LABEL: Record<string, string> = {
  easy_run: 'Rodagem',
  progressive: 'Progressivo',
  alternated: 'Alternado',
  run: 'Rodagem',
};

const STATUS_LABEL: Record<string, string> = {
  draft: 'Rascunho',
  ready: 'Publicado',
  archived: 'Arquivado',
  canceled: 'Cancelado',
};

export default function StudentDetailPage() {
  const router = useRouter();
  const params = useParams();
  const studentId = (params?.id as string) || '';

  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<string | null>(null);

  const [student, setStudent] = useState<StudentRow | null>(null);
  const [weeks, setWeeks] = useState<WeekRow[]>([]);
  const [selectedWeekId, setSelectedWeekId] = useState<string>('');

  const [workouts, setWorkouts] = useState<WorkoutRow[]>([]);
  const [latestExecByWorkout, setLatestExecByWorkout] = useState<Record<string, ExecutionRow | null>>({});

  const currentWeekStartISO = useMemo(() => toISODate(mondayOfWeek(new Date())), []);

  async function loadStudent() {
    setLoading(true);
    setBanner(null);

    const { data, error } = await supabase
      .from('students')
      .select('id,name,email,trainer_id,public_slug,portal_token,portal_enabled,p1k_sec_per_km')
      .eq('id', studentId)
      .single();

    if (error) {
      setBanner(error.message);
      setStudent(null);
      setLoading(false);
      return;
    }

    setStudent(data as any);
    setLoading(false);
  }

  async function upsertWeeks(table: 'weeks' | 'training_weeks', rows: any[]) {
    return await supabase.from(table).upsert(rows, { onConflict: 'student_id,week_start' }).select('id,week_start,week_end,label');
  }

  async function selectWeeks(table: 'weeks' | 'training_weeks', sid: string) {
    return await supabase
      .from(table)
      .select('id,week_start,week_end,label')
      .eq('student_id', sid)
      .order('week_start', { ascending: false });
  }

  async function ensureUpcomingWeeks(st: StudentRow) {
    setBanner(null);

    const baseStart = currentWeekStartISO;
    const rows = Array.from({ length: 8 }).map((_, i) => {
      const ws = addDaysISO(baseStart, i * 7);
      const we = addDaysISO(ws, 6);
      const label = `Semana ${formatBRShort(ws)} – ${formatBRShort(we)}`;
      return { student_id: st.id, trainer_id: st.trainer_id, week_start: ws, week_end: we, label };
    });

    let tableToUse: 'weeks' | 'training_weeks' = 'weeks';

    // tenta "weeks", se não existir cai pra "training_weeks"
    let up = await upsertWeeks('weeks', rows);
    const msg = String(up.error?.message || '').toLowerCase();
    if (up.error && msg.includes('relation') && msg.includes('weeks')) {
      tableToUse = 'training_weeks';
      up = await upsertWeeks('training_weeks', rows);
    }

    if (up.error) {
      setBanner(up.error.message);
      return;
    }

    const sel = await selectWeeks(tableToUse, st.id);
    if (sel.error) {
      setBanner(sel.error.message);
      return;
    }

    const list = (sel.data || []) as any[];
    setWeeks(list as any);

    const current = list.find((w) => w.week_start === baseStart) || list[0];
    if (current) setSelectedWeekId(current.id);
  }

  async function loadLatestExecutions(workoutIds: string[]) {
    if (workoutIds.length === 0) {
      setLatestExecByWorkout({});
      return;
    }

    const { data: exs, error } = await supabase
      .from('executions')
      .select('id,workout_id,status,performed_at,last_event_at,started_at,completed_at')
      .in('workout_id', workoutIds)
      .order('last_event_at', { ascending: false, nullsFirst: false });

    if (error) {
      setBanner(error.message);
      return;
    }

    const byWorkout: Record<string, ExecutionRow | null> = {};
    for (const wId of workoutIds) byWorkout[wId] = null;

    for (const ex of (exs || []) as any[]) {
      const wId = ex.workout_id as string;
      if (!byWorkout[wId]) byWorkout[wId] = ex as any;
    }

    setLatestExecByWorkout(byWorkout);
  }

  async function loadWorkoutsForWeek(weekId: string) {
    if (!weekId) return;
    setBanner(null);

    const { data, error } = await supabase
      .from('workouts')
      .select(
        'id,title,status,template_type,total_km,include_warmup,warmup_km,include_cooldown,cooldown_km,planned_date,planned_day,share_slug,week_id,blocks'
      )
      .eq('week_id', weekId)
      .order('planned_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true });

    if (error) {
      setBanner(error.message);
      setWorkouts([]);
      return;
    }

    const rows = (data || []) as any[];
    setWorkouts(rows as any);
    await loadLatestExecutions(rows.map((r) => r.id));
  }

  async function publishWeek() {
    if (!selectedWeekId) return;
    setBanner(null);

    const ids = workouts.filter((w) => w.status === 'draft').map((w) => w.id);
    if (ids.length === 0) return;

    const { error } = await supabase.from('workouts').update({ status: 'ready' }).in('id', ids);
    if (error) {
      setBanner(error.message);
      return;
    }

    await loadWorkoutsForWeek(selectedWeekId);
  }

  async function publishWorkout(workoutId: string) {
    setBanner(null);
    const { error } = await supabase.from('workouts').update({ status: 'ready' }).eq('id', workoutId);
    if (error) {
      setBanner(error.message);
      return;
    }
    await loadWorkoutsForWeek(selectedWeekId);
  }

  async function sharePortal() {
    if (!student) return;
    setBanner(null);

    if (student.portal_enabled && student.portal_token && student.public_slug) {
      const url = `${window.location.origin}/p/${student.public_slug}?t=${encodeURIComponent(student.portal_token)}`;
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }

    const { data, error } = await supabase
      .from('students')
      .update({ portal_enabled: true })
      .eq('id', student.id)
      .select('id,name,email,trainer_id,public_slug,portal_token,portal_enabled,p1k_sec_per_km')
      .single();

    if (error) {
      setBanner(error.message);
      return;
    }

    setStudent(data as any);

    if ((data as any).portal_token && (data as any).public_slug) {
      const url = `${window.location.origin}/p/${(data as any).public_slug}?t=${encodeURIComponent((data as any).portal_token)}`;
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }

  function openPortalPreview() {
    if (!student?.public_slug || !student.portal_token) {
      setBanner('Portal não está habilitado para este aluno.');
      return;
    }
    const url = `${window.location.origin}/p/${student.public_slug}?t=${encodeURIComponent(student.portal_token)}&preview=1`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  function openWorkoutPreview(workoutId: string) {
    if (!student?.public_slug || !student.portal_token) {
      setBanner('Portal não está habilitado para este aluno.');
      return;
    }
    const url = `${window.location.origin}/p/${student.public_slug}/workouts/${workoutId}?t=${encodeURIComponent(student.portal_token)}&preview=1`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  useEffect(() => {
    if (!studentId) return;
    void loadStudent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  useEffect(() => {
    if (!student) return;
    void ensureUpcomingWeeks(student);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student?.id]);

  useEffect(() => {
    void loadWorkoutsForWeek(selectedWeekId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWeekId]);

  const selectedWeek = weeks.find((w) => w.id === selectedWeekId) || null;

  const readyCount = workouts.filter((w) => w.status === 'ready').length;
  const draftCount = workouts.filter((w) => w.status === 'draft').length;
  const completedCount = workouts.filter((w) => latestExecByWorkout[w.id]?.status === 'completed').length;

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="rounded-2xl bg-white dark:bg-surface-dark shadow p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm text-slate-600 dark:text-slate-300">Aluno</div>
              <div className="text-xl font-semibold truncate">{student?.name ?? '—'}</div>
              <div className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                Ritmo P1k: <span className="font-semibold">{formatPace(student?.p1k_sec_per_km ?? null)}</span>
                {student?.email ? <> · {student.email}</> : null}
              </div>
            </div>

            <div className="shrink-0 flex flex-col items-end gap-2">
              <button className="text-sm underline text-slate-600 dark:text-slate-300" onClick={() => router.push('/students')}>
                Voltar
              </button>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-1 sm:grid-cols-4 gap-2">
            <button
              className="px-3 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold disabled:opacity-50"
              disabled={!selectedWeekId}
              onClick={() => router.push(`/students/${studentId}/workouts/new?weekId=${selectedWeekId}`)}
            >
              + Programar treino
            </button>

            <button
              className="px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-sm font-semibold disabled:opacity-50"
              disabled={!studentId}
              onClick={() => router.push(`/students/${studentId}/reports/4w`)}
            >
              Relatório 4 semanas
            </button>

            <button className="px-3 py-2 rounded-lg bg-primary text-slate-900 text-sm font-semibold" onClick={sharePortal}>
              Compartilhar portal
            </button>

            <button className="px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-sm font-semibold" onClick={openPortalPreview}>
              Ver como aluno (QA)
            </button>
          </div>
        </div>

        {banner && (
          <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 p-3 text-sm text-amber-800 dark:text-amber-200">{banner}</div>
        )}

        {loading ? (
          <div className="text-sm text-slate-600 dark:text-slate-300">Carregando…</div>
        ) : (
          <>
            <div className="rounded-2xl bg-white dark:bg-surface-dark shadow p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold">Planejamento por semana (Seg → Dom)</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {selectedWeek ? (selectedWeek.label || formatWeekRange(selectedWeek.week_start, selectedWeek.week_end)) : '—'}
                  </div>
                </div>

                <div className="flex flex-col gap-2 items-end">
                  <button
                    className="px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-sm font-semibold disabled:opacity-50"
                    disabled={!selectedWeekId}
                    onClick={() => router.push(`/dashboard/week/${selectedWeekId}`)}
                  >
                    Painel da semana
                  </button>

                  <button
                    className="px-3 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold disabled:opacity-50"
                    disabled={!selectedWeekId || draftCount === 0}
                    onClick={publishWeek}
                    title={draftCount === 0 ? 'Nada para publicar' : 'Publica todos os treinos em rascunho da semana'}
                  >
                    Publicar semana
                  </button>
                </div>
              </div>

              {weeks.length === 0 ? (
                <div className="mt-3 text-sm text-slate-600 dark:text-slate-300">Não foi possível carregar semanas.</div>
              ) : (
                <div className="mt-3 flex gap-2 overflow-x-auto no-scrollbar">
                  {weeks.map((w) => {
                    const active = w.id === selectedWeekId;
                    const label = w.label || formatWeekRange(w.week_start, w.week_end);
                    // botão curto no mobile: "09/02 – 15/02"
                    const short = w.week_start ? `${formatBRShort(w.week_start)} – ${formatBRShort(w.week_end || addDaysISO(w.week_start, 6))}` : label;
                    return (
                      <button
                        key={w.id}
                        onClick={() => setSelectedWeekId(w.id)}
                        className={
                          'px-3 py-2 rounded-full text-sm font-semibold whitespace-nowrap border ' +
                          (active
                            ? 'bg-primary text-slate-900 border-transparent'
                            : 'bg-white dark:bg-surface-dark border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200')
                        }
                        title={label}
                      >
                        {short}
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="mt-3 flex flex-wrap gap-2">
                <div className="px-3 py-2 rounded-full bg-slate-100 dark:bg-slate-800 text-sm font-semibold">
                  Programados: {workouts.length}
                </div>
                <div className="px-3 py-2 rounded-full bg-slate-100 dark:bg-slate-800 text-sm font-semibold">Publicados: {readyCount}</div>
                <div className="px-3 py-2 rounded-full bg-slate-100 dark:bg-slate-800 text-sm font-semibold">Concluídos: {completedCount}</div>
              </div>
            </div>

            <div className="rounded-2xl bg-white dark:bg-surface-dark shadow p-4">
              <div className="font-semibold">Treinos da semana</div>

              {workouts.length === 0 ? (
                <div className="mt-3 text-sm text-slate-600 dark:text-slate-300">Nenhum treino nesta semana.</div>
              ) : (
                <div className="mt-3 space-y-3">
                  {workouts.map((w) => {
                    const ex = latestExecByWorkout[w.id]; // se existe, tem execução
                    const hasExecution = !!ex;

                    const templateLabel = w.template_type ? TEMPLATE_LABEL[w.template_type] || w.template_type : '—';
                    const statusLabel = STATUS_LABEL[w.status] || w.status;

                    const whenLabel = plannedLabel(w, selectedWeek?.week_start);

                    // regras solicitadas:
                    const canEdit = !hasExecution; // só edita se NÃO tem execução
                    const canPublish = w.status === 'draft' && !hasExecution; // se já está publicado, não mostra Publicar

                    return (
                      <div key={w.id} className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm text-slate-600 dark:text-slate-300">
                              {whenLabel} · {statusLabel} · {templateLabel} · {formatKm(w.total_km)}
                            </div>
                            <div className="text-lg font-semibold truncate">{w.title || 'Treino'}</div>
                            <div className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                              Execução do aluno:{' '}
                              {ex?.status === 'completed'
                                ? `Concluído (${ex.performed_at ? formatBRShort(ex.performed_at) : '—'})`
                                : hasExecution
                                  ? 'Em andamento'
                                  : '—'}
                            </div>
                          </div>

                          <div className="shrink-0 flex flex-col gap-2 items-end">
                            {canEdit ? (
                              <button
                                className="px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-sm font-semibold"
                                onClick={() => router.push(`/workouts/${w.id}/edit`)}
                              >
                                Editar
                              </button>
                            ) : null}

                            {canPublish ? (
                              <button
                                className="px-3 py-2 rounded-lg bg-primary text-slate-900 text-sm font-semibold"
                                onClick={() => publishWorkout(w.id)}
                              >
                                Publicar
                              </button>
                            ) : null}

                            <button
                              className="px-3 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold"
                              onClick={() => openWorkoutPreview(w.id)}
                            >
                              Ver no portal (QA)
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
