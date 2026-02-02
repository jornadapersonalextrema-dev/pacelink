'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../lib/supabaseBrowser';
import Topbar from '../../components/Topbar';

type StudentRow = {
  id: string;
  name: string;
  p1k_pace: string | null;
  public_slug: string | null;
};

type WorkoutRow = {
  id: string;
  title: string | null;
  status: 'draft' | 'ready' | 'archived';
  template_type: 'easy_run' | 'progressive' | 'alternated';
  planned_date: string | null;
  planned_day: string | number | null;
  total_km: number;
  share_slug: string | null;
};

type ExecutionRow = {
  id: string;
  workout_id: string;
  status: string;
  performed_at: string | null;
  completed_at: string | null;
  last_event_at: string | null;
  started_at: string | null;
  actual_total_km: number | null;
  rpe: number | null;
};

const TEMPLATE_LABEL: Record<string, string> = {
  easy_run: 'Rodagem',
  progressive: 'Progressivo',
  alternated: 'Alternado',
};

function formatDateBR(dateStr?: string | null) {
  if (!dateStr) return '';
  // Espera YYYY-MM-DD
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const [y, m, d] = parts;
  return `${d}/${m}/${y}`;
}

function weekStartKey(dateStr?: string | null) {
  if (!dateStr) return 'Sem data';
  const [y, m, d] = dateStr.split('-').map((x) => parseInt(x, 10));
  if (!y || !m || !d) return 'Sem data';
  const dt = new Date(y, m - 1, d);
  const day = dt.getDay(); // 0=domingo
  const diffToMonday = (day + 6) % 7; // segunda=0
  dt.setDate(dt.getDate() - diffToMonday);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function formatWeekLabel(weekStart: string) {
  if (weekStart === 'Sem data') return 'Treinos sem data planejada';
  const [y, m, d] = weekStart.split('-');
  return `Semana de ${d}/${m}/${y}`;
}

function pickLatestExecution(rows: ExecutionRow[]) {
  const toTime = (x?: string | null) => (x ? new Date(x).getTime() : 0);
  const score = (e: ExecutionRow) =>
    Math.max(toTime(e.last_event_at), toTime(e.completed_at), toTime(e.started_at), toTime(e.performed_at));
  return rows.slice().sort((a, b) => score(b) - score(a))[0];
}

export default function AlunoHome() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [student, setStudent] = useState<StudentRow | null>(null);
  const [workouts, setWorkouts] = useState<WorkoutRow[]>([]);
  const [latestExecByWorkout, setLatestExecByWorkout] = useState<Record<string, ExecutionRow | undefined>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      setError(null);

      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();

      if (cancelled) return;

      if (userErr) {
        setError(userErr.message);
        setLoading(false);
        return;
      }

      if (!user) {
        const next = window.location.pathname + window.location.search;
        router.replace(`/login?next=${encodeURIComponent(next)}`);
        return;
      }

      // 1) Tenta achar aluno vinculado ao usuário logado
      const { data: s, error: sErr } = await supabase
        .from('students')
        .select('id,name,p1k_pace,public_slug')
        .or(`auth_user_id.eq.${user.id},user_id.eq.${user.id}`)
        .maybeSingle();

      if (cancelled) return;

      if (sErr) {
        setError(sErr.message);
        setLoading(false);
        return;
      }

      if (!s) {
        // 2) Se não for aluno, pode ser treinador: manda para /students
        const { data: p } = await supabase.from('profiles').select('id').eq('id', user.id).maybeSingle();
        if (p?.id) {
          router.replace('/students');
          return;
        }
        setError('Seu usuário não está vinculado a um aluno ou treinador.');
        setLoading(false);
        return;
      }

      setStudent(s);

      // 3) Busca treinos disponíveis para o aluno (somente "ready")
      const { data: ws, error: wErr } = await supabase
        .from('workouts')
        .select('id,title,status,template_type,planned_date,planned_day,total_km,share_slug')
        .eq('student_id', s.id)
        .eq('status', 'ready')
        .order('planned_date', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false });

      if (cancelled) return;

      if (wErr) {
        setError(wErr.message);
        setLoading(false);
        return;
      }

      const list = (ws ?? []) as WorkoutRow[];
      setWorkouts(list);

      // 4) Busca execuções para mostrar "feito/pendente" (pega a última por treino)
      const ids = list.map((x) => x.id);
      if (ids.length > 0) {
        const { data: execs } = await supabase
          .from('executions')
          .select('id,workout_id,status,performed_at,completed_at,last_event_at,started_at,actual_total_km,rpe')
          .in('workout_id', ids);

        const byWorkout: Record<string, ExecutionRow[]> = {};
        (execs ?? []).forEach((e: any) => {
          const wId = e.workout_id as string;
          if (!byWorkout[wId]) byWorkout[wId] = [];
          byWorkout[wId].push(e as ExecutionRow);
        });

        const latest: Record<string, ExecutionRow | undefined> = {};
        Object.keys(byWorkout).forEach((wId) => {
          latest[wId] = pickLatestExecution(byWorkout[wId]);
        });
        setLatestExecByWorkout(latest);
      } else {
        setLatestExecByWorkout({});
      }

      setLoading(false);
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [router, supabase]);

  const grouped = useMemo(() => {
    const map = new Map<string, WorkoutRow[]>();
    workouts.forEach((w) => {
      const key = weekStartKey(w.planned_date);
      const arr = map.get(key) ?? [];
      arr.push(w);
      map.set(key, arr);
    });

    // Ordena as semanas (Sem data por último)
    const keys = Array.from(map.keys()).sort((a, b) => {
      if (a === 'Sem data') return 1;
      if (b === 'Sem data') return -1;
      return a.localeCompare(b);
    });

    return keys.map((k) => ({
      key: k,
      label: formatWeekLabel(k),
      workouts: (map.get(k) ?? []).slice().sort((a, b) => (a.planned_date ?? '').localeCompare(b.planned_date ?? '')),
    }));
  }, [workouts]);

  return (
    <>
      <Topbar title="Área do Aluno" />
      <main className="flex-1 p-4">
        {loading ? (
          <div className="text-sm text-slate-600 dark:text-slate-300">Carregando…</div>
        ) : error ? (
          <div className="rounded-xl bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        ) : (
          <>
            <div className="mb-4 rounded-2xl bg-white dark:bg-surface-dark p-4 shadow">
              <div className="text-sm text-slate-600 dark:text-slate-300">Aluno</div>
              <div className="text-xl font-semibold">{student?.name}</div>
              <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                <span className="font-medium">Ritmo P1k:</span> {student?.p1k_pace ?? '—'}
              </div>
              <div className="mt-3">
                <button
                  className="text-sm underline text-slate-600 dark:text-slate-300"
                  onClick={async () => {
                    await supabase.auth.signOut();
                    router.replace('/login');
                  }}
                >
                  Sair
                </button>
              </div>
            </div>

            {grouped.length === 0 ? (
              <div className="text-sm text-slate-600 dark:text-slate-300">Nenhum treino disponível.</div>
            ) : (
              <div className="space-y-4">
                {grouped.map((g) => (
                  <section key={g.key} className="rounded-2xl bg-white dark:bg-surface-dark p-4 shadow">
                    <h3 className="font-semibold mb-3">{g.label}</h3>

                    <div className="space-y-3">
                      {g.workouts.map((w) => {
                        const latest = latestExecByWorkout[w.id];
                        const done = latest?.status === 'completed';
                        const url =
                          student?.public_slug && w.share_slug ? `/w/${student.public_slug}/${w.share_slug}` : null;

                        return (
                          <div
                            key={w.id}
                            className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 flex items-start justify-between gap-3"
                          >
                            <div className="min-w-0">
                              <div className="text-sm text-slate-600 dark:text-slate-300">
                                {w.planned_date ? formatDateBR(w.planned_date) : 'Sem data'} ·{' '}
                                {TEMPLATE_LABEL[w.template_type] ?? w.template_type} · {w.total_km} km
                              </div>
                              <div className="font-medium truncate">
                                {w.title || TEMPLATE_LABEL[w.template_type] || 'Treino'}
                              </div>

                              {done ? (
                                <div className="mt-1 text-xs text-green-700 dark:text-green-300">
                                  Feito{latest?.performed_at ? ` em ${formatDateBR(latest.performed_at)}` : ''}
                                  {latest?.rpe ? ` · RPE ${latest.rpe}` : ''}
                                </div>
                              ) : latest?.status === 'in_progress' ? (
                                <div className="mt-1 text-xs text-amber-700 dark:text-amber-300">Em andamento</div>
                              ) : (
                                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Pendente</div>
                              )}
                            </div>

                            <div className="shrink-0">
                              <button
                                className="px-3 py-2 rounded-lg bg-primary text-slate-900 font-semibold text-sm disabled:opacity-50"
                                disabled={!url}
                                onClick={() => url && router.push(url)}
                              >
                                Abrir
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </>
  );
}
