'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '../../../lib/supabaseBrowser';

type StudentRow = {
  id: string;
  trainer_id: string;
  name: string;
  email: string | null;
  p1k_sec_per_km: number | null;
  public_slug: string | null;
  created_at: string | null;
};

type WeekRow = {
  id: string;
  student_id: string;
  trainer_id: string;
  week_start: string; // YYYY-MM-DD
  week_end: string;   // YYYY-MM-DD
  label: string | null;
};

type WorkoutRow = {
  id: string;
  student_id: string;
  trainer_id: string;
  status: 'draft' | 'ready' | 'archived';
  template_type: string;
  title: string | null;
  total_km: number | null;
  created_at: string;
  planned_date: string | null;
  planned_day: number | null;
  share_slug: string | null;
  week_id: string | null;
  locked_at: string | null;
  closed_reason?: string | null;
};

type ExecutionRow = {
  id: string;
  workout_id: string;
  status: 'in_progress' | 'completed';
  performed_at: string | null;
  completed_at: string | null;
  rpe: number | null;
  comment: string | null;
  last_event_at: string | null;
  started_at: string | null;
};

const TEMPLATE_LABEL: Record<string, string> = {
  easy_run: 'Rodagem',
  progressive: 'Progressivo',
  alternated: 'Alternado',
};

function formatPace(secPerKm: number | null) {
  if (!secPerKm || secPerKm <= 0) return '—';
  const m = Math.floor(secPerKm / 60);
  const s = secPerKm % 60;
  return `${m}:${String(s).padStart(2, '0')}/km`;
}

