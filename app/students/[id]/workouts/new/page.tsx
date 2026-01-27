'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

import Topbar from '../../../../../components/Topbar';
import { Button } from '../../../../../components/Button';
import { Card } from '../../../../../components/Card';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

type WorkoutType = 'easy' | 'progressive' | 'interval';
type Intensity = 'easy' | 'moderate' | 'hard';

type StudentRow = {
  id: string;
  trainer_id: string;
  name: string;
  email: string | null;
  p1k_sec_per_km: number;
  created_at: string;
  updated_at: string;
};

type BlockUI = {
  id: string;
  distanceKm: string; // string para permitir apagar/editar livremente
  intensity: Intensity;
};

function paceMinKmFromSeconds(secondsPerKm?: number | null) {
  if (!secondsPerKm || secondsPerKm <= 0) return '—';
  const min = Math.floor(secondsPerKm / 60);
  const sec = Math.round(secondsPerKm % 60);
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

function toNumberOrNull(value: string): number | null {
  const normalized = value.replace(',', '.').trim();
  if (!normalized) return null;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function toNumberOrZero(value: string): number {
  const n = toNumberOrNull(value);
  return n ?? 0;
}

function workoutTypeLabel(t: WorkoutType) {
  switch (t) {
    case 'easy':
      return 'Rodagem';
    case 'progressive':
      return 'Progressivo';
    case 'interval':
      return 'Alternado';
  }
}

function workoutTypePlaceholder(t: WorkoutType) {
  switch (t) {
    case 'easy':
      return 'Ex: Rodagem leve';
    case 'progressive':
      return 'Ex: Progressivo 5 km';
    case 'interval':
      return 'Ex: Alternado 10x (1 km forte / 1 km leve)';
  }
}

function intensityLabel(i: Intensity) {
  switch (i) {
    case 'easy':
      return 'Leve';
    case 'moderate':
      return 'Moderado';
    case 'hard':
      return 'Forte';
  }
}

export default function NewWorkoutPage() {
  const router = useRouter();
  const params = useParams();

  const studentId = useMemo(() => {
    const raw = (params as any)?.id;
    return Array.isArray(raw) ? raw[0] : raw;
  }, [params]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [student, setStudent] = useState<StudentRow | null>(null);

  const [title, setTitle] = useState('');
  const [workoutType, setWorkoutType] = useState<WorkoutType>('easy');

  const [includeWarmup, setIncludeWarmup] = useState(true);
  const [warmupKm, setWarmupKm] = useState('2');
  const [warmupPace, setWarmupPace] = useState<'free' | 'p1k'>('free');

  const [includeCooldown, setIncludeCooldown] = useState(false);
  const [cooldownKm, setCooldownKm] = useState('1');
  const [cooldownPace, setCooldownPace] = useState<'free' | 'p1k'>('free');

  const [blocks, setBlocks] = useState<BlockUI[]>([
    { id: crypto.randomUUID(), distanceKm: '5', intensity: 'moderate' },
  ]);

  const [notes, setNotes] = useState('');

  const totalKmEstimate = useMemo(() => {
    const mainKm = blocks.reduce((acc, b) => acc + toNumberOrZero(b.distanceKm), 0);
    const w = includeWarmup ? toNumberOrZero(warmupKm) : 0;
    const c = includeCooldown ? toNumberOrZero(cooldownKm) : 0;
    const total = mainKm + w + c;
    return Math.round(total * 10) / 10;
  }, [blocks, includeWarmup, warmupKm, includeCooldown, cooldownKm]);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError(null);

        if (!studentId) {
          setError('ID do aluno não encontrado na URL.');
          return;
        }

        const { data, error: e } = await supabase
          .from('students')
          .select('id,trainer_id,name,email,p1k_sec_per_km,created_at,updated_at')
          .eq('id', studentId)
          .single();

        if (e) throw e;
        setStudent(data as StudentRow);
      } catch (e: any) {
        setError(e?.message || 'Falha ao carregar aluno.');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [studentId]);

  function addBlock() {
    setBlocks((prev) => [
      ...prev,
      { id: crypto.randomUUID(), distanceKm: '', intensity: 'easy' },
    ]);
  }

  function removeBlock(id: string) {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
  }

  function updateBlock(id: string, patch: Partial<BlockUI>) {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  }

  async function upsertWorkout(status: 'draft' | 'ready') {
    try {
      setSaving(true);
      setError(null);

      if (!student) throw new Error('Aluno não carregado.');

      if (status === 'ready') {
        const hasAnyMainKm = blocks.some((b) => (toNumberOrNull(b.distanceKm) ?? 0) > 0);
        if (!hasAnyMainKm) throw new Error('Informe ao menos 1 bloco com distância.');
      }

      const payload = {
        trainer_id: student.trainer_id,
        student_id: student.id,
        title: title.trim() || null,
        type: workoutType,
        status,
        include_warmup: includeWarmup,
        warmup_km: includeWarmup ? toNumberOrZero(warmupKm) : 0,
        warmup_pace: includeWarmup ? (warmupPace === 'p1k' ? 'p1k' : 'free') : null,
        include_cooldown: includeCooldown,
        cooldown_km: includeCooldown ? toNumberOrZero(cooldownKm) : 0,
        cooldown_pace: includeCooldown ? (cooldownPace === 'p1k' ? 'p1k' : 'free') : null,
        blocks: blocks.map((b) => ({
          distance_km: toNumberOrZero(b.distanceKm),
          intensity: b.intensity,
        })),
        notes: notes.trim() || null,
        total_km: totalKmEstimate,
      };

      const { data, error: e } = await supabase
        .from('workouts')
        .insert(payload)
        .select('id')
        .single();

      if (e) throw e;

      router.push(`/students/${student.id}`);
    } catch (e: any) {
      const msg = String(e?.message || 'Falha ao salvar treino.');
      if (msg.includes('schema cache') || msg.includes('does not exist')) {
        setError(
          `Erro de banco de dados (coluna/tabela ausente). Verifique se "workouts" possui include_warmup, warmup_km, include_cooldown e cooldown_km. Detalhe: ${msg}`
        );
      } else {
        setError(msg);
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">
        Carregando...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-dark text-white">
      <Topbar title="Criar Treino" backHref={student ? `/students/${student.id}` : '/students'} />

      <main className="max-w-2xl mx-auto px-4 pb-28 pt-6">
        {error && (
          <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-red-200 text-sm">
            {error}
          </div>
        )}

        <Card className="mb-4 p-4">
          <div className="text-xs font-bold tracking-widest text-slate-400 uppercase">Aluno</div>
          <div className="mt-1 text-lg font-extrabold">{student?.name || '—'}</div>
          <div className="mt-1 text-sm text-slate-400">
            Ritmo P1K: {paceMinKmFromSeconds(student?.p1k_sec_per_km)} min/km
          </div>
        </Card>

        <Card className="mb-4 p-4">
          <div className="text-sm font-bold mb-2">Título do treino</div>
          <input
            className="w-full h-12 px-4 rounded-xl bg-white/5 border border-white/10 outline-none focus:border-primary/60"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={workoutTypePlaceholder(workoutType)}
          />
          <div className="mt-2 text-xs text-slate-400">
            Distância total estimada: <span className="font-bold">{totalKmEstimate}</span> km
          </div>
        </Card>

        <Card className="mb-4 p-4">
          <div className="text-sm font-bold mb-3">Tipo de Treino</div>
          <div className="flex gap-2">
            {(['easy', 'progressive', 'interval'] as WorkoutType[]).map((t) => {
              const active = workoutType === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setWorkoutType(t)}
                  className={[
                    'h-11 px-5 rounded-full text-sm font-bold border',
                    active
                      ? 'bg-primary text-black border-primary'
                      : 'bg-transparent text-white border-white/15 hover:border-white/30',
                  ].join(' ')}
                >
                  {workoutTypeLabel(t)}
                </button>
              );
            })}
          </div>
        </Card>

        <Card className="mb-4 p-4">
          <div className="text-sm font-bold mb-3">Estrutura</div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 mb-4">
            <div className="flex items-center justify-between">
              <div className="font-bold">Aquecimento</div>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <span className="text-xs text-slate-400">{includeWarmup ? 'On' : 'Off'}</span>
                <input
                  type="checkbox"
                  className="accent-primary h-5 w-5"
                  checked={includeWarmup}
                  onChange={(e) => setIncludeWarmup(e.target.checked)}
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-3">
              <div>
                <div className="text-[10px] font-bold tracking-widest text-slate-400 uppercase mb-1">
                  Distância
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    inputMode="decimal"
                    className="w-full h-11 px-3 rounded-xl bg-white/5 border border-white/10 outline-none focus:border-primary/60 disabled:opacity-60"
                    value={warmupKm}
                    onChange={(e) => setWarmupKm(e.target.value)}
                    disabled={!includeWarmup}
                    placeholder="Ex: 2"
                  />
                  <span className="text-sm text-slate-400">km</span>
                </div>
              </div>
              <div>
                <div className="text-[10px] font-bold tracking-widest text-slate-400 uppercase mb-1">
                  Ritmo
                </div>
                <select
                  className="w-full h-11 px-3 rounded-xl bg-white/5 border border-white/10 outline-none focus:border-primary/60 disabled:opacity-60"
                  value={warmupPace}
                  onChange={(e) => setWarmupPace(e.target.value as any)}
                  disabled={!includeWarmup}
                >
                  <option value="free">Livre</option>
                  <option value="p1k">P1K</option>
                </select>
              </div>
            </div>
          </div>

          <div className="mb-2 text-[10px] font-bold tracking-widest text-slate-400 uppercase">
            Blocos principais
          </div>

          <div className="space-y-3">
            {blocks.map((b) => (
              <div key={b.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="text-[10px] font-bold tracking-widest text-slate-400 uppercase mb-1">
                      Distância do trecho
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        inputMode="decimal"
                        className="w-full h-12 px-3 rounded-xl bg-white/5 border border-white/10 outline-none focus:border-primary/60"
                        value={b.distanceKm}
                        onChange={(e) => updateBlock(b.id, { distanceKm: e.target.value })}
                        placeholder="Ex: 1"
                      />
                      <span className="text-sm text-slate-400">km</span>
                    </div>
                  </div>

                  {blocks.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeBlock(b.id)}
                      className="h-10 w-10 rounded-xl border border-white/10 hover:border-white/30 flex items-center justify-center"
                      aria-label="Remover bloco"
                      title="Remover bloco"
                    >
                      <span className="material-symbols-outlined text-slate-200">delete</span>
                    </button>
                  )}
                </div>

                <div className="mt-4">
                  <div className="text-[10px] font-bold tracking-widest text-slate-400 uppercase mb-2">
                    Intensidade
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {(['easy', 'moderate', 'hard'] as Intensity[]).map((i) => {
                      const active = b.intensity === i;
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => updateBlock(b.id, { intensity: i })}
                          className={[
                            'h-11 rounded-full text-xs sm:text-sm font-bold border w-full',
                            active
                              ? 'bg-primary text-black border-primary'
                              : 'bg-transparent text-white border-white/15 hover:border-white/30',
                          ].join(' ')}
                        >
                          {intensityLabel(i)}
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-2 text-xs text-slate-400">
                    Ritmo sugerido:{' '}
                    {b.intensity === 'easy'
                      ? '6:00–7:00 /km'
                      : b.intensity === 'moderate'
                        ? '5:00–6:00 /km'
                        : '4:00–5:00 /km'}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addBlock}
            className="mt-3 w-full h-12 rounded-2xl border border-dashed border-white/15 hover:border-white/30 text-sm font-bold flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined">add</span>
            Adicionar Bloco
          </button>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 mt-5">
            <div className="flex items-center justify-between">
              <div className="font-bold">Desaquecimento</div>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <span className="text-xs text-slate-400">{includeCooldown ? 'On' : 'Off'}</span>
                <input
                  type="checkbox"
                  className="accent-primary h-5 w-5"
                  checked={includeCooldown}
                  onChange={(e) => setIncludeCooldown(e.target.checked)}
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-3">
              <div>
                <div className="text-[10px] font-bold tracking-widest text-slate-400 uppercase mb-1">
                  Distância
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    inputMode="decimal"
                    className="w-full h-11 px-3 rounded-xl bg-white/5 border border-white/10 outline-none focus:border-primary/60 disabled:opacity-60"
                    value={cooldownKm}
                    onChange={(e) => setCooldownKm(e.target.value)}
                    disabled={!includeCooldown}
                    placeholder="Ex: 1"
                  />
                  <span className="text-sm text-slate-400">km</span>
                </div>
              </div>
              <div>
                <div className="text-[10px] font-bold tracking-widest text-slate-400 uppercase mb-1">
                  Ritmo
                </div>
                <select
                  className="w-full h-11 px-3 rounded-xl bg-white/5 border border-white/10 outline-none focus:border-primary/60 disabled:opacity-60"
                  value={cooldownPace}
                  onChange={(e) => setCooldownPace(e.target.value as any)}
                  disabled={!includeCooldown}
                >
                  <option value="free">Livre</option>
                  <option value="p1k">P1K</option>
                </select>
              </div>
            </div>
          </div>
        </Card>

        <Card className="mb-4 p-4">
          <div className="text-sm font-bold mb-2">Observações (opcional)</div>
          <textarea
            className="w-full min-h-[110px] px-4 py-3 rounded-xl bg-white/5 border border-white/10 outline-none focus:border-primary/60 resize-none"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ex: Foco em técnica, atenção na cadência, etc."
          />
        </Card>
      </main>

      <div className="fixed bottom-0 left-0 right-0 bg-black/40 backdrop-blur border-t border-white/10 px-4 py-3">
        <div className="max-w-2xl mx-auto flex gap-3">
          <Button
            className="flex-1 h-12 rounded-full"
            variant="secondary"
            disabled={saving}
            onClick={() => upsertWorkout('draft')}
          >
            {saving ? 'Salvando...' : 'Salvar Rascunho'}
          </Button>

          <Button className="flex-1 h-12 rounded-full" disabled={saving} onClick={() => upsertWorkout('ready')}>
            {saving ? 'Salvando...' : 'Compartilhar'}
          </Button>
        </div>
      </div>
    </div>
  );
}
