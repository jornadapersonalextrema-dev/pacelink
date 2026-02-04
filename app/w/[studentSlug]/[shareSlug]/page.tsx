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
  trainer_id: string | null;
  p1k_pace: string | null; // ex: "4:30/km"
  p1k_sec_per_km: number | null; // ex: 270
};

type WorkoutRow = {
  id: string;
  student_id: string;
  trainer_id: string | null;
  status: 'draft' | 'ready' | 'archived';
  title: string | null;
  template_type: 'easy_run' | 'progressive' | 'alternated' | string;
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
  template_type: 'easy_run' | 'progressive' | 'alternated' | string;
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

function paceSecToStr(secPerKm: number | null) {
  if (!secPerKm || !Number.isFinite(secPerKm)) return null;
  const mm = Math.floor(secPerKm / 60);
  const ss = Math.round(secPerKm % 60);
  return `${mm}:${String(ss).padStart(2, '0')}/km`;
}

function paceStrToSec(pace: string | null): number | null {
  if (!pace) return null;
  const s = pace.trim().toLowerCase().replace('/km', '').replace('km', '').trim();
  // aceita "4:30" ou "04:30"
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const mm = Number(m[1]);
  const ss = Number(m[2]);
  if (!Number.isFinite(mm) || !Number.isFinite(ss)) return null;
  return mm * 60 + ss;
}

function readNumber(v: any): number | null {
  if (v == null) return null;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v.replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function getBlockKm(b: any): number | null {
  return (
    readNumber(b?.km) ??
    readNumber(b?.distance_km) ??
    readNumber(b?.distanceKm) ??
    readNumber(b?.dist_km) ??
    readNumber(b?.distKm) ??
    readNumber(b?.distance) ??
    null
  );
}

function getBlockPaceRaw(b: any): string | null {
  const v =
    b?.pace ??
    b?.pace_suggested ??
    b?.suggested_pace ??
    b?.paceSuggested ??
    b?.ritmo ??
    b?.ritmo_sugerido ??
    b?.ritmoSugerido ??
    null;

  if (v == null) return null;

  // pode vir número (segundos por km)
  if (typeof v === 'number') return paceSecToStr(v);
  if (typeof v === 'string') {
    const s = v.trim();
    // já vem "4:30/km"
    if (s.includes(':')) return s.includes('/km') ? s : `${s}/km`;
  }
  return null;
}

function normalizeIntensityLabel(intensity: any): string {
  const raw = String(intensity ?? '').trim().toLowerCase();
  if (!raw) return '—';

  if (raw.includes('leve') || raw.includes('easy')) return 'Leve';
  if (raw.includes('moder') || raw.includes('mod')) return 'Moderado';
  if (raw.includes('forte') || raw.includes('hard')) return 'Forte';
  if (raw.includes('muito') || raw.includes('very')) return 'Muito forte';

  // se veio algo tipo "Moderado"
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function intensityMultiplier(intensity: any): number | null {
  const raw = String(intensity ?? '').trim().toLowerCase();
  if (!raw) return null;

  // Esses fatores batem com seu exemplo:
  // P1k 4:30 (270s) -> Forte ~ 4:03 (243s) => 0.9
  if (raw.includes('leve') || raw.includes('easy')) return 1.10;
  if (raw.includes('moder') || raw.includes('mod')) return 1.00;
  if (raw.includes('forte') || raw.includes('hard')) return 0.90;
  if (raw.includes('muito') || raw.includes('very')) return 0.85;

  return null;
}

function computeSuggestedPace(b: any, student: StudentRow | null): string | null {
  // se o bloco já tem pace salvo, usa
  const saved = getBlockPaceRaw(b);
  if (saved) return saved;

  // senão tenta calcular pelo P1k
  const baseSec =
    student?.p1k_sec_per_km ??
    paceStrToSec(student?.p1k_pace ?? null) ??
    null;

  const mult = intensityMultiplier(b?.intensity);
  if (!baseSec || !mult) return null;

  return paceSecToStr(Math.round(baseSec * mult));
}

export default function SharedWorkoutPage() {
  const router = useRouter();
  const params = useParams<{ studentSlug: string; shareSlug: string }>();
  const supabase = useMemo(() => createClient(), []);
  const studentSlug = params.studentSlug;
  const shareSlug = params.shareSlug;

  const [loading, setLoading] = useState(true);
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [allowExecution, setAllowExecution] = useState(false);

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

  const [actualKm, setActualKm] = useState<string>(''); // string para permitir vazio
  const [rpe, setRpe] = useState<string>(''); // 1..10
  const [comment, setComment] = useState<string>('');
  const [banner, setBanner] = useState<string | null>(null);

  async function fetchAll() {
    setLoading(true);
    setBanner(null);
    setAllowExecution(false);

    // 1) Sempre carrega via view pública
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

    // base student (público)
    setStudent({
      id: pubRow.student_id,
      name: pubRow.student_name,
      public_slug: pubRow.student_public_slug,
      trainer_id: null,
      p1k_pace: null,
      p1k_sec_per_km: null,
    });

    // base workout (público)
    setWorkout({
      id: pubRow.workout_id,
      student_id: pubRow.student_id,
      trainer_id: null,
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
    });

    if (!actualKm) setActualKm(String(pubRow.total_km ?? ''));

    if (pubRow.status !== 'ready' && pubRow.status !== 'archived') {
      setBanner('Este treino ainda não está disponível.');
    }

    // 2) Auth (opcional)
    const {
      data: { user },
    } = await supabase.auth.getUser();

    setAuthUserId(user?.id ?? null);

    // sem login -> preview público
    if (!user) {
      setExecution(null);
      setLoading(false);
      return;
    }

    // 3) tenta achar "aluno logado"
    const { data: loggedStudent, error: loggedStudentErr } = await supabase
      .from('students')
      .select('id,name,public_slug,trainer_id,p1k_pace,p1k_sec_per_km')
      .or(`auth_user_id.eq.${user.id},user_id.eq.${user.id}`)
      .maybeSingle();

    if (loggedStudentErr) {
      // não bloqueia preview
      setExecution(null);
      setLoading(false);
      return;
    }

    // 4) se não é aluno, mas é treinador: buscar dados do aluno do link (para ritmo/preview)
    if (!loggedStudent) {
      const { data: linkStudent } = await supabase
        .from('students')
        .select('id,name,public_slug,trainer_id,p1k_pace,p1k_sec_per_km')
        .eq('id', pubRow.student_id)
        .maybeSingle();

      if (linkStudent) {
        setStudent(linkStudent as any);
      }

      // treinador não registra execução
      setAllowExecution(false);
      setExecution(null);
      setLoading(false);
      return;
    }

    // é aluno logado
    setStudent(loggedStudent as any);

    const isSameStudent = (loggedStudent as any).id === pubRow.student_id;
    setAllowExecution(isSameStudent);

    if (!isSameStudent) {
      setExecution(null);
      setBanner((prev) => prev || 'Você está logado como outro aluno. Para registrar execução, entre com a conta correta.');
      setLoading(false);
      return;
    }

    // 5) agora pega campos do workout na tabela (RLS do aluno deve permitir)
    const { data: w, error: wErr } = await supabase
      .from('workouts')
      .select('id,trainer_id,planned_date,locked_at,version,status')
      .eq('id', pubRow.workout_id)
      .maybeSingle();

    if (!wErr && w) {
      setWorkout((prev) => ({ ...(prev as any), ...(w as any) }));
    }

    // 6) última execução
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
    if (!workout || !student || !allowExecution) return;
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
    if (!execution || !workout || !allowExecution) return;
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
      actual_total_km: actualKm ? Number(String(actualKm).replace(',', '.')) : workout.total_km,
      rpe: rpe ? Math.max(1, Math.min(10, Number(rpe))) : null,
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

  return (
    <>
      <Topbar
        title="Treino do Aluno"
        action={
          <button className="text-sm underline text-slate-600 dark:text-slate-300" onClick={() => router.back()}>
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
                    {TEMPLATE_LABEL[workout.template_type] ?? workout.template_type} · {workout.total_km} km
                    {workout.planned_date ? ` · Planejado para ${formatDateBR(workout.planned_date)}` : ''}
                  </div>

                  {student.p1k_pace || student.p1k_sec_per_km ? (
                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Ritmo P1k:{' '}
                      <span className="font-semibold">
                        {student.p1k_pace ?? paceSecToStr(student.p1k_sec_per_km) ?? '—'}
                      </span>
                    </div>
                  ) : null}

                  <div className="mt-3">
                    <div className="text-xs text-slate-500 dark:text-slate-400">Título</div>
                    <div className="font-medium">
                      {workout.title || TEMPLATE_LABEL[workout.template_type] || 'Treino'}
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl bg-white dark:bg-surface-dark p-4 shadow">
                  <div className="text-lg font-semibold">Blocos</div>
                  <div className="mt-3 space-y-3">
                    {blocks.length === 0 ? (
                      <div className="text-sm text-slate-600 dark:text-slate-300">Sem blocos definidos.</div>
                    ) : (
                      blocks.map((b: any, idx: number) => {
                        const km = getBlockKm(b);
                        const intensityLabel = normalizeIntensityLabel(b?.intensity);
                        const pace = computeSuggestedPace(b, student);

                        const notes =
                          b?.notes ?? b?.obs ?? b?.note ?? b?.observacao ?? b?.observação ?? null;

                        return (
                          <div key={idx} className="rounded-xl border border-slate-200 dark:border-slate-800 p-3">
                            <div className="text-sm font-semibold">Bloco {idx + 1}</div>

                            <div className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                              Distância: <span className="font-semibold">{km != null ? km : '—'}</span> km
                            </div>

                            <div className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                              Intensidade: <span className="font-semibold">{intensityLabel}</span>
                            </div>

                            <div className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                              Ritmo sugerido: <span className="font-semibold">{pace ?? '—'}</span>
                            </div>

                            {notes ? (
                              <div className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                                Obs: <span className="font-semibold">{String(notes)}</span>
                              </div>
                            ) : null}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="rounded-2xl bg-white dark:bg-surface-dark p-4 shadow">
                  <div className="text-lg font-semibold">Execução</div>

                  {!allowExecution ? (
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
