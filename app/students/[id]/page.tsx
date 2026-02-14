'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '../../../lib/supabaseBrowser';

type StudentRow = {
  id: string;
  name: string;
  trainer_id: string | null;
  portal_enabled: boolean | null;
  portal_token: string | null;
  public_slug: string | null;
  pace_p1k: string | null;
};

type WeekRow = {
  id: string;
  student_id: string;
  trainer_id: string;
  week_start: string; // YYYY-MM-DD
  week_end: string | null; // YYYY-MM-DD
  label: string | null;
};

type WorkoutRow = {
  id: string;
  student_id: string;
  trainer_id: string;
  status: 'draft' | 'ready' | 'archived';
  template_type: string;
  title: string | null;
  total_km: number;
  include_warmup: boolean;
  warmup_km: number;
  include_cooldown: boolean;
  cooldown_km: number;
  blocks: any[];
  week_id: string | null;
  planned_date: string | null; // YYYY-MM-DD
};

type ExecutionRow = {
  id: string;
  workout_id: string;
  status: 'running' | 'paused' | 'completed';
  performed_at: string | null; // YYYY-MM-DD
  completed_at: string | null; // timestamp
};

function formatBRShort(dt: string | null) {
  if (!dt) return '—';
  const d = new Date(dt);
  if (Number.isNaN(d.getTime())) return '—';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}`;
}

function formatBRWeekLabel(weekStart: string, weekEnd?: string | null) {
  const ws = new Date(weekStart);
  const we = weekEnd ? new Date(weekEnd) : new Date(ws.getTime() + 6 * 24 * 60 * 60 * 1000);
  const a = formatBRShort(ws.toISOString());
  const b = formatBRShort(we.toISOString());
  return `${a} – ${b}`;
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

function weekdayShortBR(isoDate: string) {
  const d = new Date(isoDate);
  const day = d.getDay(); // 0=Dom
  const map = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  return map[day] ?? '—';
}

export default function StudentWeekPlanningPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const studentId = params?.id;

  const [student, setStudent] = useState<StudentRow | null>(null);
  const [weeks, setWeeks] = useState<WeekRow[]>([]);
  const [activeWeekId, setActiveWeekId] = useState<string | null>(null);
  const [activeWeek, setActiveWeek] = useState<WeekRow | null>(null);

  const [workouts, setWorkouts] = useState<WorkoutRow[]>([]);
  const [executions, setExecutions] = useState<Record<string, ExecutionRow | null>>({});
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<string | null>(null);

  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    let ignore = false;

    async function loadAll() {
      if (!studentId) return;
      setLoading(true);
      setBanner(null);

      // Student
      const { data: s, error: se } = await supabase
        .from('students')
        .select('id,name,trainer_id,portal_enabled,portal_token,public_slug,pace_p1k')
        .eq('id', studentId)
        .single();

      if (!ignore && se) {
        setBanner(`Erro ao carregar aluno: ${se.message}`);
        setLoading(false);
        return;
      }

      if (!ignore) setStudent(s as any);

      // Weeks
      const { data: wks, error: we } = await supabase
        .from('training_weeks')
        .select('id,student_id,trainer_id,week_start,week_end,label')
        .eq('student_id', studentId)
        .order('week_start', { ascending: false });

      if (!ignore && we) {
        setBanner(`Erro ao carregar semanas: ${we.message}`);
        setLoading(false);
        return;
      }

      const wkArr = (wks as any[]) ?? [];
      if (!ignore) setWeeks(wkArr as any);

      // Active week (default = latest)
      const defWeek = wkArr?.[0] ?? null;
      const defWeekId = defWeek?.id ?? null;

      if (!ignore) {
        setActiveWeekId(defWeekId);
        setActiveWeek(defWeek);
      }

      // Workouts for active week
      if (defWeekId) {
        await loadWorkoutsForWeek(defWeekId);
      }

      if (!ignore) setLoading(false);
    }

    async function loadWorkoutsForWeek(weekId: string) {
      if (!studentId) return;

      const { data: ws, error: werr } = await supabase
        .from('workouts')
        .select(
          'id,student_id,trainer_id,status,template_type,title,total_km,include_warmup,warmup_km,include_cooldown,cooldown_km,blocks,week_id,planned_date'
        )
        .eq('student_id', studentId)
        .eq('week_id', weekId)
        .order('planned_date', { ascending: true })
        .order('created_at', { ascending: true });

      if (werr) {
        setBanner(`Erro ao carregar treinos: ${werr.message}`);
        setWorkouts([]);
        setExecutions({});
        return;
      }

      const arr = (ws as any[]) ?? [];
      setWorkouts(arr as any);

      // For each workout, get last execution (if any)
      const execMap: Record<string, ExecutionRow | null> = {};
      if (arr.length > 0) {
        const workoutIds = arr.map((x) => x.id);
        const { data: exs, error: exerr } = await supabase
          .from('executions')
          .select('id,workout_id,status,performed_at,completed_at')
          .in('workout_id', workoutIds)
          .order('started_at', { ascending: false });

        if (!exerr) {
          const byWorkout: Record<string, ExecutionRow> = {};
          for (const row of (exs as any[]) ?? []) {
            const wid = row.workout_id as string;
            if (!byWorkout[wid]) byWorkout[wid] = row as any;
          }
          for (const wid of workoutIds) execMap[wid] = byWorkout[wid] ?? null;
        }
      }

      setExecutions(execMap);
    }

    loadAll();

    return () => {
      ignore = true;
    };
  }, [studentId, supabase]);

  useEffect(() => {
    if (!activeWeekId) return;
    const wk = weeks.find((w) => w.id === activeWeekId) ?? null;
    setActiveWeek(wk);
  }, [activeWeekId, weeks]);

  async function onSelectWeek(weekId: string) {
    setActiveWeekId(weekId);
    setBanner(null);

    const { data: wk } = await supabase
      .from('training_weeks')
      .select('id,student_id,trainer_id,week_start,week_end,label')
      .eq('id', weekId)
      .single();

    setActiveWeek((wk as any) ?? null);

    // load workouts
    const { data: ws, error: werr } = await supabase
      .from('workouts')
      .select(
        'id,student_id,trainer_id,status,template_type,title,total_km,include_warmup,warmup_km,include_cooldown,cooldown_km,blocks,week_id,planned_date'
      )
      .eq('student_id', studentId)
      .eq('week_id', weekId)
      .order('planned_date', { ascending: true })
      .order('created_at', { ascending: true });

    if (werr) {
      setBanner(`Erro ao carregar treinos: ${werr.message}`);
      setWorkouts([]);
      setExecutions({});
      return;
    }

    const arr = (ws as any[]) ?? [];
    setWorkouts(arr as any);

    // executions
    const execMap: Record<string, ExecutionRow | null> = {};
    if (arr.length > 0) {
      const workoutIds = arr.map((x) => x.id);
      const { data: exs, error: exerr } = await supabase
        .from('executions')
        .select('id,workout_id,status,performed_at,completed_at')
        .in('workout_id', workoutIds)
        .order('started_at', { ascending: false });

      if (!exerr) {
        const byWorkout: Record<string, ExecutionRow> = {};
        for (const row of (exs as any[]) ?? []) {
          const wid = row.workout_id as string;
          if (!byWorkout[wid]) byWorkout[wid] = row as any;
        }
        for (const wid of workoutIds) execMap[wid] = byWorkout[wid] ?? null;
      }
    }
    setExecutions(execMap);
  }

  function openPortalQA() {
    if (!student?.public_slug || !student?.portal_token) {
      setBanner('Portal ainda não está habilitado.');
      return;
    }
    const url = `${window.location.origin}/p/${student.public_slug}?t=${student.portal_token}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  async function sharePortal() {
    // Habilita o portal (gera token/slug) e depois abre o "share sheet" do celular (WhatsApp etc).
    if (!student) return;

    const base = window.location.origin;

    // Caso ainda não esteja habilitado/sem token, habilita e pede um segundo toque (evita perder "user gesture")
    if (!student.portal_enabled || !student.portal_token || !student.public_slug) {
      const supabase = createClient();

      // 1) garantir public_slug
      let slug = student.public_slug;
      if (!slug) {
        const { data: s2, error: e2 } = await supabase
          .from('students')
          .update({ public_slug: slugify(student.name) })
          .eq('id', student.id)
          .select('public_slug')
          .single();
        if (e2) {
          setBanner(`Erro ao habilitar portal: ${e2.message}`);
          return;
        }
        slug = (s2 as any)?.public_slug ?? null;
      }

      // 2) habilitar/gerar token
      const { data, error } = await supabase
        .from('students')
        .update({ portal_enabled: true })
        .eq('id', student.id)
        .select('portal_enabled, portal_token, public_slug')
        .single();

      if (error) {
        setBanner(`Erro ao habilitar portal: ${error.message}`);
        return;
      }

      const token = (data as any)?.portal_token ?? null;
      const finalSlug = (data as any)?.public_slug ?? slug;

      setStudent((prev) =>
        prev
          ? {
              ...prev,
              portal_enabled: true,
              portal_token: token,
              public_slug: finalSlug,
            }
          : prev
      );

      setBanner('Portal ativado. Toque em “Compartilhar portal” novamente para enviar o link.');
      return;
    }

    const url = `${base}/p/${student.public_slug}?t=${student.portal_token}`;

    // Preferência: Web Share API (abre o seletor do celular com WhatsApp etc.)
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Portal do aluno',
          text: `Treinos de ${student.name}`,
          url,
        });
        return;
      }
    } catch (err) {
      // Usuário pode cancelar o share; não é erro.
      return;
    }

    // Fallback 1: copiar link
    try {
      await navigator.clipboard.writeText(url);
      setBanner('Link copiado. Cole no WhatsApp para compartilhar.');
      return;
    } catch {}

    // Fallback 2: WhatsApp direto (abre o app quando disponível)
    const wa = `https://wa.me/?text=${encodeURIComponent(url)}`;
    window.open(wa, '_blank', 'noopener,noreferrer');
  }

  function goBack() {
    router.back();
  }

  function goNewWorkout() {
    if (!activeWeekId) return;
    router.push(`/students/${studentId}/workouts/new?weekId=${activeWeekId}`);
  }

  function goReport4w() {
    router.push(`/students/${studentId}/reports/4w`);
  }

  function formatWorkoutStatus(w: WorkoutRow, ex: ExecutionRow | null) {
    if (ex && ex.status === 'completed') {
      if (ex.performed_at) return `Concluído (${formatBRShort(ex.performed_at)})`;
      return 'Concluído';
    }
    if (w.status === 'ready') return 'Publicado';
    if (w.status === 'draft') return 'Rascunho';
    if (w.status === 'archived') return 'Arquivado';
    return w.status;
  }

  function formatTypeLabel(tpl: string) {
    const map: Record<string, string> = {
      easy_run: 'Rodagem',
      progressive: 'Progressivo',
      alternated: 'Alternado',
      run: 'Rodagem',
    };
    return map[tpl] ?? tpl;
  }

  function formatPlannedLabel(w: WorkoutRow) {
    if (!w.planned_date) return '—';
    return `${weekdayShortBR(w.planned_date)}, ${formatBRShort(w.planned_date)}`;
  }

  const counts = useMemo(() => {
    let programmed = workouts.length;
    let published = workouts.filter((w) => w.status === 'ready').length;
    let completed = workouts.filter((w) => {
      const ex = executions[w.id];
      return ex && ex.status === 'completed';
    }).length;

    return { programmed, published, completed };
  }, [workouts, executions]);

  return (
    <div className="min-h-screen bg-[#06151a] text-white">
      <div className="mx-auto max-w-2xl p-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-sm text-white/60">Aluno</div>
            <div className="text-3xl font-extrabold">{student?.name ?? '—'}</div>
            <div className="text-white/70 mt-1">
              Ritmo P1k: <b>{student?.pace_p1k ?? '—'}</b>
            </div>

            <div className="mt-4 space-y-2">
              <button
                onClick={goNewWorkout}
                className="w-full rounded-xl bg-white/10 px-4 py-3 font-semibold hover:bg-white/15"
              >
                + Programar treino
              </button>

              <button
                onClick={goReport4w}
                className="w-full rounded-xl bg-white/10 px-4 py-3 font-semibold hover:bg-white/15"
              >
                Relatório 4 semanas
              </button>

              <button
                onClick={sharePortal}
                className="w-full rounded-xl bg-emerald-400 px-4 py-3 font-extrabold text-[#06151a] hover:brightness-110"
              >
                Compartilhar portal
              </button>

              <button
                onClick={openPortalQA}
                className="w-full rounded-xl bg-white/10 px-4 py-3 font-semibold hover:bg-white/15"
              >
                Ver como aluno (QA)
              </button>
            </div>
          </div>

          <button
            onClick={goBack}
            className="text-white/80 underline underline-offset-4 hover:text-white"
          >
            Voltar
          </button>
        </div>

        {banner ? (
          <div className="mt-4 rounded-xl bg-amber-400/20 px-4 py-3 text-amber-200">
            {banner}
          </div>
        ) : null}

        <div className="mt-6 rounded-2xl bg-white/5 p-4">
          <div className="text-lg font-extrabold">Planejamento por semana (Seg → Dom)</div>
          <div className="text-white/70">
            Semana{' '}
            <b>
              {activeWeek?.week_start ? formatBRWeekLabel(activeWeek.week_start, activeWeek.week_end) : '—'}
            </b>
          </div>

          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {weeks.map((w) => {
              const label = w.label ?? formatBRWeekLabel(w.week_start, w.week_end);
              const active = w.id === activeWeekId;
              return (
                <button
                  key={w.id}
                  onClick={() => onSelectWeek(w.id)}
                  className={[
                    'whitespace-nowrap rounded-full px-4 py-2 font-semibold',
                    active ? 'bg-emerald-400 text-[#06151a]' : 'bg-white/10 text-white hover:bg-white/15',
                  ].join(' ')}
                >
                  {label.replace(/^Semana\s+/i, '')}
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full bg-white/10 px-3 py-2 text-sm font-semibold">
              Programados: <b>{counts.programmed}</b>
            </span>
            <span className="rounded-full bg-white/10 px-3 py-2 text-sm font-semibold">
              Publicados: <b>{counts.published}</b>
            </span>
            <span className="rounded-full bg-white/10 px-3 py-2 text-sm font-semibold">
              Concluídos: <b>{counts.completed}</b>
            </span>
          </div>
        </div>

        <div className="mt-6 rounded-2xl bg-white/5 p-4">
          <div className="text-lg font-extrabold">Treinos da semana</div>

          {loading ? (
            <div className="mt-4 text-white/70">Carregando…</div>
          ) : workouts.length === 0 ? (
            <div className="mt-4 text-white/70">Nenhum treino nesta semana.</div>
          ) : (
            <div className="mt-4 space-y-4">
              {workouts.map((w) => {
                const ex = executions[w.id] ?? null;

                const statusLabel = formatWorkoutStatus(w, ex);
                const typeLabel = formatTypeLabel(w.template_type);
                const totalLabel = `${Number(w.total_km ?? 0).toFixed(1).replace('.', ',')} km`;

                const canEdit = !(ex && ex.status === 'completed');
                const showPublish = w.status !== 'ready' && canEdit;

                return (
                  <div key={w.id} className="rounded-2xl bg-white/5 p-4">
                    {/* Linha 1: data prevista + status */}
                    <div className="flex items-center justify-between gap-3 text-white/70">
                      <div className="font-semibold">{formatPlannedLabel(w)}</div>
                      <div className="text-right">{statusLabel}</div>
                    </div>

                    {/* Linha 2: tipo + total */}
                    <div className="mt-1 flex items-center justify-between gap-3 text-white/70">
                      <div>{typeLabel}</div>
                      <div className="text-right">Total: {totalLabel}</div>
                    </div>

                    {/* Título */}
                    <div className="mt-3 text-2xl font-extrabold break-words">
                      {w.title || 'Treino'}
                    </div>

                    {/* Execução */}
                    <div className="mt-2 text-white/70">
                      Execução do aluno:{' '}
                      <b>
                        {ex && ex.status === 'completed'
                          ? `Concluído (${formatBRShort(ex.performed_at)})`
                          : '—'}
                      </b>
                    </div>

                    {/* Separador */}
                    <div className="mt-4 h-[2px] w-full rounded bg-white/10" />

                    {/* Ações */}
                    <div className="mt-4 flex flex-wrap gap-2">
                      {canEdit ? (
                        <button
                          onClick={() => router.push(`/workouts/${w.id}/edit`)}
                          className="rounded-xl bg-white/10 px-4 py-3 font-semibold hover:bg-white/15"
                        >
                          Editar
                        </button>
                      ) : null}

                      {showPublish ? (
                        <button
                          onClick={() => router.push(`/workouts/${w.id}/edit`)}
                          className="rounded-xl bg-emerald-400 px-4 py-3 font-extrabold text-[#06151a] hover:brightness-110"
                        >
                          Publicar
                        </button>
                      ) : null}

                      <button
                        onClick={() => router.push(`/workouts/${w.id}/edit`)}
                        className="rounded-xl bg-white/10 px-4 py-3 font-semibold hover:bg-white/15"
                      >
                        Ver no portal (QA)
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
