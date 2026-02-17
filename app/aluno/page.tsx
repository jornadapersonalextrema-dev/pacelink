'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabaseBrowser';

type StudentRow = {
  id: string;
  name: string;
  email: string | null;
  public_slug: string;
};

type WeekRow = {
  id: string;
  week_start: string;
  week_end: string | null;
  label: string | null;
};

type SummaryWorkoutRow = {
  id: string;
  title: string | null;
  template_type: string | null;
  status: string;
  total_km: number | null;
  planned_date: string | null;
  execution_label: string | null;
};

function formatBRShort(dateISO: string) {
  const [y, m, d] = dateISO.split('-');
  if (!m || !d) return dateISO;
  return `${d}/${m}`;
}

function weekdayShortPT(dateISO: string) {
  const dt = new Date(dateISO + 'T00:00:00');
  const w = dt.getDay();
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

export default function AlunoHomePage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [student, setStudent] = useState<StudentRow | null>(null);
  const [week, setWeek] = useState<WeekRow | null>(null);
  const [workouts, setWorkouts] = useState<SummaryWorkoutRow[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setMsg(null);

      try {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) {
          router.push('/aluno/login');
          return;
        }

        const { data: st, error: stErr } = await supabase
          .from('students')
          .select('id,name,email,public_slug')
          .eq('auth_user_id', userData.user.id)
          .single();

        if (stErr) throw stErr;
        setStudent(st as any);

        const { data: wk, error: wkErr } = await supabase
          .from('training_weeks')
          .select('id,week_start,week_end,label')
          .eq('student_id', st.id)
          .order('week_start', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (wkErr) throw wkErr;
        setWeek(wk as any);

        if (wk?.id) {
          const qs = new URLSearchParams({ studentId: st.id, weekId: wk.id }).toString();
          const res = await fetch(`/api/portal/summary?${qs}`, { cache: 'no-store' });
          const json = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(json?.error || `Falha ao carregar treinos (HTTP ${res.status})`);
          setWorkouts(json?.workouts ?? []);
        } else {
          setWorkouts([]);
        }
      } catch (e: any) {
        setMsg(e?.message || 'Erro ao carregar o portal.');
      } finally {
        setLoading(false);
      }
    })();
  }, [router, supabase]);

  async function onLogout() {
    await supabase.auth.signOut();
    router.push('/aluno/login');
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="opacity-80">Carregando…</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm opacity-70">Aluno</div>
          <div className="text-2xl font-extrabold leading-tight">{student?.name || '—'}</div>
          {week ? (
            <div className="mt-2 opacity-80">
              Semana: <b>{week.label || `${formatBRShort(week.week_start)} – ${week.week_end ? formatBRShort(week.week_end) : '—'}`}</b>
            </div>
          ) : (
            <div className="mt-2 opacity-80">Nenhuma semana encontrada.</div>
          )}
        </div>

        <button onClick={onLogout} className="underline opacity-80 hover:opacity-100">
          Sair
        </button>
      </div>

      {msg ? (
        <div className="mt-4 rounded-2xl bg-amber-500/20 border border-amber-400/30 px-4 py-3 text-amber-100">
          {msg}
        </div>
      ) : null}

      <div className="mt-6">
        <div className="text-xl font-extrabold">Treinos da semana</div>

        <div className="mt-4 space-y-4">
          {workouts.length === 0 ? (
            <div className="opacity-70">Nenhum treino publicado nesta semana.</div>
          ) : (
            workouts.map((w) => {
              const planned = w.planned_date ? `${weekdayShortPT(w.planned_date)}, ${formatBRShort(w.planned_date)}` : '—';
              const tpl = templateLabelPT(w.template_type);
              const km = (w.total_km ?? 0).toFixed(1).replace('.', ',');

              return (
                <div key={w.id} className="rounded-3xl bg-white/5 border border-white/10 p-4">
                  <div className="flex flex-wrap items-center gap-2 opacity-90">
                    <span className="font-semibold">{planned}</span>
                    <span className="opacity-60">•</span>
                    <span>{w.execution_label || (w.status === 'canceled' ? 'Cancelado' : w.status === 'ready' ? 'Publicado' : w.status === 'draft' ? 'Rascunho' : w.status)}</span>
                  </div>

                  <div className="mt-1 flex flex-wrap items-center gap-2 opacity-85">
                    <span>{tpl}</span>
                    <span className="opacity-60">•</span>
                    <span>
                      Total: <b>{km} km</b>
                    </span>
                  </div>

                  <div className="mt-3 text-2xl font-extrabold leading-snug break-words">
                    {w.title || 'Treino'}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-3">
                    <Link
                      href={student?.public_slug ? `/p/${student.public_slug}/workouts/${w.id}` : '#'}
                      className="rounded-2xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 px-5 py-3 font-extrabold"
                    >
                      Abrir treino
                    </Link>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
