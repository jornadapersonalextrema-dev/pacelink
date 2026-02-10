'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '../../../../../lib/supabaseBrowser';
import Topbar from '../../../../../components/Topbar';
import Button from '../../../../../components/Button';

type StudentRow = {
  id: string;
  name: string;
  public_slug: string | null;
  email: string | null;
  p1k_sec_per_km: number | null;
};

type WorkoutRow = {
  id: string;
  trainer_id: string;
  student_id: string;
  status: 'draft' | 'ready' | 'archived' | 'canceled';
  template_type: string;
  include_warmup: boolean;
  warmup_km: number;
  include_cooldown: boolean;
  cooldown_km: number;
  blocks: any[];
  total_km: number;
  planned_date?: string | null;
  planned_day?: number | null;
  share_slug: string | null;
  created_at: string;
  title: string | null;
};

type WeekRow = { id: string; week_start: string; week_end: string; label: string | null; };

type BlockDraft = {
  id: string;
  distanceKm: string; // string p/ permitir vazio ao digitar
  intensity: 'leve' | 'moderado' | 'forte';
  paceStr: string;
  note: string;
};

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function secToPaceStr(secPerKm: number | null) {
  if (!secPerKm || secPerKm <= 0) return '—';
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${String(s).padStart(2, '0')}/km`;
}

function formatWeekLabel(weekStart: string, weekEnd: string) {
  const [ys, ms, ds] = String(weekStart).split('-');
  const [ye, me, de] = String(weekEnd).split('-');
  if (!ys || !ms || !ds || !ye || !me || !de) return `Semana ${weekStart} – ${weekEnd}`;
  return `Semana ${ds}/${ms} – ${de}/${me}`;
}


function toISODate(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function addDaysISO(isoDate: string, days: number) {
  // isoDate esperado: YYYY-MM-DD
  const d = new Date(`${isoDate}T00:00:00`);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

function diffDaysISO(weekStartISO: string, dateISO: string) {
  const a = new Date(`${weekStartISO}T00:00:00`);
  const b = new Date(`${dateISO}T00:00:00`);
  const ms = b.getTime() - a.getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

function formatDateBR(iso: string | null | undefined) {
  if (!iso) return '—';
  const [y, m, d] = String(iso).split('-');
  if (!y || !m || !d) return String(iso);
  return `${d}/${m}/${y}`;
}


function round1(n: number) {
  return Math.round(n * 10) / 10;
}

function parseKm(str: string) {
  const n = Number(String(str).replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

function computeTotalKm(warmupKm: number, cooldownKm: number, blocks: BlockDraft[]) {
  const b = blocks.reduce((acc, x) => acc + parseKm(x.distanceKm), 0);
  return round1((warmupKm || 0) + (cooldownKm || 0) + b);
}

function paceFromIntensity(baseSecPerKm: number | null, intensity: BlockDraft['intensity']) {
  // heurística simples: leve = +20%, moderado = base, forte = -10% (mais rápido)
  if (!baseSecPerKm || baseSecPerKm <= 0) return '—';
  let sec = baseSecPerKm;
  if (intensity === 'leve') sec = baseSecPerKm * 1.2;
  if (intensity === 'forte') sec = baseSecPerKm * 0.9;

  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}/km`;
}

