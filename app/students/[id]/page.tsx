'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '../../../lib/supabaseBrowser';

type DbWorkoutStatus = 'draft' | 'ready' | 'archived';
type DbTemplateType = 'easy_run' | 'progressive' | 'alternated';

type Student = {
  id: string;
  trainer_id: string;
  name: string;
  email: string | null;
  p1k_sec_per_km: number | null;
  created_at?: string;
};

type WorkoutRow = {
  id: string;
  status: DbWorkoutStatus;
  template_type: DbTemplateType;
  title: string | null;
  total_km: number | string | null;
  created_at: string;
  share_slug: string | null;
};

function formatDateBR(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  } catch {
    return '';
  }
}

function templateLabel(t: DbTemplateType): string {
  switch (t) {
    case 'easy_run':
      return 'Rodagem';
    case 'progressive':
      return 'Progressivo';
    case 'alternated':
      return 'Alternado';
    default:
      return 'Treino';
  }
}

function statusLabel(s: DbWorkoutStatus): string {
  switch (s) {
    case 'draft':
      return 'Rascunho';
    case 'ready':
      return 'Pronto';
    case 'archived':
      return 'Arquivado';
    default:
      return s;
  }
}

function formatPace(secPerKm: number | null) {
  if (!secPerKm || !Number.isFinite(secPerKm)) return '—';
  const total = Math.max(0, Math.floor(secPerKm));
  const mm = Math.floor(total / 60);
  const ss = total % 60;
  return `${mm}:${ss.toString().padStart(2, '0')}`;
}

