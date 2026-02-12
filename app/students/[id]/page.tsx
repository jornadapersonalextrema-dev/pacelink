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
  week_end: string; // YYYY-MM-DD
  label: string | null;
};

type WorkoutRow = {
  id: string;
  student_id: string;
  trainer_id: string;
  week_id: string | null;
  status: 'draft' | 'ready' | 'archived';
  template_type: string;
  title: string | null;
  total_km: number;
  planned_date: string | null;
  planned_day: number | null;
  locked_at: string | null;
  created_at: string;
};

type ExecutionRow = {
  id: string;
  workout_id: string;
  status: 'in_progress' | 'completed';
  performed_at: string | null;
  last_event_at: string | null;
  started_at: string | null;
  completed_at: string | null;
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

function saoPauloISODateNow() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const y = Number(parts.find((p) => p.type === 'year')?.value || 1970);
  const m = Number(parts.find((p) => p.type === 'month')?.value || 1);
  const d = Number(parts.find((p) => p.type === 'day')?.value || 1);
  return isoFromParts(y, m, d);
}

function saoPauloWeekdayIndexNow() {
  const wd = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', weekday: 'short' }).format(new Date());
  const map: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  return map[wd] || 1;
}

function addDaysISO(iso: string, days: number) {
  const [y, m, d] = iso.split('-').map((x) => Number(x));
  const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
  dt.setUTCDate(dt.getUTCDate() + days);
  return isoFromParts(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

function startOfWeekMondayISO_SaoPaulo() {
  const todayISO = saoPauloISODateNow();
  const dow = saoPauloWeekdayIndexNow(); // 1..7
  return addDaysISO(todayISO, -(dow - 1));
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

function formatWeekRange(ws: string, we: string) {
  return `${formatBRShort(ws)} – ${formatBRShort(we)}`;
}

function kmLabel(km: number | null) {
  if (km == null) return '—';
  return Number(km).toFixed(1).replace('.', ',');
}

function formatPace(secPerKm: number | null) {
  if (!secPerKm || !Number.isFinite(secPerKm)) return '—';
  const total = Math.max(0, Math.floor(secPerKm));
  const mm = Math.floor(total / 60);
  const ss = total % 60;
  return `${mm}:${ss.toString().padStart(2, '0')}/km`;
}

function slugify(s: string) {
  return (s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

function makeStudentSlug(name: string, id: string) {
  const base = slugify(name) || 'aluno';
  const suffix = (id || '').replace(/-/g, '').slice(0, 6) || '000000';
  return `${base}-${suffix}`;
}

function randomToken() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    // @ts-ignore
    return crypto.randomUUID().replace(/-/g, '');
  }
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

export default function TrainerStudentPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const studentId = params.id;

  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<string | null>(null);

  const [student, setStudent] = useState<StudentRow | null>(null);
  const [weeks, setWeeks] = useState<WeekRow[]>([]);
  const [selectedWeekId, setSelectedWeekId] = useState<string>('');
  const [workouts, setWorkouts] = useState<WorkoutRow[]>([]);
  const [latestExecByWorkout, setLatestExecByWorkout] = useState<Record<string, ExecutionRow | null>>({});

  const currentWeekStartISO = startOfWeekMondayISO_SaoPaulo();

  async function loadStudent() {
    setBanner(null);
    setLoading(true);

    const { data, error } = await supabase
      .from('students')
      .select('id,name,email,trainer_id,public_slug,portal_token,portal_enabled,p1k_sec_per_km')
      .eq('id', studentId)
      .maybeSingle();

    if (error) {
      setBanner(error.message);
      setLoading(false);
      return;
    }
    if (!data) {
      setBanner('Aluno não encontrado.');
      setLoading(false);
      return;
    }

    setStudent(data as any);
    setLoading(false);
  }

  async function upsertWeeks(tableName: 'weeks' | 'training_weeks', rows: any[]) {
    return supabase.from(tableName).upsert(rows, { onConflict: 'student_id,week_start' });
  }

  async function selectWeeks(tableName: 'weeks' | 'training_weeks', stId: string) {
    return supabase
      .from(tableName)
      .select('id,week_start,week_end,label')
      .eq('student_id', stId)
      .gte('week_start', currentWeekStartISO)
      .order('week_start', { ascending: true });
  }

  async function ensureUpcomingWeeks(st: StudentRow) {
    setBanner(null);

    const baseStart = currentWeekStartISO;
    const rows = Array.from({ length: 8 }).map((_, i) => {
      const ws = addDaysISO(baseStart, i * 7);
      const we = addDaysISO(ws, 6); // domingo
      const label = `Semana ${formatBRShort(ws)} – ${formatBRShort(we)}`;
      return { student_id: st.id, trainer_id: st.trainer_id, week_start: ws, week_end: we, label };
    });

    let tableToUse: 'weeks' | 'training_weeks' = 'weeks';

    // Tenta view/tabela "weeks", se não existir, usa "training_weeks"
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
    for (const wid of workoutIds) byWorkout[wid] = null;

    for (const e of (exs || []) as any[]) {
      if (!byWorkout[e.workout_id]) byWorkout[e.workout_id] = e as ExecutionRow;
    }

    setLatestExecByWorkout(byWorkout);
  }

  async function loadWorkoutsForWeek(weekId: string) {
    if (!weekId) return;

    setBanner(null);

    const { data, error } = await supabase
      .from('workouts')
      .select('id,student_id,trainer_id,week_id,status,template_type,title,total_km,planned_date,planned_day,locked_at,created_at')
      .eq('student_id', studentId)
      .eq('week_id', weekId)
      .order('planned_day', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true })
      .limit(200);

    if (error) {
      setBanner(error.message);
      setWorkouts([]);
      return;
    }

    const list = (data || []) as WorkoutRow[];
    setWorkouts(list);
    await loadLatestExecutions(list.map((w) => w.id));
  }

  async function ensurePortalAccess() {
    if (!student) return null;

    const patch: any = {};
    if (!student.public_slug) patch.public_slug = makeStudentSlug(student.name, student.id);
    if (!student.portal_token) patch.portal_token = randomToken();
    if (!student.portal_enabled) patch.portal_enabled = true;

    if (Object.keys(patch).length === 0) return student;

    const { data, error } = await supabase
      .from('students')
      .update(patch)
      .eq('id', student.id)
      .select('id,name,email,trainer_id,public_slug,portal_token,portal_enabled,p1k_sec_per_km')
      .maybeSingle();

    if (error) {
      setBanner(error.message);
      return null;
    }

    const st = data as any as StudentRow;
    setStudent(st);
    return st;
  }

  async function sharePortal() {
    setBanner(null);
    const st = await ensurePortalAccess();
    if (!st?.public_slug || !st.portal_token) {
      setBanner('Não foi possível habilitar o portal do aluno.');
      return;
    }

    const url = `${window.location.origin}/p/${st.public_slug}?t=${encodeURIComponent(st.portal_token)}`;

    try {
      // @ts-ignore
      if (navigator.share) {
        // @ts-ignore
        await navigator.share({
          title: `Portal do aluno — ${st.name}`,
          text: 'Acesse seus treinos da semana aqui:',
          url,
        });
        setBanner('Acesso compartilhado.');
      } else {
        await navigator.clipboard.writeText(url);
        setBanner('Link do portal copiado.');
      }
    } catch {
      try {
        await navigator.clipboard.writeText(url);
        setBanner('Link do portal copiado.');
      } catch {
        setBanner('Não foi possível compartilhar/copiar o link automaticamente.');
      }
    }
  }

  async function openPortalPreview() {
    setBanner(null);
    const st = await ensurePortalAccess();
    if (!st?.public_slug || !st.portal_token) {
      setBanner('Não foi possível habilitar o portal do aluno.');
      return;
    }
    const url = `${window.location.origin}/p/${st.public_slug}?t=${encodeURIComponent(st.portal_token)}&preview=1`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  async function publishWeek() {
    if (!selectedWeekId) return;
    setBanner(null);

    const { error } = await supabase
      .from('workouts')
      .update({ status: 'ready' })
      .eq('student_id', studentId)
      .eq('week_id', selectedWeekId)
      .eq('status', 'draft');

    if (error) {
      setBanner(error.message);
      return;
    }

    setBanner('Semana publicada (treinos em rascunho ficaram disponíveis para o aluno).');
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

  async function openWorkoutInPortalPreview(workoutId: string) {
    setBanner(null);
    const st = await ensurePortalAccess();
    if (!st?.public_slug || !st.portal_token) {
      setBanner('Não foi possível habilitar o portal do aluno.');
      return;
    }
    const url = `${window.location.origin}/p/${st.public_slug}/workouts/${workoutId}?t=${encodeURIComponent(st.portal_token)}&preview=1`;
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

          {/* Ações rápidas */}
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

                <div className="flex flex-col sm:flex-row items-end gap-2">
                  <button
                    className="px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-sm font-semibold disabled:opacity-50"
                    disabled={!selectedWeekId}
                    onClick={() => router.push(`/dashboard/week/${selectedWeekId}`)}
                    title={!selectedWeekId ? 'Selecione uma semana' : 'Abrir painel da semana'}
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
                    return (
                      <button
                        key={w.id}
                        onClick={() => setSelectedWeekId(w.id)}
                        className={
                          'px-3 py-2 rounded-full text-sm font-semibold whitespace-nowrap border ' +
                          (active
                            ? 'bg-primary text-slate-900 border-transparent'
                            : 'bg-white dark:bg-surface-dark border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200')
                        }
                      >
                        {formatWeekRange(w.week_start, w.week_end)}
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600 dark:text-slate-300">
                <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-3 py-1">
                  Programados: <b>{workouts.length}</b>
                </span>
                <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-3 py-1">
                  Publicados: <b>{readyCount}</b>
                </span>
                <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-3 py-1">
                  Concluídos: <b>{completedCount}</b>
                </span>
              </div>
            </div>

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
                    const plannedLabel = w.planned_day
                      ? `Dia ${w.planned_day}`
                      : w.planned_date
                        ? formatBRFull(w.planned_date)
                        : formatBRFull(saoPauloISODateNow());

                    const tpl = TEMPLATE_LABEL[w.template_type] ?? w.template_type;

                    return (
                      <div key={w.id} className="rounded-xl border border-slate-200 dark:border-slate-700 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm text-slate-600 dark:text-slate-300">
                              {plannedLabel} · {w.status === 'draft' ? 'Rascunho' : w.status === 'ready' ? 'Publicado' : 'Encerrado'} · {tpl} · {kmLabel(w.total_km)} km
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
                              disabled={w.status !== 'draft'}
                              onClick={() => publishWorkout(w.id)}
                              title={w.status !== 'draft' ? 'Já está publicado' : 'Publica este treino para o aluno'}
                            >
                              Publicar
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
