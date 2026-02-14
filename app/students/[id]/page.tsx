'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '../../../lib/supabaseBrowser';

type StudentRow = {
  id: string;
  name: string | null;
  // IMPORTANT: não existe students.pace_p1k no seu banco.
  // Use o campo real (p1k_sec_per_km) ou deixe null.
  p1k_sec_per_km?: number | null;
};

type WeekRow = {
  id: string;
  week_start: string; // date
  week_end: string | null; // date
  label: string | null;
};

type WeekCounts = {
  draft: number;
  ready: number;
  completed: number; // vem do summary
  canceled: number;
  pending: number;
};

type SummaryWorkoutRow = {
  id: string;
  title: string | null;
  template_type: string | null;
  status: 'draft' | 'ready' | 'archived' | 'canceled' | string;
  total_km: number | null;
  planned_date: string | null; // date
  planned_day: number | null;
  execution_status: 'none' | 'completed' | 'running' | 'paused' | string | null;
  execution_label: string | null; // ex: "Concluído (09/02)"
  performed_at: string | null; // date
};

function formatBR(dateISO: string) {
  // dateISO pode vir "YYYY-MM-DD"
  const [y, m, d] = dateISO.split('-');
  if (!y || !m || !d) return dateISO;
  return `${d}/${m}/${y}`;
}

function formatBRShort(dateISO: string) {
  const [y, m, d] = dateISO.split('-');
  if (!m || !d) return dateISO;
  return `${d}/${m}`;
}

function weekdayShortPT(dateISO: string) {
  // Converte YYYY-MM-DD para Dia da semana curto PT-BR
  const dt = new Date(dateISO + 'T00:00:00');
  const w = dt.getDay(); // 0 dom
  const map = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  return map[w] ?? '';
}

function templateLabelPT(tpl: string | null | undefined) {
  const v = (tpl || '').toLowerCase();
  if (v === 'easy_run') return 'Rodagem';
  if (v === 'progressive') return 'Progressivo';
  if (v === 'alternated') return 'Alternado';
  if (v === 'run') return 'Corrida';
  return tpl || 'Treino';
}

function statusLabelPT(workoutStatus: string, executionLabel?: string | null) {
  // "Concluído" não é status do workout; vem da execução/summary.
  if (executionLabel) return executionLabel;
  if (workoutStatus === 'draft') return 'Rascunho';
  if (workoutStatus === 'ready') return 'Publicado';
  if (workoutStatus === 'canceled') return 'Cancelado';
  if (workoutStatus === 'archived') return 'Arquivado';
  return workoutStatus;
}

function paceLabelFromP1K(p1k?: number | null) {
  if (p1k == null || Number.isNaN(Number(p1k)) || Number(p1k) <= 0) return '—';
  const totalSec = Math.round(Number(p1k));
  const mm = Math.floor(totalSec / 60);
  const ss = totalSec % 60;
  return `${mm}:${String(ss).padStart(2, '0')}/km`;
}

