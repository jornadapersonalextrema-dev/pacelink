(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/lib/supabaseBrowser.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "createClient",
    ()=>createClient
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = /*#__PURE__*/ __turbopack_context__.i("[project]/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$supabase$2f$ssr$2f$dist$2f$module$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/@supabase/ssr/dist/module/index.js [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$supabase$2f$ssr$2f$dist$2f$module$2f$createBrowserClient$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@supabase/ssr/dist/module/createBrowserClient.js [app-client] (ecmascript)");
;
function createClient() {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$supabase$2f$ssr$2f$dist$2f$module$2f$createBrowserClient$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createBrowserClient"])(("TURBOPACK compile-time value", "https://gjcvdjcxyxxhhkxuobrj.supabase.co"), ("TURBOPACK compile-time value", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqY3ZkamN4eXh4aGhreHVvYnJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyNzI4OTEsImV4cCI6MjA4NDg0ODg5MX0.kYHjkbfUHvnaf9Bwbn-nYY7Na3qEu3dHuuapyO_0iNo"));
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/app/students/[id]/page.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>StudentProfilePage
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/navigation.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseBrowser$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/supabaseBrowser.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
'use client';
;
;
;
const TEMPLATE_LABEL = {
    easy_run: 'Rodagem',
    progressive: 'Progressivo',
    alternated: 'Alternado'
};
function formatPace(secPerKm) {
    if (!secPerKm || secPerKm <= 0) return '—';
    const m = Math.floor(secPerKm / 60);
    const s = secPerKm % 60;
    return `${m}:${String(s).padStart(2, '0')}/km`;
}
function formatDateBRLoose(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit'
    });
}
function formatRangeBR(weekStartISO, weekEndISO) {
    return `${formatDateBRLoose(weekStartISO)} – ${formatDateBRLoose(weekEndISO)}`;
}
function statusLabel(status, closedReason) {
    if (status === 'draft') return 'Rascunho';
    if (status === 'ready') return 'Disponível';
    if (status === 'archived') {
        if (closedReason === 'week_expired') return 'Encerrado (sem execução)';
        return 'Encerrado';
    }
    return status;
}
function kmLabel(km) {
    if (km == null) return '—';
    return Number(km).toFixed(1).replace('.', ',');
}
function pad2(n) {
    return String(n).padStart(2, '0');
}
function toISODate(d) {
    // YYYY-MM-DD in local time (avoid timezone shifting from toISOString)
    const y = d.getFullYear();
    const m = pad2(d.getMonth() + 1);
    const day = pad2(d.getDate());
    return `${y}-${m}-${day}`;
}
function startOfWeekMonday(date) {
    const d = new Date(date);
    const day = d.getDay(); // 0 Sun ... 6 Sat
    const diff = day === 0 ? -6 : 1 - day; // Monday start
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
}
function addDays(date, days) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
}
function StudentProfilePage() {
    _s();
    const params = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useParams"])();
    const router = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRouter"])();
    const supabase = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "StudentProfilePage.useMemo[supabase]": ()=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseBrowser$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createClient"])()
    }["StudentProfilePage.useMemo[supabase]"], []);
    const studentId = String(params?.id || '');
    const [student, setStudent] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [studentSlug, setStudentSlug] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])('aluno');
    const [weeks, setWeeks] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const [selectedWeekId, setSelectedWeekId] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [workouts, setWorkouts] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const [latestExecByWorkout, setLatestExecByWorkout] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])({});
    const [loading, setLoading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(true);
    const [banner, setBanner] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    async function loadStudent() {
        setLoading(true);
        setBanner(null);
        const { data: s, error } = await supabase.from('students').select('id, trainer_id, name, email, p1k_sec_per_km, public_slug, created_at').eq('id', studentId).maybeSingle();
        if (error) {
            setBanner(error.message);
            setLoading(false);
            return;
        }
        if (!s) {
            setBanner('Aluno não encontrado.');
            setLoading(false);
            return;
        }
        setStudent(s);
        setStudentSlug(s.public_slug || 'aluno');
        setLoading(false);
    }
    async function ensureUpcomingWeeks(s) {
        // cria/garante semanas: semana atual + próximas 7 (ajuste se quiser mais)
        const base = startOfWeekMonday(new Date());
        const targets = Array.from({
            length: 8
        }).map((_, i)=>{
            const ws = addDays(base, i * 7);
            const we = addDays(ws, 6);
            return {
                student_id: s.id,
                trainer_id: s.trainer_id,
                week_start: toISODate(ws),
                week_end: toISODate(we),
                label: `Semana ${formatRangeBR(toISODate(ws), toISODate(we))}`
            };
        });
        // upsert exige unique(student_id, week_start)
        const up = await supabase.from('weeks').upsert(targets, {
            onConflict: 'student_id,week_start'
        });
        if (up.error) {
            // se a tabela ainda não existir, o app segue sem quebrar (mas a visão semanal não funciona)
            setBanner(up.error.message);
            return;
        }
        const { data: wk, error } = await supabase.from('weeks').select('id, student_id, trainer_id, week_start, week_end, label').eq('student_id', s.id).order('week_start', {
            ascending: true
        });
        if (error) {
            setBanner(error.message);
            return;
        }
        const list = wk || [];
        setWeeks(list);
        const currentStartISO = toISODate(startOfWeekMonday(new Date()));
        const current = list.find((w)=>w.week_start === currentStartISO) || list[0] || null;
        setSelectedWeekId(current?.id || null);
    }
    async function loadWorkoutsForWeek(weekId) {
        if (!weekId) {
            setWorkouts([]);
            setLatestExecByWorkout({});
            return;
        }
        // Treinos da semana selecionada
        const { data: ws, error } = await supabase.from('workouts').select('id, student_id, trainer_id, status, template_type, title, total_km, created_at, planned_date, planned_day, share_slug, week_id, locked_at, closed_reason').eq('student_id', studentId).eq('week_id', weekId).order('planned_day', {
            ascending: true,
            nullsFirst: false
        }).order('created_at', {
            ascending: false
        }).limit(200);
        if (error) {
            setBanner(error.message);
            return;
        }
        const list = ws || [];
        setWorkouts(list);
        if (list.length === 0) {
            setLatestExecByWorkout({});
            return;
        }
        const workoutIds = list.map((w)=>w.id);
        const { data: execs, error: execErr } = await supabase.from('executions').select('id, workout_id, status, performed_at, completed_at, rpe, comment, last_event_at, started_at').in('workout_id', workoutIds);
        if (execErr) {
            // não bloqueia a tela, só perde o "progresso"
            setLatestExecByWorkout({});
            return;
        }
        const byWorkout = {};
        for (const wid of workoutIds)byWorkout[wid] = null;
        // pega a mais recente por last_event_at/started_at/completed_at
        for (const e of execs || []){
            const cur = byWorkout[e.workout_id];
            const curKey = cur?.last_event_at || cur?.completed_at || cur?.started_at || '';
            const nextKey = e.last_event_at || e.completed_at || e.started_at || '';
            if (!cur || nextKey && nextKey > curKey) {
                byWorkout[e.workout_id] = e;
            }
        }
        setLatestExecByWorkout(byWorkout);
    }
    async function copyWorkoutLink(workoutId) {
        setBanner(null);
        // Trigger gera share_slug ao mudar status para ready (no banco)
        const { data, error } = await supabase.from('workouts').update({
            status: 'ready'
        }).eq('id', workoutId).select('id, share_slug').maybeSingle();
        if (error) {
            setBanner(error.message);
            return;
        }
        const slug = data?.share_slug;
        if (!slug) {
            setBanner('Não foi possível gerar o link (share_slug).');
            return;
        }
        const url = `${window.location.origin}/w/${studentSlug}/${slug}`;
        await navigator.clipboard.writeText(url);
        setBanner('Link do treino copiado para a área de transferência.');
        // atualiza local
        setWorkouts((prev)=>prev.map((w)=>w.id === workoutId ? {
                    ...w,
                    status: 'ready',
                    share_slug: slug
                } : w));
    }
    function openWorkoutAsAluno(workout) {
        const slug = workout.share_slug;
        if (!slug) {
            setBanner('Treino sem link (share_slug). Use "Gerar/Copiar link".');
            return;
        }
        router.push(`/w/${studentSlug}/${slug}`);
    }
    // Load student
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "StudentProfilePage.useEffect": ()=>{
            if (!studentId) return;
            loadStudent();
        // eslint-disable-next-line react-hooks/exhaustive-deps
        }
    }["StudentProfilePage.useEffect"], [
        studentId
    ]);
    // Ensure weeks after student loaded
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "StudentProfilePage.useEffect": ()=>{
            if (!student) return;
            ensureUpcomingWeeks(student);
        // eslint-disable-next-line react-hooks/exhaustive-deps
        }
    }["StudentProfilePage.useEffect"], [
        student?.id
    ]);
    // Load workouts when week changes
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "StudentProfilePage.useEffect": ()=>{
            loadWorkoutsForWeek(selectedWeekId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
        }
    }["StudentProfilePage.useEffect"], [
        selectedWeekId
    ]);
    const selectedWeek = weeks.find((w)=>w.id === selectedWeekId) || null;
    const header = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "flex items-start justify-between gap-3",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "min-w-0",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "text-sm text-slate-600 dark:text-slate-300",
                        children: "Aluno"
                    }, void 0, false, {
                        fileName: "[project]/app/students/[id]/page.tsx",
                        lineNumber: 331,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "text-xl font-semibold truncate",
                        children: student?.name ?? '—'
                    }, void 0, false, {
                        fileName: "[project]/app/students/[id]/page.tsx",
                        lineNumber: 332,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "text-sm text-slate-600 dark:text-slate-300 mt-1",
                        children: [
                            "Ritmo P1k: ",
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "font-semibold",
                                children: formatPace(student?.p1k_sec_per_km ?? null)
                            }, void 0, false, {
                                fileName: "[project]/app/students/[id]/page.tsx",
                                lineNumber: 334,
                                columnNumber: 22
                            }, this),
                            student?.email ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                                children: [
                                    " · ",
                                    student.email
                                ]
                            }, void 0, true) : null
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/students/[id]/page.tsx",
                        lineNumber: 333,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "text-xs text-slate-500 dark:text-slate-400 mt-1",
                        children: [
                            "Links do aluno: ",
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "font-mono",
                                children: "/aluno"
                            }, void 0, false, {
                                fileName: "[project]/app/students/[id]/page.tsx",
                                lineNumber: 338,
                                columnNumber: 27
                            }, this),
                            " (login) ·",
                            ' ',
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "font-mono",
                                children: [
                                    "/w/",
                                    studentSlug,
                                    "/<treino>"
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/students/[id]/page.tsx",
                                lineNumber: 339,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/students/[id]/page.tsx",
                        lineNumber: 337,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/students/[id]/page.tsx",
                lineNumber: 330,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "shrink-0 flex flex-col items-end gap-2",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        className: "px-3 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold disabled:opacity-50",
                        disabled: !selectedWeekId,
                        onClick: ()=>router.push(`/students/${studentId}/workouts/new?weekId=${selectedWeekId}`),
                        children: "+ Programar treino"
                    }, void 0, false, {
                        fileName: "[project]/app/students/[id]/page.tsx",
                        lineNumber: 344,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        className: "text-sm underline text-slate-600 dark:text-slate-300",
                        onClick: ()=>router.push('/students'),
                        children: "Voltar"
                    }, void 0, false, {
                        fileName: "[project]/app/students/[id]/page.tsx",
                        lineNumber: 351,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/students/[id]/page.tsx",
                lineNumber: 343,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/app/students/[id]/page.tsx",
        lineNumber: 329,
        columnNumber: 5
    }, this);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("main", {
        className: "min-h-screen bg-slate-50 dark:bg-slate-950 p-4",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "mx-auto max-w-3xl space-y-4",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "rounded-2xl bg-white dark:bg-surface-dark shadow p-4",
                    children: header
                }, void 0, false, {
                    fileName: "[project]/app/students/[id]/page.tsx",
                    lineNumber: 361,
                    columnNumber: 9
                }, this),
                banner && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "rounded-xl bg-amber-50 dark:bg-amber-900/20 p-3 text-sm text-amber-800 dark:text-amber-200",
                    children: banner
                }, void 0, false, {
                    fileName: "[project]/app/students/[id]/page.tsx",
                    lineNumber: 364,
                    columnNumber: 11
                }, this),
                loading ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "text-sm text-slate-600 dark:text-slate-300",
                    children: "Carregando…"
                }, void 0, false, {
                    fileName: "[project]/app/students/[id]/page.tsx",
                    lineNumber: 370,
                    columnNumber: 11
                }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "rounded-2xl bg-white dark:bg-surface-dark shadow p-4",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "flex items-center justify-between gap-3",
                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "font-semibold",
                                                children: "Planejamento por semana"
                                            }, void 0, false, {
                                                fileName: "[project]/app/students/[id]/page.tsx",
                                                lineNumber: 377,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "text-xs text-slate-500 dark:text-slate-400",
                                                children: selectedWeek ? selectedWeek.label || formatRangeBR(selectedWeek.week_start, selectedWeek.week_end) : '—'
                                            }, void 0, false, {
                                                fileName: "[project]/app/students/[id]/page.tsx",
                                                lineNumber: 378,
                                                columnNumber: 19
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/students/[id]/page.tsx",
                                        lineNumber: 376,
                                        columnNumber: 17
                                    }, this)
                                }, void 0, false, {
                                    fileName: "[project]/app/students/[id]/page.tsx",
                                    lineNumber: 375,
                                    columnNumber: 15
                                }, this),
                                weeks.length === 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "mt-3 text-sm text-slate-600 dark:text-slate-300",
                                    children: [
                                        "Semanas ainda não carregadas. Verifique se a tabela ",
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "font-mono",
                                            children: "weeks"
                                        }, void 0, false, {
                                            fileName: "[project]/app/students/[id]/page.tsx",
                                            lineNumber: 386,
                                            columnNumber: 71
                                        }, this),
                                        " existe no Supabase."
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/students/[id]/page.tsx",
                                    lineNumber: 385,
                                    columnNumber: 17
                                }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "mt-3 flex gap-2 overflow-x-auto no-scrollbar",
                                    children: weeks.map((w)=>{
                                        const active = w.id === selectedWeekId;
                                        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                            onClick: ()=>setSelectedWeekId(w.id),
                                            className: 'px-3 py-2 rounded-full text-sm font-semibold whitespace-nowrap border ' + (active ? 'bg-primary text-slate-900 border-transparent' : 'bg-white dark:bg-surface-dark border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'),
                                            children: formatRangeBR(w.week_start, w.week_end)
                                        }, w.id, false, {
                                            fileName: "[project]/app/students/[id]/page.tsx",
                                            lineNumber: 393,
                                            columnNumber: 23
                                        }, this);
                                    })
                                }, void 0, false, {
                                    fileName: "[project]/app/students/[id]/page.tsx",
                                    lineNumber: 389,
                                    columnNumber: 17
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/students/[id]/page.tsx",
                            lineNumber: 374,
                            columnNumber: 13
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "rounded-2xl bg-white dark:bg-surface-dark shadow p-4",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "flex items-center justify-between mb-3",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                            className: "font-semibold",
                                            children: "Treinos da semana"
                                        }, void 0, false, {
                                            fileName: "[project]/app/students/[id]/page.tsx",
                                            lineNumber: 414,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "text-xs text-slate-500 dark:text-slate-400",
                                            children: "Mostrando até 200"
                                        }, void 0, false, {
                                            fileName: "[project]/app/students/[id]/page.tsx",
                                            lineNumber: 415,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/students/[id]/page.tsx",
                                    lineNumber: 413,
                                    columnNumber: 15
                                }, this),
                                workouts.length === 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "text-sm text-slate-600 dark:text-slate-300",
                                    children: "Nenhum treino programado para esta semana ainda."
                                }, void 0, false, {
                                    fileName: "[project]/app/students/[id]/page.tsx",
                                    lineNumber: 419,
                                    columnNumber: 17
                                }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "space-y-3",
                                    children: workouts.map((w)=>{
                                        const latestExec = latestExecByWorkout[w.id];
                                        const progress = latestExec?.status === 'completed' ? `Concluído${latestExec.performed_at ? ` (${formatDateBRLoose(latestExec.performed_at)})` : ''}` : latestExec?.status === 'in_progress' ? 'Em andamento' : '—';
                                        const locked = !!w.locked_at || !!latestExec;
                                        const plannedLabel = w.planned_day ? `Ordem ${w.planned_day}` : w.planned_date ? formatDateBRLoose(w.planned_date) : formatDateBRLoose(w.created_at);
                                        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "rounded-xl border border-slate-200 dark:border-slate-700 p-3 flex flex-col gap-2",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "flex items-start justify-between gap-3",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            className: "min-w-0",
                                                            children: [
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                    className: "text-sm text-slate-600 dark:text-slate-300",
                                                                    children: [
                                                                        plannedLabel,
                                                                        " · ",
                                                                        statusLabel(w.status, w.closed_reason),
                                                                        " · ",
                                                                        TEMPLATE_LABEL[w.template_type] ?? w.template_type,
                                                                        " ·",
                                                                        ' ',
                                                                        kmLabel(w.total_km),
                                                                        " km"
                                                                    ]
                                                                }, void 0, true, {
                                                                    fileName: "[project]/app/students/[id]/page.tsx",
                                                                    lineNumber: 440,
                                                                    columnNumber: 29
                                                                }, this),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                    className: "font-medium truncate",
                                                                    children: w.title || TEMPLATE_LABEL[w.template_type] || 'Treino'
                                                                }, void 0, false, {
                                                                    fileName: "[project]/app/students/[id]/page.tsx",
                                                                    lineNumber: 444,
                                                                    columnNumber: 29
                                                                }, this),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                    className: "mt-1 text-xs text-slate-500 dark:text-slate-400",
                                                                    children: [
                                                                        "Execução do aluno: ",
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                            className: "font-semibold",
                                                                            children: progress
                                                                        }, void 0, false, {
                                                                            fileName: "[project]/app/students/[id]/page.tsx",
                                                                            lineNumber: 447,
                                                                            columnNumber: 50
                                                                        }, this),
                                                                        locked ? ' · Edição bloqueada após início' : ''
                                                                    ]
                                                                }, void 0, true, {
                                                                    fileName: "[project]/app/students/[id]/page.tsx",
                                                                    lineNumber: 446,
                                                                    columnNumber: 29
                                                                }, this)
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/app/students/[id]/page.tsx",
                                                            lineNumber: 439,
                                                            columnNumber: 27
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            className: "shrink-0 flex flex-wrap gap-2 justify-end",
                                                            children: [
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                                    className: "px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-sm font-semibold disabled:opacity-50",
                                                                    disabled: locked,
                                                                    onClick: ()=>router.push(`/workouts/${w.id}/edit`),
                                                                    children: "Editar"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/app/students/[id]/page.tsx",
                                                                    lineNumber: 453,
                                                                    columnNumber: 29
                                                                }, this),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                                    className: "px-3 py-2 rounded-lg bg-primary text-slate-900 text-sm font-semibold disabled:opacity-50",
                                                                    disabled: w.status === 'archived',
                                                                    onClick: ()=>copyWorkoutLink(w.id),
                                                                    children: "Gerar/Copiar link"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/app/students/[id]/page.tsx",
                                                                    lineNumber: 461,
                                                                    columnNumber: 29
                                                                }, this),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                                    className: "px-3 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold disabled:opacity-50",
                                                                    disabled: !w.share_slug,
                                                                    onClick: ()=>openWorkoutAsAluno(w),
                                                                    children: "Ver como aluno"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/app/students/[id]/page.tsx",
                                                                    lineNumber: 469,
                                                                    columnNumber: 29
                                                                }, this)
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/app/students/[id]/page.tsx",
                                                            lineNumber: 452,
                                                            columnNumber: 27
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/app/students/[id]/page.tsx",
                                                    lineNumber: 438,
                                                    columnNumber: 25
                                                }, this),
                                                w.share_slug ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "text-xs text-slate-500 dark:text-slate-400",
                                                    children: [
                                                        "Link: ",
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                            className: "font-mono",
                                                            children: [
                                                                "/w/",
                                                                studentSlug,
                                                                "/",
                                                                w.share_slug
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/app/students/[id]/page.tsx",
                                                            lineNumber: 481,
                                                            columnNumber: 35
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/app/students/[id]/page.tsx",
                                                    lineNumber: 480,
                                                    columnNumber: 27
                                                }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "text-xs text-slate-500 dark:text-slate-400",
                                                    children: "Link ainda não gerado (share_slug vazio)."
                                                }, void 0, false, {
                                                    fileName: "[project]/app/students/[id]/page.tsx",
                                                    lineNumber: 484,
                                                    columnNumber: 27
                                                }, this)
                                            ]
                                        }, w.id, true, {
                                            fileName: "[project]/app/students/[id]/page.tsx",
                                            lineNumber: 437,
                                            columnNumber: 23
                                        }, this);
                                    })
                                }, void 0, false, {
                                    fileName: "[project]/app/students/[id]/page.tsx",
                                    lineNumber: 423,
                                    columnNumber: 17
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/students/[id]/page.tsx",
                            lineNumber: 412,
                            columnNumber: 13
                        }, this)
                    ]
                }, void 0, true)
            ]
        }, void 0, true, {
            fileName: "[project]/app/students/[id]/page.tsx",
            lineNumber: 360,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/app/students/[id]/page.tsx",
        lineNumber: 359,
        columnNumber: 5
    }, this);
}
_s(StudentProfilePage, "Jx8lzAGLUVd+TXNN4/70CqXIBLg=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useParams"],
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRouter"]
    ];
});
_c = StudentProfilePage;
var _c;
__turbopack_context__.k.register(_c, "StudentProfilePage");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
]);

//# sourceMappingURL=_7f14904d._.js.map