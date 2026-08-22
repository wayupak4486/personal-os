"use client";

import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  Dumbbell,
  Flame,
  Loader2,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createClient } from "@/lib/supabase/client";
import {
  mapWorkoutRecord,
  type WorkoutRecord,
  type WorkoutSession,
} from "@/lib/workout";

const supabase = createClient();

type WorkoutForm = {
  name: string;
  category: string;
  workoutDate: string;
  scheduledTime: string;
  exerciseCount: string;
  durationMinutes: string;
  calories: string;
};

const defaultForm = (): WorkoutForm => ({
  name: "",
  category: "เวทเทรนนิ่ง",
  workoutDate: formatISODate(new Date()),
  scheduledTime: "",
  exerciseCount: "",
  durationMinutes: "",
  calories: "",
});

const categories = [
  "เวทเทรนนิ่ง",
  "คาร์ดิโอ",
  "วิ่ง",
  "เดิน",
  "ยืดเหยียด",
  "กีฬา",
  "อื่น ๆ",
];

export default function WorkoutPage() {
  const [workouts, setWorkouts] = useState<WorkoutSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<WorkoutForm>(() => defaultForm());

  const todayString = formatISODate(new Date());

  /*
   * Load workouts
   *
   * ใช้ effect สำหรับ subscribe/load ข้อมูลจาก Supabase
   * และไม่เรียก function ที่ setState แบบ synchronous จาก effect โดยตรง
   */
  useEffect(() => {
    let cancelled = false;

    async function fetchWorkouts() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          if (!cancelled) {
            setWorkouts([]);
            setLoading(false);
          }
          return;
        }

        const { data, error: fetchError } = await supabase
          .from("workout_sessions")
          .select("*")
          .eq("user_id", user.id)
          .order("workout_date", { ascending: false })
          .order("scheduled_time", { ascending: true })
          .order("created_at", { ascending: false })
          .limit(50);

        if (fetchError) {
          throw fetchError;
        }

        if (!cancelled) {
          setWorkouts(
            ((data ?? []) as WorkoutRecord[]).map(mapWorkoutRecord),
          );
          setError(null);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "ไม่สามารถโหลดข้อมูล Workout ได้",
          );
          setLoading(false);
        }
      }
    }

    void fetchWorkouts();

    return () => {
      cancelled = true;
    };
  }, []);

  const todayWorkouts = useMemo(
    () =>
      workouts.filter(
        (workout) => workout.date === todayString,
      ),
    [workouts, todayString],
  );

  const upcomingWorkouts = useMemo(
    () =>
      workouts
        .filter((workout) => workout.date > todayString)
        .sort((a, b) => {
          const dateCompare = a.date.localeCompare(b.date);

          if (dateCompare !== 0) {
            return dateCompare;
          }

          return (a.scheduledTime ?? "").localeCompare(
            b.scheduledTime ?? "",
          );
        }),
    [workouts, todayString],
  );

  const completedCount = workouts.filter(
    (workout) => workout.completed,
  ).length;

  const totalDuration = workouts.reduce(
    (sum, workout) =>
      sum + (workout.durationMinutes ?? 0),
    0,
  );

  const totalCalories = workouts.reduce(
    (sum, workout) =>
      sum + (workout.calories ?? 0),
    0,
  );

  async function handleCreateWorkout(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!form.name.trim()) {
      setError("กรุณาใส่ชื่อ Workout");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error(
          "กรุณาเข้าสู่ระบบก่อนสร้าง Workout",
        );
      }

      const exerciseCount = parseOptionalNumber(
        form.exerciseCount,
      );

      const durationMinutes = parseOptionalNumber(
        form.durationMinutes,
      );

      const calories = parseOptionalNumber(form.calories);

      const { error: insertError } = await supabase
        .from("workout_sessions")
        .insert({
          user_id: user.id,
          workout_date: form.workoutDate,
          name: form.name.trim(),
          category: form.category || null,
          scheduled_time: form.scheduledTime || null,
          exercise_count: exerciseCount,
          completed: false,
          completed_at: null,
          duration_minutes: durationMinutes,
          calories,
        });

      if (insertError) {
        throw insertError;
      }

      setForm(defaultForm());
      setShowForm(false);

      /*
       * Reload หลังจากสร้างสำเร็จ
       * เพื่อดึงข้อมูลล่าสุดจาก Supabase
       */
      window.location.reload();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "ไม่สามารถสร้าง Workout ได้",
      );
      setSaving(false);
    }
  }

  async function toggleComplete(
    workout: WorkoutSession,
  ) {
    setActionId(workout.id);
    setError(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error(
          "กรุณาเข้าสู่ระบบก่อนแก้ไข Workout",
        );
      }

      const now = new Date();

      const nextCompleted = !workout.completed;

      const { error: updateError } = await supabase
        .from("workout_sessions")
        .update({
          completed: nextCompleted,
          completed_at: nextCompleted
            ? now.toISOString()
            : null,
          updated_at: now.toISOString(),
        })
        .eq("id", workout.id)
        .eq("user_id", user.id);

      if (updateError) {
        throw updateError;
      }

      setWorkouts((current) =>
        current.map((item) =>
          item.id === workout.id
            ? {
                ...item,
                completed: nextCompleted,
                completedAt: nextCompleted
                  ? now.toISOString()
                  : null,
              }
            : item,
        ),
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "ไม่สามารถเปลี่ยนสถานะ Workout ได้",
      );
    } finally {
      setActionId(null);
    }
  }

  async function deleteWorkout(
    workout: WorkoutSession,
  ) {
    const confirmed = window.confirm(
      `ต้องการลบ "${workout.name}" ใช่หรือไม่?`,
    );

    if (!confirmed) {
      return;
    }

    setActionId(workout.id);
    setError(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error(
          "กรุณาเข้าสู่ระบบก่อนลบ Workout",
        );
      }

      const { error: deleteError } = await supabase
        .from("workout_sessions")
        .delete()
        .eq("id", workout.id)
        .eq("user_id", user.id);

      if (deleteError) {
        throw deleteError;
      }

      setWorkouts((current) =>
        current.filter(
          (item) => item.id !== workout.id,
        ),
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "ไม่สามารถลบ Workout ได้",
      );
    } finally {
      setActionId(null);
    }
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-950">
      <main className="mx-auto max-w-[1180px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {/* Header */}

        <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link
              href="/"
              className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 transition hover:text-slate-900"
            >
              <ArrowLeft size={14} />
              กลับหน้า Today
            </Link>

            <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
              WORKOUT
            </p>

            <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">
              ออกกำลังกาย
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              วางแผนและติดตามการออกกำลังกายของคุณ
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setError(null);
              setForm(defaultForm());
              setShowForm(true);
            }}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            <Plus size={18} />
            เพิ่ม Workout
          </button>
        </header>

        {/* Error */}

        {error && (
          <div className="mt-6 flex items-start justify-between gap-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <div>
              <p className="font-semibold">
                เกิดข้อผิดพลาด
              </p>

              <p className="mt-1">{error}</p>
            </div>

            <button
              type="button"
              onClick={() => setError(null)}
              className="shrink-0 rounded-lg p-1 hover:bg-red-100"
              aria-label="ปิดข้อความ"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Stats */}

        <section className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={<Dumbbell size={19} />}
            label="Workout ทั้งหมด"
            value={
              loading
                ? "—"
                : String(workouts.length)
            }
            helper="รายการทั้งหมด"
          />

          <StatCard
            icon={<CheckCircle2 size={19} />}
            label="เสร็จแล้ว"
            value={
              loading
                ? "—"
                : String(completedCount)
            }
            helper="Workout ที่ทำสำเร็จ"
          />

          <StatCard
            icon={<Clock3 size={19} />}
            label="เวลารวม"
            value={
              loading
                ? "—"
                : formatTotalMinutes(totalDuration)
            }
            helper="จากข้อมูลที่บันทึก"
          />

          <StatCard
            icon={<Flame size={19} />}
            label="Calories"
            value={
              loading
                ? "—"
                : formatNumber(totalCalories)
            }
            helper="พลังงานรวม"
          />
        </section>

        {/* Add Form */}

        {showForm && (
          <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                  NEW WORKOUT
                </p>

                <h2 className="mt-1 text-xl font-bold">
                  เพิ่ม Workout
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-800"
                aria-label="ปิด"
              >
                <X size={19} />
              </button>
            </div>

            <form
              onSubmit={handleCreateWorkout}
              className="mt-6 space-y-5"
            >
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  label="ชื่อ Workout"
                  required
                >
                  <input
                    value={form.name}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    placeholder="เช่น Upper Body"
                    className={inputClass}
                  />
                </FormField>

                <FormField label="ประเภท">
                  <select
                    value={form.category}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        category: event.target.value,
                      }))
                    }
                    className={inputClass}
                  >
                    {categories.map((category) => (
                      <option
                        key={category}
                        value={category}
                      >
                        {category}
                      </option>
                    ))}
                  </select>
                </FormField>

                <FormField label="วันที่">
                  <input
                    type="date"
                    value={form.workoutDate}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        workoutDate:
                          event.target.value,
                      }))
                    }
                    className={inputClass}
                  />
                </FormField>

                <FormField label="เวลาที่กำหนด">
                  <input
                    type="time"
                    value={form.scheduledTime}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        scheduledTime:
                          event.target.value,
                      }))
                    }
                    className={inputClass}
                  />
                </FormField>

                <FormField label="จำนวนท่า">
                  <input
                    type="number"
                    min="0"
                    value={form.exerciseCount}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        exerciseCount:
                          event.target.value,
                      }))
                    }
                    placeholder="เช่น 6"
                    className={inputClass}
                  />
                </FormField>

                <FormField label="ระยะเวลา (นาที)">
                  <input
                    type="number"
                    min="0"
                    value={form.durationMinutes}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        durationMinutes:
                          event.target.value,
                      }))
                    }
                    placeholder="เช่น 60"
                    className={inputClass}
                  />
                </FormField>

                <FormField label="Calories">
                  <input
                    type="number"
                    min="0"
                    value={form.calories}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        calories:
                          event.target.value,
                      }))
                    }
                    placeholder="เช่น 450"
                    className={inputClass}
                  />
                </FormField>
              </div>

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="h-11 rounded-xl border border-slate-200 px-5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                  ยกเลิก
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-wait disabled:opacity-60"
                >
                  {saving && (
                    <Loader2
                      size={16}
                      className="animate-spin"
                    />
                  )}

                  บันทึก Workout
                </button>
              </div>
            </form>
          </section>
        )}

        {/* Today */}

        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                TODAY
              </p>

              <h2 className="mt-1 text-xl font-bold">
                Workout วันนี้
              </h2>

              <p className="mt-1 text-xs text-slate-400">
                {formatThaiDate(todayString)}
              </p>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100">
              <Dumbbell
                size={20}
                className="text-slate-700"
              />
            </div>
          </div>

          <div className="mt-6">
            {loading ? (
              <WorkoutLoading />
            ) : todayWorkouts.length === 0 ? (
              <EmptyWorkout
                title="วันนี้ยังไม่มี Workout"
                description="เพิ่ม Workout เพื่อเริ่มติดตามการออกกำลังกาย"
                onAdd={() => {
                  setForm(defaultForm());
                  setShowForm(true);
                }}
              />
            ) : (
              <div className="space-y-3">
                {todayWorkouts.map((workout) => (
                  <WorkoutRow
                    key={workout.id}
                    workout={workout}
                    actionLoading={
                      actionId === workout.id
                    }
                    onToggle={() =>
                      void toggleComplete(workout)
                    }
                    onDelete={() =>
                      void deleteWorkout(workout)
                    }
                  />
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Upcoming */}

        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
              UPCOMING
            </p>

            <h2 className="mt-1 text-xl font-bold">
              Workout ที่กำลังจะถึง
            </h2>
          </div>

          <div className="mt-6">
            {loading ? (
              <WorkoutLoading />
            ) : upcomingWorkouts.length === 0 ? (
              <SimpleEmpty
                title="ยังไม่มี Workout ที่กำลังจะถึง"
                description="เพิ่ม Workout ในวันถัดไปเพื่อวางแผนล่วงหน้า"
              />
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                {upcomingWorkouts.map((workout) => (
                  <WorkoutRow
                    key={workout.id}
                    workout={workout}
                    actionLoading={
                      actionId === workout.id
                    }
                    onToggle={() =>
                      void toggleComplete(workout)
                    }
                    onDelete={() =>
                      void deleteWorkout(workout)
                    }
                  />
                ))}
              </div>
            )}
          </div>
        </section>

        {/* All */}

        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                ALL WORKOUTS
              </p>

              <h2 className="mt-1 text-xl font-bold">
                Workout ทั้งหมด
              </h2>
            </div>

            {!loading && (
              <span className="text-xs font-medium text-slate-400">
                {workouts.length} รายการ
              </span>
            )}
          </div>

          <div className="mt-6">
            {loading ? (
              <WorkoutLoading />
            ) : workouts.length === 0 ? (
              <SimpleEmpty
                title="ยังไม่มีข้อมูล Workout"
                description="สร้าง Workout แรกของคุณได้เลย"
              />
            ) : (
              <div className="space-y-3">
                {workouts.map((workout) => (
                  <WorkoutRow
                    key={workout.id}
                    workout={workout}
                    actionLoading={
                      actionId === workout.id
                    }
                    onToggle={() =>
                      void toggleComplete(workout)
                    }
                    onDelete={() =>
                      void deleteWorkout(workout)
                    }
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

/* ---------------------------------- */
/* Stat */
/* ---------------------------------- */

function StatCard({
  icon,
  label,
  value,
  helper,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-sm">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
        {icon}
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
/* Workout Row */
/* ---------------------------------- */

function WorkoutRow({
  workout,
  actionLoading,
  onToggle,
  onDelete,
}: {
  workout: WorkoutSession;
  actionLoading: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 transition ${
        workout.completed
          ? "border-emerald-100 bg-emerald-50/30"
          : "border-slate-100 hover:border-slate-200 hover:bg-slate-50/50"
      }`}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={onToggle}
          disabled={actionLoading}
          className="mt-0.5 shrink-0"
          aria-label={
            workout.completed
              ? "ยกเลิกสถานะเสร็จ"
              : "ทำ Workout ให้เสร็จ"
          }
        >
          {actionLoading ? (
            <span className="flex h-6 w-6 items-center justify-center">
              <Loader2
                size={19}
                className="animate-spin text-slate-400"
              />
            </span>
          ) : workout.completed ? (
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white">
              <Check
                size={14}
                strokeWidth={3}
              />
            </span>
          ) : (
            <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-slate-300 bg-white transition hover:border-slate-500">
              <span className="h-2 w-2 rounded-full bg-transparent" />
            </span>
          )}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h3
                className={`truncate text-sm font-bold ${
                  workout.completed
                    ? "text-slate-400 line-through"
                    : "text-slate-800"
                }`}
              >
                {workout.name}
              </h3>

              <p className="mt-1 text-xs text-slate-400">
                {workout.category}
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-400">
              <CalendarDays size={14} />

              <span>
                {formatThaiDate(workout.date)}
              </span>

              {workout.scheduledTime && (
                <>
                  <span className="text-slate-200">
                    •
                  </span>

                  <Clock3 size={14} />

                  <span>
                    {formatTime(
                      workout.scheduledTime,
                    )}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {workout.exerciseCount !== null && (
              <InfoChip
                label={`${workout.exerciseCount} ท่า`}
              />
            )}

            {workout.durationMinutes !== null && (
              <InfoChip
                label={`${workout.durationMinutes} นาที`}
              />
            )}

            {workout.calories !== null && (
              <InfoChip
                label={`${formatNumber(
                  workout.calories,
                )} kcal`}
              />
            )}

            {workout.completed && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                <Check size={12} />
                เสร็จแล้ว
              </span>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={onDelete}
          disabled={actionLoading}
          className="shrink-0 rounded-lg p-2 text-slate-300 transition hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
          aria-label="ลบ Workout"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}

/* ---------------------------------- */
/* Form */
/* ---------------------------------- */

function FormField({
  label,
  required = false,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold text-slate-600">
        {label}

        {required && (
          <span className="ml-1 text-red-500">
            *
          </span>
        )}
      </span>

      {children}
    </label>
  );
}

const inputClass =
  "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-300 focus:border-slate-400 focus:ring-2 focus:ring-slate-100";

/* ---------------------------------- */
/* Small UI */
/* ---------------------------------- */

function InfoChip({
  label,
}: {
  label: string;
}) {
  return (
    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-500">
      {label}
    </span>
  );
}

function EmptyWorkout({
  title,
  description,
  onAdd,
}: {
  title: string;
  description: string;
  onAdd: () => void;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 px-5 py-10 text-center">
      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-slate-100">
        <Dumbbell
          size={20}
          className="text-slate-400"
        />
      </div>

      <h3 className="mt-3 text-sm font-semibold">
        {title}
      </h3>

      <p className="mt-1 text-xs text-slate-400">
        {description}
      </p>

      <button
        type="button"
        onClick={onAdd}
        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-slate-800"
      >
        <Plus size={15} />
        เพิ่ม Workout
      </button>
    </div>
  );
}

function SimpleEmpty({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 px-5 py-8 text-center">
      <p className="text-sm font-semibold text-slate-700">
        {title}
      </p>

      <p className="mt-1 text-xs text-slate-400">
        {description}
      </p>
    </div>
  );
}

function WorkoutLoading() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((item) => (
        <div
          key={item}
          className="flex items-center gap-3 rounded-2xl border border-slate-100 p-4"
        >
          <div className="h-6 w-6 animate-pulse rounded-full bg-slate-100" />

          <div className="flex-1">
            <div className="h-3 w-2/5 animate-pulse rounded bg-slate-100" />

            <div className="mt-2 h-2 w-1/4 animate-pulse rounded bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------------------------------- */
/* Helpers */
/* ---------------------------------- */

function parseOptionalNumber(value: string) {
  if (!value.trim()) {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Math.max(0, Math.round(parsed));
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("th-TH").format(
    value,
  );
}

function formatTotalMinutes(minutes: number) {
  if (minutes <= 0) {
    return "0 นาที";
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours === 0) {
    return `${remainingMinutes} นาที`;
  }

  if (remainingMinutes === 0) {
    return `${hours} ชม.`;
  }

  return `${hours} ชม. ${remainingMinutes} นาที`;
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

function formatThaiDate(dateString: string) {
  if (!dateString) {
    return "ไม่ระบุวันที่";
  }

  return new Intl.DateTimeFormat("th-TH", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(
    new Date(`${dateString}T00:00:00`),
  );
}

function formatTime(time: string) {
  return time.slice(0, 5);
}

