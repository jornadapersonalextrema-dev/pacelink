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
  week_start: string;
  week_end: string | null;
  label: string | null;
};

type WorkoutRow = {
  id: string;
  student_id: string;
  week_start: string | null;
  planned_date: string | null;
  title: string | null;
  status: string | null;
  template_type: string | null;
  total_km: number | null;
  share_slug: string | null;
};

const TEMPLATE_LABEL: Record<string, string> = {
  easy_run: 'Rodagem',
  long_run: 'Longão',
  intervals: 'Intervalado',
  tempo_run: 'Tempo',
  recovery: 'Recuperação',
  race: 'Prova',
};

function nowInSaoPaulo() {
  // Mantém o calendário (dia/semana) ancorado em America/Sao_Paulo,
  // mesmo se o dispositivo estiver em outro fuso.
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(new Date());

  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;

  return new Date(`${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}:${map.second}`);
}

function startOfWeekMonday(date: Date) {
  const d = new Date(date);
  const day = d.getDay(); // 0..6 (Sun..Sat)
  const diff = (day === 0 ? -6 : 1) - day; // Monday
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function toISODate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatWeekLabel(weekStartISO: string, weekEndISO: string) {
  const [y1, m1, d1] = weekStartISO.split('-');
  const [y2, m2, d2] = weekEndISO.split('-');
  const start = new Date(Number(y1), Number(m1) - 1, Number(d1));
  const end = new Date(Number(y2), Number(m2) - 1, Number(d2));
  const s = `${String(start.getDate()).padStart(2, '0')}/${String(start.getMonth() + 1).padStart(2, '0')}`;
  const e = `${String(end.getDate()).padStart(2, '0')}/${String(end.getMonth() + 1).padStart(2, '0')}`;
  return `Semana ${s} – ${e}`;
}

function formatDateBR(iso: string) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function p1kToLabel(sec: number | null) {
  if (!sec || sec <= 0) return '—';
  const mm = Math.floor(sec / 60);
  const ss = Math.round(sec % 60);
  return `${mm}:${String(ss).padStart(2, '0')}/km`;
}

export default function StudentPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const search = useSearchParams();

  const studentId = params?.id;
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [student, setStudent] = useState<StudentRow | null>(null);
  const [weeks, setWeeks] = useState<WeekRow[]>([]);
  const [selectedWeekStart, setSelectedWeekStart] = useState<string | null>(null);
  const [workouts, setWorkouts] = useState<WorkoutRow[]>([]);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  // ✅ Semana atual baseada em America/Sao_Paulo (segunda→domingo)
  const currentWeekStartISO = useMemo(() => {
    return toISODate(startOfWeekMonday(nowInSaoPaulo()));
  }, []);

  const visibleWeeks = useMemo(() => {
    return weeks
      .filter((w) => w.week_start >= currentWeekStartISO)
      .sort((a, b) => a.week_start.localeCompare(b.week_start));
  }, [weeks, currentWeekStartISO]);

  const historyWeeks = useMemo(() => {
    return weeks
      .filter((w) => w.week_start < currentWeekStartISO)
      .sort((a, b) => b.week_start.localeCompare(a.week_start));
  }, [weeks, currentWeekStartISO]);

  const selectedWeek = useMemo(() => {
    if (!selectedWeekStart) return null;
    return weeks.find((w) => w.week_start === selectedWeekStart) || null;
  }, [weeks, selectedWeekStart]);

  async function fetchAll() {
    if (!studentId) return;

    setLoading(true);
    setMsg(null);

    const { data: s, error: sErr } = await supabase
      .from('students')
      .select('id,trainer_id,name,email,p1k_sec_per_km,public_slug,created_at,portal_token,portal_enabled')
      .eq('id', studentId)
      .maybeSingle();

    if (sErr) {
      setMsg({ type: 'err', text: sErr.message });
      setLoading(false);
      return;
    }
    if (!s) {
      setMsg({ type: 'err', text: 'Aluno não encontrado.' });
      setLoading(false);
      return;
    }
    setStudent(s as StudentRow);

    const { data: wks, error: wErr } = await supabase
      .from('training_weeks')
      .select('id,student_id,week_start,week_end,label')
      .eq('student_id', studentId)
      .order('week_start', { ascending: true });

    if (wErr) {
      setMsg({ type: 'err', text: wErr.message });
      setLoading(false);
      return;
    }

    const wkRows = (wks || []) as WeekRow[];
    setWeeks(wkRows);

    // se não tiver selected, seleciona a semana atual (ou primeira visível)
    const qsWeek = search?.get('week') || null;
    const initialWeek =
      (qsWeek && wkRows.find((x) => x.week_start === qsWeek)?.week_start) ||
      wkRows.find((x) => x.week_start === currentWeekStartISO)?.week_start ||
      wkRows.filter((x) => x.week_start >= currentWeekStartISO).sort((a, b) => a.week_start.localeCompare(b.week_start))[0]
        ?.week_start ||
      wkRows.sort((a, b) => b.week_start.localeCompare(a.week_start))[0]?.week_start ||
      null;

    setSelectedWeekStart(initialWeek);

    setLoading(false);
  }

  async function ensureUpcomingWeeks() {
    if (!studentId || !student) return;

    // ✅ Geração de semanas baseada em America/Sao_Paulo (segunda→domingo)
    const start = startOfWeekMonday(nowInSaoPaulo());
    const targets: { week_start: string; week_end: string; label: string }[] = [];

    for (let i = 0; i < 10; i++) {
      const ws = toISODate(addDays(start, i * 7));
      const we = toISODate(addDays(new Date(ws), 6)); // segunda→domingo
      targets.push({ week_start: ws, week_end: we, label: formatWeekLabel(ws, we) });
    }

    const existing = new Set((weeks || []).map((w) => w.week_start));
    const missing = targets.filter((t) => !existing.has(t.week_start));

    if (missing.length === 0) return;

    const payload = missing.map((t) => ({
      student_id: studentId,
      trainer_id: student.trainer_id,
      week_start: t.week_start,
      week_end: t.week_end,
      label: t.label,
    }));

    const { error } = await supabase.from('training_weeks').upsert(payload, {
      onConflict: 'student_id,week_start',
    });

    if (error) {
      setMsg({ type: 'err', text: error.message });
      return;
    }

    const { data: wks2 } = await supabase
      .from('training_weeks')
      .select('id,student_id,week_start,week_end,label')
      .eq('student_id', studentId)
      .order('week_start', { ascending: true });

    setWeeks(((wks2 || []) as WeekRow[]) || []);
  }

  async function fetchWorkoutsForWeek(weekStart: string) {
    if (!studentId) return;
    const { data, error } = await supabase
      .from('workouts')
      .select('id,student_id,week_start,planned_date,title,status,template_type,total_km,share_slug')
      .eq('student_id', studentId)
      .eq('week_start', weekStart)
      .order('created_at', { ascending: true });

    if (error) {
      setMsg({ type: 'err', text: error.message });
      return;
    }
    setWorkouts((data || []) as WorkoutRow[]);
  }

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  useEffect(() => {
    if (student) ensureUpcomingWeeks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student?.id]);

  useEffect(() => {
    if (selectedWeekStart) fetchWorkoutsForWeek(selectedWeekStart);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWeekStart]);

  async function ensurePortalToken() {
    if (!student) return null;

    if (student.portal_enabled && student.portal_token && student.public_slug) {
      return { token: student.portal_token, slug: student.public_slug };
    }

    const { data, error } = await supabase
      .from('students')
      .update({ portal_enabled: true })
      .eq('id', student.id)
      .select('portal_token,public_slug')
      .maybeSingle();

    if (error) {
      setMsg({ type: 'err', text: error.message });
      return null;
    }

    const token = (data as any)?.portal_token || student.portal_token;
    const slug = (data as any)?.public_slug || student.public_slug;

    if (!token || !slug) {
      setMsg({ type: 'err', text: 'Não foi possível habilitar o portal (token/slug ausentes).' });
      return null;
    }

    // atualiza state
    setStudent((prev) =>
      prev ? { ...prev, portal_enabled: true, portal_token: token, public_slug: slug } : prev
    );

    return { token, slug };
  }

  async function sharePortalAccess() {
    if (!student) return;
    setBusy(true);
    setMsg(null);

    const p = await ensurePortalToken();
    if (!p) {
      setBusy(false);
      return;
    }

    const fullUrl = `${window.location.origin}/p/${p.slug}?t=${encodeURIComponent(p.token)}`;

    const text =
      `Olá! Seus treinos da semana já estão disponíveis no Portal.\n\n` +
      `Acesse por este link (guarde nos favoritos):\n${fullUrl}\n\n` +
      `Qualquer dúvida, me chame.`;

    try {
      if ((navigator as any).share) {
        await (navigator as any).share({ title: 'Portal do Aluno', text, url: fullUrl });
        setMsg({ type: 'ok', text: 'Link compartilhado.' });
      } else {
        await navigator.clipboard.writeText(text);
        setMsg({ type: 'ok', text: 'Mensagem copiada. Cole no WhatsApp.' });
      }
    } catch {
      try {
        await navigator.clipboard.writeText(text);
        setMsg({ type: 'ok', text: 'Mensagem copiada. Cole no WhatsApp.' });
      } catch {
        setMsg({ type: 'err', text: 'Não foi possível compartilhar/copiar.' });
      }
    }

    setBusy(false);
  }

  async function publishWeekAndNotify() {
    if (!student || !selectedWeekStart) return;
    setBusy(true);
    setMsg(null);

    const { error } = await supabase
      .from('workouts')
      .update({ status: 'ready' })
      .eq('student_id', student.id)
      .eq('week_start', selectedWeekStart)
      .eq('status', 'draft');

    if (error) {
      setMsg({ type: 'err', text: error.message });
      setBusy(false);
      return;
    }

    await fetchWorkoutsForWeek(selectedWeekStart);
    setMsg({ type: 'ok', text: 'Semana publicada. Treinos em rascunho viraram disponíveis.' });
    setBusy(false);
  }

  function workoutStatusLabel(status: string | null) {
    if (status === 'draft') return 'Rascunho';
    if (status === 'ready') return 'Disponível';
    if (status === 'in_progress') return 'Em andamento';
    if (status === 'done') return 'Concluído';
    return status || '—';
  }

  const counters = useMemo(() => {
    const total = workouts.length;
    const drafts = workouts.filter((w) => w.status === 'draft').length;
    const ready = workouts.filter((w) => w.status === 'ready').length;
    const inProgress = workouts.filter((w) => w.status === 'in_progress').length;
    const done = workouts.filter((w) => w.status === 'done').length;
    return { total, drafts, ready, inProgress, done };
  }, [workouts]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#07160f] text-white flex items-center justify-center">
        <div className="opacity-80">Carregando...</div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="min-h-screen bg-[#07160f] text-white flex items-center justify-center">
        <div className="opacity-80">Aluno não encontrado.</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#07160f] text-white">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="rounded-2xl bg-white/5 border border-white/10 p-5 shadow-xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm opacity-80">Aluno</div>
              <div className="text-2xl font-bold leading-tight">{student.name}</div>
              <div className="mt-2 text-sm opacity-80">
                Ritmo P1k: <span className="font-semibold text-white">{p1kToLabel(student.p1k_sec_per_km)}</span>
              </div>
            </div>
            <button
              className="text-sm underline opacity-90 hover:opacity-100"
              onClick={() => router.push('/students')}
            >
              Voltar
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              className="rounded-xl bg-[#2ee97a] text-black font-semibold px-4 py-3 shadow hover:brightness-110 disabled:opacity-60"
              disabled={busy}
              onClick={sharePortalAccess}
            >
              Compartilhar acesso (Portal)
            </button>

            <button
              className="rounded-xl bg-white/10 border border-white/10 px-4 py-3 font-semibold hover:bg-white/15 disabled:opacity-60"
              disabled={busy || !selectedWeekStart}
              onClick={publishWeekAndNotify}
            >
              Publicar semana
            </button>
          </div>

          <div className="mt-2 text-sm opacity-80">
            Portal configurado{' '}
            {student.portal_enabled ? (
              <span className="text-[#2ee97a] font-semibold">✓</span>
            ) : (
              <span className="text-yellow-300 font-semibold">—</span>
            )}
          </div>

          {msg && (
            <div
              className={`mt-4 rounded-xl px-4 py-3 border ${
                msg.type === 'ok'
                  ? 'bg-[#2ee97a]/10 border-[#2ee97a]/30 text-[#b7ffd2]'
                  : 'bg-red-500/10 border-red-500/30 text-red-200'
              }`}
            >
              {msg.text}
            </div>
          )}
        </div>

        <div className="mt-6 rounded-2xl bg-white/5 border border-white/10 p-5 shadow-xl">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xl font-bold">Planejamento por semana</div>
              <div className="text-sm opacity-80">{selectedWeek?.label || '—'}</div>
            </div>

            <button
              className="text-sm underline opacity-90 hover:opacity-100"
              onClick={() => {
                const hasHistory = historyWeeks.length > 0;
                if (!hasHistory) {
                  setMsg({ type: 'err', text: 'Sem histórico ainda.' });
                  return;
                }
                // toggla para a primeira semana do histórico (mais recente)
                setSelectedWeekStart(historyWeeks[0].week_start);
              }}
            >
              Ver histórico
            </button>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            {visibleWeeks.map((w) => (
              <button
                key={w.id}
                className={`rounded-full px-4 py-3 text-sm font-semibold border ${
                  selectedWeekStart === w.week_start
                    ? 'bg-[#2ee97a] text-black border-[#2ee97a]'
                    : 'bg-white/5 border-white/10 hover:bg-white/10'
                }`}
                onClick={() => setSelectedWeekStart(w.week_start)}
              >
                {w.label || `${formatDateBR(w.week_start)} – ${w.week_end ? formatDateBR(w.week_end) : ''}`}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 rounded-2xl bg-white/5 border border-white/10 p-5 shadow-xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xl font-bold">Treinos da semana</div>
              <div className="mt-1 text-sm opacity-80">
                Programados: <span className="font-semibold text-white">{counters.total}</span> · Disponíveis:{' '}
                <span className="font-semibold text-white">{counters.ready}</span> · Rascunhos:{' '}
                <span className="font-semibold text-white">{counters.drafts}</span>
              </div>
            </div>

            <button
              className="text-sm underline opacity-90 hover:opacity-100"
              onClick={() => selectedWeekStart && fetchWorkoutsForWeek(selectedWeekStart)}
            >
              Atualizar
            </button>
          </div>

          <div className="mt-4 space-y-4">
            {workouts.length === 0 ? (
              <div className="opacity-80">Nenhum treino programado para esta semana ainda.</div>
            ) : (
              workouts.map((w) => (
                <div key={w.id} className="rounded-2xl bg-white/5 border border-white/10 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-bold text-lg truncate">{w.title || 'Treino'}</div>
                      <div className="mt-1 text-sm opacity-80">
                        <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 mr-2">
                          {TEMPLATE_LABEL[w.template_type || ''] || w.template_type || '—'}
                        </span>
                        {w.total_km ? `${String(w.total_km).replace('.', ',')} km` : ''}
                      </div>
                      <div className="mt-1 text-sm opacity-80">
                        Planejado:{' '}
                        <span className="font-semibold text-white">
                          {w.planned_date ? formatDateBR(w.planned_date) : '—'}
                        </span>{' '}
                        · Status:{' '}
                        <span className="font-semibold text-white">{workoutStatusLabel(w.status)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <button
                      className="rounded-xl bg-white/10 border border-white/10 px-4 py-3 font-semibold hover:bg-white/15"
                      onClick={() => router.push(`/workouts/${w.id}/edit`)}
                    >
                      Editar
                    </button>

                    <button
                      className="rounded-xl bg-[#2ee97a] text-black font-semibold px-4 py-3 shadow hover:brightness-110"
                      onClick={async () => {
                        const p = await ensurePortalToken();
                        if (!p) return;
                        const link = `${window.location.origin}/p/${p.slug}/workouts/${w.id}?t=${encodeURIComponent(
                          p.token
                        )}`;
                        const text = `Treino disponível: ${link}`;

                        try {
                          if ((navigator as any).share) {
                            await (navigator as any).share({ title: 'Treino', text, url: link });
                          } else {
                            await navigator.clipboard.writeText(text);
                            setMsg({ type: 'ok', text: 'Link copiado.' });
                          }
                        } catch {
                          try {
                            await navigator.clipboard.writeText(text);
                            setMsg({ type: 'ok', text: 'Link copiado.' });
                          } catch {
                            setMsg({ type: 'err', text: 'Não foi possível copiar/compartilhar.' });
                          }
                        }
                      }}
                    >
                      Gerar/Compartilhar
                    </button>

                    <button
                      className="rounded-xl bg-white/10 border border-white/10 px-4 py-3 font-semibold hover:bg-white/15"
                      onClick={async () => {
                        const p = await ensurePortalToken();
                        if (!p) return;
                        router.push(`/p/${p.slug}/workouts/${w.id}?t=${encodeURIComponent(p.token)}`);
                      }}
                    >
                      Ver como aluno
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
