'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@/lib/supabaseBrowser';
import { Topbar } from '@/components/Topbar';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';

type StudentRow = {
  id: string;
  trainer_id: string;
  name: string;
  email: string | null;
  p1k_sec_per_km: number;
  created_at: string;
  updated_at: string;
};

type WorkoutRow = {
  id: string;
  student_id: string;
  trainer_id: string;
  status: string;
  template_type: string;
  total_km: number | null;
  share_slug: string;
  created_at: string;
  updated_at: string;
};

function formatPace(seconds?: number | null): string {
  if (seconds == null) return '--:--';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  } catch {
    return iso;
  }
}

function workoutTitle(w: WorkoutRow): string {
  // sem coluna "title" no schema — então usa o template_type como título
  // se quiser, depois a gente gera um título melhor via template_params/blocks
  const t = (w.template_type || '').trim();
  if (!t) return 'Treino';
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export default function StudentDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = Array.isArray((params as any)?.id) ? (params as any).id[0] : (params as any)?.id;

  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [student, setStudent] = useState<StudentRow | null>(null);
  const [workouts, setWorkouts] = useState<WorkoutRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);

      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr) {
        setError(userErr.message);
        setLoading(false);
        return;
      }
      if (!userData.user) {
        router.replace('/login');
        return;
      }

      const { data: s, error: sErr } = await supabase
        .from('students')
        .select('id, trainer_id, name, email, p1k_sec_per_km, created_at, updated_at')
        .eq('id', id)
        .single();

      if (sErr) {
        setError(sErr.message);
        setLoading(false);
        return;
      }

      setStudent(s as StudentRow);

      const { data: w, error: wErr } = await supabase
        .from('workouts')
        .select('id, student_id, trainer_id, status, template_type, total_km, share_slug, created_at, updated_at')
        .eq('student_id', id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (wErr) {
        setError(wErr.message);
        setLoading(false);
        return;
      }

      setWorkouts((w as WorkoutRow[]) || []);
      setLoading(false);
    };

    if (id) load();
  }, [id, router, supabase]);

  return (
    <div className="flex-1 flex flex-col bg-background-light dark:bg-background-dark">
      <Topbar title="Perfil do Aluno" showBack />

      <main className="flex-1 overflow-y-auto no-scrollbar pb-28">
        <div className="px-5 pt-6">
          {error && (
            <div className="rounded-xl bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-600 dark:text-red-300 mb-4">
              {error}
            </div>
          )}

          {loading || !student ? (
            <Card className="p-4">Carregando...</Card>
          ) : (
            <>
              <div className="flex flex-col items-center text-center mt-2">
                <div className="w-24 h-24 rounded-full bg-surface-dark border border-white/10 flex items-center justify-center shadow-xl">
                  <span className="text-3xl font-black text-primary">
                    {student.name?.trim()?.charAt(0)?.toUpperCase() || 'A'}
                  </span>
                </div>

                <h1 className="text-2xl font-bold mt-4">{student.name}</h1>
                {student.email ? (
                  <div className="text-sm text-slate-400 mt-1">{student.email}</div>
                ) : (
                  <div className="text-sm text-slate-500 mt-1">Sem email</div>
                )}

                <div className="flex gap-4 mt-6 w-full max-w-sm">
                  <Card className="flex-1 flex flex-col items-center py-3">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                      P1k Pace
                    </span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-black text-primary">
                        {formatPace(student.p1k_sec_per_km)}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400">min/km</span>
                    </div>
                  </Card>

                  <Card className="flex-1 flex flex-col items-center py-3">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                      Desde
                    </span>
                    <span className="text-2xl font-black text-white">{formatDate(student.created_at)}</span>
                  </Card>
                </div>
              </div>

              <div className="mt-8">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold">Treinos Recentes</h3>
                </div>

                {workouts.length === 0 ? (
                  <Card className="p-5 text-sm text-slate-500">Ainda não há treinos para este aluno.</Card>
                ) : (
                  <div className="space-y-4">
                    {workouts.map((w) => (
                      <Card
                        key={w.id}
                        className="flex flex-col gap-3 group cursor-pointer"
                        onClick={() => router.push(`/workouts/${w.id}/edit`)}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                              <span className="material-symbols-outlined">directions_run</span>
                            </div>
                            <div>
                              <h4 className="text-base font-bold leading-tight">{workoutTitle(w)}</h4>
                              <p className="text-[10px] text-slate-500 mt-0.5">
                                {formatDate(w.created_at)}
                                {w.total_km != null ? ` • ${w.total_km}km Total` : ''}
                              </p>
                            </div>
                          </div>

                          <span className="px-2.5 py-1 rounded-full bg-primary text-black text-[10px] font-bold uppercase tracking-wider">
                            {w.status}
                          </span>
                        </div>

                        <div className="bg-slate-50 dark:bg-black/20 rounded-xl p-3 flex justify-between items-center text-xs">
                          <div className="flex items-center gap-1 text-slate-500">
                            <span className="material-symbols-outlined text-sm">link</span>
                            <span>Link do aluno</span>
                          </div>
                          <div className="font-bold text-primary truncate max-w-[180px]">
                            /w/{w.share_slug}
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-background-light dark:from-background-dark via-background-light/95 to-transparent">
        <div className="max-w-md mx-auto">
          <Button onClick={() => router.push(`/students/${id}/workouts/new`)} icon="add">
            Criar novo treino
          </Button>
        </div>
      </div>
    </div>
  );
}
