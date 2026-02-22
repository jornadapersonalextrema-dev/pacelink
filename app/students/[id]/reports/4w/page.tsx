'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '../../../../../lib/supabaseBrowser';

type StudentOption = { id: string; name: string };

type WeekSummaryRow = {
  student_id: string;
  week_id: string;
  week_start: string; // YYYY-MM-DD
  week_end: string | null; // YYYY-MM-DD
  label: string | null;

  planned?: number;
  ready?: number;
  completed?: number;
  pending?: number;
  canceled?: number;

  planned_km?: number;
  actual_km?: number;

  avg_rpe?: number;
};

type WeekAgg = {
  week_start: string;
  week_end: string;
  label: string;

  ready: number;
  completed: number;
  pending: number;
  canceled: number;

  planned_km: number;
  actual_km: number;

  avg_rpe: number | null;
  adherence: number; // 0..1
};

function formatBRShort(iso: string | null) {
  if (!iso) return '—';
  const [y, m, d] = String(iso).split('-');
  if (!y || !m || !d) return String(iso);
  return `${d}/${m}`;
}

function formatWeekLabel(weekStart: string, weekEnd: string | null, label: string | null) {
  if (label) return label;
  const end = weekEnd || weekStart;
  return `Semana ${formatBRShort(weekStart)} – ${formatBRShort(end)}`;
}

function kmLabel(v: any) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return n.toFixed(1).replace('.', ',');
}

function num(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function percentLabel01(v: number) {
  if (!Number.isFinite(v)) return '—';
  return `${Math.round(v * 100)}%`;
}

function uniqBy<T>(items: T[], keyFn: (x: T) => string) {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const it of items) {
    const k = keyFn(it);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(it);
  }
  return out;
}

type SimpleSeries = { id: string; name: string; values: number[] };

function SimpleBarChart({
  labels,
  series,
  height = 240,
  valueSuffix,
}: {
  labels: string[];
  series: SimpleSeries[];
  height?: number;
  valueSuffix?: string;
}) {
  const max = useMemo(() => {
    let m = 0;
    for (const s of series) for (const v of s.values) m = Math.max(m, Number(v) || 0);
    return m <= 0 ? 1 : m;
  }, [series]);

  const padL = 36;
  const padR = 14;
  const padT = 12;
  const padB = 34;

  const w = 1000;
  const h = height;

  const innerW = w - padL - padR;
  const innerH = h - padT - padB;

  const n = labels.length || 1;
  const groupW = innerW / n;
  const gap = Math.min(10, groupW * 0.12);
  const barW = Math.max(6, (groupW - gap) / Math.max(1, series.length) - gap / 2);

  const ticks = 4;
  const tickValues = Array.from({ length: ticks + 1 }).map((_, i) => (max * i) / ticks);

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full min-w-[720px]">
        {tickValues.map((tv, i) => {
          const y = padT + innerH - (tv / max) * innerH;
          return (
            <g key={i}>
              <line x1={padL} y1={y} x2={w - padR} y2={y} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
              <text x={padL - 8} y={y + 4} textAnchor="end" fontSize="11" fill="rgba(255,255,255,0.55)">
                {Math.round(tv)}
              </text>
            </g>
          );
        })}

        {labels.map((_, idx) => {
          const gx = padL + idx * groupW + gap / 2;
          return (
            <g key={idx}>
              {series.map((s, si) => {
                const v = Number(s.values[idx] || 0);
                const bh = (v / max) * innerH;
                const x = gx + si * (barW + gap / 2);
                const y = padT + innerH - bh;

                const fill =
                  si % 4 === 0 ? '#34d399' : si % 4 === 1 ? '#60a5fa' : si % 4 === 2 ? '#fbbf24' : '#fb7185';

                return <rect key={s.id} x={x} y={y} width={barW} height={bh} rx="4" fill={fill} opacity="0.9" />;
              })}
            </g>
          );
        })}

        {labels.map((lb, i) => {
          const x = padL + i * groupW + groupW / 2;
          return (
            <text key={i} x={x} y={h - 14} textAnchor="middle" fontSize="11" fill="rgba(255,255,255,0.65)">
              {lb}
            </text>
          );
        })}
      </svg>

      {valueSuffix ? <div className="mt-2 text-xs text-white/50">Unidade: {valueSuffix}</div> : null}
    </div>
  );
}