function toNumber(v: unknown, fallback: number) {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

export default function StudentProfilePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const studentId = params?.id;

  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<string | null>(null);

  const [student, setStudent] = useState<Student | null>(null);
  const [workouts, setWorkouts] = useState<WorkoutRow[]>([]);

  const sinceLabel = useMemo(() => {
    if (!student?.created_at) return '';
    return formatDateBR(student.created_at);
  }, [student?.created_at]);

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      setBanner(null);

      try {
        const supabase = createClient();

        const { data: st, error: stErr } = await supabase
          .from('students')
          .select('id, trainer_id, name, email, p1k_sec_per_km, created_at')
          .eq('id', studentId)
          .maybeSingle();

        if (!alive) return;

        if (stErr) throw stErr;
        if (!st) {
          setBanner('Aluno não encontrado (ou sem permissão).');
          setLoading(false);
          return;
        }

        setStudent(st as Student);

        const { data: ws, error: wsErr } = await supabase
          .from('workouts')
          .select('id, status, template_type, title, total_km, created_at, share_slug')
          .eq('student_id', studentId)
          .order('created_at', { ascending: false })
          .limit(20);

        if (!alive) return;

        if (wsErr) throw wsErr;
        setWorkouts((ws ?? []) as WorkoutRow[]);
      } catch (e: any) {
        setBanner(e?.message ? `Erro ao carregar: ${e.message}` : 'Erro ao carregar.');
      } finally {
        if (alive) setLoading(false);
      }
    }

    if (studentId) load();
    return () => {
      alive = false;
    };
  }, [studentId]);

  async function copyStudentLink(workoutId: string) {
    setBanner(null);
    try {
      const supabase = createClient();

      // Para gerar share_slug, o trigger roda ao atualizar status.
      // Status permitido: draft | ready | archived
      const { data, error } = await supabase
        .from('workouts')
        .update({ status: 'ready' })
        .eq('id', workoutId)
        .select('id, share_slug, status')
        .single();

      if (error) throw error;

      const slug = data?.share_slug;
      if (!slug) {
        setBanner('Não foi possível gerar o link do aluno (share_slug vazio).');
        return;
      }

      const url = `${window.location.origin}/w/${slug}`;

      // atualiza lista local com share_slug/status
      setWorkouts((prev) =>
        prev.map((w) => (w.id === workoutId ? { ...w, share_slug: slug, status: 'ready' } : w))
      );

      try {
        await navigator.clipboard.writeText(url);
        setBanner('Link do aluno copiado.');
      } catch {
        window.prompt('Copie o link abaixo:', url);
        setBanner('Link gerado. Copie manualmente.');
      }
    } catch (e: any) {
      setBanner(e?.message ? `Erro ao gerar link: ${e.message}` : 'Erro ao gerar link.');
    }
  }

  function openStudentView(shareSlug: string | null) {
    if (!shareSlug) return;
    const url = `${window.location.origin}/w/${shareSlug}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  return (
    <div className="min-h-screen bg-[#0b1d16] text-white">
      {/* Topbar local */}
      <div className="sticky top-0 z-10 bg-[#d7dbd9] text-[#0b1d16]">
        <div className="mx-auto flex max-w-[820px] items-center gap-3 px-4 py-3">
          <button
            onClick={() => router.back()}
            className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-black/10"
            aria-label="Voltar"
            title="Voltar"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div className="flex-1 text-center text-lg font-semibold">Perfil do Aluno</div>
          <div className="h-10 w-10" />
        </div>
      </div>

      <div className="mx-auto max-w-[820px] px-4 pb-24 pt-6">
        {banner ? (
          <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-100">{banner}</div>
        ) : null}

        {loading ? (
          <div className="opacity-80">Carregando...</div>
        ) : !student ? (
          <div className="opacity-80">Nada para exibir.</div>
        ) : (
          <>
            {/* Cabeçalho aluno */}
            <div className="flex flex-col items-center gap-4">
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-white/5 text-4xl font-bold ring-1 ring-white/10">
                {student.name?.trim()?.[0]?.toUpperCase() ?? 'A'}
              </div>
              <div className="text-center">
                <div className="text-3xl font-extrabold">{student.name}</div>
                <div className="mt-1 text-white/50">{student.email ? student.email : 'Sem email'}</div>
              </div>
            </div>

            {/* Cards resumo */}
            <div className="mt-6 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
                <div className="text-xs tracking-widest text-white/60">RITMO P1K</div>
                <div className="mt-2 text-3xl font-extrabold text-[#2CEB79]">
                  {formatPace(student.p1k_sec_per_km)} <span className="text-sm font-semibold text-white/60">min/km</span>
                </div>
              </div>

              <div className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
                <div className="text-xs tracking-widest text-white/60">DESDE</div>
                <div className="mt-2 text-3xl font-extrabold">{sinceLabel || '—'}</div>
              </div>
            </div>

            {/* Treinos recentes */}
            <div className="mt-8">
              <div className="text-2xl font-bold">Treinos Recentes</div>

              <div className="mt-4 space-y-3">
                {workouts.length === 0 ? (
                  <div className="rounded-2xl bg-white/5 p-4 text-white/60 ring-1 ring-white/10">
                    Ainda não há treinos para este aluno.
                  </div>
                ) : (
                  workouts.map((w) => {
                    const typePt = templateLabel(w.template_type);
                    const statusPt = statusLabel(w.status);
                    const km = toNumber(w.total_km, 0);
                    const date = formatDateBR(w.created_at);
                    const displayTitle = w.title?.trim() ? w.title!.trim() : typePt;

                    return (
                      <div key={w.id} className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-lg font-bold">{displayTitle}</div>
                            <div className="mt-1 text-sm text-white/60">
                              {date} • {km ? `${km} km` : '—'} • {typePt}
                            </div>
                          </div>

                          <div className="shrink-0 rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-white/80">
                            {statusPt}
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            onClick={() => router.push(`/workouts/${w.id}/edit`)}
                            className="rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15"
                          >
                            Editar
                          </button>

                          <button
                            onClick={() => copyStudentLink(w.id)}
                            className="rounded-xl bg-[#2CEB79] px-4 py-2 text-sm font-semibold text-[#0b1d16] hover:brightness-105"
                            title="Gerar/copiar link do aluno"
                          >
                            Link do aluno
                          </button>

                          <button
                            onClick={() => openStudentView(w.share_slug)}
                            disabled={!w.share_slug}
                            className={[
                              'rounded-xl px-4 py-2 text-sm font-semibold',
                              w.share_slug ? 'bg-white/10 text-white hover:bg-white/15' : 'bg-white/5 text-white/30 cursor-not-allowed',
                            ].join(' ')}
                            title="Abrir visão do aluno"
                          >
                            Abrir
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* CTA */}
            <div className="fixed bottom-0 left-0 right-0 bg-[#0b1d16]/90 backdrop-blur">
              <div className="mx-auto max-w-[820px] px-4 py-4">
                <button
                  onClick={() => router.push(`/students/${student.id}/workouts/new`)}
                  className="w-full rounded-full bg-[#2CEB79] px-6 py-4 text-center text-base font-bold text-[#0b1d16] hover:brightness-105"
                >
                  + Criar novo treino
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
