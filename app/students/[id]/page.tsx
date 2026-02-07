'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Topbar from '../../../components/Topbar';
import { createClient } from '../../../lib/supabaseBrowser';

type StudentRow = {
  id: string;
  full_name: string;
  p1k_pace?: string | null;
  trainer_id?: string | null;
  public_slug?: string | null;
  portal_token?: string | null;
  portal_enabled?: boolean | null;
};

type WeekRow = {
  id: string;
  student_id: string;
  trainer_id?: string | null;
  week_start: string; // YYYY-MM-DD
  week_end: string; // YYYY-MM-DD
  label?: string | null;
};

type WorkoutRow = {
  id: string;
  title: string;
  status: 'draft' | 'ready' | 'in_progress' | 'completed' | 'archived';
  template_type: string;
  total_km: number | null;
  planned_date: string | null; // YYYY-MM-DD
  planned_day: number | null; // 0..6
};

function parseISODateLocal(iso: string): Date {
  // Se for YYYY-MM-DD, cria date local (meio-dia) para não “voltar 1 dia” no Brasil
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const y = Number(m[1]);
    const mm = Number(m[2]);
    const d = Number(m[3]);
    return new Date(y, mm - 1, d, 12, 0, 0);
  }
  return new Date(iso);
}

function toISODateLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDaysLocal(date: Date, days: number): Date {
  const d = new Date(date.getTime());
  d.setDate(d.getDate() + days);
  return d;
}

