'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '../../../lib/supabaseBrowser';

type StudentRow = {
  id: string;
  name: string;
  trainer_id: string;
  public_slug: string | null;
  portal_token: string | null;
  portal_enabled: boolean;
};

type WeekRow = {
  id: string;
  week_start: string;
  week_end: string | null;
  label: string | null;
  status: 'draft' | 'ready' | 'archived';
};

type WorkoutRow = {
  id: string;
  student_id: string;
  trainer_id: string;
  week_id: string | null;
  status: 'draft' | 'ready' | 'archived' | 'canceled';
  template_type: string;
  title: string | null;
  total_km: number;
  planned_date: string | null;
  planned_day: number | null;
  locked_at: string | null;
  created_at: string;
  updated_at: string | null;
  published_at: string | null;
};

type ExecutionRow = {
  id: string;
  workout_id: string;
  status: string | null;
  performed_at: string | null;
  last_event_at: string | null;
};

const TEMPLATE_LABEL: Record<string, string> = {
  easy_run: 'Rodagem',
  intervals: 'Intervalado',
  long_run: 'Longão',
  tempo: 'Ritmo',
};

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function isoFromParts(y: number, m: number, d: number) {
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

function saoPauloISODateNow(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const y = Number(parts.find((p) => p.type === 'year')?.value || 1970);
  const m = Number(parts.find((p) => p.type === 'month')?.value || 1);
  const d = Number(parts.find((p) => p.type === 'day')?.value || 1);
  return isoFromParts(y, m, d);
}

function isoToUTCDate(iso: string) {
  const [y, m, d] = String(iso).split('-').map((x) => Number(x));
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1));
}

function addDaysISO(iso: string, days: number) {
  const dt = isoToUTCDate(iso);
  dt.setUTCDate(dt.getUTCDate() + days);
  return isoFromParts(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

function startOfWeekMondayISO_SaoPaulo(now = new Date()) {
  // Monday=1 ... Sunday=7
  const wd = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'short',
  }).format(now);

  const map: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  const dow = map[wd] || 1;

  const todayISO = saoPauloISODateNow(now);
  return addDaysISO(todayISO, -(dow - 1));
}

