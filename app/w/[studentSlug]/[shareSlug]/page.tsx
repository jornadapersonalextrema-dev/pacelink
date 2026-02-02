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

type WorkoutPublicRow = {
  workout_id: string;
  share_slug: string | null;
  status: 'draft' | 'ready' | 'archived';
  template_type: 'easy_run' | 'progressive' | 'alternated';
  title: string | null;
  include_warmup: boolean;
  warmup_km: number;
  include_cooldown: boolean;
  cooldown_km: number;
  blocks: any[];
  total_km: number;
  version: number;
  created_at: string;
  updated_at: string;
  student_id: string;
  student_name: string;
  student_public_slug: string | null;
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
  const [authUserId, setAuthUserId] = useState<string | null>(null);

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

    // 1) Sempre carrega o treino via VIEW pública (permite preview sem login)
    const { data: pub, error: pubErr } = await supabase
      .from('v_workouts_public')
      .select(
        'workout_id, share_slug, status, template_type, title, include_warmup, warmup_km, include_cooldown, cooldown_km, blocks, total_km, version, created_at, updated_at, student_id, student_name, student_public_slug'
      )
      .eq('student_public_slug', studentSlug)
      .eq('share_slug', shareSlug)
      .maybeSingle();

    if (pubErr) {
      setBanner(pubErr.message || 'Não foi possível carregar o treino.');
      setLoading(false);
      return;
    }

    if (!pub) {
      setBanner('Treino não encontrado ou link inválido.');
      setLoading(false);
      return;
    }

    const pubRow = pub as WorkoutPublicRow;

    // Preenche dados públicos do aluno (para preview mesmo sem login)
    setStudent({
      id: pubRow.student_id,
      name: pubRow.student_name,
      public_slug: pubRow.student_public_slug,
      p1k_pace: null,
      trainer_id: '' as any,
    });

    // Monta objeto base de treino a partir da view
    const baseWorkout: WorkoutRow = {
      id: pubRow.workout_id,
      student_id: pubRow.student_id,
      trainer_id: '' as any, // será preenchido se o aluno estiver logado (query na tabela workouts)
      status: pubRow.status,
      title: pubRow.title,
      template_type: pubRow.template_type,
      include_warmup: pubRow.include_warmup,
      warmup_km: pubRow.warmup_km,
      include_cooldown: pubRow.include_cooldown,
      cooldown_km: pubRow.cooldown_km,
      blocks: (pubRow.blocks as any) ?? [],
      total_km: pubRow.total_km,
      planned_date: null,
      share_slug: pubRow.share_slug,
      version: pubRow.version,
      locked_at: null,
    };

    setWorkout(baseWorkout);

    if (!actualKm) {
      setActualKm(String(pubRow.total_km ?? ''));
    }

    if (pubRow.status !== 'ready' && pubRow.status !== 'archived') {
      setBanner('Este treino ainda não está disponível.');
    }

    // 2) Descobre usuário logado (opcional)
    const {
      data: { user },
    } = await supabase.auth.getUser();

    setAuthUserId(user?.id ?? null);

    // 3) Se não está logado: preview público (sem execução)
    if (!user) {
      setExecution(null);
      setLoading(false);
      return;
    }

    // 4) Se está logado, tenta identificar se é ALUNO (para permitir registrar execução)
    const { data: s, error: sErr } = await supabase
      .from('students')
      .select('id,name,public_slug,p1k_pace,trainer_id')
      .or(`auth_user_id.eq.${user.id},user_id.eq.${user.id}`)
      .maybeSingle();

    if (sErr) {
      // não bloqueia preview; só impede execução
      setExecution(null);
      setBanner((prevMsg) => prevMsg || sErr.message);
      setLoading(false);
      return;
    }

    if (!s) {
      // treinador (ou usuário sem vínculo) -> preview ok, execução não
      setExecution(null);
      setLoading(false);
      return;
    }

    // Se achou aluno logado, sobrescreve dados (inclui p1k_pace etc)
    setStudent(s as StudentRow);

    const isSameStudent = (s as any).id === pubRow.student_id;

    if (!isSameStudent) {
      setExecution(null);
      setBanner((prevMsg) => prevMsg || 'Você está logado como outro aluno. Para registrar execução, entre com a conta correta.');
      setLoading(false);
      return;
    }

    // 5) Agora sim buscamos campos necessários para execução na tabela workouts (RLS do aluno deve permitir)
    const { data: w, error: wErr } = await supabase
      .from('workouts')
      .select('id,trainer_id,planned_date,locked_at,version,status')
      .eq('id', pubRow.workout_id)
      .maybeSingle();

    if (!wErr && w) {
      setWorkout((prev) => ({ ...(prev as any), ...(w as any) }));
    }

    // 6) Pega a última execução (se houver)
    const { data: execs } = await supabase
      .from('executions')
      .select('id,workout_id,status,started_at,last_event_at,completed_at,performed_at,total_elapsed_ms,rpe,comment,actual_total_km')
      .eq('workout_id', pubRow.workout_id)
      .order('last_event_at', { ascending: false, nullsFirst: false })
      .order('started_at', { ascending: false })
      .limit(1);

    const last = (execs && execs.length > 0 ? (execs[0] as any) : null) as ExecutionRow | null;
    setExecution(last);

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
    if (!workout || !student || student.id !== workout.student_id) return;
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
      comment: comment || null,
    };

    const { data, error } = await supabase.from('executions').update(payload).eq('id', execution.id).select().maybeSingle();

    if (error) {
      setBanner(error.message || 'Não foi possível concluir a execução.');
      return;
    }
    setExecution(data as any);
  }

  const blocks = useMemo(() => {
    const b = (workout?.blocks || []) as any[];
    return Array.isArray(b) ? b : [];
  }, [workout?.blocks]);

  const completed = execution?.status === 'completed';
  const inProgress = execution?.status === 'in_progress';

  const canExecute = !!authUserId && !!student && !!workout && student.id === workout.student_id;

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
        ) : (
          <div className="space-y-4">
            {banner ? (
              <div className="rounded-xl bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-700 dark:text-red-300">{banner}</div>
            ) : null}

            {!authUserId ? (
              <div className="rounded-xl bg-slate-100 dark:bg-slate-900/40 p-4 text-sm text-slate-700 dark:text-slate-200">
                Para registrar a execução (realizado, RPE e comentário), faça login como aluno.
                <div className="mt-3">
                  <Button
                    onClick={() => {
                      const next = window.location.pathname + window.location.search;
                      router.push(`/login?next=${encodeURIComponent(next)}`);
                    }}
                  >
                    Fazer login
                  </Button>
                </div>
              </div>
            ) : null}

            {!workout || !student ? null : (
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

                {/* blocos */}
                <div className="rounded-2xl bg-white dark:bg-surface-dark p-4 shadow">
                  <div className="text-lg font-semibold">Blocos</div>
                  <div className="mt-3 space-y-3">
                    {blocks.length === 0 ? (
                      <div className="text-sm text-slate-600 dark:text-slate-300">Sem blocos definidos.</div>
                    ) : (
                      blocks.map((b: any, idx: number) => (
                        <div key={idx} className="rounded-xl border border-slate-200 dark:border-slate-800 p-3">
                          <div className="text-sm font-semibold">Bloco {idx + 1}</div>
                          <div className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                            Distância: <span className="font-semibold">{b?.km ?? '—'}</span> km
                          </div>
                          <div className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                            Intensidade: <span className="font-semibold">{b?.intensity ?? '—'}</span>
                          </div>
                          <div className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                            Ritmo sugerido: <span className="font-semibold">{b?.pace ?? '—'}</span>
                          </div>
                          {b?.notes ? (
                            <div className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                              Obs: <span className="font-semibold">{b.notes}</span>
                            </div>
                          ) : null}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* execução */}
                <div className="rounded-2xl bg-white dark:bg-surface-dark p-4 shadow">
                  <div className="text-lg font-semibold">Execução</div>

                  {!canExecute ? (
                    <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                      Você pode visualizar este treino, mas para registrar execução é necessário estar logado como o aluno correto.
                    </div>
                  ) : (
                    <>
                      <div className="mt-3 space-y-3">
                        <div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">Data realizada</div>
                          <input
                            type="date"
                            className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent px-3 py-2"
                            value={performedAt}
                            onChange={(e) => setPerformedAt(e.target.value)}
                            disabled={completed}
                          />
                        </div>

                        <div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">Total realizado (km)</div>
                          <input
                            className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent px-3 py-2"
                            value={actualKm}
                            onChange={(e) => setActualKm(e.target.value)}
                            disabled={completed}
                            inputMode="decimal"
                          />
                        </div>

                        <div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">RPE (1 a 10)</div>
                          <input
                            className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent px-3 py-2"
                            value={rpe}
                            onChange={(e) => setRpe(e.target.value)}
                            disabled={completed}
                            inputMode="numeric"
                          />
                        </div>

                        <div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">Comentário (opcional)</div>
                          <textarea
                            className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent px-3 py-2"
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            disabled={completed}
                            rows={3}
                          />
                        </div>
                      </div>

                      <div className="mt-4 space-y-2">
                        {!execution ? (
                          <Button onClick={startExecution} fullWidth>
                            Iniciar execução
                          </Button>
                        ) : null}

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
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </>
  );
}
