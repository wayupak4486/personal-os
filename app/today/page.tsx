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
import { createClient } from "@/lib/supabase/client";
import {
    formatDurationMinutes,
    formatClockTime,
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
    const [supabase] = useState(() => createClient());

    const [tasks, setTasks] = useState<Task[]>([]);
    const [goals, setGoals] = useState<ReturnType<typeof mapGoalRecord>[]>([]);
    const [payments, setPayments] = useState<ReturnType<typeof mapPaymentRecord>[]>([]);
    const [sleepLogs, setSleepLogs] = useState<SleepLogRecord[]>([]);
    const [sleepSettings, setSleepSettings] = useState(() =>
        getSleepSettingsFromRecord(null),
    );
    const [workouts, setWorkouts] = useState<WorkoutSession[]>([]);

    const [loading, setLoading] = useState(true);
    const [actionId, setActionId] = useState<string | null>(null);
    const [sleepSaving, setSleepSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const today = new Date();
    const todayString = formatISODate(today);
    const billingMonth = `${monthKey(today)}-01`;

    const loadData = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const {
                data: { user },
                error: authError,
            } = await supabase.auth.getUser();

            if (authError) throw authError;

            if (!user) {
                window.location.href = "/auth/login";
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
                    .eq("billing_month", billingMonth)
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
                    .limit(20),

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
            setPayments(
                (paymentResult.data ?? []).map((x) =>
                    mapPaymentRecord(x as PaymentRecord),
                ),
            );
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
    }, [supabase, billingMonth]);

    useEffect(() => {
        void loadData();
    }, [loadData]);

    const completedTasks = tasks.filter((task) => task.completed).length;
    const activeTasks = tasks.length - completedTasks;

    const todayTasks = useMemo(
        () =>
            tasks
                .filter(
                    (task) =>
                        !task.completed &&
                        (task.due_date === todayString || task.due_date === null),
                )
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
    const paymentSummary = calculatePaymentSummary(payments);

    const upcomingPayments = payments
        .slice()
        .sort((a, b) => {
            const paidA = a.status === "paid" ? 1 : 0;
            const paidB = b.status === "paid" ? 1 : 0;
            if (paidA !== paidB) return paidA - paidB;
            return (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999");
        })
        .slice(0, 6);

    const paidPayments = payments.filter((payment) => payment.status === "paid").length;

    const taskProgress =
        tasks.length === 0 ? 0 : Math.round((completedTasks / tasks.length) * 100);
    const goalProgress = averageGoalProgress(goals);

    const overallProgress = Math.round((taskProgress + goalProgress) / 2);

    async function toggleTask(task: Task) {
        if (actionId) return;

        const previousTasks = tasks;
        const nextCompleted = !task.completed;

        setActionId(task.id);
        setError(null);

        setTasks((current) =>
            current.map((item) =>
                item.id === task.id ? { ...item, completed: nextCompleted } : item,
            ),
        );

        try {
            const { data, error: updateError } = await supabase
                .from("tasks")
                .update({ completed: nextCompleted })
                .eq("id", task.id)
                .select("*")
                .single();

            if (updateError) throw updateError;

            setTasks((current) =>
                current.map((item) =>
                    item.id === task.id ? (data as Task) : item,
                ),
            );
        } catch (err) {
            setTasks(previousTasks);
            setError(
                err instanceof Error ? err.message : "ไม่สามารถเปลี่ยนสถานะงานได้",
            );
        } finally {
            setActionId(null);
        }
    }

    async function toggleWorkout(workout: WorkoutSession) {
        if (actionId) return;

        const previousWorkouts = workouts;
        const nextCompleted = !workout.completed;

        setActionId(workout.id);
        setError(null);

        setWorkouts((current) =>
            current.map((item) =>
                item.id === workout.id
                    ? { ...item, completed: nextCompleted }
                    : item,
            ),
        );

        try {
            const { data, error: updateError } = await supabase
                .from("workout_sessions")
                .update({ completed: nextCompleted })
                .eq("id", workout.id)
                .select("*")
                .single();

            if (updateError) throw updateError;

            setWorkouts((current) =>
                current.map((item) =>
                    item.id === workout.id
                        ? mapWorkoutRecord(data as WorkoutRecord)
                        : item,
                ),
            );
        } catch (err) {
            setWorkouts(previousWorkouts);
            setError(
                err instanceof Error
                    ? err.message
                    : "ไม่สามารถเปลี่ยนสถานะ Workout ได้",
            );
        } finally {
            setActionId(null);
        }
    }

    async function togglePayment(payment: ReturnType<typeof mapPaymentRecord>) {
        if (actionId) return;

        const previousPayments = payments;
        const nextStatus = payment.status === "paid" ? "unpaid" : "paid";

        setActionId(payment.id);
        setError(null);

        setPayments((current) =>
            current.map((item) =>
                item.id === payment.id
                    ? { ...item, status: nextStatus }
                    : item,
            ),
        );

        try {
            const { data, error: updateError } = await supabase
                .from("payment_occurrences")
                .update({ status: nextStatus })
                .eq("id", payment.id)
                .select("*")
                .single();

            if (updateError) throw updateError;

            setPayments((current) =>
                current.map((item) =>
                    item.id === payment.id
                        ? mapPaymentRecord(data as PaymentRecord)
                        : item,
                ),
            );
        } catch (err) {
            setPayments(previousPayments);
            setError(
                err instanceof Error
                    ? err.message
                    : "ไม่สามารถเปลี่ยนสถานะการจ่ายเงินได้",
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
            const sleepDate = formatISODate(now);

            const { data: existingLogs, error: existingError } = await supabase
                .from("sleep_logs")
                .select(
                    "id, sleep_date, bedtime, wake_time, duration_minutes, status, created_at",
                )
                .eq("user_id", user.id)
                .eq("sleep_date", sleepDate)
                .order("created_at", { ascending: false })
                .limit(1);

            if (existingError) throw existingError;

            const existingLog = existingLogs?.[0];

            if (existingLog?.status === "sleeping") {
                await loadData();
                return;
            }

            if (existingLog?.status === "completed") {
                throw new Error("วันนี้มีบันทึกการนอนที่เสร็จแล้ว หากต้องการแก้ไขให้เข้าเมนู Sleep");
            }

            const { error: insertError } = await supabase
                .from("sleep_logs")
                .insert({
                    user_id: user.id,
                    sleep_date: sleepDate,
                    bedtime: now.toISOString(),
                    wake_time: null,
                    duration_minutes: null,
                    status: "sleeping",
                });

            if (insertError) {
                if (insertError.code === "23505") {
                    await loadData();
                    return;
                }
                throw insertError;
            }

            await loadData();
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "ไม่สามารถบันทึกเวลานอนได้",
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
            } = await supabase.auth.getUser();

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
                                    className="h-full rounded-full bg-slate-950 transition-all duration-300"
                                    style={{ width: `${Math.min(100, Math.max(0, overallProgress))}%` }}
                                />
                            </div>

                            <div className="mt-3 flex justify-between text-xs text-slate-400">
                                <span>ความคืบหน้าวันนี้</span>
                                <span>{overallProgress}%</span>
                            </div>
                        </section>

                        <div className="mt-6 grid gap-6 lg:grid-cols-2">
                            <SectionCard
                                eyebrow="TASKS"
                                title="งานวันนี้"
                                icon={<CheckCircle2 size={20} />}
                                href="/tasks"
                            >
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

                            <SectionCard
                                eyebrow="GOALS"
                                title="เป้าหมายที่กำลังโฟกัส"
                                icon={<Target size={20} />}
                                href="/goals"
                            >
                                {focusGoals.length === 0 ? (
                                    <Empty text="ยังไม่มี Goal ที่กำลังทำ" />
                                ) : (
                                    <div className="space-y-4">
                                        {focusGoals.map((goal) => (
                                            <div key={goal.id}>
                                                <div className="flex items-center justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <p className="truncate text-sm font-semibold">
                                                            {goal.title}
                                                        </p>
                                                        <p className="mt-1 text-xs text-slate-400">
                                                            {goal.deadline
                                                                ? deadlineLabel(goal.deadline)
                                                                : "ไม่มี Deadline"}
                                                        </p>
                                                    </div>
                                                    <span className="text-sm font-bold">{goal.progress}%</span>
                                                </div>
                                                <div className="mt-2 h-2 rounded-full bg-slate-100">
                                                    <div
                                                        className="h-full rounded-full bg-slate-950 transition-all"
                                                        style={{ width: `${Math.min(100, Math.max(0, goal.progress))}%` }}
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </SectionCard>
                        </div>

                        <div className="mt-6 grid gap-6 lg:grid-cols-2">
                            <SectionCard
                                eyebrow="WORKOUT"
                                title="Workout วันนี้"
                                icon={<Dumbbell size={20} />}
                                href="/workout"
                            >
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

                            <SectionCard
                                eyebrow="SLEEP"
                                title="การนอน"
                                icon={<MoonStar size={20} />}
                                href="/sleep"
                            >
                                <div className="rounded-2xl bg-slate-50 p-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-xs text-slate-400">เมื่อคืน</p>
                                            <p className="mt-1 text-2xl font-bold">
                                                {sleepSummary.durationMinutes === null
                                                    ? "—"
                                                    : formatDurationMinutes(sleepSummary.durationMinutes)}
                                            </p>
                                        </div>
                                        <MoonStar size={24} className="text-slate-400" />
                                    </div>

                                    <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                                        <div>
                                            <p className="text-slate-400">เข้านอน</p>
                                            <p className="mt-1 font-semibold">
                                                {formatClockTime(sleepSummary.actualBedtime)}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-slate-400">ตื่น</p>
                                            <p className="mt-1 font-semibold">
                                                {formatClockTime(sleepSummary.actualWakeTime)}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="mt-4 flex gap-2">
                                        {sleepSummary.status === "SLEEPING" ? (
                                            <button
                                                type="button"
                                                onClick={() => void wakeUp()}
                                                disabled={sleepSaving}
                                                className="flex-1 rounded-xl bg-slate-950 py-2.5 text-xs font-semibold text-white disabled:opacity-60"
                                            >
                                                {sleepSaving ? "กำลังบันทึก..." : "ตื่นแล้ว"}
                                            </button>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={() => void startSleep()}
                                                disabled={sleepSaving}
                                                className="flex-1 rounded-xl bg-slate-950 py-2.5 text-xs font-semibold text-white disabled:opacity-60"
                                            >
                                                {sleepSaving ? "กำลังบันทึก..." : "เริ่มนอน"}
                                            </button>
                                        )}
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
                            >
                                <div className="rounded-2xl bg-slate-50 p-4">
                                    <div className="flex items-end justify-between">
                                        <div>
                                            <p className="text-xs text-slate-400">ค้างชำระเดือนนี้</p>
                                            <p className="mt-1 text-2xl font-bold">
                                                {formatBaht(paymentSummary.remaining)}
                                            </p>
                                        </div>
                                        <WalletCards size={23} className="text-slate-400" />
                                    </div>
                                </div>

                                <div className="mt-4 space-y-2">
                                    {upcomingPayments.length === 0 ? (
                                        <Empty text="ยังไม่มีรายการค่าใช้จ่ายเดือนนี้" />
                                    ) : (
                                        upcomingPayments.map((payment) => (
                                            <PaymentRow
                                                key={payment.id}
                                                payment={payment}
                                                loading={actionId === payment.id}
                                                onToggle={() => void togglePayment(payment)}
                                            />
                                        ))
                                    )}
                                </div>

                                <div className="mt-3 text-xs text-slate-400">
                                    จ่ายแล้ว {paidPayments} / {payments.length} รายการ
                                </div>
                            </SectionCard>

                            <SectionCard
                                eyebrow="OVERDUE"
                                title="งานเลยกำหนด"
                                icon={<Clock3 size={20} />}
                                href="/tasks"
                            >
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
                    <MobileNav icon={<WalletCards size={19} />} label="Payments" href="/payments" />
                    <MobileNav icon={<MoreVertical size={19} />} label="More" href="/settings" />
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
    icon: React.ReactNode;
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
    icon: React.ReactNode;
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
}: {
    eyebrow: string;
    title: string;
    icon: React.ReactNode;
    href: string;
    children: React.ReactNode;
}) {
    return (
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-center justify-between gap-4">
                <div>
                    <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
                        {eyebrow}
                    </p>
                    <h2 className="mt-1 text-xl font-bold">{title}</h2>
                </div>
                <div className="flex items-center gap-3">
                    {icon}
                    <Link
                        href={href}
                        className="text-xs font-semibold text-slate-400 hover:text-slate-950"
                    >
                        ดูทั้งหมด →
                    </Link>
                </div>
            </div>
            <div className="mt-5">{children}</div>
        </section>
    );
}

function CheckButton({
    checked,
    loading,
    onClick,
    label,
}: {
    checked: boolean;
    loading: boolean;
    onClick: () => void;
    label: string;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={loading}
            className="shrink-0 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 disabled:cursor-wait"
            aria-label={label}
            title={label}
        >
            {loading ? (
                <Loader2 size={25} className="animate-spin text-slate-400" />
            ) : checked ? (
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-white transition">
                    <Check size={16} strokeWidth={3} />
                </span>
            ) : (
                <span className="block h-7 w-7 rounded-full border-2 border-slate-200 bg-white transition hover:border-slate-400" />
            )}
        </button>
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
            <CheckButton
                checked={task.completed}
                loading={loading}
                onClick={onToggle}
                label="ทำงานนี้เสร็จ"
            />

            <div className="min-w-0 flex-1">
                <p className={`truncate text-sm font-semibold ${task.completed ? "text-slate-400 line-through" : ""}`}>
                    {task.title}
                </p>
                <div className="mt-1 flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${priority.dot}`} />
                    <span className={`text-xs ${priority.text}`}>{priority.label}</span>
                    {overdue && (
                        <span className="text-xs font-semibold text-red-600">เลยกำหนด</span>
                    )}
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
            <CheckButton
                checked={workout.completed}
                loading={loading}
                onClick={onToggle}
                label="เปลี่ยนสถานะ Workout"
            />

            <div className="min-w-0 flex-1">
                <p className={`truncate text-sm font-semibold ${workout.completed ? "text-slate-400 line-through" : ""}`}>
                    {workout.name}
                </p>
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

function PaymentRow({
    payment,
    loading,
    onToggle,
}: {
    payment: ReturnType<typeof mapPaymentRecord>;
    loading: boolean;
    onToggle: () => void;
}) {
    const paid = payment.status === "paid";

    return (
        <div className="flex items-center gap-3 rounded-xl border border-slate-100 p-3">
            <CheckButton
                checked={paid}
                loading={loading}
                onClick={onToggle}
                label={paid ? "เปลี่ยนเป็นยังไม่จ่าย" : "ทำเครื่องหมายว่าจ่ายแล้ว"}
            />

            <div className="min-w-0 flex-1">
                <p className={`truncate text-sm font-semibold ${paid ? "text-slate-400 line-through" : ""}`}>
                    {payment.note || payment.category}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                    {payment.dueDate
                        ? `ครบกำหนด ${formatShortDate(payment.dueDate)}`
                        : "ไม่ระบุวัน"}
                </p>
            </div>

            <div className="text-right">
                <p className="text-sm font-bold">{formatBaht(payment.amount)}</p>
                <p className={`mt-1 text-[11px] font-semibold ${paid ? "text-emerald-600" : "text-orange-600"}`}>
                    {paid ? "จ่ายแล้ว" : "ยังไม่จ่าย"}
                </p>
            </div>
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