function formatBRShort(iso: string) {
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}`;
}

function formatBRFull(iso: string) {
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

function formatWeekRange(ws: string, we: string) {
  return `${formatBRShort(ws)} – ${formatBRShort(we)}`;
}

function weekdayShortPtBR(iso: string) {
  try {
    // Usa meio-dia UTC para evitar "voltar um dia" por fuso
    const dt = new Date(`${iso}T12:00:00Z`);
    const wd = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'short' }).format(dt);
    const clean = wd.replace('.', '');
    return clean.charAt(0).toUpperCase() + clean.slice(1);
  } catch {
    return '';
  }
}

function formatPlannedLabel(iso: string | null) {
  if (!iso) return 'Sem data';
  return `${weekdayShortPtBR(iso)} · ${formatBRShort(iso)}`;
}

function toMs(ts: string | null | undefined) {
  if (!ts) return null;
  const ms = Date.parse(ts);
  return Number.isFinite(ms) ? ms : null;
}

function workoutNeedsRepublish(w: { status: string; updated_at?: string | null; published_at?: string | null }) {
  if (w.status !== 'ready') return false;
  const pub = toMs(w.published_at ?? null);
  const upd = toMs(w.updated_at ?? null);

  // se published_at ainda não existe/foi preenchido (dados antigos), permite "Republicar" para corrigir
  if (pub == null && upd != null) return true;
  if (pub == null || upd == null) return false;

  return upd > pub;
}

function kmLabel(km: number | null) {
  if (km == null || !Number.isFinite(Number(km))) return '0,0';
  return Number(km).toFixed(1).replace('.', ',');
}

export default function StudentPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const studentId = params.id;

  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<string | null>(null);

  const [student, setStudent] = useState<StudentRow | null>(null);
  const [weeks, setWeeks] = useState<WeekRow[]>([]);
  const [selectedWeekId, setSelectedWeekId] = useState<string | null>(null);
  const [selectedWeekStart, setSelectedWeekStart] = useState<string | null>(null);
  const [selectedWeekEnd, setSelectedWeekEnd] = useState<string | null>(null);

  const [workouts, setWorkouts] = useState<WorkoutRow[]>([]);
  const [latestExecByWorkout, setLatestExecByWorkout] = useState<Record<string, ExecutionRow | null>>({});

  async function loadStudent() {
    const { data, error } = await supabase
      .from('students')
      .select('id,name,trainer_id,public_slug,portal_token,portal_enabled')
      .eq('id', studentId)
      .maybeSingle();

    if (error) {
      setBanner(error.message);
      return;
    }
    setStudent(data as any);
  }

  async function loadWeeks() {
    // weeks tabela antiga ou training_weeks
    const res1 = await supabase
      .from('weeks')
      .select('id,week_start,week_end,label,status')
      .eq('student_id', studentId)
      .order('week_start', { ascending: true });

    if (!res1.error) {
      setWeeks((res1.data || []) as any);
      return;
    }

    const res2 = await supabase
      .from('training_weeks')
      .select('id,week_start,week_end,label,status')
      .eq('student_id', studentId)
      .order('week_start', { ascending: true });

    if (res2.error) {
      setBanner(res2.error.message);
      return;
    }
    setWeeks((res2.data || []) as any);
  }

  async function loadWorkoutsForWeek(weekId: string) {
    setBanner(null);

    const { data, error } = await supabase
      .from('workouts')
      .select('id,student_id,trainer_id,week_id,status,template_type,title,total_km,planned_date,planned_day,locked_at,created_at,updated_at,published_at')
      .eq('student_id', studentId)
      .eq('week_id', weekId)
      .order('planned_day', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true });

    if (error) {
      setBanner(error.message);
      return;
    }

    const ws = (data || []) as WorkoutRow[];
    setWorkouts(ws);

    // latest execution por workout
    const ids = ws.map((w) => w.id);
    if (ids.length === 0) {
      setLatestExecByWorkout({});
      return;
    }

    const { data: ex } = await supabase
      .from('executions')
      .select('id,workout_id,status,performed_at,last_event_at')
      .in('workout_id', ids)
      .order('last_event_at', { ascending: false, nullsFirst: false });

    const map: Record<string, ExecutionRow | null> = {};
    for (const id of ids) map[id] = null;

    for (const e of (ex || []) as any[]) {
      if (!map[e.workout_id]) map[e.workout_id] = e;
    }
    setLatestExecByWorkout(map);
  }

  async function publishWeek() {
    if (!selectedWeekId) return;
    setBanner(null);

    const now = new Date().toISOString();

    const draftIds = workouts.filter((w) => w.status === 'draft').map((w) => w.id);
    const republishIds = workouts.filter((w) => workoutNeedsRepublish(w)).map((w) => w.id);

    if (draftIds.length === 0 && republishIds.length === 0) {
      setBanner('Nada para publicar/republicar nesta semana.');
      return;
    }

    // 1) publica rascunhos
    if (draftIds.length > 0) {
      const { error } = await supabase.from('workouts').update({ status: 'ready', published_at: now }).in('id', draftIds);
      if (error) {
        setBanner(error.message);
        return;
      }
    }

    // 2) republica alterações pendentes (se houver)
    if (republishIds.length > 0) {
      const { error } = await supabase.from('workouts').update({ published_at: now }).in('id', republishIds);
      if (error) {
        setBanner(error.message);
        return;
      }
    }

    if (draftIds.length > 0 && republishIds.length > 0) {
      setBanner('Semana publicada e republicada (alterações aplicadas para o aluno).');
    } else if (draftIds.length > 0) {
      setBanner('Semana publicada (treinos em rascunho ficaram disponíveis para o aluno).');
    } else {
      setBanner('Semana republicada (alterações aplicadas para o aluno).');
    }

    await loadWorkoutsForWeek(selectedWeekId);
  }

  async function publishWorkout(workoutId: string) {
    setBanner(null);

    const now = new Date().toISOString();

    const { error } = await supabase
      .from('workouts')
      .update({ status: 'ready', published_at: now })
      .eq('id', workoutId)
      .eq('status', 'draft');

    if (error) {
      setBanner(error.message);
      return;
    }
    await loadWorkoutsForWeek(selectedWeekId);
  }

  async function republishWorkout(workoutId: string) {
    setBanner(null);

    const now = new Date().toISOString();

    const { error } = await supabase.from('workouts').update({ published_at: now }).eq('id', workoutId);
    if (error) {
      setBanner(error.message);
      return;
    }
    await loadWorkoutsForWeek(selectedWeekId);
  }

  async function openWorkoutInPortalPreview(workoutId: string) {
    if (!student?.public_slug || !student?.portal_token) {
      setBanner('Portal do aluno não está habilitado.');
      return;
    }
    const url = `${window.location.origin}/p/${student.public_slug}/workouts/${workoutId}?t=${encodeURIComponent(student.portal_token)}&preview=1`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  useEffect(() => {
    (async () => {
      setLoading(true);
      await loadStudent();
      await loadWeeks();
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  useEffect(() => {
    if (!weeks.length) return;

    const today = saoPauloISODateNow();
    const found =
      weeks.find((w) => w.week_start <= today && (w.week_end || addDaysISO(w.week_start, 6)) >= today) || weeks[weeks.length - 1];

    setSelectedWeekId(found?.id || null);
    setSelectedWeekStart(found?.week_start || null);
    setSelectedWeekEnd(found ? found.week_end || addDaysISO(found.week_start, 6) : null);

    if (found?.id) void loadWorkoutsForWeek(found.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weeks]);

  const weekRange = selectedWeekStart && selectedWeekEnd ? formatWeekRange(selectedWeekStart, selectedWeekEnd) : '—';

  const readyCount = workouts.filter((w) => w.status === 'ready').length;
  const draftCount = workouts.filter((w) => w.status === 'draft').length;
  const republishCount = workouts.filter((w) => workoutNeedsRepublish(w)).length;
  const completedCount = workouts.filter((w) => latestExecByWorkout[w.id]?.status === 'completed').length;

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4">
      <div className="mx-auto max-w-4xl space-y-4">
        <div className="rounded-2xl bg-white dark:bg-surface-dark shadow p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm text-slate-600 dark:text-slate-300">Aluno</div>
              <div className="text-xl font-semibold truncate">{student?.name ?? '—'}</div>
              <div className="text-sm text-slate-600 dark:text-slate-300 mt-1">Planejamento por semana (Seg → Dom)</div>
            </div>

            <div className="shrink-0 flex flex-col items-end gap-2">
              <button className="text-sm underline text-slate-600 dark:text-slate-300" onClick={() => router.back()}>
                Voltar
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2 items-center">
            <div className="text-sm text-slate-600 dark:text-slate-300">
              Semana <b>{weekRange}</b>
            </div>

            <div className="ml-auto flex gap-2">
              <button
                className="px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-sm font-semibold"
                onClick={() => router.push(`/dashboard/week/${selectedWeekId}`)}
                disabled={!selectedWeekId}
              >
                Painel da semana
              </button>

              <button
                className="px-3 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold disabled:opacity-50"
                disabled={!selectedWeekId || (draftCount === 0 && republishCount === 0)}
                onClick={publishWeek}
                title={
                  draftCount === 0 && republishCount === 0
                    ? 'Nada para publicar'
                    : draftCount > 0
                      ? 'Publica todos os treinos em rascunho da semana'
                      : 'Republica treinos publicados que foram alterados'
                }
              >
                {draftCount > 0 ? 'Publicar semana' : republishCount > 0 ? 'Republicar semana' : 'Publicar semana'}
              </button>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2 text-sm">
            <div className="px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800">
              Programados: <b>{workouts.length}</b>
            </div>
            <div className="px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800">
              Publicados: <b>{readyCount}</b>
            </div>
            <div className="px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800">
              Concluídos: <b>{completedCount}</b>
            </div>
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
              <h2 className="font-semibold mb-3">Treinos da semana</h2>

              {workouts.length === 0 ? (
                <div className="text-sm text-slate-600 dark:text-slate-300">Nenhum treino programado para esta semana ainda.</div>
              ) : (
                <div className="space-y-3">
                  {workouts.map((w) => {
                    const latestExec = latestExecByWorkout[w.id];
                    const progress =
                      latestExec?.status === 'completed'
                        ? `Concluído${latestExec.performed_at ? ` (${formatBRFull(latestExec.performed_at)})` : ''}`
                        : latestExec?.status === 'in_progress'
                          ? 'Em andamento'
                          : '—';

                    const locked = !!w.locked_at || !!latestExec;
                    const plannedLabel = formatPlannedLabel(w.planned_date);

                    const tpl = TEMPLATE_LABEL[w.template_type] ?? w.template_type;
                    const needsRepublish = workoutNeedsRepublish(w);

                    const publishLabel =
                      w.status === 'draft'
                        ? 'Publicar'
                        : w.status === 'ready'
                          ? needsRepublish
                            ? 'Republicar'
                            : 'Publicado'
                          : w.status === 'canceled'
                            ? 'Cancelado'
                            : 'Encerrado';

                    const publishDisabled = locked || (w.status !== 'draft' && !(w.status === 'ready' && needsRepublish));

                    return (
                      <div key={w.id} className="rounded-xl border border-slate-200 dark:border-slate-700 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm text-slate-600 dark:text-slate-300">
                              {plannedLabel} · {w.status === 'draft' ? 'Rascunho' : w.status === 'ready' ? 'Publicado' : w.status === 'canceled' ? 'Cancelado' : 'Encerrado'} · {tpl} · {kmLabel(w.total_km)} km
                            </div>
                            <div className="font-medium truncate">{w.title || tpl || 'Treino'}</div>

                            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                              Execução do aluno: <span className="font-semibold">{progress}</span>
                              {locked ? ' · Edição bloqueada após início' : ''}
                            </div>
                          </div>

                          <div className="shrink-0 grid grid-cols-1 sm:grid-cols-3 gap-2 justify-end">
                            <button
                              className="px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-sm font-semibold disabled:opacity-50"
                              disabled={locked}
                              onClick={() => router.push(`/workouts/${w.id}/edit`)}
                            >
                              Editar
                            </button>

                            <button
                              className="px-3 py-2 rounded-lg bg-primary text-slate-900 text-sm font-semibold disabled:opacity-50"
                              disabled={publishDisabled}
                              onClick={() => {
                                if (w.status === 'draft') publishWorkout(w.id);
                                else if (w.status === 'ready' && needsRepublish) republishWorkout(w.id);
                              }}
                              title={
                                locked
                                  ? 'Edição bloqueada'
                                  : w.status === 'draft'
                                    ? 'Publica este treino para o aluno'
                                    : w.status === 'ready'
                                      ? needsRepublish
                                        ? 'Republica para aplicar alterações ao aluno'
                                        : 'Já está publicado'
                                      : 'Treino encerrado'
                              }
                            >
                              {publishLabel}
                            </button>

                            <button className="px-3 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold" onClick={() => openWorkoutInPortalPreview(w.id)}>
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
