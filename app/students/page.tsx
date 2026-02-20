'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabaseBrowser';
import { Topbar } from '@/components/Topbar';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { ModalConfirm } from '@/components/ModalConfirm';

type StudentRow = {
  id: string;
  trainer_id: string;
  name: string;
  email: string | null;
  p1k_sec_per_km: number;
  created_at: string;
  updated_at: string;

  is_active: boolean;
  portal_enabled: boolean;
  auth_user_id: string | null;
};

function parsePaceToSeconds(input: string): number | null {
  const v = (input || '').trim().replace(',', ':').replace('.', ':');
  const m = v.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const min = Number(m[1]);
  const sec = Number(m[2]);
  if (!Number.isFinite(min) || !Number.isFinite(sec) || sec >= 60) return null;
  const total = min * 60 + sec;
  if (total < 120 || total > 1200) return null;
  return total;
}

function formatPace(seconds?: number | null): string {
  if (seconds == null) return '--:--';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function isValidEmail(email: string): boolean {
  const v = (email || '').trim();
  if (!v) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function slugify(s: string) {
  const out = (s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return out || 'aluno';
}

function shortId(len = 6) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < len; i++) out += chars[bytes[i] % chars.length];
  return out;
}

function randomToken(bytes = 24) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);

  let bin = '';
  for (let i = 0; i < arr.length; i++) {
    bin += String.fromCharCode(arr[i]);
  }

  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export default function StudentsPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [trainerId, setTrainerId] = useState<string | null>(null);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [signingOut, setSigningOut] = useState(false);

  const [openNew, setOpenNew] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [p1k, setP1k] = useState('5:00');
  const [saving, setSaving] = useState(false);

  // Convidar pendentes
  const [inviteMsg, setInviteMsg] = useState<string | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);

  // Mostrar inativos
  const [showInactive, setShowInactive] = useState(false);

  // Menu/Ações por aluno
  const [actionsOpen, setActionsOpen] = useState(false);
  const [actionsStudent, setActionsStudent] = useState<StudentRow | null>(null);

  // Confirmações
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmKind, setConfirmKind] = useState<'deactivate' | 'activate' | 'delete' | null>(null);
  const [confirmStudent, setConfirmStudent] = useState<StudentRow | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  const inactiveCount = useMemo(() => students.filter((s) => s.is_active === false).length, [students]);
  const visibleStudents = useMemo(() => {
    if (showInactive) return students;
    return students.filter((s) => s.is_active !== false);
  }, [students, showInactive]);

  async function loadStudents(tid: string) {
    setError(null);
    const { data, error } = await supabase
      .from('students')
      .select('id, trainer_id, name, email, p1k_sec_per_km, created_at, updated_at, is_active, portal_enabled, auth_user_id')
      .eq('trainer_id', tid)
      .order('created_at', { ascending: false });

    if (error) {
      setError(error.message);
      return;
    }

    const rows = ((data as any[]) || []).map((r) => ({
      ...r,
      is_active: r.is_active !== false, // fallback seguro
    })) as StudentRow[];

    setStudents(rows);
  }

  async function invitePending() {
    setInviteMsg(null);
    setInviteLoading(true);
    try {
      const res = await fetch('/api/trainer/students/invite-pending', { method: 'POST' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
      setInviteMsg(json?.message || 'Convites processados.');
    } catch (e: any) {
      setInviteMsg(e?.message || 'Erro ao convidar pendentes.');
    } finally {
      setInviteLoading(false);
    }
  }

  function openActions(s: StudentRow) {
    setActionsStudent(s);
    setActionsOpen(true);
  }

  function closeActions() {
    setActionsOpen(false);
    setActionsStudent(null);
  }

  function openConfirm(kind: 'deactivate' | 'activate' | 'delete', s: StudentRow) {
    setConfirmKind(kind);
    setConfirmStudent(s);
    setConfirmOpen(true);
  }

  function closeConfirm() {
    setConfirmOpen(false);
    setConfirmKind(null);
    setConfirmStudent(null);
  }

  async function apiPatchStudent(studentId: string, payload: any) {
    const res = await fetch(`/api/trainer/students/${studentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
    return json;
  }

  async function apiDeleteStudent(studentId: string) {
    const res = await fetch(`/api/trainer/students/${studentId}`, { method: 'DELETE' });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
    return json;
  }

  async function runConfirmedAction() {
    if (!trainerId || !confirmKind || !confirmStudent) return;

    setActionBusy(true);
    setError(null);
    setInviteMsg(null);

    try {
      if (confirmKind === 'deactivate') {
        await apiPatchStudent(confirmStudent.id, { is_active: false, disable_portal: true });
        setInviteMsg(`Aluno inativado: ${confirmStudent.name}`);
      } else if (confirmKind === 'activate') {
        await apiPatchStudent(confirmStudent.id, { is_active: true });
        setInviteMsg(`Aluno reativado: ${confirmStudent.name}`);
      } else if (confirmKind === 'delete') {
        await apiDeleteStudent(confirmStudent.id);
        setInviteMsg(`Aluno apagado: ${confirmStudent.name}`);
      }

      await loadStudents(trainerId);
    } catch (e: any) {
      setError(e?.message || 'Erro ao executar ação.');
    } finally {
      setActionBusy(false);
      closeConfirm();
      closeActions();
    }
  }

  useEffect(() => {
    const boot = async () => {
      setError(null);
      const { data, error: userErr } = await supabase.auth.getUser();
      if (userErr) {
        setError(userErr.message);
        setLoading(false);
        return;
      }
      if (!data.user) {
        router.replace('/login');
        return;
      }
      setTrainerId(data.user.id);
      setLoading(false);
    };

    boot();
  }, [router, supabase]);

  useEffect(() => {
    if (!trainerId) return;
    void loadStudents(trainerId);
  }, [trainerId]);

  const handleSignOut = async () => {
    if (signingOut) return;

    const ok = window.confirm('Sair do sistema?');
    if (!ok) return;

    setSigningOut(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      router.replace('/login');
      router.refresh();
    } catch (e: any) {
      setError(e?.message || 'Erro ao sair do sistema.');
    } finally {
      setSigningOut(false);
    }
  };

  const handleCreateStudent = async () => {
    if (!trainerId) return;

    const p1kSec = parsePaceToSeconds(p1k);
    if (!name.trim()) {
      setError('Informe o nome do aluno.');
      return;
    }

    const emailTrim = email.trim();
    if (emailTrim && !isValidEmail(emailTrim)) {
      setError('E-mail inválido.');
      return;
    }

    if (p1kSec == null) {
      setError('P1k inválido. Use o formato mm:ss (ex.: 4:30).');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const base = slugify(name.trim());
      const public_slug = `${base}-${shortId(6)}`;
      const portal_token = randomToken(24);

      const payload: any = {
        trainer_id: trainerId,
        name: name.trim(),
        email: emailTrim ? emailTrim.toLowerCase() : null,
        p1k_sec_per_km: p1kSec,

        public_slug,
        portal_token,
        portal_enabled: false,

        is_active: true,
      };

      const { data, error } = await supabase.from('students').insert([payload]).select('id').single();
      if (error) throw error;

      setOpenNew(false);
      setName('');
      setEmail('');
      setP1k('5:00');

      router.push(`/students/${data.id}`);
    } catch (e: any) {
      setError(e?.message || 'Erro ao criar aluno.');
    } finally {
      setSaving(false);
    }
  };

  const confirmTitle = useMemo(() => {
    if (!confirmKind || !confirmStudent) return '';
    if (confirmKind === 'delete') return 'Apagar aluno?';
    if (confirmKind === 'deactivate') return 'Inativar aluno?';
    return 'Reativar aluno?';
  }, [confirmKind, confirmStudent]);

  const confirmMessage = useMemo(() => {
    if (!confirmKind || !confirmStudent) return '';
    const n = confirmStudent.name;

    if (confirmKind === 'delete') {
      return (
        `Tem certeza que deseja APAGAR o aluno "${n}"?\n\n` +
        `⚠️ Esta ação é permanente.\n` +
        `Todos os dados do aluno no sistema serão perdidos (treinos, semanas, execuções e relatórios).`
      );
    }

    if (confirmKind === 'deactivate') {
      return (
        `Inativar o aluno "${n}"?\n\n` +
        `Ele vai SUMIR da lista principal.\n` +
        `O Portal do aluno será DESABILITADO imediatamente.`
      );
    }

    return (
      `Reativar o aluno "${n}"?\n\n` +
      `Ele voltará para a lista principal.\n` +
      `O Portal continuará desabilitado até você enviar um novo convite.`
    );
  }, [confirmKind, confirmStudent]);

  const confirmLabel = useMemo(() => {
    if (confirmKind === 'delete') return actionBusy ? 'Apagando…' : 'Apagar definitivamente';
    if (confirmKind === 'deactivate') return actionBusy ? 'Inativando…' : 'Inativar';
    if (confirmKind === 'activate') return actionBusy ? 'Reativando…' : 'Reativar';
    return 'Confirmar';
  }, [confirmKind, actionBusy]);

  const confirmVariant = confirmKind === 'delete' ? 'danger' : 'primary';

  return (
    <div className="flex-1 flex flex-col bg-background-light dark:bg-background-dark">
      <Topbar title="Alunos" />

      <main className="flex-1 overflow-y-auto no-scrollbar pb-28">
        <div className="px-5 pt-6">
          {trainerId ? (
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                {inactiveCount > 0 ? (
                  <button
                    className="text-sm underline text-slate-500 dark:text-slate-300"
                    onClick={() => setShowInactive((v) => !v)}
                  >
                    {showInactive ? 'Ocultar inativos' : `Mostrar inativos (${inactiveCount})`}
                  </button>
                ) : (
                  <span className="text-sm text-slate-500 dark:text-slate-300"> </span>
                )}
              </div>

              <button
                className="text-sm underline text-slate-500 dark:text-slate-300 disabled:opacity-50"
                onClick={handleSignOut}
                disabled={signingOut}
              >
                {signingOut ? 'Saindo...' : 'Sair'}
              </button>
            </div>
          ) : null}

          {inviteMsg && (
            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 p-4 text-sm text-emerald-700 dark:text-emerald-300 mb-4">
              {inviteMsg}
            </div>
          )}

          {error && (
            <div className="rounded-xl bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-600 dark:text-red-300 mb-4">
              {error}
            </div>
          )}

          {loading ? (
            <Card className="p-4">Carregando...</Card>
          ) : (
            <>
              {visibleStudents.length === 0 ? (
                <Card className="p-5 text-sm text-slate-500">
                  {students.length === 0 ? (
                    <>
                      Nenhum aluno cadastrado ainda. Toque em <b>Novo Aluno</b> para começar.
                    </>
                  ) : (
                    <>
                      Nenhum aluno <b>ativo</b> na lista.{' '}
                      {inactiveCount > 0 ? (
                        <button className="underline" onClick={() => setShowInactive(true)}>
                          Mostrar inativos
                        </button>
                      ) : null}
                    </>
                  )}
                </Card>
              ) : (
                <div className="space-y-4">
                  {visibleStudents.map((s) => {
                    const isInactive = s.is_active === false;

                    return (
                      <Card
                        key={s.id}
                        className="p-4 flex items-center justify-between cursor-pointer"
                        onClick={() => router.push(`/students/${s.id}`)}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <div className="font-bold text-base truncate">{s.name}</div>
                            {isInactive ? (
                              <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 dark:bg-white/10 dark:text-slate-200">
                                INATIVO
                              </span>
                            ) : null}
                          </div>

                          <div className="text-xs text-slate-500 mt-1">
                            P1k: <span className="text-primary font-bold">{formatPace(s.p1k_sec_per_km)}</span> min/km
                            {s.email ? <span className="text-slate-400"> • {s.email}</span> : null}
                            {s.portal_enabled ? (
                              <span className="text-emerald-500 dark:text-emerald-300"> • Portal ON</span>
                            ) : (
                              <span className="text-slate-400"> • Portal OFF</span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            className="rounded-xl px-2 py-2 hover:bg-black/5 dark:hover:bg-white/5"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              openActions(s);
                            }}
                            aria-label="Ações"
                            title="Ações"
                          >
                            <span className="material-symbols-outlined text-slate-400">more_vert</span>
                          </button>

                          <span className="material-symbols-outlined text-slate-400">chevron_right</span>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* CTA fixo */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-background-light dark:from-background-dark via-background-light/95 to-transparent">
        <div className="max-w-md mx-auto space-y-2">
          <Button onClick={invitePending} icon="mail" disabled={inviteLoading}>
            {inviteLoading ? 'Enviando convites…' : 'Convidar pendentes'}
          </Button>

          <Button
            onClick={() => {
              setError(null);
              setOpenNew(true);
            }}
            icon="person_add"
          >
            Novo Aluno
          </Button>
        </div>
      </div>

      {/* Modal: Novo aluno */}
      {openNew && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md p-5">
            <div className="text-lg font-black mb-4">Novo Aluno</div>

            {error && (
              <div className="rounded-xl bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-600 dark:text-red-300 mb-4">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Nome</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl bg-surface-dark border border-white/10 px-4 py-3 text-white outline-none"
                  placeholder="Ex.: Márcio Automatik"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Email (opcional)</label>
                <input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl bg-surface-dark border border-white/10 px-4 py-3 text-white outline-none"
                  placeholder="aluno@email.com"
                />
                {!email.trim() && (
                  <div className="text-[11px] text-amber-400 mt-1">
                    Sem e-mail: não será possível convidar para o Portal ainda.
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">P1k (mm:ss / km)</label>
                <input
                  value={p1k}
                  onChange={(e) => setP1k(e.target.value)}
                  className="w-full rounded-xl bg-surface-dark border border-white/10 px-4 py-3 text-white outline-none"
                  placeholder="Ex.: 4:30"
                />
                <div className="text-[11px] text-slate-400 mt-1">
                  Será salvo como <b>segundos por km</b> em <code>p1k_sec_per_km</code>.
                </div>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              <Button onClick={handleCreateStudent} disabled={saving}>
                {saving ? 'Salvando...' : 'Salvar'}
              </Button>
              <button className="w-full text-center text-slate-400 font-bold py-2" onClick={() => setOpenNew(false)}>
                Cancelar
              </button>
            </div>
          </Card>
        </div>
      )}

      {/* Modal: ações do aluno */}
      {actionsOpen && actionsStudent ? (
        <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center bg-black/50 p-4">
          <div className="absolute inset-0" onClick={closeActions} />
          <Card className="w-full max-w-md p-5 relative z-10">
            <div className="text-lg font-black mb-1">{actionsStudent.name}</div>
            <div className="text-xs text-slate-500 mb-4">
              {actionsStudent.is_active === false ? 'Aluno inativo • Portal desabilitado' : actionsStudent.portal_enabled ? 'Ativo • Portal habilitado' : 'Ativo • Portal desabilitado'}
            </div>

            <div className="space-y-2">
              <Button onClick={() => { closeActions(); router.push(`/students/${actionsStudent.id}`); }} icon="open_in_new">
                Abrir aluno
              </Button>

              {actionsStudent.is_active === false ? (
                <Button
                  onClick={() => openConfirm('activate', actionsStudent)}
                  icon="play_circle"
                  disabled={actionBusy}
                >
                  Reativar (portal continua desabilitado)
                </Button>
              ) : (
                <Button
                  onClick={() => openConfirm('deactivate', actionsStudent)}
                  icon="pause_circle"
                  disabled={actionBusy}
                >
                  Inativar (desabilita o portal)
                </Button>
              )}

              <Button
                variant="danger"
                onClick={() => openConfirm('delete', actionsStudent)}
                icon="delete"
                disabled={actionBusy}
              >
                Apagar definitivamente
              </Button>

              <Button variant="ghost" onClick={closeActions}>
                Cancelar
              </Button>
            </div>
          </Card>
        </div>
      ) : null}

      {/* Confirmação */}
      <ModalConfirm
        isOpen={confirmOpen}
        onClose={closeConfirm}
        onConfirm={runConfirmedAction}
        title={confirmTitle}
        message={confirmMessage}
        confirmLabel={confirmLabel}
        cancelLabel="Cancelar"
        variant={confirmVariant}
      />
    </div>
  );
}
