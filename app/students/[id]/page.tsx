'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '../../../lib/supabaseBrowser';
import Topbar from '../../../components/Topbar';
import Button from '../../../components/Button';
import { formatBR, formatBRShort, weekRangeLabel } from '../../../lib/date';

type StudentRow = {
  id: string;
  name: string;
  trainer_id: string;
  p1k?: string | null;
  public_slug?: string | null;
  portal_enabled?: boolean | null;
  portal_token?: string | null;
};

type WeekRow = {
  id: string;
  week_start: string;
  week_end?: string | null;
  label?: string | null;
  is_closed?: boolean | null;
};

type WorkoutRow = {
  id: string;
  status: 'draft' | 'ready' | 'archived' | 'canceled';
  title?: string | null;
  template_type?: string | null;
  total_km?: number | null;
  planned_day?: number | null;
  planned_date?: string | null;
  created_at?: string | null;
  execution?: {
    status?: 'completed' | 'running' | 'paused';
    performed_at?: string | null;
    completed_at?: string | null;
  } | null;
};

const STATUS_LABEL: Record<string, string> = {
  draft: 'Rascunho',
  ready: 'Publicado',
  archived: 'Arquivado',
  canceled: 'Cancelado',
};

function weekdayBRShortFromDate(dateStr: string) {
  // dateStr: YYYY-MM-DD
  try {
    const d = new Date(`${dateStr}T00:00:00`);
    const map = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    return map[d.getDay()] || '';
  } catch {
    return '';
  }
}

