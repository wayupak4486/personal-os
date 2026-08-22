"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  CirclePlus,
  Flag,
  Loader2,
  Minus,
  Pencil,
  Plus,
  Target,
  Trash2,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { getSupabaseConfig } from "@/lib/supabase/config";
import {
  serializeSupabaseError,
  supabaseDiagnosticContext,
} from "@/lib/supabase/diagnostics";
import {
  averageGoalProgress,
  daysUntilDeadline,
  GOAL_PRIORITIES,
  GOAL_STATUSES,
  isOverdue,
  isValidIsoDate,
  mapGoalRecord,
  normalizeProgress,
  priorityLabel,
  statusLabel,
  type Goal,
  type GoalPriority,
  type GoalRecord,
  type GoalStatus,
} from "@/lib/goals";

type Props = {
  initialGoals: GoalRecord[];
  initialError: string | null;
};

type FormState = {
  title: string;
  description: string;
  category: string;
  status: GoalStatus;
  progress: string;
  priority: GoalPriority;
  startDate: string;
  deadline: string;
};

type Filter = "all" | GoalStatus | "overdue";

const defaultForm: FormState = {
  title: "",
  description: "",
  category: "ทั่วไป",
  status: "not_started",
  progress: "0",
  priority: "medium",
  startDate: "",
  deadline: "",
};

const statusClasses: Record<GoalStatus, string> = {
  not_started: "bg-slate-100 text-slate-600",
  in_progress: "bg-sky-50 text-sky-700",
  completed: "bg-emerald-50 text-emerald-700",
  paused: "bg-amber-50 text-amber-700",
};

const priorityClasses: Record<GoalPriority, string> = {
  low: "text-emerald-700",
  medium: "text-amber-700",
  high: "text-red-700",
};

const STEP = 5;

