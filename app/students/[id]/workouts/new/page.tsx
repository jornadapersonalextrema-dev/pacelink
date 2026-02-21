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

function getSaoPauloISODate(date = new Date()) {
  // yyyy-mm-dd no fuso de São Paulo (evita bug de fuso no mobile)
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const y = Number(parts.find((p) => p.type === 'year')?.value || 1970);
  const m = Number(parts.find((p) => p.type === 'month')?.value || 1);
  const d = Number(parts.find((p) => p.type === 'day')?.value || 1);

  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function maxISO(a: string, b: string) {
  return a >= b ? a : b;
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
  const copyFrom = search?.get('copyFrom');

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

  // Data de hoje (fuso SP) para validações do calendário
  const todayISO = useMemo(() => getSaoPauloISODate(new Date()), []);

  // Opção B: não permitir criar treino em semana passada (semana já encerrada)
  const isPastWeekBlocked = useMemo(() => {
    if (!weekId) return false;
    if (!weekStartISO || !weekEndISO) return false;
    return weekEndISO < todayISO;
  }, [weekId, weekStartISO, weekEndISO, todayISO]);

  // min/max do calendário
  // - semana futura: min = week_start
  // - semana atual: min = hoje
  // - semana passada: bloqueado (min/max não importam)
  const minPlannedISO = useMemo(() => {
    if (!weekId) return '';
    if (!weekStartISO || !weekEndISO) return '';
    if (weekEndISO < todayISO) return '';
    return maxISO(weekStartISO, todayISO);
  }, [weekId, weekStartISO, weekEndISO, todayISO]);

  const maxPlannedISO = useMemo(() => {
    if (!weekId) return '';
    if (!weekStartISO || !weekEndISO) return '';
    return weekEndISO;
  }, [weekId, weekStartISO, weekEndISO]);

  const [title, setTitle] = useState<string>('Treino');
  const [templateType, setTemplateType] = useState<string>('easy_run');
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
    () => computeTotalKm(includeWarmup ? parseKm(warmupKm) : 0, includeCooldown ? parseKm(cooldownKm) : 0, blocks),
    [includeWarmup, warmupKm, includeCooldown, cooldownKm, blocks]
  );

  useEffect(() => {
    // default: se veio por semana, define uma data válida automaticamente
    // - semana passada: limpa e bloqueia
    // - semana atual: hoje
    // - semana futura: início da semana
    if (!weekId || !weekStartISO) return;

    if (isPastWeekBlocked) {
      if (plannedDate) setPlannedDate('');
      return;
    }

    const min = minPlannedISO || weekStartISO;
    const max = maxPlannedISO || weekEndISO;

    if (!plannedDate) {
      setPlannedDate(min);
      return;
    }

    if (plannedDate < min) setPlannedDate(min);
    else if (max && plannedDate > max) setPlannedDate(max);
  }, [weekId, weekStartISO, weekEndISO, plannedDate, isPastWeekBlocked, minPlannedISO, maxPlannedISO]);

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

        // CopyFrom: pré-preenchimento ao copiar um treino existente
        if (copyFrom) {
          const { data: sess } = await supabase.auth.getSession();
          const trainerId = sess?.session?.user?.id;
          if (!trainerId) throw new Error('Você precisa estar logado como treinador.');

          const { data: src, error: srcErr } = await supabase
            .from('workouts')
            .select('id,title,template_type,include_warmup,warmup_km,include_cooldown,cooldown_km,blocks,total_km')
            .eq('id', copyFrom)
            .eq('trainer_id', trainerId)
            .maybeSingle();

          if (srcErr) throw srcErr;
          if (!src) throw new Error('Treino de origem não encontrado.');

          if (!mounted) return;

          setTitle((src as any).title || 'Treino');
          setTemplateType((src as any).template_type || 'easy_run');

          setIncludeWarmup(!!(src as any).include_warmup);
          if ((src as any).warmup_km != null) setWarmupKm(String((src as any).warmup_km));
          setIncludeCooldown(!!(src as any).include_cooldown);
          if ((src as any).cooldown_km != null) setCooldownKm(String((src as any).cooldown_km));

          const srcBlocks = Array.isArray((src as any).blocks) ? (src as any).blocks : [];
          if (srcBlocks.length > 0) {
            setBlocks(
              srcBlocks.map((b: any) => ({
                id: uid(),
                distanceKm: String(b.distance_km ?? b.distanceKm ?? 1),
                intensity: (b.intensity === 'leve' || b.intensity === 'moderado' || b.intensity === 'forte') ? b.intensity : 'moderado',
                paceStr: String(b.pace_str ?? b.paceStr ?? ''),
                note: String(b.notes ?? b.note ?? ''),
              }))
            );
          }
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
  }, [supabase, studentId, weekId, copyFrom]);

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
        template_type: templateType,
        title: title?.trim() || null,
        include_warmup: includeWarmup,
        warmup_km: warm,
        include_cooldown: includeCooldown,
        cooldown_km: cool,
        total_km: totalKm,
        blocks: blocks.map((b) => ({
          distance_km: parseKm(b.distanceKm),
          intensity: b.intensity,
          pace_str: b.paceStr || null,
          notes: b.note || null,
        })),
      };

      const insertPayload: any = { ...payload };
      if (weekId) insertPayload.week_id = weekId;

      if (weekId) {
        if (isPastWeekBlocked) {
          throw new Error('Não é permitido criar treino em semana passada. Selecione a semana atual ou uma semana futura.');
        }

        if (!plannedDate) {
          throw new Error('Informe a data prevista para realização do treino.');
        }

        if (minPlannedISO && plannedDate < minPlannedISO) {
          throw new Error(`A data prevista não pode ser anterior a ${formatDateBR(minPlannedISO)}.`);
        }
        if (maxPlannedISO && plannedDate > maxPlannedISO) {
          throw new Error(`A data prevista precisa estar dentro da semana (${formatDateBR(weekStartISO)} – ${formatDateBR(weekEndISO)}).`);
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

      const { data: inserted, error } = await supabase.from('workouts').insert(insertPayload).select('id').single();
      if (error) throw error;

      router.push(`/workouts/${inserted.id}/edit`);
    } catch (e: any) {
      setErr(e?.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  const headerTitle = student?.name || 'Aluno';
  const weekLabel = weekStartISO && weekEndISO ? (week?.label || formatWeekLabel(weekStartISO, weekEndISO)) : null;

  return (
    <div className="min-h-screen bg-background-dark text-white">
      <Topbar title="Novo treino" />

      <div className="max-w-4xl mx-auto px-5 pb-20">
        <div className="pt-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-3xl font-black leading-tight break-words">{headerTitle}</div>
              <div className="text-white/70 mt-1">
                Ritmo P1k: <b>{secToPaceStr(student?.p1k_sec_per_km || null)}</b>
              </div>
              {weekLabel ? <div className="text-white/50 text-sm mt-1">{weekLabel}</div> : null}
              {copyFrom ? <div className="text-white/50 text-sm mt-1">Cópia de treino: {copyFrom}</div> : null}
            </div>

            <button
              className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-bold text-white/80 hover:bg-white/5"
              onClick={() => router.back()}
            >
              Voltar
            </button>
          </div>

          {err ? (
            <div className="mt-4 rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4 text-amber-200">
              {err}
            </div>
          ) : null}

          {loading ? <div className="mt-6 text-white/70">Carregando…</div> : null}

          <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-5">
            <div className="text-sm text-white/60 mb-1">Título</div>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full md:w-[520px] h-12 rounded-2xl bg-black/30 border border-white/10 px-4 outline-none focus:border-primary"
              placeholder="Ex.: Intervalado curto"
            />

            {weekStartISO && (
              <div className="mt-4">
                <div className="text-sm text-white/60 mb-1">Data prevista</div>
                <input
                  type="date"
                  value={plannedDate}
                  onChange={(e) => setPlannedDate(e.target.value)}
                  min={minPlannedISO || undefined}
                  max={maxPlannedISO || undefined}
                  disabled={isPastWeekBlocked}
                  className="w-full md:w-64 h-12 rounded-2xl bg-black/30 border border-white/10 px-4 outline-none focus:border-primary disabled:opacity-60"
                />
                {weekStartISO && weekEndISO && (
                  <div className="mt-1 text-xs text-white/50">
                    Selecione uma data dentro da semana ({formatDateBR(weekStartISO)} – {formatDateBR(weekEndISO)}).
                    {weekId && !isPastWeekBlocked && minPlannedISO && minPlannedISO > weekStartISO ? (
                      <span> Como a semana é a semana atual, a data mínima é hoje ({formatDateBR(minPlannedISO)}).</span>
                    ) : null}
                  </div>
                )}

                {weekId && isPastWeekBlocked ? (
                  <div className="mt-2 text-sm text-amber-200">
                    Semana passada: não é permitido criar treino em uma semana já encerrada. Selecione a semana atual ou uma futura.
                  </div>
                ) : null}
              </div>
            )}

            <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-6 mt-6">
              <label className="flex items-center gap-2">
                <input checked={includeWarmup} onChange={(e) => setIncludeWarmup(e.target.checked)} type="checkbox" />
                <span>Aquecimento</span>
              </label>

              <div className="flex items-center gap-2">
                <div className="text-white/60 text-sm">km</div>
                <input
                  value={warmupKm}
                  onChange={(e) => setWarmupKm(e.target.value)}
                  className="w-24 h-12 rounded-2xl bg-black/30 border border-white/10 px-4 outline-none focus:border-primary"
                />
              </div>
            </div>

            <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-6 mt-4">
              <label className="flex items-center gap-2">
                <input checked={includeCooldown} onChange={(e) => setIncludeCooldown(e.target.checked)} type="checkbox" />
                <span>Desaquecimento</span>
              </label>

              <div className="flex items-center gap-2">
                <div className="text-white/60 text-sm">km</div>
                <input
                  value={cooldownKm}
                  onChange={(e) => setCooldownKm(e.target.value)}
                  className="w-24 h-12 rounded-2xl bg-black/30 border border-white/10 px-4 outline-none focus:border-primary"
                />
              </div>
            </div>

            <div className="mt-6">
              <div className="text-lg font-black mb-2">Blocos</div>

              <div className="space-y-3">
                {blocks.map((b, idx) => (
                  <div key={b.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="font-bold">Bloco {idx + 1}</div>
                      <button
                        className="text-sm underline text-white/70 hover:text-white"
                        onClick={() => setBlocks((prev) => prev.filter((x) => x.id !== b.id))}
                        disabled={blocks.length <= 1}
                      >
                        Remover
                      </button>
                    </div>

                    <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <div className="text-xs text-white/60 mb-1">Distância (km)</div>
                        <input
                          value={b.distanceKm}
                          onChange={(e) =>
                            setBlocks((prev) => prev.map((x) => (x.id === b.id ? { ...x, distanceKm: e.target.value } : x)))
                          }
                          className="w-full h-12 rounded-2xl bg-black/30 border border-white/10 px-4 outline-none focus:border-primary"
                        />
                      </div>

                      <div>
                        <div className="text-xs text-white/60 mb-1">Intensidade</div>
                        <select
                          value={b.intensity}
                          onChange={(e) =>
                            setBlocks((prev) =>
                              prev.map((x) =>
                                x.id === b.id
                                  ? { ...x, intensity: e.target.value as any, paceStr: paceFromIntensity(student?.p1k_sec_per_km || null, e.target.value as any) }
                                  : x
                              )
                            )
                          }
                          className="w-full h-12 rounded-2xl bg-black/30 border border-white/10 px-4 outline-none focus:border-primary"
                        >
                          <option value="leve">Leve</option>
                          <option value="moderado">Moderado</option>
                          <option value="forte">Forte</option>
                        </select>
                      </div>

                      <div>
                        <div className="text-xs text-white/60 mb-1">Ritmo sugerido</div>
                        <input
                          value={b.paceStr}
                          onChange={(e) =>
                            setBlocks((prev) => prev.map((x) => (x.id === b.id ? { ...x, paceStr: e.target.value } : x)))
                          }
                          className="w-full h-12 rounded-2xl bg-black/30 border border-white/10 px-4 outline-none focus:border-primary"
                          placeholder="Ex.: 4:30/km"
                        />
                      </div>
                    </div>

                    <div className="mt-3">
                      <div className="text-xs text-white/60 mb-1">Observação</div>
                      <input
                        value={b.note}
                        onChange={(e) =>
                          setBlocks((prev) => prev.map((x) => (x.id === b.id ? { ...x, note: e.target.value } : x)))
                        }
                        className="w-full h-12 rounded-2xl bg-black/30 border border-white/10 px-4 outline-none focus:border-primary"
                        placeholder="Ex.: manter cadência alta"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-3 flex items-center gap-3">
                <button
                  className="rounded-2xl border border-white/10 px-4 py-2 font-bold hover:bg-white/5"
                  onClick={() =>
                    setBlocks((prev) => [
                      ...prev,
                      { id: uid(), distanceKm: '1', intensity: 'moderado', paceStr: paceFromIntensity(student?.p1k_sec_per_km || null, 'moderado'), note: '' },
                    ])
                  }
                >
                  + Adicionar bloco
                </button>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-white/70">Total</div>
                <div className="text-lg font-black">{totalKm} km</div>
              </div>
            </div>

            <div className="pt-2">
              <Button onClick={saveWorkout} disabled={saving || (weekId ? isPastWeekBlocked : false)}>
                {saving ? 'Salvando…' : 'Criar treino'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}