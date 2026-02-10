'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '../../../../lib/supabaseBrowser';

type StudentRow = {
  id: string;
  name: string;
  trainer_id: string;
  public_slug: string | null;
  portal_token: string | null;
  portal_enabled: boolean;
  p1k_sec_per_km: number | null;
};

type WeekRow = {
  id: string;
  week_start: string;
  week_end: string | null;
  label: string | null;
};

type WorkoutRow = {
  id: string;
  student_id: string;
  trainer_id: string;
  week_id: string | null;
  planned_date: string | null;
  planned_day: number | null;
  status: 'draft' | 'ready' | 'archived' | 'canceled';
  template_type: string;
  title: string | null;
  include_warmup: boolean;
  warmup_km: number | null;
  include_cooldown: boolean;
  cooldown_km: number | null;
  blocks: any[] | null;
  total_km: number;
  locked_at: string | null;
  created_at: string;
};

type BlockDraft = {
  id: string;
  distanceKm: string;
  intensity: 'easy' | 'moderate' | 'hard';
  paceStr: string; // texto livre (ex: 6:00–6:30/km)
  note: string;
};

function pad2(n: number) {
  return String(n).padStart(2, '0');
}


function isoToUTCDate(iso: string) {
  // iso: YYYY-MM-DD
  const [y, m, d] = String(iso).split('-').map((x) => Number(x));
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1));
}

function addDaysIso(iso: string, days: number) {
  const dt = isoToUTCDate(iso);
  dt.setUTCDate(dt.getUTCDate() + days);
  const y = dt.getUTCFullYear();
  const m = pad2(dt.getUTCMonth() + 1);
  const d = pad2(dt.getUTCDate());
  return `${y}-${m}-${d}`;
}

function diffDays(fromIso: string, toIso: string) {
  const a = isoToUTCDate(fromIso).getTime();
  const b = isoToUTCDate(toIso).getTime();
  return Math.round((b - a) / 86400000);
}

function formatBR(iso: string | null) {
  if (!iso) return '—';
  const [y, m, d] = String(iso).split('-');
  if (!y || !m || !d) return String(iso);
  return `${d}/${m}/${y}`;
}

function kmLabel(km: number | null) {
  if (km == null) return '';
  return Number(km).toFixed(1).replace('.', ',');
}

