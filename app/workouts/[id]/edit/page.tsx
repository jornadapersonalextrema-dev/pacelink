'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '../../../../lib/supabaseBrowser';

type DbWorkoutStatus = 'draft' | 'ready' | 'archived';
type DbTemplateType = 'easy_run' | 'progressive' | 'alternated';
type UiIntensity = 'leve' | 'moderado' | 'forte';

type Block = {
  distance_km: number;
  intensity: UiIntensity;
};

function clampNumber(n: number, min: number, max?: number) {
  if (Number.isNaN(n)) return min;
  if (max !== undefined) return Math.min(Math.max(n, min), max);
  return Math.max(n, min);
}

function toNumber(v: unknown, fallback: number) {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

function formatKm(n: number) {
  const val = Number.isFinite(n) ? n : 0;
  // evita "12.0000001"
  return (Math.round(val * 10) / 10).toString().replace('.', ',');
}

function templateLabel(t: DbTemplateType): string {
  switch (t) {
    case 'easy_run':
      return 'Rodagem';
    case 'progressive':
      return 'Progressivo';
    case 'alternated':
      return 'Alternado';
    default:
      return 'Treino';
  }
}

function statusLabel(s: DbWorkoutStatus): string {
  switch (s) {
    case 'draft':
      return 'Rascunho';
    case 'ready':
      return 'Pronto';
    case 'archived':
      return 'Arquivado';
    default:
      return s;
  }
}

function computeTotalKm(params: {
  includeWarmup: boolean;
  warmupKm: number;
  includeCooldown: boolean;
  cooldownKm: number;
  blocks: Block[];
}) {
  const warm = params.includeWarmup ? params.warmupKm : 0;
  const cool = params.includeCooldown ? params.cooldownKm : 0;
  const blocks = (params.blocks || []).reduce((acc, b) => acc + (Number.isFinite(b.distance_km) ? b.distance_km : 0), 0);
  return Math.round((warm + blocks + cool) * 100) / 100;
}

function normalizeBlocks(raw: any): Block[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((b) => {
      const distance =
        toNumber(b?.distance_km, NaN) ??
        toNumber(b?.distanceKm, NaN) ??
        toNumber(b?.km, NaN);

      const intensityRaw = (b?.intensity ?? b?.intensidade ?? '').toString().toLowerCase();
      const intensity: UiIntensity =
        intensityRaw === 'forte' ? 'forte' : intensityRaw === 'moderado' ? 'moderado' : 'leve';

      return {
        distance_km: Number.isFinite(distance) ? distance : 1,
        intensity,
      } as Block;
    })
    .filter((b) => Number.isFinite(b.distance_km) && b.distance_km > 0);
}

export default function EditWorkoutPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const workoutId = params?.id;

  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<string | null>(null);

  const [status, setStatus] = useState<DbWorkoutStatus>('draft');
  const [templateType, setTemplateType] = useState<DbTemplateType>('easy_run');
  const [title, setTitle] = useState<string>('');

  const [includeWarmup, setIncludeWarmup] = useState(true);
  const [warmupKm, setWarmupKm] = useState<number>(1);

  const [includeCooldown, setIncludeCooldown] = useState(true);
  const [cooldownKm, setCooldownKm] = useState<number>(1);

  const [blocks, setBlocks] = useState<Block[]>([{ distance_km: 5, intensity: 'leve' }]);
  const totalKm = useMemo(() => computeTotalKm({ includeWarmup, warmupKm, includeCooldown, cooldownKm, blocks }), [
    includeWarmup,
    warmupKm,
    includeCooldown,
    cooldownKm,
    blocks,
  ]);

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      setBanner(null);

      try {
        const supabase = createClient();

        const { data, error } = await supabase
          .from('workouts')
          .select(
            'id, status, template_type, title, include_warmup, warmup_km, include_cooldown, cooldown_km, blocks, total_km, share_slug, created_at, student_id'
          )
          .eq('id', workoutId)
          .maybeSingle();

        if (!alive) return;

        if (error) throw error;
        if (!data) {
          setBanner('Treino não encontrado (ou sem permissão).');
          setLoading(false);
          return;
        }

        setStatus((data.status as DbWorkoutStatus) ?? 'draft');
        setTemplateType((data.template_type as DbTemplateType) ?? 'easy_run');
        setTitle((data.title as string) ?? '');

        setIncludeWarmup(Boolean(data.include_warmup));
        setWarmupKm(clampNumber(toNumber(data.warmup_km, 1), 0.1));

        setIncludeCooldown(Boolean(data.include_cooldown));
        setCooldownKm(clampNumber(toNumber(data.cooldown_km, 1), 0.1));

        setBlocks(normalizeBlocks(data.blocks));
      } catch (e: any) {
        setBanner(e?.message ? `Erro ao carregar treino: ${e.message}` : 'Erro ao carregar treino.');
      } finally {
        if (alive) setLoading(false);
      }
    }

    if (workoutId) load();
    return () => {
      alive = false;
    };
  }, [workoutId]);

  async function saveChanges() {
    setBanner(null);
    try {
      const supabase = createClient();

      // constraints: warmup_km/cooldown_km precisam ser > 0, mesmo se include_* = false
      const safeWarm = clampNumber(warmupKm, 0.1);
      const safeCool = clampNumber(cooldownKm, 0.1);

      const payload = {
        title: title.trim() ? title.trim() : null,
        status, // deve ser 'draft' | 'ready' | 'archived'
        template_type: templateType, // 'easy_run' | 'progressive' | 'alternated'
        include_warmup: includeWarmup,
        warmup_km: safeWarm,
        include_cooldown: includeCooldown,
        cooldown_km: safeCool,
        blocks,
        total_km: computeTotalKm({
          includeWarmup,
          warmupKm: safeWarm,
          includeCooldown,
          cooldownKm: safeCool,
          blocks,
        }),
      };

      const { error } = await supabase.from('workouts').update(payload).eq('id', workoutId);
      if (error) throw error;

      setBanner('Alterações salvas com sucesso.');
      setTimeout(() => setBanner(null), 1500);
    } catch (e: any) {
      setBanner(e?.message ? `Erro ao salvar: ${e.message}` : 'Erro ao salvar.');
    }
  }

  async function ensureShareLinkAndCopy() {
    setBanner(null);
    try {
      const supabase = createClient();

      // Para gerar share_slug, o trigger roda ao atualizar status (coluna status).
      // IMPORTANTE: status permitido pelo constraint é: 'draft' | 'ready' | 'archived'
      const { data, error } = await supabase
        .from('workouts')
        .update({ status: 'ready' })
        .eq('id', workoutId)
        .select('id, share_slug, status')
        .single();

      if (error) throw error;

      const slug = data?.share_slug;
      if (!slug) {
        setBanner('Não foi possível gerar o link (share_slug vazio).');
        return;
      }

      const url = `${window.location.origin}/w/${slug}`;

      try {
        await navigator.clipboard.writeText(url);
        setBanner('Link do aluno copiado para a área de transferência.');
      } catch {
        // fallback
        window.prompt('Copie o link abaixo:', url);
        setBanner('Link gerado. Copie manualmente.');
      }
    } catch (e: any) {
      setBanner(e?.message ? `Erro ao gerar link: ${e.message}` : 'Erro ao gerar link.');
    }
  }

  function updateBlock(idx: number, patch: Partial<Block>) {
    setBlocks((prev) => prev.map((b, i) => (i === idx ? { ...b, ...patch } : b)));
  }

  function removeBlock(idx: number) {
    setBlocks((prev) => prev.filter((_, i) => i !== idx));
  }

  function addBlock() {
    setBlocks((prev) => [...prev, { distance_km: 1, intensity: 'leve' }]);
  }

  return (
    <div className="min-h-screen bg-[#0b1d16] text-white">
      {/* Topbar local (evita dependência) */}
      <div className="sticky top-0 z-10 bg-[#d7dbd9] text-[#0b1d16]">
        <div className="mx-auto flex max-w-[820px] items-center gap-3 px-4 py-3">
          <button
            onClick={() => router.back()}
            className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-black/10"
            aria-label="Voltar"
            title="Voltar"
          >
            {/* ícone seta */}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div className="flex-1 text-center text-lg font-semibold">Editar Treino</div>

          <button
            onClick={ensureShareLinkAndCopy}
            className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-black/10"
            aria-label="Copiar link do aluno"
            title="Copiar link do aluno"
          >
            {/* ícone compartilhar */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path
                d="M16 8a3 3 0 10-2.83-4H13a3 3 0 003 3zM6 14a3 3 0 10.17 0H6zm10 6a3 3 0 10-2.83-4H13a3 3 0 003 3z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path d="M8.7 13.1l6.6 3.8M15.3 7.1L8.7 10.9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-[820px] px-4 pb-24 pt-6">
        {banner ? (
          <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-100">{banner}</div>
        ) : null}

        {loading ? (
          <div className="opacity-80">Carregando...</div>
        ) : (
          <div className="space-y-4">
            {/* Informações básicas */}
            <div className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
              <div className="text-xs tracking-widest text-white/60">INFORMAÇÕES BÁSICAS</div>

              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-semibold">Título do treino</label>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ex.: Rodagem leve"
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/40 outline-none focus:border-white/25"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold">Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as DbWorkoutStatus)}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:border-white/25"
                  >
                    <option value="draft">Rascunho</option>
                    <option value="ready">Pronto</option>
                    <option value="archived">Arquivado</option>
                  </select>
                </div>
              </div>

              <div className="mt-4">
                <label className="mb-2 block text-sm font-semibold">Tipo de treino</label>
                <div className="flex flex-wrap gap-2">
                  {(['easy_run', 'progressive', 'alternated'] as DbTemplateType[]).map((t) => (
                    <button
                      key={t}
                      onClick={() => setTemplateType(t)}
                      className={[
                        'rounded-full px-4 py-2 text-sm font-semibold ring-1 ring-white/10',
                        templateType === t ? 'bg-[#2CEB79] text-[#0b1d16]' : 'bg-white/5 text-white/80 hover:bg-white/10',
                      ].join(' ')}
                    >
                      {templateLabel(t)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-3 text-sm text-white/70">
                <span className="font-semibold">Distância total estimada:</span> {formatKm(totalKm)} km
              </div>
            </div>

            {/* Estrutura */}
            <div className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
              <div className="text-lg font-semibold">Estrutura</div>

              {/* Aquecimento */}
              <div className="mt-4 rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">Aquecimento</span>
                  </div>

                  <button
                    onClick={() => setIncludeWarmup((v) => !v)}
                    className={[
                      'relative h-8 w-14 rounded-full ring-1 ring-white/10 transition',
                      includeWarmup ? 'bg-[#2CEB79]' : 'bg-white/10',
                    ].join(' ')}
                    aria-label="Incluir aquecimento"
                    title="Incluir aquecimento"
                  >
                    <span
                      className={[
                        'absolute top-1 h-6 w-6 rounded-full bg-white transition',
                        includeWarmup ? 'left-7' : 'left-1',
                      ].join(' ')}
                    />
                  </button>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <div className="text-xs tracking-widest text-white/60">DISTÂNCIA</div>
                    <div className="mt-2 flex items-center gap-2">
                      <input
                        type="number"
                        step="0.1"
                        min="0.1"
                        value={warmupKm}
                        onChange={(e) => setWarmupKm(clampNumber(Number(e.target.value), 0.1))}
                        className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:border-white/25"
                      />
                      <span className="text-white/70">km</span>
                    </div>
                  </div>

                  <div>
                    <div className="text-xs tracking-widest text-white/60">RITMO</div>
                    <div className="mt-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white/80">Livre</div>
                  </div>
                </div>
              </div>

              {/* Blocos principais */}
              <div className="mt-4">
                <div className="text-xs tracking-widest text-white/60">BLOCOS PRINCIPAIS</div>

                <div className="mt-3 space-y-3">
                  {blocks.map((b, idx) => (
                    <div key={idx} className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="text-xs tracking-widest text-white/60">DISTÂNCIA DO TRECHO</div>
                          <div className="mt-2 flex items-center gap-2">
                            <input
                              type="number"
                              step="0.1"
                              min="0.1"
                              value={b.distance_km}
                              onChange={(e) =>
                                updateBlock(idx, {
                                  distance_km: clampNumber(Number(e.target.value), 0.1),
                                })
                              }
                              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:border-white/25"
                            />
                            <span className="text-white/70">km</span>
                          </div>

                          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                            <div>
                              <div className="text-xs tracking-widest text-white/60">INTENSIDADE</div>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {(['leve', 'moderado', 'forte'] as UiIntensity[]).map((it) => (
                                  <button
                                    key={it}
                                    onClick={() => updateBlock(idx, { intensity: it })}
                                    className={[
                                      'rounded-full px-4 py-2 text-sm font-semibold ring-1 ring-white/10',
                                      b.intensity === it
                                        ? 'bg-[#2CEB79] text-[#0b1d16]'
                                        : 'bg-white/5 text-white/80 hover:bg-white/10',
                                    ].join(' ')}
                                  >
                                    {it === 'leve' ? 'Leve' : it === 'moderado' ? 'Moderado' : 'Forte'}
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div className="flex items-end justify-end">
                              <button
                                onClick={() => removeBlock(idx)}
                                className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-100 hover:bg-red-500/20"
                                title="Remover bloco"
                              >
                                Remover
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  <button
                    onClick={addBlock}
                    className="w-full rounded-2xl border border-dashed border-white/20 bg-white/5 px-4 py-4 text-center text-sm font-semibold text-white/80 hover:bg-white/10"
                  >
                    + Adicionar bloco
                  </button>
                </div>
              </div>

              {/* Desaquecimento */}
              <div className="mt-4 rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold">Desaquecimento</div>

                  <button
                    onClick={() => setIncludeCooldown((v) => !v)}
                    className={[
                      'relative h-8 w-14 rounded-full ring-1 ring-white/10 transition',
                      includeCooldown ? 'bg-[#2CEB79]' : 'bg-white/10',
                    ].join(' ')}
                    aria-label="Incluir desaquecimento"
                    title="Incluir desaquecimento"
                  >
                    <span
                      className={[
                        'absolute top-1 h-6 w-6 rounded-full bg-white transition',
                        includeCooldown ? 'left-7' : 'left-1',
                      ].join(' ')}
                    />
                  </button>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <div className="text-xs tracking-widest text-white/60">DISTÂNCIA</div>
                    <div className="mt-2 flex items-center gap-2">
                      <input
                        type="number"
                        step="0.1"
                        min="0.1"
                        value={cooldownKm}
                        onChange={(e) => setCooldownKm(clampNumber(Number(e.target.value), 0.1))}
                        className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:border-white/25"
                      />
                      <span className="text-white/70">km</span>
                    </div>
                  </div>

                  <div>
                    <div className="text-xs tracking-widest text-white/60">RITMO</div>
                    <div className="mt-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white/80">Livre</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Ações */}
            <div className="fixed bottom-0 left-0 right-0 bg-[#0b1d16]/90 backdrop-blur">
              <div className="mx-auto flex max-w-[820px] gap-3 px-4 py-4">
                <button
                  onClick={saveChanges}
                  className="flex-1 rounded-full bg-[#2CEB79] px-6 py-4 text-center text-base font-bold text-[#0b1d16] hover:brightness-105"
                >
                  ✓ Salvar Alterações
                </button>
                <button
                  onClick={ensureShareLinkAndCopy}
                  className="flex-1 rounded-full bg-white/10 px-6 py-4 text-center text-base font-bold text-white hover:bg-white/15"
                >
                  Copiar link do aluno
                </button>
              </div>
            </div>

            {/* Debug/info */}
            <div className="pt-2 text-xs text-white/40">
              Status atual: <span className="font-semibold text-white/60">{statusLabel(status)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
