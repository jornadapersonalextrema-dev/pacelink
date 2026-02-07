'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Topbar from '../../../../components/Topbar';
import { createClient } from '../../../../lib/supabaseBrowser';

type StudentRow = {
  id: string;
  full_name: string;
  p1k_pace?: string | null;
};

type WeekRow = {
  id: string;
  week_start: string; // YYYY-MM-DD
  week_end: string; // YYYY-MM-DD
  label?: string | null;
};

type WorkoutRow = {
  id: string;
  student_id: string;
  week_id: string | null;
  title: string;
  status: 'draft' | 'ready' | 'in_progress' | 'completed' | 'archived';
  template_type: string;
  total_km: number | null;
  planned_date: string | null; // YYYY-MM-DD
  planned_day: number | null; // 0..6
  warmup_km: number | null;
  warmup_enabled: boolean | null;
  blocks: any[] | null; // jsonb
};

type BlockDraft = {
  distanceKm: string; // input
  intensity: 'easy' | 'moderate' | 'hard';
  paceStr: string; // "4:30/km"
  note: string; // obs
};

function parseISODateLocal(iso: string): Date {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const y = Number(m[1]);
    const mm = Number(m[2]);
    const d = Number(m[3]);
    return new Date(y, mm - 1, d, 12, 0, 0);
  }
  return new Date(iso);
}

function formatBR(iso?: string | null) {
  if (!iso) return '—';
  return parseISODateLocal(iso).toLocaleDateString('pt-BR');
}

function templateLabel(template: string): string {
  const map: Record<string, string> = {
    easy_run: 'Rodagem',
    interval_run: 'Intervalado',
    progressive_run: 'Progressivo',
    alternated_run: 'Alternado',
    long_run: 'Longão',
    race: 'Prova',
    recovery: 'Recuperação',
  };
  return map[template] || template;
}

