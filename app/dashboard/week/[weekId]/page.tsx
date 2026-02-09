'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '../../../../lib/supabaseBrowser';

type WeekRow = {
  id: string;
  week_start: string;
  week_end: string | null;
  label: string | null;
};

type StudentRow = {
  id: string;
  name: string;
};

type DashboardRow = {
  trainer_id: string;
  week_id: string;
  student_id: string;

  planned?: number;
  ready?: number;
  completed?: number;
  pending?: number;
  canceled?: number;

  planned_km?: number;
  actual_km?: number;

  avg_rpe?: number;
};

function formatBRShort(iso: string | null) {
  if (!iso) return '—';
  const [y, m, d] = String(iso).split('-');
  if (!y || !m || !d) return String(iso);
  return `${d}/${m}`;
}

function kmLabel(v: any) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return n.toFixed(1).replace('.', ',');
}

function percentLabel(v: number) {
  if (!Number.isFinite(v)) return '—';
  return `${Math.round(v * 100)}%`;
}

export default function TrainerWeekDashboardPage() {
  const router = useRouter();
  const params = useParams<{ weekId: string }>();
  const weekId = params.weekId;

  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<string | null>(null);

  const [week, setWeek] = useState<WeekRow | null>(null);
  const [rows, setRows] = useState<DashboardRow[]>([]);
  const [studentsById, setStudentsById] = useState<Record<string, StudentRow>>({});

  async function load() {
    setLoading(true);
    setBanner(null);

    const { data: sess } = await supabase.auth.getSession();
    const trainerId = sess?.session?.user?.id || null;

    if (!trainerId) {
      setBanner('Sessão não encontrada. Faça login novamente.');
      setLoading(false);
      return;
    }

    // Week info
    {
      const { data, error } = await supabase
        .from('training_weeks')
        .select('id,week_start,week_end,label')
        .eq('id', weekId)
        .maybeSingle();

      if (error) {
        setBanner(error.message);
        setLoading(false);
        return;
      }
      setWeek((data as any) || null);
    }

    // Dashboard rows (per student)
    let list: any[] = [];
    {
      const { data, error } = await supabase
        .from('v2_trainer_week_dashboard')
        .select('*')
        .eq('trainer_id', trainerId)
        .eq('week_id', weekId);

      if (error) {
        setBanner(error.message);
        setLoading(false);
        return;
      }

      list = (data as any[]) || [];

      // Sort: pending desc, avg_rpe desc, actual_km desc
      list.sort((a, b) => {
        const ap = Number(a.pending || 0);
        const bp = Number(b.pending || 0);
        if (bp !== ap) return bp - ap;

        const ar = a.avg_rpe == null ? -1 : Number(a.avg_rpe);
        const br = b.avg_rpe == null ? -1 : Number(b.avg_rpe);
        if (br !== ar) return br - ar;

        const ak = Number(a.actual_km || 0);
        const bk = Number(b.actual_km || 0);
        return bk - ak;
      });

      setRows(list as any);
    }

    // Student names
    {
      const ids = Array.from(new Set(list.map((r) => r.student_id))).filter(Boolean);

      if (ids.length) {
        const { data, error } = await supabase.from('students').select('id,name').in('id', ids);
        if (!error && data) {
          const map: Record<string, StudentRow> = {};
          for (const s of data as any[]) map[s.id] = s;
          setStudentsById(map);
        }
      }
    }

    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekId]);

  const totals = useMemo(() => {
    const t = {
      planned: 0,
      ready: 0,
      completed: 0,
      pending: 0,
      canceled: 0,
      planned_km: 0,
      actual_km: 0,
      avg_rpe_sum: 0,
      avg_rpe_count: 0,
    };

    for (const r of rows) {
      t.planned += Number(r.planned || 0);
      t.ready += Number(r.ready || 0);
      t.completed += Number(r.completed || 0);
      t.pending += Number(r.pending || 0);
      t.canceled += Number(r.canceled || 0);
      t.planned_km += Number(r.planned_km || 0);
      t.actual_km += Number(r.actual_km || 0);

      if (r.avg_rpe != null) {
        t.avg_rpe_sum += Number(r.avg_rpe);
        t.avg_rpe_count += 1;
      }
    }

    const adherence = t.ready > 0 ? t.completed / t.ready : 0;
    const avgEffort = t.avg_rpe_count > 0 ? t.avg_rpe_sum / t.avg_rpe_count : null;

    return { ...t, adherence, avgEffort };
  }, [rows]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background-dark to-black text-white">
      <header className="px-6 py-5 border-b border-white/10">
        <div className="mx-auto max-w-4xl flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs text-white/60">Painel do Treinador</div>
            <div className="text-xl font-semibold truncate">
              {week?.label || (week ? `Semana ${formatBRShort(week.week_start)} – ${formatBRShort(week.week_end)}` : 'Semana')}
            </div>
            <div className="text-sm text-white/70 mt-1">
              {week ? `${formatBRShort(week.week_start)} – ${formatBRShort(week.week_end)}` : '—'}
            </div>
          </div>

          <button className="text-sm underline text-white/70" onClick={() => router.back()}>
            Voltar
          </button>
        </div>
      </header>

      <main className="px-6 py-6">
        <div className="mx-auto max-w-4xl space-y-4">
          {banner ? (
            <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-4 text-sm text-amber-200">{banner}</div>
          ) : null}

          {loading ? (
            <div className="text-sm text-white/70">Carregando…</div>
          ) : (
            <>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-sm text-white/70">Resumo (todos os alunos)</div>
                <div className="mt-2 flex flex-wrap gap-3 text-sm">
                  <span className="rounded-full bg-white/10 px-3 py-1">Treinos: <b>{totals.planned}</b></span>
                  <span className="rounded-full bg-white/10 px-3 py-1">Disponíveis: <b>{totals.ready}</b></span>
                  <span className="rounded-full bg-white/10 px-3 py-1">Concluídos: <b>{totals.completed}</b></span>
                  <span className="rounded-full bg-white/10 px-3 py-1">Pendentes: <b>{totals.pending}</b></span>
                  <span className="rounded-full bg-white/10 px-3 py-1">Cancelados: <b>{totals.canceled}</b></span>
                </div>

                <div className="mt-3 text-xs text-white/60">
                  Aderência: <b>{percentLabel(totals.adherence)}</b> · Km previstos: <b>{kmLabel(totals.planned_km)}</b> · Km realizados:{' '}
                  <b>{kmLabel(totals.actual_km)}</b> · Esforço percebido (médio):{' '}
                  <b>{totals.avgEffort == null ? '—' : String(Math.round(totals.avgEffort * 10) / 10).replace('.', ',')}</b>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 overflow-x-auto">
                <div className="font-semibold">Tabela por aluno</div>

                {rows.length === 0 ? (
                  <div className="mt-3 text-sm text-white/70">Nenhum dado encontrado para esta semana.</div>
                ) : (
                  <table className="mt-3 w-full text-sm">
                    <thead className="text-white/60">
                      <tr className="border-b border-white/10">
                        <th className="py-2 text-left">Aluno</th>
                        <th className="py-2 text-right">Concluídos</th>
                        <th className="py-2 text-right">Pendentes</th>
                        <th className="py-2 text-right">Cancelados</th>
                        <th className="py-2 text-right">Km previstos</th>
                        <th className="py-2 text-right">Km realizados</th>
                        <th className="py-2 text-right">Esforço percebido</th>
                        <th className="py-2 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => {
                        const st = studentsById[r.student_id];
                        const name = st?.name || r.student_id;
                        const ready = Number(r.ready || 0);
                        const completed = Number(r.completed || 0);
                        const adherence = ready > 0 ? completed / ready : 0;

                        return (
                          <tr key={r.student_id} className="border-b border-white/5 hover:bg-white/5">
                            <td className="py-3 pr-3">
                              <div className="font-semibold truncate max-w-[280px]">{name}</div>
                              <div className="text-xs text-white/50">
                                Aderência: <b>{percentLabel(adherence)}</b>
                              </div>
                            </td>
                            <td className="py-3 text-right">{Number(r.completed || 0)}</td>
                            <td className="py-3 text-right">{Number(r.pending || 0)}</td>
                            <td className="py-3 text-right">{Number(r.canceled || 0)}</td>
                            <td className="py-3 text-right">{kmLabel(r.planned_km)}</td>
                            <td className="py-3 text-right">{kmLabel(r.actual_km)}</td>
                            <td className="py-3 text-right">
                              {r.avg_rpe == null ? '—' : String(Math.round(Number(r.avg_rpe) * 10) / 10).replace('.', ',')}
                            </td>
                            <td className="py-3 text-right">
                              <Link className="underline text-white/80" href={`/students/${r.student_id}`}>
                                Abrir aluno
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
