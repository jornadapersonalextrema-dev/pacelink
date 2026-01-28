'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '../../../../../lib/supabaseBrowser';
import { Topbar } from '../../../../../components/Topbar';
import { Button } from '../../../../../components/Button';
import { Card } from '../../../../../components/Card';
import { Input } from '../../../../../components/Input';
import { Toggle } from '../../../../../components/Toggle';
import { Icon } from '../../../../../components/Icon';

// -------------------------------
// Helpers
// -------------------------------
function clampNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(value, min), max);
}

function parsePtNumber(value: string): number {
  const normalized = (value ?? '').toString().replace(',', '.');
  return Number(normalized);
}

function formatPaceFromSeconds(sec?: number | null) {
  if (!sec || sec <= 0) return '—';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

type TemplateType = 'rodagem' | 'progressivo' | 'alternado';
type Intensity = 'leve' | 'moderado' | 'forte';

type Student = {
  id: string;
  trainer_id: string;
  name: string;
  email: string | null;
  p1k_sec_per_km: number | null;
};

type Phase = {
  distanceKm: number;
  intensity: Intensity;
};

type AlternadoBlock = {
  distanceKm: number;
  intensity: Intensity;
};

export default function NewWorkoutPage() {
  const router = useRouter();
  const params = useParams();
  const studentId = (params?.id as string) ?? '';

  const supabase = useMemo(() => createClient(), []);

  const [loadingStudent, setLoadingStudent] = useState(true);
  const [student, setStudent] = useState<Student | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Editor state
  const [title, setTitle] = useState(''); // não preenche automaticamente
  const [templateType, setTemplateType] = useState<TemplateType>('rodagem');

  const [includeWarmup, setIncludeWarmup] = useState(true);
  const [warmupKm, setWarmupKm] = useState(2.0);

  const [includeCooldown, setIncludeCooldown] = useState(true);
  const [cooldownKm, setCooldownKm] = useState(1.0);

  // Rodagem
  const [rodagemDistanceKm, setRodagemDistanceKm] = useState(5.0);
  const [rodagemIntensity, setRodagemIntensity] = useState<Intensity>('leve');

  // Progressivo
  const [phases, setPhases] = useState<Phase[]>([
    { distanceKm: 2.0, intensity: 'leve' },
    { distanceKm: 2.0, intensity: 'moderado' },
    { distanceKm: 1.0, intensity: 'forte' },
  ]);

  // Alternado
  const [altReps, setAltReps] = useState(6);
  const [altStrong, setAltStrong] = useState<AlternadoBlock>({ distanceKm: 1.0, intensity: 'forte' });
  const [altEasy, setAltEasy] = useState<AlternadoBlock>({ distanceKm: 1.0, intensity: 'leve' });

  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const [workoutId, setWorkoutId] = useState<string | null>(null);

  async function ensureAuth() {
    const { data } = await supabase.auth.getUser();
    if (!data?.user) {
      router.push('/login');
      throw new Error('Sessão expirada. Faça login novamente.');
    }
    return data.user;
  }

  /**
   * ✅ FIX PRINCIPAL:
   * Evita `.single()`/`.maybeSingle()` aqui para não disparar 406/“Cannot coerce…”
   * Usamos `.limit(1)` e pegamos `data[0]`.
   */
  useEffect(() => {
    let isMounted = true;

    async function loadStudent() {
      try {
        setLoadingStudent(true);
        setError(null);

        const user = await ensureAuth();

        const { data: rows, error: dbErr } = await supabase
          .from('students')
          .select('id, trainer_id, name, email, p1k_sec_per_km')
          .eq('id', studentId)
          .eq('trainer_id', user.id)
          .limit(1);

        if (dbErr) throw dbErr;

        const row = rows?.[0] ?? null;
        if (!row) throw new Error('Aluno não encontrado (ou você não tem permissão para acessá-lo).');

        if (isMounted) {
          setStudent({
            id: row.id,
            trainer_id: row.trainer_id,
            name: row.name,
            email: row.email ?? null,
            p1k_sec_per_km: row.p1k_sec_per_km ?? null,
          });
        }
      } catch (err: any) {
        console.error('Erro ao carregar aluno:', err);
        if (isMounted) setError(err?.message || 'Erro ao carregar aluno.');
      } finally {
        if (isMounted) setLoadingStudent(false);
      }
    }

    if (studentId) loadStudent();
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  const computed = useMemo(() => {
    const warm = includeWarmup ? clampNumber(warmupKm, 0.5, 30) : 0;
    const cool = includeCooldown ? clampNumber(cooldownKm, 0.5, 30) : 0;

    let blocks: any[] = [];
    let totalKm = warm + cool;

    if (templateType === 'rodagem') {
      const mainKm = clampNumber(rodagemDistanceKm, 0.5, 60);
      blocks = [{ distance_km: mainKm, intensity: rodagemIntensity, label: 'Bloco principal' }];
      totalKm += mainKm;
    }

    if (templateType === 'progressivo') {
      const ph = phases.map((p) => ({
        distance_km: clampNumber(p.distanceKm, 0.5, 60),
        intensity: p.intensity,
      }));
      blocks = ph;
      totalKm += ph.reduce((acc, b) => acc + Number(b.distance_km), 0);
    }

    if (templateType === 'alternado') {
      const reps = clampNumber(altReps, 1, 40);
      const strongKm = clampNumber(altStrong.distanceKm, 0.1, 10);
      const easyKm = clampNumber(altEasy.distanceKm, 0.1, 10);

      blocks = Array.from({ length: reps }).flatMap(() => [
        { distance_km: strongKm, intensity: altStrong.intensity, role: 'trabalho' },
        { distance_km: easyKm, intensity: altEasy.intensity, role: 'recuperacao' },
      ]);

      totalKm += reps * (strongKm + easyKm);
    }

    return {
      warmup_km: warm,
      cooldown_km: cool,
      total_km: totalKm,
      blocks,
    };
  }, [
    includeWarmup,
    warmupKm,
    includeCooldown,
    cooldownKm,
    templateType,
    rodagemDistanceKm,
    rodagemIntensity,
    phases,
    altReps,
    altStrong,
    altEasy,
  ]);

  async function upsertWorkout(status: 'draft' | 'published') {
    try {
      setSaving(true);
      setError(null);

      const user = await ensureAuth();
      if (!student) throw new Error('Aluno não carregado.');

      const payload: any = {
        student_id: student.id,
        trainer_id: user.id,
        status,
        template_type: templateType,
        include_warmup: includeWarmup,
        warmup_km: computed.warmup_km,
        include_cooldown: includeCooldown,
        cooldown_km: computed.cooldown_km,
        template_params: {
          title: title?.trim() || null,
          notes: notes?.trim() || null,
        },
        blocks: computed.blocks,
        total_km: computed.total_km,
      };

      if (workoutId) {
        const { data, error: dbErr } = await supabase
          .from('workouts')
          .update(payload)
          .eq('id', workoutId)
          .select('id, share_slug')
          .maybeSingle();

        if (dbErr) throw dbErr;
        if (!data) throw new Error('Não foi possível atualizar o treino (verifique permissões/RLS).');

        return data;
      } else {
        const { data, error: dbErr } = await supabase
          .from('workouts')
          .insert(payload)
          .select('id, share_slug')
          .single();

        if (dbErr) throw dbErr;

        setWorkoutId(data.id);
        return data;
      }
    } catch (err: any) {
      console.error('Erro ao salvar treino:', err);
      setError(err?.message || 'Erro ao salvar treino.');
      throw err;
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveDraft() {
    await upsertWorkout('draft');
  }

  async function handleShare() {
    const w: any = await upsertWorkout('published');
    const url = `${window.location.origin}/w/${w.share_slug}`;

    // Melhor fallback para mobile
    try {
      if ((navigator as any).share) {
        await (navigator as any).share({ title: 'PaceLink', text: 'Treino', url });
        return;
      }
    } catch (_) {
      // se usuário cancelar share, cai no fallback abaixo
    }

    try {
      await navigator.clipboard.writeText(url);
      alert('Link copiado! Cole no WhatsApp para enviar ao aluno.');
    } catch (_) {
      window.prompt('Copie o link do treino:', url);
    }
  }

  const pillClass = (active: boolean) =>
    `px-4 py-2 rounded-full text-sm font-semibold transition ${
      active
        ? 'bg-primary text-slate-900 shadow-lg shadow-primary/20'
        : 'bg-white/10 text-white/70 hover:bg-white/15'
    }`;

  return (
    <div className="flex-1 flex flex-col bg-background-light dark:bg-background-dark">
      <Topbar title="Criar Treino" backHref={`/students/${studentId}`} />

      <main className="flex-1 p-4 space-y-4">
        {error && (
          <div className="rounded-xl bg-red-900/40 border border-red-700/40 p-3 text-red-200 text-sm">
            {error}
          </div>
        )}

        <Card>
          <div className="text-xs tracking-wider text-white/60">ALUNO</div>
          <div className="text-lg font-bold">{loadingStudent ? 'Carregando...' : student?.name || '—'}</div>
          <div className="text-sm text-white/70">
            Ritmo P1K: {formatPaceFromSeconds(student?.p1k_sec_per_km)} min/km
          </div>
        </Card>

        <Card>
          <div className="text-base font-bold">Título do treino</div>
          <Input
            value={title}
            onChange={(e: any) => setTitle(e.target.value)}
            placeholder="Ex.: Rodagem leve"
          />
          <div className="text-sm text-white/60 mt-2">
            Distância total estimada: {computed.total_km.toFixed(1)} km
          </div>
        </Card>

        <Card>
          <div className="text-base font-bold">Tipo de Treino</div>
          <div className="mt-3 flex gap-2 flex-wrap">
            <button onClick={() => setTemplateType('rodagem')} className={pillClass(templateType === 'rodagem')}>
              Rodagem
            </button>
            <button onClick={() => setTemplateType('progressivo')} className={pillClass(templateType === 'progressivo')}>
              Progressivo
            </button>
            <button onClick={() => setTemplateType('alternado')} className={pillClass(templateType === 'alternado')}>
              Alternado
            </button>
          </div>
        </Card>

        <Card>
          <div className="text-base font-bold">Estrutura</div>

          <div className="mt-4 flex items-center justify-between">
            <div className="font-semibold">Aquecimento</div>
            <Toggle checked={includeWarmup} onChange={setIncludeWarmup} />
          </div>

          {includeWarmup && (
            <div className="mt-3 grid grid-cols-3 gap-2 items-end">
              <div className="col-span-2">
                <div className="text-xs text-white/60">DISTÂNCIA</div>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={String(warmupKm)}
                  onChange={(e: any) => setWarmupKm(parsePtNumber(e.target.value))}
                />
              </div>
              <div className="text-sm text-white/70 pb-2">km</div>
            </div>
          )}

          <div className="mt-6 flex items-center justify-between">
            <div className="font-semibold">Desaquecimento</div>
            <Toggle checked={includeCooldown} onChange={setIncludeCooldown} />
          </div>

          {includeCooldown && (
            <div className="mt-3 grid grid-cols-3 gap-2 items-end">
              <div className="col-span-2">
                <div className="text-xs text-white/60">DISTÂNCIA</div>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={String(cooldownKm)}
                  onChange={(e: any) => setCooldownKm(parsePtNumber(e.target.value))}
                />
              </div>
              <div className="text-sm text-white/70 pb-2">km</div>
            </div>
          )}
        </Card>

        {templateType === 'rodagem' && (
          <Card>
            <div className="text-base font-bold">Bloco principal</div>
            <div className="mt-3 grid grid-cols-3 gap-2 items-end">
              <div className="col-span-2">
                <div className="text-xs text-white/60">DISTÂNCIA</div>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={String(rodagemDistanceKm)}
                  onChange={(e: any) => setRodagemDistanceKm(parsePtNumber(e.target.value))}
                />
              </div>
              <div className="text-sm text-white/70 pb-2">km</div>
            </div>

            <div className="mt-4 text-xs text-white/60">INTENSIDADE</div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                onClick={() => setRodagemIntensity('leve')}
                className={pillClass(rodagemIntensity === 'leve') + ' flex-1 min-w-[96px] justify-center'}
              >
                Leve
              </button>
              <button
                onClick={() => setRodagemIntensity('moderado')}
                className={pillClass(rodagemIntensity === 'moderado') + ' flex-1 min-w-[96px] justify-center'}
              >
                Moderado
              </button>
              <button
                onClick={() => setRodagemIntensity('forte')}
                className={pillClass(rodagemIntensity === 'forte') + ' flex-1 min-w-[96px] justify-center'}
              >
                Forte
              </button>
            </div>
          </Card>
        )}

        <Card>
          <div className="text-base font-bold">Observações (opcional)</div>
          <Input
            value={notes}
            onChange={(e: any) => setNotes(e.target.value)}
            placeholder="Ex.: Terreno plano, foco em controlar respiração"
          />
        </Card>
      </main>

      <div className="p-4 grid grid-cols-2 gap-3 bg-background-dark/70 backdrop-blur sticky bottom-0">
        <Button variant="secondary" onClick={handleSaveDraft} disabled={saving}>
          Salvar Rascunho
        </Button>
        <Button onClick={handleShare} disabled={saving}>
          <Icon name="share" className="mr-2" />
          Compartilhar
        </Button>
      </div>
    </div>
  );
}