function formatDateBRLoose(iso: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function formatRangeBR(weekStartISO: string, weekEndISO: string) {
  return `${formatDateBRLoose(weekStartISO)} – ${formatDateBRLoose(weekEndISO)}`;
}

function statusLabel(status: WorkoutRow['status'], closedReason?: string | null) {
  if (status === 'draft') return 'Rascunho';
  if (status === 'ready') return 'Disponível';
  if (status === 'archived') {
    if (closedReason === 'week_expired') return 'Encerrado (sem execução)';
    return 'Encerrado';
  }
  return status;
}

function kmLabel(km: number | null) {
  if (km == null) return '—';
  return Number(km).toFixed(1).replace('.', ',');
}

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function toISODate(d: Date) {
  // YYYY-MM-DD in local time (avoid timezone shifting from toISOString)
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  return `${y}-${m}-${day}`;
}

function startOfWeekMonday(date: Date) {
  const d = new Date(date);
  const day = d.getDay(); // 0 Sun ... 6 Sat
  const diff = (day === 0 ? -6 : 1 - day); // Monday start
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export default function StudentProfilePage() {
  const params = useParams();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const studentId = String((params as any)?.id || '');
  const [student, setStudent] = useState<StudentRow | null>(null);
  const [studentSlug, setStudentSlug] = useState<string>('aluno');
  const [weeks, setWeeks] = useState<WeekRow[]>([]);
  const [selectedWeekId, setSelectedWeekId] = useState<string | null>(null);

  const [workouts, setWorkouts] = useState<WorkoutRow[]>([]);
  const [latestExecByWorkout, setLatestExecByWorkout] = useState<Record<string, ExecutionRow | null>>({});
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<string | null>(null);

  async function loadStudent() {
    setLoading(true);
    setBanner(null);

    const { data: s, error } = await supabase
      .from('students')
      .select('id, trainer_id, name, email, p1k_sec_per_km, public_slug, created_at')
      .eq('id', studentId)
      .maybeSingle();

    if (error) {
      setBanner(error.message);
      setLoading(false);
      return;
    }

    if (!s) {
      setBanner('Aluno não encontrado.');
      setLoading(false);
      return;
    }

    setStudent(s as StudentRow);
    setStudentSlug(((s as any).public_slug as string) || 'aluno');

    setLoading(false);
  }

  async function ensureUpcomingWeeks(s: StudentRow) {
    // cria/garante semanas: semana atual + próximas 7 (ajuste se quiser mais)
    const base = startOfWeekMonday(new Date());
    const targets = Array.from({ length: 8 }).map((_, i) => {
      const ws = addDays(base, i * 7);
      const we = addDays(ws, 6);
      return {
        student_id: s.id,
        trainer_id: s.trainer_id,
        week_start: toISODate(ws),
        week_end: toISODate(we),
        label: `Semana ${formatRangeBR(toISODate(ws), toISODate(we))}`,
      };
    });

    // upsert exige unique(student_id, week_start)
    const up = await supabase.from('weeks').upsert(targets as any, { onConflict: 'student_id,week_start' });
    if (up.error) {
      // se a tabela ainda não existir, o app segue sem quebrar (mas a visão semanal não funciona)
      setBanner(up.error.message);
      return;
    }

    const { data: wk, error } = await supabase
      .from('weeks')
      .select('id, student_id, trainer_id, week_start, week_end, label')
      .eq('student_id', s.id)
      .order('week_start', { ascending: true });

    if (error) {
      setBanner(error.message);
      return;
    }

    const list = (wk || []) as WeekRow[];
    setWeeks(list);

    const currentStartISO = toISODate(startOfWeekMonday(new Date()));
    const current = list.find((w) => w.week_start === currentStartISO) || list[0] || null;
    setSelectedWeekId(current?.id || null);
  }

  async function loadWorkoutsForWeek(weekId: string | null) {
    if (!weekId) {
      setWorkouts([]);
      setLatestExecByWorkout({});
      return;
    }

    // Treinos da semana selecionada
    const { data: ws, error } = await supabase
      .from('workouts')
      .select(
        'id, student_id, trainer_id, status, template_type, title, total_km, created_at, planned_date, planned_day, share_slug, week_id, locked_at, closed_reason'
      )
      .eq('student_id', studentId)
      .eq('week_id', weekId)
      .order('planned_day', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) {
      setBanner(error.message);
      return;
    }

    const list = (ws || []) as WorkoutRow[];
    setWorkouts(list);

    if (list.length === 0) {
      setLatestExecByWorkout({});
      return;
    }

    const workoutIds = list.map((w) => w.id);
    const { data: execs, error: execErr } = await supabase
      .from('executions')
      .select('id, workout_id, status, performed_at, completed_at, rpe, comment, last_event_at, started_at')
      .in('workout_id', workoutIds);

    if (execErr) {
      // não bloqueia a tela, só perde o "progresso"
      setLatestExecByWorkout({});
      return;
    }

    const byWorkout: Record<string, ExecutionRow | null> = {};
    for (const wid of workoutIds) byWorkout[wid] = null;

    // pega a mais recente por last_event_at/started_at/completed_at
    for (const e of (execs || []) as any[]) {
      const cur = byWorkout[e.workout_id];
      const curKey = cur?.last_event_at || cur?.completed_at || cur?.started_at || '';
      const nextKey = e.last_event_at || e.completed_at || e.started_at || '';
      if (!cur || (nextKey && nextKey > curKey)) {
        byWorkout[e.workout_id] = e as ExecutionRow;
      }
    }

    setLatestExecByWorkout(byWorkout);
  }

  async function copyWorkoutLink(workoutId: string) {
    setBanner(null);

    // Trigger gera share_slug ao mudar status para ready (no banco)
    const { data, error } = await supabase
      .from('workouts')
      .update({ status: 'ready' })
      .eq('id', workoutId)
      .select('id, share_slug')
      .maybeSingle();

    if (error) {
      setBanner(error.message);
      return;
    }

    const slug = (data as any)?.share_slug as string | null;
    if (!slug) {
      setBanner('Não foi possível gerar o link (share_slug).');
      return;
    }

    const url = `${window.location.origin}/w/${studentSlug}/${slug}`;
    await navigator.clipboard.writeText(url);

    setBanner('Link do treino copiado para a área de transferência.');
    // atualiza local
    setWorkouts((prev) => prev.map((w) => (w.id === workoutId ? ({ ...w, status: 'ready', share_slug: slug } as any) : w)));
  }

  function openWorkoutAsAluno(workout: WorkoutRow) {
    const slug = workout.share_slug;
    if (!slug) {
      setBanner('Treino sem link (share_slug). Use "Gerar/Copiar link".');
      return;
    }
    router.push(`/w/${studentSlug}/${slug}`);
  }

  // Load student
  useEffect(() => {
    if (!studentId) return;
    loadStudent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  // Ensure weeks after student loaded
  useEffect(() => {
    if (!student) return;
    ensureUpcomingWeeks(student);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student?.id]);

  // Load workouts when week changes
  useEffect(() => {
    loadWorkoutsForWeek(selectedWeekId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWeekId]);

  const selectedWeek = weeks.find((w) => w.id === selectedWeekId) || null;

  const header = (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="text-sm text-slate-600 dark:text-slate-300">Aluno</div>
        <div className="text-xl font-semibold truncate">{student?.name ?? '—'}</div>
        <div className="text-sm text-slate-600 dark:text-slate-300 mt-1">
          Ritmo P1k: <span className="font-semibold">{formatPace(student?.p1k_sec_per_km ?? null)}</span>
          {student?.email ? <> · {student.email}</> : null}
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Links do aluno: <span className="font-mono">/aluno</span> (login) ·{' '}
          <span className="font-mono">/w/{studentSlug}/&lt;treino&gt;</span>
        </div>
      </div>

      <div className="shrink-0 flex flex-col items-end gap-2">
        <button
          className="px-3 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold disabled:opacity-50"
          disabled={!selectedWeekId}
          onClick={() => router.push(`/students/${studentId}/workouts/new?weekId=${selectedWeekId}`)}
        >
          + Programar treino
        </button>
        <button className="text-sm underline text-slate-600 dark:text-slate-300" onClick={() => router.push('/students')}>
          Voltar
        </button>
      </div>
    </div>
  );

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="rounded-2xl bg-white dark:bg-surface-dark shadow p-4">{header}</div>

        {banner && (
          <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 p-3 text-sm text-amber-800 dark:text-amber-200">
            {banner}
          </div>
        )}

        {loading ? (
          <div className="text-sm text-slate-600 dark:text-slate-300">Carregando…</div>
        ) : (
          <>
            {/* Seletor de semanas */}
            <div className="rounded-2xl bg-white dark:bg-surface-dark shadow p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-semibold">Planejamento por semana</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {selectedWeek ? selectedWeek.label || formatRangeBR(selectedWeek.week_start, selectedWeek.week_end) : '—'}
                  </div>
                </div>
              </div>

              {weeks.length === 0 ? (
                <div className="mt-3 text-sm text-slate-600 dark:text-slate-300">
                  Semanas ainda não carregadas. Verifique se a tabela <span className="font-mono">weeks</span> existe no Supabase.
                </div>
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
                        {formatRangeBR(w.week_start, w.week_end)}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Lista de treinos da semana */}
            <div className="rounded-2xl bg-white dark:bg-surface-dark shadow p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold">Treinos da semana</h2>
                <div className="text-xs text-slate-500 dark:text-slate-400">Mostrando até 200</div>
              </div>

              {workouts.length === 0 ? (
                <div className="text-sm text-slate-600 dark:text-slate-300">
                  Nenhum treino programado para esta semana ainda.
                </div>
              ) : (
                <div className="space-y-3">
                  {workouts.map((w) => {
                    const latestExec = latestExecByWorkout[w.id];
                    const progress =
                      latestExec?.status === 'completed'
                        ? `Concluído${latestExec.performed_at ? ` (${formatDateBRLoose(latestExec.performed_at)})` : ''}`
                        : latestExec?.status === 'in_progress'
                          ? 'Em andamento'
                          : '—';

                    const locked = !!w.locked_at || !!latestExec;
                    const plannedLabel = w.planned_day ? `Ordem ${w.planned_day}` : (w.planned_date ? formatDateBRLoose(w.planned_date) : formatDateBRLoose(w.created_at));

                    return (
                      <div key={w.id} className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 flex flex-col gap-2">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm text-slate-600 dark:text-slate-300">
                              {plannedLabel} · {statusLabel(w.status, (w as any).closed_reason)} · {TEMPLATE_LABEL[w.template_type] ?? w.template_type} ·{' '}
                              {kmLabel(w.total_km)} km
                            </div>
                            <div className="font-medium truncate">{w.title || TEMPLATE_LABEL[w.template_type] || 'Treino'}</div>

                            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                              Execução do aluno: <span className="font-semibold">{progress}</span>
                              {locked ? ' · Edição bloqueada após início' : ''}
                            </div>
                          </div>

                          <div className="shrink-0 flex flex-wrap gap-2 justify-end">
                            <button
                              className="px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-sm font-semibold disabled:opacity-50"
                              disabled={locked}
                              onClick={() => router.push(`/workouts/${w.id}/edit`)}
                            >
                              Editar
                            </button>

                            <button
                              className="px-3 py-2 rounded-lg bg-primary text-slate-900 text-sm font-semibold disabled:opacity-50"
                              disabled={w.status === 'archived'}
                              onClick={() => copyWorkoutLink(w.id)}
                            >
                              Gerar/Copiar link
                            </button>

                            <button
                              className="px-3 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold disabled:opacity-50"
                              disabled={!w.share_slug}
                              onClick={() => openWorkoutAsAluno(w)}
                            >
                              Ver como aluno
                            </button>
                          </div>
                        </div>

                        {w.share_slug ? (
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            Link: <span className="font-mono">/w/{studentSlug}/{w.share_slug}</span>
                          </div>
                        ) : (
                          <div className="text-xs text-slate-500 dark:text-slate-400">Link ainda não gerado (share_slug vazio).</div>
                        )}
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