export default function GoalsClient({
  initialGoals,
  initialError,
}: Props) {
  const [supabase] = useState(() => createClient());
  const [records, setRecords] = useState<GoalRecord[]>(initialGoals);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [form, setForm] = useState<FormState>(defaultForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [progressSavingId, setProgressSavingId] = useState<string | null>(null);
  const [error, setError] = useState(initialError);
  const [success, setSuccess] = useState<string | null>(null);

  const goals = useMemo(
    () => records.map(mapGoalRecord),
    [records],
  );

  const categories = useMemo(
    () =>
      Array.from(new Set(goals.map((goal) => goal.category))).sort(),
    [goals],
  );

  const filteredGoals = useMemo(
    () =>
      goals.filter((goal) => {
        const matchesFilter =
          filter === "all" || filter === "overdue"
            ? filter === "all" || isOverdue(goal)
            : goal.status === filter;

        return (
          matchesFilter &&
          (categoryFilter === "all" ||
            goal.category === categoryFilter) &&
          (priorityFilter === "all" ||
            goal.priority === priorityFilter) &&
          `${goal.title} ${goal.description}`
            .toLowerCase()
            .includes(query.toLowerCase())
        );
      }),
    [goals, filter, categoryFilter, priorityFilter, query],
  );

  const activeCount = goals.filter(
    (goal) => goal.status === "in_progress",
  ).length;
  const completedCount = goals.filter(
    (goal) => goal.status === "completed",
  ).length;
  const overdueCount = goals.filter((goal) => isOverdue(goal)).length;
  const averageProgress = averageGoalProgress(goals);

  const loadGoals = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        throw new Error("auth");
      }

      const context = supabaseDiagnosticContext(
        "SELECT",
        getSupabaseConfig().projectRef,
        user.id,
        user.email ?? null,
      );

      console.log(
        `Goals SELECT before ${context} table=goals`,
      );

      const result = await supabase
        .from("goals")
        .select("*")
        .eq("user_id", user.id)
        .order("deadline", {
          ascending: true,
          nullsFirst: false,
        })
        .order("created_at", { ascending: false });

      console.log(
        `Goals SELECT after ${context} count=${result.data?.length ?? 0} error=${serializeSupabaseError(result.error)}`,
      );

      if (result.error) {
        throw result.error;
      }

      setRecords((result.data ?? []) as GoalRecord[]);
    } catch (caught) {
      logGoalError("SELECT", caught);
      setError(
        goalUserMessage(
          caught,
          "ไม่สามารถโหลดเป้าหมายได้ กรุณาลองอีกครั้ง",
        ),
      );
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    const timer = setTimeout(() => void loadGoals(), 0);
    return () => clearTimeout(timer);
  }, [loadGoals]);

  function openCreate() {
    setEditingId(null);
    setForm(defaultForm);
    setShowForm(true);
    setError(null);
    setSuccess(null);
  }

  function openEdit(goal: Goal) {
    setEditingId(goal.id);

    setForm({
      title: goal.title,
      description: goal.description,
      category: goal.category,
      status: goal.status,
      progress: String(goal.progress),
      priority: goal.priority,
      startDate: goal.startDate ?? "",
      deadline: goal.deadline ?? "",
    });

    setShowForm(true);
    setError(null);
    setSuccess(null);
  }

  async function saveGoal(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const progress = normalizeProgress(form.progress);

    if (
      !form.title.trim() ||
      !isValidIsoDate(form.startDate || null) ||
      !isValidIsoDate(form.deadline || null) ||
      (form.startDate &&
        form.deadline &&
        form.deadline < form.startDate)
    ) {
      setError(
        "กรุณากรอกชื่อและตรวจสอบวันที่ของเป้าหมาย",
      );
      return;
    }

    if (
      Number(form.progress) < 0 ||
      Number(form.progress) > 100
    ) {
      setError("Progress ต้องอยู่ระหว่าง 0 ถึง 100");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("auth");
      }

      const status =
        form.status === "completed"
          ? "completed"
          : progress === 100
            ? "completed"
            : progress > 0 && form.status === "not_started"
              ? "in_progress"
              : form.status;

      const payload = {
        user_id: user.id,
        title: form.title.trim(),
        description:
          form.description.trim() || null,
        category: form.category.trim() || "ทั่วไป",
        status,
        progress: status === "completed" ? 100 : progress,
        priority: form.priority,
        start_date: form.startDate || null,
        deadline: form.deadline || null,
        completed_at:
          status === "completed"
            ? new Date().toISOString()
            : null,
        updated_at: new Date().toISOString(),
      };

      const operation = editingId ? "UPDATE" : "INSERT";
      const context = supabaseDiagnosticContext(
        operation,
        getSupabaseConfig().projectRef,
        user.id,
        user.email ?? null,
      );

      console.log(
        `Goals ${operation} before ${context} table=goals userId=${user.id}`,
      );

      const request = editingId
        ? supabase
            .from("goals")
            .update(payload)
            .eq("id", editingId)
            .eq("user_id", user.id)
        : supabase.from("goals").insert(payload);

      const { error: mutationError } = await request;

      if (mutationError) {
        throw mutationError;
      }

      console.log(
        `Goals ${operation} after ${context} error=${serializeSupabaseError(null)}`,
      );

      setShowForm(false);
      setSuccess(
        editingId
          ? "แก้ไขเป้าหมายแล้ว"
          : "สร้างเป้าหมายแล้ว",
      );

      await loadGoals();
    } catch (caught) {
      logGoalError(
        editingId ? "UPDATE" : "INSERT",
        caught,
      );

      setError(
        goalUserMessage(
          caught,
          "ไม่สามารถบันทึกเป้าหมายได้ กรุณาลองอีกครั้ง",
        ),
      );
    } finally {
      setSaving(false);
    }
  }

  async function updateProgress(
    goal: Goal,
    direction: -1 | 1,
  ) {
    if (progressSavingId) {
      return;
    }

    const previousRecords = records;
    const current = normalizeProgress(goal.progress);
    const next = Math.max(
      0,
      Math.min(100, current + direction * STEP),
    );

    if (next === current) {
      return;
    }

    const nextStatus: GoalStatus =
      next === 100
        ? "completed"
        : next > 0
          ? "in_progress"
          : goal.status === "paused"
            ? "paused"
            : "not_started";

    const nextCompletedAt =
      nextStatus === "completed"
        ? goal.completedAt ?? new Date().toISOString()
        : null;

    setProgressSavingId(goal.id);
    setError(null);
    setSuccess(null);

    // Optimistic update: the card changes immediately.
    setRecords((currentRecords) =>
      currentRecords.map((record) => {
        if (String(record.id) !== goal.id) {
          return record;
        }

        return {
          ...record,
          progress: next,
          status: nextStatus,
          completed_at: nextCompletedAt,
          updated_at: new Date().toISOString(),
        };
      }),
    );

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("auth");
      }

      const context = supabaseDiagnosticContext(
        "UPDATE",
        getSupabaseConfig().projectRef,
        user.id,
        user.email ?? null,
      );

      console.log(
        `Goals PROGRESS UPDATE before ${context} table=goals recordId=${goal.id} progress=${next}`,
      );

      const { data, error: mutationError } = await supabase
        .from("goals")
        .update({
          progress: next,
          status: nextStatus,
          completed_at: nextCompletedAt,
          updated_at: new Date().toISOString(),
        })
        .eq("id", goal.id)
        .eq("user_id", user.id)
        .select("*")
        .single();

      if (mutationError) {
        throw mutationError;
      }

      console.log(
        `Goals PROGRESS UPDATE after ${context} recordId=${goal.id} progress=${next}`,
      );

      if (data) {
        setRecords((currentRecords) =>
          currentRecords.map((record) =>
            String(record.id) === goal.id
              ? (data as GoalRecord)
              : record,
          ),
        );
      }

      setSuccess(
        next === 100
          ? `“${goal.title}” สำเร็จแล้ว 🎉`
          : `อัปเดต Progress เป็น ${next}%`,
      );
    } catch (caught) {
      // Roll back if Supabase rejects the update.
      setRecords(previousRecords);

      logGoalError("PROGRESS UPDATE", caught);

      setError(
        goalUserMessage(
          caught,
          "ไม่สามารถอัปเดต Progress ได้ กรุณาลองอีกครั้ง",
        ),
      );
    } finally {
      setProgressSavingId(null);
    }
  }

  async function deleteGoal() {
    if (!deleteId) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("auth");
      }

      const context = supabaseDiagnosticContext(
        "DELETE",
        getSupabaseConfig().projectRef,
        user.id,
        user.email ?? null,
      );

      console.log(
        `Goals DELETE before ${context} table=goals recordId=${deleteId}`,
      );

      const { error: mutationError } = await supabase
        .from("goals")
        .delete()
        .eq("id", deleteId)
        .eq("user_id", user.id);

      if (mutationError) {
        throw mutationError;
      }

      console.log(
        `Goals DELETE after ${context} error=${serializeSupabaseError(null)}`,
      );

      setDeleteId(null);
      setSuccess("ลบเป้าหมายแล้ว");
      await loadGoals();
    } catch (caught) {
      logGoalError("DELETE", caught);

      setError(
        goalUserMessage(
          caught,
          "ไม่สามารถลบเป้าหมายได้ กรุณาลองอีกครั้ง",
        ),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f6f8fb] text-slate-900">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
            >
              <ArrowLeft size={18} />
            </Link>

            <div>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
                Personal OS
              </p>

              <h1 className="mt-1 text-2xl font-bold tracking-tight">
                Goals
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                เป้าหมายที่ทำให้วันนี้มีทิศทาง
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            <CirclePlus size={17} />
            เพิ่มเป้าหมาย
          </button>
        </header>

        {error && (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            <Check size={16} />
            {success}
          </div>
        )}

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Overview
            label="ทั้งหมด"
            value={goals.length}
            icon={<Target size={17} />}
          />

          <Overview
            label="กำลังทำ"
            value={activeCount}
            icon={<TrendingUp size={17} />}
          />

          <Overview
            label="สำเร็จ"
            value={completedCount}
            icon={<Check size={17} />}
          />

          <Overview
            label="เลยกำหนด"
            value={overdueCount}
            icon={<CalendarDays size={17} />}
          />

          <Overview
            label="Progress เฉลี่ย"
            value={`${averageProgress}%`}
            icon={<Flag size={17} />}
          />
        </section>

        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row">
            <input
              value={query}
              onChange={(event) =>
                setQuery(event.target.value)
              }
              placeholder="ค้นหาเป้าหมาย"
              className="h-11 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-sky-400"
            />

            <div className="flex flex-wrap gap-2">
              <select
                value={categoryFilter}
                onChange={(event) =>
                  setCategoryFilter(event.target.value)
                }
                className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm"
              >
                <option value="all">
                  ทุกหมวดหมู่
                </option>

                {categories.map((category) => (
                  <option key={category}>
                    {category}
                  </option>
                ))}
              </select>

              <select
                value={priorityFilter}
                onChange={(event) =>
                  setPriorityFilter(event.target.value)
                }
                className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm"
              >
                <option value="all">
                  ทุกความสำคัญ
                </option>

                {GOAL_PRIORITIES.map((priority) => (
                  <option
                    key={priority}
                    value={priority}
                  >
                    {priorityLabel(priority)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {(
              [
                "all",
                ...GOAL_STATUSES,
                "overdue",
              ] as Filter[]
            ).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                className={`whitespace-nowrap rounded-xl px-3 py-2 text-xs font-semibold transition ${
                  filter === value
                    ? "bg-slate-950 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {value === "all"
                  ? "ทั้งหมด"
                  : value === "overdue"
                    ? "เลยกำหนด"
                    : statusLabel(value)}
              </button>
            ))}
          </div>
        </section>

        <section className="mt-6">
          {loading ? (
            <LoadingState />
          ) : filteredGoals.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-12 text-center">
              <Target
                className="mx-auto text-slate-300"
                size={30}
              />

              <p className="mt-3 font-semibold text-slate-700">
                ยังไม่มีเป้าหมายที่ตรงกับการค้นหา
              </p>

              <p className="mt-1 text-sm text-slate-500">
                สร้างเป้าหมายแรกของคุณเพื่อเริ่มติดตามความคืบหน้า
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {filteredGoals.map((goal) => (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  progressSaving={
                    progressSavingId === goal.id
                  }
                  onDecrease={() =>
                    void updateProgress(goal, -1)
                  }
                  onIncrease={() =>
                    void updateProgress(goal, 1)
                  }
                  onEdit={() => openEdit(goal)}
                  onDelete={() =>
                    setDeleteId(goal.id)
                  }
                />
              ))}
            </div>
          )}
        </section>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-950/30 p-4 sm:items-center">
          <form
            onSubmit={saveGoal}
            className="w-full max-w-lg rounded-3xl bg-white p-5 shadow-xl sm:p-6"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">
                {editingId
                  ? "แก้ไขเป้าหมาย"
                  : "เพิ่มเป้าหมาย"}
              </h2>

              <button
                type="button"
                onClick={() => setShowForm(false)}
                disabled={saving}
                className="text-sm text-slate-500 disabled:opacity-50"
              >
                ปิด
              </button>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="sm:col-span-2">
                <span className="label">
                  ชื่อเป้าหมาย
                </span>

                <input
                  required
                  value={form.title}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      title: event.target.value,
                    })
                  }
                  className="input"
                />
              </label>

              <label className="sm:col-span-2">
                <span className="label">
                  รายละเอียด
                </span>

                <textarea
                  value={form.description}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      description:
                        event.target.value,
                    })
                  }
                  className="input min-h-24 py-3"
                />
              </label>

              <label>
                <span className="label">
                  หมวดหมู่
                </span>

                <input
                  value={form.category}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      category:
                        event.target.value,
                    })
                  }
                  className="input"
                />
              </label>

              <label>
                <span className="label">
                  ความสำคัญ
                </span>

                <select
                  value={form.priority}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      priority:
                        event.target
                          .value as GoalPriority,
                    })
                  }
                  className="input"
                >
                  {GOAL_PRIORITIES.map(
                    (priority) => (
                      <option
                        key={priority}
                        value={priority}
                      >
                        {priorityLabel(priority)}
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label>
                <span className="label">
                  สถานะ
                </span>

                <select
                  value={form.status}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      status:
                        event.target
                          .value as GoalStatus,
                    })
                  }
                  className="input"
                >
                  {GOAL_STATUSES.map(
                    (status) => (
                      <option
                        key={status}
                        value={status}
                      >
                        {statusLabel(status)}
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label>
                <span className="label">
                  Progress (%)
                </span>

                <input
                  type="number"
                  min="0"
                  max="100"
                  value={form.progress}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      progress:
                        event.target.value,
                    })
                  }
                  className="input"
                />
              </label>

              <label>
                <span className="label">
                  วันที่เริ่ม
                </span>

                <input
                  type="date"
                  value={form.startDate}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      startDate:
                        event.target.value,
                    })
                  }
                  className="input"
                />
              </label>

              <label>
                <span className="label">
                  กำหนดส่ง
                </span>

                <input
                  type="date"
                  value={form.deadline}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      deadline:
                        event.target.value,
                    })
                  }
                  className="input"
                />
              </label>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 text-sm font-semibold text-white disabled:opacity-60"
            >
              {saving && (
                <Loader2
                  size={16}
                  className="animate-spin"
                />
              )}

              บันทึกเป้าหมาย
            </button>
          </form>
        </div>
      )}

      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold">
              ลบเป้าหมายนี้หรือไม่?
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              ข้อมูลเป้าหมายจะถูกลบอย่างถาวร
            </p>

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setDeleteId(null)}
                disabled={saving}
                className="flex-1 rounded-xl border border-slate-200 px-3 py-3 text-sm font-semibold disabled:opacity-50"
              >
                ยกเลิก
              </button>

              <button
                type="button"
                disabled={saving}
                onClick={() => void deleteGoal()}
                className="flex-1 rounded-xl bg-red-600 px-3 py-3 text-sm font-semibold text-white disabled:opacity-60"
              >
                {saving ? "กำลังลบ..." : "ลบเป้าหมาย"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function Overview({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 text-slate-500">
        {icon}
        <span className="text-xs font-medium">
          {label}
        </span>
      </div>

      <p className="mt-3 text-2xl font-bold">
        {value}
      </p>
    </div>
  );
}

function GoalCard({
  goal,
  progressSaving,
  onDecrease,
  onIncrease,
  onEdit,
  onDelete,
}: {
  goal: Goal;
  progressSaving: boolean;
  onDecrease: () => void;
  onIncrease: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const days = daysUntilDeadline(goal.deadline);
  const atMinimum = goal.progress <= 0;
  const atMaximum = goal.progress >= 100;

  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-sky-700">
              {goal.category}
            </span>

            <span
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusClasses[goal.status]}`}
            >
              {statusLabel(goal.status)}
            </span>
          </div>

          <h2 className="mt-2 text-lg font-bold">
            {goal.title}
          </h2>

          <p className="mt-1 min-h-5 text-sm text-slate-500">
            {goal.description || "ไม่มีรายละเอียด"}
          </p>
        </div>

        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            onClick={onEdit}
            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100"
            aria-label="แก้ไขเป้าหมาย"
          >
            <Pencil size={16} />
          </button>

          <button
            type="button"
            onClick={onDelete}
            className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
            aria-label="ลบเป้าหมาย"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div className="mt-5">
        <div className="flex items-center justify-between">
          <span
            className={`text-xs font-semibold ${priorityClasses[goal.priority]}`}
          >
            ความสำคัญ: {priorityLabel(goal.priority)}
          </span>

          <span className="text-xs font-medium text-slate-400">
            ปรับทีละ {STEP}%
          </span>
        </div>

        <div className="mt-2 flex items-center gap-3">
          <button
            type="button"
            onClick={onDecrease}
            disabled={
              progressSaving || atMinimum
            }
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 active:scale-95 disabled:cursor-not-allowed disabled:opacity-35"
            aria-label="ลด Progress 5%"
          >
            <Minus size={18} />
          </button>

          <div className="min-w-0 flex-1">
            <div className="flex items-end justify-between">
              <span className="text-2xl font-bold tracking-tight">
                {goal.progress}%
              </span>

              {progressSaving && (
                <Loader2
                  size={15}
                  className="mb-1 animate-spin text-slate-400"
                />
              )}
            </div>

            <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-sky-500 transition-[width] duration-300"
                style={{
                  width: `${goal.progress}%`,
                }}
              />
            </div>
          </div>

          <button
            type="button"
            onClick={onIncrease}
            disabled={
              progressSaving || atMaximum
            }
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-white transition hover:bg-slate-800 active:scale-95 disabled:cursor-not-allowed disabled:opacity-35"
            aria-label="เพิ่ม Progress 5%"
          >
            <Plus size={18} />
          </button>
        </div>

        <div className="mt-2 flex justify-between text-[11px] text-slate-400">
          <span>0%</span>
          <span>100%</span>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 text-xs text-slate-500">
        <span>
          {goal.deadline
            ? `กำหนดส่ง ${goal.deadline}`
            : "ยังไม่กำหนด deadline"}
        </span>

        <span
          className={
            days !== null && days < 0
              ? "font-semibold text-red-600"
              : ""
          }
        >
          {days === null
            ? ""
            : days < 0
              ? `เลยกำหนด ${Math.abs(days)} วัน`
              : days === 0
                ? "ครบกำหนดวันนี้"
                : `เหลือ ${days} วัน`}
        </span>
      </div>
    </article>
  );
}

function LoadingState() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="h-56 animate-pulse rounded-3xl bg-white" />
      <div className="h-56 animate-pulse rounded-3xl bg-white" />
    </div>
  );
}

function logGoalError(
  operation: string,
  error: unknown,
): void {
  console.log(
    `Goals ${operation} failed error=${serializeSupabaseError(error)}`,
  );
}

function goalUserMessage(
  error: unknown,
  fallback: string,
): string {
  const serialized = serializeSupabaseError(error);

  if (
    serialized.includes('"code":"42501"') ||
    serialized.includes('"status":"403"')
  ) {
    return "บัญชีนี้ไม่มีสิทธิ์เข้าถึงข้อมูลเป้าหมาย";
  }

  if (serialized.includes('"status":"401"')) {
    return "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่";
  }

  return fallback;
}