export default function StudentWeekPage() {
  const params = useParams();
  const router = useRouter();
  const studentId = String(params?.id || '');

  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [student, setStudent] = useState<StudentRow | null>(null);

  const [weeks, setWeeks] = useState<WeekRow[]>([]);
  const [selectedWeekId, setSelectedWeekId] = useState<string | null>(null);

  const [workouts, setWorkouts] = useState<WorkoutRow[]>([]);
  const [banner, setBanner] = useState<string | null>(null);

  const selectedWeek = useMemo(() => {
    if (!selectedWeekId) return null;
    return weeks.find((w) => w.id === selectedWeekId) || null;
  }, [weeks, selectedWeekId]);

  const selectedWeekLabel = useMemo(() => {
    if (!selectedWeek) return '';
    if (selectedWeek.label) return selectedWeek.label;
    const start = selectedWeek.week_start;
    const end = selectedWeek.week_end || null;
    return weekRangeLabel(start, end);
  }, [selectedWeek]);

  const weekStart = selectedWeek?.week_start || null;
  const weekEnd = selectedWeek?.week_end || null;

  const plannedCount = useMemo(() => workouts.length, [workouts]);
  const readyCount = useMemo(
    () => workouts.filter((w) => w.status === 'ready').length,
    [workouts],
  );
  const completedCount = useMemo(
    () => workouts.filter((w) => w.execution?.status === 'completed').length,
    [workouts],
  );

  useEffect(() => {
    if (!studentId) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  useEffect(() => {
    if (!selectedWeekId) return;
    void loadWeekWorkouts(selectedWeekId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWeekId]);

  async function load() {
    setLoading(true);
    setBanner(null);

    try {
      const { data: st, error: stErr } = await supabase
        .from('students')
        .select('id,name,trainer_id,p1k,public_slug,portal_enabled,portal_token')
        .eq('id', studentId)
        .maybeSingle();

      if (stErr) throw stErr;
      if (!st) throw new Error('Aluno não encontrado.');

      setStudent(st as StudentRow);

      const { data: wks, error: wkErr } = await supabase
        .from('training_weeks')
        .select('id,week_start,week_end,label,is_closed')
        .eq('student_id', studentId)
        .order('week_start', { ascending: false });

      if (wkErr) throw wkErr;

      const list = (wks || []) as WeekRow[];
      setWeeks(list);

      if (!list.length) {
        setSelectedWeekId(null);
        setWorkouts([]);
      } else {
        setSelectedWeekId((prev) => prev || list[0].id);
      }
    } catch (e: any) {
      setBanner(e?.message || 'Erro ao carregar aluno.');
    } finally {
      setLoading(false);
    }
  }

  async function loadWeekWorkouts(weekId: string) {
    setBanner(null);
    try {
      const { data, error } = await supabase
        .from('workouts')
        .select(
          'id,status,title,template_type,total_km,planned_day,planned_date,created_at',
        )
        .eq('student_id', studentId)
        .eq('week_id', weekId)
        .order('planned_date', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true });

      if (error) throw error;

      const base = (data || []) as WorkoutRow[];

      // Busca a execução mais recente (se existir) por workout
      const ids = base.map((w) => w.id);
      let byWorkout: Record<string, WorkoutRow['execution']> = {};

      if (ids.length) {
        const { data: exs, error: exErr } = await supabase
          .from('executions')
          .select('workout_id,status,performed_at,completed_at,started_at')
          .in('workout_id', ids)
          .order('started_at', { ascending: false });

        if (exErr) throw exErr;

        (exs || []).forEach((ex: any) => {
          const wid = ex.workout_id as string;
          if (!byWorkout[wid]) {
            byWorkout[wid] = {
              status: ex.status,
              performed_at: ex.performed_at,
              completed_at: ex.completed_at,
            };
          }
        });
      }

      const merged = base.map((w) => ({
        ...w,
        execution: byWorkout[w.id] || null,
      }));

      setWorkouts(merged);
    } catch (e: any) {
      setBanner(e?.message || 'Erro ao carregar treinos da semana.');
    }
  }

  async function publishWorkout(workoutId: string) {
    setBanner(null);
    try {
      const { error } = await supabase
        .from('workouts')
        .update({ status: 'ready' })
        .eq('id', workoutId);

      if (error) throw error;

      if (selectedWeekId) {
        await loadWeekWorkouts(selectedWeekId);
      }
    } catch (e: any) {
      setBanner(e?.message || 'Erro ao publicar treino.');
    }
  }

  async function publishWeek() {
    if (!selectedWeekId) return;
    setBanner(null);

    try {
      const ids = workouts
        .filter((w) => w.status === 'draft')
        .map((w) => w.id);

      if (!ids.length) return;

      const { error } = await supabase
        .from('workouts')
        .update({ status: 'ready' })
        .in('id', ids);

      if (error) throw error;

      await loadWeekWorkouts(selectedWeekId);
    } catch (e: any) {
      setBanner(e?.message || 'Erro ao publicar semana.');
    }
  }

  async function ensurePortalAccess(): Promise<StudentRow | null> {
    if (!student) return null;

    // se já tem, ok
    if (student.public_slug && student.portal_token) return student;

    try {
      const { data, error } = await supabase
        .from('students')
        .update({ portal_enabled: true })
        .eq('id', student.id)
        .select('id,name,trainer_id,p1k,public_slug,portal_enabled,portal_token')
        .maybeSingle();

      if (error) throw error;

      if (!data) return null;

      const st = data as StudentRow;
      setStudent(st);
      return st;
    } catch (e: any) {
      setBanner(e?.message || 'Erro ao habilitar portal.');
      return null;
    }
  }

  async function sharePortal() {
    setBanner(null);

    // Evita perder o "user activation" do clique (necessário p/ abrir o share sheet no mobile)
    let st = student;
    const hadToken = !!(st?.public_slug && st.portal_token);

    if (!st) {
      setBanner('Aluno não carregado.');
      return;
    }

    // Só gera token/slug quando realmente precisar (isso pode envolver await e quebrar o share no mesmo clique)
    if (!hadToken) {
      st = await ensurePortalAccess();
    }

    if (!st?.public_slug || !st.portal_token) {
      setBanner('Não foi possível habilitar o portal do aluno.');
      return;
    }

    const url = `${window.location.origin}/p/${st.public_slug}?t=${encodeURIComponent(
      st.portal_token,
    )}`;
    const msg = `Portal de treinos de ${st.name}\n${url}`;

    // 1) Tenta abrir o "share sheet" nativo (Android/iOS) — melhor experiência e permite WhatsApp.
    try {
      const nav: any = navigator as any;
      if (nav?.share) {
        if (!nav.canShare || nav.canShare({ url })) {
          await nav.share({
            title: 'PaceLink',
            text: msg,
            url,
          });
          return;
        }
      }
    } catch (err) {
      // continua para fallback
    }

    // 2) Fallback para WhatsApp no mobile (abre o app direto quando possível)
    try {
      const ua = (navigator as any)?.userAgent || '';
      const isMobile = /Android|iPhone|iPad|iPod/i.test(ua);
      if (isMobile) {
        window.location.href = `whatsapp://send?text=${encodeURIComponent(msg)}`;
        return;
      }
    } catch (err) {
      // continua
    }

    // 3) Último fallback: copiar o link (e, se não der, prompt).
    try {
      await navigator.clipboard.writeText(url);
      setBanner('Link copiado! Cole no WhatsApp.');
      return;
    } catch (err) {
      // Alguns browsers bloqueiam clipboard sem permissão — usa prompt como último recurso.
      window.prompt('Copie o link do portal:', url);
      setBanner('Copie o link acima e envie no WhatsApp.');
      return;
    }
  }

  function openPortalPreview(workoutId?: string) {
    if (!student?.public_slug || !student.portal_token) return;

    const url = workoutId
      ? `${window.location.origin}/p/${student.public_slug}/workouts/${workoutId}?t=${encodeURIComponent(
          student.portal_token,
        )}`
      : `${window.location.origin}/p/${student.public_slug}?t=${encodeURIComponent(
          student.portal_token,
        )}`;

    window.open(url, '_blank');
  }

  const canCreateWorkout = !!selectedWeekId && !selectedWeek?.is_closed;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-950 text-white">
      <Topbar />
      <div className="mx-auto max-w-3xl px-4 py-6">
        {banner ? (
          <div className="mb-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm">
            {banner}
          </div>
        ) : null}

        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm text-white/60">Aluno</div>
              <div className="text-2xl font-extrabold leading-tight">
                {student?.name || '—'}
              </div>
              <div className="mt-2 text-white/70">
                Ritmo P1k:{' '}
                <b className="text-white">{student?.p1k || '—'}</b>
              </div>
            </div>

            <Button onClick={() => router.back()}>Voltar</Button>
          </div>

          <div className="mt-5 grid gap-2">
            <Button
              onClick={() => {
                if (!canCreateWorkout) return;
                router.push(`/students/${studentId}/workouts/new?week=${selectedWeekId}`);
              }}
              disabled={!canCreateWorkout}
            >
              + Programar treino
            </Button>

            <Button
              onClick={() => router.push(`/students/${studentId}/reports/4w`)}
            >
              Relatório 4 semanas
            </Button>

            <button
              type="button"
              className="w-full rounded-2xl bg-emerald-500 px-4 py-3 text-center font-semibold text-slate-950 shadow-xl hover:brightness-110 active:brightness-95"
              onClick={sharePortal}
            >
              Compartilhar portal
            </button>

            <Button
              onClick={() => {
                // abre o portal no navegador/aba (QA)
                if (!student?.public_slug || !student.portal_token) {
                  void ensurePortalAccess().then(() => openPortalPreview());
                  return;
                }
                openPortalPreview();
              }}
            >
              Ver como aluno (QA)
            </Button>
          </div>
        </div>

        <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xl font-extrabold">
                Planejamento por semana (Seg → Dom)
              </div>
              <div className="mt-1 text-white/70">{selectedWeekLabel}</div>
            </div>

            <div className="flex flex-col gap-2">
              <Button
                onClick={() => {
                  if (!selectedWeekId) return;
                  router.push(`/dashboard/week/${selectedWeekId}`);
                }}
              >
                Painel da semana
              </Button>

              <Button onClick={publishWeek} disabled={!workouts.some((w) => w.status === 'draft')}>
                Publicar semana
              </Button>
            </div>
          </div>

          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {weeks.map((w) => {
              const label = w.label || weekRangeLabel(w.week_start, w.week_end || null);
              const active = w.id === selectedWeekId;
              return (
                <button
                  key={w.id}
                  className={[
                    'rounded-full px-4 py-2 text-sm font-semibold whitespace-nowrap',
                    active
                      ? 'bg-emerald-500 text-slate-950'
                      : 'bg-white/10 text-white hover:bg-white/15',
                  ].join(' ')}
                  onClick={() => setSelectedWeekId(w.id)}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <div className="rounded-full bg-white/10 px-3 py-2 text-sm font-semibold">
              Programados: <b>{plannedCount}</b>
            </div>
            <div className="rounded-full bg-white/10 px-3 py-2 text-sm font-semibold">
              Publicados: <b>{readyCount}</b>
            </div>
            <div className="rounded-full bg-white/10 px-3 py-2 text-sm font-semibold">
              Concluídos: <b>{completedCount}</b>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl">
          <div className="font-semibold text-white/90">Treinos da semana</div>

          {loading ? (
            <div className="mt-4 text-white/70">Carregando…</div>
          ) : workouts.length === 0 ? (
            <div className="mt-4 text-white/70">
              Nenhum treino nesta semana.
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              {workouts.map((w) => {
                const statusLabel = STATUS_LABEL[w.status] || w.status;

                const planned = w.planned_date
                  ? `${weekdayBRShortFromDate(w.planned_date)}, ${formatBRShort(
                      w.planned_date,
                    )}`
                  : w.planned_day != null
                    ? `Dia ${w.planned_day + 1}`
                    : '—';

                const typeLabel =
                  w.template_type === 'easy_run'
                    ? 'Rodagem'
                    : w.template_type === 'progressive'
                      ? 'Progressivo'
                      : w.template_type === 'alternated'
                        ? 'Alternado'
                        : w.template_type || '—';

                const totalLabel =
                  w.total_km != null ? `${Number(w.total_km).toFixed(1).replace('.', ',')} km` : '—';

                let execLabel = '—';
                if (w.execution?.status === 'completed') {
                  const dt = w.execution.performed_at || w.execution.completed_at || null;
                  execLabel = dt ? `Concluído (${formatBRShort(String(dt))})` : 'Concluído';
                }

                const hasExecution = !!w.execution;
                const canEdit = !hasExecution && w.execution?.status !== 'completed';
                const showPublish = w.status === 'draft' && !hasExecution;

                return (
                  <div key={w.id} className="rounded-2xl bg-white/5 p-4">
                    <div className="grid gap-2">
                      {/* Linha 1: data prevista + status */}
                      <div className="flex flex-wrap items-center gap-2 text-white/70">
                        <span>{planned}</span>
                        <span className="opacity-60">•</span>
                        <span>{statusLabel}</span>
                      </div>

                      {/* Linha 2: tipo + total */}
                      <div className="flex flex-wrap items-center gap-2 text-white/70">
                        <span>{typeLabel}</span>
                        <span className="opacity-60">•</span>
                        <span>Total: {totalLabel}</span>
                      </div>

                      {/* Título */}
                      <div className="text-xl font-extrabold leading-tight break-words">
                        {w.title || 'Treino'}
                      </div>

                      {/* Execução */}
                      <div className="text-white/70">
                        Execução do aluno: <b className="text-white">{execLabel}</b>
                      </div>

                      {/* Separador */}
                      <div className="h-px bg-emerald-400/20" />

                      {/* Ações (sempre por último) */}
                      <div className="mt-1 flex flex-wrap gap-2">
                        {canEdit ? (
                          <Button onClick={() => router.push(`/workouts/${w.id}/edit`)}>
                            Editar
                          </Button>
                        ) : null}

                        {showPublish ? (
                          <button
                            type="button"
                            className="rounded-xl bg-emerald-500 px-4 py-2 font-semibold text-slate-950 shadow-xl hover:brightness-110 active:brightness-95"
                            onClick={() => publishWorkout(w.id)}
                          >
                            Publicar
                          </button>
                        ) : null}

                        <Button
                          onClick={async () => {
                            if (!student?.public_slug || !student.portal_token) {
                              const st = await ensurePortalAccess();
                              if (!st?.public_slug || !st.portal_token) return;
                            }
                            openPortalPreview(w.id);
                          }}
                        >
                          Ver no portal (QA)
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Rodapé informativo */}
        {weekStart ? (
          <div className="mt-6 text-center text-sm text-white/50">
            Semana: {formatBR(weekStart)}
            {weekEnd ? ` — ${formatBR(weekEnd)}` : ''}
          </div>
        ) : null}
      </div>
    </div>
  );
}
