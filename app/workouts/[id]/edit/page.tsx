'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '../../../../lib/supabaseBrowser';
import Topbar from '../../../../components/Topbar';
import Button from '../../../../components/Button';

type StudentRow = {
  id: string;
  name: string;
  public_slug: string | null;
};

type WorkoutRow = {
  id: string;
  student_id: string;
  trainer_id: string;
  status: 'draft' | 'ready' | 'archived';
  template_type: 'easy_run' | 'progressive' | 'alternated' | string;
  title: string | null;
  planned_date: string | null;
  locked_at: string | null;
  version: number;
  created_at: string;
  include_warmup: boolean;
  warmup_km: number;
  include_cooldown: boolean;
  cooldown_km: number;
  blocks: any;
  total_km: number;
  share_slug: string | null;
};

type WeekRow = { id: string; week_start: string; week_end: string; label: string | null; };


type BlockDraft = {
  id: string;
  distanceKm: string;
  intensity: 'leve' | 'moderado' | 'forte';
};

const TEMPLATE_LABEL: Record<string, string> = {
  easy_run: 'Rodagem',
  progressive: 'Progressivo',
  alternated: 'Alternado',
};

function uid() {
  return Math.random().toString(16).slice(2);
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

function parseKm(str: string, min: number) {
  const cleaned = (str || '').replace(',', '.');
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, n);
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-white/10 bg-white/5 p-4">{children}</div>;
}

export default function EditWorkoutPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const workoutId = params.id;

  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  const [student, setStudent] = useState<StudentRow | null>(null);
  const [week, setWeek] = useState<WeekRow | null>(null);
  const [workout, setWorkout] = useState<WorkoutRow | null>(null);

  const [title, setTitle] = useState('');
  const [plannedDate, setPlannedDate] = useState<string>('');
  const [isLocked, setIsLocked] = useState(false);

  const [templateType, setTemplateType] = useState<'easy_run' | 'progressive' | 'alternated'>('easy_run');

  const [includeWarmup, setIncludeWarmup] = useState(true);
  const [warmupKm, setWarmupKm] = useState('2');

  const [includeCooldown, setIncludeCooldown] = useState(true);
  const [cooldownKm, setCooldownKm] = useState('1');

  const [blocks, setBlocks] = useState<BlockDraft[]>([]);

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      setBanner(null);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        const next = window.location.pathname + window.location.search;
        router.replace(`/login?next=${encodeURIComponent(next)}`);
        return;
      }

      const { data: ww, error: wErr } = await supabase
        .from('workouts')
        .select(
          'id,student_id,trainer_id,status,template_type,title,planned_date,locked_at,version,created_at,include_warmup,warmup_km,include_cooldown,cooldown_km,blocks,total_km,share_slug'
        )
        .eq('id', workoutId)
        .maybeSingle();

      if (!alive) return;

      if (wErr) {
        setBanner(wErr.message);
        setLoading(false);
        return;
      }

      if (!ww) {
        setBanner('Treino não encontrado (ou sem permissão).');
        setLoading(false);
        return;
      }

      setWorkout(ww as WorkoutRow);

