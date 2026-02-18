'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
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

  // (1) novo campo
  auth_user_id: string | null;
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


function isValidEmail(email: string): boolean {
  const v = (email || '').trim();
  if (!v) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
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

  const weeksBarRef = useRef<HTMLDivElement | null>(null);
  const activeWeekBtnRef = useRef<HTMLButtonElement | null>(null);
  const didInitialWeekScrollRef = useRef(false);

  const [workouts, setWorkouts] = useState<WorkoutRow[]>([]);
  const [latestExecByWorkout, setLatestExecByWorkout] = useState<Record<string, ExecutionRow | null>>({});

  // (3) novos states
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteMsg, setInviteMsg] = useState<string | null>(null);

  // (4) modal para cadastrar e-mail quando faltar
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [emailDraft, setEmailDraft] = useState('');
  const [emailModalSaving, setEmailModalSaving] = useState(false);
  const [emailModalError, setEmailModalError] = useState<string | null>(null);

  const currentWeekStartISO = useMemo(() => toISODate(mondayOfWeek(new Date())), []);

  async function loadStudent() {
    setLoading(true);
    setBanner(null);

    const { data, error } = await supabase
      .from('students')
      // (2) inclui auth_user_id
      .select('id,name,email,trainer_id,public_slug,portal_token,portal_enabled,p1k_sec_per_km,auth_user_id')
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

  // (4) shareUrl + sharePortal (copiar/colar conforme você pediu)
  async function shareUrl(url: string) {
    const title = student?.name ? `Portal do aluno — ${student.name}` : 'Portal do aluno';
    const text = student?.name ? `Acesse os treinos do(a) ${student.name} pelo portal.` : 'Acesse os treinos pelo portal.';

    try {
      // Abre a sheet de compartilhamento no celular (inclui WhatsApp)
      // @ts-ignore
      if (typeof navigator !== 'undefined' && (navigator as any).share) {
        // @ts-ignore
        await (navigator as any).share({ title, text, url });
        setBanner('Pronto! Link compartilhado.');
        return;
      }

      // Fallback: copia link
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        setBanner('Link copiado! Cole no WhatsApp para enviar.');
        return;
      }

      // Último fallback
      window.prompt('Copie o link abaixo e envie no WhatsApp:', url);
      setBanner('Link pronto para copiar.');
    } catch (e: any) {
      // Cancelamento do share não é erro
      const msg = String(e?.message || '').toLowerCase();
      if (msg.includes('abort') || msg.includes('cancel')) return;

      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(url);
          setBanner('Link copiado! Cole no WhatsApp para enviar.');
        } else {
          window.prompt('Copie o link abaixo e envie no WhatsApp:', url);
        }
      } catch {
        setBanner('Não foi possível compartilhar automaticamente. Copie o link e envie no WhatsApp.');
      }
    }
  }

  async function sharePortal() {
    if (!student) return;
    setBanner(null);
    setInviteMsg(null);

    const makeUrl = (slug: string, token: string) => `${window.location.origin}/p/${slug}?t=${encodeURIComponent(token)}`;

    if (student.portal_enabled && student.portal_token && student.public_slug) {
      const url = makeUrl(student.public_slug, student.portal_token);
      await shareUrl(url);
      return;
    }

    const { data, error } = await supabase
      .from('students')
      .update({ portal_enabled: true })
      .eq('id', student.id)
      // (2) inclui auth_user_id aqui também
      .select('id,name,email,trainer_id,public_slug,portal_token,portal_enabled,p1k_sec_per_km,auth_user_id')
      .single();

    if (error) {
      setBanner(error.message);
      return;
    }

    setStudent(data as any);

    if ((data as any).portal_token && (data as any).public_slug) {
      const url = makeUrl((data as any).public_slug, (data as any).portal_token);
      await shareUrl(url);
    } else {
      setBanner('Portal habilitado, mas não foi possível gerar o link.');
    }
  }

  // (5) inviteStudentAccess
  async function inviteStudentAccess(skipEmailCheck = false) {
    if (!student) return;
    setInviteMsg(null);
    setBanner(null);

    const emailTrim = (student.email ?? '').toString().trim();
    if (!skipEmailCheck && !emailTrim) {
      openEmailModal('');
      return;
    }

    if (!emailTrim) {
      setInviteMsg('Cadastre o e-mail do aluno antes de enviar o convite.');
      return;
    }

    setInviteLoading(true);
    try {
      const res = await fetch(`/api/trainer/students/${student.id}/invite`, { method: 'POST' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);

      setInviteMsg(json?.message || 'Convite enviado com sucesso!');
      await loadStudent();
    } catch (e: any) {
      setInviteMsg(e?.message || 'Erro ao enviar convite.');
    } finally {
      setInviteLoading(false);
    }
  }

  async function patchStudentEmail(studentId: string, emailValue: string) {
    const res = await fetch(`/api/trainer/students/${studentId}/email`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: emailValue }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
    return (json?.email || emailValue) as string;
  }

  function openEmailModal(prefill?: string | null) {
    setEmailModalError(null);
    setEmailDraft((prefill || '').toString());
    setEmailModalOpen(true);
  }

  async function saveEmailAndInvite() {
    if (!student) return;

    const v = (emailDraft || '').trim();
    if (!isValidEmail(v)) {
      setEmailModalError('E-mail inválido.');
      return;
    }

    setEmailModalSaving(true);
    setEmailModalError(null);
    try {
      const normalized = v.toLowerCase();
      await patchStudentEmail(student.id, normalized);

      // atualiza state local imediatamente
      setStudent((prev) => (prev ? ({ ...prev, email: normalized } as any) : prev));

      setEmailModalOpen(false);

      // agora envia o convite/reenviar acesso
      await inviteStudentAccess(true);
      await loadStudent();
    } catch (e: any) {
      setEmailModalError(e?.message || 'Erro ao salvar e-mail.');
    } finally {
      setEmailModalSaving(false);
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

  useEffect(() => {
    if (!selectedWeekId) return;
    const bar = weeksBarRef.current;
    const btn = activeWeekBtnRef.current;
    if (!bar || !btn) return;

    const targetLeft = Math.max(0, btn.offsetLeft - 12);
    const behavior: ScrollBehavior = didInitialWeekScrollRef.current ? 'smooth' : 'auto';
    didInitialWeekScrollRef.current = true;

    const delta = Math.abs(bar.scrollLeft - targetLeft);
    if (delta < 8) return;

    try {
      bar.scrollTo({ left: targetLeft, behavior });
    } catch {
      bar.scrollLeft = targetLeft;
    }
  }, [selectedWeekId, weeks.length]);

  const selectedWeek = weeks.find((w) => w.id === selectedWeekId) || null;

  const readyCount = workouts.filter((w) => w.status === 'ready').length;
  const draftCount = workouts.filter((w) => w.status === 'draft').length;
  const completedCount = workouts.filter((w) => latestExecByWorkout[w.id]?.status === 'completed').length;
  const canceledCount = workouts.filter((w) => w.status === 'canceled').length;

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

          {/* (6) sm:grid-cols-5 + botão Enviar convite */}
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-5 gap-2">
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

            <button
              className="px-3 py-2 rounded-lg bg-primary text-slate-900 text-sm font-semibold"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                void sharePortal();
              }}
            >
              Compartilhar portal
            </button>

            <button className="px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-sm font-semibold" onClick={openPortalPreview}>
              Ver como aluno (QA)
            </button>

            <button
              className="px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-sm font-semibold disabled:opacity-50"
              disabled={inviteLoading}
              onClick={inviteStudentAccess}
              title={
                !(student?.email || '').trim()
                  ? 'Cadastre o e-mail do aluno para enviar o convite'
                  : 'Envia (ou reenviar) acesso por e-mail para o aluno definir a senha'
              }
            >
              {inviteLoading ? 'Enviando…' : (student?.email || '').trim() ? 'Enviar/Reenviar acesso' : 'Cadastrar e enviar acesso'}
            </button>
          </div>
        </div>

        {banner && (
          <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 p-3 text-sm text-amber-800 dark:text-amber-200">{banner}</div>
        )}

        {/* (7) mensagem do convite */}
        {inviteMsg && (
          <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 p-3 text-sm text-emerald-800 dark:text-emerald-200">
            {inviteMsg}
          </div>
        )}


        {emailModalOpen && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md rounded-2xl bg-white dark:bg-surface-dark border border-slate-200/20 p-5">
              <div className="text-lg font-black mb-1">Cadastrar e-mail do aluno</div>
              <div className="text-sm text-slate-500 dark:text-slate-300 mb-4">
                Para enviar o convite e criar a senha de acesso, informe o e-mail do aluno.
              </div>

              {emailModalError && (
                <div className="rounded-xl bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-700 dark:text-red-200 mb-4">
                  {emailModalError}
                </div>
              )}

              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">E-mail</label>
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                value={emailDraft}
                onChange={(e) => setEmailDraft(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-surface-dark px-4 py-3 text-slate-900 dark:text-white outline-none"
                placeholder="aluno@email.com"
              />

              <div className="mt-5 space-y-3">
                <button
                  className="w-full px-4 py-3 rounded-xl bg-emerald-600 text-white font-black disabled:opacity-50"
                  disabled={emailModalSaving}
                  onClick={saveEmailAndInvite}
                >
                  {emailModalSaving ? 'Salvando…' : 'Salvar e enviar acesso'}
                </button>

                <button
                  className="w-full text-center text-slate-500 dark:text-slate-300 font-bold py-2 disabled:opacity-50"
                  disabled={emailModalSaving}
                  onClick={() => {
                    setEmailModalOpen(false);
                    setEmailDraft('');
                    setEmailModalError(null);
                  }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
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
                <div ref={weeksBarRef} className="mt-3 flex gap-2 overflow-x-auto no-scrollbar">
                  {weeks.map((w) => {
                    const active = w.id === selectedWeekId;
                    const label = w.label || formatWeekRange(w.week_start, w.week_end);
                    const short = w.week_start
                      ? `${formatBRShort(w.week_start)} – ${formatBRShort(w.week_end || addDaysISO(w.week_start, 6))}`
                      : label;
                    return (
                      <button
                        key={w.id}
                        ref={active ? activeWeekBtnRef : null}
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
                <div className="px-3 py-2 rounded-full bg-slate-100 dark:bg-slate-800 text-sm font-semibold">Cancelados: {canceledCount}</div>
              </div>
            </div>

            <div className="rounded-2xl bg-white dark:bg-surface-dark shadow p-4">
              <div className="font-semibold">Treinos da semana</div>

              {workouts.length === 0 ? (
                <div className="mt-3 text-sm text-slate-600 dark:text-slate-300">Nenhum treino nesta semana.</div>
              ) : (
                <div className="mt-3 space-y-3">
                  {workouts.map((w, idx) => {
                    const ex = latestExecByWorkout[w.id];
                    const hasExecution = !!ex;

                    const executionLabel = (() => {
                      if (!ex) return '—';
                      if (ex.status === 'completed') {
                        const dt = ex.performed_at || (ex.completed_at ? String(ex.completed_at).slice(0, 10) : null);
                        return dt ? `Concluído (${formatBRShort(dt)})` : 'Concluído';
                      }
                      if (ex.status === 'paused') return 'Pausado';
                      return 'Em andamento';
                    })();

                    const templateLabel = w.template_type ? TEMPLATE_LABEL[w.template_type] || w.template_type : '—';
                    const baseStatusLabel = STATUS_LABEL[w.status] || w.status;

                    const doneDate = ex?.performed_at ? formatBRShort(ex.performed_at) : ex?.completed_at ? formatBRShort(ex.completed_at) : null;

                    const statusLabel =
                      w.status === 'canceled'
                        ? 'Cancelado'
                        : ex?.status === 'completed'
                          ? doneDate
                            ? `Concluído (${doneDate})`
                            : 'Concluído'
                          : ex
                            ? 'Em andamento'
                            : baseStatusLabel;

                    const whenLabel = plannedLabel(w, selectedWeek?.week_start);

                    const canEdit = !hasExecution && w.status !== 'canceled';
                    const canPublish = w.status === 'draft' && !hasExecution;

                    return (
                      <div key={w.id} className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
                        <div className="text-sm text-slate-600 dark:text-slate-300">
                          <div className="flex items-center justify-between gap-3">
                            <span>{whenLabel}</span>
                            <span className="font-semibold text-right">{statusLabel}</span>
                          </div>
                          <div className="mt-1 flex items-center justify-between gap-3">
                            <span>{templateLabel}</span>
                            <span className="text-right">Total: {formatKm(w.total_km)}</span>
                          </div>
                        </div>

                        <div className="mt-2 text-lg font-semibold text-slate-900 dark:text-white whitespace-normal break-words">
                          {w.title || 'Treino'}
                        </div>

                        <div className="mt-2 text-sm text-slate-600 dark:text-slate-300 whitespace-nowrap">
                          Execução do aluno: <span className="font-semibold">{executionLabel}</span>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
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
                              onClick={() => void publishWorkout(w.id)}
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

                        {idx < workouts.length - 1 && <div className="mt-4 h-[2px] rounded-full bg-emerald-500/25" />}
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
