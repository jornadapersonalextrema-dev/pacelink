'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '../../../../lib/supabaseBrowser';
import Topbar from '../../../../components/Topbar';
import Button from '../../../../components/Button';

type StudentRow = {
  id: string;
  name: string;
  public_slug: string | null;
  p1k_pace: string | null;
  trainer_id: string;
};

type WorkoutRow = {
  id: string;
  student_id: string;
  trainer_id: string;
  status: 'draft' | 'ready' | 'archived';
  title: string | null;
  template_type: 'easy_run' | 'progressive' | 'alternated';
  include_warmup: boolean;
  warmup_km: number;
  include_cooldown: boolean;
  cooldown_km: number;
  blocks: any[];
  total_km: number;
  planned_date: string | null;
  share_slug: string | null;
  version: number;
  locked_at: string | null;
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

const TEMPLATE_LABEL: Record<string, string> = {
  easy_run: 'Rodagem',
  progressive: 'Progressivo',
  alternated: 'Alternado',
};

function formatDateBR(dateStr?: string | null) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const [y, m, d] = parts;
  return `${d}/${m}/${y}`;
}

function safeNumber(value: string, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export default function SharedWorkoutPage() {
  const router = useRouter();
  const params = useParams<{ studentSlug: string; shareSlug: string }>();
  const supabase = useMemo(() => createClient(), []);
  const studentSlug = params.studentSlug;
  const shareSlug = params.shareSlug;

  const [loading, setLoading] = useState(true);
  const [student, setStudent] = useState<StudentRow | null>(null);
  const [workout, setWorkout] = useState<WorkoutRow | null>(null);
  const [execution, setExecution] = useState<ExecutionRow | null>(null);
  const [performedAt, setPerformedAt] = useState<string>(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });
  const [actualKm, setActualKm] = useState<string>(''); // string p/ permitir vazio
  const [rpe, setRpe] = useState<string>(''); // 1..10
  const [comment, setComment] = useState<string>('');
  const [banner, setBanner] = useState<string | null>(null);

  async function fetchAll() {
    setLoading(true);
    setBanner(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      const next = window.location.pathname + window.location.search;
      router.replace(`/login?next=${encodeURIComponent(next)}`);
      return;
    }

    // Descobre o aluno do usuário logado
    const { data: s, error: sErr } = await supabase
      .from('students')
      .select('id,name,public_slug,p1k_pace,trainer_id')
      .or(`auth_user_id.eq.${user.id},user_id.eq.${user.id}`)
      .maybeSingle();

    if (sErr) {
      setBanner(sErr.message);
      setLoading(false);
      return;
    }
    if (!s) {
      setBanner('Seu usuário não está vinculado a um aluno.');
      setLoading(false);
      return;
    }
    if (s.public_slug && s.public_slug !== studentSlug) {
      setBanner('Este link não corresponde ao seu perfil de aluno.');
      setLoading(false);
      return;
    }
    setStudent(s as StudentRow);

    // Busca o treino pelo share_slug
    const { data: w, error: wErr } = await supabase
      .from('workouts')
      .select(
        'id,student_id,trainer_id,status,title,template_type,include_warmup,warmup_km,include_cooldown,cooldown_km,blocks,total_km,planned_date,share_slug,version,locked_at'
      )
      .eq('share_slug', shareSlug)
      .maybeSingle();

    if (wErr) {
      setBanner(wErr.message);
      setLoading(false);
      return;
    }
    if (!w) {
      setBanner('Treino não encontrado ou indisponível.');
      setLoading(false);
      return;
    }
    if (w.student_id !== s.id) {
      setBanner('Este treino não pertence ao seu perfil.');
      setLoading(false);
      return;
    }
    if (w.status !== 'ready' && w.status !== 'archived') {
      setBanner('Este treino ainda não está disponível.');
      setLoading(false);
      return;
    }
    setWorkout(w as WorkoutRow);

    if (!actualKm) {
      setActualKm(String((w as any).total_km ?? ''));
    }

    // Pega a última execução (se houver)
    const { data: execs } = await supabase
      .from('executions')
      .select('id,workout_id,status,started_at,last_event_at,completed_at,performed_at,total_elapsed_ms,rpe,comment,actual_total_km')
      .eq('workout_id', (w as any).id)
      .order('last_event_at', { ascending: false, nullsFirst: false })
      .order('started_at', { ascending: false })
      .limit(1);

    const last = (execs && execs.length > 0 ? (execs[0] as any) : null) as ExecutionRow | null;
    setExecution(last);

    // Se já tem execução, carrega campos
    if (last) {
      if (last.performed_at) setPerformedAt(last.performed_at);
      if (last.actual_total_km != null) setActualKm(String(last.actual_total_km));
      if (last.rpe != null) setRpe(String(last.rpe));
      if (last.comment) setComment(last.comment);
    }

    setLoading(false);
  }

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentSlug, shareSlug]);

  async function startExecution() {
    if (!workout || !student) return;
    setBanner(null);

    const nowIso = new Date().toISOString();

    const payload: any = {
      workout_id: workout.id,
      student_id: student.id,
      trainer_id: workout.trainer_id,
      status: 'in_progress',
      started_at: nowIso,
      last_event_at: nowIso,
      performed_at: performedAt || null,
      locked_version: workout.version,
      workout_version: workout.version,
      client_meta: { source: 'portal_aluno' },
    };

    const { data, error } = await supabase.from('executions').insert(payload).select().maybeSingle();

    if (error) {
      setBanner(error.message || 'Não foi possível iniciar a execução.');
      return;
    }
    setExecution(data as any);
  }

  async function completeExecution() {
    if (!execution || !workout) return;
    setBanner(null);

    const nowIso = new Date().toISOString();
    const started = execution.started_at ? new Date(execution.started_at).getTime() : Date.now();
    const elapsed = Math.max(0, Date.now() - started);

    const payload: any = {
      status: 'completed',
      completed_at: nowIso,
      last_event_at: nowIso,
      total_elapsed_ms: elapsed,
      performed_at: performedAt || null,
      actual_total_km: actualKm ? safeNumber(actualKm, workout.total_km) : workout.total_km,
      rpe: rpe ? Math.max(1, Math.min(10, safeNumber(rpe, 0))) : null,
      comment: comment ? comment.trim() : null,
      // Para o MVP: copiamos a estrutura planejada (sem tempos por bloco).
      actual_blocks: workout.blocks ?? [],
    };

    const { data, error } = await supabase.from('executions').update(payload).eq('id', execution.id).select().maybeSingle();

    if (error) {
      setBanner(error.message || 'Não foi possível concluir a execução.');
      return;
    }

    setExecution(data as any);
  }

  const canStart = !!workout && (!execution || execution.status === 'completed');
  const inProgress = execution?.status === 'in_progress';
  const completed = execution?.status === 'completed';

  return (
    <>
      <Topbar
        title="Treino do Aluno"
        action={
          <button className="text-sm underline text-slate-600 dark:text-slate-300" onClick={() => router.push('/aluno')}>
            Voltar
          </button>
        }
      />
      <main className="flex-1 p-4">
        {loading ? (
          <div className="text-sm text-slate-600 dark:text-slate-300">Carregando…</div>
        ) : banner ? (
          <div className="rounded-xl bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-700 dark:text-red-300">{banner}</div>
        ) : !workout || !student ? null : (
          <div className="space-y-4">
            <div className="rounded-2xl bg-white dark:bg-surface-dark p-4 shadow">
              <div className="text-sm text-slate-600 dark:text-slate-300">Aluno</div>
              <div className="text-lg font-semibold">{student.name}</div>
              <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                {workout.planned_date ? `Planejado para ${formatDateBR(workout.planned_date)} · ` : ''}
                {TEMPLATE_LABEL[workout.template_type] ?? workout.template_type} · {workout.total_km} km
              </div>

              <div className="mt-3">
                <div className="text-xs text-slate-500 dark:text-slate-400">Título</div>
                <div className="font-medium">{workout.title || TEMPLATE_LABEL[workout.template_type] || 'Treino'}</div>
              </div>
            </div>

            <div className="rounded-2xl bg-white dark:bg-surface-dark p-4 shadow space-y-3">
              <h3 className="font-semibold">Estrutura</h3>

              {workout.include_warmup && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3">
                  <div className="font-medium">Aquecimento</div>
                  <div className="text-sm text-slate-600 dark:text-slate-300">{workout.warmup_km} km</div>
                </div>
              )}

              <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3">
                <div className="font-medium mb-2">Blocos</div>
                <div className="space-y-2">
                  {(workout.blocks ?? []).length === 0 ? (
                    <div className="text-sm text-slate-600 dark:text-slate-300">Nenhum bloco definido.</div>
                  ) : (
                    (workout.blocks ?? []).map((b: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between text-sm">
                        <div className="truncate">
                          Bloco {idx + 1} · {String(b.intensity ?? '').toUpperCase()}
                        </div>
                        <div className="font-semibold">{b.distance_km ?? b.distanceKm ?? b.km ?? '—'} km</div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {workout.include_cooldown && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3">
                  <div className="font-medium">Desaquecimento</div>
                  <div className="text-sm text-slate-600 dark:text-slate-300">{workout.cooldown_km} km</div>
                </div>
              )}
            </div>

            <div className="rounded-2xl bg-white dark:bg-surface-dark p-4 shadow space-y-3">
              <h3 className="font-semibold">Registro do realizado</h3>

              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Data realizada</label>
                  <input
                    type="date"
                    value={performedAt}
                    onChange={(e) => setPerformedAt(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Distância realizada (km)</label>
                    <input
                      inputMode="decimal"
                      value={actualKm}
                      onChange={(e) => setActualKm(e.target.value)}
                      placeholder={String(workout.total_km)}
                      className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">RPE (1–10)</label>
                    <input
                      inputMode="numeric"
                      value={rpe}
                      onChange={(e) => setRpe(e.target.value)}
                      placeholder="Opcional"
                      className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Comentário (opcional)</label>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={3}
                    placeholder="Como você se sentiu? Alguma observação?"
                    className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2"
                  />
                </div>
              </div>

              {completed ? (
                <div className="rounded-xl bg-green-50 dark:bg-green-900/20 p-3 text-sm text-green-800 dark:text-green-200">
                  Treino concluído{execution?.performed_at ? ` em ${formatDateBR(execution.performed_at)}` : ''}.
                </div>
              ) : inProgress ? (
                <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 p-3 text-sm text-amber-800 dark:text-amber-200">
                  Execução em andamento.
                </div>
              ) : (
                <div className="text-sm text-slate-600 dark:text-slate-300">
                  Quando iniciar e concluir, o treino ficará registrado no seu histórico.
                </div>
              )}

              <div className="flex gap-2">
                {canStart && (
                  <Button onClick={startExecution} fullWidth>
                    Iniciar execução
                  </Button>
                )}
                {inProgress && (
                  <Button onClick={completeExecution} fullWidth>
                    Concluir execução
                  </Button>
                )}
              </div>

              {completed && (
                <button className="text-sm underline text-slate-600 dark:text-slate-300" onClick={startExecution}>
                  Registrar nova tentativa
                </button>
              )}
            </div>
          </div>
        )}
      </main>
    </>
  );
}
