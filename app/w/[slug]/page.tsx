'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Topbar } from '../../../components/Topbar';
import { createClient } from '../../../lib/supabaseBrowser';

type IntensityUI = 'leve' | 'moderado' | 'forte';

type Block = {
  distance_km: number;
  intensity: IntensityUI | string;
};

type WorkoutRow = {
  id: string;
  title: string | null;
  status: string | null;
  template_type: string | null;
  include_warmup: boolean | null;
  warmup_km: number | null;
  include_cooldown: boolean | null;
  cooldown_km: number | null;
  blocks: any;
  total_km: number | null;
  created_at: string | null;
  share_slug: string | null;
};

const WORKOUT_TYPE_LABEL: Record<string, string> = {
  rodagem: 'Rodagem',
  easy: 'Rodagem',
  easy_run: 'Rodagem',
  progressivo: 'Progressivo',
  progressive: 'Progressivo',
  alternado: 'Alternado',
  interval: 'Alternado',
};

const INTENSITY_LABEL: Record<string, string> = {
  leve: 'Leve',
  easy: 'Leve',
  moderado: 'Moderado',
  moderate: 'Moderado',
  forte: 'Forte',
  hard: 'Forte',
};

function safeBlocks(val: any): Block[] {
  if (!val) return [];
  return Array.isArray(val) ? (val as Block[]) : [];
}

function formatKm(x: number | null | undefined): string {
  if (x == null || !Number.isFinite(x)) return '—';
  return (Math.round(x * 10) / 10).toFixed(1).replace('.0', '');
}

export default function Page() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const params = useParams();
  const slug = String((params as any)?.slug ?? '');

  const [loading, setLoading] = useState(true);
  const [workout, setWorkout] = useState<WorkoutRow | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setErrorMsg(null);

      if (!slug) {
        setErrorMsg('Link inválido.');
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('workouts')
        .select(
          'id,title,status,template_type,include_warmup,warmup_km,include_cooldown,cooldown_km,blocks,total_km,created_at,share_slug'
        )
        .eq('share_slug', slug)
        .limit(1)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        setErrorMsg(error.message);
        setWorkout(null);
        setLoading(false);
        return;
      }

      if (!data) {
        setErrorMsg('Treino não encontrado (ou link expirado).');
        setWorkout(null);
        setLoading(false);
        return;
      }

      setWorkout(data as WorkoutRow);
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [supabase, slug]);

  const typeLabel =
    workout?.template_type ? (WORKOUT_TYPE_LABEL[workout.template_type] ?? workout.template_type) : 'Treino';

  const blocks = safeBlocks(workout?.blocks);

  return (
    <div className="min-h-screen bg-[#07150f] text-white">
      <Topbar title="Treino do Aluno" showBack onBack={() => router.back()} />

      <div className="max-w-2xl mx-auto p-4 space-y-4">
        {loading ? (
          <Card>Carregando…</Card>
        ) : errorMsg ? (
          <div className="rounded-xl border border-red-900/40 bg-red-950/30 p-3 text-red-200">
            {errorMsg}
          </div>
        ) : workout ? (
          <>
            <Card>
              <div className="text-xs tracking-widest text-white/60">TREINO</div>
              <div className="text-xl font-semibold">{workout.title?.trim() ? workout.title : typeLabel}</div>
              <div className="mt-1 text-sm text-white/70">Distância total: {formatKm(workout.total_km)} km</div>
            </Card>

            <Card>
              <div className="font-semibold mb-2">Estrutura</div>

              {workout.include_warmup ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3 mb-3">
                  <div className="font-semibold flex items-center gap-2">
                    <span>🔥</span> Aquecimento
                  </div>
                  <div className="text-sm text-white/80 mt-1">
                    Distância: {formatKm(workout.warmup_km)} km • Ritmo: Livre
                  </div>
                </div>
              ) : null}

              <div className="font-semibold mb-2">Blocos principais</div>

              {blocks.length ? (
                <div className="space-y-3">
                  {blocks.map((b, i) => (
                    <div key={i} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                      <div className="text-sm font-semibold mb-1">Bloco {i + 1}</div>
                      <div className="text-sm text-white/85">
                        Distância: {formatKm(Number(b.distance_km))} km • Intensidade:{' '}
                        {INTENSITY_LABEL[String(b.intensity)] ?? String(b.intensity)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-white/70">Nenhum bloco cadastrado.</div>
              )}

              {workout.include_cooldown ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3 mt-3">
                  <div className="font-semibold flex items-center gap-2">
                    <span>🧊</span> Desaquecimento
                  </div>
                  <div className="text-sm text-white/80 mt-1">
                    Distância: {formatKm(workout.cooldown_km)} km • Ritmo: Livre
                  </div>
                </div>
              ) : null}
            </Card>

            <Card>
              <Button onClick={() => router.back()} variant="secondary" className="w-full">
                Voltar
              </Button>
            </Card>
          </>
        ) : null}
      </div>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-sm">{children}</div>;
}

function Button({
  children,
  onClick,
  className = '',
  variant = 'primary',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  variant?: 'primary' | 'secondary';
}) {
  const base = 'rounded-full px-4 py-3 font-semibold transition';
  const styles =
    variant === 'primary' ? 'bg-[#2CFF88] text-black hover:opacity-90' : 'bg-white/10 text-white hover:bg-white/15';
  return (
    <button type="button" onClick={onClick} className={`${base} ${styles} ${className}`}>
      {children}
    </button>
  );
}
