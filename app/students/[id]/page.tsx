'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '../../../lib/supabaseBrowser';

type StudentRow = {
  id: string;
  trainer_id: string;
  name: string;
  email: string | null;
  p1k_sec_per_km: number | null;
  public_slug: string | null;
  created_at: string | null;
  portal_token: string | null;
  portal_enabled: boolean | null;
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

const TEMPLATE_LABEL: Record<string, string> = {
  easy_run: 'Rodagem',
  progressive: 'Progressivo',
  alternated: 'Alternado',
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

function generateTokenBase64Url(bytes = 24) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  const b64 = btoa(String.fromCharCode(...arr));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export default function StudentTrainerPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams<{ id: string }>();
  const studentId = params.id;

  const supabase = useMemo(() => createClient(), []);
  const [banner, setBanner] = useState<string | null>(null);

  const [student, setStudent] = useState<StudentRow | null>(null);
  const [weeks, setWeeks] = useState<WeekRow[]>([]);
  const [selectedWeekId, setSelectedWeekId] = useState<string | null>(null);

  const [workouts, setWorkouts] = useState<WorkoutRow[]>([]);
  const [latestExecByWorkout, setLatestExecByWorkout] = useState<Record<string, ExecutionRow | null>>({});
  const [weekWorkoutCounts, setWeekWorkoutCounts] = useState<Record<string, number>>({});

  const view = searchParams.get('view');
  const showHistory = view === 'history';

  const currentWeekStartISO = useMemo(() => toISODate(startOfWeekMonday(new Date())), []);
  const studentSlug = student?.public_slug ?? 'aluno';

  function visibleWeeks() {
    if (!weeks.length) return [];
    if (!showHistory) {
      return weeks.filter((w) => w.week_start >= currentWeekStartISO);
    }
    return weeks
      .filter((w) => w.week_start < currentWeekStartISO)
      .filter((w) => (weekWorkoutCounts[w.id] ?? 0) > 0);
  }

  async function loadStudent() {
    setBanner(null);
    const { data, error } = await supabase
      .from('students')
      .select('id,trainer_id,name,email,p1k_sec_per_km,public_slug,created_at,portal_token,portal_enabled')
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
    setBanner(null);

    const start = startOfWeekMonday(new Date());
    const starts = Array.from({ length: 10 }).map((_, i) => toISODate(addDays(start, i * 7)));

    const payload = starts.map((ws) => ({
      student_id: s.id,
      trainer_id: s.trainer_id,
      week_start: ws,
      week_end: toISODate(addDays(new Date(ws), 6)),
      label: formatWeekLabel(ws),
    }));

    const { error: upErr } = await supabase.from('training_weeks').upsert(payload, {
      onConflict: 'student_id,week_start',
    });

    if (upErr) {
      setBanner(upErr.message);
      return;
    }

    const { data, error } = await supabase
      .from('training_weeks')
      .select('id,student_id,trainer_id,week_start,week_end,label')
      .eq('student_id', s.id)
      .order('week_start', { ascending: true });

    if (error) {
      setBanner(error.message);
      return;
    }

    setWeeks((data || []) as WeekRow[]);
  }

  async function loadWeekWorkoutCounts(student_id: string) {
    const { data, error } = await supabase
      .from('workouts')
      .select('week_id')
      .eq('student_id', student_id)
      .not('week_id', 'is', null)
      .limit(2000);

    if (error) return;

    const counts: Record<string, number> = {};
    (data || []).forEach((row: any) => {
      const wid = row.week_id as string | null;
      if (!wid) return;
      counts[wid] = (counts[wid] ?? 0) + 1;
    });

    setWeekWorkoutCounts(counts);
  }

  async function loadWorkoutsForWeek(weekId: string | null) {
    if (!weekId) {
      setWorkouts([]);
      setLatestExecByWorkout({});
      return;
    }

    setBanner(null);

    const { data: ws, error } = await supabase
      .from('workouts')
      .select(
        'id, student_id, trainer_id, status, template_type, title, total_km, created_at, planned_date, planned_day, week_id, locked_at, closed_reason'
      )
      .eq('student_id', studentId)
      .eq('week_id', weekId)
      .order('planned_day', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true })
      .limit(50);

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

    const ids = list.map((w) => w.id);

    const { data: ex } = await supabase
      .from('executions')
      .select('id,workout_id,status,started_at,last_event_at,completed_at,performed_at,total_elapsed_ms,rpe,comment,actual_total_km')
      .in('workout_id', ids)
      .order('last_event_at', { ascending: false, nullsFirst: false });

    const map: Record<string, ExecutionRow | null> = {};
    (ex || []).forEach((row: any) => {
      if (!map[row.workout_id]) {
        map[row.workout_id] = row as ExecutionRow;
      }
    });

    setLatestExecByWorkout(map);
  }

  function goHistory(flag: boolean) {
    const url = flag ? `/students/${studentId}?view=history` : `/students/${studentId}`;
    router.replace(url);
  }

  async function ensurePortalToken() {
    if (!student) throw new Error('Aluno não carregado.');
    if (student.portal_enabled === false) throw new Error('Portal do aluno está desabilitado.');

    if (student.portal_token) return student.portal_token;

    const token = generateTokenBase64Url(24); // ~32 chars url-safe
    const { data, error } = await supabase
      .from('students')
      .update({ portal_token: token, portal_token_created_at: new Date().toISOString(), portal_enabled: true })
      .eq('id', student.id)
      .select('portal_token')
      .maybeSingle();

    if (error) throw new Error(error.message);
    const saved = (data as any)?.portal_token as string | null;
    if (!saved) throw new Error('Não foi possível gerar o token do portal.');
    setStudent((prev) => (prev ? { ...prev, portal_token: saved } : prev));
    return saved;
  }

  function portalUrl(token: string) {
    return `${window.location.origin}/p/${studentSlug}?t=${encodeURIComponent(token)}`;
  }

  async function sharePortalAccess() {
    setBanner(null);
    try {
      const token = await ensurePortalToken();
      const url = portalUrl(token);
      const msg = `Olá! Seus treinos ficam no Portal do PaceLink:\n${url}\n\nA cada semana, seus treinos serão liberados aqui.`;

      if (navigator.share) {
        await navigator.share({ title: 'PaceLink - Portal do aluno', text: msg, url });
        setBanner('Abrindo opções de compartilhamento…');
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(msg);
        setBanner('Mensagem copiada. Cole no WhatsApp.');
      } else {
        window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
        setBanner('Abrindo WhatsApp…');
      }
    } catch (e: any) {
      setBanner(e?.message || 'Não foi possível compartilhar o acesso.');
    }
  }

  async function publishWeekAndNotify() {
    setBanner(null);
    try {
      if (!selectedWeekId) throw new Error('Selecione uma semana.');
      if (!student) throw new Error('Aluno não carregado.');

      const token = await ensurePortalToken();
      const url = portalUrl(token);
      const week = weeks.find((w) => w.id === selectedWeekId);
      const weekLabel = week?.label || (week?.week_start ? formatWeekLabel(week.week_start) : 'esta semana');

      // Publicar: draft -> ready
      const { error } = await supabase
        .from('workouts')
        .update({ status: 'ready' })
        .eq('student_id', student.id)
        .eq('week_id', selectedWeekId)
        .eq('status', 'draft');

      if (error) throw new Error(error.message);

      await loadWorkoutsForWeek(selectedWeekId);
      await loadWeekWorkoutCounts(student.id);

      const msg = `Treinos liberados (${weekLabel}) ✅\n\nAcesse seu Portal:\n${url}`;
      if (navigator.share) {
        await navigator.share({ title: 'Treinos liberados', text: msg, url });
        setBanner('Semana publicada. Abrindo compartilhamento…');
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(msg);
        setBanner('Semana publicada. Mensagem copiada para enviar no WhatsApp.');
      } else {
        window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
        setBanner('Semana publicada. Abrindo WhatsApp…');
      }
    } catch (e: any) {
      setBanner(e?.message || 'Não foi possível publicar a semana.');
    }
  }

  function openWorkoutPreviewQA(workoutId: string) {
    if (!student?.portal_token) {
      setBanner('Gere o acesso do Portal primeiro (Compartilhar acesso).');
      return;
    }
    const url = `/p/${studentSlug}/workouts/${workoutId}?t=${encodeURIComponent(student.portal_token)}&preview=1`;
    window.open(url, '_blank');
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
    loadWeekWorkoutCounts(student.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student?.id]);

  // Ajusta week selecionada para sempre ser uma das visíveis
  useEffect(() => {
    const vis = visibleWeeks();
    if (vis.length === 0) {
      setSelectedWeekId(null);
      return;
    }
    const stillValid = selectedWeekId && vis.some((w) => w.id === selectedWeekId);
    if (!stillValid) setSelectedWeekId(vis[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weeks, weekWorkoutCounts, showHistory]);

  // Load workouts when week changes
  useEffect(() => {
    loadWorkoutsForWeek(selectedWeekId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWeekId]);

  const selectedWeek = weeks.find((w) => w.id === selectedWeekId) || null;
  const visWeeks = visibleWeeks();

  const plannedCount = workouts.length;
  const readyCount = workouts.filter((x) => x.status === 'ready').length;
  const draftCount = workouts.filter((x) => x.status === 'draft').length;

  const completedCount = workouts.filter((w) => latestExecByWorkout[w.id]?.status === 'completed').length;
  const pendingCount = Math.max(0, readyCount - completedCount);

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4">
      <div className="mx-auto max-w-3xl space-y-4">
        {/* Cabeçalho aluno */}
        <div className="rounded-2xl bg-white dark:bg-surface-dark shadow p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm text-slate-600 dark:text-slate-300">Aluno</div>
              <div className="mt-1 text-2xl font-extrabold leading-tight break-words">{student?.name ?? '—'}</div>
              <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                Ritmo P1k: <span className="font-semibold">{formatPace(student?.p1k_sec_per_km ?? null)}</span>
              </div>

              <div className="mt-3 flex flex-col sm:flex-row gap-2">
                <button
                  className="px-3 py-2 rounded-lg bg-primary text-slate-900 text-sm font-semibold"
                  onClick={sharePortalAccess}
                >
                  Compartilhar acesso (Portal)
                </button>

                <button
                  className="px-3 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold disabled:opacity-50"
                  disabled={!selectedWeekId}
                  onClick={publishWeekAndNotify}
                >
                  Publicar semana
                </button>
              </div>

              {student?.portal_token ? (
                <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  Portal configurado ✅
                </div>
              ) : (
                <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  Portal ainda não configurado (use “Compartilhar acesso”).
                </div>
              )}
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
        </div>

        {banner && (
          <div className="rounded-xl bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-700 dark:text-red-300">{banner}</div>
        )}

        {/* Semanas */}
        <div className="rounded-2xl bg-white dark:bg-surface-dark shadow p-4">
          <div className="flex items-center justify-between mb-3 gap-3">
            <div>
              <h2 className="font-semibold">Planejamento por semana</h2>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{selectedWeek ? selectedWeek.label : '—'}</div>
            </div>

            <div className="flex items-center gap-2">
              {!showHistory ? (
                <button
                  className="text-sm underline text-slate-600 dark:text-slate-300 disabled:opacity-50"
                  disabled={Object.values(weekWorkoutCounts).every((v) => v === 0)}
                  onClick={() => goHistory(true)}
                >
                  Ver histórico
                </button>
              ) : (
                <button className="text-sm underline text-slate-600 dark:text-slate-300" onClick={() => goHistory(false)}>
                  Voltar para semanas atuais
                </button>
              )}
            </div>
          </div>

          {visWeeks.length === 0 ? (
            <div className="text-sm text-slate-600 dark:text-slate-300">
              {showHistory ? 'Sem histórico de semanas com treinos.' : 'Semanas futuras ainda não carregadas.'}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {visWeeks.map((w) => (
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
          )}
        </div>

        {/* Treinos da semana */}
        <div className="rounded-2xl bg-white dark:bg-surface-dark shadow p-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <h2 className="font-semibold">Treinos da semana</h2>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Programados: <span className="font-semibold">{plannedCount}</span> · Disponíveis:{' '}
                <span className="font-semibold">{readyCount}</span> · Concluídos:{' '}
                <span className="font-semibold">{completedCount}</span> · Pendentes:{' '}
                <span className="font-semibold">{pendingCount}</span> · Rascunhos:{' '}
                <span className="font-semibold">{draftCount}</span>
              </div>
            </div>
          </div>

          {workouts.length === 0 ? (
            <div className="text-sm text-slate-600 dark:text-slate-300">Nenhum treino programado para esta semana ainda.</div>
          ) : (
            <div className="space-y-3">
              {workouts.map((w) => {
                const latestExec = latestExecByWorkout[w.id] ?? null;

                const locked =
                  !!w.locked_at || latestExec?.status === 'in_progress' || latestExec?.status === 'completed';

                const planned = w.planned_date ? `Planejado: ${formatDateBR(w.planned_date)}` : w.planned_day ? `Dia: ${w.planned_day}` : '';
                const templateLabel = TEMPLATE_LABEL[w.template_type ?? ''] ?? (w.template_type || 'Treino');

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
                          <div className="text-sm font-semibold break-words">{w.title || 'Treino'}</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">·</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">{templateLabel}</div>
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
                          className="w-full sm:w-auto px-3 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold whitespace-nowrap disabled:opacity-50"
                          disabled={!student?.portal_token}
                          onClick={() => openWorkoutPreviewQA(w.id)}
                        >
                          Ver como aluno
                        </button>
                      </div>
                    </div>

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
