"use client";

import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Dumbbell,
  Home,
  Plus,
  Target,
  TrendingUp,
  MoreVertical,
  Circle,
  Flame,
  MoonStar,
  Loader2,
  WalletCards,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { createClient } from "@/lib/supabase/client";

import {
  formatDurationMinutes,
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
  isOverdue,
  mapGoalRecord,
  type GoalRecord,
} from "@/lib/goals";

import { getSupabaseConfig } from "@/lib/supabase/config";

import {
  serializeSupabaseError,
  supabaseDiagnosticContext,
} from "@/lib/supabase/diagnostics";

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
  high: {
    label: "สูง",
    dot: "bg-red-500",
    text: "text-red-600",
    bg: "bg-red-50",
  },
  medium: {
    label: "กลาง",
    dot: "bg-orange-400",
    text: "text-orange-600",
    bg: "bg-orange-50",
  },
  low: {
    label: "ต่ำ",
    dot: "bg-emerald-500",
    text: "text-emerald-600",
    bg: "bg-emerald-50",
  },
};

export default function HomePage() {
  /*
   * สร้าง Supabase client ครั้งเดียวต่อ component lifecycle
   * ป้องกัน useCallback / useEffect ทำงานใหม่ทุก render
   */
  const supabase = useMemo(() => createClient(), []);

  const [tasks, setTasks] = useState<Task[]>([]);

  const [sleepSettings, setSleepSettings] = useState(() => ({
    targetWakeTime: "06:30",
    targetSleepDurationHours: 8,
    targetBedtime: "22:30",
  }));

  const [sleepLogs, setSleepLogs] = useState<SleepLogRecord[]>([]);
  const [paymentRecords, setPaymentRecords] = useState<PaymentRecord[]>([]);
  const [goalRecords, setGoalRecords] = useState<GoalRecord[]>([]);

  const [sleepLoading, setSleepLoading] = useState(true);
  const [loading, setLoading] = useState(true);

  const [actionId, setActionId] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [sleepError, setSleepError] = useState<string | null>(null);

  const [sleepSaving, setSleepSaving] = useState(false);

  /*
   * ----------------------------------
   * Load Sleep / Payments / Goals
   * ----------------------------------
   */

  const loadSleepData = useCallback(async () => {
    setSleepLoading(true);
    setSleepError(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setSleepSettings({
          targetWakeTime: "06:30",
          targetSleepDurationHours: 8,
          targetBedtime: "22:30",
        });

        setSleepLogs([]);
        setPaymentRecords([]);
        setGoalRecords([]);

        return;
      }

      const context = (operation: string) =>
        supabaseDiagnosticContext(
          operation,
          getSupabaseConfig().projectRef,
          user.id,
          user.email ?? null,
        );

      const [
        settingsResult,
        logsResult,
        paymentResult,
        goalResult,
      ] = await Promise.all([
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
          .from("payment_occurrences")
          .select("*")
          .eq("user_id", user.id)
          .eq(
            "billing_month",
            `${monthKey(new Date())}-01`,
          )
          .order("created_at", { ascending: false }),

        supabase
          .from("goals")
          .select("*")
          .eq("user_id", user.id)
          .order("deadline", {
            ascending: true,
            nullsFirst: false,
          })
          .limit(20),
      ]);

      if (process.env.NODE_ENV !== "production") {
        console.log(
          `Today SELECT sleep_settings ${context(
            "SELECT",
          )} error=${serializeSupabaseError(
            settingsResult.error,
          )}`,
        );

        console.log(
          `Today SELECT sleep_logs ${context(
            "SELECT",
          )} count=${
            logsResult.data?.length ?? 0
          } error=${serializeSupabaseError(
            logsResult.error,
          )}`,
        );

        console.log(
          `Today SELECT payment_occurrences ${context(
            "SELECT",
          )} count=${
            paymentResult.data?.length ?? 0
          } error=${serializeSupabaseError(
            paymentResult.error,
          )}`,
        );

        console.log(
          `Today SELECT goals ${context(
            "SELECT",
          )} count=${
            goalResult.data?.length ?? 0
          } error=${serializeSupabaseError(
            goalResult.error,
          )}`,
        );
      }

      if (settingsResult.error) {
        throw settingsResult.error;
      }

      if (logsResult.error) {
        throw logsResult.error;
      }

      if (paymentResult.error) {
        throw paymentResult.error;
      }

      if (goalResult.error) {
        throw goalResult.error;
      }

      const derivedSettings =
        getSleepSettingsFromRecord(
          settingsResult.data as SleepSettingsRecord | null,
        );

      setSleepSettings(derivedSettings);

      setSleepLogs(
        (logsResult.data ?? []) as SleepLogRecord[],
      );

      setPaymentRecords(
        (paymentResult.data ?? []) as PaymentRecord[],
      );

      setGoalRecords(
        (goalResult.data ?? []) as GoalRecord[],
      );
    } catch (err) {
      if (process.env.NODE_ENV !== "production") {
        console.log(
          `Today aggregation failed error=${serializeSupabaseError(
            err,
          )}`,
        );
      }

      setSleepError(
        err instanceof Error
          ? err.message
          : "ไม่สามารถโหลดข้อมูลการนอนได้",
      );
    } finally {
      setSleepLoading(false);
    }
  }, [supabase]);

  /*
   * ----------------------------------
   * Start Sleep
   * ----------------------------------
   */

  async function startSleep() {
    setSleepSaving(true);
    setSleepError(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error(
          "กรุณาเข้าสู่ระบบก่อนบันทึกเวลานอน",
        );
      }

      const {
        data: existing,
        error: existingError,
      } = await supabase
        .from("sleep_logs")
        .select("id, status")
        .eq("user_id", user.id)
        .eq("status", "sleeping")
        .limit(1);

      if (existingError) {
        throw existingError;
      }

      if (existing && existing.length > 0) {
        return;
      }

      const now = new Date();

      const { error: insertError } =
        await supabase.from("sleep_logs").insert({
          user_id: user.id,
          sleep_date: formatISODate(now),
          bedtime: now.toISOString(),
          wake_time: null,
          duration_minutes: null,
          status: "sleeping",
        });

      if (insertError) {
        throw insertError;
      }

      await loadSleepData();
    } catch (err) {
      setSleepError(
        err instanceof Error
          ? err.message
          : "ไม่สามารถบันทึกเวลานอนได้",
      );
    } finally {
      setSleepSaving(false);
    }
  }

  /*
   * ----------------------------------
   * Wake Up
   * ----------------------------------
   */

  async function wakeUp() {
    setSleepSaving(true);
    setSleepError(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error(
          "กรุณาเข้าสู่ระบบก่อนบันทึกเวลาตื่น",
        );
      }

      const {
        data: activeLogs,
        error: activeError,
      } = await supabase
        .from("sleep_logs")
        .select("id, bedtime, status")
        .eq("user_id", user.id)
        .eq("status", "sleeping")
        .order("created_at", {
          ascending: false,
        })
        .limit(1);

      if (activeError) {
        throw activeError;
      }

      const activeLog = activeLogs?.[0];

      if (
        !activeLog?.id ||
        typeof activeLog.bedtime !== "string"
      ) {
        throw new Error(
          "ยังไม่มีเซสชันการนอนที่กำลังดำเนินอยู่",
        );
      }

      const wakeTime = new Date();
      const bedtime = new Date(
        activeLog.bedtime,
      );

      const durationMinutes = Math.round(
        (wakeTime.getTime() -
          bedtime.getTime()) /
          60000,
      );

      if (
        !Number.isFinite(durationMinutes) ||
        durationMinutes < 0
      ) {
        throw new Error(
          "เวลาเข้านอนและเวลาตื่นไม่ถูกต้อง",
        );
      }

      const { error: updateError } =
        await supabase
          .from("sleep_logs")
          .update({
            wake_time: wakeTime.toISOString(),
            duration_minutes: durationMinutes,
            status: "completed",
            updated_at: wakeTime.toISOString(),
          })
          .eq("id", activeLog.id)
          .eq("user_id", user.id);

      if (updateError) {
        throw updateError;
      }

      await loadSleepData();
    } catch (err) {
      setSleepError(
        err instanceof Error
          ? err.message
          : "ไม่สามารถบันทึกเวลาตื่นได้",
      );
    } finally {
      setSleepSaving(false);
    }
  }

  /*
   * ----------------------------------
   * Load Tasks
   * ----------------------------------
   */

  const loadTasks = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const {
        data,
        error: fetchError,
      } = await supabase
        .from("tasks")
        .select("*")
        .order("created_at", {
          ascending: false,
        });

      if (fetchError) {
        throw fetchError;
      }

      setTasks((data ?? []) as Task[]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "ไม่สามารถโหลดข้อมูลได้",
      );
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  /*
   * ----------------------------------
   * Toggle Task
   * ----------------------------------
   */

  async function toggleTask(task: Task) {
    setActionId(task.id);

    try {
      const {
        data,
        error: updateError,
      } = await supabase
        .from("tasks")
        .update({
          completed: !task.completed,
        })
        .eq("id", task.id)
        .select("*")
        .single();

      if (updateError) {
        throw updateError;
      }

      setTasks((current) =>
        current.map((item) =>
          item.id === task.id
            ? (data as Task)
            : item,
        ),
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "ไม่สามารถเปลี่ยนสถานะงานได้",
      );
    } finally {
      setActionId(null);
    }
  }

  /*
   * ----------------------------------
   * Derived Task Data
   * ----------------------------------
   */

  const total = tasks.length;

  const completed = tasks.filter(
    (task) => task.completed,
  ).length;

  const active = total - completed;

  const completionRate =
    total > 0
      ? Math.round(
          (completed / total) * 100,
        )
      : 0;

  const today = new Date();

  const todayString = formatISODate(today);

  const todayTasks = tasks
    .filter(
      (task) =>
        task.due_date === todayString,
    )
    .sort((a, b) => {
      if (
        a.completed !== b.completed
      ) {
        return (
          Number(a.completed) -
          Number(b.completed)
        );
      }

      const priorityScore = {
        high: 3,
        medium: 2,
        low: 1,
      };

      const aScore =
        priorityScore[
          a.priority === "high" ||
          a.priority === "medium" ||
          a.priority === "low"
            ? a.priority
            : "medium"
        ];

      const bScore =
        priorityScore[
          b.priority === "high" ||
          b.priority === "medium" ||
          b.priority === "low"
            ? b.priority
            : "medium"
        ];

      return bScore - aScore;
    });

  const importantTasks = tasks
    .filter((task) => !task.completed)
    .filter(
      (task) =>
        task.priority === "high" ||
        task.priority === "medium",
    )
    .slice(0, 4);

  const upcomingTasks = tasks
    .filter(
      (task) =>
        !task.completed &&
        task.due_date &&
        task.due_date >= todayString,
    )
    .sort((a, b) => {
      return (
        new Date(
          `${a.due_date}T00:00:00`,
        ).getTime() -
        new Date(
          `${b.due_date}T00:00:00`,
        ).getTime()
      );
    })
    .slice(0, 4);

  const greeting = getGreeting();

  const formattedDate =
    new Intl.DateTimeFormat(
      "th-TH",
      {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      },
    ).format(today);

  const sleepSummary = solveSleepStatus(
    sleepLogs,
    sleepSettings,
  );

  /*
   * ----------------------------------
   * Initial Data Loading
   * ----------------------------------
   *
   * ใช้ setTimeout เพื่อไม่ให้ React
   * มองว่า setState ถูกเรียก synchronously
   * ภายใน effect
   */

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadTasks();
      void loadSleepData();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [loadTasks, loadSleepData]);

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-950">
      <div className="flex min-h-screen">
        {/* Sidebar */}

        <aside className="hidden w-[240px] shrink-0 border-r border-slate-200 bg-white lg:flex lg:flex-col">
          <div className="px-6 py-7">
            <div className="text-lg font-bold tracking-tight">
              PERSONAL OS
            </div>

            <p className="mt-1 text-xs text-slate-400">
              Personal productivity system
            </p>
          </div>

          <nav className="space-y-1 px-3">
            <NavItem
              active
              icon={<Home size={18} />}
              label="Today"
              href="/"
            />

            <NavItem
              icon={<CheckCircle2 size={18} />}
              label="Tasks"
              href="/tasks"
            />

            <NavItem
              icon={<Target size={18} />}
              label="Goals"
              href="/goals"
            />

            <NavItem
              icon={<Dumbbell size={18} />}
              label="Workout"
              href="/workout"
            />

            <NavItem
              icon={<BarChart3 size={18} />}
              label="Progress"
              href="/progress"
            />

            <NavItem
              icon={<WalletCards size={18} />}
              label="Payments"
              href="/payments"
            />
          </nav>

          <div className="mt-auto px-3 pb-6">
            <NavItem
              icon={<MoreVertical size={18} />}
              label="More"
              href="/settings"
            />
          </div>
        </aside>

        {/* Main */}

        <main className="min-w-0 flex-1 pb-24 lg:pb-0">
          <div className="mx-auto max-w-[1280px] px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
            {/* Header */}

            <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                  Personal OS
                </p>

                <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">
                  {greeting}
                </h1>

                <p className="mt-2 text-sm text-slate-500">
                  {formattedDate}
                </p>
              </div>

              <Link
                href="/tasks"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                <Plus size={18} />
                เพิ่มงาน
              </Link>
            </header>

            {/* Error */}

            {error && (
              <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                <p className="font-semibold">
                  ไม่สามารถโหลดข้อมูลได้
                </p>

                <p className="mt-1">
                  {error}
                </p>
              </div>
            )}

            {/* Overview */}

            <section className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <OverviewCard
                icon={
                  <CheckCircle2 size={19} />
                }
                label="งานทั้งหมด"
                value={
                  loading ? "—" : total
                }
                helper={
                  loading
                    ? "กำลังโหลด..."
                    : `${active} งานที่ยังไม่เสร็จ`
                }
              />

              <OverviewCard
                icon={<Clock3 size={19} />}
                label="กำลังทำ"
                value={
                  loading ? "—" : active
                }
                helper="งานที่ยังต้องจัดการ"
              />

              <OverviewCard
                icon={<Check size={19} />}
                label="เสร็จแล้ว"
                value={
                  loading
                    ? "—"
                    : completed
                }
                helper={`${completionRate}% ของงานทั้งหมด`}
              />

              <OverviewCard
                icon={<Flame size={19} />}
                label="Focus"
                value={todayTasks.length}
                helper="งานที่กำหนดไว้วันนี้"
              />
            </section>

            {/* Main Grid */}

            <section className="mt-6 grid gap-6 xl:grid-cols-[1.55fr_0.95fr]">
              {/* Today */}

              <div className="rounded-2xl border border-slate-200 bg-white">
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-5 sm:px-6">
                  <div>
                    <h2 className="text-base font-bold">
                      วันนี้
                    </h2>

                    <p className="mt-1 text-xs text-slate-400">
                      สิ่งที่ควรโฟกัสในวันนี้
                    </p>
                  </div>

                  <Link
                    href="/tasks"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 transition hover:text-slate-950"
                  >
                    ดูทั้งหมด
                    <ArrowRight size={14} />
                  </Link>
                </div>

                <div className="p-4 sm:p-5">
                  {loading ? (
                    <LoadingRows />
                  ) : todayTasks.length ===
                    0 ? (
                    <EmptyToday />
                  ) : (
                    <div className="space-y-2">
                      {todayTasks
                        .slice(0, 5)
                        .map((task) => (
                          <TodayTask
                            key={task.id}
                            task={task}
                            loading={
                              actionId ===
                              task.id
                            }
                            onToggle={() =>
                              toggleTask(task)
                            }
                          />
                        ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Progress */}

              <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">
                      Daily Progress
                    </p>

                    <h2 className="mt-2 text-xl font-bold">
                      วันนี้คุณไปได้
                    </h2>
                  </div>

                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100">
                    <TrendingUp size={19} />
                  </div>
                </div>

                <div className="mt-8 flex items-end gap-3">
                  <span className="text-5xl font-bold tracking-tight">
                    {loading
                      ? "—"
                      : `${completionRate}%`}
                  </span>

                  <span className="mb-1 text-sm text-slate-400">
                    complete
                  </span>
                </div>

                <div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-slate-950 transition-all duration-500"
                    style={{
                      width: `${completionRate}%`,
                    }}
                  />
                </div>

                <div className="mt-4 flex items-center justify-between text-xs">
                  <span className="text-slate-400">
                    {completed} เสร็จแล้ว
                  </span>

                  <span className="font-semibold text-slate-700">
                    {active} เหลืออยู่
                  </span>
                </div>

                <div className="mt-7 grid grid-cols-2 gap-3">
                  <MiniMetric
                    label="วันนี้"
                    value={
                      todayTasks.length
                    }
                  />

                  <MiniMetric
                    label="สำคัญ"
                    value={
                      importantTasks.length
                    }
                  />
                </div>
              </div>
            </section>

            {/* Sleep */}

            <section className="mt-6">
              <SleepCard
                summary={sleepSummary}
                loading={sleepLoading}
                error={sleepError}
                targetWakeTime={
                  sleepSettings.targetWakeTime
                }
                targetBedtime={
                  sleepSettings.targetBedtime
                }
                targetHours={
                  sleepSettings.targetSleepDurationHours
                }
                saving={sleepSaving}
                onStartSleep={() =>
                  void startSleep()
                }
                onWakeUp={() =>
                  void wakeUp()
                }
              />
            </section>

            {/* Payments */}

            <section className="mt-6">
              <PaymentCard
                records={paymentRecords}
                loading={sleepLoading}
                error={sleepError}
              />
            </section>

            {/* Goals */}

            <section className="mt-6">
              <GoalSummaryCard
                records={goalRecords}
                loading={sleepLoading}
                error={sleepError}
              />
            </section>

            {/* Bottom Grid */}

            <section className="mt-6 grid gap-6 lg:grid-cols-2">
              {/* Important */}

              <DashboardSection
                title="งานสำคัญ"
                subtitle="งานที่ควรจัดการก่อน"
                href="/tasks"
              >
                {importantTasks.length ===
                0 ? (
                  <SimpleEmpty
                    title="ไม่มีงานสำคัญ"
                    description="ตอนนี้คุณไม่มีงานเร่งด่วน"
                  />
                ) : (
                  <div className="space-y-2">
                    {importantTasks.map(
                      (task) => (
                        <CompactTask
                          key={task.id}
                          task={task}
                          loading={
                            actionId ===
                            task.id
                          }
                          onToggle={() =>
                            toggleTask(task)
                          }
                        />
                      ),
                    )}
                  </div>
                )}
              </DashboardSection>

              {/* Upcoming */}

              <DashboardSection
                title="กำลังจะถึง"
                subtitle="งานที่มีวันครบกำหนด"
                href="/tasks"
              >
                {upcomingTasks.length ===
                0 ? (
                  <SimpleEmpty
                    title="ยังไม่มีงานที่กำลังจะถึง"
                    description="เพิ่มวันครบกำหนดให้กับงานของคุณ"
                  />
                ) : (
                  <div className="space-y-2">
                    {upcomingTasks.map(
                      (task) => (
                        <UpcomingTask
                          key={task.id}
                          task={task}
                        />
                      ),
                    )}
                  </div>
                )}
              </DashboardSection>
            </section>

            {/* Quick Actions */}

            <section className="mt-6">
              <div className="mb-3">
                <h2 className="text-sm font-bold">
                  Quick Actions
                </h2>

                <p className="mt-1 text-xs text-slate-400">
                  ไปยังส่วนที่คุณใช้งานบ่อย
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <QuickAction
                  icon={
                    <CheckCircle2 size={19} />
                  }
                  title="จัดการ Tasks"
                  description="ดูและจัดการงานทั้งหมด"
                  href="/tasks"
                />

                <QuickAction
                  icon={<Target size={19} />}
                  title="Goals"
                  description="ดูเป้าหมายของคุณ"
                  href="/goals"
                />

                <QuickAction
                  icon={
                    <Dumbbell size={19} />
                  }
                  title="Workout"
                  description="เปิดตารางออกกำลังกาย"
                  href="/workout"
                />

                <QuickAction
                  icon={
                    <BarChart3 size={19} />
                  }
                  title="Progress"
                  description="ดูพัฒนาการของคุณ"
                  href="/progress"
                />
              </div>
            </section>
          </div>
        </main>
      </div>

      {/* Mobile Navigation */}

      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-200 bg-white/95 px-3 py-2 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-lg items-center justify-around">
          <MobileNav
            active
            icon={<Home size={19} />}
            label="Today"
            href="/"
          />

          <MobileNav
            icon={
              <CheckCircle2 size={19} />
            }
            label="Tasks"
            href="/tasks"
          />

          <MobileNav
            icon={<Target size={19} />}
            label="Goals"
            href="/goals"
          />

          <MobileNav
            icon={<Dumbbell size={19} />}
            label="Workout"
            href="/workout"
          />

          <MobileNav
            icon={<BarChart3 size={19} />}
            label="Progress"
            href="/progress"
          />
        </div>
      </nav>
    </div>
  );
}

/* ---------------------------------- */
/* Sidebar */
/* ---------------------------------- */

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
      <span>{label}</span>
    </Link>
  );
}

