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
  week_end: string | null;
  label: string | null;
};

type WorkoutRow = {
  id: string;
  student_id: string;
  trainer_id: string;
  week_id: string | null;
  status: 'draft' | 'ready' | 'archived';
  template_type: string | null;
  title: string | null;
  total_km: number | null;
  planned_date: string | null;
  planned_day: number | null;
  created_at: string | null;
  share_slug: string | null;
  locked_at: string | null;
  closed_reason: string | null;
};

type ExecutionRow = {
  id: string;
  workout_id: string;
  status: string;
  started_at: string | null;
  last_event_at: string | null;
  completed_at: string | null;
  performed_at: string | null;
  total_elapsed_ms: number | null;
  rpe: number | null;
  comment: string | null;
  actual_total_km: number | null;
};

function startOfWeekMonday(date: Date) {
  const d = new Date(date);
  const day = d.getDay(); // 0..6 (Sun..Sat)
  const diff = (day === 0 ? -6 : 1) - day; // move to Monday
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function toISODate(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function formatWeekLabel(weekStartISO: string) {
  // "Semana dd/mm - dd/mm"
  const [y, m, d] = weekStartISO.split('-');
  const start = new Date(Number(y), Number(m) - 1, Number(d));
  const end = addDays(start, 6);
  const dd1 = String(start.getDate()).padStart(2, '0');
  const mm1 = String(start.getMonth() + 1).padStart(2, '0');
  const dd2 = String(end.getDate()).padStart(2, '0');
  const mm2 = String(end.getMonth() + 1).padStart(2, '0');
  return `Semana ${dd1}/${mm1} – ${dd2}/${mm2}`;
}

function formatPace(secPerKm: number | null) {
  if (!secPerKm || !Number.isFinite(secPerKm)) return '—';
  const mm = Math.floor(secPerKm / 60);
  const ss = Math.round(secPerKm % 60);
  return `${mm}:${String(ss).padStart(2, '0')}/km`;
}

function formatKm(n: number | null) {
  if (n == null || !Number.isFinite(n)) return '—';
  return `${String(n).replace('.', ',')} km`;
}

function formatDateBR(dateStr?: string | null) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const [y, m, d] = parts;
  return `${d}/${m}/${y}`;
}

export default function StudentTrainerPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const studentId = params.id;

  const supabase = useMemo(() => createClient(), []);
  const [banner, setBanner] = useState<string | null>(null);

  const [student, setStudent] = useState<StudentRow | null>(null);
  const [weeks, setWeeks] = useState<WeekRow[]>([]);
  const [selectedWeekId, setSelectedWeekId] = useState<string | null>(null);

  const [workouts, setWorkouts] = useState<WorkoutRow[]>([]);
  const [latestExecByWorkout, setLatestExecByWorkout] = useState<Record<string, ExecutionRow | null>>({});

  const studentSlug = student?.public_slug ?? 'aluno';

  async function loadStudent() {
    setBanner(null);
    const { data, error } = await supabase
      .from('students')
      .select('id,trainer_id,name,email,p1k_sec_per_km,public_slug,created_at')
      .eq('id', studentId)
      .maybeSingle();

    if (error) {
      setBanner(error.message);
      return;
    }

    if (!data) {
      setBanner('Aluno não encontrado.');
      return;
    }

    setStudent(data as any);
  }

  async function ensureUpcomingWeeks(s: StudentRow) {
    // garante que as próximas semanas existam na tabela training_weeks
    setBanner(null);

    const start = startOfWeekMonday(new Date());
    const starts = Array.from({ length: 6 }).map((_, i) => toISODate(addDays(start, i * 7)));

    // upsert: (student_id, week_start) unique
    const payload = starts.map((ws) => ({
      student_id: s.id,
      trainer_id: s.trainer_id,
      week_start: ws,
      week_end: toISODate(addDays(new Date(ws), 6)),
      label: formatWeekLabel(ws),
    }));

    // Table real: training_weeks
    const { error: upErr } = await supabase.from('training_weeks').upsert(payload, {
      onConflict: 'student_id,week_start',
    });

    if (upErr) {
      setBanner(upErr.message);
      return;
    }

    // reload list
    const { data, error } = await supabase
      .from('training_weeks')
      .select('id,student_id,trainer_id,week_start,week_end,label')
      .eq('student_id', s.id)
      .order('week_start', { ascending: true });

    if (error) {
      setBanner(error.message);
      return;
    }

    const list = (data || []) as WeekRow[];
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

    setBanner(null);

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

    // pega última execução por workout (view v_workouts_last_execution existe no seu schema)
    const ids = list.map((w) => w.id);
    const { data: ex } = await supabase
      .from('v_workouts_last_execution')
      .select(
        'workout_id, execution_id, status, started_at, last_event_at, completed_at, performed_at, total_elapsed_ms, rpe, comment, actual_total_km'
      )
      .in('workout_id', ids);

    const map: Record<string, ExecutionRow | null> = {};
    (ex || []).forEach((row: any) => {
      map[row.workout_id] = {
        id: row.execution_id,
        workout_id: row.workout_id,
        status: row.status,
        started_at: row.started_at,
        last_event_at: row.last_event_at,
        completed_at: row.completed_at,
        performed_at: row.performed_at,
        total_elapsed_ms: row.total_elapsed_ms,
        rpe: row.rpe,
        comment: row.comment,
        actual_total_km: row.actual_total_km,
      } as any;
    });

    setLatestExecByWorkout(map);
  }

  function makeRandomSlug(len = 12) {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let out = '';
    const arr = new Uint32Array(len);
    // crypto.getRandomValues existe no browser moderno (incl. mobile)
    crypto.getRandomValues(arr);
    for (let i = 0; i < len; i++) out += chars[arr[i] % chars.length];
    return out;
  }

  async function ensureShareSlug(workoutId: string) {
    // 1) tenta ler share_slug atual
    const { data: cur, error: curErr } = await supabase.from('workouts').select('id, share_slug, status').eq('id', workoutId).maybeSingle();
    if (curErr) throw curErr;
    const currentSlug = (cur as any)?.share_slug as string | null;
    if (currentSlug) return currentSlug;

    // 2) gera slug e tenta gravar (lida com colisão UNIQUE)
    for (let i = 0; i < 8; i++) {
      const slug = makeRandomSlug(12);
      const { data: upd, error: updErr } = await supabase
        .from('workouts')
        .update({ status: 'ready', share_slug: slug })
        .eq('id', workoutId)
        .is('share_slug', null)
        .select('id, share_slug')
        .maybeSingle();

      if (!updErr) {
        const got = (upd as any)?.share_slug as string | null;
        if (got) return got;
      } else {
        // 23505 = unique_violation (slug já existe)
        if ((updErr as any).code !== '23505') throw updErr;
      }
    }

    throw new Error('Não foi possível gerar o link (share_slug).');
  }

  async function shareWorkoutLink(workoutId: string) {
    setBanner(null);

    try {
      const slug = await ensureShareSlug(workoutId);
      const url = `${window.location.origin}/w/${studentSlug}/${slug}`;

      // Preferência: abrir menu nativo de compartilhamento (Android/iOS)
      if (navigator.share) {
        await navigator.share({
          title: 'Treino do aluno',
          text: `Treino programado para ${student?.name ?? 'aluno'}`,
          url,
        });
        setBanner('Abrindo opções de compartilhamento...');
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        setBanner('Link copiado para a área de transferência.');
      } else {
        // fallback final (WhatsApp)
        window.open(`https://wa.me/?text=${encodeURIComponent(url)}`, '_blank');
        setBanner('Abrindo WhatsApp para compartilhar...');
      }

      // atualiza local
      setWorkouts((prev) => prev.map((w) => (w.id === workoutId ? ({ ...w, status: 'ready', share_slug: slug } as any) : w)));
    } catch (e: any) {
      setBanner(e?.message || 'Não foi possível gerar/compartilhar o link.');
    }
  }

  function openWorkoutAsAluno(workout: WorkoutRow) {
    const slug = workout.share_slug;
    if (!slug) {
      setBanner('Treino sem link (share_slug). Use "Gerar/Compartilhar".');
      return;
    }
    const url = `/w/${studentSlug}/${slug}`;
    // abre em nova aba/janela para o treinador não perder a tela
    if (typeof window !== 'undefined') {
      window.open(url, '_blank');
    } else {
      router.push(url);
    }
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
          <div className="rounded-xl bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-700 dark:text-red-300">{banner}</div>
        )}

        {/* Calendário de semanas */}
        <div className="rounded-2xl bg-white dark:bg-surface-dark shadow p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Planejamento por semana</h2>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {selectedWeek ? selectedWeek.label : '—'}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {weeks.map((w) => (
              <button
                key={w.id}
                className={`px-3 py-2 rounded-full text-sm font-semibold border ${
                  selectedWeekId === w.id
                    ? 'bg-primary text-slate-900 border-primary'
                    : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100'
                }`}
                onClick={() => setSelectedWeekId(w.id)}
              >
                {w.label ?? formatWeekLabel(w.week_start)}
              </button>
            ))}
          </div>
        </div>

        {/* Lista de treinos da semana */}
        <div className="rounded-2xl bg-white dark:bg-surface-dark shadow p-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <h2 className="font-semibold">Treinos da semana</h2>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Programados: <span className="font-semibold">{workouts.length}</span>
                {' '}· Disponíveis: <span className="font-semibold">{workouts.filter((x) => x.status === 'ready').length}</span>
                {' '}· Rascunhos: <span className="font-semibold">{workouts.filter((x) => x.status === 'draft').length}</span>
              </div>
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Mostrando até 200</div>
          </div>

          {workouts.length === 0 ? (
            <div className="text-sm text-slate-600 dark:text-slate-300">Nenhum treino programado para esta semana ainda.</div>
          ) : (
            <div className="space-y-3">
              {workouts.map((w) => {
                const latestExec = latestExecByWorkout[w.id];
                const locked = !!w.locked_at || (latestExec && (latestExec.status === 'in_progress' || latestExec.status === 'completed'));
                const planned = w.planned_date ? `Planejado: ${formatDateBR(w.planned_date)}` : w.planned_day ? `Dia: ${w.planned_day}` : '';
                const template = w.template_type ? w.template_type : '—';
                const progress =
                  latestExec?.status === 'completed'
                    ? 'Concluído'
                    : latestExec?.status === 'in_progress'
                    ? 'Em andamento'
                    : w.status === 'ready'
                    ? 'Disponível'
                    : w.status === 'draft'
                    ? 'Rascunho'
                    : 'Arquivado';

                return (
                  <div key={w.id} className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="text-sm font-semibold truncate">{w.title || 'Treino'}</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">·</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">{template}</div>
                          {w.total_km != null ? (
                            <>
                              <div className="text-xs text-slate-500 dark:text-slate-400">·</div>
                              <div className="text-xs text-slate-500 dark:text-slate-400">{formatKm(w.total_km)}</div>
                            </>
                          ) : null}
                        </div>

                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          {planned ? `${planned} · ` : ''}
                          Status: <span className="font-semibold">{progress}</span>
                          {locked ? ' · Edição bloqueada após início' : ''}
                        </div>
                      </div>

                      <div className="w-full sm:w-auto flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:justify-end">
                        <button
                          className="w-full sm:w-auto px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-sm font-semibold whitespace-nowrap disabled:opacity-50"
                          disabled={locked}
                          onClick={() => router.push(`/workouts/${w.id}/edit`)}
                        >
                          Editar
                        </button>

                        <button
                          className="w-full sm:w-auto px-3 py-2 rounded-lg bg-primary text-slate-900 text-sm font-semibold whitespace-nowrap disabled:opacity-50"
                          disabled={w.status === 'archived'}
                          onClick={() => shareWorkoutLink(w.id)}
                        >
                          Gerar/Compartilhar
                        </button>

                        <button
                          className="w-full sm:w-auto px-3 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold whitespace-nowrap disabled:opacity-50"
                          disabled={!w.share_slug}
                          onClick={() => openWorkoutAsAluno(w)}
                        >
                          Ver como aluno
                        </button>
                      </div>
                    </div>

                    {w.share_slug ? (
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                        Link: <span className="font-mono">/w/{studentSlug}/{w.share_slug}</span>
                      </div>
                    ) : (
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-2">Link ainda não gerado (share_slug vazio).</div>
                    )}

                    {w.closed_reason ? (
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">Encerrado: {w.closed_reason}</div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