function parseKm(v: string) {
  const n = Number(String(v || '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

function sumBlocksKm(blocks: BlockDraft[]) {
  return blocks.reduce((acc, b) => acc + (b.distanceKm.trim() ? parseKm(b.distanceKm) : 0), 0);
}

function formatPace(secPerKm: number | null) {
  if (!secPerKm || !Number.isFinite(secPerKm)) return '';
  const total = Math.max(0, Math.floor(secPerKm));
  const mm = Math.floor(total / 60);
  const ss = total % 60;
  return `${mm}:${ss.toString().padStart(2, '0')}/km`;
}

function suggestedPaceByIntensity(p1k: number | null, intensity: BlockDraft['intensity']) {
  if (!p1k || !Number.isFinite(p1k)) return '';
  const base = p1k;

  // heurística simples (ajuste depois se quiser):
  // easy: +20% mais lento; moderate: +10%; hard: -5%
  const factor = intensity === 'easy' ? 1.2 : intensity === 'moderate' ? 1.1 : 0.95;
  return formatPace(base * factor);
}

function slugify(s: string) {
  return (s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

function makeStudentSlug(name: string, id: string) {
  const base = slugify(name) || 'aluno';
  const suffix = (id || '').replace(/-/g, '').slice(0, 6) || '000000';
  return `${base}-${suffix}`;
}

function randomToken() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    // @ts-ignore
    return crypto.randomUUID().replace(/-/g, '');
  }
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

export default function WorkoutEditPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const workoutId = params.id;

  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<string | null>(null);

  const [workout, setWorkout] = useState<WorkoutRow | null>(null);
  const [student, setStudent] = useState<StudentRow | null>(null);
  const [week, setWeek] = useState<WeekRow | null>(null);

  const [locked, setLocked] = useState(false);

  const [title, setTitle] = useState('');
  const [includeWarmup, setIncludeWarmup] = useState(false);
  const [warmupKm, setWarmupKm] = useState('');
  const [includeCooldown, setIncludeCooldown] = useState(false);
  const [cooldownKm, setCooldownKm] = useState('');

  const [plannedDate, setPlannedDate] = useState('');
  const [plannedDateError, setPlannedDateError] = useState<string | null>(null);


  const [blocks, setBlocks] = useState<BlockDraft[]>([
    { id: 'b1', distanceKm: '', intensity: 'easy', paceStr: '', note: '' },
  ]);

  async function loadAll() {
    setLoading(true);
    setBanner(null);

    // workout
    const { data: w, error: wErr } = await supabase
      .from('workouts')
      .select('id,student_id,trainer_id,week_id,planned_date,planned_day,status,template_type,title,include_warmup,warmup_km,include_cooldown,cooldown_km,blocks,total_km,locked_at,created_at')
      .eq('id', workoutId)
      .maybeSingle();

    if (wErr) {
      setBanner(wErr.message);
      setLoading(false);
      return;
    }
    if (!w) {
      setBanner('Treino não encontrado.');
      setLoading(false);
      return;
    }

    setWorkout(w as any);

    // student
    const { data: st, error: stErr } = await supabase
      .from('students')
      .select('id,name,trainer_id,public_slug,portal_token,portal_enabled,p1k_sec_per_km')
      .eq('id', (w as any).student_id)
      .maybeSingle();

    if (stErr) {
      setBanner(stErr.message);
      setLoading(false);
      return;
    }
    setStudent(st as any);

    // week (fallback weeks -> training_weeks)
    if ((w as any).week_id) {
      const res1 = await supabase
        .from('weeks')
        .select('id,week_start,week_end,label')
        .eq('id', (w as any).week_id)
        .maybeSingle();

      if (!res1.error) {
        setWeek(res1.data as any);
      } else if (String(res1.error.message || '').toLowerCase().includes('relation') && String(res1.error.message).includes('weeks')) {
        const res2 = await supabase
          .from('training_weeks')
          .select('id,week_start,week_end,label')
          .eq('id', (w as any).week_id)
          .maybeSingle();
        if (res2.error) {
          setBanner(res2.error.message);
          setLoading(false);
          return;
        }
        setWeek(res2.data as any);
      } else {
        setBanner(res1.error.message);
        setLoading(false);
        return;
      }
    }

    // lock check (any execution)
    const { count } = await supabase
      .from('executions')
      .select('*', { count: 'exact', head: true })
      .eq('workout_id', workoutId);

    const isLocked = !!(w as any).locked_at || (count || 0) > 0;
    setLocked(isLocked);

    // populate form
    setTitle((w as any).title || '');
    setIncludeWarmup(!!(w as any).include_warmup);
    setWarmupKm((w as any).warmup_km != null ? kmLabel((w as any).warmup_km) : '');
    setIncludeCooldown(!!(w as any).include_cooldown);
    setCooldownKm((w as any).cooldown_km != null ? kmLabel((w as any).cooldown_km) : '');

    setPlannedDate((w as any).planned_date || '');
    setPlannedDateError(null);

    const rawBlocks = Array.isArray((w as any).blocks) ? ((w as any).blocks as any[]) : [];
    setBlocks(
      rawBlocks.length > 0
        ? rawBlocks.map((b, idx) => ({
            id: `b${idx + 1}`,
            distanceKm: String(b?.distance_km ?? ''),
            intensity: (b?.intensity ?? 'easy') as any,
            paceStr: String(b?.pace ?? b?.pace_suggested ?? b?.ritmo ?? ''),
            note: String(b?.notes ?? b?.note ?? ''),
          }))
        : [{ id: 'b1', distanceKm: '', intensity: 'easy', paceStr: '', note: '' }]
    );

    setLoading(false);
  }

  useEffect(() => {
    if (!workoutId) return;
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workoutId]);

  function updateBlock(id: string, patch: Partial<BlockDraft>) {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  }

  function addBlock() {
    const nextId = `b${blocks.length + 1}`;
    setBlocks((prev) => [...prev, { id: nextId, distanceKm: '', intensity: 'easy', paceStr: '', note: '' }]);
  }

  function removeBlock(id: string) {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
  }

  function blocksPayload() {
    return blocks
      .filter((b) => b.distanceKm.trim() !== '')
      .map((b) => ({
        distance_km: parseKm(b.distanceKm),
        intensity: b.intensity,
        pace: b.paceStr || null,
        notes: b.note || null,
      }));
  }

  async function save() {
    if (!workout) return;
    if (locked) {
      setBanner('Este treino já teve execução iniciada e não pode mais ser editado.');
      return;
    }

    setBanner(null);

    // Data prevista deve estar dentro da semana planejada
    if (workout.week_id) {
      if (!weekStartIso || !weekEndIso) {
        setPlannedDateError('Não foi possível determinar a semana deste treino.');
        setBanner('Semana do treino não encontrada.');
        return;
      }
      if (!plannedDate) {
        setPlannedDateError('Informe a data prevista.');
        setBanner('Informe a data prevista para este treino.');
        return;
      }
      if (plannedDate < weekStartIso || plannedDate > weekEndIso) {
        setPlannedDateError(`A data prevista deve estar entre ${formatBR(weekStartIso)} e ${formatBR(weekEndIso)}.`);
        setBanner('A data prevista deve estar dentro da semana planejada.');
        return;
      }
      setPlannedDateError(null);
    }

    const warm = includeWarmup ? parseKm(warmupKm) : 0;
    const cool = includeCooldown ? parseKm(cooldownKm) : 0;
    const blocksKm = sumBlocksKm(blocks);
    const totalKm = warm + cool + blocksKm;

    const plannedDay = workout.week_id && plannedDate && weekStartIso ? diffDays(weekStartIso, plannedDate) : null;

    const payload = {
      title: title || null,
      planned_date: workout.week_id ? plannedDate : null,
      planned_day: workout.week_id ? plannedDay : null,
      include_warmup: includeWarmup,
      warmup_km: includeWarmup ? warm : null,
      include_cooldown: includeCooldown,
      cooldown_km: includeCooldown ? cool : null,
      blocks: blocksPayload(),
      total_km: totalKm,
    };

    const { error } = await supabase.from('workouts').update(payload).eq('id', workout.id);
    if (error) {
      setBanner(error.message);
      return;
    }

    setBanner('Treino salvo.');
    await loadAll();
  }

  async function publish() {
    if (!workout) return;
    setBanner(null);

    // Se o treino pertence a uma semana, a data prevista precisa estar dentro dela
    if (workout.week_id) {
      if (!weekStartIso || !weekEndIso) {
        setPlannedDateError('Não foi possível determinar a semana deste treino.');
        setBanner('Semana do treino não encontrada.');
        return;
      }
      if (!plannedDate) {
        setPlannedDateError('Informe a data prevista.');
        setBanner('Informe a data prevista para publicar este treino.');
        return;
      }
      if (plannedDate < weekStartIso || plannedDate > weekEndIso) {
        setPlannedDateError(`A data prevista deve estar entre ${formatBR(weekStartIso)} e ${formatBR(weekEndIso)}.`);
        setBanner('A data prevista deve estar dentro da semana planejada.');
        return;
      }
      setPlannedDateError(null);
    }

    const plannedDay = workout.week_id && plannedDate && weekStartIso ? diffDays(weekStartIso, plannedDate) : null;

    const { error } = await supabase
      .from('workouts')
      .update({ status: 'ready', planned_date: workout.week_id ? plannedDate : null, planned_day: workout.week_id ? plannedDay : null })
      .eq('id', workout.id);
    if (error) {
      setBanner(error.message);
      return;
    }

    setBanner('Treino publicado (disponível para o aluno).');
    await loadAll();
  }

  async function ensurePortalAccess() {
    if (!student) return null;

    const patch: any = {};
    if (!student.public_slug) patch.public_slug = makeStudentSlug(student.name, student.id);
    if (!student.portal_token) patch.portal_token = randomToken();
    if (!student.portal_enabled) patch.portal_enabled = true;

    if (Object.keys(patch).length === 0) return student;

    const { data, error } = await supabase
      .from('students')
      .update(patch)
      .eq('id', student.id)
      .select('id,name,trainer_id,public_slug,portal_token,portal_enabled,p1k_sec_per_km')
      .maybeSingle();

    if (error) {
      setBanner(error.message);
      return null;
    }

    setStudent(data as any);
    return data as any as StudentRow;
  }

  async function openPortalPreview() {
    setBanner(null);
    const st = await ensurePortalAccess();
    if (!st?.public_slug || !st.portal_token) {
      setBanner('Não foi possível habilitar o portal do aluno.');
      return;
    }
    const url = `${window.location.origin}/p/${st.public_slug}/workouts/${workoutId}?t=${encodeURIComponent(st.portal_token)}&preview=1`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  const weekStartIso = week?.week_start || null;
  const weekEndIso = weekStartIso ? (week?.week_end || addDaysIso(weekStartIso, 6)) : null;

  const weekLabel = week
    ? week.label || `Semana ${formatBR(week.week_start)} – ${formatBR(weekEndIso)}`
    : '—';
  const totalPreview = (() => {
    const warm = includeWarmup ? parseKm(warmupKm) : 0;
    const cool = includeCooldown ? parseKm(cooldownKm) : 0;
    const blocksKm = sumBlocksKm(blocks);
    return warm + cool + blocksKm;
  })();

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="rounded-2xl bg-white dark:bg-surface-dark shadow p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm text-slate-600 dark:text-slate-300">Editar treino</div>
              <div className="text-xl font-semibold truncate">{title || workout?.title || 'Treino'}</div>
              <div className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                Aluno: <span className="font-semibold">{student?.name ?? '—'}</span> · {weekLabel}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Status: <b>{workout?.status ?? '—'}</b> · Total (preview): <b>{kmLabel(totalPreview)} km</b>
                {locked ? ' · Edição bloqueada (já teve execução iniciada)' : ''}
              </div>
            </div>

            <div className="shrink-0 flex flex-col items-end gap-2">
              <button className="text-sm underline text-slate-600 dark:text-slate-300" onClick={() => router.back()}>
                Voltar
              </button>
            </div>
          </div>


          <div className="mt-4">
            <div className="text-sm text-slate-600 dark:text-slate-300">Data prevista</div>
            <input
              type="date"
              className="mt-2 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3"
              value={plannedDate}
              min={weekStartIso || undefined}
              max={weekEndIso || undefined}
              onChange={(e) => {
                setPlannedDate(e.target.value);
                setPlannedDateError(null);
              }}
              disabled={locked}
            />
            {weekStartIso && weekEndIso ? (
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Deve estar entre <b>{formatBR(weekStartIso)}</b> e <b>{formatBR(weekEndIso)}</b>.
              </div>
            ) : null}
            {plannedDateError ? (
              <div className="mt-2 text-xs text-amber-800 dark:text-amber-200">{plannedDateError}</div>
            ) : null}
          </div>

          <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button
              className="px-3 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold disabled:opacity-50"
              onClick={save}
              disabled={locked}
            >
              Salvar
            </button>

            <button
              className="px-3 py-2 rounded-lg bg-primary text-slate-900 text-sm font-semibold disabled:opacity-50"
              onClick={publish}
              disabled={workout?.status === 'ready'}
              title={workout?.status === 'ready' ? 'Já está publicado' : 'Publicar para o aluno'}
            >
              Publicar
            </button>

            <button className="px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-sm font-semibold" onClick={openPortalPreview}>
              Ver no portal (QA)
            </button>
          </div>
        </div>

        {banner && (
          <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 p-3 text-sm text-amber-800 dark:text-amber-200">{banner}</div>
        )}

        {loading ? (
          <div className="text-sm text-slate-600 dark:text-slate-300">Carregando…</div>
        ) : workout ? (
          <>
            <div className="rounded-2xl bg-white dark:bg-surface-dark shadow p-4 space-y-3">
              <div className="font-semibold">Aquecimento / Desaquecimento</div>

              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={includeWarmup} onChange={(e) => setIncludeWarmup(e.target.checked)} disabled={locked} />
                Incluir aquecimento
              </label>

              {includeWarmup ? (
                <div>
                  <div className="text-sm text-slate-600 dark:text-slate-300">Aquecimento (km)</div>
                  <input
                    className="mt-2 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3"
                    value={warmupKm}
                    onChange={(e) => setWarmupKm(e.target.value)}
                    inputMode="decimal"
                    disabled={locked}
                  />
                </div>
              ) : null}

              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={includeCooldown} onChange={(e) => setIncludeCooldown(e.target.checked)} disabled={locked} />
                Incluir desaquecimento
              </label>

              {includeCooldown ? (
                <div>
                  <div className="text-sm text-slate-600 dark:text-slate-300">Desaquecimento (km)</div>
                  <input
                    className="mt-2 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3"
                    value={cooldownKm}
                    onChange={(e) => setCooldownKm(e.target.value)}
                    inputMode="decimal"
                    disabled={locked}
                  />
                </div>
              ) : null}
            </div>

            <div className="rounded-2xl bg-white dark:bg-surface-dark shadow p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="font-semibold">Blocos</div>
                <button
                  className="px-3 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold disabled:opacity-50"
                  onClick={addBlock}
                  disabled={locked}
                >
                  + Adicionar bloco
                </button>
              </div>

              <div className="mt-3 space-y-3">
                {blocks.map((b, idx) => {
                  const autoPace = suggestedPaceByIntensity(student?.p1k_sec_per_km ?? null, b.intensity);
                  return (
                    <div key={b.id} className="rounded-xl border border-slate-200 dark:border-slate-700 p-3">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-semibold">Bloco {idx + 1}</div>
                        <button
                          className="text-sm underline text-slate-600 dark:text-slate-300 disabled:opacity-50"
                          onClick={() => removeBlock(b.id)}
                          disabled={locked || blocks.length <= 1}
                        >
                          Remover
                        </button>
                      </div>

                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <div className="text-sm text-slate-600 dark:text-slate-300">Distância (km)</div>
                          <input
                            className="mt-2 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3"
                            value={b.distanceKm}
                            onChange={(e) => updateBlock(b.id, { distanceKm: e.target.value })}
                            inputMode="decimal"
                            disabled={locked}
                          />
                        </div>

                        <div>
                          <div className="text-sm text-slate-600 dark:text-slate-300">Intensidade</div>
                          <select
                            className="mt-2 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3"
                            value={b.intensity}
                            onChange={(e) => {
                              const v = e.target.value as BlockDraft['intensity'];
                              updateBlock(b.id, {
                                intensity: v,
                                paceStr: b.paceStr || suggestedPaceByIntensity(student?.p1k_sec_per_km ?? null, v),
                              });
                            }}
                            disabled={locked}
                          >
                            <option value="easy">Leve</option>
                            <option value="moderate">Moderado</option>
                            <option value="hard">Forte</option>
                          </select>
                        </div>

                        <div>
                          <div className="text-sm text-slate-600 dark:text-slate-300">Ritmo sugerido (opcional)</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                            Sugestão automática: <b>{autoPace || '—'}</b>
                          </div>
                          <input
                            className="mt-2 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3"
                            value={b.paceStr}
                            onChange={(e) => updateBlock(b.id, { paceStr: e.target.value })}
                            placeholder={autoPace || 'Ex: 6:00–6:30/km'}
                            disabled={locked}
                          />
                        </div>

                        <div>
                          <div className="text-sm text-slate-600 dark:text-slate-300">Obs (opcional)</div>
                          <input
                            className="mt-2 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3"
                            value={b.note}
                            onChange={(e) => updateBlock(b.id, { note: e.target.value })}
                            placeholder="Ex: manter respiração controlada"
                            disabled={locked}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        ) : null}
      </div>
    </main>
  );
}