/* ---------------------------------- */
/* Overview */
/* ---------------------------------- */

function OverviewCard({
  icon,
  label,
  value,
  helper,
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
  helper: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
          {icon}
        </div>
      </div>

      <p className="mt-5 text-xs font-medium text-slate-400">
        {label}
      </p>

      <p className="mt-1 text-3xl font-bold tracking-tight">
        {value}
      </p>

      <p className="mt-2 text-xs text-slate-400">
        {helper}
      </p>
    </div>
  );
}

/* ---------------------------------- */
/* Today Task */
/* ---------------------------------- */

function TodayTask({
  task,
  loading,
  onToggle,
}: {
  task: Task;
  loading: boolean;
  onToggle: () => void;
}) {
  const priority =
    priorityConfig[
      task.priority === "high" ||
      task.priority === "medium" ||
      task.priority === "low"
        ? task.priority
        : "medium"
    ];

  return (
    <div
      className={`flex items-center gap-3 rounded-xl border p-3 transition ${
        task.completed
          ? "border-emerald-100 bg-emerald-50/30"
          : "border-slate-100 hover:border-slate-200 hover:bg-slate-50/60"
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        disabled={loading}
        className="shrink-0"
        aria-label="เปลี่ยนสถานะงาน"
      >
        {loading ? (
          <span className="block h-5 w-5 animate-pulse rounded-full bg-slate-200" />
        ) : task.completed ? (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white">
            <Check
              size={12}
              strokeWidth={3}
            />
          </span>
        ) : (
          <Circle
            size={21}
            strokeWidth={1.5}
            className="text-slate-300"
          />
        )}
      </button>

      <div className="min-w-0 flex-1">
        <p
          className={`truncate text-sm font-medium ${
            task.completed
              ? "text-slate-400 line-through"
              : "text-slate-800"
          }`}
        >
          {task.title}
        </p>

        <div className="mt-1 flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 text-[11px] font-medium ${priority.text}`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${priority.dot}`}
            />

            {priority.label}
          </span>

          {task.due_date && (
            <>
              <span className="text-slate-200">
                •
              </span>

              <span className="text-[11px] text-slate-400">
                วันนี้
              </span>
            </>
          )}
        </div>
      </div>

      <MoreVertical
        size={17}
        className="shrink-0 text-slate-300"
      />
    </div>
  );
}

/* ---------------------------------- */
/* Compact Task */
/* ---------------------------------- */

function CompactTask({
  task,
  loading,
  onToggle,
}: {
  task: Task;
  loading: boolean;
  onToggle: () => void;
}) {
  const priority =
    priorityConfig[
      task.priority === "high" ||
      task.priority === "medium" ||
      task.priority === "low"
        ? task.priority
        : "medium"
    ];

  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-100 p-3 hover:bg-slate-50">
      <button
        type="button"
        onClick={onToggle}
        disabled={loading}
        className="shrink-0"
      >
        {task.completed ? (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white">
            <Check
              size={12}
              strokeWidth={3}
            />
          </span>
        ) : (
          <Circle
            size={21}
            strokeWidth={1.5}
            className="text-slate-300"
          />
        )}
      </button>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-800">
          {task.title}
        </p>

        <div className="mt-1 flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 text-[11px] font-medium ${priority.text}`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${priority.dot}`}
            />

            {priority.label}
          </span>
        </div>
      </div>

      <ChevronRight
        size={16}
        className="text-slate-300"
      />
    </div>
  );
}

/* ---------------------------------- */
/* Upcoming */
/* ---------------------------------- */

function UpcomingTask({
  task,
}: {
  task: Task;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-100 p-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100">
        <CalendarDays
          size={17}
          className="text-slate-500"
        />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-800">
          {task.title}
        </p>

        <p className="mt-1 text-[11px] text-slate-400">
          {task.due_date
            ? formatDate(task.due_date)
            : "ไม่กำหนดวัน"}
        </p>
      </div>

      <ChevronRight
        size={16}
        className="text-slate-300"
      />
    </div>
  );
}

/* ---------------------------------- */
/* Dashboard Section */
/* ---------------------------------- */

function DashboardSection({
  title,
  subtitle,
  href,
  children,
}: {
  title: string;
  subtitle: string;
  href: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h2 className="text-base font-bold">
            {title}
          </h2>

          <p className="mt-1 text-xs text-slate-400">
            {subtitle}
          </p>
        </div>

        <Link
          href={href}
          className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-800"
          aria-label={`ไปยัง ${title}`}
        >
          <ArrowRight size={17} />
        </Link>
      </div>

      {children}
    </div>
  );
}

/* ---------------------------------- */
/* Quick Action */
/* ---------------------------------- */

function QuickAction({
  icon,
  title,
  description,
  href,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-2xl border border-slate-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-sm"
    >
      <div className="flex items-center justify-between">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-700 transition group-hover:bg-slate-950 group-hover:text-white">
          {icon}
        </div>

        <ArrowRight
          size={16}
          className="text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-slate-700"
        />
      </div>

      <h3 className="mt-4 text-sm font-semibold">
        {title}
      </h3>

      <p className="mt-1 text-xs text-slate-400">
        {description}
      </p>
    </Link>
  );
}

/* ---------------------------------- */
/* Sleep Card */
/* ---------------------------------- */

function SleepCard({
  summary,
  loading,
  error,
  targetWakeTime,
  targetBedtime,
  targetHours,
  saving,
  onStartSleep,
  onWakeUp,
}: {
  summary: ReturnType<
    typeof solveSleepStatus
  >;
  loading: boolean;
  error: string | null;
  targetWakeTime: string;
  targetBedtime: string;
  targetHours: number;
  saving: boolean;
  onStartSleep: () => void;
  onWakeUp: () => void;
}) {
  const statusText =
    summary.status === "NO_SLEEP"
      ? "รอการบันทึก"
      : summary.status === "SLEEPING"
        ? "เข้านอนแล้ว"
        : `ตื่นแล้ว • ${formatDurationMinutes(
            summary.durationMinutes,
          )}`;

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#edf4ff] text-[#2452c5]">
            <MoonStar size={20} />
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
              SLEEP
            </p>

            <h3 className="mt-1 text-xl font-bold">
              {statusText}
            </h3>
          </div>
        </div>

        <Link
          href="/sleep"
          className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-2.5 py-2 text-xs font-semibold text-slate-700"
        >
          จัดการ
          <ArrowRight size={14} />
        </Link>
      </div>

      {error ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          {error}
        </div>
      ) : loading ? (
        <div className="mt-5 space-y-3">
          <div className="h-4 w-1/3 animate-pulse rounded bg-slate-100" />

          <div className="h-9 w-2/3 animate-pulse rounded bg-slate-100" />
        </div>
      ) : summary.status ===
        "NO_SLEEP" ? (
        <div className="mt-5 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <MiniSleepItem
              label="เป้าหมายตื่น"
              value={targetWakeTime}
            />

            <MiniSleepItem
              label="เป้าหมายเข้านอน"
              value={targetBedtime}
            />
          </div>

          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            สถานะ: รอการบันทึก
          </div>

          <button
            type="button"
            onClick={onStartSleep}
            disabled={saving}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#2452c5] px-4 py-4 text-base font-semibold text-white transition hover:bg-[#1d45ac] disabled:cursor-wait disabled:opacity-60"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MoonStar size={17} />
            )}

            เข้านอน
          </button>
        </div>
      ) : summary.status ===
        "SLEEPING" ? (
        <div className="mt-5 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <MiniSleepItem
              label="เข้านอนแล้ว"
              value={
                summary.actualBedtime ??
                "—"
              }
            />

            <MiniSleepItem
              label="เป้าหมายตื่น"
              value={targetWakeTime}
            />
          </div>

          <div className="flex items-center justify-between rounded-2xl bg-[#edf4ff] px-4 py-3 text-sm font-medium text-[#2452c5]">
            <span>กำลังนอน</span>

            <button
              type="button"
              onClick={onWakeUp}
              disabled={saving}
              className="inline-flex items-center gap-2 font-semibold disabled:cursor-wait disabled:opacity-60"
            >
              {saving && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}

              ตื่นแล้ว
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <MiniSleepItem
              label="นอน"
              value={formatDurationMinutes(
                summary.durationMinutes,
              )}
            />

            <MiniSleepItem
              label="เข้านอน"
              value={
                summary.actualBedtime ??
                targetBedtime
              }
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <MiniSleepItem
              label="ตื่น"
              value={
                summary.actualWakeTime ??
                targetWakeTime
              }
            />

            <MiniSleepItem
              label="เป้าหมาย"
              value={`${targetHours} ชม.`}
            />
          </div>

          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
            {summary.durationStatusLabel}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------- */
/* Payment Card */
/* ---------------------------------- */

function PaymentCard({
  records,
  loading,
  error,
}: {
  records: PaymentRecord[];
  loading: boolean;
  error: string | null;
}) {
  const summary =
    calculatePaymentSummary(
      records.map(mapPaymentRecord),
    );

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
            PAYMENTS
          </p>

          <h3 className="mt-1 text-xl font-bold">
            ค่าใช้จ่ายเดือนนี้
          </h3>
        </div>

        <Link
          href="/payments"
          className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-2.5 py-2 text-xs font-semibold text-slate-700"
        >
          ดูรายละเอียด
          <ArrowRight size={14} />
        </Link>
      </div>

      {error ? (
        <p className="mt-4 rounded-xl bg-red-50 p-3 text-xs text-red-700">
          ไม่สามารถโหลดข้อมูลค่าใช้จ่ายได้
        </p>
      ) : loading ? (
        <div className="mt-5 h-16 animate-pulse rounded-2xl bg-slate-100" />
      ) : (
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <MiniSleepItem
            label="ยอดรวม"
            value={formatBaht(
              summary.totalDue,
            )}
          />

          <MiniSleepItem
            label="จ่ายแล้ว"
            value={formatBaht(
              summary.paidAmount,
            )}
          />

          <MiniSleepItem
            label="คงเหลือ"
            value={formatBaht(
              summary.remaining,
            )}
          />
        </div>
      )}
    </div>
  );
}

/* ---------------------------------- */
/* Goal Summary */
/* ---------------------------------- */

function GoalSummaryCard({
  records,
  loading,
  error,
}: {
  records: GoalRecord[];
  loading: boolean;
  error: string | null;
}) {
  const goals = records.map(mapGoalRecord);

  const activeGoals = goals.filter(
    (goal) =>
      goal.status === "in_progress",
  );

  const nearest = goals
    .filter((goal) => !isOverdue(goal))
    .find((goal) => goal.deadline);

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
            GOALS
          </p>

          <h3 className="mt-1 text-xl font-bold">
            เป้าหมายของคุณ
          </h3>
        </div>

        <Link
          href="/goals"
          className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-2.5 py-2 text-xs font-semibold text-slate-700"
        >
          ดูทั้งหมด
          <ArrowRight size={14} />
        </Link>
      </div>

      {error ? (
        <p className="mt-4 rounded-xl bg-red-50 p-3 text-xs text-red-700">
          ไม่สามารถโหลดเป้าหมายได้
        </p>
      ) : loading ? (
        <div className="mt-5 h-16 animate-pulse rounded-2xl bg-slate-100" />
      ) : (
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <MiniSleepItem
            label="กำลังทำ"
            value={String(
              activeGoals.length,
            )}
          />

          <MiniSleepItem
            label="Progress เฉลี่ย"
            value={`${averageGoalProgress(
              goals,
            )}%`}
          />

          <MiniSleepItem
            label="กำหนดใกล้สุด"
            value={
              nearest?.deadline ?? "—"
            }
          />
        </div>
      )}
    </div>
  );
}

/* ---------------------------------- */
/* Mini Sleep Item */
/* ---------------------------------- */

function MiniSleepItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">
        {label}
      </p>

      <p className="mt-2 text-lg font-bold text-slate-900">
        {value}
      </p>
    </div>
  );
}

/* ---------------------------------- */
/* Mini Metric */
/* ---------------------------------- */

function MiniMetric({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <p className="text-[11px] text-slate-400">
        {label}
      </p>

      <p className="mt-1 text-lg font-bold">
        {value}
      </p>
    </div>
  );
}

/* ---------------------------------- */
/* Empty */
/* ---------------------------------- */

function EmptyToday() {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 px-5 py-10 text-center">
      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-slate-100">
        <CheckCircle2
          size={21}
          className="text-slate-400"
        />
      </div>

      <h3 className="mt-3 text-sm font-semibold">
        วันนี้ยังไม่มีงาน
      </h3>

      <p className="mt-1 text-xs text-slate-400">
        วันนี้เป็นวันที่ดีสำหรับการเริ่มต้น
      </p>

      <Link
        href="/tasks"
        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-semibold text-white"
      >
        <Plus size={15} />
        เพิ่มงาน
      </Link>
    </div>
  );
}

/* ---------------------------------- */
/* Simple Empty */
/* ---------------------------------- */

function SimpleEmpty({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 px-5 py-8 text-center">
      <p className="text-sm font-semibold text-slate-700">
        {title}
      </p>

      <p className="mt-1 text-xs text-slate-400">
        {description}
      </p>
    </div>
  );
}

/* ---------------------------------- */
/* Loading Rows */
/* ---------------------------------- */

function LoadingRows() {
  return (
    <div className="space-y-2">
      {[1, 2, 3].map((item) => (
        <div
          key={item}
          className="flex items-center gap-3 rounded-xl border border-slate-100 p-3"
        >
          <div className="h-5 w-5 animate-pulse rounded-full bg-slate-100" />

          <div className="flex-1">
            <div className="h-3 w-2/5 animate-pulse rounded bg-slate-100" />

            <div className="mt-2 h-2 w-1/5 animate-pulse rounded bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------------------------------- */
/* Mobile Nav */
/* ---------------------------------- */

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
        active
          ? "font-semibold text-slate-950"
          : "text-slate-400"
      }`}
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
}

/* ---------------------------------- */
/* Helpers */
/* ---------------------------------- */

function getGreeting() {
  const hour = new Date().getHours();

  if (hour < 5) {
    return "ดึกแล้วนะ";
  }

  if (hour < 12) {
    return "สวัสดีตอนเช้า";
  }

  if (hour < 17) {
    return "สวัสดีตอนบ่าย";
  }

  if (hour < 21) {
    return "สวัสดีตอนเย็น";
  }

  return "สวัสดีตอนค่ำ";
}

function formatISODate(date: Date) {
  const year = date.getFullYear();

  const month = String(
    date.getMonth() + 1,
  ).padStart(2, "0");

  const day = String(
    date.getDate(),
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat(
    "th-TH",
    {
      weekday: "short",
      day: "numeric",
      month: "short",
    },
  ).format(
    new Date(`${date}T00:00:00`),
  );
}