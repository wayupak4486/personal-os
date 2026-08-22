"use client";

import Link from "next/link";
import {
    BarChart3,
    CalendarDays,
    Check,
    CheckCircle2,
    Clock3,
    Dumbbell,
    Home,
    Loader2,
    MoonStar,
    MoreVertical,
    Plus,
    Target,
    WalletCards,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
    formatDurationMinutes,
    formatISODate,
    getSleepSettingsFromRecord,
    solveSleepStatus,
    type SleepLogRecord,
    type SleepSettingsRecord,
} from "@/lib/sleep";
import {
    calculatePaymentSummary,
    formatBaht,
    mapPaymentRecord,
    monthKey,
    type PaymentRecord,
} from "@/lib/payments";
import {
    averageGoalProgress,
    daysUntilDeadline,
    mapGoalRecord,
    type GoalRecord,
} from "@/lib/goals";
import {
    mapWorkoutRecord,
    type WorkoutRecord,
    type WorkoutSession,
} from "@/lib/workout";

type Priority = "low" | "medium" | "high";

type Task = {
    id: string;
    title: string;
    description: string | null;
    completed: boolean;
    priority: Priority | string | null;
    due_date: string | null;
    created_at: string;
};

const priorityConfig = {
    high: { label: "สูง", dot: "bg-red-500", text: "text-red-600" },
    medium: { label: "กลาง", dot: "bg-orange-400", text: "text-orange-600" },
    low: { label: "ต่ำ", dot: "bg-emerald-500", text: "text-emerald-600" },
};