// Carrega semana (se existir)
if ((ww as any)?.week_id) {
  const { data: wk } = await supabase
    .from('weeks')
    .select('id, week_start, week_end, label')
    .eq('id', (ww as any).week_id)
    .maybeSingle();
  setWeek((wk as any) || null);
} else {
  setWeek(null);
}

      setTitle(ww.title ?? '');
      setPlannedDate(ww.planned_date ?? '');
      setTemplateType((ww.template_type as any) ?? 'easy_run');

      setIncludeWarmup(!!ww.include_warmup);
      setWarmupKm(String(ww.warmup_km ?? '2'));

      setIncludeCooldown(!!ww.include_cooldown);
      setCooldownKm(String(ww.cooldown_km ?? '1'));

      const rawBlocks = Array.isArray(ww.blocks) ? ww.blocks : [];
      const drafts: BlockDraft[] = rawBlocks.map((b: any) => ({
        id: uid(),
        distanceKm: String(b.distance_km ?? b.distanceKm ?? b.km ?? '1'),
        intensity: (b.intensity ?? 'moderado') as any,
      }));
      setBlocks(drafts.length ? drafts : [{ id: uid(), distanceKm: '6', intensity: 'leve' }]);

      // carrega aluno
      const { data: st, error: stErr } = await supabase
        .from('students')
        .select('id,name,public_slug')
        .eq('id', ww.student_id)
        .maybeSingle();

      if (stErr) {
        setBanner(stErr.message);
        setLoading(false);
        return;
      }

      setStudent(st as StudentRow);

      // Se já existe execução para este treino, bloqueia edição
      const { count: execCount } = await supabase
        .from('executions')
        .select('id', { count: 'exact', head: true })
        .eq('workout_id', workoutId);

      setIsLocked(!!ww.locked_at || (execCount ?? 0) > 0);

      setLoading(false);
    }

    void load();

    return () => {
      alive = false;
    };
  }, [router, supabase, workoutId]);

  function normalizedWarmup() {
    if (!includeWarmup) return 1;
    return parseKm(warmupKm, 0.5);
  }

  function normalizedCooldown() {
    if (!includeCooldown) return 1;
    return parseKm(cooldownKm, 0.5);
  }

  function buildBlocksPayload() {
    return blocks.map((b, idx) => ({
      index: idx + 1,
      distance_km: parseKm(b.distanceKm, 0.5),
      intensity: b.intensity,
    }));
  }

  function totalKmEstimate() {
    const warm = includeWarmup ? normalizedWarmup() : 0;
    const cool = includeCooldown ? normalizedCooldown() : 0;
    const sumBlocks = buildBlocksPayload().reduce((acc, x) => acc + (x.distance_km || 0), 0);
    return Math.round((warm + sumBlocks + cool) * 10) / 10;
  }

  function addBlock() {
    setBlocks((prev) => [...prev, { id: uid(), distanceKm: '1', intensity: 'moderado' }]);
  }

  function removeBlock(id: string) {
    setBlocks((prev) => prev.filter((x) => x.id !== id));
  }

  function updateBlock(id: string, patch: Partial<BlockDraft>) {
    setBlocks((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }

  async function save() {
    if (!workout) return;
    setSaving(true);
    setBanner(null);

    if (isLocked) {
      setBanner('Este treino já foi iniciado pelo aluno e não pode mais ser editado.');
      setSaving(false);
      return;
    }

    try {
      const payload: any = {
        status: workout.status,
        planned_date: plannedDate ? plannedDate : null,
        template_type: templateType,
        title: title.trim() || null,
        include_warmup: includeWarmup,
        warmup_km: normalizedWarmup(),
        include_cooldown: includeCooldown,
        cooldown_km: normalizedCooldown(),
        blocks: buildBlocksPayload(),
        total_km: totalKmEstimate(),
      };

      const { error } = await supabase.from('workouts').update(payload).eq('id', workout.id);

      if (error) throw error;

      setBanner('Salvo!');
      router.refresh();
    } catch (e: any) {
      setBanner(e?.message ? `Erro: ${e.message}` : 'Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  }

  async function copyLink() {
    if (!workout || !student) return;
    setBanner(null);

    const { data, error } = await supabase
      .from('workouts')
      .update({ status: 'ready' })
      .eq('id', workout.id)
      .select('id,share_slug')
      .maybeSingle();

    if (error) {
      setBanner(error.message);
      return;
    }

    const slug = data?.share_slug;
    if (!slug) {
      setBanner('share_slug vazio (trigger não gerou).');
      return;
    }

    const studentSlug = student.public_slug || makeStudentSlug(student.name, student.id);
    const url = `${window.location.origin}/w/${studentSlug}/${slug}`;

    try {
      await navigator.clipboard.writeText(url);
      setBanner('Link copiado!');
    } catch {
      setBanner(`Link: ${url}`);
    }
  }

  return (
    <>
      <Topbar title="Editar treino" />
      <main className="flex-1 p-4">
        {loading ? (
          <div className="text-sm text-slate-600 dark:text-slate-300">Carregando…</div>
        ) : banner ? (
          <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 p-4 text-sm text-amber-800 dark:text-amber-200">{banner}</div>
        ) : null}

        {workout && student ? (
          <div className="mx-auto max-w-3xl space-y-4">
            <Card>
              <div className="text-white/70 text-sm">Aluno</div>
              <div className="text-white text-xl font-semibold">{student.name}</div>
              <div className="mt-3 text-sm text-white/70">
                Template: <span className="font-semibold text-white">{TEMPLATE_LABEL[workout.template_type] ?? workout.template_type}</span>
              </div>

<div className="mt-1 text-sm text-white/70">
  Semana planejada:{' '}
  <span className="font-semibold text-white">
    {week ? (week.label || `${new Date(week.week_start).toLocaleDateString('pt-BR')} – ${new Date(week.week_end).toLocaleDateString('pt-BR')}`) : '—'}
  </span>
</div>

              <div className="mt-1 text-sm text-white/70">
                Distância total estimada: <span className="font-semibold text-white">{totalKmEstimate()} km</span>
              </div>

              {isLocked ? (
                <div className="mt-3 rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-sm text-amber-200">
                  Este treino já foi iniciado pelo aluno e está <span className="font-semibold">bloqueado para edição</span>.
                </div>
              ) : null}
            </Card>

            <Card>
              <div className="font-semibold text-white">Título</div>
              <input
                className="mt-3 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[#2ef57f]/30 disabled:opacity-60"
                value={title}
                disabled={isLocked}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Rodagem leve"
              />
            </Card>

            <Card>
              <div className="font-semibold text-white">Data planejada (opcional)</div>
              <input
                type="date"
                className="mt-3 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-[#2ef57f]/30 disabled:opacity-60"
                value={plannedDate}
                onChange={(e) => setPlannedDate(e.target.value)}
                disabled={isLocked}
              />
            </Card>

            <Card>
              <div className="font-semibold text-white">Template</div>
              <select
                className="mt-3 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-[#2ef57f]/30 disabled:opacity-60"
                value={templateType}
                disabled={isLocked}
                onChange={(e) => setTemplateType(e.target.value as any)}
              >
                <option value="easy_run">Rodagem</option>
                <option value="progressive">Progressivo</option>
                <option value="alternated">Alternado</option>
              </select>
            </Card>

            <Card>
              <div className="flex items-center justify-between">
                <div className="font-semibold text-white">Aquecimento</div>
                <label className="inline-flex items-center gap-2 text-sm text-white/80">
                  <input type="checkbox" checked={includeWarmup} onChange={() => !isLocked && setIncludeWarmup((v) => !v)} />
                  Incluir
                </label>
              </div>

              <input
                className="mt-3 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-[#2ef57f]/30 disabled:opacity-60"
                value={warmupKm}
                onChange={(e) => setWarmupKm(e.target.value)}
                disabled={!includeWarmup || isLocked}
                inputMode="decimal"
              />
            </Card>

            <Card>
              <div className="flex items-center justify-between">
                <div className="font-semibold text-white">Blocos</div>
                <button className="text-sm underline text-white/80" onClick={() => !isLocked && addBlock()}>
                  + Adicionar bloco
                </button>
              </div>

              <div className="mt-3 space-y-3">
                {blocks.map((b, idx) => (
                  <div key={b.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="flex items-center justify-between">
                      <div className="text-white font-medium">Bloco {idx + 1}</div>
                      {blocks.length > 1 ? (
                        <button className="text-sm underline text-red-300" onClick={() => !isLocked && removeBlock(b.id)}>
                          Remover
                        </button>
                      ) : null}
                    </div>

                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <div className="text-sm text-white/70">Distância (km)</div>
                        <input
                          className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-[#2ef57f]/30 disabled:opacity-60"
                          value={b.distanceKm}
                          onChange={(e) => !isLocked && updateBlock(b.id, { distanceKm: e.target.value })}
                          inputMode="decimal"
                          disabled={isLocked}
                        />
                      </div>

                      <div>
                        <div className="text-sm text-white/70">Intensidade</div>
                        <div className="mt-2 flex gap-2">
                          {(['leve', 'moderado', 'forte'] as const).map((opt) => (
                            <button
                              key={opt}
                              type="button"
                              disabled={isLocked}
                              onClick={() => !isLocked && updateBlock(b.id, { intensity: opt })}
                              className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold whitespace-nowrap disabled:opacity-60 ${
                                b.intensity === opt ? 'bg-[#2ef57f] text-slate-900' : 'bg-white/10 text-white'
                              }`}
                            >
                              {opt === 'leve' ? 'Leve' : opt === 'moderado' ? 'Moderado' : 'Forte'}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <div className="flex items-center justify-between">
                <div className="font-semibold text-white">Desaquecimento</div>
                <label className="inline-flex items-center gap-2 text-sm text-white/80">
                  <input type="checkbox" checked={includeCooldown} onChange={() => !isLocked && setIncludeCooldown((v) => !v)} />
                  Incluir
                </label>
              </div>

              <input
                className="mt-3 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-[#2ef57f]/30 disabled:opacity-60"
                value={cooldownKm}
                onChange={(e) => setCooldownKm(e.target.value)}
                disabled={!includeCooldown || isLocked}
                inputMode="decimal"
              />
            </Card>

            <div className="flex flex-col sm:flex-row gap-2">
              <Button onClick={save} disabled={saving || isLocked} fullWidth>
                Salvar alterações
              </Button>
              <Button onClick={copyLink} disabled={saving} fullWidth>
                Copiar link do aluno
              </Button>
            </div>

            <button className="text-sm underline text-slate-600 dark:text-slate-300" onClick={() => router.push(`/students/${workout.student_id}`)}>
              Voltar para o aluno
            </button>
          </div>
        ) : null}
      </main>
    </>
  );
}