export default function StudentReportAdvancedPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const initialStudentId = params.id;

  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<string | null>(null);

  const [isTrainerMode, setIsTrainerMode] = useState(false);

  const [studentOptions, setStudentOptions] = useState<StudentOption[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([initialStudentId]);

  const [rawRows, setRawRows] = useState<WeekSummaryRow[]>([]);
  const [weeksLimit, setWeeksLimit] = useState<4 | 8 | 12 | 24 | 52 | 104>(12);

  const [weekOptions, setWeekOptions] = useState<Array<{ week_start: string; week_end: string | null; label: string | null }>>([]);
  const [selectedWeekStarts, setSelectedWeekStarts] = useState<string[]>([]);

  // Status (exibir)
  const [showReady, setShowReady] = useState(true);
  const [showCompleted, setShowCompleted] = useState(true);
  const [showPending, setShowPending] = useState(true);
  const [showCanceled, setShowCanceled] = useState(true);

  // Comparações adicionais
  const [showKmPlanned, setShowKmPlanned] = useState(true);
  const [showKmActual, setShowKmActual] = useState(true);
  const [showAdherence, setShowAdherence] = useState(true);
  const [showRpe, setShowRpe] = useState(false);

  const [showCharts, setShowCharts] = useState(true);
  const [showStudentTotals, setShowStudentTotals] = useState(true);

  const selectedStudentsLabel = useMemo(() => {
    if (!isTrainerMode) return 'Aluno';
    if (selectedStudentIds.length === 0) return 'Nenhum aluno selecionado';
    if (selectedStudentIds.length === 1) {
      const s = studentOptions.find((x) => x.id === selectedStudentIds[0]);
      return s?.name || 'Aluno';
    }
    return `${selectedStudentIds.length} alunos`;
  }, [isTrainerMode, selectedStudentIds, studentOptions]);

  async function loadTrainerStudentsIfAny() {
    const { data: userRes } = await supabase.auth.getUser();
    const uid = userRes.user?.id || null;
    if (!uid) {
      setIsTrainerMode(false);
      setStudentOptions([]);
      setSelectedStudentIds([initialStudentId]);
      return;
    }

    const { data, error } = await supabase
      .from('students')
      .select('id,name,is_active,trainer_id')
      .eq('trainer_id', uid)
      .order('created_at', { ascending: false });

    if (error) {
      setIsTrainerMode(false);
      setStudentOptions([]);
      setSelectedStudentIds([initialStudentId]);
      return;
    }

    const list = ((data as any[]) || [])
      .filter((s) => s.is_active !== false)
      .map((s) => ({ id: String(s.id), name: String(s.name || '') }));

    if (list.length === 0) {
      setIsTrainerMode(false);
      setStudentOptions([]);
      setSelectedStudentIds([initialStudentId]);
      return;
    }

    setIsTrainerMode(true);
    setStudentOptions(list);

    const exists = list.some((s) => s.id === initialStudentId);
    setSelectedStudentIds(exists ? [initialStudentId] : [list[0].id]);
  }

  async function loadSummaryRows(studentIds: string[], limitWeeks: number) {
    setBanner(null);

    if (!studentIds.length) {
      setRawRows([]);
      setWeekOptions([]);
      setSelectedWeekStarts([]);
      return;
    }

    const target = Math.min(5000, Math.max(200, limitWeeks * studentIds.length * 3));
    const endIdx = target - 1;

    const { data, error } = await supabase
      .from('v2_student_week_summary')
      .select('*')
      .in('student_id', studentIds)
      .order('week_start', { ascending: false })
      .range(0, endIdx);

    if (error) throw error;

    const rows = ((data as any[]) || []) as WeekSummaryRow[];
    setRawRows(rows);

    const weeks = uniqBy(
      rows
        .map((r) => ({
          week_start: String(r.week_start),
          week_end: r.week_end ? String(r.week_end) : null,
          label: r.label ? String(r.label) : null,
        }))
        .sort((a, b) => String(b.week_start).localeCompare(String(a.week_start))),
      (x) => x.week_start
    );

    setWeekOptions(weeks);

    setSelectedWeekStarts((prev) => {
      const prevSet = new Set(prev);
      const stillValid = weeks.map((w) => w.week_start).filter((ws) => prevSet.has(ws));

      if (stillValid.length >= 1) return stillValid;

      const def = weeks.slice(0, Math.min(4, weeks.length)).map((w) => w.week_start);
      return def;
    });
  }

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        await loadTrainerStudentsIfAny();
      } catch {
        // ignore
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialStudentId]);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        await loadSummaryRows(selectedStudentIds, weeksLimit);
      } catch (e: any) {
        if (!alive) return;
        setBanner(e?.message || 'Erro ao carregar relatório.');
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStudentIds.join('|'), weeksLimit]);

  const filteredRows = useMemo(() => {
    if (!selectedWeekStarts.length) return [];
    const set = new Set(selectedWeekStarts);
    return rawRows.filter((r) => set.has(String(r.week_start)));
  }, [rawRows, selectedWeekStarts]);

  const weekAgg = useMemo(() => {
    const map = new Map<string, WeekAgg>();

    for (const r of filteredRows) {
      const ws = String(r.week_start);
      const we = r.week_end ? String(r.week_end) : null;
      const label = formatWeekLabel(ws, we, r.label || null);

      if (!map.has(ws)) {
        map.set(ws, {
          week_start: ws,
          week_end: we || ws,
          label,
          ready: 0,
          completed: 0,
          pending: 0,
          canceled: 0,
          planned_km: 0,
          actual_km: 0,
          avg_rpe: null,
          adherence: 0,
        });
      }

      const a = map.get(ws)!;
      a.ready += num(r.ready);
      a.completed += num(r.completed);
      a.pending += num(r.pending);
      a.canceled += num(r.canceled);
      a.planned_km += num(r.planned_km);
      a.actual_km += num(r.actual_km);

      if (r.avg_rpe != null) {
        const v = num(r.avg_rpe);
        if (a.avg_rpe == null) a.avg_rpe = v;
        else a.avg_rpe = (a.avg_rpe + v) / 2;
      }
    }

    for (const a of map.values()) {
      a.adherence = a.ready > 0 ? a.completed / a.ready : 0;
      a.planned_km = Math.round(a.planned_km * 10) / 10;
      a.actual_km = Math.round(a.actual_km * 10) / 10;
    }

    return Array.from(map.values()).sort((x, y) => String(y.week_start).localeCompare(String(x.week_start)));
  }, [filteredRows]);

  const studentAgg = useMemo(() => {
    const byStudent = new Map<
      string,
      {
        student_id: string;
        ready: number;
        completed: number;
        pending: number;
        canceled: number;
        planned_km: number;
        actual_km: number;
        avg_rpe_sum: number;
        avg_rpe_count: number;
      }
    >();

    for (const r of filteredRows) {
      const sid = String(r.student_id);
      if (!byStudent.has(sid)) {
        byStudent.set(sid, {
          student_id: sid,
          ready: 0,
          completed: 0,
          pending: 0,
          canceled: 0,
          planned_km: 0,
          actual_km: 0,
          avg_rpe_sum: 0,
          avg_rpe_count: 0,
        });
      }
      const a = byStudent.get(sid)!;
      a.ready += num(r.ready);
      a.completed += num(r.completed);
      a.pending += num(r.pending);
      a.canceled += num(r.canceled);
      a.planned_km += num(r.planned_km);
      a.actual_km += num(r.actual_km);
      if (r.avg_rpe != null) {
        a.avg_rpe_sum += num(r.avg_rpe);
        a.avg_rpe_count += 1;
      }
    }

    const out = Array.from(byStudent.values()).map((a) => {
      const avg_rpe = a.avg_rpe_count ? a.avg_rpe_sum / a.avg_rpe_count : null;
      const adherence = a.ready > 0 ? a.completed / a.ready : 0;
      return {
        student_id: a.student_id,
        student_name: studentOptions.find((s) => s.id === a.student_id)?.name || a.student_id,
        ready: a.ready,
        completed: a.completed,
        pending: a.pending,
        canceled: a.canceled,
        planned_km: Math.round(a.planned_km * 10) / 10,
        actual_km: Math.round(a.actual_km * 10) / 10,
        avg_rpe: avg_rpe == null ? null : Math.round(avg_rpe * 10) / 10,
        adherence,
      };
    });

    out.sort((a, b) => a.student_name.localeCompare(b.student_name));
    return out;
  }, [filteredRows, studentOptions]);

  const totals = useMemo(() => {
    const t = {
      ready: 0,
      completed: 0,
      pending: 0,
      canceled: 0,
      planned_km: 0,
      actual_km: 0,
      avg_rpe_sum: 0,
      avg_rpe_count: 0,
    };

    for (const w of weekAgg) {
      t.ready += w.ready;
      t.completed += w.completed;
      t.pending += w.pending;
      t.canceled += w.canceled;
      t.planned_km += w.planned_km;
      t.actual_km += w.actual_km;
      if (w.avg_rpe != null) {
        t.avg_rpe_sum += w.avg_rpe;
        t.avg_rpe_count += 1;
      }
    }

    const adherence = t.ready > 0 ? t.completed / t.ready : 0;
    const avgEffort = t.avg_rpe_count > 0 ? t.avg_rpe_sum / t.avg_rpe_count : null;

    return {
      ...t,
      planned_km: Math.round(t.planned_km * 10) / 10,
      actual_km: Math.round(t.actual_km * 10) / 10,
      adherence,
      avgEffort: avgEffort == null ? null : Math.round(avgEffort * 10) / 10,
    };
  }, [weekAgg]);

  const chartWeeksAsc = useMemo(
    () => [...weekAgg].sort((a, b) => String(a.week_start).localeCompare(String(b.week_start))),
    [weekAgg]
  );

  const chartLabels = useMemo(() => chartWeeksAsc.map((w) => formatBRShort(w.week_start)), [chartWeeksAsc]);

  const chartKmSeries = useMemo(() => {
    const s: SimpleSeries[] = [];
    if (showKmPlanned) s.push({ id: 'planned_km', name: 'Km previstos', values: chartWeeksAsc.map((w) => w.planned_km) });
    if (showKmActual) s.push({ id: 'actual_km', name: 'Km realizados', values: chartWeeksAsc.map((w) => w.actual_km) });
    return s;
  }, [chartWeeksAsc, showKmPlanned, showKmActual]);

  const chartStatusSeries = useMemo(() => {
    const s: SimpleSeries[] = [];
    if (showReady) s.push({ id: 'ready', name: 'Disponíveis', values: chartWeeksAsc.map((w) => w.ready) });
    if (showCompleted) s.push({ id: 'completed', name: 'Concluídos', values: chartWeeksAsc.map((w) => w.completed) });
    if (showPending) s.push({ id: 'pending', name: 'Pendentes', values: chartWeeksAsc.map((w) => w.pending) });
    if (showCanceled) s.push({ id: 'canceled', name: 'Cancelados', values: chartWeeksAsc.map((w) => w.canceled) });
    return s;
  }, [chartWeeksAsc, showReady, showCompleted, showPending, showCanceled]);

  const chartQualitySeries = useMemo(() => {
    const s: SimpleSeries[] = [];
    if (showAdherence) s.push({ id: 'adherence', name: 'Aderência (%)', values: chartWeeksAsc.map((w) => Math.round(w.adherence * 100)) });
    if (showRpe) s.push({ id: 'rpe', name: 'RPE médio', values: chartWeeksAsc.map((w) => (w.avg_rpe == null ? 0 : w.avg_rpe)) });
    return s;
  }, [chartWeeksAsc, showAdherence, showRpe]);

  const weeksSelectedLabel = useMemo(() => {
    if (!selectedWeekStarts.length) return 'Nenhuma semana selecionada';
    if (selectedWeekStarts.length === 1) return `1 semana`;
    return `${selectedWeekStarts.length} semanas`;
  }, [selectedWeekStarts.length]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background-dark to-black text-white">
      <header className="px-6 py-5 border-b border-white/10">
        <div className="mx-auto max-w-5xl flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs text-white/60">Relatório</div>
            <div className="text-xl font-semibold break-words">{selectedStudentsLabel}</div>
            <div className="text-sm text-white/70 mt-1">{weeksSelectedLabel} • filtros por semanas / status / alunos</div>
          </div>

          <button className="text-sm underline text-white/70" onClick={() => router.back()}>
            Voltar
          </button>
        </div>
      </header>

      <main className="px-6 py-6">
        <div className="mx-auto max-w-5xl space-y-4">
          {banner ? (
            <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-4 text-sm text-amber-200">{banner}</div>
          ) : null}

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0">
                <div className="font-semibold">Filtros</div>
                <div className="text-xs text-white/60 mt-1">
                  Selecione <b>uma</b>, <b>algumas</b> ou <b>todas</b> (semanas, status e alunos).
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <label className="text-xs text-white/70">Carregar</label>
                <select
                  value={weeksLimit}
                  onChange={(e) => setWeeksLimit(Number(e.target.value) as any)}
                  className="rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-sm outline-none"
                >
                  <option value={4}>4 semanas</option>
                  <option value={8}>8 semanas</option>
                  <option value={12}>12 semanas</option>
                  <option value={24}>24 semanas</option>
                  <option value={52}>52 semanas</option>
                  <option value={104}>104 semanas</option>
                </select>

                <button
                  className="rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-sm hover:bg-black/40"
                  onClick={() => setShowCharts((v) => !v)}
                >
                  {showCharts ? 'Ocultar gráficos' : 'Mostrar gráficos'}
                </button>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="font-semibold">Alunos</div>

                {!isTrainerMode ? (
                  <div className="text-sm text-white/70 mt-2">Modo por aluno.</div>
                ) : (
                  <>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        className="text-xs underline text-white/70 hover:text-white"
                        onClick={() => setSelectedStudentIds(studentOptions.map((s) => s.id))}
                      >
                        Selecionar todos
                      </button>
                      <button className="text-xs underline text-white/70 hover:text-white" onClick={() => setSelectedStudentIds([])}>
                        Limpar
                      </button>
                      <button className="text-xs underline text-white/70 hover:text-white" onClick={() => setSelectedStudentIds([initialStudentId])}>
                        Somente este
                      </button>
                    </div>

                    <div className="mt-3 max-h-56 overflow-auto pr-1 space-y-2">
                      {studentOptions.map((s) => {
                        const checked = selectedStudentIds.includes(s.id);
                        return (
                          <label key={s.id} className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                const on = e.target.checked;
                                setSelectedStudentIds((prev) => {
                                  const set = new Set(prev);
                                  if (on) set.add(s.id);
                                  else set.delete(s.id);
                                  return Array.from(set);
                                });
                              }}
                            />
                            <span className="truncate">{s.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="font-semibold">Semanas</div>

                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    className="text-xs underline text-white/70 hover:text-white"
                    onClick={() => setSelectedWeekStarts(weekOptions.map((w) => w.week_start))}
                  >
                    Selecionar todas
                  </button>
                  <button className="text-xs underline text-white/70 hover:text-white" onClick={() => setSelectedWeekStarts([])}>
                    Limpar
                  </button>
                  <button
                    className="text-xs underline text-white/70 hover:text-white"
                    onClick={() => setSelectedWeekStarts(weekOptions.slice(0, 4).map((w) => w.week_start))}
                  >
                    Últimas 4
                  </button>
                </div>

                <div className="mt-3 max-h-56 overflow-auto pr-1 space-y-2">
                  {weekOptions.map((w) => {
                    const key = w.week_start;
                    const checked = selectedWeekStarts.includes(key);
                    return (
                      <label key={key} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const on = e.target.checked;
                            setSelectedWeekStarts((prev) => {
                              const set = new Set(prev);
                              if (on) set.add(key);
                              else set.delete(key);
                              return Array.from(set);
                            });
                          }}
                        />
                        <span className="truncate">{formatWeekLabel(w.week_start, w.week_end, w.label)}</span>
                      </label>
                    );
                  })}
                  {weekOptions.length === 0 ? <div className="text-sm text-white/60">Sem semanas disponíveis.</div> : null}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="font-semibold">Status e comparação</div>

                <div className="mt-3">
                  <div className="text-xs text-white/60 mb-1">Status</div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <label className="flex items-center gap-2"><input type="checkbox" checked={showReady} onChange={(e) => setShowReady(e.target.checked)} />Disponíveis</label>
                    <label className="flex items-center gap-2"><input type="checkbox" checked={showCompleted} onChange={(e) => setShowCompleted(e.target.checked)} />Concluídos</label>
                    <label className="flex items-center gap-2"><input type="checkbox" checked={showPending} onChange={(e) => setShowPending(e.target.checked)} />Pendentes</label>
                    <label className="flex items-center gap-2"><input type="checkbox" checked={showCanceled} onChange={(e) => setShowCanceled(e.target.checked)} />Cancelados</label>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="text-xs text-white/60 mb-1">Comparação</div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <label className="flex items-center gap-2"><input type="checkbox" checked={showKmPlanned} onChange={(e) => setShowKmPlanned(e.target.checked)} />Km previstos</label>
                    <label className="flex items-center gap-2"><input type="checkbox" checked={showKmActual} onChange={(e) => setShowKmActual(e.target.checked)} />Km realizados</label>
                    <label className="flex items-center gap-2"><input type="checkbox" checked={showAdherence} onChange={(e) => setShowAdherence(e.target.checked)} />Aderência (%)</label>
                    <label className="flex items-center gap-2"><input type="checkbox" checked={showRpe} onChange={(e) => setShowRpe(e.target.checked)} />RPE médio</label>
                  </div>
                </div>

                {isTrainerMode && selectedStudentIds.length > 1 ? (
                  <div className="mt-4">
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={showStudentTotals} onChange={(e) => setShowStudentTotals(e.target.checked)} />
                      Mostrar comparação por aluno
                    </label>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          {loading ? <div className="text-sm text-white/70">Carregando…</div> : null}

          {!loading ? (
            <>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-sm text-white/70">Resumo</div>
                <div className="mt-2 flex flex-wrap gap-3 text-sm">
                  {showReady ? <span className="rounded-full bg-white/10 px-3 py-1">Disponíveis: <b>{totals.ready}</b></span> : null}
                  {showCompleted ? <span className="rounded-full bg-white/10 px-3 py-1">Concluídos: <b>{totals.completed}</b></span> : null}
                  {showPending ? <span className="rounded-full bg-white/10 px-3 py-1">Pendentes: <b>{totals.pending}</b></span> : null}
                  {showCanceled ? <span className="rounded-full bg-white/10 px-3 py-1">Cancelados: <b>{totals.canceled}</b></span> : null}
                  {showAdherence ? <span className="rounded-full bg-white/10 px-3 py-1">Aderência: <b>{percentLabel01(totals.adherence)}</b></span> : null}
                </div>

                <div className="mt-3 text-xs text-white/60">
                  {showKmPlanned ? <>Km previstos: <b>{kmLabel(totals.planned_km)}</b></> : null}
                  {showKmPlanned && showKmActual ? <span> · </span> : null}
                  {showKmActual ? <>Km realizados: <b>{kmLabel(totals.actual_km)}</b></> : null}
                  {(showKmPlanned || showKmActual) && showRpe ? <span> · </span> : null}
                  {showRpe ? <>RPE médio: <b>{totals.avgEffort == null ? '—' : String(totals.avgEffort).replace('.', ',')}</b></> : null}
                </div>
              </div>

              {showCharts ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-4">
                  <div className="font-semibold">Gráficos</div>

                  {chartLabels.length === 0 ? (
                    <div className="text-sm text-white/70 mt-2">Sem dados para os filtros escolhidos.</div>
                  ) : (
                    <>
                      {(showKmPlanned || showKmActual) && chartKmSeries.length ? (
                        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                          <div className="text-sm font-semibold mb-2">Km (planejado vs realizado)</div>
                          <SimpleBarChart labels={chartLabels} series={chartKmSeries} valueSuffix="km" />
                        </div>
                      ) : null}

                      {(showReady || showCompleted || showPending || showCanceled) && chartStatusSeries.length ? (
                        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                          <div className="text-sm font-semibold mb-2">Treinos (status)</div>
                          <SimpleBarChart labels={chartLabels} series={chartStatusSeries} valueSuffix="treinos" />
                        </div>
                      ) : null}

                      {(showAdherence || showRpe) && chartQualitySeries.length ? (
                        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                          <div className="text-sm font-semibold mb-2">Qualidade</div>
                          <SimpleBarChart labels={chartLabels} series={chartQualitySeries} valueSuffix={showAdherence && !showRpe ? '%' : ''} />
                          <div className="mt-2 text-xs text-white/50">
                            * Aderência = <b>concluídos / disponíveis</b>. RPE médio é aproximado do resumo semanal.
                          </div>
                        </div>
                      ) : null}
                    </>
                  )}
                </div>
              ) : null}

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 overflow-x-auto">
                <div className="font-semibold">Tabela por semana</div>

                {weekAgg.length === 0 ? (
                  <div className="mt-3 text-sm text-white/70">Sem dados para o período selecionado.</div>
                ) : (
                  <table className="mt-3 w-full text-sm">
                    <thead className="text-white/60">
                      <tr className="border-b border-white/10">
                        <th className="py-2 text-left">Semana</th>
                        {showReady ? <th className="py-2 text-right">Disp.</th> : null}
                        {showCompleted ? <th className="py-2 text-right">Concl.</th> : null}
                        {showPending ? <th className="py-2 text-right">Pend.</th> : null}
                        {showCanceled ? <th className="py-2 text-right">Canc.</th> : null}
                        {showAdherence ? <th className="py-2 text-right">Ader.</th> : null}
                        {showKmPlanned ? <th className="py-2 text-right">Km prev.</th> : null}
                        {showKmActual ? <th className="py-2 text-right">Km real.</th> : null}
                        {showRpe ? <th className="py-2 text-right">RPE</th> : null}
                      </tr>
                    </thead>
                    <tbody>
                      {weekAgg.map((w) => (
                        <tr key={w.week_start} className="border-b border-white/5 hover:bg-white/5">
                          <td className="py-3 pr-3">
                            <div className="font-semibold">{w.label}</div>
                            <div className="text-xs text-white/50">{formatBRShort(w.week_start)} – {formatBRShort(w.week_end)}</div>
                          </td>

                          {showReady ? <td className="py-3 text-right">{w.ready}</td> : null}
                          {showCompleted ? <td className="py-3 text-right">{w.completed}</td> : null}
                          {showPending ? <td className="py-3 text-right">{w.pending}</td> : null}
                          {showCanceled ? <td className="py-3 text-right">{w.canceled}</td> : null}
                          {showAdherence ? <td className="py-3 text-right">{percentLabel01(w.adherence)}</td> : null}
                          {showKmPlanned ? <td className="py-3 text-right">{kmLabel(w.planned_km)}</td> : null}
                          {showKmActual ? <td className="py-3 text-right">{kmLabel(w.actual_km)}</td> : null}
                          {showRpe ? (
                            <td className="py-3 text-right">{w.avg_rpe == null ? '—' : String(Math.round(w.avg_rpe * 10) / 10).replace('.', ',')}</td>
                          ) : null}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {showStudentTotals && isTrainerMode && selectedStudentIds.length > 1 ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 overflow-x-auto">
                  <div className="font-semibold">Comparação por aluno</div>
                  <div className="text-xs text-white/60 mt-1">Totais somados nas semanas selecionadas.</div>

                  {studentAgg.length === 0 ? (
                    <div className="mt-3 text-sm text-white/70">Sem dados.</div>
                  ) : (
                    <table className="mt-3 w-full text-sm">
                      <thead className="text-white/60">
                        <tr className="border-b border-white/10">
                          <th className="py-2 text-left">Aluno</th>
                          {showReady ? <th className="py-2 text-right">Disp.</th> : null}
                          {showCompleted ? <th className="py-2 text-right">Concl.</th> : null}
                          {showPending ? <th className="py-2 text-right">Pend.</th> : null}
                          {showCanceled ? <th className="py-2 text-right">Canc.</th> : null}
                          {showAdherence ? <th className="py-2 text-right">Ader.</th> : null}
                          {showKmPlanned ? <th className="py-2 text-right">Km prev.</th> : null}
                          {showKmActual ? <th className="py-2 text-right">Km real.</th> : null}
                          {showRpe ? <th className="py-2 text-right">RPE</th> : null}
                        </tr>
                      </thead>
                      <tbody>
                        {studentAgg.map((s) => (
                          <tr key={s.student_id} className="border-b border-white/5 hover:bg-white/5">
                            <td className="py-3 pr-3">
                              <div className="font-semibold">{s.student_name}</div>
                              <div className="text-xs text-white/50">{s.student_id}</div>
                            </td>
                            {showReady ? <td className="py-3 text-right">{s.ready}</td> : null}
                            {showCompleted ? <td className="py-3 text-right">{s.completed}</td> : null}
                            {showPending ? <td className="py-3 text-right">{s.pending}</td> : null}
                            {showCanceled ? <td className="py-3 text-right">{s.canceled}</td> : null}
                            {showAdherence ? <td className="py-3 text-right">{percentLabel01(s.adherence)}</td> : null}
                            {showKmPlanned ? <td className="py-3 text-right">{kmLabel(s.planned_km)}</td> : null}
                            {showKmActual ? <td className="py-3 text-right">{kmLabel(s.actual_km)}</td> : null}
                            {showRpe ? <td className="py-3 text-right">{s.avg_rpe == null ? '—' : String(s.avg_rpe).replace('.', ',')}</td> : null}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              ) : null}

              <div className="text-xs text-white/50">
                Rota atual: <code>/students/{initialStudentId}/reports/4w</code> (agora com filtros e gráficos).
              </div>
            </>
          ) : null}
        </div>
      </main>
    </div>
  );
}