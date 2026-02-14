"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "../../../lib/supabaseBrowser";

type TrainingWeekRow = {
  id: string;
  trainer_id: string;
  student_id: string;
  week_start: string;
  week_end: string | null;
  label: string | null;
};

type WorkoutRow = {
  id: string;
  student_id: string;
  trainer_id: string;
  status: string;
  template_type: string;
  total_km: number;
  title: string | null;
  week_id: string | null;
  planned_day: number | null;
  planned_date: string | null;
};

type ExecRow = {
  id: string;
  workout_id: string;
  status: string;
  completed_at: string | null;
  performed_at: string | null;
};

const TEMPLATE_LABEL: Record<string, string> = {
  easy_run: "Rodagem",
  progressive: "Progressivo",
  alternated: "Alternado",
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho",
  ready: "Publicado",
  archived: "Arquivado",
  canceled: "Cancelado",
};

function formatKm(v: any) {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n)) return "0 km";
  return `${n.toFixed(1).replace(".", ",")} km`;
}

function formatBRShort(dateStr: string) {
  const d = new Date(dateStr);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}`;
}

function plannedLabel(w: WorkoutRow, weekStart?: string | null) {
  // Prioridade: planned_date (mais preciso)
  if (w.planned_date) {
    const d = new Date(w.planned_date);
    const dow = d.getDay(); // 0=Dom ... 6=Sab
    const names = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    return `${names[dow]}, ${formatBRShort(w.planned_date)}`;
  }

  // Fallback: planned_day + week_start
  if (w.planned_day != null && weekStart) {
    const base = new Date(weekStart);
    const d = new Date(base);
    d.setDate(base.getDate() + Number(w.planned_day));
    const dow = d.getDay();
    const names = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    return `${names[dow]}, ${formatBRShort(d.toISOString())}`;
  }

  return "—";
}

export default function StudentPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const search = useSearchParams();
  const studentId = params.id;

  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [studentName, setStudentName] = useState<string>("Aluno");
  const [weeks, setWeeks] = useState<TrainingWeekRow[]>([]);
  const [selectedWeekId, setSelectedWeekId] = useState<string | null>(null);
  const [workouts, setWorkouts] = useState<WorkoutRow[]>([]);
  const [latestExecByWorkout, setLatestExecByWorkout] = useState<Record<string, ExecRow | null>>(
    {}
  );

  const selectedWeek = useMemo(
    () => weeks.find((w) => w.id === selectedWeekId) || null,
    [weeks, selectedWeekId]
  );

  const weekStartLabel = useMemo(() => {
    if (!selectedWeek?.week_start) return "—";
    const s = selectedWeek.week_start;
    const e = selectedWeek.week_end ?? "";
    const dd1 = formatBRShort(s);
    const dd2 = e ? formatBRShort(e) : "";
    return dd2 ? `${dd1} – ${dd2}` : dd1;
  }, [selectedWeek?.week_start, selectedWeek?.week_end]);

  const [counts, setCounts] = useState<{ completed: number; pending: number; canceled: number } | null>(
    null
  );

  async function loadAll() {
    setLoading(true);

    // Student
    const { data: st, error: stErr } = await supabase
      .from("students")
      .select("id,name")
      .eq("id", studentId)
      .single();

    if (!stErr && st?.name) setStudentName(st.name);

    // Weeks
    const { data: wk } = await supabase
      .from("training_weeks")
      .select("id,trainer_id,student_id,week_start,week_end,label")
      .eq("student_id", studentId)
      .order("week_start", { ascending: false });

    const listWeeks = (wk ?? []) as TrainingWeekRow[];
    setWeeks(listWeeks);

    // pick selected week:
    const qsWeek = search.get("weekId");
    const initialWeekId =
      (qsWeek && listWeeks.find((w) => w.id === qsWeek)?.id) || listWeeks[0]?.id || null;

    setSelectedWeekId(initialWeekId);

    setLoading(false);
  }

  async function loadWeekData(weekId: string) {
    // Workouts (sem depender de view)
    const { data: wks } = await supabase
      .from("workouts")
      .select("id,student_id,trainer_id,status,template_type,total_km,title,week_id,planned_day,planned_date")
      .eq("student_id", studentId)
      .eq("week_id", weekId)
      .order("planned_date", { ascending: true })
      .order("planned_day", { ascending: true })
      .order("created_at", { ascending: true });

    const ws = (wks ?? []) as WorkoutRow[];
    setWorkouts(ws);

    // latest execution per workout
    if (ws.length) {
      const workoutIds = ws.map((w) => w.id);
      const { data: exs } = await supabase
        .from("executions")
        .select("id,workout_id,status,completed_at,performed_at,started_at")
        .in("workout_id", workoutIds)
        .order("started_at", { ascending: false });

      const latest: Record<string, ExecRow | null> = {};
      for (const id of workoutIds) latest[id] = null;

      for (const row of (exs ?? []) as any[]) {
        if (!latest[row.workout_id]) {
          latest[row.workout_id] = {
            id: row.id,
            workout_id: row.workout_id,
            status: row.status,
            completed_at: row.completed_at ?? null,
            performed_at: row.performed_at ?? null,
          };
        }
      }
      setLatestExecByWorkout(latest);
    } else {
      setLatestExecByWorkout({});
    }

    // counts
    const completed = ws.filter((w) => !!latestExecByWorkout[w.id] && latestExecByWorkout[w.id]?.status === "completed").length;
    const canceled = ws.filter((w) => w.status === "canceled").length;
    const pending = ws.filter((w) => w.status === "ready" && !(latestExecByWorkout[w.id] && latestExecByWorkout[w.id]?.status === "completed")).length;
    setCounts({ completed, pending, canceled });
  }

  async function publishWorkout(workoutId: string) {
    await supabase.from("workouts").update({ status: "ready" }).eq("id", workoutId);
    if (selectedWeekId) await loadWeekData(selectedWeekId);
  }

  function openWorkoutPreview(workoutId: string) {
    // Se o seu preview usa /p/[studentSlug]/workouts/[id] ou algo parecido,
    // aqui mantém o comportamento existente.
    router.push(`/workouts/${workoutId}/edit?preview=1`);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  useEffect(() => {
    if (!selectedWeekId) return;
    loadWeekData(selectedWeekId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWeekId]);

  const readyCount = useMemo(() => workouts.filter((w) => w.status === "ready").length, [workouts]);
  const draftCount = useMemo(() => workouts.filter((w) => w.status === "draft").length, [workouts]);
  const canceledCount = useMemo(() => workouts.filter((w) => w.status === "canceled").length, [workouts]);

  const completedCount = useMemo(() => {
    let c = 0;
    for (const w of workouts) {
      const ex = latestExecByWorkout[w.id];
      if (ex?.status === "completed") c += 1;
    }
    return c;
  }, [workouts, latestExecByWorkout]);

  if (loading) {
    return (
      <main className="min-h-screen bg-white dark:bg-surface-dark text-slate-900 dark:text-white p-4">
        <div className="max-w-3xl mx-auto">Carregando...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white dark:bg-surface-dark text-slate-900 dark:text-white p-4">
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="rounded-3xl bg-slate-50 dark:bg-surface-soft p-5 border border-slate-200 dark:border-slate-800">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm text-slate-600 dark:text-slate-300">Aluno</div>
              <div className="text-2xl font-bold">{studentName}</div>
              <div className="text-sm text-slate-600 dark:text-slate-300 mt-2">
                Planejamento por semana (Seg → Dom)
              </div>
              <div className="text-lg font-semibold mt-1">Semana {weekStartLabel}</div>
            </div>

            <div className="shrink-0">
              <button
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 font-semibold"
                onClick={() => router.back()}
              >
                Voltar
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href={`/students/${studentId}/workouts/new?weekId=${selectedWeekId ?? ""}`}
              className="px-4 py-2 rounded-xl bg-slate-900 text-white font-semibold"
            >
              + Novo treino
            </Link>

            <Link
              href={`/students/${studentId}/reports/4w`}
              className="px-4 py-2 rounded-xl bg-slate-900 text-white font-semibold"
            >
              Relatório 4 semanas
            </Link>

            {selectedWeekId ? (
              <Link
                href={`/dashboard/week/${selectedWeekId}`}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 font-semibold"
              >
                Painel da semana
              </Link>
            ) : null}
          </div>

          <div className="mt-4 flex flex-wrap gap-2 text-sm font-semibold">
            <div className="px-3 py-2 rounded-full bg-slate-100 dark:bg-slate-800">
              Programados: {draftCount + readyCount}
            </div>
            <div className="px-3 py-2 rounded-full bg-slate-100 dark:bg-slate-800">
              Publicados: {readyCount}
            </div>
            <div className="px-3 py-2 rounded-full bg-slate-100 dark:bg-slate-800">
              Concluídos: {completedCount}
            </div>
            <div className="px-3 py-2 rounded-full bg-slate-100 dark:bg-slate-800">
              Cancelados: {canceledCount}
            </div>
          </div>

          <div className="mt-5">
            <div className="font-semibold">Semanas</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {weeks.slice(0, 6).map((w) => {
                const active = w.id === selectedWeekId;
                const lab = w.label ? w.label.replace("Semana ", "") : formatBRShort(w.week_start);
                return (
                  <button
                    key={w.id}
                    className={`px-4 py-2 rounded-full border ${
                      active
                        ? "bg-primary text-slate-900 border-primary"
                        : "bg-transparent border-slate-300 dark:border-slate-700"
                    }`}
                    onClick={() => setSelectedWeekId(w.id)}
                  >
                    {lab}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Treinos */}
        <div className="rounded-3xl bg-slate-50 dark:bg-surface-soft p-5 border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <div className="font-semibold">Treinos da semana</div>
          </div>

          {workouts.length === 0 ? (
            <div className="text-slate-600 dark:text-slate-300 mt-3">Nenhum treino nesta semana.</div>
          ) : (
            <div className="mt-3">
              {workouts.map((w, idx) => {
                const ex = latestExecByWorkout[w.id]; // se existe, tem execução
                const hasExecution = !!ex;

                const templateLabel = w.template_type ? TEMPLATE_LABEL[w.template_type] || w.template_type : "—";
                const statusLabel = STATUS_LABEL[w.status] || w.status;

                const whenLabel = plannedLabel(w, selectedWeek?.week_start);

                // regras solicitadas:
                const canEdit = !hasExecution; // só edita se NÃO tem execução
                const canPublish = w.status === "draft" && !hasExecution; // se já está publicado, não mostra Publicar

                return (
                  <React.Fragment key={w.id}>
                    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm text-slate-600 dark:text-slate-300 flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span>{whenLabel}</span>
                            <span className="opacity-60">•</span>
                            <span>{statusLabel}</span>
                          </div>
                          <div className="text-sm text-slate-600 dark:text-slate-300 flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span>{templateLabel}</span>
                            <span className="opacity-60">•</span>
                            <span>Total: {formatKm(w.total_km)}</span>
                          </div>

                          <div className="text-lg font-semibold whitespace-normal break-words mt-2">
                            {w.title || "Treino"}
                          </div>

                          <div className="text-sm text-slate-600 dark:text-slate-300 mt-2">
                            Execução do aluno:{" "}
                            {ex?.status === "completed"
                              ? `Concluído (${ex.performed_at ? formatBRShort(ex.performed_at) : "—"})`
                              : hasExecution
                              ? "Em andamento"
                              : "—"}
                          </div>
                        </div>

                        <div className="shrink-0 flex flex-col gap-2 items-end">
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
                              onClick={() => publishWorkout(w.id)}
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
                      </div>
                    </div>

                    {idx < workouts.length - 1 ? (
                      <div className="my-3 h-[2px] w-full rounded-full bg-emerald-400/30" />
                    ) : null}
                  </React.Fragment>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
