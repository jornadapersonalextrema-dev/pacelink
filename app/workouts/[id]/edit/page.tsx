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

type WeekRow = { id: string; week_start: string; week_end: string; label: string | null };

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

const ALLOWED_TEMPLATE_TYPES = ['easy_run', 'progressive', 'alternated'] as const;
type TemplateType = typeof ALLOWED_TEMPLATE_TYPES[number];

function normalizeTemplateType(v: any): TemplateType {
  return (ALLOWED_TEMPLATE_TYPES as readonly string[]).includes(v) ? (v as TemplateType) : 'easy_run';
}

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

  const [templateType, setTemplateType] = useState<TemplateType>('easy_run');

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
        setBanner('Você precisa estar logado.');
        setLoading(false);
        return;
      }

      try {
        const { data: ww, error } = await supabase
          .from('workouts')
          .select(
            'id,student_id,trainer_id,status,template_type,title,planned_date,locked_at,version,created_at,include_warmup,warmup_km,include_cooldown,cooldown_km,blocks,total_km,share_slug'
          )
          .eq('id', workoutId)
          .maybeSingle();

        if (error) throw error;
        if (!ww) throw new Error('Treino não encontrado');

        if (!alive) return;

        setWorkout(ww as any);
        setIsLocked(!!ww.locked_at);

        // Carregar aluno
        const { data: st, error: stErr } = await supabase
          .from('students')
          .select('id,name,public_slug')
          .eq('id', ww.student_id)
          .maybeSingle();

        if (stErr) throw stErr;
        if (!st) throw new Error('Aluno não encontrado');

        if (!alive) return;

        setStudent(st as any);

        // Carregar semana se houver week_id dentro do workout.blocks ou payload (depende do schema)
        // Se seu schema tiver week_id na tabela workouts, dá pra adicionar no select acima e buscar aqui.
        // (mantido como opcional para não quebrar)

        setTitle(ww.title ?? '');
        setPlannedDate(ww.planned_date ?? '');

        setTemplateType(normalizeTemplateType((ww.template_type as any) ?? 'easy_run'));

        if (!ALLOWED_TEMPLATE_TYPES.includes((ww.template_type as any) ?? 'easy_run')) {
          setBanner('Aviso: treino antigo tinha template_type inválido; ajustado para Rodagem.');
        }

        setIncludeWarmup(!!ww.include_warmup);
        setWarmupKm(String(ww.warmup_km ?? '2'));

        setIncludeCooldown(!!ww.include_cooldown);
        setCooldownKm(String(ww.cooldown_km ?? '1'));

        const rawBlocks: any[] = Array.isArray(ww.blocks) ? ww.blocks : [];
        const uiBlocks: BlockDraft[] = rawBlocks.map((b: any) => ({
          id: uid(),
          distanceKm: String(b?.distance_km ?? '1'),
          intensity: (b?.intensity as any) ?? 'moderado',
        }));
        setBlocks(uiBlocks.length ? uiBlocks : [{ id: uid(), distanceKm: '1', intensity: 'moderado' }]);
      } catch (e: any) {
        if (!alive) return;
        setBanner(e?.message ? `Erro: ${e.message}` : 'Erro ao carregar.');
      } finally {
        if (!alive) return;
        setLoading(false);
      }
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
      distance_km: parseKm(b.distanceKm, 0.1),
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
        template_type: normalizeTemplateType(templateType),
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
      setBanner(url);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background-dark to-black text-white">
        <Topbar title="Editar treino" />
        <div className="mx-auto max-w-2xl px-4 py-6">Carregando…</div>
      </div>
    );
  }

  if (!workout || !student) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background-dark to-black text-white">
        <Topbar title="Editar treino" />
        <div className="mx-auto max-w-2xl px-4 py-6">
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-200">
            {banner || 'Treino não encontrado.'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background-dark to-black text-white">
      <Topbar title="Editar treino" />

      <div className="mx-auto max-w-2xl space-y-4 px-4 py-6">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <div className="text-sm text-white/60">Aluno</div>
          <div className="mt-1 text-2xl font-extrabold">{student.name}</div>

          <div className="mt-3 grid gap-2 text-sm text-white/70">
            <div>
              Status:{' '}
              <span className="font-semibold text-white">
                {workout.status === 'draft' ? 'Rascunho' : workout.status === 'ready' ? 'Disponível' : 'Arquivado'}
              </span>
            </div>

            <div>
              Template:{' '}
              <span className="font-semibold text-white">
                {TEMPLATE_LABEL[workout.template_type] ?? workout.template_type}
              </span>
            </div>

            {week?.label ? (
              <div>
                Semana: <span className="font-semibold text-white">{week.label}</span>
              </div>
            ) : null}
          </div>

          {banner ? (
            <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-3 text-sm text-white/80">{banner}</div>
          ) : null}

          {isLocked ? (
            <div className="mt-4 rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm text-yellow-100">
              Este treino já foi iniciado pelo aluno e está bloqueado para edição.
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={() => router.back()}
              className="h-10 rounded-full border border-white/10 bg-white/5 px-4 text-white hover:bg-white/10"
            >
              Voltar
            </button>

            <button
              onClick={copyLink}
              className="h-10 rounded-full border border-white/10 bg-white/5 px-4 text-white hover:bg-white/10"
            >
              Copiar link do aluno
            </button>
          </div>
        </div>

        <div className="grid gap-4">
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
              onChange={(e) => setTemplateType(normalizeTemplateType(e.target.value))}
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
            <div className="mt-1 text-xs text-white/50">km (mínimo 0,5)</div>
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
            <div className="mt-1 text-xs text-white/50">km (mínimo 0,5)</div>
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <div className="font-semibold text-white">Blocos</div>
              <button
                onClick={addBlock}
                disabled={isLocked}
                className="h-10 rounded-full border border-white/10 bg-white/5 px-4 text-white hover:bg-white/10 disabled:opacity-60"
              >
                + Adicionar bloco
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {blocks.map((b, idx) => (
                <div key={b.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-white">Bloco {idx + 1}</div>
                    {blocks.length > 1 ? (
                      <button
                        disabled={isLocked}
                        onClick={() => removeBlock(b.id)}
                        className="text-sm text-red-200 hover:text-red-100 disabled:opacity-60"
                      >
                        Remover
                      </button>
                    ) : null}
                  </div>

                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <div>
                      <div className="text-sm text-white/60">Distância (km)</div>
                      <input
                        className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-[#2ef57f]/30 disabled:opacity-60"
                        value={b.distanceKm}
                        disabled={isLocked}
                        onChange={(e) => updateBlock(b.id, { distanceKm: e.target.value })}
                        inputMode="decimal"
                      />
                    </div>

                    <div>
                      <div className="text-sm text-white/60">Intensidade</div>
                      <select
                        className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-[#2ef57f]/30 disabled:opacity-60"
                        value={b.intensity}
                        disabled={isLocked}
                        onChange={(e) => updateBlock(b.id, { intensity: e.target.value as any })}
                      >
                        <option value="leve">Leve</option>
                        <option value="moderado">Moderado</option>
                        <option value="forte">Forte</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 text-sm text-white/70">Total estimado: <span className="font-semibold text-white">{totalKmEstimate()} km</span></div>
          </Card>

          <div className="flex gap-3">
            <Button onClick={save} disabled={saving || isLocked}>
              {saving ? 'Salvando…' : 'Salvar'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