function startOfWeekMondayLocal(date: Date): Date {
  const d = new Date(date.getTime());
  d.setHours(12, 0, 0, 0);
  const day = d.getDay(); // 0=dom
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function formatBR(iso?: string | null): string {
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

function plannedDayLabel(d: number | null): string {
  const map = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
  if (d == null) return '';
  return map[d] ?? '';
}

function slugify(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function base64Url(bytes: Uint8Array): string {
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  const b64 = btoa(bin);
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function makeToken(): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

export default function StudentDetailPage() {
  const router = useRouter();
  const params = useParams();
  const studentId = String((params as any)?.id || '');

  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [student, setStudent] = useState<StudentRow | null>(null);

  const [weeks, setWeeks] = useState<WeekRow[]>([]);
  const [selectedWeekId, setSelectedWeekId] = useState<string | null>(null);

  const [workouts, setWorkouts] = useState<WorkoutRow[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  const selectedWeek = useMemo(() => weeks.find((w) => w.id === selectedWeekId) || null, [weeks, selectedWeekId]);

  const portalConfigured = !!(student?.public_slug && student?.portal_token);

  const weekRangeLabel = useMemo(() => {
    if (!selectedWeek) return '';
    // exibir SEM “voltar 1 dia”
    return `Semana ${formatBR(selectedWeek.week_start)} – ${formatBR(selectedWeek.week_end)}`;
  }, [selectedWeek]);

  async function fetchStudent() {
    const { data, error } = await supabase
      .from('students')
      .select('id, full_name, p1k_pace, trainer_id, public_slug, portal_token, portal_enabled')
      .eq('id', studentId)
      .single();

    if (error) throw error;
    setStudent(data as StudentRow);
  }

  async function ensureUpcomingWeeksInDb(studentRow: StudentRow) {
    // cria/garante as próximas semanas (Seg→Dom) no banco, para o treinador sempre ter “calendário” pronto.
    const monday = startOfWeekMondayLocal(new Date());
    const rows = Array.from({ length: 10 }).map((_, i) => {
      const ws = addDaysLocal(monday, i * 7);
      const we = addDaysLocal(ws, 6); // domingo
      return {
        student_id: studentRow.id,
        trainer_id: studentRow.trainer_id ?? null,
        week_start: toISODateLocal(ws),
        week_end: toISODateLocal(we),
      };
    });

    // onConflict depende do seu constraint. No seu SQL do MVP geralmente é (student_id, week_start)
    const { error } = await supabase.from('training_weeks').upsert(rows, { onConflict: 'student_id,week_start' });
    if (error) {
      // não travar a tela — apenas informar.
      setInfoMsg(`Aviso: não consegui garantir semanas no banco (${error.message}).`);
    }
  }

  async function fetchWeeks() {
    const mondayISO = toISODateLocal(startOfWeekMondayLocal(new Date()));

    const { data, error } = await supabase
      .from('training_weeks')
      .select('id, student_id, trainer_id, week_start, week_end, label')
      .eq('student_id', studentId)
      .gte('week_start', mondayISO)
      .order('week_start', { ascending: true });

    if (error) throw error;

    const list = (data as WeekRow[]) || [];
    setWeeks(list);

    if (!selectedWeekId && list.length) setSelectedWeekId(list[0].id);
  }

  async function fetchWorkouts(weekId: string) {
    const { data, error } = await supabase
      .from('workouts')
      .select('id, title, status, template_type, total_km, planned_date, planned_day')
      .eq('student_id', studentId)
      .eq('week_id', weekId) // ✅ aqui é week_id (NÃO week_start)
      .neq('status', 'archived')
      .order('planned_day', { ascending: true, nullsFirst: true })
      .order('created_at', { ascending: true });

    if (error) throw error;
    setWorkouts((data as WorkoutRow[]) || []);
  }

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErrorMsg(null);
        setInfoMsg(null);

        await fetchStudent();

        // depois que student carregou
        const { data: s } = await supabase
          .from('students')
          .select('id, full_name, p1k_pace, trainer_id, public_slug, portal_token, portal_enabled')
          .eq('id', studentId)
          .single();

        const studentRow = s as StudentRow;

        await ensureUpcomingWeeksInDb(studentRow);
        await fetchWeeks();
      } catch (e: any) {
        setErrorMsg(e?.message || 'Erro ao carregar aluno.');
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  useEffect(() => {
    if (!selectedWeekId) return;
    (async () => {
      try {
        setErrorMsg(null);
        await fetchWorkouts(selectedWeekId);
      } catch (e: any) {
        setErrorMsg(e?.message || 'Erro ao carregar treinos.');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWeekId]);

  const counts = useMemo(() => {
    const draft = workouts.filter((w) => w.status === 'draft').length;
    const ready = workouts.filter((w) => w.status === 'ready').length;
    const inProgress = workouts.filter((w) => w.status === 'in_progress').length;
    const completed = workouts.filter((w) => w.status === 'completed').length;
    return { total: workouts.length, draft, ready, inProgress, completed };
  }, [workouts]);

  function portalUrl(s: StudentRow) {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `${origin}/p/${s.public_slug}?t=${s.portal_token}`;
  }

  async function ensurePortalEnabled() {
    if (!student) return null;

    const patch: Partial<StudentRow> = {};
    const slug = student.public_slug || `${slugify(student.full_name)}-${student.id.slice(0, 6)}`;
    const token = student.portal_token || makeToken();

    patch.public_slug = slug;
    patch.portal_token = token;
    patch.portal_enabled = true;

    const { data, error } = await supabase
      .from('students')
      .update(patch)
      .eq('id', student.id)
      .select('id, full_name, p1k_pace, trainer_id, public_slug, portal_token, portal_enabled')
      .single();

    if (error) throw error;

    const updated = data as StudentRow;
    setStudent(updated);
    return updated;
  }

  async function onSharePortal() {
    try {
      setErrorMsg(null);
      setInfoMsg(null);

      const updated = await ensurePortalEnabled();
      if (!updated?.public_slug || !updated?.portal_token) {
        setErrorMsg('Não foi possível habilitar o portal (token/slug ausentes).');
        return;
      }

      const url = portalUrl(updated);

      // Share sheet no celular, fallback para copiar
      const canShare = typeof navigator !== 'undefined' && !!(navigator as any).share;
      if (canShare) {
        await (navigator as any).share({
          title: `Portal do aluno - ${updated.full_name}`,
          text: 'Acesse seus treinos da semana neste link:',
          url,
        });
        setInfoMsg('Link do portal compartilhado.');
        return;
      }

      await navigator.clipboard.writeText(url);
      setInfoMsg('Link do portal copiado.');
    } catch (e: any) {
      setErrorMsg(e?.message || 'Erro ao compartilhar portal.');
    }
  }

  async function onPublishWeek() {
    try {
      setErrorMsg(null);
      setInfoMsg(null);
      if (!selectedWeek) return;

      // publica: rascunho -> disponível (ready)
      const { error } = await supabase
        .from('workouts')
        .update({ status: 'ready' })
        .eq('student_id', studentId)
        .eq('week_id', selectedWeek.id)
        .eq('status', 'draft');

      if (error) throw error;

      await fetchWorkouts(selectedWeek.id);
      setInfoMsg('Semana publicada (rascunhos viraram disponíveis).');
    } catch (e: any) {
      setErrorMsg(e?.message || 'Erro ao publicar semana.');
    }
  }

  function onScheduleWorkout() {
    if (!selectedWeek) return;
    router.push(`/students/${studentId}/workouts/new?weekId=${selectedWeek.id}`);
  }

  function onEditWorkout(id: string) {
    router.push(`/workouts/${id}/edit`);
  }

  function onViewAsStudent() {
    if (!student || !portalConfigured) return;
    window.open(portalUrl(student), '_blank', 'noopener,noreferrer');
  }

  if (loading) {
    return (
      <div>
        <Topbar title="Aluno" />
        <div style={{ padding: 16 }}>Carregando...</div>
      </div>
    );
  }

  return (
    <div>
      <Topbar title="Aluno" />

      <div style={{ maxWidth: 880, margin: '0 auto', padding: 16 }}>
        <div
          style={{
            borderRadius: 18,
            padding: 18,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <div style={{ opacity: 0.8, fontSize: 14 }}>Aluno</div>
              <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1.1 }}>{student?.full_name}</div>
              <div style={{ marginTop: 8, opacity: 0.85 }}>
                Ritmo P1k: <b>{student?.p1k_pace || '—'}</b>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 220 }}>
              <button
                onClick={onScheduleWorkout}
                style={{
                  borderRadius: 14,
                  padding: '12px 14px',
                  border: '1px solid rgba(255,255,255,0.15)',
                  background: 'rgba(255,255,255,0.06)',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                + Programar treino
              </button>

              <button
                onClick={() => router.push('/students')}
                style={{
                  borderRadius: 14,
                  padding: '10px 14px',
                  border: '1px solid rgba(255,255,255,0.10)',
                  background: 'transparent',
                  cursor: 'pointer',
                  opacity: 0.9,
                }}
              >
                Voltar
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 14, flexWrap: 'wrap' }}>
            <button
              onClick={onSharePortal}
              style={{
                borderRadius: 14,
                padding: '12px 14px',
                border: '1px solid rgba(0,0,0,0)',
                background: '#3BE577',
                color: '#0A1B12',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              Compartilhar acesso (Portal)
            </button>

            <button
              onClick={onPublishWeek}
              style={{
                borderRadius: 14,
                padding: '12px 14px',
                border: '1px solid rgba(255,255,255,0.15)',
                background: 'rgba(255,255,255,0.06)',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              Publicar semana
            </button>

            <button
              disabled={!portalConfigured}
              onClick={onViewAsStudent}
              style={{
                borderRadius: 14,
                padding: '12px 14px',
                border: '1px solid rgba(255,255,255,0.15)',
                background: portalConfigured ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.03)',
                fontWeight: 800,
                cursor: portalConfigured ? 'pointer' : 'not-allowed',
                opacity: portalConfigured ? 1 : 0.6,
              }}
              title={portalConfigured ? 'Abrir portal do aluno' : 'Portal ainda não configurado'}
            >
              Ver como aluno
            </button>

            <div style={{ alignSelf: 'center', opacity: 0.8 }}>
              {portalConfigured ? 'Portal configurado ✅' : 'Portal não configurado'}
            </div>
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

        <div style={{ marginTop: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 900 }}>Planejamento por semana</div>
              <div style={{ opacity: 0.85, marginTop: 2 }}>{weekRangeLabel}</div>
            </div>
            <button
              onClick={() => router.push(`/students/${studentId}/history`)}
              style={{
                background: 'transparent',
                border: 'none',
                textDecoration: 'underline',
                cursor: 'pointer',
                opacity: 0.9,
              }}
              title="Histórico (semanas anteriores)"
            >
              Ver histórico
            </button>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
            {weeks.map((w) => {
              const active = w.id === selectedWeekId;
              return (
                <button
                  key={w.id}
                  onClick={() => setSelectedWeekId(w.id)}
                  style={{
                    borderRadius: 999,
                    padding: '10px 14px',
                    border: active ? '1px solid rgba(0,0,0,0)' : '1px solid rgba(255,255,255,0.12)',
                    background: active ? '#3BE577' : 'rgba(255,255,255,0.05)',
                    color: active ? '#0A1B12' : 'inherit',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  {w.label || `Semana ${formatBR(w.week_start)} – ${formatBR(w.week_end)}`}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ marginTop: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 900 }}>Treinos da semana</div>
              <div style={{ opacity: 0.85, marginTop: 2 }}>
                Programados: <b>{counts.total}</b> · Disponíveis: <b>{counts.ready}</b> · Rascunhos: <b>{counts.draft}</b> · Em andamento:{' '}
                <b>{counts.inProgress}</b> · Concluídos: <b>{counts.completed}</b>
              </div>
            </div>

            <button
              onClick={() => selectedWeekId && fetchWorkouts(selectedWeekId)}
              style={{
                background: 'transparent',
                border: 'none',
                textDecoration: 'underline',
                cursor: 'pointer',
                opacity: 0.9,
              }}
            >
              Atualizar
            </button>
          </div>

          <div style={{ marginTop: 12, display: 'grid', gap: 12 }}>
            {workouts.length === 0 && (
              <div style={{ opacity: 0.85, padding: 14, borderRadius: 14, background: 'rgba(255,255,255,0.04)' }}>
                Nenhum treino programado para esta semana ainda.
              </div>
            )}

            {workouts.map((w) => (
              <div
                key={w.id}
                style={{
                  borderRadius: 18,
                  padding: 16,
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 18, fontWeight: 900, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {w.title || '(sem título)'}
                    </div>
                    <div style={{ opacity: 0.88, marginTop: 6 }}>
                      {templateLabel(w.template_type)} {w.total_km != null ? `· ${String(w.total_km).replace('.', ',')} km` : ''}{' '}
                      {w.planned_day != null ? `· ${plannedDayLabel(w.planned_day)}` : ''}{' '}
                      {w.planned_date ? `· Planejado: ${formatBR(w.planned_date)}` : ''}
                    </div>
                    <div style={{ opacity: 0.85, marginTop: 2 }}>
                      Status: <b>{w.status === 'draft' ? 'Rascunho' : w.status === 'ready' ? 'Disponível' : w.status === 'in_progress' ? 'Em andamento' : w.status === 'completed' ? 'Concluído' : w.status}</b>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 200 }}>
                    <button
                      onClick={() => onEditWorkout(w.id)}
                      style={{
                        borderRadius: 14,
                        padding: '12px 14px',
                        border: '1px solid rgba(255,255,255,0.15)',
                        background: 'rgba(255,255,255,0.06)',
                        fontWeight: 900,
                        cursor: 'pointer',
                      }}
                    >
                      Editar
                    </button>

                    <button
                      onClick={async () => {
                        // Compartilhar “o treino” via portal (link fixo + navegação no portal)
                        if (!student || !portalConfigured) {
                          setErrorMsg('Portal ainda não configurado para este aluno.');
                          return;
                        }
                        const url = portalUrl(student);
                        const canShare = typeof navigator !== 'undefined' && !!(navigator as any).share;
                        try {
                          if (canShare) {
                            await (navigator as any).share({
                              title: `Portal - ${student.full_name}`,
                              text: 'Acesse seus treinos da semana neste link:',
                              url,
                            });
                            setInfoMsg('Portal compartilhado.');
                          } else {
                            await navigator.clipboard.writeText(url);
                            setInfoMsg('Link do portal copiado.');
                          }
                        } catch (e: any) {
                          setErrorMsg(e?.message || 'Não foi possível compartilhar.');
                        }
                      }}
                      style={{
                        borderRadius: 14,
                        padding: '12px 14px',
                        border: '1px solid rgba(0,0,0,0)',
                        background: '#3BE577',
                        color: '#0A1B12',
                        fontWeight: 900,
                        cursor: 'pointer',
                      }}
                    >
                      Compartilhar (Portal)
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
