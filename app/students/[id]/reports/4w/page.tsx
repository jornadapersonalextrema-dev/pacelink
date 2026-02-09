'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '../../../../../lib/supabaseBrowser';

type StudentRow = {
  id: string;
  name: string;
};

type WeekSummaryRow = {
  student_id: string;
  trainer_id?: string;
  week_id: string;
  week_start: string;
  week_end: string | null;
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

export default function StudentReport4WPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const studentId = params.id;

  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<string | null>(null);

  const [student, setStudent] = useState<StudentRow | null>(null);
  const [weeks, setWeeks] = useState<WeekSummaryRow[]>([]);

  async function load() {
    setLoading(true);
    setBanner(null);

    // Student
    {
      const { data, error } = await supabase.from('students').select('id,name').eq('id', studentId).maybeSingle();
      if (error) {
        setBanner(error.message);
        setLoading(false);
        return;
      }
      setStudent((data as any) || null);
    }

    // Last 4 weeks (summary view)
    {
      const { data, error } = await supabase
        .from('v2_student_week_summary')
        .select('*')
        .eq('student_id', studentId)
        .order('week_start', { ascending: false })
        .limit(4);

      if (error) {
        setBanner(error.message);
        setLoading(false);
        return;
      }

      setWeeks(((data as any[]) || []) as any);
    }

    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  const totals = useMemo(() => {
    const t = {
      ready: 0,
      completed: 0,
      canceled: 0,
      planned_km: 0,
      actual_km: 0,
      avg_rpe_sum: 0,
      avg_rpe_count: 0,
    };

    for (const w of weeks) {
      t.ready += Number(w.ready || 0);
      t.completed += Number(w.completed || 0);
      t.canceled += Number(w.canceled || 0);
      t.planned_km += Number(w.planned_km || 0);
      t.actual_km += Number(w.actual_km || 0);

      if (w.avg_rpe != null) {
        t.avg_rpe_sum += Number(w.avg_rpe);
        t.avg_rpe_count += 1;
      }
    }

    const adherence = t.ready > 0 ? t.completed / t.ready : 0;
    const avgEffort = t.avg_rpe_count > 0 ? t.avg_rpe_sum / t.avg_rpe_count : null;

    return { ...t, adherence, avgEffort };
  }, [weeks]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background-dark to-black text-white">
      <header className="px-6 py-5 border-b border-white/10">
        <div className="mx-auto max-w-4xl flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs text-white/60">Relatório do aluno</div>
            <div className="text-xl font-semibold truncate">{student?.name || 'Aluno'}</div>
            <div className="text-sm text-white/70 mt-1">Últimas 4 semanas</div>
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
                <div className="text-sm text-white/70">Resumo (4 semanas)</div>
                <div className="mt-2 flex flex-wrap gap-3 text-sm">
                  <span className="rounded-full bg-white/10 px-3 py-1">Disponíveis: <b>{totals.ready}</b></span>
                  <span className="rounded-full bg-white/10 px-3 py-1">Concluídos: <b>{totals.completed}</b></span>
                  <span className="rounded-full bg-white/10 px-3 py-1">Cancelados: <b>{totals.canceled}</b></span>
                  <span className="rounded-full bg-white/10 px-3 py-1">Aderência: <b>{percentLabel(totals.adherence)}</b></span>
                </div>

                <div className="mt-3 text-xs text-white/60">
                  Km previstos: <b>{kmLabel(totals.planned_km)}</b> · Km realizados: <b>{kmLabel(totals.actual_km)}</b> · Esforço percebido (médio):{' '}
                  <b>{totals.avgEffort == null ? '—' : String(Math.round(totals.avgEffort * 10) / 10).replace('.', ',')}</b>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 overflow-x-auto">
                <div className="font-semibold">Tabela</div>

                {weeks.length === 0 ? (
                  <div className="mt-3 text-sm text-white/70">Sem dados nas últimas 4 semanas.</div>
                ) : (
                  <table className="mt-3 w-full text-sm">
                    <thead className="text-white/60">
                      <tr className="border-b border-white/10">
                        <th className="py-2 text-left">Semana</th>
                        <th className="py-2 text-right">Disponíveis</th>
                        <th className="py-2 text-right">Concluídos</th>
                        <th className="py-2 text-right">Cancelados</th>
                        <th className="py-2 text-right">Aderência</th>
                        <th className="py-2 text-right">Km previstos</th>
                        <th className="py-2 text-right">Km realizados</th>
                        <th className="py-2 text-right">Esforço percebido</th>
                      </tr>
                    </thead>
                    <tbody>
                      {weeks.map((w) => {
                        const ready = Number(w.ready || 0);
                        const completed = Number(w.completed || 0);
                        const adherence = ready > 0 ? completed / ready : 0;

                        const label = w.label || `Semana ${formatBRShort(w.week_start)} – ${formatBRShort(w.week_end)}`;

                        return (
                          <tr key={w.week_id} className="border-b border-white/5 hover:bg-white/5">
                            <td className="py-3 pr-3">
                              <div className="font-semibold">{label}</div>
                              <div className="text-xs text-white/50">{formatBRShort(w.week_start)} – {formatBRShort(w.week_end)}</div>
                            </td>
                            <td className="py-3 text-right">{ready}</td>
                            <td className="py-3 text-right">{completed}</td>
                            <td className="py-3 text-right">{Number(w.canceled || 0)}</td>
                            <td className="py-3 text-right">{percentLabel(adherence)}</td>
                            <td className="py-3 text-right">{kmLabel(w.planned_km)}</td>
                            <td className="py-3 text-right">{kmLabel(w.actual_km)}</td>
                            <td className="py-3 text-right">
                              {w.avg_rpe == null ? '—' : String(Math.round(Number(w.avg_rpe) * 10) / 10).replace('.', ',')}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="text-xs text-white/50">
                Dica: para usar isto como link rápido no painel do aluno, você pode adicionar um botão em <code>/students/[id]</code> apontando para{' '}
                <code>/students/{studentId}/reports/4w</code>.
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
