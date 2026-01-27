'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabaseBrowser';
import { Topbar } from '@/components/Topbar';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';

type WorkoutType = 'rodagem' | 'progressivo' | 'alternado';
type Intensity = 'leve' | 'moderado' | 'forte';

type PaceRange = {
  min: string; // "5:30"
  max: string; // "6:10"
};

type Block = {
  id: string;
  distance_km: number;
  intensity: Intensity;
  pace_range?: PaceRange | null;
};

function uid(prefix = 'b') {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function parsePaceToSeconds(pace: string): number | null {
  const m = pace.trim().match(/^(\d+):(\d{2})$/);
  if (!m) return null;
  const mm = Number(m[1]);
  const ss = Number(m[2]);
  if (!Number.isFinite(mm) || !Number.isFinite(ss)) return null;
  if (ss < 0 || ss > 59) return null;
  return mm * 60 + ss;
}

function formatSecondsToPace(total: number): string {
  const mm = Math.floor(total / 60);
  const ss = total % 60;
  return `${mm}:${String(ss).padStart(2, '0')}`;
}

function addPace(pace: string, deltaSeconds: number): string | null {
  const base = parsePaceToSeconds(pace);
  if (base == null) return null;
  const out = base + deltaSeconds;
  if (out <= 0) return null;
  return formatSecondsToPace(out);
}

function p1kToRanges(p1k: string) {
  // Regras simples (MVP):
  // Leve: P1k + 1:30 a +2:30
  // Moderado: P1k + 0:45 a +1:30
  // Forte: P1k + 0:15 a +0:45
  const leveMin = addPace(p1k, 90);
  const leveMax = addPace(p1k, 150);
  const modMin = addPace(p1k, 45);
  const modMax = addPace(p1k, 90);
  const forteMin = addPace(p1k, 15);
  const forteMax = addPace(p1k, 45);

  const mk = (a: string | null, b: string | null): PaceRange | null => {
    if (!a || !b) return null;
    const sa = parsePaceToSeconds(a);
    const sb = parsePaceToSeconds(b);
    if (sa == null || sb == null) return null;
    const lo = Math.min(sa, sb);
    const hi = Math.max(sa, sb);
    return { min: formatSecondsToPace(lo), max: formatSecondsToPace(hi) };
  };

  return {
    leve: mk(leveMin, leveMax),
    moderado: mk(modMin, modMax),
    forte: mk(forteMin, forteMax),
  };
}

function intensityLabel(i: Intensity) {
  if (i === 'leve') return 'Leve';
  if (i === 'moderado') return 'Moderado';
  return 'Forte';
}

function workoutTypeLabel(t: WorkoutType) {
  if (t === 'rodagem') return 'Rodagem';
  if (t === 'progressivo') return 'Progressivo';
  return 'Alternado';
}

export default function NewWorkoutPage() {
  const router = useRouter();
  const params = useParams();
  const studentId = (params?.id as string) || '';
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [studentName, setStudentName] = useState<string>('');
  const [studentP1k, setStudentP1k] = useState<string>('5:00');

  const [workoutId, setWorkoutId] = useState<string | null>(null);
  const [shareSlug, setShareSlug] = useState<string | null>(null);

  const [workoutType, setWorkoutType] = useState<WorkoutType>('rodagem');
  const [title, setTitle] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  const [warmupEnabled, setWarmupEnabled] = useState(true);
  const [warmupDistance, setWarmupDistance] = useState<number>(2);
  const [cooldownEnabled, setCooldownEnabled] = useState(true);
  const [cooldownDistance, setCooldownDistance] = useState<number>(1);

  // Rodagem: 1 bloco principal
  const [easyDistance, setEasyDistance] = useState<number>(5);

  // Progressivo: lista de blocos principais
  const [progressionBlocks, setProgressionBlocks] = useState<Block[]>([
    { id: uid(), distance_km: 2, intensity: 'leve' },
    { id: uid(), distance_km: 2, intensity: 'moderado' },
    { id: uid(), distance_km: 1, intensity: 'forte' },
  ]);

  // Alternado: blocos repetidos (trabalho/recuperação)
  const [altWorkDistance, setAltWorkDistance] = useState<number>(1);
  const [altRestDistance, setAltRestDistance] = useState<number>(1);
  const [altReps, setAltReps] = useState<number>(4);

  const [defaultIntensity, setDefaultIntensity] = useState<Intensity>('leve');

  const ranges = useMemo(() => p1kToRanges(studentP1k), [studentP1k]);

  useEffect(() => {
    // Título padrão por tipo (PT-BR)
    const base =
      workoutType === 'rodagem'
        ? 'Rodagem'
        : workoutType === 'progressivo'
        ? 'Progressivo'
        : 'Alternado';

    setTitle((prev) => (prev?.trim().length ? prev : `${base}`));
    // default intensity para rodagem
    if (workoutType === 'rodagem') setDefaultIntensity('leve');
  }, [workoutType]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        // carrega aluno (nome + p1k)
        const { data: s, error: sErr } = await supabase
          .from('students')
          .select('id,name,p1k_pace')
          .eq('id', studentId)
          .single();

        if (sErr) throw sErr;

        setStudentName(s?.name ?? '');
        setStudentP1k(s?.p1k_pace ?? '5:00');
      } catch (e: any) {
        setError(e?.message || 'Erro ao carregar aluno');
      } finally {
        setLoading(false);
      }
    };

    if (studentId) load();
  }, [studentId, supabase]);

  const totalDistance = useMemo(() => {
    let total = 0;
    if (warmupEnabled) total += warmupDistance;
    if (cooldownEnabled) total += cooldownDistance;

    if (workoutType === 'rodagem') {
      total += easyDistance;
    } else if (workoutType === 'progressivo') {
      total += progressionBlocks.reduce((acc, b) => acc + (b.distance_km || 0), 0);
    } else {
      total += altReps * (altWorkDistance + altRestDistance);
    }
    return Math.max(0, Number.isFinite(total) ? total : 0);
  }, [
    warmupEnabled,
    warmupDistance,
    cooldownEnabled,
    cooldownDistance,
    workoutType,
    easyDistance,
    progressionBlocks,
    altReps,
    altWorkDistance,
    altRestDistance,
  ]);

  function buildMainBlocks(): Block[] {
    if (workoutType === 'rodagem') {
      return [
        {
          id: uid(),
          distance_km: easyDistance,
          intensity: defaultIntensity,
          pace_range: ranges[defaultIntensity] ?? null,
        },
      ];
    }

    if (workoutType === 'progressivo') {
      return progressionBlocks.map((b) => ({
        ...b,
        pace_range: ranges[b.intensity] ?? null,
      }));
    }

    // alternado: gera sequência trabalho/recuperação repetida
    const out: Block[] = [];
    for (let i = 0; i < altReps; i++) {
      out.push({
        id: uid('w'),
        distance_km: altWorkDistance,
        intensity: 'forte',
        pace_range: ranges.forte ?? null,
      });
      out.push({
        id: uid('r'),
        distance_km: altRestDistance,
        intensity: 'leve',
        pace_range: ranges.leve ?? null,
      });
    }
    return out;
  }

  function buildPayload(nextShareSlug?: string | null) {
    const blocks = buildMainBlocks();

    const payload = {
      student_id: studentId,
      title: title?.trim() || workoutTypeLabel(workoutType),
      type: workoutType,
      notes: notes?.trim() || null,
      status: 'draft' as const,
      // estrutura
      warmup_enabled: warmupEnabled,
      warmup_distance_km: warmupEnabled ? warmupDistance : 0,
      cooldown_enabled: cooldownEnabled,
      cooldown_distance_km: cooldownEnabled ? cooldownDistance : 0,
      // blocos principais serializados
      blocks: blocks.map((b, idx) => ({
        order_index: idx + 1,
        distance_km: b.distance_km,
        intensity: b.intensity,
        pace_min: b.pace_range?.min ?? null,
        pace_max: b.pace_range?.max ?? null,
      })),
      share_slug: nextShareSlug ?? shareSlug ?? null,
      updated_at: new Date().toISOString(),
    };

    return payload;
  }

  async function ensureUniqueSlug(base: string) {
    // tenta base, base-2, base-3...
    const slugBase = base.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '');
    let candidate = slugBase || `treino-${Date.now()}`;
    for (let i = 0; i < 8; i++) {
      const trySlug = i === 0 ? candidate : `${candidate}-${i + 1}`;
      const { data, error } = await supabase
        .from('workouts')
        .select('id')
        .eq('share_slug', trySlug)
        .limit(1);

      if (error) throw error;
      if (!data || data.length === 0) return trySlug;
    }
    return `${candidate}-${Date.now()}`;
  }

  async function upsertWorkout(markReadyForShare = false) {
    try {
      setSaving(true);
      setError(null);

      // cria slug se necessário
      const nextShareSlug =
        shareSlug ??
        (markReadyForShare
          ? await ensureUniqueSlug(`${studentName || 'aluno'}-${title || workoutTypeLabel(workoutType)}`)
          : null);

      const payload = buildPayload(nextShareSlug);
      if (markReadyForShare) (payload as any).status = 'ready';

      let saved: { id: string; share_slug: string | null } | null = null;

      if (!workoutId) {
        const { data, error: dbErr } = await supabase
          .from('workouts')
          .insert(payload)
          .select('id,share_slug')
          .single();

        if (dbErr) throw dbErr;
        if (!data) throw new Error('Falha ao salvar o treino (insert).');
        saved = data;
        setWorkoutId(data.id);
      } else {
        const { data, error: dbErr } = await supabase
          .from('workouts')
          .update(payload)
          .eq('id', workoutId)
          .select('id,share_slug')
          .single();

        if (dbErr) throw dbErr;
        if (!data) throw new Error('Falha ao salvar o treino (update).');
        saved = data;
      }

      if (!saved) throw new Error('Falha ao salvar o treino.');

      setShareSlug(saved.share_slug ?? nextShareSlug);

      return saved.share_slug ?? nextShareSlug;
    } catch (e: any) {
      setError(e?.message || 'Erro ao salvar treino');
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveDraft() {
    await upsertWorkout(false);
  }

  async function handleShare() {
    const slug = await upsertWorkout(true);
    if (!slug) return;

    const url = `${window.location.origin}/w/${slug}`;
    const msg =
      `Treino de hoje 👇\n` +
      `${title?.trim() || workoutTypeLabel(workoutType)}\n` +
      `Distância total: ${totalDistance.toFixed(1)} km\n` +
      `Abra o link e use o modo execução por blocos.\n\n` +
      `${url}`;

    try {
      if (navigator.share) {
        await navigator.share({ title: 'PaceLink - Treino', text: msg, url });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(msg);
        alert('Mensagem copiada! Cole no WhatsApp.');
      } else {
        alert(url);
      }
    } catch {
      // usuário cancelou share, sem problemas
    }
  }

  function addProgressionBlock() {
    setProgressionBlocks((prev) => [
      ...prev,
      { id: uid(), distance_km: 1, intensity: 'moderado' },
    ]);
  }

  function removeProgressionBlock(blockId: string) {
    setProgressionBlocks((prev) => prev.filter((b) => b.id !== blockId));
  }

  function updateProgressionBlock(blockId: string, patch: Partial<Block>) {
    setProgressionBlocks((prev) =>
      prev.map((b) => (b.id === blockId ? { ...b, ...patch } : b))
    );
  }

  if (loading) {
    return (
      <>
        <Topbar title="Criar Treino" />
        <main className="flex-1 p-6">
          <div className="text-slate-300">Carregando...</div>
        </main>
      </>
    );
  }

  return (
    <>
      <Topbar title="Criar Treino" />

      <main className="flex-1 flex flex-col p-6 gap-5 pb-28">
        {error && (
          <div className="rounded-lg bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        <Card>
          <div className="space-y-1">
            <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Aluno</div>
            <div className="text-lg font-semibold">{studentName || 'Aluno'}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">P1k: {studentP1k} min/km</div>
          </div>
        </Card>

        <Card>
          <div className="space-y-3">
            <div className="text-sm font-semibold">Título do treino</div>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white placeholder-slate-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              placeholder="Ex.: Rodagem leve"
            />
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Distância total estimada: <span className="font-semibold">{totalDistance.toFixed(1)} km</span>
            </div>
          </div>
        </Card>

        <Card>
          <div className="space-y-3">
            <div className="text-sm font-semibold">Tipo de Treino</div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setWorkoutType('rodagem')}
                className={`flex-1 rounded-full px-3 py-2 text-sm font-semibold border ${
                  workoutType === 'rodagem'
                    ? 'bg-primary text-black border-transparent'
                    : 'bg-transparent text-white border-slate-700'
                }`}
              >
                🏃 Rodagem
              </button>

              <button
                type="button"
                onClick={() => setWorkoutType('progressivo')}
                className={`flex-1 rounded-full px-3 py-2 text-sm font-semibold border ${
                  workoutType === 'progressivo'
                    ? 'bg-primary text-black border-transparent'
                    : 'bg-transparent text-white border-slate-700'
                }`}
              >
                Progressivo
              </button>

              <button
                type="button"
                onClick={() => setWorkoutType('alternado')}
                className={`flex-1 rounded-full px-3 py-2 text-sm font-semibold border ${
                  workoutType === 'alternado'
                    ? 'bg-primary text-black border-transparent'
                    : 'bg-transparent text-white border-slate-700'
                }`}
              >
                Alternado
              </button>
            </div>
          </div>
        </Card>

        <Card>
          <div className="space-y-4">
            <div className="text-sm font-semibold">Estrutura</div>

            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">Aquecimento</div>
              <label className="inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={warmupEnabled}
                  onChange={(e) => setWarmupEnabled(e.target.checked)}
                  className="sr-only"
                />
                <span
                  className={`w-12 h-7 rounded-full relative transition ${
                    warmupEnabled ? 'bg-primary' : 'bg-slate-700'
                  }`}
                >
                  <span
                    className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white transition ${
                      warmupEnabled ? 'translate-x-5' : ''
                    }`}
                  />
                </span>
              </label>
            </div>

            {warmupEnabled && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Distância</div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.5"
                      min="0.5"
                      value={warmupDistance}
                      onChange={(e) => setWarmupDistance(clamp(Number(e.target.value || 0), 0.5, 10))}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    />
                    <div className="text-sm text-slate-400">km</div>
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Ritmo</div>
                  <div className="w-full rounded-xl border border-slate-700 bg-slate-900/20 px-3 py-2 text-sm text-slate-200">
                    Livre
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-slate-800">
              <div className="text-sm font-semibold">Desaquecimento</div>
              <label className="inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={cooldownEnabled}
                  onChange={(e) => setCooldownEnabled(e.target.checked)}
                  className="sr-only"
                />
                <span
                  className={`w-12 h-7 rounded-full relative transition ${
                    cooldownEnabled ? 'bg-primary' : 'bg-slate-700'
                  }`}
                >
                  <span
                    className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white transition ${
                      cooldownEnabled ? 'translate-x-5' : ''
                    }`}
                  />
                </span>
              </label>
            </div>

            {cooldownEnabled && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Distância</div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.5"
                      min="0.5"
                      value={cooldownDistance}
                      onChange={(e) => setCooldownDistance(clamp(Number(e.target.value || 0), 0.5, 10))}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    />
                    <div className="text-sm text-slate-400">km</div>
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Ritmo</div>
                  <div className="w-full rounded-xl border border-slate-700 bg-slate-900/20 px-3 py-2 text-sm text-slate-200">
                    Livre
                  </div>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* BLOCOS PRINCIPAIS */}
        <Card>
          <div className="space-y-4">
            <div className="text-sm font-semibold">Blocos Principais</div>

            {workoutType === 'rodagem' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Distância do trecho
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.5"
                        min="1"
                        value={easyDistance}
                        onChange={(e) => setEasyDistance(clamp(Number(e.target.value || 0), 1, 50))}
                        className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                      />
                      <div className="text-sm text-slate-400">km</div>
                    </div>
                  </div>

                  <div>
                    <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Intensidade</div>
                    <div className="flex gap-2">
                      {(['leve', 'moderado', 'forte'] as Intensity[]).map((i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setDefaultIntensity(i)}
                          className={`flex-1 rounded-full px-3 py-2 text-xs font-semibold border ${
                            defaultIntensity === i
                              ? 'bg-primary text-black border-transparent'
                              : 'bg-transparent text-white border-slate-700'
                          }`}
                        >
                          {intensityLabel(i)}
                        </button>
                      ))}
                    </div>
                    <div className="mt-2 text-xs text-slate-400">
                      Ritmo sugerido: {ranges[defaultIntensity]?.min ?? '--:--'}–{ranges[defaultIntensity]?.max ?? '--:--'} /km
                    </div>
                  </div>
                </div>
              </div>
            )}

            {workoutType === 'progressivo' && (
              <div className="space-y-4">
                {progressionBlocks.map((b) => (
                  <div key={b.id} className="rounded-2xl border border-slate-800 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Bloco
                      </div>
                      {progressionBlocks.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeProgressionBlock(b.id)}
                          className="text-slate-400 hover:text-red-400"
                          title="Remover bloco"
                        >
                          🗑️
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Distância</div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            step="0.5"
                            min="0.5"
                            value={b.distance_km}
                            onChange={(e) =>
                              updateProgressionBlock(b.id, {
                                distance_km: clamp(Number(e.target.value || 0), 0.5, 50),
                              })
                            }
                            className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                          />
                          <div className="text-sm text-slate-400">km</div>
                        </div>
                      </div>

                      <div>
                        <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Intensidade</div>
                        <div className="flex gap-2">
                          {(['leve', 'moderado', 'forte'] as Intensity[]).map((i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => updateProgressionBlock(b.id, { intensity: i })}
                              className={`flex-1 rounded-full px-3 py-2 text-xs font-semibold border ${
                                b.intensity === i
                                  ? 'bg-primary text-black border-transparent'
                                  : 'bg-transparent text-white border-slate-700'
                              }`}
                            >
                              {intensityLabel(i)}
                            </button>
                          ))}
                        </div>
                        <div className="mt-2 text-xs text-slate-400">
                          Ritmo sugerido: {ranges[b.intensity]?.min ?? '--:--'}–{ranges[b.intensity]?.max ?? '--:--'} /km
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={addProgressionBlock}
                  className="w-full rounded-2xl border border-dashed border-slate-700 p-4 text-sm font-semibold text-slate-200 hover:border-slate-500"
                >
                  ＋ Adicionar Bloco
                </button>
              </div>
            )}

            {workoutType === 'alternado' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Trabalho (FORTE)</div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.5"
                        min="0.2"
                        value={altWorkDistance}
                        onChange={(e) => setAltWorkDistance(clamp(Number(e.target.value || 0), 0.2, 10))}
                        className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                      />
                      <div className="text-sm text-slate-400">km</div>
                    </div>
                    <div className="mt-2 text-xs text-slate-400">
                      Ritmo sugerido: {ranges.forte?.min ?? '--:--'}–{ranges.forte?.max ?? '--:--'} /km
                    </div>
                  </div>

                  <div>
                    <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Recuperação (LEVE)</div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.5"
                        min="0.2"
                        value={altRestDistance}
                        onChange={(e) => setAltRestDistance(clamp(Number(e.target.value || 0), 0.2, 10))}
                        className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                      />
                      <div className="text-sm text-slate-400">km</div>
                    </div>
                    <div className="mt-2 text-xs text-slate-400">
                      Ritmo sugerido: {ranges.leve?.min ?? '--:--'}–{ranges.leve?.max ?? '--:--'} /km
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Repetições</div>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    value={altReps}
                    onChange={(e) => setAltReps(clamp(Number(e.target.value || 0), 1, 30))}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                  <div className="mt-2 text-xs text-slate-400">
                    Sequência gerada: {altReps}× (FORTE {altWorkDistance} km + LEVE {altRestDistance} km)
                  </div>
                </div>

                <div className="rounded-xl bg-slate-900/20 border border-slate-800 p-4 text-sm text-slate-200">
                  <div className="font-semibold mb-1">Dica para o aluno (LEVE)</div>
                  <div className="text-slate-300">Recupere: respiração controlada, dá pra falar frases.</div>
                </div>
              </div>
            )}
          </div>
        </Card>

        <Card>
          <div className="space-y-2">
            <div className="text-sm font-semibold">Observações (opcional)</div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white placeholder-slate-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              placeholder="Ex.: manter técnica, focar em respiração, etc."
            />
          </div>
        </Card>
      </main>

      {/* Footer actions */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/80 dark:bg-black/30 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 p-4">
        <div className="max-w-md mx-auto flex gap-3">
          <Button onClick={handleSaveDraft} disabled={saving} fullWidth variant="secondary">
            {saving ? 'Salvando...' : 'Salvar Rascunho'}
          </Button>
          <Button onClick={handleShare} disabled={saving} fullWidth>
            Compartilhar
          </Button>
        </div>
      </div>
    </>
  );
}
