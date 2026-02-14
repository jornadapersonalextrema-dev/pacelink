'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { createClient } from '../../../lib/supabaseBrowser';

type StudentRow = {
  id: string;
  name: string | null;
  email: string | null;
  trainer_id: string;
  public_slug: string | null;
  portal_token: string | null;
  portal_enabled: boolean | null;

  // atual
  p1k_sec_per_km?: number | null;
  // compat (DB antigo)
  pace_p1k?: number | null;
};

type WorkoutRow = {
  id: string;
  student_id: string;
  week_id: string;
  planned_date: string; // yyyy-mm-dd
  title: string | null;
  kind: string | null;
  total_km: number | null;
  status: 'draft' | 'ready' | 'completed' | 'canceled';
};

type ExecutionRow = {
  workout_id: string;
  performed_at: string | null;
};

function formatBRShort(d: string | null) {
  if (!d) return '—';
  const dt = new Date(d);
  const dd = String(dt.getDate()).padStart(2, '0');
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}`;
}

function formatWeekBR(startISO: string) {
  const dt = new Date(startISO);
  const dd = String(dt.getDate()).padStart(2, '0');
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}`;
}

function formatPace(secPerKm: number | null) {
  if (!secPerKm || secPerKm <= 0) return '—';
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${String(s).padStart(2, '0')}/km`;
}

function getP1kSec(st: any): number | null {
  if (!st) return null;
  const v = st.p1k_sec_per_km ?? st.pace_p1k ?? null;
  return typeof v === 'number' ? v : null;
}

function weekdayShortBR(dateISO: string) {
  const dt = new Date(dateISO);
  // dt vindo como yyyy-mm-dd (sem TZ) -> cria como UTC-? pode variar.
  // Para exibir dia da semana corretamente no Brasil, força meio-dia local:
  const parts = dateISO.split('-').map((x) => Number(x));
  const safe = new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);
  const wd = safe.getDay(); // 0=Dom
  const map = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  return map[wd] ?? '—';
}

function classNames(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(' ');
}

export default function StudentPage() {
  const supabase = useMemo(() => createClient(), []);
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();

  const studentId = params.id;
  const weekId = searchParams.get('week') || null;

  const [student, setStudent] = useState<StudentRow | null>(null);
  const [workouts, setWorkouts] = useState<WorkoutRow[]>([]);
  const [execMap, setExecMap] = useState<Record<string, ExecutionRow | null>>({});
  const [weekStart, setWeekStart] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [banner, setBanner] = useState<string | null>(null);

  const currentWeekStartISO = useMemo(() => {
    const now = new Date();
    // Ajusta para segunda-feira:
    const day = now.getDay(); // 0=Dom
    const diffToMon = (day === 0 ? -6 : 1) - day;
    const mon = new Date(now);
    mon.setDate(now.getDate() + diffToMon);
    mon.setHours(0, 0, 0, 0);
    const yyyy = mon.getFullYear();
    const mm = String(mon.getMonth() + 1).padStart(2, '0');
    const dd = String(mon.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }, []);

  async function fetchStudentRow(id: string) {
    const selects = [
      'id,name,email,trainer_id,public_slug,portal_token,portal_enabled,p1k_sec_per_km',
      'id,name,email,trainer_id,public_slug,portal_token,portal_enabled,pace_p1k',
      'id,name,email,trainer_id,public_slug,portal_token,portal_enabled',
    ];

    let lastErr: any = null;

    for (const sel of selects) {
      const { data, error } = await supabase.from('students').select(sel).eq('id', id).maybeSingle();

      if (!error) return { data: data as any, error: null };

      lastErr = error;
      const msg = String((error as any)?.message ?? error ?? '');

      // Se for erro de coluna inexistente, tenta próximo SELECT
      if (msg.includes('does not exist') || msg.includes('column')) continue;

      // Outros erros: para aqui
      break;
    }

    return { data: null, error: lastErr };
  }

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setBanner(null);

      // 1) Student
      {
        const { data: st, error: stErr } = await fetchStudentRow(studentId);

        if (!mounted) return;

        if (stErr) {
          setStudent(null);
          setWorkouts([]);
          setExecMap({});
          setWeekStart(null);
          setBanner(`Erro ao carregar aluno: ${stErr.message}`);
          setLoading(false);
          return;
        }

        if (!st) {
          setStudent(null);
          setWorkouts([]);
          setExecMap({});
          setWeekStart(null);
          setBanner('Aluno não encontrado');
          setLoading(false);
          return;
        }

        setStudent(st as any);
      }

      // 2) Week start
      const resolvedWeekId = weekId;
      if (!resolvedWeekId) {
        // Se não passar week, usa a semana atual; essa tela usa weekId em outras partes do app,
        // mas aqui só precisamos do start para exibir e filtrar.
        setWeekStart(currentWeekStartISO);
      } else {
        const { data: wk, error: wkErr } = await supabase
          .from('weeks')
          .select('id,week_start')
          .eq('id', resolvedWeekId)
          .maybeSingle();

        if (!mounted) return;

        if (wkErr) {
          setBanner(`Erro ao carregar semana: ${wkErr.message}`);
          setWeekStart(null);
        } else {
          setWeekStart(wk?.week_start ?? null);
        }
      }

      // 3) Workouts (semana)
      const weekStartISO = (resolvedWeekId ? null : currentWeekStartISO) || currentWeekStartISO;

      const { data: wos, error: woErr } = await supabase
        .from('workouts')
        .select('id,student_id,week_id,planned_date,title,kind,total_km,status')
        .eq('student_id', studentId)
        // Se a tabela usa week_id, fica pelo weekId quando existir. Senão filtra por planned_date range.
        .in(
          'status',
          // garante que vem tudo (inclui cancelado)
          ['draft', 'ready', 'completed', 'canceled']
        )
        .order('planned_date', { ascending: true });

      if (!mounted) return;

      if (woErr) {
        setBanner(`Erro ao carregar treinos: ${woErr.message}`);
        setWorkouts([]);
        setExecMap({});
        setLoading(false);
        return;
      }

      const list = (wos ?? []) as WorkoutRow[];
      setWorkouts(list);

      // 4) Execução por treino (se existir)
      const ids = list.map((x) => x.id);
      if (ids.length > 0) {
        const { data: exs, error: exErr } = await supabase
          .from('workout_executions')
          .select('workout_id,performed_at')
          .in('workout_id', ids);

        if (!mounted) return;

        if (exErr) {
          // não trava a tela por isso
          setExecMap({});
        } else {
          const map: Record<string, ExecutionRow | null> = {};
          for (const row of exs ?? []) {
            const r = row as ExecutionRow;
            map[r.workout_id] = r;
          }
          setExecMap(map);
        }
      } else {
        setExecMap({});
      }

      setLoading(false);
    }

    load();

    return () => {
      mounted = false;
    };
  }, [supabase, studentId, weekId, currentWeekStartISO]);

  function workoutStatusLabel(w: WorkoutRow, ex: ExecutionRow | null) {
    if (w.status === 'draft') return 'Rascunho';
    if (w.status === 'canceled') return 'Cancelado';
    if (w.status === 'completed') {
      const dt = ex?.performed_at ? formatBRShort(ex.performed_at) : null;
      return dt ? `Concluído (${dt})` : 'Concluído';
    }
    // ready = publicado (pendente aluno)
    return 'Publicado';
  }

  function canEdit(w: WorkoutRow, ex: ExecutionRow | null) {
    // regra: só pode editar se NÃO tiver realizado
    if (w.status === 'completed') return false;
    if (w.status === 'canceled') return false;
    if (ex?.performed_at) return false;
    return true;
  }

  function canPublish(w: WorkoutRow, ex: ExecutionRow | null) {
    // não publicar se já publicado/concluído/cancelado
    if (w.status !== 'draft') return false;
    if (ex?.performed_at) return false;
    return true;
  }

  async function publishWorkout(workoutId: string) {
    setBanner(null);
    const { error } = await supabase.from('workouts').update({ status: 'ready' }).eq('id', workoutId);
    if (error) {
      setBanner(`Erro ao publicar treino: ${error.message}`);
      return;
    }
    // refresh local
    setWorkouts((prev) =>
      prev.map((w) => (w.id === workoutId ? { ...w, status: 'ready' } : w))
    );
  }

  function openPortalPreview() {
    if (!student?.public_slug || !student.portal_token) {
      setBanner('Portal ainda não habilitado para este aluno.');
      return;
    }
    const url = `${window.location.origin}/p/${student.public_slug}?t=${student.portal_token}&qa=1`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  async function sharePortal() {
    if (!student) return;
    setBanner(null);

    let st: any = student;

    // Garante que exista token/slug (ativando o portal se necessário)
    if (!st.portal_enabled || !st.portal_token || !st.public_slug) {
      const { error: upErr } = await supabase.from('students').update({ portal_enabled: true }).eq('id', st.id);

      if (upErr) {
        setBanner(`Erro ao habilitar portal: ${upErr.message}`);
        return;
      }

      const { data: refreshed, error: refErr } = await fetchStudentRow(st.id);

      if (refErr || !refreshed) {
        setBanner(`Erro ao carregar aluno: ${String((refErr as any)?.message ?? refErr)}`);
        return;
      }

      st = refreshed;
      setStudent(refreshed as any);
    }

    if (!st.portal_token || !st.public_slug) {
      setBanner('Não foi possível gerar o link do portal.');
      return;
    }

    const url = `${window.location.origin}/p/${st.public_slug}?t=${encodeURIComponent(st.portal_token)}`;
    const shareData = {
      title: 'Portal do aluno',
      text: `Treinos de ${st.name}`,
      url,
    };

    try {
      const nav: any = navigator;
      if (nav?.share) {
        await nav.share(shareData);
        return;
      }
    } catch (e: any) {
      // Usuário cancelou o share
      if (e?.name === 'AbortError') return;
      // segue fallback abaixo
    }

    // Fallback: copia e abre WhatsApp com mensagem pré-preenchida
    try {
      const clip: any = navigator;
      await clip?.clipboard?.writeText?.(url);
    } catch {}

    const msg = encodeURIComponent(`${shareData.text}: ${url}`);
    window.open(`https://wa.me/?text=${msg}`, '_blank', 'noopener,noreferrer');
    setBanner('Link copiado. Abrindo WhatsApp…');
  }

  const plannedCount = workouts.length;
  const readyCount = workouts.filter((w) => w.status === 'ready').length;
  const completedCount = workouts.filter((w) => w.status === 'completed').length;
  const canceledCount = workouts.filter((w) => w.status === 'canceled').length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-3xl p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm text-slate-400">Aluno</div>
            <div className="text-2xl font-bold">{student?.name ?? '—'}</div>
            <div className="mt-1 text-slate-300">Ritmo P1k: {formatPace(getP1kSec(student))}</div>
          </div>
          <div className="pt-2">
            <Link
              className="text-slate-200 underline underline-offset-4 hover:text-white"
              href="/students"
            >
              Voltar
            </Link>
          </div>
        </div>

        <div className="mt-4 grid gap-2">
          <Link
            className="w-full rounded-2xl bg-slate-800/60 px-4 py-3 text-center text-lg font-semibold hover:bg-slate-800"
            href={`/students/${studentId}/workouts/new${weekId ? `?week=${encodeURIComponent(weekId)}` : ''}`}
          >
            + Programar treino
          </Link>

          <Link
            className="w-full rounded-2xl bg-slate-800/60 px-4 py-3 text-center text-lg font-semibold hover:bg-slate-800"
            href={`/students/${studentId}/reports/4w`}
          >
            Relatório 4 semanas
          </Link>

          <button
            type="button"
            className="w-full rounded-2xl bg-emerald-400 px-4 py-3 text-center text-lg font-semibold text-slate-900 hover:bg-emerald-300"
            onClick={sharePortal}
          >
            Compartilhar portal
          </button>

          <button
            type="button"
            className="w-full rounded-2xl bg-slate-800/60 px-4 py-3 text-center text-lg font-semibold hover:bg-slate-800"
            onClick={openPortalPreview}
          >
            Ver como aluno (QA)
          </button>
        </div>

        {banner && (
          <div className="mt-4 rounded-2xl bg-amber-800/40 px-4 py-3 text-amber-100">
            {banner}
          </div>
        )}

        <div className="mt-6 rounded-3xl bg-emerald-900/25 p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xl font-bold">Planejamento por semana (Seg → Dom)</div>
              <div className="text-slate-300">Semana {weekStart ? `${formatWeekBR(weekStart)} —` : '—'}</div>
            </div>
            <div className="flex flex-col gap-2">
              <Link
                className="rounded-2xl bg-slate-800/60 px-4 py-3 text-center font-semibold hover:bg-slate-800"
                href={weekId ? `/dashboard/week/${weekId}` : '/dashboard'}
              >
                Painel da semana
              </Link>
              <button
                type="button"
                className="rounded-2xl bg-slate-800/60 px-4 py-3 text-center font-semibold opacity-60"
                disabled
              >
                Publicar semana
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <div className="rounded-full bg-slate-800/70 px-3 py-2 text-sm font-semibold">
              Programados: {plannedCount}
            </div>
            <div className="rounded-full bg-slate-800/70 px-3 py-2 text-sm font-semibold">
              Publicados: {readyCount}
            </div>
            <div className="rounded-full bg-slate-800/70 px-3 py-2 text-sm font-semibold">
              Concluídos: {completedCount}
            </div>
            <div className="rounded-full bg-slate-800/70 px-3 py-2 text-sm font-semibold">
              Cancelados: {canceledCount}
            </div>
          </div>

          <div className="mt-6">
            <div className="font-semibold">Treinos da semana</div>

            {loading ? (
              <div className="mt-3 text-slate-300">Carregando…</div>
            ) : workouts.length === 0 ? (
              <div className="mt-3 text-slate-300">Nenhum treino nesta semana.</div>
            ) : (
              <div className="mt-3 space-y-4">
                {workouts.map((w) => {
                  const ex = execMap[w.id] ?? null;
                  const statusLabel = workoutStatusLabel(w, ex);

                  const dateLabel = `${weekdayShortBR(w.planned_date)}, ${formatBRShort(
                    w.planned_date
                  )}`;

                  const kindLabel = w.kind ? w.kind : '—';
                  const totalLabel = w.total_km != null ? `${w.total_km.toFixed(1).replace('.', ',')} km` : '—';

                  const showEdit = canEdit(w, ex);
                  const showPublish = canPublish(w, ex);

                  return (
                    <div key={w.id} className="rounded-3xl bg-emerald-900/25 p-4">
                      {/* Linha 1: data prevista + status */}
                      <div className="flex flex-wrap items-center gap-2 text-slate-200">
                        <div className="font-semibold">{dateLabel}</div>
                        <div className="text-slate-400">•</div>
                        <div className="text-slate-300">{statusLabel}</div>
                      </div>

                      {/* Linha 2: tipo + total */}
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-slate-300">
                        <div>{kindLabel}</div>
                        <div className="text-slate-400">•</div>
                        <div>Total: {totalLabel}</div>
                      </div>

                      {/* Linha 3: título (com quebra) */}
                      <div className="mt-3 text-2xl font-bold leading-snug break-words">
                        {w.title ?? 'Treino'}
                      </div>

                      {/* Linha 4: execução */}
                      <div className="mt-2 text-slate-300">
                        Execução do aluno:{' '}
                        <span className="font-semibold">
                          {w.status === 'completed'
                            ? statusLabel
                            : w.status === 'canceled'
                              ? 'Cancelado'
                              : ex?.performed_at
                                ? `Concluído (${formatBRShort(ex.performed_at)})`
                                : '—'}
                        </span>
                      </div>

                      {/* Separador */}
                      <div className="mt-4 h-[2px] w-full rounded-full bg-emerald-300/30" />

                      {/* Ações sempre no fim */}
                      <div className="mt-4 grid gap-2">
                        {showEdit && (
                          <Link
                            className="rounded-2xl bg-slate-800/70 px-4 py-3 text-center font-semibold hover:bg-slate-800"
                            href={`/workouts/${w.id}/edit`}
                          >
                            Editar
                          </Link>
                        )}

                        {showPublish && (
                          <button
                            type="button"
                            className="rounded-2xl bg-emerald-400 px-4 py-3 text-center font-semibold text-slate-900 hover:bg-emerald-300"
                            onClick={() => publishWorkout(w.id)}
                          >
                            Publicar
                          </button>
                        )}

                        <Link
                          className="rounded-2xl bg-slate-800/70 px-4 py-3 text-center font-semibold hover:bg-slate-800"
                          href={student?.public_slug && student?.portal_token ? `/p/${student.public_slug}?t=${student.portal_token}&qa=1` : '#'}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => {
                            if (!student?.public_slug || !student?.portal_token) {
                              e.preventDefault();
                              setBanner('Portal ainda não habilitado para este aluno.');
                            }
                          }}
                        >
                          Ver no portal (QA)
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="mt-8 text-center text-xs text-slate-500">PaceLink</div>
      </div>
    </div>
  );
}