export default function NewWorkoutPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const params = useParams();
  const search = useSearchParams();

  const studentId = String(params?.id || '');
  const weekId = search?.get('weekId');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [student, setStudent] = useState<StudentRow | null>(null);
  const [week, setWeek] = useState<WeekRow | null>(null);

  const weekStartISO = week?.week_start || '';
  const weekEndISO = useMemo(() => {
    if (!week?.week_start) return '';
    return week?.week_end || addDaysISO(week.week_start, 6);
  }, [week?.week_start, week?.week_end]);

  const [title, setTitle] = useState<string>('Treino');
  const [plannedDate, setPlannedDate] = useState<string>('');
  const [includeWarmup, setIncludeWarmup] = useState(true);
  const [warmupKm, setWarmupKm] = useState<string>('1');
  const [includeCooldown, setIncludeCooldown] = useState(true);
  const [cooldownKm, setCooldownKm] = useState<string>('1');

  const [blocks, setBlocks] = useState<BlockDraft[]>([
    { id: uid(), distanceKm: '1', intensity: 'moderado', paceStr: '', note: '' },
    { id: uid(), distanceKm: '1', intensity: 'forte', paceStr: '', note: '' },
  ]);

  const totalKm = useMemo(
    () => computeTotalKm(includeWarmup ? Math.max(0.1, parseKm(warmupKm)) : 0, includeCooldown ? Math.max(0.1, parseKm(cooldownKm)) : 0, blocks),
    [includeWarmup, warmupKm, includeCooldown, cooldownKm, blocks]
  );

  useEffect(() => {
    // default: se veio por semana, já deixa a data prevista como o início da semana
    if (weekStartISO && !plannedDate) setPlannedDate(weekStartISO);
  }, [weekStartISO, plannedDate]);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setErr(null);

      try {
        // Student
        const { data: st, error: stErr } = await supabase
          .from('students')
          .select('id,name,public_slug,email,p1k_sec_per_km')
          .eq('id', studentId)
          .maybeSingle();

        if (stErr) throw stErr;
        if (!st) throw new Error('Aluno não encontrado');
        if (!mounted) return;
        setStudent(st);

        // Week (optional)
        if (weekId) {
          // tenta 'weeks' e faz fallback p/ 'training_weeks' (caso 'weeks' não exista)
          const res1 = await supabase
            .from('weeks')
            .select('id,trainer_id,week_start,week_end,label')
            .eq('id', weekId)
            .maybeSingle();

          let wk = res1.data as any;
          const wkErr = res1.error as any;

          if (wkErr && String(wkErr.message || '').toLowerCase().includes('relation') && String(wkErr.message).includes('weeks')) {
            const res2 = await supabase
              .from('training_weeks')
              .select('id,trainer_id,week_start,week_end,label')
              .eq('id', weekId)
              .maybeSingle();

            if (res2.error) throw res2.error;
            wk = res2.data as any;
          } else if (wkErr) {
            throw wkErr;
          }

          if (!mounted) return;
          setWeek(wk as any);
        }

        // Pre-fill pace suggestions
        if (st?.p1k_sec_per_km) {
          setBlocks((prev) =>
            prev.map((b) => ({
              ...b,
              paceStr: b.paceStr || paceFromIntensity(st.p1k_sec_per_km, b.intensity),
            }))
          );
        }
      } catch (e: any) {
        if (!mounted) return;
        setErr(e?.message || 'Erro ao carregar');
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [supabase, studentId, weekId]);

  function updateBlock(id: string, patch: Partial<BlockDraft>) {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  }

  function addBlock() {
    const base = student?.p1k_sec_per_km || null;
    const intensity: BlockDraft['intensity'] = 'moderado';
    setBlocks((prev) => [
      ...prev,
      { id: uid(), distanceKm: '1', intensity, paceStr: paceFromIntensity(base, intensity), note: '' },
    ]);
  }

  function removeBlock(id: string) {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
  }

  async function saveWorkout() {
    if (!student) return;
    setSaving(true);
    setErr(null);

    try {
      const { data: session } = await supabase.auth.getSession();
      const trainerId = session?.session?.user?.id;
      if (!trainerId) throw new Error('Você precisa estar logado como treinador.');

      const warm = Math.max(0.1, parseKm(warmupKm));
      const cool = Math.max(0.1, parseKm(cooldownKm));

      const payload: Partial<WorkoutRow> & { blocks: any[] } = {
        trainer_id: trainerId,
        student_id: student.id,
        status: 'draft',
        template_type: 'easy_run',
        title: title?.trim() || null,
        include_warmup: includeWarmup,
        warmup_km: warm,
        include_cooldown: includeCooldown,
        cooldown_km: cool,
        total_km: totalKm,
        share_slug: null,
        blocks: blocks.map((b) => ({
          distance_km: parseKm(b.distanceKm),
          intensity: b.intensity,
          pace: b.paceStr || null,
          notes: b.note || null,
        })),
      };

      // vínculo com semana (se veio pela tela de semana)
      const insertPayload: any = { ...payload };
      if (weekId) insertPayload.week_id = weekId;

      // data prevista (para aparecer no calendário semanal)
      if (weekId) {
        if (!plannedDate) {
          throw new Error('Informe a data prevista para realização do treino.');
        }
        if (weekStartISO) {
          const day = diffDaysISO(weekStartISO, plannedDate);
          if (day < 0 || day > 6) {
            throw new Error(`A data prevista precisa estar dentro da semana (${formatDateBR(weekStartISO)} – ${formatDateBR(weekEndISO)}).`);
          }
          insertPayload.planned_day = day;
        }
        insertPayload.planned_date = plannedDate;
      }

      const { data: inserted, error } = await supabase
        .from('workouts')
        .insert(insertPayload)
        .select('id')
        .single();

      if (error) throw error;

      router.push(`/workouts/${inserted.id}/edit`);
    } catch (e: any) {
      setErr(e?.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background-dark to-black text-white">
	<Topbar title="Novo treino" />
        <div className="mx-auto max-w-4xl p-6">Carregando…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background-dark to-black text-white">
	<Topbar title="Novo treino" />
      <div className="mx-auto max-w-4xl p-6 space-y-6">
        <div className="rounded-3xl bg-surface-dark/70 border border-white/10 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm text-white/60">Novo treino</div>
              <div className="text-2xl font-extrabold">{student?.name}</div>
              <div className="text-sm text-white/60 mt-1">Ritmo P1k: {secToPaceStr(student?.p1k_sec_per_km || null)}</div>
              {week?.week_start && week?.week_end && (
                <div className="mt-2 text-sm text-white/70">
                  Semana: <span className="font-semibold">{week.label || formatWeekLabel(week.week_start, week.week_end)}</span>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => router.back()}
                className="px-4 h-10 rounded-full bg-white/5 hover:bg-white/10 border border-white/10"
              >
                Voltar
              </button>
            </div>
          </div>

          {err && (
            <div className="mt-4 rounded-2xl bg-red-500/15 border border-red-500/30 p-4 text-red-200">
              {err}
            </div>
          )}
        </div>

        <div className="rounded-3xl bg-surface-dark/70 border border-white/10 p-6 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <div className="text-sm text-white/60 mb-1">Título</div>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full h-12 rounded-2xl bg-black/30 border border-white/10 px-4 outline-none focus:border-primary"
              />
            </div>

            <div>
              <div className="text-sm text-white/60 mb-1">Total estimado</div>
              <div className="h-12 rounded-2xl bg-black/30 border border-white/10 px-4 flex items-center font-bold">
                {totalKm} km
              </div>
            </div>
          </div>

          {weekStartISO && (
            <div className="mt-4">
              <div className="text-sm text-white/60 mb-1">Data prevista</div>
              <input
                type="date"
                value={plannedDate}
                onChange={(e) => setPlannedDate(e.target.value)}
                min={weekStartISO || undefined}
                max={weekEndISO || undefined}
                className="w-full md:w-64 h-12 rounded-2xl bg-black/30 border border-white/10 px-4 outline-none focus:border-primary"
              />
              {weekStartISO && weekEndISO && (
                <div className="mt-1 text-xs text-white/50">
                  Selecione uma data dentro da semana ({formatDateBR(weekStartISO)} – {formatDateBR(weekEndISO)}).
                </div>
              )}
            </div>
          )}


          <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-6">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={includeWarmup} onChange={(e) => setIncludeWarmup(e.target.checked)} />
              <span className="text-white/80">Aquecimento</span>
            </label>

            <input
              disabled={!includeWarmup}
              value={warmupKm}
              onChange={(e) => setWarmupKm(e.target.value)}
              type="number"
              step="0.5"
              min="0.1"
              className="w-28 h-10 rounded-2xl bg-black/30 border border-white/10 px-3 outline-none disabled:opacity-40"
            />
            <span className="text-white/60">km</span>

            <label className="flex items-center gap-2 md:ml-6">
              <input type="checkbox" checked={includeCooldown} onChange={(e) => setIncludeCooldown(e.target.checked)} />
              <span className="text-white/80">Desaquecimento</span>
            </label>

            <input
              disabled={!includeCooldown}
              value={cooldownKm}
              onChange={(e) => setCooldownKm(e.target.value)}
              type="number"
              step="0.5"
              min="0.1"
              className="w-28 h-10 rounded-2xl bg-black/30 border border-white/10 px-3 outline-none disabled:opacity-40"
            />
            <span className="text-white/60">km</span>
          </div>
        </div>

        <div className="rounded-3xl bg-surface-dark/70 border border-white/10 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-lg font-extrabold">Blocos</div>
            <button
              onClick={addBlock}
              className="px-4 h-10 rounded-full bg-white/5 hover:bg-white/10 border border-white/10"
            >
              + Adicionar bloco
            </button>
          </div>

          <div className="space-y-3">
            {blocks.map((b, idx) => (
              <div key={b.id} className="rounded-2xl bg-black/25 border border-white/10 p-4">
                <div className="flex items-center justify-between">
                  <div className="font-bold">Bloco {idx + 1}</div>
                  {blocks.length > 1 && (
                    <button
                      onClick={() => removeBlock(b.id)}
                      className="text-sm text-red-200 hover:text-red-100"
                    >
                      Remover
                    </button>
                  )}
                </div>

                <div className="mt-3 grid gap-3 md:grid-cols-4">
                  <div>
                    <div className="text-sm text-white/60 mb-1">Distância (km)</div>
                    <input
                      value={b.distanceKm}
                      onChange={(e) => updateBlock(b.id, { distanceKm: e.target.value })}
                      className="w-full h-10 rounded-2xl bg-black/30 border border-white/10 px-3 outline-none focus:border-primary"
                    />
                  </div>

                  <div>
                    <div className="text-sm text-white/60 mb-1">Intensidade</div>
                    <select
                      value={b.intensity}
                      onChange={(e) =>
                        updateBlock(b.id, {
                          intensity: e.target.value as any,
                          paceStr: paceFromIntensity(student?.p1k_sec_per_km || null, e.target.value as any),
                        })
                      }
                      className="w-full h-10 rounded-2xl bg-black/30 border border-white/10 px-3 outline-none focus:border-primary"
                    >
                      <option value="leve">Leve</option>
                      <option value="moderado">Moderado</option>
                      <option value="forte">Forte</option>
                    </select>
                  </div>

                  <div>
                    <div className="text-sm text-white/60 mb-1">Ritmo sugerido</div>
                    <input
                      value={b.paceStr}
                      onChange={(e) => updateBlock(b.id, { paceStr: e.target.value })}
                      className="w-full h-10 rounded-2xl bg-black/30 border border-white/10 px-3 outline-none focus:border-primary"
                    />
                  </div>

                  <div>
                    <div className="text-sm text-white/60 mb-1">Obs</div>
                    <input
                      value={b.note}
                      onChange={(e) => updateBlock(b.id, { note: e.target.value })}
                      className="w-full h-10 rounded-2xl bg-black/30 border border-white/10 px-3 outline-none focus:border-primary"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-2">
            <Button onClick={saveWorkout} disabled={saving}>
              {saving ? 'Salvando…' : 'Criar treino'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
