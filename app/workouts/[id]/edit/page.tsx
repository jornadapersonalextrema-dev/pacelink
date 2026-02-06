'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

import Topbar from '../../../../components/Topbar';
import Button from '../../../../components/Button';
import { createClient } from '../../../../lib/supabaseBrowser';

type Block = {
  distanceKm: number;
  intensity: 'easy' | 'moderate' | 'hard';
  paceStr: string; // ex: "4:30/km"
  note: string; // observações do bloco
};

type WorkoutRow = {
  id: string;
  student_id: string;
  trainer_id: string;
  title: string;
  template_type: string;
  status: string;
  planned_date: string | null;
  total_km: number | null;
  blocks: any[] | null;
};

type StudentRow = { id: string; name: string; p1k_pace: string | null };

const DEFAULT_BLOCK: Block = { distanceKm: 1, intensity: 'moderate', paceStr: '', note: '' };

function safeNumber(v: any, fallback = 0): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function normalizePaceInput(raw: string): string {
  const v = (raw ?? '').trim();
  if (!v) return '';
  // aceita "4:30", "04:30", "4:30/km", "4:30 / km"
  const compact = v.replace(/\s+/g, '');
  if (/^\d{1,2}:\d{2}\/km$/i.test(compact)) return compact.toLowerCase();
  if (/^\d{1,2}:\d{2}$/.test(compact)) return `${compact}/km`;
  return compact.toLowerCase();
}

function paceStrToSecondsPerKm(paceStr: string): number | null {
  const v = normalizePaceInput(paceStr);
  if (!v) return null;
  const m = v.match(/^(\d{1,2}):(\d{2})(?:\/km)?$/i);
  if (!m) return null;
  const min = Number(m[1]);
  const sec = Number(m[2]);
  if (!Number.isFinite(min) || !Number.isFinite(sec) || sec >= 60) return null;
  return min * 60 + sec;
}

