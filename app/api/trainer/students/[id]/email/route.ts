import { NextResponse, type NextRequest } from 'next/server';
import { requireTrainer } from '@/lib/authGuard';
import { createAdminSupabase } from '@/lib/supabaseAdmin';

function isValidEmail(email: string): boolean {
  const v = (email || '').trim();
  if (!v) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireTrainer();
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  const { id: studentId } = await params;

  const body = await req.json().catch(() => ({}));
  const emailRaw = (body?.email ?? '').toString().trim();

  if (!emailRaw) {
    return NextResponse.json({ error: 'Informe um e-mail.' }, { status: 400 });
  }

  const email = emailRaw.toLowerCase();
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: 'E-mail inválido.' }, { status: 400 });
  }

  const trainerEmail = (auth.user?.email ?? '').toString().trim().toLowerCase();
  if (trainerEmail && email === trainerEmail) {
    return NextResponse.json({ error: 'O e-mail do aluno não pode ser o mesmo e-mail do treinador.' }, { status: 400 });
  }

  // Usa service role (com validação de trainer_id) para evitar dependência de RLS para este update.
  const admin = createAdminSupabase();
  const { error } = await admin.from('students').update({ email }).eq('id', studentId).eq('trainer_id', auth.user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, email });
}
