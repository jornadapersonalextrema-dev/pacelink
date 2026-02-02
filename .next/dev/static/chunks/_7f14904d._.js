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
    ()=>StudentTrainerPage
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
function startOfWeekMonday(date) {
    const d = new Date(date);
    const day = d.getDay(); // 0..6 (Sun..Sat)
    const diff = (day === 0 ? -6 : 1) - day; // move to Monday
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
}
function toISODate(d) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}
function addDays(d, days) {
    const x = new Date(d);
    x.setDate(x.getDate() + days);
    return x;
}
function formatWeekLabel(weekStartISO) {
    // "Semana dd/mm - dd/mm"
    const [y, m, d] = weekStartISO.split('-');
    const start = new Date(Number(y), Number(m) - 1, Number(d));
    const end = addDays(start, 6);
    const dd1 = String(start.getDate()).padStart(2, '0');
    const mm1 = String(start.getMonth() + 1).padStart(2, '0');
    const dd2 = String(end.getDate()).padStart(2, '0');
    const mm2 = String(end.getMonth() + 1).padStart(2, '0');
    return `Semana ${dd1}/${mm1} – ${dd2}/${mm2}`;
}
function formatPace(secPerKm) {
    if (!secPerKm || !Number.isFinite(secPerKm)) return '—';
    const mm = Math.floor(secPerKm / 60);
    const ss = Math.round(secPerKm % 60);
    return `${mm}:${String(ss).padStart(2, '0')}/km`;
}
function formatKm(n) {
    if (n == null || !Number.isFinite(n)) return '—';
    return `${String(n).replace('.', ',')} km`;
}
function formatDateBR(dateStr) {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const [y, m, d] = parts;
    return `${d}/${m}/${y}`;
}
function StudentTrainerPage() {
    _s();
    const router = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRouter"])();
    const params = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useParams"])();
    const studentId = params.id;
    const supabase = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "StudentTrainerPage.useMemo[supabase]": ()=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseBrowser$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createClient"])()
    }["StudentTrainerPage.useMemo[supabase]"], []);
    const [banner, setBanner] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [student, setStudent] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [weeks, setWeeks] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const [selectedWeekId, setSelectedWeekId] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [workouts, setWorkouts] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const [latestExecByWorkout, setLatestExecByWorkout] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])({});
    const studentSlug = student?.public_slug ?? 'aluno';
    async function loadStudent() {
        setBanner(null);
        const { data, error } = await supabase.from('students').select('id,trainer_id,name,email,p1k_sec_per_km,public_slug,created_at').eq('id', studentId).maybeSingle();
        if (error) {
            setBanner(error.message);
            return;
        }
        if (!data) {
            setBanner('Aluno não encontrado.');
            return;
        }
        setStudent(data);
    }
    async function ensureUpcomingWeeks(s) {
        // garante que as próximas semanas existam na tabela training_weeks
        setBanner(null);
        const start = startOfWeekMonday(new Date());
        const starts = Array.from({
            length: 6
        }).map((_, i)=>toISODate(addDays(start, i * 7)));
        // upsert: (student_id, week_start) unique
        const payload = starts.map((ws)=>({
                student_id: s.id,
                trainer_id: s.trainer_id,
                week_start: ws,
                week_end: toISODate(addDays(new Date(ws), 6)),
                label: formatWeekLabel(ws)
            }));
        // Table real: training_weeks
        const { error: upErr } = await supabase.from('training_weeks').upsert(payload, {
            onConflict: 'student_id,week_start'
        });
        if (upErr) {
            setBanner(upErr.message);
            return;
        }
        // reload list
        const { data, error } = await supabase.from('training_weeks').select('id,student_id,trainer_id,week_start,week_end,label').eq('student_id', s.id).order('week_start', {
            ascending: true
        });
        if (error) {
            setBanner(error.message);
            return;
        }
        const list = data || [];
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
        setBanner(null);
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
        // pega última execução por workout (view v_workouts_last_execution existe no seu schema)
        const ids = list.map((w)=>w.id);
        const { data: ex } = await supabase.from('v_workouts_last_execution').select('workout_id, execution_id, status, started_at, last_event_at, completed_at, performed_at, total_elapsed_ms, rpe, comment, actual_total_km').in('workout_id', ids);
        const map = {};
        (ex || []).forEach((row)=>{
            map[row.workout_id] = {
                id: row.execution_id,
                workout_id: row.workout_id,
                status: row.status,
                started_at: row.started_at,
                last_event_at: row.last_event_at,
                completed_at: row.completed_at,
                performed_at: row.performed_at,
                total_elapsed_ms: row.total_elapsed_ms,
                rpe: row.rpe,
                comment: row.comment,
                actual_total_km: row.actual_total_km
            };
        });
        setLatestExecByWorkout(map);
    }
    function makeRandomSlug(len = 12) {
        const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
        let out = '';
        const arr = new Uint32Array(len);
        // crypto.getRandomValues existe no browser moderno (incl. mobile)
        crypto.getRandomValues(arr);
        for(let i = 0; i < len; i++)out += chars[arr[i] % chars.length];
        return out;
    }
    async function ensureShareSlug(workoutId) {
        // 1) tenta ler share_slug atual
        const { data: cur, error: curErr } = await supabase.from('workouts').select('id, share_slug, status').eq('id', workoutId).maybeSingle();
        if (curErr) throw curErr;
        const currentSlug = cur?.share_slug;
        if (currentSlug) return currentSlug;
        // 2) gera slug e tenta gravar (lida com colisão UNIQUE)
        for(let i = 0; i < 8; i++){
            const slug = makeRandomSlug(12);
            const { data: upd, error: updErr } = await supabase.from('workouts').update({
                status: 'ready',
                share_slug: slug
            }).eq('id', workoutId).is('share_slug', null).select('id, share_slug').maybeSingle();
            if (!updErr) {
                const got = upd?.share_slug;
                if (got) return got;
            } else {
                // 23505 = unique_violation (slug já existe)
                if (updErr.code !== '23505') throw updErr;
            }
        }
        throw new Error('Não foi possível gerar o link (share_slug).');
    }
    async function shareWorkoutLink(workoutId) {
        setBanner(null);
        try {
            const slug = await ensureShareSlug(workoutId);
            const url = `${window.location.origin}/w/${studentSlug}/${slug}`;
            // Preferência: abrir menu nativo de compartilhamento (Android/iOS)
            if (navigator.share) {
                await navigator.share({
                    title: 'Treino do aluno',
                    text: `Treino programado para ${student?.name ?? 'aluno'}`,
                    url
                });
                setBanner('Abrindo opções de compartilhamento...');
            } else if (navigator.clipboard) {
                await navigator.clipboard.writeText(url);
                setBanner('Link copiado para a área de transferência.');
            } else {
                // fallback final (WhatsApp)
                window.open(`https://wa.me/?text=${encodeURIComponent(url)}`, '_blank');
                setBanner('Abrindo WhatsApp para compartilhar...');
            }
            // atualiza local
            setWorkouts((prev)=>prev.map((w)=>w.id === workoutId ? {
                        ...w,
                        status: 'ready',
                        share_slug: slug
                    } : w));
        } catch (e) {
            setBanner(e?.message || 'Não foi possível gerar/compartilhar o link.');
        }
    }
    function openWorkoutAsAluno(workout) {
        const slug = workout.share_slug;
        if (!slug) {
            setBanner('Treino sem link (share_slug). Use "Gerar/Compartilhar".');
            return;
        }
        const url = `/w/${studentSlug}/${slug}`;
        // abre em nova aba/janela para o treinador não perder a tela
        if ("TURBOPACK compile-time truthy", 1) {
            window.open(url, '_blank');
        } else //TURBOPACK unreachable
        ;
    }
    // Load student
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "StudentTrainerPage.useEffect": ()=>{
            if (!studentId) return;
            loadStudent();
        // eslint-disable-next-line react-hooks/exhaustive-deps
        }
    }["StudentTrainerPage.useEffect"], [
        studentId
    ]);
    // Ensure weeks after student loaded
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "StudentTrainerPage.useEffect": ()=>{
            if (!student) return;
            ensureUpcomingWeeks(student);
        // eslint-disable-next-line react-hooks/exhaustive-deps
        }
    }["StudentTrainerPage.useEffect"], [
        student?.id
    ]);
    // Load workouts when week changes
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "StudentTrainerPage.useEffect": ()=>{
            loadWorkoutsForWeek(selectedWeekId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
        }
    }["StudentTrainerPage.useEffect"], [
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
                        lineNumber: 369,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "text-xl font-semibold truncate",
                        children: student?.name ?? '—'
                    }, void 0, false, {
                        fileName: "[project]/app/students/[id]/page.tsx",
                        lineNumber: 370,
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
                                lineNumber: 372,
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
                        lineNumber: 371,
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
                                lineNumber: 376,
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
                                lineNumber: 377,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/students/[id]/page.tsx",
                        lineNumber: 375,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/students/[id]/page.tsx",
                lineNumber: 368,
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
                        lineNumber: 382,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        className: "text-sm underline text-slate-600 dark:text-slate-300",
                        onClick: ()=>router.push('/students'),
                        children: "Voltar"
                    }, void 0, false, {
                        fileName: "[project]/app/students/[id]/page.tsx",
                        lineNumber: 389,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/students/[id]/page.tsx",
                lineNumber: 381,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/app/students/[id]/page.tsx",
        lineNumber: 367,
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
                    lineNumber: 399,
                    columnNumber: 9
                }, this),
                banner && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "rounded-xl bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-700 dark:text-red-300",
                    children: banner
                }, void 0, false, {
                    fileName: "[project]/app/students/[id]/page.tsx",
                    lineNumber: 402,
                    columnNumber: 11
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "rounded-2xl bg-white dark:bg-surface-dark shadow p-4",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "flex items-center justify-between mb-3",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                    className: "font-semibold",
                                    children: "Planejamento por semana"
                                }, void 0, false, {
                                    fileName: "[project]/app/students/[id]/page.tsx",
                                    lineNumber: 408,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "text-xs text-slate-500 dark:text-slate-400",
                                    children: selectedWeek ? selectedWeek.label : '—'
                                }, void 0, false, {
                                    fileName: "[project]/app/students/[id]/page.tsx",
                                    lineNumber: 409,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/students/[id]/page.tsx",
                            lineNumber: 407,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "flex flex-wrap gap-2",
                            children: weeks.map((w)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                    className: `px-3 py-2 rounded-full text-sm font-semibold border ${selectedWeekId === w.id ? 'bg-primary text-slate-900 border-primary' : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100'}`,
                                    onClick: ()=>setSelectedWeekId(w.id),
                                    children: w.label ?? formatWeekLabel(w.week_start)
                                }, w.id, false, {
                                    fileName: "[project]/app/students/[id]/page.tsx",
                                    lineNumber: 416,
                                    columnNumber: 15
                                }, this))
                        }, void 0, false, {
                            fileName: "[project]/app/students/[id]/page.tsx",
                            lineNumber: 414,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/app/students/[id]/page.tsx",
                    lineNumber: 406,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "rounded-2xl bg-white dark:bg-surface-dark shadow p-4",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "flex items-start justify-between gap-3 mb-3",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                            className: "font-semibold",
                                            children: "Treinos da semana"
                                        }, void 0, false, {
                                            fileName: "[project]/app/students/[id]/page.tsx",
                                            lineNumber: 435,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "text-xs text-slate-500 dark:text-slate-400 mt-1",
                                            children: [
                                                "Programados: ",
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: "font-semibold",
                                                    children: workouts.length
                                                }, void 0, false, {
                                                    fileName: "[project]/app/students/[id]/page.tsx",
                                                    lineNumber: 437,
                                                    columnNumber: 30
                                                }, this),
                                                ' ',
                                                "· Disponíveis: ",
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: "font-semibold",
                                                    children: workouts.filter((x)=>x.status === 'ready').length
                                                }, void 0, false, {
                                                    fileName: "[project]/app/students/[id]/page.tsx",
                                                    lineNumber: 438,
                                                    columnNumber: 37
                                                }, this),
                                                ' ',
                                                "· Rascunhos: ",
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: "font-semibold",
                                                    children: workouts.filter((x)=>x.status === 'draft').length
                                                }, void 0, false, {
                                                    fileName: "[project]/app/students/[id]/page.tsx",
                                                    lineNumber: 439,
                                                    columnNumber: 35
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/app/students/[id]/page.tsx",
                                            lineNumber: 436,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/students/[id]/page.tsx",
                                    lineNumber: 434,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "text-xs text-slate-500 dark:text-slate-400",
                                    children: "Mostrando até 200"
                                }, void 0, false, {
                                    fileName: "[project]/app/students/[id]/page.tsx",
                                    lineNumber: 442,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/students/[id]/page.tsx",
                            lineNumber: 433,
                            columnNumber: 11
                        }, this),
                        workouts.length === 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "text-sm text-slate-600 dark:text-slate-300",
                            children: "Nenhum treino programado para esta semana ainda."
                        }, void 0, false, {
                            fileName: "[project]/app/students/[id]/page.tsx",
                            lineNumber: 446,
                            columnNumber: 13
                        }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "space-y-3",
                            children: workouts.map((w)=>{
                                const latestExec = latestExecByWorkout[w.id];
                                const locked = !!w.locked_at || latestExec && (latestExec.status === 'in_progress' || latestExec.status === 'completed');
                                const planned = w.planned_date ? `Planejado: ${formatDateBR(w.planned_date)}` : w.planned_day ? `Dia: ${w.planned_day}` : '';
                                const template = w.template_type ? w.template_type : '—';
                                const progress = latestExec?.status === 'completed' ? 'Concluído' : latestExec?.status === 'in_progress' ? 'Em andamento' : w.status === 'ready' ? 'Disponível' : w.status === 'draft' ? 'Rascunho' : 'Arquivado';
                                return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "rounded-2xl border border-slate-200 dark:border-slate-800 p-4",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "min-w-0",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            className: "flex items-center gap-2 flex-wrap",
                                                            children: [
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                    className: "text-sm font-semibold truncate",
                                                                    children: w.title || 'Treino'
                                                                }, void 0, false, {
                                                                    fileName: "[project]/app/students/[id]/page.tsx",
                                                                    lineNumber: 470,
                                                                    columnNumber: 27
                                                                }, this),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                    className: "text-xs text-slate-500 dark:text-slate-400",
                                                                    children: "·"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/app/students/[id]/page.tsx",
                                                                    lineNumber: 471,
                                                                    columnNumber: 27
                                                                }, this),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                    className: "text-xs text-slate-500 dark:text-slate-400",
                                                                    children: template
                                                                }, void 0, false, {
                                                                    fileName: "[project]/app/students/[id]/page.tsx",
                                                                    lineNumber: 472,
                                                                    columnNumber: 27
                                                                }, this),
                                                                w.total_km != null ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                                                                    children: [
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                            className: "text-xs text-slate-500 dark:text-slate-400",
                                                                            children: "·"
                                                                        }, void 0, false, {
                                                                            fileName: "[project]/app/students/[id]/page.tsx",
                                                                            lineNumber: 475,
                                                                            columnNumber: 31
                                                                        }, this),
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                            className: "text-xs text-slate-500 dark:text-slate-400",
                                                                            children: formatKm(w.total_km)
                                                                        }, void 0, false, {
                                                                            fileName: "[project]/app/students/[id]/page.tsx",
                                                                            lineNumber: 476,
                                                                            columnNumber: 31
                                                                        }, this)
                                                                    ]
                                                                }, void 0, true) : null
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/app/students/[id]/page.tsx",
                                                            lineNumber: 469,
                                                            columnNumber: 25
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            className: "text-xs text-slate-500 dark:text-slate-400 mt-1",
                                                            children: [
                                                                planned ? `${planned} · ` : '',
                                                                "Status: ",
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                    className: "font-semibold",
                                                                    children: progress
                                                                }, void 0, false, {
                                                                    fileName: "[project]/app/students/[id]/page.tsx",
                                                                    lineNumber: 483,
                                                                    columnNumber: 35
                                                                }, this),
                                                                locked ? ' · Edição bloqueada após início' : ''
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/app/students/[id]/page.tsx",
                                                            lineNumber: 481,
                                                            columnNumber: 25
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/app/students/[id]/page.tsx",
                                                    lineNumber: 468,
                                                    columnNumber: 23
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "w-full sm:w-auto flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:justify-end",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                            className: "w-full sm:w-auto px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-sm font-semibold whitespace-nowrap disabled:opacity-50",
                                                            disabled: locked,
                                                            onClick: ()=>router.push(`/workouts/${w.id}/edit`),
                                                            children: "Editar"
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/students/[id]/page.tsx",
                                                            lineNumber: 489,
                                                            columnNumber: 25
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                            className: "w-full sm:w-auto px-3 py-2 rounded-lg bg-primary text-slate-900 text-sm font-semibold whitespace-nowrap disabled:opacity-50",
                                                            disabled: w.status === 'archived',
                                                            onClick: ()=>shareWorkoutLink(w.id),
                                                            children: "Gerar/Compartilhar"
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/students/[id]/page.tsx",
                                                            lineNumber: 497,
                                                            columnNumber: 25
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                            className: "w-full sm:w-auto px-3 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold whitespace-nowrap disabled:opacity-50",
                                                            disabled: !w.share_slug,
                                                            onClick: ()=>openWorkoutAsAluno(w),
                                                            children: "Ver como aluno"
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/students/[id]/page.tsx",
                                                            lineNumber: 505,
                                                            columnNumber: 25
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/app/students/[id]/page.tsx",
                                                    lineNumber: 488,
                                                    columnNumber: 23
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/app/students/[id]/page.tsx",
                                            lineNumber: 467,
                                            columnNumber: 21
                                        }, this),
                                        w.share_slug ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "text-xs text-slate-500 dark:text-slate-400 mt-2",
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
                                                    lineNumber: 517,
                                                    columnNumber: 31
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/app/students/[id]/page.tsx",
                                            lineNumber: 516,
                                            columnNumber: 23
                                        }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "text-xs text-slate-500 dark:text-slate-400 mt-2",
                                            children: "Link ainda não gerado (share_slug vazio)."
                                        }, void 0, false, {
                                            fileName: "[project]/app/students/[id]/page.tsx",
                                            lineNumber: 520,
                                            columnNumber: 23
                                        }, this),
                                        w.closed_reason ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "text-xs text-slate-500 dark:text-slate-400 mt-1",
                                            children: [
                                                "Encerrado: ",
                                                w.closed_reason
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/app/students/[id]/page.tsx",
                                            lineNumber: 524,
                                            columnNumber: 23
                                        }, this) : null
                                    ]
                                }, w.id, true, {
                                    fileName: "[project]/app/students/[id]/page.tsx",
                                    lineNumber: 466,
                                    columnNumber: 19
                                }, this);
                            })
                        }, void 0, false, {
                            fileName: "[project]/app/students/[id]/page.tsx",
                            lineNumber: 448,
                            columnNumber: 13
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/app/students/[id]/page.tsx",
                    lineNumber: 432,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/app/students/[id]/page.tsx",
            lineNumber: 398,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/app/students/[id]/page.tsx",
        lineNumber: 397,
        columnNumber: 5
    }, this);
}
_s(StudentTrainerPage, "Qr9rOWGrgUHRRpNeSjg537D/iAE=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRouter"],
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useParams"]
    ];
});
_c = StudentTrainerPage;
var _c;
__turbopack_context__.k.register(_c, "StudentTrainerPage");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
]);

//# sourceMappingURL=_7f14904d._.js.map