function secondsPerKmToPaceStr(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${mm}:${String(ss).padStart(2, '0')}/km`;
}

function readBlockPace(b: any): string {
  // 1) string direto
  const str =
    (typeof b?.paceStr === 'string' && b.paceStr) ||
    (typeof b?.pace_str === 'string' && b.pace_str) ||
    (typeof b?.pace === 'string' && b.pace) ||
    (typeof b?.pace_suggested === 'string' && b.pace_suggested) ||
    '';
  if (str) return normalizePaceInput(str);

  // 2) número em segundos por km
  const sec =
    (typeof b?.pace_sec_per_km === 'number' && b.pace_sec_per_km) ||
    (typeof b?.paceSecPerKm === 'number' && b.paceSecPerKm) ||
    null;

  return typeof sec === 'number' ? secondsPerKmToPaceStr(sec) : '';
}

function readBlockNote(b: any): string {
  const v =
    (typeof b?.note === 'string' && b.note) ||
    (typeof b?.obs === 'string' && b.obs) ||
    (typeof b?.observacao === 'string' && b.observacao) ||
    '';
  return (v ?? '').toString();
}

export default function EditWorkoutPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const workoutId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [student, setStudent] = useState<StudentRow | null>(null);
  const [workout, setWorkout] = useState<WorkoutRow | null>(null);

  // form
  const [title, setTitle] = useState('');
  const [plannedDate, setPlannedDate] = useState<string>('');
  const [templateType, setTemplateType] = useState<string>('easy_run');
  const [warmup, setWarmup] = useState<boolean>(false);
  const [warmupKm, setWarmupKm] = useState<number>(1);
  const [cooldown, setCooldown] = useState<boolean>(false);
  const [cooldownKm, setCooldownKm] = useState<number>(1);
  const [blocks, setBlocks] = useState<Block[]>([DEFAULT_BLOCK]);

  const totalKm = useMemo(() => {
    const bsum = blocks.reduce((acc, b) => acc + (Number.isFinite(b.distanceKm) ? b.distanceKm : 0), 0);
    const w = warmup ? warmupKm : 0;
    const c = cooldown ? cooldownKm : 0;
    return Math.round((bsum + w + c) * 100) / 100;
  }, [blocks, warmup, warmupKm, cooldown, cooldownKm]);

  useEffect(() => {
    let alive = true;

    async function run() {
      setLoading(true);
      setErrorMsg(null);

      const { data: w, error: werr } = await supabase
        .from('workouts')
        .select('*')
        .eq('id', workoutId)
        .single();

      if (!alive) return;

      if (werr || !w) {
        setErrorMsg(werr?.message ?? 'Treino não encontrado.');
        setLoading(false);
        return;
      }

      const workoutRow = w as WorkoutRow;
      setWorkout(workoutRow);

      const { data: st, error: sterr } = await supabase
        .from('students')
        .select('id,name,p1k_pace')
        .eq('id', workoutRow.student_id)
        .single();

      if (!alive) return;

      if (sterr || !st) {
        setErrorMsg(sterr?.message ?? 'Aluno não encontrado.');
        setLoading(false);
        return;
      }

      setStudent(st as StudentRow);

      // hydrate form
      setTitle(workoutRow.title ?? '');
      setTemplateType(workoutRow.template_type ?? 'easy_run');
      setPlannedDate(workoutRow.planned_date ? String(workoutRow.planned_date) : '');

      const wBlocks = Array.isArray(workoutRow.blocks) ? workoutRow.blocks : [];
      const mappedBlocks: Block[] =
        wBlocks.length > 0
          ? wBlocks.map((b: any) => ({
              distanceKm: safeNumber(b?.distanceKm ?? b?.distance_km ?? b?.distance ?? 0, 0),
              intensity: (b?.intensity ?? b?.label ?? 'moderate') as Block['intensity'],
              paceStr: readBlockPace(b),
              note: readBlockNote(b),
            }))
          : [DEFAULT_BLOCK];

      setBlocks(mappedBlocks);

      setLoading(false);
    }

    run();
    return () => {
      alive = false;
    };
  }, [supabase, workoutId]);

  function updateBlock(i: number, patch: Partial<Block>) {
    setBlocks((prev) => prev.map((b, idx) => (idx === i ? { ...b, ...patch } : b)));
  }

  function addBlock() {
    setBlocks((prev) => [...prev, { ...DEFAULT_BLOCK }]);
  }

  function removeBlock(i: number) {
    setBlocks((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleSave() {
    if (!workout) return;

    setSaving(true);
    setErrorMsg(null);

    const blocksOut = blocks.map((b) => {
      const paceStr = normalizePaceInput(b.paceStr);
      const paceSec = paceStrToSecondsPerKm(paceStr);

      return {
        // compat: manter camel + snake
        distanceKm: b.distanceKm,
        distance_km: b.distanceKm,
        intensity: b.intensity,
        // compat: manter múltiplos nomes
        paceStr,
        pace_str: paceStr || null,
        pace: paceStr || null,
        pace_sec_per_km: paceSec,
        paceSecPerKm: paceSec,
        // obs
        note: (b.note ?? '').trim() || null,
        obs: (b.note ?? '').trim() || null,
      };
    });

    const payload: Partial<WorkoutRow> & { warmup?: any; cooldown?: any } = {
      title: title?.trim() || 'Treino',
      template_type: templateType,
      planned_date: plannedDate || null,
      total_km: totalKm,
      blocks: blocksOut as any[],
      warmup: warmup ? { km: warmupKm } : null,
      cooldown: cooldown ? { km: cooldownKm } : null,
    };

    const { error } = await supabase.from('workouts').update(payload).eq('id', workout.id);

    if (error) {
      setErrorMsg(error.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    router.back();
  }

  const templateLabelFromType = (t: string) => {
    const map: Record<string, string> = {
      easy_run: 'Rodagem',
      intervals: 'Intervalado',
      tempo: 'Tempo',
      long_run: 'Longão',
      recovery: 'Recuperação',
      race: 'Prova',
    };
    return map[t] ?? t;
  };

  const statusLabel = (s: string) => {
    const map: Record<string, string> = { draft: 'Rascunho', ready: 'Disponível', completed: 'Concluído' };
    return map[s] ?? s;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#061a12] text-white">
        <Topbar title="Editar treino" />
        <div className="mx-auto max-w-xl p-6">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#061a12] text-white">
      <Topbar title="Editar treino" />

      <div className="mx-auto max-w-xl p-4 space-y-4">
        {errorMsg ? (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-red-200">{errorMsg}</div>
        ) : null}

        <div className="rounded-2xl bg-white/5 p-4 shadow">
          <div className="text-sm text-white/70">Aluno</div>
          <div className="text-2xl font-bold">{student?.name ?? '—'}</div>

          <div className="mt-2 text-sm text-white/70">
            Status: <span className="text-white">{statusLabel(workout?.status ?? '')}</span>
          </div>
          <div className="text-sm text-white/70">
            Template: <span className="text-white">{templateLabelFromType(workout?.template_type ?? '')}</span>
          </div>

          <div className="mt-3 flex items-center gap-3">
            <Button onClick={() => router.back()} variant="secondary">
              Voltar
            </Button>
            <Button
              onClick={async () => {
                try {
                  const url = window.location.href;
                  await navigator.clipboard.writeText(url);
                } catch {}
              }}
              variant="secondary"
            >
              Copiar link do aluno
            </Button>
          </div>
        </div>

        <div className="rounded-2xl bg-white/5 p-4 shadow space-y-3">
          <label className="block">
            <div className="text-sm text-white/70 mb-1">Título</div>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-xl bg-black/30 border border-white/10 px-3 py-3 outline-none focus:border-white/25"
              placeholder="Ex.: Rodagem leve"
            />
          </label>

          <label className="block">
            <div className="text-sm text-white/70 mb-1">Data planejada (opcional)</div>
            <input
              value={plannedDate}
              onChange={(e) => setPlannedDate(e.target.value)}
              type="date"
              className="w-full rounded-xl bg-black/30 border border-white/10 px-3 py-3 outline-none focus:border-white/25"
            />
          </label>

          <label className="block">
            <div className="text-sm text-white/70 mb-1">Template</div>
            <select
              value={templateType}
              onChange={(e) => setTemplateType(e.target.value)}
              className="w-full rounded-xl bg-black/30 border border-white/10 px-3 py-3 outline-none focus:border-white/25"
            >
              <option value="easy_run">Rodagem</option>
              <option value="intervals">Intervalado</option>
              <option value="tempo">Tempo</option>
              <option value="long_run">Longão</option>
              <option value="recovery">Recuperação</option>
              <option value="race">Prova</option>
            </select>
          </label>
        </div>

        <div className="rounded-2xl bg-white/5 p-4 shadow space-y-3">
          <div className="text-lg font-semibold">Aquecimento</div>
          <label className="flex items-center gap-3">
            <input checked={warmup} onChange={(e) => setWarmup(e.target.checked)} type="checkbox" />
            <span>Incluir aquecimento</span>
          </label>
          {warmup ? (
            <label className="block">
              <div className="text-sm text-white/70 mb-1">Distância (km)</div>
              <input
                value={warmupKm}
                onChange={(e) => setWarmupKm(safeNumber(e.target.value, 1))}
                type="number"
                step="0.1"
                min="0"
                className="w-full rounded-xl bg-black/30 border border-white/10 px-3 py-3 outline-none focus:border-white/25"
              />
            </label>
          ) : null}
        </div>

        <div className="rounded-2xl bg-white/5 p-4 shadow space-y-3">
          <div className="text-lg font-semibold">Desaquecimento</div>
          <label className="flex items-center gap-3">
            <input checked={cooldown} onChange={(e) => setCooldown(e.target.checked)} type="checkbox" />
            <span>Incluir desaquecimento</span>
          </label>
          {cooldown ? (
            <label className="block">
              <div className="text-sm text-white/70 mb-1">Distância (km)</div>
              <input
                value={cooldownKm}
                onChange={(e) => setCooldownKm(safeNumber(e.target.value, 1))}
                type="number"
                step="0.1"
                min="0"
                className="w-full rounded-xl bg-black/30 border border-white/10 px-3 py-3 outline-none focus:border-white/25"
              />
            </label>
          ) : null}
        </div>

        <div className="rounded-2xl bg-white/5 p-4 shadow space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-lg font-semibold">Blocos</div>
            <Button onClick={addBlock} variant="secondary">
              + Adicionar bloco
            </Button>
          </div>

          {blocks.map((b, idx) => (
            <div key={idx} className="rounded-2xl bg-black/20 border border-white/10 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="font-semibold">Bloco {idx + 1}</div>
                {blocks.length > 1 ? (
                  <button onClick={() => removeBlock(idx)} className="text-red-300 hover:text-red-200">
                    Remover
                  </button>
                ) : null}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <div className="text-sm text-white/70 mb-1">Distância (km)</div>
                  <input
                    value={b.distanceKm}
                    onChange={(e) => updateBlock(idx, { distanceKm: safeNumber(e.target.value, 0) })}
                    type="number"
                    step="0.1"
                    min="0"
                    className="w-full rounded-xl bg-black/30 border border-white/10 px-3 py-3 outline-none focus:border-white/25"
                  />
                </label>

                <label className="block">
                  <div className="text-sm text-white/70 mb-1">Intensidade</div>
                  <select
                    value={b.intensity}
                    onChange={(e) => updateBlock(idx, { intensity: e.target.value as Block['intensity'] })}
                    className="w-full rounded-xl bg-black/30 border border-white/10 px-3 py-3 outline-none focus:border-white/25"
                  >
                    <option value="easy">Leve</option>
                    <option value="moderate">Moderado</option>
                    <option value="hard">Forte</option>
                  </select>
                </label>
              </div>

              <label className="block">
                <div className="text-sm text-white/70 mb-1">Ritmo sugerido (opcional)</div>
                <input
                  value={b.paceStr}
                  onChange={(e) => updateBlock(idx, { paceStr: e.target.value })}
                  className="w-full rounded-xl bg-black/30 border border-white/10 px-3 py-3 outline-none focus:border-white/25"
                  placeholder="Ex.: 4:30/km"
                  inputMode="text"
                />
                {(() => {
                  const sec = paceStrToSecondsPerKm(b.paceStr);
                  return b.paceStr && sec == null ? (
                    <div className="mt-1 text-xs text-yellow-200/80">
                      Formato esperado: <span className="text-white">m:ss</span> (ex.: 4:30 ou 4:30/km)
                    </div>
                  ) : null;
                })()}
              </label>

              <label className="block">
                <div className="text-sm text-white/70 mb-1">Obs (opcional)</div>
                <textarea
                  value={b.note}
                  onChange={(e) => updateBlock(idx, { note: e.target.value })}
                  className="w-full min-h-[72px] rounded-xl bg-black/30 border border-white/10 px-3 py-3 outline-none focus:border-white/25"
                  placeholder="Ex.: manter ritmo confortável, foco em cadência..."
                />
              </label>
            </div>
          ))}

          <div className="text-white/70">
            Total estimado: <span className="text-white font-semibold">{totalKm} km</span>
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </div>
    </div>
  );
}
