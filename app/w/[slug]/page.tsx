'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabaseBrowser';
import { Button } from '@/components/Button';

type Intensity = 'leve' | 'moderado' | 'forte';
type BlockIntensity = Intensity | 'livre';

type WorkoutBlock = {
  index?: number;
  segment_type?: 'warmup' | 'main' | 'cooldown';
  label: string;
  distance_km: number;
  intensity: BlockIntensity;
  pace_min_sec_per_km?: number | null;
  pace_max_sec_per_km?: number | null;
  hint_text?: string | null;
};

type PublicWorkout = {
  template_type: 'easy_run' | 'progressive' | 'alternated' | string;
  total_km: number;
  blocks: WorkoutBlock[];
  updated_at?: string | null;
  version?: number | null;
};

function fmtPace(secPerKm: number) {
  const s = Math.max(0, Math.round(secPerKm));
  const m = Math.floor(s / 60);
  const sec = String(s % 60).padStart(2, '0');
  return `${m}:${sec}`;
}

function fmtDateBR(iso?: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}`;
}

function templateLabel(t: string) {
  if (t === 'easy_run') return 'Rodagem';
  if (t === 'progressive') return 'Progressivo';
  if (t === 'alternated') return 'Alternado';
  return 'Treino';
}

function intensitySummary(blocks: WorkoutBlock[]) {
  const main = blocks.filter((b) => (b.segment_type ?? 'main') === 'main');
  const hasForte = main.some((b) => b.intensity === 'forte');
  const hasModerado = main.some((b) => b.intensity === 'moderado');
  const level: Intensity = hasForte ? 'forte' : hasModerado ? 'moderado' : 'leve';

  const label = level === 'forte' ? 'ALTO' : level === 'moderado' ? 'MÉDIO' : 'BAIXO';
  const value = level === 'forte' ? 85 : level === 'moderado' ? 60 : 35;
  const description =
    level === 'forte'
      ? 'Treino de esforço alto. Mantenha a técnica e evite “explodir” cedo.'
      : level === 'moderado'
        ? 'Treino de esforço sustentado. Controle a respiração e mantenha constância.'
        : 'Treino confortável. Foque em eficiência e consistência.';

  return { level, label, value, description };
}

async function copyOrShare(text: string, url: string) {
  if (typeof navigator !== 'undefined' && (navigator as any).share) {
    try {
      await (navigator as any).share({ title: 'PaceLink', text, url });
      return;
    } catch {}
  }

  try {
    await navigator.clipboard.writeText(text);
    alert('Link copiado para a área de transferência.');
  } catch {
    prompt('Copie o link abaixo:', url);
  }
}

function calcDistanceKm(blocks: WorkoutBlock[]) {
  return Math.round(blocks.reduce((sum, b) => sum + (Number(b.distance_km) || 0), 0) * 10) / 10;
}

function estimateDurationMinutes(blocks: WorkoutBlock[]) {
  let total = 0;
  let hasAny = false;

  for (const b of blocks) {
    const km = Number(b.distance_km) || 0;
    if (!km) continue;

    const min = b.pace_min_sec_per_km ?? null;
    const max = b.pace_max_sec_per_km ?? null;

    if (min && max) {
      hasAny = true;
      const avgSec = (min + max) / 2;
      total += (avgSec * km) / 60;
    }
  }

  return hasAny ? Math.round(total) : null;
}

export default function WorkoutSlugPage() {
  const router = useRouter();
  const params = useParams() as { slug?: string };
  const slug = params?.slug || '';

  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workout, setWorkout] = useState<PublicWorkout | null>(null);

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        if (!slug) throw new Error('Link inválido.');

        // 1) tenta uma rota API (se existir)
        try {
          const r = await fetch(`/api/public/workout?slug=${encodeURIComponent(slug)}`);
          if (r.ok) {
            const json = await r.json();
            if (!alive) return;
            setWorkout(json);
            return;
          }
        } catch {}

        // 2) tenta Edge Function do Supabase (se existir)
        try {
          const { data, error: fnErr } = await supabase.functions.invoke('public-workout', {
            body: { slug },
          });
          if (!fnErr && data) {
            if (!alive) return;
            setWorkout(data as PublicWorkout);
            return;
          }
        } catch {}

        // 3) fallback: leitura direta (só funciona se RLS permitir)
        const { data, error: dbErr } = await supabase
          .from('workouts')
          .select('template_type,total_km,blocks,updated_at,version')
          .eq('share_slug', slug)
          .eq('status', 'ready')
          .single();

        if (dbErr) throw dbErr;

        if (!alive) return;

        setWorkout({
          template_type: (data as any).template_type,
          total_km: Number((data as any).total_km) || 0,
          blocks: ((data as any).blocks || []) as WorkoutBlock[],
          updated_at: (data as any).updated_at ?? null,
          version: (data as any).version ?? null,
        });
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message || 'Não foi possível carregar o treino.');
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [slug, supabase]);

  const viewModel = useMemo(() => {
    const blocks = workout?.blocks ?? [];
    const type = templateLabel(workout?.template_type || '');
    const updated = fmtDateBR(workout?.updated_at);
    const distanceKm = workout?.total_km ? Number(workout.total_km) : calcDistanceKm(blocks);
    const duration = estimateDurationMinutes(blocks);
    const intensity = intensitySummary(blocks);

    const title =
      type === 'Rodagem'
        ? 'Treino de Rodagem'
        : type === 'Progressivo'
          ? 'Treino Progressivo'
          : type === 'Alternado'
            ? 'Treino Alternado'
            : 'Treino';

    const subtitle = updated !== '—' ? `Atualizado em ${updated}` : '—';

    return { title, subtitle, distanceKm, duration, intensity, blocks, type, updated };
  }, [workout]);

  async function handleShare() {
    const url = `${window.location.origin}/w/${slug}`;
    const text =
      `Treino PaceLink\n\n` +
      `${viewModel.title}\n` +
      `Distância: ${viewModel.distanceKm} km\n` +
      `${viewModel.duration ? `Duração estimada: ${viewModel.duration} min\n` : ''}` +
      `\nLink:\n${url}`;

    await copyOrShare(text, url);
  }

  return (
    <div className="flex-1 flex flex-col bg-background-light dark:bg-background-dark">
      <header className="flex items-center justify-between px-5 pt-6 pb-2">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
          <span className="material-symbols-outlined">directions_run</span>
        </div>

        <h2 className="font-display font-semibold text-lg">PaceLink</h2>

        <button
          type="button"
          className="w-10 h-10 rounded-full bg-surface-dark/70 hover:bg-surface-dark flex items-center justify-center transition"
          onClick={handleShare}
          aria-label="Compartilhar"
          title="Compartilhar"
        >
          <span className="material-symbols-outlined text-slate-200">ios_share</span>
        </button>
      </header>

      <main className="flex-1 flex flex-col px-5 pb-8 pt-3">
        {loading && <div className="text-slate-200/80 text-sm">Carregando treino...</div>}

        {error && (
          <div className="rounded-lg bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-700 dark:text-red-300">
            {error}
            <div className="mt-2 text-xs text-red-200/80">
              Se este link deveria ser público, verifique se existe uma Edge Function “public-workout”
              ou se a RLS permite leitura por <code>share_slug</code>.
            </div>
          </div>
        )}

        {!loading && !error && workout && (
          <>
            <div className="mt-6">
              <div className="text-xs uppercase tracking-wide text-primary">{viewModel.type}</div>
              <div className="text-xs text-slate-300 mt-1">
                {viewModel.updated !== '—' ? viewModel.updated : ''}
              </div>

              <h1 className="mt-2 text-3xl font-extrabold">{viewModel.title}</h1>
              <p className="mt-1 text-sm text-slate-300">{viewModel.subtitle}</p>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-surface-dark/70 p-4">
                <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-primary">
                  <span className="material-symbols-outlined">timer</span> Duração
                </div>
                <div className="mt-2 text-3xl font-extrabold">{viewModel.duration ?? '—'}</div>
                <div className="text-sm text-slate-300">{viewModel.duration ? 'min' : ''}</div>
              </div>

              <div className="rounded-2xl bg-surface-dark/70 p-4">
                <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-primary">
                  <span className="material-symbols-outlined">pin_drop</span> Distância
                </div>
                <div className="mt-2 text-3xl font-extrabold">{viewModel.distanceKm}</div>
                <div className="text-sm text-slate-300">km</div>
              </div>
            </div>

            <div className="mt-4 rounded-2xl bg-surface-dark/70 p-4">
              <div className="flex items-center justify-between">
                <div className="font-semibold">Nível de intensidade</div>
                <div className="text-xs uppercase tracking-wide text-primary font-bold">
                  {viewModel.intensity.label}
                </div>
              </div>

              <div className="mt-3 h-2 rounded-full bg-black/30 overflow-hidden">
                <div className="h-2 bg-primary rounded-full" style={{ width: `${viewModel.intensity.value}%` }} />
              </div>

              <p className="mt-3 text-sm text-slate-300">{viewModel.intensity.description}</p>
            </div>

            <div className="mt-8">
              <h3 className="text-lg font-semibold">Estrutura do treino</h3>

              <div className="mt-3 space-y-3">
                {viewModel.blocks.map((b, idx) => {
                  const pace =
                    b.pace_min_sec_per_km && b.pace_max_sec_per_km
                      ? `${fmtPace(b.pace_min_sec_per_km)}–${fmtPace(b.pace_max_sec_per_km)} min/km`
                      : b.intensity === 'livre'
                        ? 'Ritmo livre'
                        : 'Ritmo guiado';

                  return (
                    <div key={`${idx}-${b.label}`} className="rounded-2xl bg-surface-dark/70 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold">{b.label}</div>
                          <div className="mt-1 text-sm text-slate-300">
                            {Number(b.distance_km)} km • {pace}
                          </div>
                        </div>
                        <div className="text-xs uppercase tracking-wide text-primary font-bold">
                          {b.intensity === 'livre'
                            ? 'LIVRE'
                            : b.intensity === 'forte'
                              ? 'FORTE'
                              : b.intensity === 'moderado'
                                ? 'MODERADO'
                                : 'LEVE'}
                        </div>
                      </div>

                      {b.hint_text && <div className="mt-2 text-sm text-slate-300">{b.hint_text}</div>}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-8">
              <Button fullWidth onClick={() => router.push(`/w/${slug}/run`)}>
                <span className="material-symbols-outlined align-middle mr-2">play_arrow</span>
                Iniciar execução
              </Button>

              <div className="mt-3 text-xs text-slate-400">
                Dica: mantenha a tela ligada durante a execução.
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