async function safeCopy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export default function StudentPage() {
  const params = useParams<{ id: string }>();
  const studentId = params?.id;
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [student, setStudent] = useState<StudentRow | null>(null);

  const [weeks, setWeeks] = useState<WeekRow[]>([]);
  const [selectedWeekId, setSelectedWeekId] = useState<string | null>(null);
  const [selectedWeek, setSelectedWeek] = useState<WeekRow | null>(null);

  const [counts, setCounts] = useState<WeekCounts>({
    draft: 0,
    ready: 0,
    completed: 0,
    canceled: 0,
    pending: 0,
  });

  const [workouts, setWorkouts] = useState<SummaryWorkoutRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const studentSlug = useMemo(() => {
    // slug simples a partir do nome (opcional)
    const name = (student?.name || '').trim().toLowerCase();
    if (!name) return '';
    return name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }, [student?.name]);

  const portalUrl = useMemo(() => {
    if (!studentSlug) return '';
    // Ajuste aqui se seu portal público for /p/[studentSlug]
    return `${window.location.origin}/p/${studentSlug}`;
  }, [studentSlug]);

  const weekLabel = useMemo(() => {
    if (!selectedWeek?.week_start) return '—';
    // label do banco pode vir pronto; se não, formatamos
    if (selectedWeek.label) {
      // geralmente "Semana DD/MM – DD/MM"
      return selectedWeek.label.replace(/^Semana\s*/i, '').trim();
    }
    const start = formatBRShort(selectedWeek.week_start);
    const end = selectedWeek.week_end ? formatBRShort(selectedWeek.week_end) : '—';
    return `${start} – ${end}`;
  }, [selectedWeek]);

  async function loadBase() {
    setLoading(true);
    setError(null);

    try {
      // 1) Student
      // IMPORTANTE: NÃO selecionar students.pace_p1k (não existe)
      // Use o campo real (p1k_sec_per_km) se existir no seu schema.
      const { data: st, error: stErr } = await supabase
        .from('students')
        .select('id,name,p1k_sec_per_km')
        .eq('id', studentId)
        .single();

      if (stErr) throw stErr;
      setStudent(st as any);

      // 2) Weeks
      const { data: wk, error: wkErr } = await supabase
        .from('training_weeks')
        .select('id,week_start,week_end,label')
        .eq('student_id', studentId)
        .order('week_start', { ascending: false });

      if (wkErr) throw wkErr;

      const list = (wk || []) as WeekRow[];
      setWeeks(list);

      const defaultWeek = list[0] || null;
      setSelectedWeekId(defaultWeek?.id ?? null);
      setSelectedWeek(defaultWeek);
    } catch (e: any) {
      setError(`Erro ao carregar aluno: ${e?.message || String(e)}`);
    } finally {
      setLoading(false);
    }
  }

  async function loadWeekSummary(weekId: string) {
    setError(null);

    try {
      // Usa o seu endpoint /api/portal/summary (que já consolida execuções)
      const qs = new URLSearchParams({
        studentId,
        weekId,
      }).toString();

      const res = await fetch(`/api/portal/summary?${qs}`, { cache: 'no-store' });
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status} ${txt}`);
      }
      const json = await res.json();

      // Esperado:
      // json.counts = {draft, ready, completed, canceled, pending}
      // json.workouts = array (cards)
      setCounts({
        draft: json?.counts?.draft ?? 0,
        ready: json?.counts?.ready ?? 0,
        completed: json?.counts?.completed ?? 0,
        canceled: json?.counts?.canceled ?? 0,
        pending: json?.counts?.pending ?? 0,
      });

      setWorkouts((json?.workouts ?? []) as SummaryWorkoutRow[]);
    } catch (e: any) {
      setError(`Erro ao carregar treinos: ${e?.message || String(e)}`);
      setWorkouts([]);
      setCounts({ draft: 0, ready: 0, completed: 0, canceled: 0, pending: 0 });
    }
  }

  useEffect(() => {
    if (!studentId) return;
    loadBase();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  useEffect(() => {
    if (!selectedWeekId) return;
    const wk = weeks.find((w) => w.id === selectedWeekId) || null;
    setSelectedWeek(wk);
    loadWeekSummary(selectedWeekId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWeekId]);

  async function onSharePortal() {
    if (!portalUrl) return;

    const shareData = {
      title: 'Portal do aluno',
      text: 'Acesse seus treinos pelo link:',
      url: portalUrl,
    };

    // 1) Se o dispositivo suporta share sheet (Android/iOS), abre a lista (WhatsApp incluso)
    const canShare =
      typeof navigator !== 'undefined' &&
      typeof (navigator as any).share === 'function' &&
      (typeof (navigator as any).canShare !== 'function' || (navigator as any).canShare(shareData));

    if (canShare) {
      try {
        await (navigator as any).share(shareData);
        return;
      } catch {
        // se usuário cancelar, não faz nada
      }
    }

    // 2) Fallback: copia link
    const ok = await safeCopy(portalUrl);
    if (ok) {
      alert('Link copiado! Cole no WhatsApp para compartilhar.');
      return;
    }

    // 3) Último fallback: prompt
    window.prompt('Copie o link do portal:', portalUrl);
  }

  async function onPublishWorkout(workoutId: string) {
    if (!confirm('Deseja publicar este treino?')) return;

    try {
      const { error: upErr } = await supabase
        .from('workouts')
        .update({ status: 'ready' })
        .eq('id', workoutId);

      if (upErr) throw upErr;

      if (selectedWeekId) await loadWeekSummary(selectedWeekId);
    } catch (e: any) {
      alert(`Erro ao publicar: ${e?.message || String(e)}`);
    }
  }

  const canEditWorkout = (w: SummaryWorkoutRow) => {
    // Regra: só pode editar se não tiver execução concluída
    // (se existir execution_status completed, bloqueia)
    return !(String(w.execution_status || '').toLowerCase() === 'completed');
  };

  const showPublishButton = (w: SummaryWorkoutRow) => {
    // Só faz sentido "Publicar" quando é rascunho
    return w.status === 'draft';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 to-slate-900 text-white p-6">
        <div className="opacity-80">Carregando…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 to-slate-900 text-white p-4 sm:p-6">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="rounded-3xl bg-white/5 border border-white/10 p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm opacity-70">Aluno</div>
              <div className="text-2xl sm:text-3xl font-extrabold leading-tight">
                {student?.name || '—'}
              </div>
              <div className="mt-2 text-sm opacity-80">
                Ritmo P1k: <b>{paceLabelFromP1K(student?.p1k_sec_per_km ?? null)}</b>
              </div>
            </div>

            <button
              className="underline opacity-90 hover:opacity-100"
              onClick={() => router.back()}
              type="button"
            >
              Voltar
            </button>
          </div>

          {/* Action bar */}
          <div className="mt-4 grid grid-cols-1 gap-3">
            <Link
              href={`/students/${studentId}/workouts/new${selectedWeekId ? `?weekId=${selectedWeekId}` : ''}`}
              className="w-full rounded-2xl bg-white/10 hover:bg-white/15 border border-white/10 px-4 py-3 text-center font-semibold"
            >
              + Programar treino
            </Link>

            <Link
              href={`/students/${studentId}/reports/4w`}
              className="w-full rounded-2xl bg-white/10 hover:bg-white/15 border border-white/10 px-4 py-3 text-center font-semibold"
            >
              Relatório 4 semanas
            </Link>

            <button
              onClick={onSharePortal}
              className="w-full rounded-2xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 px-4 py-3 text-center font-extrabold"
              type="button"
              disabled={!portalUrl}
              title={!portalUrl ? 'Nome do aluno sem slug disponível para gerar link' : 'Compartilhar portal'}
            >
              Compartilhar portal
            </button>

            <Link
              href={studentSlug ? `/p/${studentSlug}` : '#'}
              className="w-full rounded-2xl bg-white/10 hover:bg-white/15 border border-white/10 px-4 py-3 text-center font-semibold"
            >
              Ver como aluno (QA)
            </Link>
          </div>

          {error && (
            <div className="mt-4 rounded-2xl bg-amber-500/20 border border-amber-400/30 px-4 py-3 text-amber-100">
              {error}
            </div>
          )}
        </div>

        {/* Week selector + counts */}
        <div className="mt-5 rounded-3xl bg-white/5 border border-white/10 p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xl font-extrabold">Planejamento por semana (Seg → Dom)</div>
              <div className="mt-1 opacity-80">Semana {weekLabel}</div>
            </div>

            {selectedWeekId ? (
              <Link
                href={`/dashboard/week/${selectedWeekId}`}
                className="rounded-2xl bg-white/10 hover:bg-white/15 border border-white/10 px-4 py-3 text-center font-semibold"
              >
                Painel da semana
              </Link>
            ) : null}
          </div>

          {/* Weeks pills */}
          <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
            {weeks.slice(0, 8).map((w) => {
              const label = w.label
                ? w.label.replace(/^Semana\s*/i, '').trim()
                : `${formatBRShort(w.week_start)} – ${w.week_end ? formatBRShort(w.week_end) : '—'}`;

              const active = w.id === selectedWeekId;

              return (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => setSelectedWeekId(w.id)}
                  className={[
                    'whitespace-nowrap rounded-full px-4 py-2 font-semibold border',
                    active
                      ? 'bg-emerald-400 text-slate-950 border-emerald-200'
                      : 'bg-white/5 hover:bg-white/10 border-white/10 text-white',
                  ].join(' ')}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <span className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold">
              Programados: <b>{counts.draft + counts.ready + counts.completed + counts.canceled}</b>
            </span>
            <span className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold">
              Publicados: <b>{counts.ready}</b>
            </span>
            <span className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold">
              Concluídos: <b>{counts.completed}</b>
            </span>
          </div>
        </div>

        {/* Workouts list */}
        <div className="mt-5 rounded-3xl bg-white/5 border border-white/10 p-5 sm:p-6">
          <div className="font-extrabold text-xl">Treinos da semana</div>

          <div className="mt-4 space-y-5">
            {workouts.length === 0 ? (
              <div className="opacity-70">Nenhum treino encontrado nesta semana.</div>
            ) : (
              workouts.map((w) => {
                const planned = w.planned_date ? `${weekdayShortPT(w.planned_date)}, ${formatBRShort(w.planned_date)}` : '—';
                const stLabel = statusLabelPT(w.status, w.execution_label);

                const typeLabel = templateLabelPT(w.template_type);
                const km = (w.total_km ?? 0).toFixed(1).replace('.', ',');
                const canEdit = canEditWorkout(w);

                return (
                  <div key={w.id} className="rounded-3xl bg-white/5 border border-white/10 p-4">
                    {/* Linha 1: data + status */}
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 opacity-90">
                      <span className="font-semibold">{planned}</span>
                      <span className="opacity-60">•</span>
                      <span>{stLabel}</span>
                    </div>

                    {/* Linha 2: tipo + total */}
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 opacity-85">
                      <span>{typeLabel}</span>
                      <span className="opacity-60">•</span>
                      <span>
                        Total: <b>{km} km</b>
                      </span>
                    </div>

                    {/* Título */}
                    <div className="mt-3 text-2xl font-extrabold leading-snug break-words">
                      {w.title || 'Treino'}
                    </div>

                    {/* Execução do aluno */}
                    <div className="mt-3 opacity-85">
                      Execução do aluno: <b>{w.execution_label ? w.execution_label : '—'}</b>
                    </div>

                    {/* Separador */}
                    <div className="mt-4 h-[2px] w-full rounded bg-emerald-400/40" />

                    {/* Botões (sempre no fim) */}
                    <div className="mt-4 flex flex-wrap gap-3">
                      {canEdit ? (
                        <Link
                          href={`/workouts/${w.id}/edit`}
                          className="rounded-2xl bg-white/10 hover:bg-white/15 border border-white/10 px-5 py-3 font-bold text-center"
                        >
                          Editar
                        </Link>
                      ) : null}

                      {showPublishButton(w) ? (
                        <button
                          type="button"
                          onClick={() => onPublishWorkout(w.id)}
                          className="rounded-2xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 px-5 py-3 font-extrabold"
                        >
                          Publicar
                        </button>
                      ) : null}

                      <Link
                        href={studentSlug ? `/p/${studentSlug}/workouts/${w.id}` : '#'}
                        className="rounded-2xl bg-slate-900/60 hover:bg-slate-900/80 border border-white/10 px-5 py-3 font-bold text-center"
                      >
                        Ver no portal (QA)
                      </Link>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="h-10" />
      </div>
    </div>
  );
}
