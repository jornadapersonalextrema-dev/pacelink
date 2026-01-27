'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabaseBrowser';
import { Topbar } from '@/components/Topbar';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';

type WorkoutUIType = 'rodagem' | 'progressivo' | 'alternado';
type Intensity = 'leve' | 'moderado' | 'forte';
type BlockIntensity = Intensity | 'livre';

type Student = {
  id: string;
  name: string;
  email?: string | null;
  p1k_sec_per_km?: number | null;
};

type ProgressivePhase = {
  id: string;
  distanceKm: number;
  intensity: Intensity;
};

type WorkoutBlock = {
  index: number;
  segment_type: 'warmup' | 'main' | 'cooldown';
  label: string;
  distance_km: number;
  intensity: BlockIntensity;
  pace_min_sec_per_km?: number | null;
  pace_max_sec_per_km?: number | null;
  hint_text?: string | null;
};

function clampNumber(n: number, min: number, max: number) {
  if (Number.isNaN(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function fmtDateBR(d: Date) {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}`;
}

function fmtPace(secPerKm: number) {
  const s = Math.max(0, Math.round(secPerKm));
  const m = Math.floor(s / 60);
  const sec = String(s % 60).padStart(2, '0');
  return `${m}:${sec}`;
}

function paceRangeFromP1K(p1kSec: number, intensity: Intensity) {
  // Regras do MVP (offsets em relação ao P1K)
  // Leve: +90 a +150s
  // Moderado: +45 a +90s
  // Forte: +15 a +45s
  const rules: Record<Intensity, [number, number]> = {
    leve: [90, 150],
    moderado: [45, 90],
    forte: [15, 45],
  };
  const [minOff, maxOff] = rules[intensity];
  return {
    min: p1kSec + minOff,
    max: p1kSec + maxOff,
  };
}

function randomId() {
  return Math.random().toString(36).slice(2, 10);
}

function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
    .slice(0, 60);
}

function generateShareSlug(title: string) {
  const base = slugify(title || 'treino');
  const tail = Math.random().toString(36).slice(2, 6);
  return `${base}-${tail}`;
}

export default function NewWorkoutPage() {
  const router = useRouter();
  const params = useParams() as { id?: string };
  const studentId = params?.id || '';
  const supabase = useMemo(() => createClient(), []);

  const [student, setStudent] = useState<Student | null>(null);

  const [workoutType, setWorkoutType] = useState<WorkoutUIType>('rodagem');

  const [warmupEnabled, setWarmupEnabled] = useState(true);
  const [warmupKm, setWarmupKm] = useState(2);

  const [cooldownEnabled, setCooldownEnabled] = useState(false);
  const [cooldownKm, setCooldownKm] = useState(1);

  // Rodagem
  const [rodagemDistanceKm, setRodagemDistanceKm] = useState(5);
  const [rodagemIntensity, setRodagemIntensity] = useState<Intensity>('moderado');

  // Progressivo (fases)
  const [phases, setPhases] = useState<ProgressivePhase[]>([
    { id: randomId(), distanceKm: 5, intensity: 'moderado' },
  ]);

  // Alternado
  const [altRepeats, setAltRepeats] = useState(6);
  const [altStrongKm, setAltStrongKm] = useState(0.2);
  const [altEasyKm, setAltEasyKm] = useState(0.2);

  const [workoutId, setWorkoutId] = useState<string | null>(null);
  const [shareSlug, setShareSlug] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    async function load() {
      setError(null);
      if (!studentId) return;

      const { data, error: dbErr } = await supabase
        .from('students')
        .select('id,name,email,p1k_sec_per_km')
        .eq('id', studentId)
        .single();

      if (!alive) return;

      if (dbErr) {
        setError(dbErr.message);
        return;
      }

      setStudent(data as Student);
    }

    load();
    return () => {
      alive = false;
    };
  }, [studentId, supabase]);

  useEffect(() => {
    if (workoutType === 'progressivo' && phases.length === 0) {
      setPhases([{ id: randomId(), distanceKm: 5, intensity: 'moderado' }]);
    }
  }, [workoutType, phases.length]);

  const p1kSec = student?.p1k_sec_per_km ?? null;

  const computed = useMemo(() => {
    const blocks: WorkoutBlock[] = [];
    const now = new Date();

    const addBlock = (b: Omit<WorkoutBlock, 'index'>) => {
      blocks.push({ ...b, index: blocks.length });
    };

    if (warmupEnabled) {
      addBlock({
        segment_type: 'warmup',
        label: 'Aquecimento',
        distance_km: clampNumber(warmupKm, 0.1, 50),
        intensity: 'livre',
        hint_text: 'Ritmo confortável para preparar o corpo.',
      });
    }

    let template_type: 'easy_run' | 'progressive' | 'alternated' = 'easy_run';
    let template_params: any = {};

    if (workoutType === 'rodagem') {
      template_type = 'easy_run';
      template_params = {
        main_distance_km: clampNumber(rodagemDistanceKm, 0.1, 200),
        intensity: rodagemIntensity,
      };

      const range = p1kSec ? paceRangeFromP1K(p1kSec, rodagemIntensity) : null;
      addBlock({
        segment_type: 'main',
        label: 'Trecho principal',
        distance_km: clampNumber(rodagemDistanceKm, 0.1, 200),
        intensity: rodagemIntensity,
        pace_min_sec_per_km: range?.min ?? null,
        pace_max_sec_per_km: range?.max ?? null,
        hint_text:
          rodagemIntensity === 'leve'
            ? 'Leve e constante. Foque em respirar e manter técnica.'
            : 'Moderado e constante. Sustente sem “quebrar”.',
      });
    }

    if (workoutType === 'progressivo') {
      template_type = 'progressive';
      template_params = {
        phases: phases.map((p, idx) => ({
          order: idx + 1,
          distance_km: clampNumber(p.distanceKm, 0.1, 200),
          intensity: p.intensity,
        })),
      };

      phases.forEach((p, idx) => {
        const range = p1kSec ? paceRangeFromP1K(p1kSec, p.intensity) : null;
        addBlock({
          segment_type: 'main',
          label: `Bloco ${idx + 1}`,
          distance_km: clampNumber(p.distanceKm, 0.1, 200),
          intensity: p.intensity,
          pace_min_sec_per_km: range?.min ?? null,
          pace_max_sec_per_km: range?.max ?? null,
          hint_text:
            p.intensity === 'leve'
              ? 'Comece controlado, foco em eficiência.'
              : p.intensity === 'moderado'
                ? 'Aumente gradualmente mantendo controle.'
                : 'Feche forte sem perder a técnica.',
        });
      });
    }

    if (workoutType === 'alternado') {
      template_type = 'alternated';
      template_params = {
        repeats: clampNumber(altRepeats, 1, 60),
        strong_distance_km: clampNumber(altStrongKm, 0.05, 10),
        easy_distance_km: clampNumber(altEasyKm, 0.05, 10),
      };

      const repeats = clampNumber(altRepeats, 1, 60);
      for (let i = 1; i <= repeats; i++) {
        const strongRange = p1kSec ? paceRangeFromP1K(p1kSec, 'forte') : null;
        addBlock({
          segment_type: 'main',
          label: `Tiro ${i}`,
          distance_km: clampNumber(altStrongKm, 0.05, 10),
          intensity: 'forte',
          pace_min_sec_per_km: strongRange?.min ?? null,
          pace_max_sec_per_km: strongRange?.max ?? null,
          hint_text: 'Forte. Foque em postura e cadência.',
        });

        addBlock({
          segment_type: 'main',
          label: `Recuperação ${i}`,
          distance_km: clampNumber(altEasyKm, 0.05, 10),
          intensity: 'leve',
          pace_min_sec_per_km: null,
          pace_max_sec_per_km: null,
          hint_text: 'Solte e recupere. Respiração e técnica.',
        });
      }
    }

    if (cooldownEnabled) {
      addBlock({
        segment_type: 'cooldown',
        label: 'Desaquecimento',
        distance_km: clampNumber(cooldownKm, 0.1, 50),
        intensity: 'livre',
        hint_text: 'Reduza o ritmo gradualmente para recuperar.',
      });
    }

    const total_km = blocks.reduce((sum, b) => sum + (Number(b.distance_km) || 0), 0);

    const title =
      workoutType === 'rodagem'
        ? 'Rodagem'
        : workoutType === 'progressivo'
          ? 'Progressivo'
          : 'Alternado';

    const share_title = `${title} • ${fmtDateBR(now)}`;

    return {
      blocks,
      total_km: Math.round(total_km * 10) / 10,
      template_type,
      template_params,
      share_title,
    };
  }, [
    warmupEnabled,
    warmupKm,
    cooldownEnabled,
    cooldownKm,
    workoutType,
    rodagemDistanceKm,
    rodagemIntensity,
    phases,
    altRepeats,
    altStrongKm,
    altEasyKm,
    p1kSec,
  ]);

  async function ensureAuth() {
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      router.push('/login');
      throw new Error('Sessão expirada. Faça login novamente.');
    }
    return data.user;
  }

  async function upsertWorkout(status: 'draft' | 'ready') {
    setBusy(true);
    setError(null);

    try {
      const user = await ensureAuth();

      const shouldHaveShare = status === 'ready';
      const nextShareSlug =
        shouldHaveShare ? shareSlug || generateShareSlug(computed.share_title) : null;

      const payload: any = {
        trainer_id: user.id,
        student_id: studentId,
        status,
        template_type: computed.template_type,
        include_warmup: warmupEnabled,
        warmup_km: warmupEnabled ? warmupKm : null,
        include_cooldown: cooldownEnabled,
        cooldown_km: cooldownEnabled ? cooldownKm : null,
        template_params: computed.template_params,
        blocks: computed.blocks,
        total_km: computed.total_km,
        share_slug: nextShareSlug,
      };

      let saved: { id: string; share_slug: string | null } | null = null;

      if (!workoutId) {
        const { data, error: dbErr } = await supabase
          .from('workouts')
          .insert(payload)
          .select('id,share_slug')
          .single();

        if (dbErr) throw dbErr;
        saved = data as any;
        setWorkoutId(saved.id);
      } else {
        const { data, error: dbErr } = await supabase
          .from('workouts')
          .update(payload)
          .eq('id', workoutId)
          .select('id,share_slug')
          .single();

        if (dbErr) throw dbErr;
        saved = data as any;
      }

      setShareSlug(saved?.share_slug ?? nextShareSlug);

      return saved?.share_slug ?? nextShareSlug;
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveDraft() {
    try {
      await upsertWorkout('draft');
      alert('Rascunho salvo com sucesso.');
    } catch (e: any) {
      setError(e?.message || 'Erro ao salvar rascunho.');
    }
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

  async function handleShare() {
    try {
      const slug = await upsertWorkout('ready');
      if (!slug) throw new Error('Não foi possível gerar o link compartilhável.');

      const url = `${window.location.origin}/w/${slug}`;
      const msg =
        `Treino do dia (${fmtDateBR(new Date())})\n` +
        `Aluno: ${student?.name || '—'}\n\n` +
        `Abra o link e toque em “Iniciar execução”:\n${url}\n\n` +
        `Qualquer dúvida, me chama.`;

      await copyOrShare(msg, url);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (e: any) {
      setError(e?.message || 'Erro ao compartilhar treino.');
    }
  }

  const typeButtonClass = (active: boolean) =>
    `px-4 py-2 rounded-full text-sm font-semibold transition ${
      active ? 'bg-primary text-slate-900' : 'bg-surface-dark text-slate-200 hover:bg-surface-dark/80'
    }`;

  const pillClass = (active: boolean) =>
    `flex-1 py-2 rounded-full text-sm font-semibold transition ${
      active ? 'bg-primary text-slate-900' : 'bg-surface-dark text-slate-300 hover:bg-surface-dark/80'
    }`;

  const intensityPill = (active: boolean) =>
    `flex-1 py-2 rounded-full text-sm font-semibold transition ${
      active ? 'bg-primary text-slate-900' : 'bg-surface-dark text-slate-300 hover:bg-surface-dark/80'
    }`;

  return (
    <>
      <Topbar title="Criar Treino" backHref={`/students/${studentId}`} />
      <main className="flex-1 flex flex-col p-6 gap-5">
        {error && (
          <div className="rounded-lg bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        <section>
          <h2 className="text-lg font-semibold mb-3">Tipo de Treino</h2>
          <div className="flex gap-2">
            <button
              type="button"
              className={typeButtonClass(workoutType === 'rodagem')}
              onClick={() => setWorkoutType('rodagem')}
            >
              <span className="material-symbols-outlined align-middle mr-2">directions_run</span>
              Rodagem
            </button>
            <button
              type="button"
              className={typeButtonClass(workoutType === 'progressivo')}
              onClick={() => setWorkoutType('progressivo')}
            >
              Progressivo
            </button>
            <button
              type="button"
              className={typeButtonClass(workoutType === 'alternado')}
              onClick={() => setWorkoutType('alternado')}
            >
              Alternado
            </button>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">Estrutura</h2>

          <Card>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">local_fire_department</span>
                <span className="font-semibold">Aquecimento</span>
              </div>

              <button
                type="button"
                onClick={() => setWarmupEnabled((v) => !v)}
                className={`w-14 h-8 rounded-full p-1 transition ${
                  warmupEnabled ? 'bg-primary/90' : 'bg-surface-dark'
                }`}
                aria-label="Ativar aquecimento"
              >
                <span
                  className={`block w-6 h-6 rounded-full bg-white transition ${
                    warmupEnabled ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {warmupEnabled && (
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-surface-dark/60 p-3">
                  <div className="text-xs uppercase tracking-wide text-slate-400">Distância</div>
                  <div className="mt-1 flex items-baseline gap-2">
                    <input
                      type="number"
                      step="0.1"
                      value={warmupKm}
                      onChange={(e) => setWarmupKm(Number(e.target.value))}
                      className="w-20 bg-transparent text-2xl font-bold outline-none"
                    />
                    <span className="text-slate-400">km</span>
                  </div>
                </div>

                <div className="rounded-xl bg-surface-dark/60 p-3">
                  <div className="text-xs uppercase tracking-wide text-slate-400">Ritmo</div>
                  <div className="mt-2 text-lg font-semibold">Livre</div>
                </div>
              </div>
            )}
          </Card>

          <div className="mt-5">
            <div className="text-xs uppercase tracking-wide text-slate-400 mb-2">
              Blocos principais
            </div>

            {workoutType === 'rodagem' && (
              <Card>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-surface-dark/60 p-3">
                    <div className="text-xs uppercase tracking-wide text-slate-400">
                      Distância do trecho
                    </div>
                    <div className="mt-1 flex items-baseline gap-2">
                      <input
                        type="number"
                        step="0.1"
                        value={rodagemDistanceKm}
                        onChange={(e) => setRodagemDistanceKm(Number(e.target.value))}
                        className="w-24 bg-transparent text-2xl font-bold outline-none"
                      />
                      <span className="text-slate-400">km</span>
                    </div>
                  </div>

                  <div className="rounded-xl bg-surface-dark/60 p-3">
                    <div className="text-xs uppercase tracking-wide text-slate-400">Intensidade</div>
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        className={intensityPill(rodagemIntensity === 'leve')}
                        onClick={() => setRodagemIntensity('leve')}
                      >
                        Leve
                      </button>
                      <button
                        type="button"
                        className={intensityPill(rodagemIntensity === 'moderado')}
                        onClick={() => setRodagemIntensity('moderado')}
                      >
                        Moderado
                      </button>
                    </div>
                  </div>
                </div>

                {p1kSec && (
                  <div className="mt-3 text-sm text-slate-300">
                    Alvo estimado (base P1K):{' '}
                    <span className="font-semibold text-primary">
                      {fmtPace(paceRangeFromP1K(p1kSec, rodagemIntensity).min)}–
                      {fmtPace(paceRangeFromP1K(p1kSec, rodagemIntensity).max)} min/km
                    </span>
                  </div>
                )}
              </Card>
            )}

            {workoutType === 'progressivo' && (
              <>
                {phases.map((p, idx) => (
                  <Card key={p.id} className="mb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 grid grid-cols-2 gap-3">
                        <div className="rounded-xl bg-surface-dark/60 p-3">
                          <div className="text-xs uppercase tracking-wide text-slate-400">
                            Distância (Bloco {idx + 1})
                          </div>
                          <div className="mt-1 flex items-baseline gap-2">
                            <input
                              type="number"
                              step="0.1"
                              value={p.distanceKm}
                              onChange={(e) => {
                                const v = Number(e.target.value);
                                setPhases((cur) =>
                                  cur.map((x) => (x.id === p.id ? { ...x, distanceKm: v } : x))
                                );
                              }}
                              className="w-24 bg-transparent text-2xl font-bold outline-none"
                            />
                            <span className="text-slate-400">km</span>
                          </div>
                        </div>

                        <div className="rounded-xl bg-surface-dark/60 p-3">
                          <div className="text-xs uppercase tracking-wide text-slate-400">
                            Intensidade
                          </div>
                          <div className="mt-2 flex gap-2">
                            <button
                              type="button"
                              className={pillClass(p.intensity === 'leve')}
                              onClick={() =>
                                setPhases((cur) =>
                                  cur.map((x) => (x.id === p.id ? { ...x, intensity: 'leve' } : x))
                                )
                              }
                            >
                              Leve
                            </button>
                            <button
                              type="button"
                              className={pillClass(p.intensity === 'moderado')}
                              onClick={() =>
                                setPhases((cur) =>
                                  cur.map((x) =>
                                    x.id === p.id ? { ...x, intensity: 'moderado' } : x
                                  )
                                )
                              }
                            >
                              Moderado
                            </button>
                            <button
                              type="button"
                              className={pillClass(p.intensity === 'forte')}
                              onClick={() =>
                                setPhases((cur) =>
                                  cur.map((x) => (x.id === p.id ? { ...x, intensity: 'forte' } : x))
                                )
                              }
                            >
                              Forte
                            </button>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        title="Remover bloco"
                        onClick={() => {
                          setPhases((cur) => (cur.length <= 1 ? cur : cur.filter((x) => x.id !== p.id)));
                        }}
                        className="mt-2 text-slate-300 hover:text-red-300 transition"
                      >
                        <span className="material-symbols-outlined">delete</span>
                      </button>
                    </div>

                    {p1kSec && (
                      <div className="mt-3 text-sm text-slate-300">
                        Alvo estimado:{' '}
                        <span className="font-semibold text-primary">
                          {fmtPace(paceRangeFromP1K(p1kSec, p.intensity).min)}–
                          {fmtPace(paceRangeFromP1K(p1kSec, p.intensity).max)} min/km
                        </span>
                      </div>
                    )}
                  </Card>
                ))}

                <button
                  type="button"
                  className="w-full border border-dashed border-slate-600 rounded-2xl py-4 text-slate-200 hover:border-slate-500 hover:bg-surface-dark/30 transition"
                  onClick={() =>
                    setPhases((cur) => [
                      ...cur,
                      { id: randomId(), distanceKm: 1, intensity: 'moderado' },
                    ])
                  }
                >
                  <span className="material-symbols-outlined align-middle mr-2">add</span>
                  Adicionar Bloco
                </button>
              </>
            )}

            {workoutType === 'alternado' && (
              <Card>
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-xl bg-surface-dark/60 p-3">
                    <div className="text-xs uppercase tracking-wide text-slate-400">Repetições</div>
                    <div className="mt-1 flex items-baseline gap-2">
                      <input
                        type="number"
                        step="1"
                        value={altRepeats}
                        onChange={(e) => setAltRepeats(Number(e.target.value))}
                        className="w-20 bg-transparent text-2xl font-bold outline-none"
                      />
                      <span className="text-slate-400">x</span>
                    </div>
                  </div>

                  <div className="rounded-xl bg-surface-dark/60 p-3">
                    <div className="text-xs uppercase tracking-wide text-slate-400">Tiro (Forte)</div>
                    <div className="mt-1 flex items-baseline gap-2">
                      <input
                        type="number"
                        step="0.05"
                        value={altStrongKm}
                        onChange={(e) => setAltStrongKm(Number(e.target.value))}
                        className="w-20 bg-transparent text-2xl font-bold outline-none"
                      />
                      <span className="text-slate-400">km</span>
                    </div>
                  </div>

                  <div className="rounded-xl bg-surface-dark/60 p-3">
                    <div className="text-xs uppercase tracking-wide text-slate-400">
                      Recuperação (Leve)
                    </div>
                    <div className="mt-1 flex items-baseline gap-2">
                      <input
                        type="number"
                        step="0.05"
                        value={altEasyKm}
                        onChange={(e) => setAltEasyKm(Number(e.target.value))}
                        className="w-20 bg-transparent text-2xl font-bold outline-none"
                      />
                      <span className="text-slate-400">km</span>
                    </div>
                  </div>
                </div>
              </Card>
            )}
          </div>

          <div className="mt-5">
            <Card>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">ac_unit</span>
                  <span className="font-semibold">Desaquecimento</span>
                </div>

                <button
                  type="button"
                  onClick={() => setCooldownEnabled((v) => !v)}
                  className={`w-14 h-8 rounded-full p-1 transition ${
                    cooldownEnabled ? 'bg-primary/90' : 'bg-surface-dark'
                  }`}
                  aria-label="Ativar desaquecimento"
                >
                  <span
                    className={`block w-6 h-6 rounded-full bg-white transition ${
                      cooldownEnabled ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {cooldownEnabled && (
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-surface-dark/60 p-3">
                    <div className="text-xs uppercase tracking-wide text-slate-400">Distância</div>
                    <div className="mt-1 flex items-baseline gap-2">
                      <input
                        type="number"
                        step="0.1"
                        value={cooldownKm}
                        onChange={(e) => setCooldownKm(Number(e.target.value))}
                        className="w-20 bg-transparent text-2xl font-bold outline-none"
                      />
                      <span className="text-slate-400">km</span>
                    </div>
                  </div>

                  <div className="rounded-xl bg-surface-dark/60 p-3">
                    <div className="text-xs uppercase tracking-wide text-slate-400">Ritmo</div>
                    <div className="mt-2 text-lg font-semibold">Livre</div>
                  </div>
                </div>
              )}
            </Card>
          </div>

          <div className="mt-5 text-sm text-slate-300">
            Distância total estimada:{' '}
            <span className="font-semibold text-primary">{computed.total_km} km</span>
          </div>
        </section>

        <div className="mt-auto flex gap-3 pt-3">
          <Button variant="secondary" fullWidth onClick={handleSaveDraft} disabled={busy}>
            {busy ? 'Salvando...' : 'Salvar rascunho'}
          </Button>
          <Button fullWidth onClick={handleShare} disabled={busy}>
            <span className="material-symbols-outlined align-middle mr-2">share</span>
            Compartilhar
          </Button>
        </div>
      </main>
    </>
  );
}
