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
  updated_at: string | null;
  published_at: string | null;
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
  if (!y || !m || !d) return '—';
  return `${d}/${m}/${y}`;
}

function kmLabel(n: number) {
  if (!Number.isFinite(n)) return '0';
  // 1 casa decimal se tiver decimal, senão inteiro
  const s = String(n);
  if (s.includes('.')) return s.replace('.', ',');
  return s;
}

function parseKm(s: string) {
  const v = Number(String(s).replace(',', '.'));
  return Number.isFinite(v) ? v : 0;
}

function sumBlocksKm(blocks: BlockDraft[]) {
  return blocks.reduce((acc, b) => acc + parseKm(b.distanceKm), 0);
}

function workoutNeedsRepublish(w: WorkoutRow) {
  // se published_at ainda não existe/foi preenchido (dados antigos), permite "Republicar" para corrigir
  const pub = (w as any).published_at || null;
  const upd = (w as any).updated_at || null;
  if (pub == null && upd != null) return true;

  // se updated_at > published_at, precisa republicar para aplicar alterações no portal
  if (!pub || !upd) return false;
  const a = new Date(pub).getTime();
  const b = new Date(upd).getTime();
  return b > a + 1000; // margem
}

function randomToken() {
  // token simples (base64url-ish)
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...Array.from(bytes)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function normalizeSlug(s: string) {
  return String(s)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function makeStudentSlug(name: string, id: string) {
  const base = normalizeSlug(name) || 'aluno';
  const suffix = String(id).slice(0, 6);
  return `${base}-${suffix}`;
}

export default function WorkoutEditPage() {
  const router = useRouter();
  const params = useParams() as any;

  const workoutId = (params?.id as string) || '';

  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<string | null>(null);

  const [student, setStudent] = useState<StudentRow | null>(null);
  const [week, setWeek] = useState<WeekRow | null>(null);
  const [workout, setWorkout] = useState<WorkoutRow | null>(null);
  const [locked, setLocked] = useState(false);

  // form
  const [title, setTitle] = useState('');
  const [includeWarmup, setIncludeWarmup] = useState(true);
  const [warmupKm, setWarmupKm] = useState('1');
  const [includeCooldown, setIncludeCooldown] = useState(true);
  const [cooldownKm, setCooldownKm] = useState('1');
  const [plannedDate, setPlannedDate] = useState(''); // YYYY-MM-DD
  const [plannedDateError, setPlannedDateError] = useState<string | null>(null);

  const [blocks, setBlocks] =
    useState<BlockDraft[]>([{ id: 'b1', distanceKm: '', intensity: 'easy', paceStr: '', note: '' }]);

  async function loadAll() {
    setLoading(true);
    setBanner(null);

    // workout
    const { data: w, error: wErr } = await supabase
      .from('workouts')
      .select(
        'id,student_id,trainer_id,week_id,planned_date,planned_day,status,template_type,title,include_warmup,warmup_km,include_cooldown,cooldown_km,blocks,total_km,locked_at,created_at,updated_at,published_at'
      )
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
      const res1 = await supabase.from('weeks').select('id,week_start,week_end,label').eq('id', (w as any).week_id).maybeSingle();

      if (!res1.error) {
        setWeek(res1.data as any);
      } else if (String(res1.error.message || '').toLowerCase().includes('relation') && String(res1.error.message).includes('weeks')) {
        const res2 = await supabase.from('training_weeks').select('id,week_start,week_end,label').eq('id', (w as any).week_id).maybeSingle();
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
    const { count } = await supabase.from('executions').select('*', { count: 'exact', head: true }).eq('workout_id', workoutId);

    const isLocked = !!(w as any).locked_at || (count || 0) > 0 || String((w as any).status) === 'canceled';
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
    if (locked) {
      setBanner('Este treino já teve execução iniciada e não pode mais ser alterado.');
      return;
    }

    const now = new Date().toISOString();

    // Se o treino pertence a uma semana, a data prevista precisa estar dentro dela
    if (workout.week_id) {
      if (!weekStartIso || !weekEndIso) {
        setPlannedDateError('Não foi possível determinar a semana deste treino.');
        setBanner('Semana do treino não encontrada.');
        return;
      }
      if (!plannedDate) {
        setPlannedDateError('Informe a data prevista.');
        setBanner(workout.status === 'ready' ? 'Informe a data prevista para republicar este treino.' : 'Informe a data prevista para publicar este treino.');
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

    if (workout.status === 'ready') {
      // ✅ republica: marca um novo "published_at" para refletir as alterações
      const { error } = await supabase
        .from('workouts')
        .update({
          published_at: now,
          planned_date: workout.week_id ? plannedDate : null,
          planned_day: workout.week_id ? plannedDay : null,
        })
        .eq('id', workout.id);

      if (error) {
        setBanner(error.message);
        return;
      }

      setBanner('Treino republicado (alterações aplicadas para o aluno).');
      await loadAll();
      return;
    }

    // ✅ publica (rascunho -> ready)
    const { error } = await supabase
      .from('workouts')
      .update({
        status: 'ready',
        published_at: now,
        planned_date: workout.week_id ? plannedDate : null,
        planned_day: workout.week_id ? plannedDay : null,
      })
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

    const { data, error } = await supabase.from('students').update(patch).eq('id', student.id).select('id,name,trainer_id,public_slug,portal_token,portal_enabled,p1k_sec_per_km').maybeSingle();
    if (error) return null;

    setStudent(data as any);
    return data as any;
  }

  async function openPortalPreview() {
    if (!student) return;

    const st = await ensurePortalAccess();
    if (!st || !st.public_slug || !st.portal_token) {
      setBanner('Não foi possível habilitar o portal do aluno.');
      return;
    }
    const url = `${window.location.origin}/p/${st.public_slug}/workouts/${workoutId}?t=${encodeURIComponent(st.portal_token)}&preview=1`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  const weekStartIso = week?.week_start || null;
  const weekEndIso = weekStartIso ? (week?.week_end || addDaysIso(weekStartIso, 6)) : null;

  const weekLabel = week ? week.label || `Semana ${formatBR(week.week_start)} – ${formatBR(weekEndIso)}` : '—';

  const totalPreview = (() => {
    const warm = includeWarmup ? parseKm(warmupKm) : 0;
    const cool = includeCooldown ? parseKm(cooldownKm) : 0;
    const blocksKm = sumBlocksKm(blocks);
    return warm + cool + blocksKm;
  })();

  const needsRepublish = workout ? workoutNeedsRepublish(workout as any) : false;

  const publishLabel =
    workout?.status === 'draft'
      ? 'Publicar'
      : workout?.status === 'ready'
        ? needsRepublish
          ? 'Republicar'
          : 'Publicado'
        : workout?.status === 'canceled'
          ? 'Cancelado'
          : 'Encerrado';

  const publishDisabled = locked || !workout || (workout.status !== 'draft' && !(workout.status === 'ready' && needsRepublish));

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
            <div className="text-sm text-slate-600 dark:text-slate-300">Título</div>
            <input
              className="mt-2 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Rodagem leve"
              disabled={locked}
            />
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
            {plannedDateError ? <div className="mt-2 text-xs text-amber-800 dark:text-amber-200">{plannedDateError}</div> : null}
          </div>

          <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button className="px-3 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold disabled:opacity-50" onClick={save} disabled={locked}>
              Salvar
            </button>

            <button
              className="px-3 py-2 rounded-lg bg-primary text-slate-900 text-sm font-semibold disabled:opacity-50"
              onClick={publish}
              disabled={publishDisabled}
              title={
                locked
                  ? 'Edição bloqueada'
                  : workout?.status === 'draft'
                    ? 'Publicar para o aluno'
                    : workout?.status === 'ready'
                      ? needsRepublish
                        ? 'Republicar para aplicar alterações ao aluno'
                        : 'Já está publicado'
                      : workout?.status === 'canceled'
                        ? 'Treino cancelado'
                        : 'Treino encerrado'
              }
            >
              {publishLabel}
            </button>

            <button className="px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-sm font-semibold" onClick={openPortalPreview}>
              Ver no portal (QA)
            </button>
          </div>
        </div>

        {banner && <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 p-3 text-sm text-amber-800 dark:text-amber-200">{banner}</div>}

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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="text-sm text-slate-600 dark:text-slate-300">Aquecimento (km)</div>
                  <input
                    className="mt-2 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3"
                    value={warmupKm}
                    onChange={(e) => setWarmupKm(e.target.value)}
                    disabled={locked || !includeWarmup}
                    inputMode="decimal"
                    placeholder="1,0"
                  />
                </div>

                <div>
                  <div className="text-sm text-slate-600 dark:text-slate-300">Desaquecimento (km)</div>
                  <input
                    className="mt-2 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3"
                    value={cooldownKm}
                    onChange={(e) => setCooldownKm(e.target.value)}
                    disabled={locked || !includeCooldown}
                    inputMode="decimal"
                    placeholder="1,0"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={includeCooldown} onChange={(e) => setIncludeCooldown(e.target.checked)} disabled={locked} />
                Incluir desaquecimento
              </label>
            </div>

            <div className="rounded-2xl bg-white dark:bg-surface-dark shadow p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="font-semibold">Blocos</div>
                <button className="px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-sm font-semibold" onClick={addBlock} disabled={locked}>
                  + Adicionar bloco
                </button>
              </div>

              <div className="space-y-3">
                {blocks.map((b, idx) => (
                  <div key={b.id} className="rounded-2xl border border-slate-200 dark:border-slate-700 p-3">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold">Bloco {idx + 1}</div>
                      {blocks.length > 1 ? (
                        <button className="text-sm underline text-slate-600 dark:text-slate-300" onClick={() => removeBlock(b.id)} disabled={locked}>
                          Remover
                        </button>
                      ) : null}
                    </div>

                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <div className="text-sm text-slate-600 dark:text-slate-300">Distância (km)</div>
                        <input
                          className="mt-2 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3"
                          value={b.distanceKm}
                          onChange={(e) => updateBlock(b.id, { distanceKm: e.target.value })}
                          inputMode="decimal"
                          placeholder="Ex: 2,0"
                          disabled={locked}
                        />
                      </div>

                      <div>
                        <div className="text-sm text-slate-600 dark:text-slate-300">Intensidade</div>
                        <select
                          className="mt-2 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3"
                          value={b.intensity}
                          onChange={(e) => updateBlock(b.id, { intensity: e.target.value as any })}
                          disabled={locked}
                        >
                          <option value="easy">Leve</option>
                          <option value="moderate">Moderado</option>
                          <option value="hard">Forte</option>
                        </select>
                      </div>

                      <div>
                        <div className="text-sm text-slate-600 dark:text-slate-300">Ritmo sugerido (opcional)</div>
                        <input
                          className="mt-2 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3"
                          value={b.paceStr}
                          onChange={(e) => updateBlock(b.id, { paceStr: e.target.value })}
                          placeholder="Ex: 5:30/km"
                          disabled={locked}
                        />
                      </div>

                      <div>
                        <div className="text-sm text-slate-600 dark:text-slate-300">Obs (opcional)</div>
                        <input
                          className="mt-2 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3"
                          value={b.note}
                          onChange={(e) => updateBlock(b.id, { note: e.target.value })}
                          placeholder="Ex: manter respiração"
                          disabled={locked}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : null}
      </div>
    </main>
  );
}