export default function TodayPage() {
    const router = useRouter();
    const [supabase] = useState(() => createClient());
    const [tasks, setTasks] = useState<Task[]>([]);
    const [goals, setGoals] = useState<ReturnType<typeof mapGoalRecord>[]>([]);
    const [payments, setPayments] = useState<PaymentRecord[]>([]);
    const [sleepLogs, setSleepLogs] = useState<SleepLogRecord[]>([]);
    const [sleepSettings, setSleepSettings] = useState(() =>
        getSleepSettingsFromRecord(null),
    );
    const [workouts, setWorkouts] = useState<WorkoutSession[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionId, setActionId] = useState<string | null>(null);
    const [sleepSaving, setSleepSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const today = useMemo(() => new Date(), []);
    const todayString = formatISODate(today);

    const loadData = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const {
                data: { user },
            } = await supabase.auth.getUser();

            if (!user) {
                router.replace("/auth/login");
                return;
            }

            const [
                taskResult,
                goalResult,
                paymentResult,
                sleepSettingsResult,
                sleepLogResult,
                workoutResult,
            ] = await Promise.all([
                supabase
                    .from("tasks")
                    .select("*")
                    .eq("user_id", user.id)
                    .order("created_at", { ascending: false }),
                supabase
                    .from("goals")
                    .select("*")
                    .eq("user_id", user.id)
                    .order("deadline", { ascending: true, nullsFirst: false })
                    .limit(20),
                supabase
                    .from("payment_occurrences")
                    .select("*")
                    .eq("user_id", user.id)
                    .order("billing_month", { ascending: false })
                    .order("due_date", { ascending: true }),
                supabase
                    .from("sleep_settings")
                    .select("*")
                    .eq("user_id", user.id)
                    .maybeSingle(),
                supabase
                    .from("sleep_logs")
                    .select("*")
                    .eq("user_id", user.id)
                    .order("created_at", { ascending: false })
                    .limit(50),
                supabase
                    .from("workout_sessions")
                    .select("*")
                    .eq("user_id", user.id)
                    .order("workout_date", { ascending: false })
                    .order("scheduled_time", { ascending: true })
                    .limit(50),
            ]);

            const firstError =
                taskResult.error ||
                goalResult.error ||
                paymentResult.error ||
                sleepSettingsResult.error ||
                sleepLogResult.error ||
                workoutResult.error;

            if (firstError) throw firstError;

            setTasks((taskResult.data ?? []) as Task[]);
            setGoals((goalResult.data ?? []).map((x) => mapGoalRecord(x as GoalRecord)));
            setPayments((paymentResult.data ?? []) as PaymentRecord[]);
            setSleepSettings(
                getSleepSettingsFromRecord(
                    sleepSettingsResult.data as SleepSettingsRecord | null,
                ),
            );
            setSleepLogs((sleepLogResult.data ?? []) as SleepLogRecord[]);
            setWorkouts(
                (workoutResult.data ?? []).map((x) =>
                    mapWorkoutRecord(x as WorkoutRecord),
                ),
            );
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "ไม่สามารถโหลดข้อมูล Today ได้",
            );
        } finally {
            setLoading(false);
        }
    }, [router, supabase]);

    // This effect intentionally synchronizes component state with remote Supabase data.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    useEffect(() => {
        void loadData();
    }, [loadData]);

    const completedTasks = tasks.filter((task) => task.completed).length;
    const activeTasks = tasks.length - completedTasks;
    const taskRate =
        tasks.length === 0 ? 0 : Math.round((completedTasks / tasks.length) * 100);

    const todayTasks = useMemo(
        () =>
            tasks
                .filter((task) => task.due_date === todayString && !task.completed)
                .sort((a, b) => priorityScore(b.priority) - priorityScore(a.priority))
                .slice(0, 6),
        [tasks, todayString],
    );

    const overdueTasks = useMemo(
        () =>
            tasks
                .filter(
                    (task) =>
                        !task.completed &&
                        task.due_date !== null &&
                        task.due_date < todayString,
                )
                .slice(0, 4),
        [tasks, todayString],
    );

    const focusGoals = useMemo(
        () =>
            goals
                .filter((goal) => goal.status !== "completed")
                .sort((a, b) => {
                    if (a.priority !== b.priority) {
                        return priorityScore(b.priority) - priorityScore(a.priority);
                    }
                    return b.progress - a.progress;
                })
                .slice(0, 3),
        [goals],
    );

    const todayWorkouts = useMemo(
        () => workouts.filter((workout) => workout.date === todayString),
        [workouts, todayString],
    );

    const sleepSummary = solveSleepStatus(sleepLogs, sleepSettings);

    const currentPaymentRecords = useMemo(
        () => payments.filter((payment) => payment.billing_month?.slice(0, 7) === monthKey(today)),
        [payments, today],
    );

    const overduePaymentRecords = useMemo(
        () =>
            payments
                .filter(
                    (payment) =>
                        payment.status !== "paid" &&
                        Boolean(payment.billing_month) &&
                        payment.billing_month!.slice(0, 7) < monthKey(today),
                )
                .sort((a, b) => {
                    const monthCompare = (a.billing_month ?? "9999").localeCompare(b.billing_month ?? "9999");
                    if (monthCompare !== 0) return monthCompare;
                    return (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999");
                }),
        [payments, today],
    );

    const currentPayments = useMemo(
        () => currentPaymentRecords.map(mapPaymentRecord),
        [currentPaymentRecords],
    );

    const overduePayments = useMemo(
        () => overduePaymentRecords.map(mapPaymentRecord),
        [overduePaymentRecords],
    );

    const paymentSummary = calculatePaymentSummary(currentPayments);
    const overdueSummary = calculatePaymentSummary(overduePayments);
    const totalOutstanding = paymentSummary.remaining + overdueSummary.remaining;

    const upcomingPayments = currentPayments
        .filter((payment) => payment.status !== "paid")
        .sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"))
        .slice(0, 3);

    const overallProgress = Math.round(
        (taskRate + averageGoalProgress(goals)) / 2,
    );

    async function toggleTask(task: Task) {
        if (actionId) return;

        setActionId(task.id);
        setError(null);

        const nextCompleted = !task.completed;
        setTasks((current) =>
            current.map((item) =>
                item.id === task.id ? { ...item, completed: nextCompleted } : item,
            ),
        );

        try {
            const { error: updateError } = await supabase
                .from("tasks")
                .update({ completed: nextCompleted })
                .eq("id", task.id)
                .eq("user_id", (await supabase.auth.getUser()).data.user?.id ?? "");

            if (updateError) throw updateError;
        } catch (err) {
            setTasks((current) =>
                current.map((item) =>
                    item.id === task.id ? { ...item, completed: task.completed } : item,
                ),
            );
            setError(
                err instanceof Error ? err.message : "ไม่สามารถเปลี่ยนสถานะงานได้",
            );
        } finally {
            setActionId(null);
        }
    }

    async function toggleWorkout(workout: WorkoutSession) {
        if (actionId) return;

        setActionId(workout.id);
        setError(null);

        const nextCompleted = !workout.completed;
        const completedAt = nextCompleted ? new Date().toISOString() : null;

        setWorkouts((current) =>
            current.map((item) =>
                item.id === workout.id
                    ? { ...item, completed: nextCompleted, completedAt }
                    : item,
            ),
        );

        try {
            const {
                data: { user },
            } = await supabase.auth.getUser();

            if (!user) throw new Error("กรุณาเข้าสู่ระบบ");

            const { error: updateError } = await supabase
                .from("workout_sessions")
                .update({
                    completed: nextCompleted,
                    completed_at: completedAt,
                    updated_at: new Date().toISOString(),
                })
                .eq("id", workout.id)
                .eq("user_id", user.id);

            if (updateError) throw updateError;
        } catch (err) {
            setWorkouts((current) =>
                current.map((item) => (item.id === workout.id ? workout : item)),
            );
            setError(
                err instanceof Error
                    ? err.message
                    : "ไม่สามารถเปลี่ยนสถานะ Workout ได้",
            );
        } finally {
            setActionId(null);
        }
    }

    async function startSleep() {
        if (sleepSaving) return;

        setSleepSaving(true);
        setError(null);

        try {
            const {
                data: { user },
                error: authError,
            } = await supabase.auth.getUser();

            if (authError) throw authError;
            if (!user) throw new Error("กรุณาเข้าสู่ระบบก่อนบันทึกเวลานอน");

            const now = new Date();
            const baseSleepDate = formatISODate(now);

            const { data: activeLogs, error: activeError } = await supabase
                .from("sleep_logs")
                .select("id, sleep_date, bedtime, status, created_at")
                .eq("user_id", user.id)
                .eq("status", "sleeping")
                .order("created_at", { ascending: false })
                .limit(1);

            if (activeError) throw activeError;

            if (activeLogs?.[0]) {
                await loadData();
                return;
            }

            const { data: todayLogs, error: todayError } = await supabase
                .from("sleep_logs")
                .select("id, sleep_date, bedtime, wake_time, duration_minutes, status, created_at")
                .eq("user_id", user.id)
                .eq("sleep_date", baseSleepDate)
                .order("created_at", { ascending: false })
                .limit(1);

            if (todayError) throw todayError;

            if (todayLogs?.[0]) {
                const existing = todayLogs[0];

                if (existing.status === "completed") {
                    const { error: nextInsertError } = await supabase
                        .from("sleep_logs")
                        .insert({
                            user_id: user.id,
                            sleep_date: baseSleepDate,
                            bedtime: now.toISOString(),
                            wake_time: null,
                            duration_minutes: null,
                            status: "sleeping",
                        });

                    if (nextInsertError) {
                        if (
                            nextInsertError.code === "23505" ||
                            (nextInsertError as { status?: number }).status === 409
                        ) {
                            await loadData();
                            return;
                        }

                        throw nextInsertError;
                    }

                    await loadData();
                    return;
                }

                await loadData();
                return;
            }

            const { error: insertError } = await supabase
                .from("sleep_logs")
                .insert({
                    user_id: user.id,
                    sleep_date: baseSleepDate,
                    bedtime: now.toISOString(),
                    wake_time: null,
                    duration_minutes: null,
                    status: "sleeping",
                });

            if (insertError) {
                if (
                    insertError.code === "23505" ||
                    (insertError as { status?: number }).status === 409
                ) {
                    await loadData();
                    return;
                }

                throw insertError;
            }

            await loadData();
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "ไม่สามารถเริ่มบันทึกการนอนได้",
            );
        } finally {
            setSleepSaving(false);
        }
    }

    async function wakeUp() {
        if (sleepSaving) return;

        setSleepSaving(true);
        setError(null);

        try {
            const {
                data: { user },
                error: authError,
            } = await supabase.auth.getUser();

            if (authError) throw authError;
            if (!user) throw new Error("กรุณาเข้าสู่ระบบ");

            const { data: activeLogs, error: findError } = await supabase
                .from("sleep_logs")
                .select("id, bedtime")
                .eq("user_id", user.id)
                .eq("status", "sleeping")
                .order("created_at", { ascending: false })
                .limit(1);

            if (findError) throw findError;

            const active = activeLogs?.[0];

            if (!active?.id || !active.bedtime) {
                throw new Error("ยังไม่มีเซสชันการนอนที่กำลังดำเนินอยู่");
            }

            const wakeTime = new Date();
            const bedtime = new Date(active.bedtime);
            const durationMinutes = Math.max(
                0,
                Math.round((wakeTime.getTime() - bedtime.getTime()) / 60000),
            );

            const { error: updateError } = await supabase
                .from("sleep_logs")
                .update({
                    wake_time: wakeTime.toISOString(),
                    duration_minutes: durationMinutes,
                    status: "completed",
                    updated_at: wakeTime.toISOString(),
                })
                .eq("id", active.id)
                .eq("user_id", user.id);

            if (updateError) throw updateError;

            await loadData();
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "ไม่สามารถบันทึกเวลาตื่นได้",
            );
        } finally {
            setSleepSaving(false);
        }
    }

    const greeting = getGreeting();
    const dateLabel = new Intl.DateTimeFormat("th-TH", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
    }).format(today);

    return (
        <div className="min-h-screen bg-[#f8fafc] text-slate-950">
            <div className="flex min-h-screen">
                <aside className="hidden w-[240px] shrink-0 border-r border-slate-200 bg-white lg:flex lg:flex-col">
                    <div className="px-6 py-7">
                        <div className="text-lg font-bold tracking-tight">PERSONAL OS</div>
                        <p className="mt-1 text-xs text-slate-400">
                            Personal productivity system
                        </p>
                    </div>

                    <nav className="space-y-1 px-3">
                        <NavItem active icon={<Home size={18} />} label="Today" href="/today" />
                        <NavItem icon={<CheckCircle2 size={18} />} label="Tasks" href="/tasks" />
                        <NavItem icon={<Target size={18} />} label="Goals" href="/goals" />
                        <NavItem icon={<Dumbbell size={18} />} label="Workout" href="/workout" />
                        <NavItem icon={<BarChart3 size={18} />} label="Progress" href="/progress" />
                        <NavItem icon={<WalletCards size={18} />} label="Payments" href="/payments" />
                    </nav>

                    <div className="mt-auto px-3 pb-6">
                        <NavItem icon={<MoreVertical size={18} />} label="More" href="/settings" />
                    </div>
                </aside>

                <main className="min-w-0 flex-1 pb-24 lg:pb-0">
                    <div className="mx-auto max-w-[1200px] px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
                        <header className="flex items-start justify-between gap-4">
                            <div>
                                <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
                                    {dateLabel}
                                </p>
                                <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
                                    {greeting}
                                </h1>
                                <p className="mt-2 text-sm text-slate-500">
                                    วันนี้โฟกัสสิ่งสำคัญก่อน แล้วค่อยจัดการส่วนที่เหลือ
                                </p>
                            </div>

                            <Link
                                href="/tasks"
                                className="hidden h-11 items-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 sm:flex"
                            >
                                <Plus size={18} />
                                เพิ่มงาน
                            </Link>
                        </header>

                        {error && (
                            <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                                <p className="font-semibold">เกิดข้อผิดพลาด</p>
                                <p className="mt-1">{error}</p>
                            </div>
                        )}

                        <section className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
                            <StatCard label="งานค้าง" value={loading ? "—" : activeTasks} />
                            <StatCard label="เสร็จแล้ว" value={loading ? "—" : completedTasks} dot="bg-emerald-500" />
                            <StatCard label="Goal Progress" value={loading ? "—" : `${averageGoalProgress(goals)}%`} dot="bg-blue-500" />
                            <StatCard label="Daily Progress" value={loading ? "—" : `${overallProgress}%`} dot="bg-orange-400" />
                        </section>

                        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
                                        TODAY&apos;S FOCUS
                                    </p>
                                    <h2 className="mt-1 text-xl font-bold">สิ่งสำคัญวันนี้</h2>
                                </div>
                                <Target size={21} className="text-slate-400" />
                            </div>

                            <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100">
                                <div
                                    className="h-full rounded-full bg-slate-950 transition-all"
                                    style={{ width: `${overallProgress}%` }}
                                />
                            </div>

                            <div className="mt-3 flex justify-between text-xs text-slate-400">
                                <span>ความคืบหน้าวันนี้</span>
                                <span>{overallProgress}%</span>
                            </div>
                        </section>

                        <div className="mt-6 grid gap-6 lg:grid-cols-2">
                            <SectionCard eyebrow="TASKS" title="งานวันนี้" icon={<CheckCircle2 size={20} />} href="/tasks">
                                {todayTasks.length === 0 ? (
                                    <Empty text="วันนี้ไม่มีงานค้างที่กำหนดไว้" />
                                ) : (
                                    <div className="space-y-2">
                                        {todayTasks.map((task) => (
                                            <TaskRow
                                                key={task.id}
                                                task={task}
                                                loading={actionId === task.id}
                                                onToggle={() => void toggleTask(task)}
                                            />
                                        ))}
                                    </div>
                                )}
                            </SectionCard>

                            <SectionCard eyebrow="GOALS" title="เป้าหมายที่กำลังโฟกัส" icon={<Target size={20} />} href="/goals">
                                {focusGoals.length === 0 ? (
                                    <Empty text="ยังไม่มี Goal ที่กำลังทำ" />
                                ) : (
                                    <div className="space-y-4">
                                        {focusGoals.map((goal) => (
                                            <div key={goal.id}>
                                                <div className="flex items-center justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <p className="truncate text-sm font-semibold">{goal.title}</p>
                                                        <p className="mt-1 text-xs text-slate-400">
                                                            {goal.deadline ? deadlineLabel(goal.deadline) : "ไม่มี Deadline"}
                                                        </p>
                                                    </div>
                                                    <span className="text-sm font-bold">{goal.progress}%</span>
                                                </div>
                                                <div className="mt-2 h-2 rounded-full bg-slate-100">
                                                    <div className="h-full rounded-full bg-slate-950" style={{ width: `${goal.progress}%` }} />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </SectionCard>
                        </div>

                        <div className="mt-6 grid gap-6 lg:grid-cols-2">
                            <SectionCard eyebrow="WORKOUT" title="Workout วันนี้" icon={<Dumbbell size={20} />} href="/workout">
                                {todayWorkouts.length === 0 ? (
                                    <Empty text="วันนี้ยังไม่มี Workout" />
                                ) : (
                                    <div className="space-y-3">
                                        {todayWorkouts.map((workout) => (
                                            <WorkoutRow
                                                key={workout.id}
                                                workout={workout}
                                                loading={actionId === workout.id}
                                                onToggle={() => void toggleWorkout(workout)}
                                            />
                                        ))}
                                    </div>
                                )}
                            </SectionCard>

                            <SectionCard eyebrow="SLEEP" title="การนอน" icon={<MoonStar size={20} />} href="/sleep">
                                <div className="rounded-2xl bg-slate-50 p-4">
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="min-w-0">
                                            <p className="text-xs text-slate-400">เมื่อคืน</p>
                                            <p className="mt-1 text-3xl font-bold tracking-tight">
                                                {sleepSummary.durationMinutes === null
                                                    ? "—"
                                                    : formatDurationMinutes(sleepSummary.durationMinutes)}
                                            </p>
                                        </div>
                                        <MoonStar size={28} className="shrink-0 text-slate-400" />
                                    </div>

                                    <div className="mt-4 flex items-center justify-between gap-3">
                                        <p className="text-xs text-slate-400">
                                            {sleepSummary.status === "SLEEPING"
                                                ? "กำลังนอนอยู่"
                                                : sleepSummary.durationMinutes === null
                                                    ? "ยังไม่มีข้อมูลการนอน"
                                                    : "เวลานอนล่าสุด"}
                                        </p>

                                        <button
                                            type="button"
                                            onClick={() =>
                                                void (sleepSummary.status === "SLEEPING"
                                                    ? wakeUp()
                                                    : startSleep())
                                            }
                                            disabled={sleepSaving}
                                            className="rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
                                        >
                                            {sleepSaving
                                                ? "กำลังบันทึก..."
                                                : sleepSummary.status === "SLEEPING"
                                                    ? "ตื่นแล้ว"
                                                    : "เริ่มนอน"}
                                        </button>
                                    </div>
                                </div>
                            </SectionCard>
                        </div>

                        <div className="mt-6 grid gap-6 lg:grid-cols-2">
                            <SectionCard
                                eyebrow="PAYMENTS"
                                title="รายการที่ต้องจ่าย"
                                icon={<WalletCards size={20} />}
                                href="/payments"
                                tone="amber"
                            >
                                <div className={`rounded-2xl p-4 ${totalOutstanding > 0 ? "bg-amber-50" : "bg-slate-50"}`}>
                                    <div className="flex items-end justify-between gap-4">
                                        <div>
                                            <p className="text-xs text-slate-500">ยอดค้างทั้งหมด</p>
                                            <p className="mt-1 text-3xl font-bold tracking-tight">{formatBaht(totalOutstanding)}</p>
                                            <p className="mt-1 text-xs text-slate-500">ทั้งยอดเก่าและค่าใช้จ่ายเดือนนี้</p>
                                        </div>
                                        <WalletCards size={24} className="text-amber-500" />
                                    </div>
                                </div>

                                <div className="mt-4 grid grid-cols-2 gap-3">
                                    <div className="rounded-2xl border border-amber-100 bg-amber-50/40 p-3">
                                        <p className="text-xs text-slate-400">ยอดค้างเดิม</p>
                                        <p className="mt-1 text-lg font-bold text-amber-700">{formatBaht(overdueSummary.remaining)}</p>
                                    </div>
                                    <div className="rounded-2xl border border-amber-100 bg-white p-3">
                                        <p className="text-xs text-slate-400">เดือนนี้</p>
                                        <p className="mt-1 text-lg font-bold">{formatBaht(paymentSummary.remaining)}</p>
                                    </div>
                                </div>

                                {overduePayments.length > 0 && (
                                    <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50/60 p-3">
                                        <div className="flex items-center justify-between gap-3">
                                            <div>
                                                <p className="text-sm font-semibold text-slate-800">มีรายการค้างจากเดือนก่อน</p>
                                                <p className="mt-0.5 text-xs text-slate-500">ต้องจ่ายเพิ่มจากบิลใหม่</p>
                                            </div>
                                            <span className="text-sm font-bold text-amber-700">{formatBaht(overdueSummary.remaining)}</span>
                                        </div>
                                        <div className="mt-3 space-y-2">
                                            {overduePayments.slice(0, 3).map((payment) => (
                                                <div key={payment.id} className="flex items-center justify-between gap-3 text-xs">
                                                    <span className="truncate text-slate-600">{payment.note || payment.category}</span>
                                                    <span className="font-semibold text-slate-700">
                                                        {formatBaht(payment.amount === null ? null : Math.max(0, payment.amount - payment.paidAmount))}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                        {overduePayments.length > 3 && (
                                            <p className="mt-2 text-[11px] text-amber-700">และอีก {overduePayments.length - 3} รายการ</p>
                                        )}
                                    </div>
                                )}

                                <div className="mt-4 space-y-2">
                                    {upcomingPayments.length === 0 ? (
                                        <Empty text="เดือนนี้ไม่มีรายการค้างชำระ" />
                                    ) : (
                                        upcomingPayments.map((payment) => (
                                            <div key={payment.id} className="flex items-center justify-between rounded-xl border border-amber-100 p-3">
                                                <div>
                                                    <p className="text-sm font-semibold">{payment.note || payment.category}</p>
                                                    <p className="mt-1 text-xs text-slate-400">
                                                        {payment.dueDate ? `ครบกำหนด ${formatShortDate(payment.dueDate)}` : "ไม่ระบุวัน"}
                                                    </p>
                                                </div>
                                                <p className="text-sm font-bold">{formatBaht(payment.amount === null ? null : Math.max(0, payment.amount - payment.paidAmount))}</p>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </SectionCard>

                            <SectionCard eyebrow="OVERDUE" title="งานเลยกำหนด" icon={<Clock3 size={20} />} href="/tasks">
                                {overdueTasks.length === 0 ? (
                                    <Empty text="ไม่มีงานเลยกำหนด 🎉" />
                                ) : (
                                    <div className="space-y-2">
                                        {overdueTasks.map((task) => (
                                            <TaskRow
                                                key={task.id}
                                                task={task}
                                                loading={actionId === task.id}
                                                onToggle={() => void toggleTask(task)}
                                                overdue
                                            />
                                        ))}
                                    </div>
                                )}
                            </SectionCard>
                        </div>
                    </div>
                </main>
            </div>

            <nav className="fixed bottom-0 left-0 right-0 z-20 border-t border-slate-200 bg-white/95 px-3 py-2 backdrop-blur lg:hidden">
                <div className="mx-auto flex max-w-lg items-center justify-around">
                    <MobileNav active icon={<Home size={19} />} label="Today" href="/today" />
                    <MobileNav icon={<CheckCircle2 size={19} />} label="Tasks" href="/tasks" />
                    <MobileNav icon={<Target size={19} />} label="Goals" href="/goals" />
                    <MobileNav icon={<Dumbbell size={19} />} label="Workout" href="/workout" />
                    <MobileNav icon={<MoreVertical size={19} />} label="More" href="/payments" />
                </div>
            </nav>
        </div>
    );
}

function NavItem({
    icon,
    label,
    href,
    active = false,
}: {
    icon: ReactNode;
    label: string;
    href: string;
    active?: boolean;
}) {
    return (
        <Link
            href={href}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                active
                    ? "bg-slate-100 font-semibold text-slate-950"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
            }`}
        >
            {icon}
            {label}
        </Link>
    );
}

function MobileNav({
    icon,
    label,
    href,
    active = false,
}: {
    icon: ReactNode;
    label: string;
    href: string;
    active?: boolean;
}) {
    return (
        <Link
            href={href}
            className={`flex min-w-14 flex-col items-center gap-1 text-[10px] ${
                active ? "font-semibold text-slate-950" : "text-slate-400"
            }`}
        >
            {icon}
            <span>{label}</span>
        </Link>
    );
}

function StatCard({
    label,
    value,
    dot,
}: {
    label: string;
    value: string | number;
    dot?: string;
}) {
    return (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
            <div className="flex items-center gap-2 text-xs text-slate-500">
                {dot && <span className={`h-2 w-2 rounded-full ${dot}`} />}
                {label}
            </div>
            <p className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">{value}</p>
        </div>
    );
}

function SectionCard({
    eyebrow,
    title,
    icon,
    href,
    children,
    tone = "default",
}: {
    eyebrow: string;
    title: string;
    icon: ReactNode;
    href: string;
    children: ReactNode;
    tone?: "default" | "amber";
}) {
    const amber = tone === "amber";

    return (
        <section
            className={`rounded-3xl border bg-white p-5 shadow-sm sm:p-6 ${
                amber ? "border-amber-200" : "border-slate-200"
            }`}
        >
            <div className="flex items-center justify-between gap-4">
                <div>
                    <p
                        className={`text-xs font-medium uppercase tracking-[0.16em] ${
                            amber ? "text-amber-500" : "text-slate-400"
                        }`}
                    >
                        {eyebrow}
                    </p>
                    <h2 className="mt-1 text-xl font-bold">{title}</h2>
                </div>
                <div className="flex items-center gap-3">
                    <span className={amber ? "text-amber-500" : "text-slate-950"}>{icon}</span>
                    <Link
                        href={href}
                        className={`text-xs font-semibold ${
                            amber
                                ? "text-amber-600 hover:text-amber-800"
                                : "text-slate-400 hover:text-slate-950"
                        }`}
                    >
                        ดูทั้งหมด →
                    </Link>
                </div>
            </div>
            <div className="mt-5">{children}</div>
        </section>
    );
}

function TaskRow({
    task,
    loading,
    onToggle,
    overdue = false,
}: {
    task: Task;
    loading: boolean;
    onToggle: () => void;
    overdue?: boolean;
}) {
    const priorityKey =
        task.priority === "high" || task.priority === "medium" || task.priority === "low"
            ? task.priority
            : "medium";
    const priority = priorityConfig[priorityKey];

    return (
        <div className="flex items-center gap-3 rounded-xl border border-slate-100 p-3">
            <button
                type="button"
                onClick={onToggle}
                disabled={loading}
                className="shrink-0"
                aria-label="ทำงานเสร็จ"
            >
                {loading ? (
                    <Loader2 size={22} className="animate-spin text-slate-400" />
                ) : task.completed ? (
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white">
                        <Check size={15} strokeWidth={3} />
                    </span>
                ) : (
                    <span className="block h-6 w-6 rounded-full border-2 border-slate-200" />
                )}
            </button>

            <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{task.title}</p>
                <div className="mt-1 flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${priority.dot}`} />
                    <span className={`text-xs ${priority.text}`}>{priority.label}</span>
                    {overdue && <span className="text-xs font-semibold text-red-600">เลยกำหนด</span>}
                </div>
            </div>

            {task.due_date && (
                <span className="hidden text-xs text-slate-400 sm:block">
                    <CalendarDays size={13} className="mr-1 inline" />
                    {formatShortDate(task.due_date)}
                </span>
            )}
        </div>
    );
}

function WorkoutRow({
    workout,
    loading,
    onToggle,
}: {
    workout: WorkoutSession;
    loading: boolean;
    onToggle: () => void;
}) {
    return (
        <div className="flex items-center gap-3 rounded-xl border border-slate-100 p-3">
            <button
                type="button"
                onClick={onToggle}
                disabled={loading}
                className="shrink-0"
                aria-label="เปลี่ยนสถานะ Workout"
            >
                {loading ? (
                    <Loader2 size={22} className="animate-spin text-slate-400" />
                ) : workout.completed ? (
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white">
                        <Check size={15} strokeWidth={3} />
                    </span>
                ) : (
                    <span className="block h-6 w-6 rounded-full border-2 border-slate-200" />
                )}
            </button>

            <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{workout.name}</p>
                <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-400">
                    <span>{workout.category}</span>
                    {workout.scheduledTime && <span>{workout.scheduledTime.slice(0, 5)}</span>}
                    {workout.durationMinutes !== null && <span>{workout.durationMinutes} นาที</span>}
                    {workout.calories !== null && <span>{workout.calories} kcal</span>}
                </div>
            </div>

            {workout.completed && <CheckCircle2 size={18} className="text-emerald-500" />}
        </div>
    );
}

function Empty({ text }: { text: string }) {
    return (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">
            {text}
        </div>
    );
}

function priorityScore(value: unknown) {
    if (value === "high") return 3;
    if (value === "medium") return 2;
    return 1;
}

function getGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return "สวัสดีตอนเช้า 👋";
    if (hour < 18) return "สวัสดีตอนบ่าย 👋";
    return "สวัสดีตอนเย็น 👋";
}

function formatShortDate(value: string) {
    return new Intl.DateTimeFormat("th-TH", {
        day: "numeric",
        month: "short",
    }).format(new Date(`${value}T00:00:00`));
}

function deadlineLabel(deadline: string) {
    const days = daysUntilDeadline(deadline);
    if (days === null) return "ไม่มี Deadline";
    if (days < 0) return `เลยกำหนด ${Math.abs(days)} วัน`;
    if (days === 0) return "ครบกำหนดวันนี้";
    if (days === 1) return "ครบกำหนดพรุ่งนี้";
    return `อีก ${days} วัน`;
}