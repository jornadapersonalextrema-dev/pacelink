'use client';

import React from 'react';
import { useParams } from 'next/navigation';

import { Topbar } from '../../../../../components/Topbar';
import { Card } from '../../../../../components/Card';
import { Button } from '../../../../../components/Button';

import { createClient } from '../../../../../lib/supabaseBrowser';

type WorkoutTypeUI = 'rodagem' | 'progressivo' | 'alternado';
type IntensityUI = 'leve' | 'moderado' | 'forte';

type StudentRow = {
  id: string;
  name: string;
  email: string | null;
  p1k_sec_per_km: number | null;
};

type BlockUI = {
  id: string;
  distanceKm: string; // string para não travar edição
  intensity: IntensityUI;
};

function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

function parseKm(input: string): number {
  if (!input) return 0;
  const n = Number(String(input).replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

function formatKm(n: number): string {
  const one = Math.round(n * 10) / 10;
  return one % 1 === 0 ? String(one.toFixed(0)) : String(one.toFixed(1));
}

function paceFromSecPerKm(sec: number | null | undefined): string {
  if (!sec || sec <= 0) return '—';
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

const TYPE_LABEL: Record<WorkoutTypeUI, string> = {
  rodagem: 'Rodagem',
  progressivo: 'Progressivo',
  alternado: 'Alternado',
};

// Alguns projetos antigos podem ter CHECK com valores em inglês.
// Tentamos valores PT e, se cair no CHECK, tentamos alternativas.
const TEMPLATE_TYPE_CANDIDATES: Record<WorkoutTypeUI, string[]> = {
  rodagem: ['rodagem', 'easy', 'easy_run', 'run'],
  progressivo: ['progressivo', 'progressive', 'progressive_run'],
  alternado: ['alternado', 'interval', 'intervals', 'alternating'],
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export default function Page() {
  const params = useParams();
  const studentId = (params?.id as string) || '';

  const supabase = React.useMemo(() => createClient(), []);

  const [student, setStudent] = React.useState<StudentRow | null>(null);
  const [loadingStudent, setLoadingStudent] = React.useState<boolean>(true);

  const [title, setTitle] = React.useState<string>(''); // NÃO preenche com tipo
  const [type, setType] = React.useState<WorkoutTypeUI>('rodagem');

  const [includeWarmup, setIncludeWarmup] = React.useState<boolean>(true);
  const [warmupKm, setWarmupKm] = React.useState<string>('2');

  const [includeCooldown, setIncludeCooldown] = React.useState<boolean>(true);
  const [cooldownKm, setCooldownKm] = React.useState<string>('1');

  const [blocks, setBlocks] = React.useState<BlockUI[]>([
    { id: makeId(), distanceKm: '5', intensity: 'moderado' },
  ]);

  const [errorMsg, setErrorMsg] = React.useState<string>('');
  const [saving, setSaving] = React.useState<boolean>(false);

  const totalKm = React.useMemo(() => {
    const warm = includeWarmup ? parseKm(warmupKm) : 0;
    const cool = includeCooldown ? parseKm(cooldownKm) : 0;
    const main = blocks.reduce((acc, b) => acc + parseKm(b.distanceKm), 0);
    const total = warm + main + cool;
    return Math.max(0, Math.round(total * 10) / 10);
  }, [includeWarmup, warmupKm, includeCooldown, cooldownKm, blocks]);

  React.useEffect(() => {
    let alive = true;

    async function loadStudent() {
      try {
        setLoadingStudent(true);
        setErrorMsg('');
        if (!studentId) return;

        const { data, error } = await supabase
          .from('students')
          .select('id,name,email,p1k_sec_per_km')
          .eq('id', studentId)
          .maybeSingle();

        if (!alive) return;

        if (error) {
          setStudent(null);
          setErrorMsg(error.message || 'Erro ao carregar aluno.');
          return;
        }

        if (!data) {
          setStudent(null);
          setErrorMsg('Aluno não encontrado.');
          return;
        }

        setStudent(data as StudentRow);
      } catch (e: any) {
        if (!alive) return;
        setStudent(null);
        setErrorMsg(e?.message || 'Erro ao carregar aluno.');
      } finally {
        if (!alive) return;
        setLoadingStudent(false);
      }
    }

    loadStudent();

    return () => {
      alive = false;
    };
  }, [studentId, supabase]);

  function addBlock() {
    setBlocks((prev) => [...prev, { id: makeId(), distanceKm: '1', intensity: 'leve' }]);
  }

  function removeBlock(id: string) {
    setBlocks((prev) => (prev.length <= 1 ? prev : prev.filter((b) => b.id !== id)));
  }

  function updateBlock(id: string, patch: Partial<BlockUI>) {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  }

  async function ensureTrainerId(): Promise<string> {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    const userId = data?.session?.user?.id;
    if (!userId) {
      throw new Error('Você precisa estar logado como treinador para criar treinos.');
    }
    return userId;
  }

  function normalizedWarmup(): number {
    if (!includeWarmup) return 0;
    const n = parseKm(warmupKm);
    return n > 0 ? n : 1;
  }

  function normalizedCooldown(): number {
    if (!includeCooldown) return 0;
    const n = parseKm(cooldownKm);
    return n > 0 ? n : 1;
  }

  function buildBlocksPayload() {
    return blocks.map((b) => ({
      distance_km: Math.max(0, parseKm(b.distanceKm) || 0),
      intensity: b.intensity,
    }));
  }

  async function insertWorkout(status: 'draft' | 'shared') {
    const trainerId = await ensureTrainerId();

    const payloadBase: any = {
      student_id: studentId,
      trainer_id: trainerId,
      status,
      include_warmup: includeWarmup,
      warmup_km: normalizedWarmup(),
      include_cooldown: includeCooldown,
      cooldown_km: normalizedCooldown(),
      template_params: {
        title: title?.trim() || null,
        ui_type: type,
      },
      blocks: buildBlocksPayload(),
      total_km: totalKm,
      version: 1,
    };

    if (status === 'shared') {
      const baseTitle = title?.trim() || TYPE_LABEL[type];
      payloadBase.share_slug = `${slugify(baseTitle) || 'treino'}-${Date.now().toString(36)}`;
    }

    const candidates = TEMPLATE_TYPE_CANDIDATES[type] || [type];
    let lastError: any = null;

    for (const cand of candidates) {
      const { data, error } = await supabase
        .from('workouts')
        .insert({ ...payloadBase, template_type: cand })
        .select('id, share_slug')
        .maybeSingle();

      if (!error) return data;

      lastError = error;
      const msg = String(error?.message || '');
      const details = String((error as any)?.details || '');
      if (!(details + msg).includes('workouts_template_type_check')) break;
    }

    throw lastError || new Error('Erro ao salvar treino.');
  }

  async function handleSaveDraft() {
    try {
      setSaving(true);
      setErrorMsg('');
      await insertWorkout('draft');
      setErrorMsg('Rascunho salvo com sucesso.');
      setTimeout(() => setErrorMsg(''), 2500);
    } catch (e: any) {
      setErrorMsg(e?.message || 'Erro ao salvar rascunho.');
    } finally {
      setSaving(false);
    }
  }

  async function handleShare() {
    try {
      setSaving(true);
      setErrorMsg('');

      const saved = await insertWorkout('shared');
      const slug = saved?.share_slug;

      if (!slug) {
        setErrorMsg('Treino salvo, mas não foi possível gerar o link.');
        return;
      }

      const url = `${window.location.origin}/w/${slug}`;

      try {
        await navigator.clipboard.writeText(url);
      } catch {}

      window.open(url, '_blank', 'noopener,noreferrer');
      setErrorMsg('Link gerado e copiado.');
      setTimeout(() => setErrorMsg(''), 2500);
    } catch (e: any) {
      setErrorMsg(e?.message || 'Erro ao compartilhar.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#0b1f16] to-[#06120d] text-white">
      <Topbar title="Criar Treino" showBack />

      <div className="mx-auto w-full max-w-[520px] px-4 pb-28 pt-4">
        {errorMsg ? (
          <div className="mb-4 rounded-xl border border-red-900/40 bg-red-950/40 px-4 py-3 text-sm text-red-200">
            {errorMsg}
          </div>
        ) : null}

        <Card className="mb-4">
          <div className="text-xs tracking-widest text-white/60">ALUNO</div>
          <div className="mt-1 text-lg font-semibold">
            {loadingStudent ? 'Carregando...' : student?.name || '—'}
          </div>
          <div className="mt-1 text-sm text-white/70">
            Ritmo P1K: {paceFromSecPerKm(student?.p1k_sec_per_km)} min/km
          </div>
        </Card>

        <Card className="mb-4">
          <div className="text-base font-semibold">Título do treino</div>
          <input
            className="mt-3 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[#2ef57f]/30"
            placeholder="Ex: Rodagem leve"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <div className="mt-2 text-sm text-white/60">
            Distância total estimada: {formatKm(totalKm)} km
          </div>
        </Card>

        <Card className="mb-4">
          <div className="text-base font-semibold">Tipo de Treino</div>
          <div className="mt-3 flex gap-2">
            {(['rodagem', 'progressivo', 'alternado'] as WorkoutTypeUI[]).map((t) => (
              <button
                key={t}
                type="button"
                className={[
                  'flex-1 rounded-full border px-3 py-2 text-sm font-semibold transition',
                  type === t
                    ? 'border-[#2ef57f]/40 bg-[#2ef57f] text-[#062012]'
                    : 'border-white/15 bg-white/0 text-white/80 hover:bg-white/5',
                ].join(' ')}
                onClick={() => setType(t)}
              >
                {TYPE_LABEL[t]}
              </button>
            ))}
          </div>
        </Card>

        <Card className="mb-4">
          <div className="text-base font-semibold">Estrutura</div>

          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-lg" aria-hidden>
                local_fire_department
              </span>
              <span className="font-semibold">Aquecimento</span>
            </div>
            <button
              type="button"
              className={[
                'h-7 w-12 rounded-full border transition',
                includeWarmup ? 'border-[#2ef57f]/40 bg-[#2ef57f]' : 'border-white/15 bg-white/5',
              ].join(' ')}
              onClick={() => setIncludeWarmup((v) => !v)}
              aria-label="Ativar aquecimento"
            >
              <span
                className={[
                  'block h-6 w-6 translate-x-0 rounded-full bg-[#0b1f16] transition',
                  includeWarmup ? 'translate-x-5' : 'translate-x-0',
                ].join(' ')}
              />
            </button>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <div className="text-xs tracking-widest text-white/60">DISTÂNCIA</div>
              <div className="mt-1 flex items-center gap-2">
                <input
                  inputMode="decimal"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#2ef57f]/30 disabled:opacity-60"
                  value={warmupKm}
                  onChange={(e) => setWarmupKm(e.target.value)}
                  disabled={!includeWarmup}
                />
                <span className="text-sm text-white/70">km</span>
              </div>
            </div>
            <div>
              <div className="text-xs tracking-widest text-white/60">RITMO</div>
              <div className="mt-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-center text-sm text-white/80">
                Livre
              </div>
            </div>
          </div>

          <div className="mt-6">
            <div className="text-sm font-semibold">Blocos Principais</div>

            <div className="mt-3 space-y-3">
              {blocks.map((b, idx) => (
                <div key={b.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-xs tracking-widest text-white/60">BLOCO {idx + 1}</div>
                    <button
                      type="button"
                      className="rounded-lg border border-white/10 bg-white/0 p-2 text-white/70 hover:bg-white/5"
                      onClick={() => removeBlock(b.id)}
                      aria-label="Remover bloco"
                      title="Remover bloco"
                    >
                      <span className="material-symbols-outlined text-lg" aria-hidden>
                        delete
                      </span>
                    </button>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-3">
                    <div className="col-span-2">
                      <div className="text-xs tracking-widest text-white/60">DISTÂNCIA DO TRECHO</div>
                      <div className="mt-1 flex items-center gap-2">
                        <input
                          inputMode="decimal"
                          className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#2ef57f]/30"
                          value={b.distanceKm}
                          onChange={(e) => updateBlock(b.id, { distanceKm: e.target.value })}
                        />
                        <span className="text-sm text-white/70">km</span>
                      </div>
                    </div>

                    <div className="col-span-3">
                      <div className="text-xs tracking-widest text-white/60">INTENSIDADE</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {(['leve', 'moderado', 'forte'] as IntensityUI[]).map((it) => (
                          <button
                            key={it}
                            type="button"
                            className={[
                              'min-w-[92px] flex-1 rounded-full border px-3 py-2 text-sm font-semibold transition',
                              b.intensity === it
                                ? 'border-[#2ef57f]/40 bg-[#2ef57f] text-[#062012]'
                                : 'border-white/15 bg-white/0 text-white/80 hover:bg-white/5',
                            ].join(' ')}
                            onClick={() => updateBlock(b.id, { intensity: it })}
                          >
                            {it === 'leve' ? 'Leve' : it === 'moderado' ? 'Moderado' : 'Forte'}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-3">
              <Button variant="secondary" fullWidth icon="add" onClick={addBlock}>
                Adicionar bloco
              </Button>
            </div>
          </div>

          <div className="mt-7 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-lg" aria-hidden>
                ac_unit
              </span>
              <span className="font-semibold">Desaquecimento</span>
            </div>
            <button
              type="button"
              className={[
                'h-7 w-12 rounded-full border transition',
                includeCooldown ? 'border-[#2ef57f]/40 bg-[#2ef57f]' : 'border-white/15 bg-white/5',
              ].join(' ')}
              onClick={() => setIncludeCooldown((v) => !v)}
              aria-label="Ativar desaquecimento"
            >
              <span
                className={[
                  'block h-6 w-6 translate-x-0 rounded-full bg-[#0b1f16] transition',
                  includeCooldown ? 'translate-x-5' : 'translate-x-0',
                ].join(' ')}
              />
            </button>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <div className="text-xs tracking-widest text-white/60">DISTÂNCIA</div>
              <div className="mt-1 flex items-center gap-2">
                <input
                  inputMode="decimal"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#2ef57f]/30 disabled:opacity-60"
                  value={cooldownKm}
                  onChange={(e) => setCooldownKm(e.target.value)}
                  disabled={!includeCooldown}
                />
                <span className="text-sm text-white/70">km</span>
              </div>
            </div>
            <div>
              <div className="text-xs tracking-widest text-white/60">RITMO</div>
              <div className="mt-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-center text-sm text-white/80">
                Livre
              </div>
            </div>
          </div>
        </Card>
      </div>

      <div className="fixed inset-x-0 bottom-0 bg-gradient-to-t from-[#06120d] via-[#06120d]/90 to-transparent px-4 pb-5 pt-3">
        <div className="mx-auto flex w-full max-w-[520px] gap-3">
          <Button variant="secondary" fullWidth onClick={handleSaveDraft} disabled={saving || loadingStudent}>
            {saving ? 'Salvando...' : 'Salvar Rascunho'}
          </Button>
          <Button variant="primary" fullWidth onClick={handleShare} disabled={saving || loadingStudent}>
            {saving ? 'Gerando...' : 'Compartilhar'}
          </Button>
        </div>
      </div>
    </main>
  );
}
