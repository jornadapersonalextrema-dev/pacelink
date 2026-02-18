import { NextResponse, type NextRequest } from 'next/server';
import { createAdminSupabase } from '@/lib/supabaseAdmin';

function formatBRShort(iso: string | null | undefined) {
  if (!iso) return null;
  const [y, m, d] = String(iso).slice(0, 10).split('-');
  if (!m || !d) return String(iso).slice(0, 10);
  return `${d}/${m}`;
}

function pickExecutionLabel(ex: any) {
  if (!ex) return null;
  if (ex.status === 'completed') {
    const dt = ex.performed_at || ex.completed_at || null;
    const br = formatBRShort(dt);
    return br ? `Concluído (${br})` : 'Concluído';
  }
  if (ex.status === 'paused') return 'Pausado';
  if (ex.status === 'running') return 'Em andamento';
  return null;
}

async function selectLatestWeek(admin: any, studentId: string) {
  // tenta training_weeks, senão weeks
  let wk = await admin
    .from('training_weeks')
    .select('id,week_start,week_end,label')
    .eq('student_id', studentId)
    .order('week_start', { ascending: false })
    .limit(1)
    .maybeSingle();

  const msg = String(wk.error?.message || '').toLowerCase();
  if (wk.error && msg.includes('relation') && msg.includes('training_weeks')) {
    wk = await admin
      .from('weeks')
      .select('id,week_start,week_end,label')
      .eq('student_id', studentId)
      .order('week_start', { ascending: false })
      .limit(1)
      .maybeSingle();
  }

  return wk;
}

async function selectWeekById(admin: any, studentId: string, weekId: string) {
  let wk = await admin
    .from('training_weeks')
    .select('id,week_start,week_end,label')
    .eq('id', weekId)
    .eq('student_id', studentId)
    .maybeSingle();

  const msg = String(wk.error?.message || '').toLowerCase();
  if (wk.error && msg.includes('relation') && msg.includes('training_weeks')) {
    wk = await admin
      .from('weeks')
      .select('id,week_start,week_end,label')
      .eq('id', weekId)
      .eq('student_id', studentId)
      .maybeSingle();
  }

  return wk;
}

export async function GET(req: NextRequest) {
  const admin = createAdminSupabase();
  const url = new URL(req.url);

  const slug = (url.searchParams.get('slug') || '').trim();
  const t = (url.searchParams.get('t') || '').trim();
  const weekIdParam = (url.searchParams.get('weekId') || '').trim();
  const studentIdParam = (url.searchParams.get('studentId') || '').trim();

  let student: any = null;

  // (A) modo portal compartilhável (slug + t)
  if (slug && t) {
    const { data, error } = await admin
      .from('students')
      .select('id,name,email,public_slug,portal_token,portal_enabled,auth_user_id')
      .eq('public_slug', slug)
      .eq('portal_token', t)
      .eq('portal_enabled', true)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: error?.message || 'Link inválido.' }, { status: 400 });
    }
    student = data;
  } else {
    // (B) modo aluno logado via Authorization Bearer
    const authHeader = req.headers.get('authorization') || '';
    const jwt = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : '';

    if (!jwt) {
      return NextResponse.json({ error: 'Parâmetros ausentes (slug, t) e sem Authorization Bearer.' }, { status: 400 });
    }

    const { data: u, error: uErr } = await admin.auth.getUser(jwt);
    if (uErr || !u?.user) {
      return NextResponse.json({ error: 'Sessão inválida. Faça login novamente.' }, { status: 401 });
    }

    const uid = u.user.id;
    const email = (u.user.email || '').toLowerCase().trim();

    if (studentIdParam) {
      const { data, error } = await admin
        .from('students')
        .select('id,name,email,public_slug,portal_token,portal_enabled,auth_user_id')
        .eq('id', studentIdParam)
        .single();

      if (error || !data) return NextResponse.json({ error: error?.message || 'Aluno não encontrado.' }, { status: 404 });

      if (data.auth_user_id && data.auth_user_id !== uid) {
        return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
      }
      if (!data.auth_user_id && email && String(data.email || '').toLowerCase().trim() !== email) {
        return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
      }

      student = data;
    } else {
      // tenta por auth_user_id; fallback por email (legado)
      let q = await admin
        .from('students')
        .select('id,name,email,public_slug,portal_token,portal_enabled,auth_user_id')
        .eq('auth_user_id', uid)
        .maybeSingle();

      if (!q.data && email) {
        q = await admin
          .from('students')
          .select('id,name,email,public_slug,portal_token,portal_enabled,auth_user_id')
          .eq('email', email)
          .maybeSingle();
      }

      if (q.error || !q.data) {
        return NextResponse.json({ error: q.error?.message || 'Aluno não vinculado a este login.' }, { status: 404 });
      }

      student = q.data;
    }
  }

  // Semana
  const weekRes = weekIdParam
    ? await selectWeekById(admin, student.id, weekIdParam)
    : await selectLatestWeek(admin, student.id);

  if (weekRes.error) {
    return NextResponse.json({ error: weekRes.error.message }, { status: 400 });
  }

  const week = weekRes.data || null;

  // Treinos
  let workouts: any[] = [];
  if (week?.id) {
    const { data: ws, error: woErr } = await admin
      .from('workouts')
      .select('id,title,template_type,status,total_km,planned_date,week_id')
      .eq('week_id', week.id)
      .in('status', ['ready', 'canceled'])
      .order('planned_date', { ascending: true, nullsFirst: false });

    if (woErr) return NextResponse.json({ error: woErr.message }, { status: 400 });
    workouts = ws || [];

    if (workouts.length) {
      const ids = workouts.map((w) => w.id);

      const { data: exs, error: exErr } = await admin
        .from('executions')
        .select('id,workout_id,status,performed_at,completed_at,last_event_at')
        .in('workout_id', ids)
        .order('last_event_at', { ascending: false });

      if (exErr) return NextResponse.json({ error: exErr.message }, { status: 400 });

      const byWorkout: Record<string, any> = {};
      for (const ex of exs || []) {
        if (!byWorkout[ex.workout_id]) byWorkout[ex.workout_id] = ex;
      }

      workouts = workouts.map((w) => ({
        ...w,
        execution_label: pickExecutionLabel(byWorkout[w.id] || null),
      }));
    }
  }

  return NextResponse.json({
    ok: true,
    student: {
      id: student.id,
      name: student.name,
      email: student.email,
      public_slug: student.public_slug || null,
      portal_token: student.portal_token || null,
    },
    week,
    workouts,
  });
}