export default function EditWorkoutPage() {
  const router = useRouter();
  const params = useParams();
  const workoutId = String((params as any)?.id || '');

  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  const [student, setStudent] = useState<StudentRow | null>(null);
  const [week, setWeek] = useState<WeekRow | null>(null);
  const [workout, setWorkout] = useState<WorkoutRow | null>(null);

  const [title, setTitle] = useState('');
  const [plannedDate, setPlannedDate] = useState<string>(''); // yyyy-mm-dd
  const [templateType, setTemplateType] = useState<string>('easy_run');
  const [status, setStatus] = useState<WorkoutRow['status']>('draft');

  const [warmupEnabled, setWarmupEnabled] = useState<boolean>(true);
  const [warmupKm, setWarmupKm] = useState<string>('1');

  const [blocks, setBlocks] = useState<BlockDraft[]>([
    { distanceKm: '1', intensity: 'moderate', paceStr: '', note: '' },
  ]);

  const totalKm = useMemo(() => {
    const warm = warmupEnabled ? Number(String(warmupKm || '0').replace(',', '.')) : 0;
    const sumBlocks = blocks.reduce((acc, b) => acc + Number(String(b.distanceKm || '0').replace(',', '.')), 0);
    const total = (isFinite(warm) ? warm : 0) + (isFinite(sumBlocks) ? sumBlocks : 0);
    return Number.isFinite(total) ? total : 0;
  }, [blocks, warmupEnabled, warmupKm]);

  function blocksPayload() {
    return blocks.map((b) => ({
      distance_km: Number(String(b.distanceKm || '0').replace(',', '.')) || 0,
      intensity: b.intensity,
      pace: b.paceStr?.trim() || null,
      note: b.note?.trim() || null,
    }));
  }

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErrorMsg(null);

        const { data: w, error: wErr } = await supabase
          .from('workouts')
          .select('id, student_id, week_id, title, status, template_type, total_km, planned_date, planned_day, warmup_km, warmup_enabled, blocks')
          .eq('id', workoutId)
          .single();

        if (wErr) throw wErr;

        const ww = w as WorkoutRow;
        setWorkout(ww);

        setTitle(ww.title || '');
        setStatus(ww.status);
        setTemplateType(ww.template_type || 'easy_run');
        setPlannedDate(ww.planned_date || '');

        setWarmupEnabled(!!ww.warmup_enabled);
        setWarmupKm(String(ww.warmup_km ?? 1).replace('.', ','));

        // carregar blocos preservando pace/note
        const loadedBlocks = Array.isArray(ww.blocks) ? ww.blocks : [];
        if (loadedBlocks.length) {
          setBlocks(
            loadedBlocks.map((b: any) => ({
              distanceKm: String(b?.distance_km ?? '').replace('.', ',') || '1',
              intensity: (b?.intensity as any) || 'moderate',
              paceStr: String(b?.pace ?? ''),
              note: String(b?.note ?? ''),
            }))
          );
        }

        const { data: s, error: sErr } = await supabase
          .from('students')
          .select('id, full_name, p1k_pace')
          .eq('id', ww.student_id)
          .single();

        if (sErr) throw sErr;
        setStudent(s as StudentRow);

        if (ww.week_id) {
          const { data: wk, error: wkErr } = await supabase
            .from('training_weeks')
            .select('id, week_start, week_end, label')
            .eq('id', ww.week_id)
            .maybeSingle();
          if (!wkErr && wk) setWeek(wk as WeekRow);
        }
      } catch (e: any) {
        setErrorMsg(e?.message || 'Erro ao carregar treino.');
      } finally {
        setLoading(false);
      }
    })();
  }, [supabase, workoutId]);

  async function onSave() {
    if (!workout) return;
    try {
      setSaving(true);
      setErrorMsg(null);
      setInfoMsg(null);

      const payload = {
        title: title.trim(),
        status,
        template_type: templateType,
        planned_date: plannedDate || null,
        warmup_enabled: warmupEnabled,
        warmup_km: warmupEnabled ? Number(String(warmupKm || '0').replace(',', '.')) || 0 : 0,
        blocks: blocksPayload(),
        total_km: totalKm,
      };

      const { error } = await supabase.from('workouts').update(payload).eq('id', workout.id);
      if (error) throw error;

      setInfoMsg('Treino salvo.');
      // opcional: recarregar
    } catch (e: any) {
      setErrorMsg(e?.message || 'Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div>
        <Topbar title="Editar treino" />
        <div style={{ padding: 16 }}>Carregando...</div>
      </div>
    );
  }

  return (
    <div>
      <Topbar title="Editar treino" />

      <div style={{ maxWidth: 880, margin: '0 auto', padding: 16 }}>
        <div
          style={{
            borderRadius: 18,
            padding: 18,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <div style={{ opacity: 0.8, fontSize: 14 }}>Aluno</div>
          <div style={{ fontSize: 28, fontWeight: 900 }}>{student?.full_name}</div>

          <div style={{ marginTop: 8, opacity: 0.9 }}>
            Status: <b>{status === 'draft' ? 'Rascunho' : status === 'ready' ? 'Disponível' : status === 'in_progress' ? 'Em andamento' : status === 'completed' ? 'Concluído' : status}</b>
          </div>
          <div style={{ marginTop: 2, opacity: 0.9 }}>
            Template: <b>{templateLabel(templateType)}</b>
          </div>

          {week && (
            <div style={{ marginTop: 8, opacity: 0.85 }}>
              {week.label || `Semana ${formatBR(week.week_start)} – ${formatBR(week.week_end)}`}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
            <button
              onClick={() => router.back()}
              style={{
                borderRadius: 14,
                padding: '10px 14px',
                border: '1px solid rgba(255,255,255,0.12)',
                background: 'rgba(255,255,255,0.05)',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              Voltar
            </button>

            <button
              onClick={onSave}
              disabled={saving}
              style={{
                borderRadius: 14,
                padding: '10px 14px',
                border: '1px solid rgba(0,0,0,0)',
                background: '#3BE577',
                color: '#0A1B12',
                fontWeight: 900,
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? 'Salvando…' : 'Salvar'}
            </button>
          </div>

          {errorMsg && (
            <div
              style={{
                marginTop: 12,
                padding: 12,
                borderRadius: 12,
                border: '1px solid rgba(255,0,0,0.35)',
                background: 'rgba(255,0,0,0.08)',
              }}
            >
              {errorMsg}
            </div>
          )}

          {infoMsg && (
            <div
              style={{
                marginTop: 12,
                padding: 12,
                borderRadius: 12,
                border: '1px solid rgba(59,229,119,0.35)',
                background: 'rgba(59,229,119,0.08)',
              }}
            >
              {infoMsg}
            </div>
          )}
        </div>

        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 18, fontWeight: 900 }}>Título</div>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{
              width: '100%',
              marginTop: 8,
              borderRadius: 14,
              padding: '12px 14px',
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'rgba(255,255,255,0.04)',
            }}
          />
        </div>

        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 18, fontWeight: 900 }}>Data planejada (opcional)</div>
          <input
            type="date"
            value={plannedDate}
            onChange={(e) => setPlannedDate(e.target.value)}
            style={{
              width: '100%',
              marginTop: 8,
              borderRadius: 14,
              padding: '12px 14px',
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'rgba(255,255,255,0.04)',
            }}
          />
        </div>

        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 18, fontWeight: 900 }}>Template</div>
          <select
            value={templateType}
            onChange={(e) => setTemplateType(e.target.value)}
            style={{
              width: '100%',
              marginTop: 8,
              borderRadius: 14,
              padding: '12px 14px',
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'rgba(255,255,255,0.04)',
            }}
          >
            <option value="easy_run">Rodagem</option>
            <option value="interval_run">Intervalado</option>
            <option value="progressive_run">Progressivo</option>
            <option value="alternated_run">Alternado</option>
            <option value="long_run">Longão</option>
            <option value="race">Prova</option>
            <option value="recovery">Recuperação</option>
          </select>
        </div>

        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 18, fontWeight: 900 }}>Aquecimento</div>
          <label style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 8, opacity: 0.95 }}>
            <input type="checkbox" checked={warmupEnabled} onChange={(e) => setWarmupEnabled(e.target.checked)} />
            Incluir aquecimento
          </label>

          {warmupEnabled && (
            <div style={{ marginTop: 8 }}>
              <input
                value={warmupKm}
                onChange={(e) => setWarmupKm(e.target.value)}
                placeholder="km"
                style={{
                  width: '100%',
                  borderRadius: 14,
                  padding: '12px 14px',
                  border: '1px solid rgba(255,255,255,0.12)',
                  background: 'rgba(255,255,255,0.04)',
                }}
              />
              <div style={{ opacity: 0.75, marginTop: 6 }}>km (mínimo 0,5)</div>
            </div>
          )}
        </div>

        <div style={{ marginTop: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div style={{ fontSize: 18, fontWeight: 900 }}>Blocos</div>
            <button
              onClick={() => setBlocks((prev) => [...prev, { distanceKm: '1', intensity: 'moderate', paceStr: '', note: '' }])}
              style={{
                borderRadius: 999,
                padding: '10px 14px',
                border: '1px solid rgba(255,255,255,0.12)',
                background: 'rgba(255,255,255,0.05)',
                fontWeight: 900,
                cursor: 'pointer',
              }}
            >
              + Adicionar bloco
            </button>
          </div>

          <div style={{ marginTop: 12, display: 'grid', gap: 12 }}>
            {blocks.map((b, idx) => (
              <div
                key={idx}
                style={{
                  borderRadius: 18,
                  padding: 16,
                  background: 'rgba(0,0,0,0.25)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <div style={{ fontSize: 16, fontWeight: 900 }}>Bloco {idx + 1}</div>
                  <button
                    onClick={() => setBlocks((prev) => prev.filter((_, i) => i !== idx))}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#ffb4b4',
                      fontWeight: 900,
                    }}
                  >
                    Remover
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
                  <div>
                    <div style={{ opacity: 0.85, marginBottom: 6 }}>Distância (km)</div>
                    <input
                      value={b.distanceKm}
                      onChange={(e) =>
                        setBlocks((prev) => prev.map((x, i) => (i === idx ? { ...x, distanceKm: e.target.value } : x)))
                      }
                      style={{
                        width: '100%',
                        borderRadius: 14,
                        padding: '12px 14px',
                        border: '1px solid rgba(255,255,255,0.12)',
                        background: 'rgba(255,255,255,0.04)',
                      }}
                    />
                  </div>

                  <div>
                    <div style={{ opacity: 0.85, marginBottom: 6 }}>Intensidade</div>
                    <select
                      value={b.intensity}
                      onChange={(e) =>
                        setBlocks((prev) =>
                          prev.map((x, i) => (i === idx ? { ...x, intensity: e.target.value as any } : x))
                        )
                      }
                      style={{
                        width: '100%',
                        borderRadius: 14,
                        padding: '12px 14px',
                        border: '1px solid rgba(255,255,255,0.12)',
                        background: 'rgba(255,255,255,0.04)',
                      }}
                    >
                      <option value="easy">Leve</option>
                      <option value="moderate">Moderado</option>
                      <option value="hard">Forte</option>
                    </select>
                  </div>
                </div>

                <div style={{ marginTop: 10 }}>
                  <div style={{ opacity: 0.85, marginBottom: 6 }}>Ritmo sugerido</div>
                  <input
                    value={b.paceStr}
                    onChange={(e) =>
                      setBlocks((prev) => prev.map((x, i) => (i === idx ? { ...x, paceStr: e.target.value } : x)))
                    }
                    placeholder="Ex.: 4:30/km"
                    style={{
                      width: '100%',
                      borderRadius: 14,
                      padding: '12px 14px',
                      border: '1px solid rgba(255,255,255,0.12)',
                      background: 'rgba(255,255,255,0.04)',
                    }}
                  />
                </div>

                <div style={{ marginTop: 10 }}>
                  <div style={{ opacity: 0.85, marginBottom: 6 }}>Obs</div>
                  <textarea
                    value={b.note}
                    onChange={(e) =>
                      setBlocks((prev) => prev.map((x, i) => (i === idx ? { ...x, note: e.target.value } : x)))
                    }
                    placeholder="Opcional"
                    rows={3}
                    style={{
                      width: '100%',
                      borderRadius: 14,
                      padding: '12px 14px',
                      border: '1px solid rgba(255,255,255,0.12)',
                      background: 'rgba(255,255,255,0.04)',
                      resize: 'vertical',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 10, opacity: 0.9 }}>
            Total estimado: <b>{String(totalKm).replace('.', ',')} km</b>
          </div>
        </div>

        <div style={{ marginTop: 18 }}>
          <button
            onClick={onSave}
            disabled={saving}
            style={{
              width: '100%',
              borderRadius: 18,
              padding: '16px 18px',
              border: '1px solid rgba(0,0,0,0)',
              background: '#3BE577',
              color: '#0A1B12',
              fontWeight: 1000,
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}
