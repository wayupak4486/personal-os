
"use client";

import {
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  Circle,
  Filter,
  Home,
  MoreVertical,
  Pencil,
  Plus,
  Search,
  Settings,
  Target,
  Trash2,
  Dumbbell,
  BarChart3,
  X,
  Loader2,
} from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Priority = "low" | "medium" | "high";

type Task = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  completed: boolean;
  priority: Priority | string | null;
  due_date: string | null;
  created_at: string;
};

type TasksClientProps = {
  initialTasks: Task[];
  initialError: string | null;
};

type TaskForm = {
  title: string;
  description: string;
  priority: Priority;
  due_date: string;
};

const emptyForm: TaskForm = {
  title: "",
  description: "",
  priority: "medium",
  due_date: "",
};

const priorityConfig = {
  high: {
    label: "สูง",
    dot: "bg-red-500",
    text: "text-red-600",
    soft: "bg-red-50",
  },
  medium: {
    label: "กลาง",
    dot: "bg-orange-400",
    text: "text-orange-600",
    soft: "bg-orange-50",
  },
  low: {
    label: "ต่ำ",
    dot: "bg-emerald-500",
    text: "text-emerald-600",
    soft: "bg-emerald-50",
  },
};

export default function TasksClient({
  initialTasks,
  initialError,
}: TasksClientProps) {
  const supabase = createClient();

  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "completed">("all");

  const [modal, setModal] = useState<"add" | "edit" | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [form, setForm] = useState<TaskForm>(emptyForm);

  const [menuTask, setMenuTask] = useState<string | null>(null);
  const [deleteTask, setDeleteTask] = useState<Task | null>(null);

  const [loading, setLoading] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(initialError);

  const total = tasks.length;
  const completed = tasks.filter((task) => task.completed).length;
  const active = total - completed;

  const filteredTasks = useMemo(() => {
    const query = search.trim().toLowerCase();

    return tasks.filter((task) => {
      const matchesSearch =
        !query ||
        task.title.toLowerCase().includes(query) ||
        task.description?.toLowerCase().includes(query);

      const matchesFilter =
        filter === "all"
          ? true
          : filter === "active"
            ? !task.completed
            : task.completed;

      return matchesSearch && matchesFilter;
    });
  }, [tasks, search, filter]);

  function openAddModal() {
    setEditingTask(null);
    setForm(emptyForm);
    setError(null);
    setMenuTask(null);
    setModal("add");
  }

  function openEditModal(task: Task) {
    setEditingTask(task);

    setForm({
      title: task.title,
      description: task.description ?? "",
      priority:
        task.priority === "high" ||
        task.priority === "medium" ||
        task.priority === "low"
          ? task.priority
          : "medium",
      due_date: task.due_date ?? "",
    });

    setMenuTask(null);
    setError(null);
    setModal("edit");
  }

  function closeModal() {
    if (loading) return;

    setModal(null);
    setEditingTask(null);
    setForm(emptyForm);
  }

  async function getCurrentUser() {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) throw authError;
    if (!user) throw new Error("กรุณาเข้าสู่ระบบก่อนจัดการงาน");

    return user;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form.title.trim()) {
      setError("กรุณาใส่ชื่องาน");
      return;
    }

    if (loading) return;

    setLoading(true);
    setError(null);

    try {
      const user = await getCurrentUser();

      if (editingTask) {
        const previousTasks = tasks;

        const optimisticTask: Task = {
          ...editingTask,
          title: form.title.trim(),
          description: form.description.trim() || null,
          priority: form.priority,
          due_date: form.due_date || null,
        };

        setTasks((current) =>
          current.map((task) =>
            task.id === editingTask.id ? optimisticTask : task,
          ),
        );

        setModal(null);
        setEditingTask(null);
        setForm(emptyForm);

        const { data, error: updateError } = await supabase
          .from("tasks")
          .update({
            title: form.title.trim(),
            description: form.description.trim() || null,
            priority: form.priority,
            due_date: form.due_date || null,
          })
          .eq("id", editingTask.id)
          .eq("user_id", user.id)
          .select("*")
          .single();

        if (updateError) {
          setTasks(previousTasks);
          throw updateError;
        }

        setTasks((current) =>
          current.map((task) =>
            task.id === editingTask.id ? (data as Task) : task,
          ),
        );
      } else {
        const temporaryId =
          typeof crypto !== "undefined" && crypto.randomUUID
            ? `temp-${crypto.randomUUID()}`
            : `temp-${Date.now()}`;

        const optimisticTask: Task = {
          id: temporaryId,
          user_id: user.id,
          title: form.title.trim(),
          description: form.description.trim() || null,
          priority: form.priority,
          due_date: form.due_date || null,
          completed: false,
          created_at: new Date().toISOString(),
        };

        setTasks((current) => [optimisticTask, ...current]);

        setModal(null);
        setEditingTask(null);
        setForm(emptyForm);

        const { data, error: insertError } = await supabase
          .from("tasks")
          .insert({
            user_id: user.id,
            title: form.title.trim(),
            description: form.description.trim() || null,
            priority: form.priority,
            due_date: form.due_date || null,
            completed: false,
          })
          .select("*")
          .single();

        if (insertError) {
          setTasks((current) =>
            current.filter((task) => task.id !== temporaryId),
          );
          throw insertError;
        }

        setTasks((current) =>
          current.map((task) =>
            task.id === temporaryId ? (data as Task) : task,
          ),
        );
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "ไม่สามารถบันทึกงานได้",
      );
    } finally {
      setLoading(false);
    }
  }

  async function toggleComplete(task: Task) {
    if (actionId) return;

    const previousTasks = tasks;
    const nextCompleted = !task.completed;

    setActionId(task.id);
    setError(null);

    setTasks((current) =>
      current.map((item) =>
        item.id === task.id
          ? { ...item, completed: nextCompleted }
          : item,
      ),
    );

    try {
      const user = await getCurrentUser();

      const { data, error: updateError } = await supabase
        .from("tasks")
        .update({
          completed: nextCompleted,
        })
        .eq("id", task.id)
        .eq("user_id", user.id)
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
        err instanceof Error
          ? err.message
          : "ไม่สามารถเปลี่ยนสถานะงานได้",
      );
    } finally {
      setActionId(null);
    }
  }

  async function handleDelete() {
    if (!deleteTask || actionId) return;

    const taskToDelete = deleteTask;
    const previousTasks = tasks;

    setActionId(taskToDelete.id);
    setError(null);

    setTasks((current) =>
      current.filter((task) => task.id !== taskToDelete.id),
    );

    try {
      const user = await getCurrentUser();

      const { error: deleteError } = await supabase
        .from("tasks")
        .delete()
        .eq("id", taskToDelete.id)
        .eq("user_id", user.id);

      if (deleteError) throw deleteError;

      setDeleteTask(null);
      setMenuTask(null);
    } catch (err) {
      setTasks(previousTasks);

      setError(
        err instanceof Error ? err.message : "ไม่สามารถลบงานได้",
      );
    } finally {
      setActionId(null);
    }
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-950">
      <div className="flex min-h-screen">
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
            <NavItem icon={<Home size={18} />} label="Today" href="/" />

            <NavItem
              active
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
          </nav>

          <div className="mt-auto px-3 pb-6">
            <NavItem
              icon={<Settings size={18} />}
              label="Settings"
              href="/settings"
            />
          </div>
        </aside>

        <main className="min-w-0 flex-1 pb-24 lg:pb-0">
          <div className="mx-auto max-w-[1200px] px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
            <header className="flex items-start justify-between gap-4">
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
                  Personal OS
                </p>

                <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                  Tasks
                </h1>

                <p className="mt-2 text-sm text-slate-500">
                  จัดการงานทั้งหมดของคุณในที่เดียว
                </p>
              </div>

              <button
                type="button"
                onClick={openAddModal}
                className="hidden h-11 items-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 sm:flex"
              >
                <Plus size={18} />
                เพิ่มงาน
              </button>
            </header>

            {error && (
              <div className="mt-6 flex items-start justify-between gap-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                <div>
                  <p className="font-semibold">เกิดข้อผิดพลาด</p>
                  <p className="mt-1">{error}</p>
                </div>

                <button
                  type="button"
                  onClick={() => setError(null)}
                  className="rounded-lg p-1 hover:bg-red-100"
                >
                  <X size={16} />
                </button>
              </div>
            )}

            <section className="mt-7 grid grid-cols-3 gap-2 sm:gap-4">
              <StatCard label="ทั้งหมด" value={total} />

              <StatCard
                label="กำลังทำ"
                value={active}
                dot="bg-orange-400"
              />

              <StatCard
                label="เสร็จแล้ว"
                value={completed}
                dot="bg-emerald-500"
              />
            </section>

            <section className="mt-6 flex gap-2">
              <div className="relative flex-1">
                <Search
                  size={18}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="ค้นหางาน..."
                  className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400"
                />
              </div>

              <button
                type="button"
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                aria-label="ตัวกรอง"
              >
                <Filter size={18} />
              </button>
            </section>

            <div className="mt-4 flex rounded-xl bg-slate-100 p-1">
              <FilterButton
                active={filter === "all"}
                onClick={() => setFilter("all")}
              >
                ทั้งหมด
              </FilterButton>

              <FilterButton
                active={filter === "active"}
                onClick={() => setFilter("active")}
              >
                กำลังทำ
              </FilterButton>

              <FilterButton
                active={filter === "completed"}
                onClick={() => setFilter("completed")}
              >
                เสร็จแล้ว
              </FilterButton>
            </div>

            <section className="mt-8">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-bold">งานของคุณ</h2>

                <span className="text-xs text-slate-400">
                  {filteredTasks.length} งาน
                </span>
              </div>

              {filteredTasks.length === 0 ? (
                <EmptyState
                  hasSearch={Boolean(search)}
                  onAdd={openAddModal}
                />
              ) : (
                <div className="space-y-3">
                  {filteredTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      actionLoading={actionId === task.id}
                      menuOpen={menuTask === task.id}
                      onToggle={() => void toggleComplete(task)}
                      onMenu={() =>
                        setMenuTask((current) =>
                          current === task.id ? null : task.id,
                        )
                      }
                      onEdit={() => openEditModal(task)}
                      onDelete={() => {
                        setMenuTask(null);
                        setDeleteTask(task);
                      }}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>
        </main>
      </div>

      <button
        type="button"
        onClick={openAddModal}
        className="fixed bottom-20 right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-slate-950 text-white shadow-lg sm:hidden"
        aria-label="เพิ่มงาน"
      >
        <Plus size={24} />
      </button>

      <nav className="fixed bottom-0 left-0 right-0 z-20 border-t border-slate-200 bg-white/95 px-3 py-2 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-lg items-center justify-around">
          <MobileNav icon={<Home size={19} />} label="Today" />
          <MobileNav
            active
            icon={<CheckCircle2 size={19} />}
            label="Tasks"
          />
          <MobileNav icon={<Target size={19} />} label="Goals" />
          <MobileNav icon={<Dumbbell size={19} />} label="Workout" />
          <MobileNav icon={<MoreVertical size={19} />} label="More" />
        </div>
      </nav>

      {modal && (
        <TaskModal
          mode={modal}
          form={form}
          setForm={setForm}
          loading={loading}
          onClose={closeModal}
          onSubmit={handleSubmit}
        />
      )}

      {deleteTask && (
        <DeleteDialog
          task={deleteTask}
          loading={actionId === deleteTask.id}
          onCancel={() => setDeleteTask(null)}
          onConfirm={() => void handleDelete()}
        />
      )}
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
    <a
      href={href}
      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
        active
          ? "bg-slate-100 font-semibold text-slate-950"
          : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
      }`}
    >
      {icon}
      {label}
    </a>
  );
}

function MobileNav({
  icon,
  label,
  active = false,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
}) {
  return (
    <div
      className={`flex min-w-14 flex-col items-center gap-1 text-[10px] ${
        active ? "font-semibold text-slate-950" : "text-slate-400"
      }`}
    >
      {icon}
      <span>{label}</span>
    </div>
  );
}

function StatCard({
  label,
  value,
  dot,
}: {
  label: string;
  value: number;
  dot?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
      <div className="flex items-center gap-2 text-xs text-slate-500">
        {dot && <span className={`h-2 w-2 rounded-full ${dot}`} />}
        {label}
      </div>

      <p className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
        {value}
      </p>
    </div>
  );
}

function FilterButton({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium transition ${
        active
          ? "bg-white text-slate-950 shadow-sm"
          : "text-slate-500 hover:text-slate-900"
      }`}
    >
      {children}
    </button>
  );
}

function TaskCard({
  task,
  actionLoading,
  menuOpen,
  onToggle,
  onMenu,
  onEdit,
  onDelete,
}: {
  task: Task;
  actionLoading: boolean;
  menuOpen: boolean;
  onToggle: () => void;
  onMenu: () => void;
  onEdit: () => void;
  onDelete: () => void;
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
    <article
      className={`relative rounded-2xl border bg-white p-4 transition sm:p-5 ${
        task.completed
          ? "border-emerald-100 bg-emerald-50/30"
          : "border-slate-200 hover:border-slate-300"
      }`}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={onToggle}
          disabled={actionLoading}
          className="mt-0.5 shrink-0"
          aria-label={
            task.completed ? "ทำเป็นยังไม่เสร็จ" : "ทำเครื่องหมายว่าเสร็จ"
          }
        >
          {actionLoading ? (
            <Loader2
              size={24}
              className="animate-spin text-slate-400"
            />
          ) : task.completed ? (
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white">
              <Check size={15} strokeWidth={3} />
            </span>
          ) : (
            <Circle
              size={24}
              strokeWidth={1.5}
              className="text-slate-300"
            />
          )}
        </button>

        <div className="min-w-0 flex-1">
          <h3
            className={`text-sm font-semibold sm:text-[15px] ${
              task.completed
                ? "text-slate-400 line-through"
                : "text-slate-900"
            }`}
          >
            {task.title}
          </h3>

          {task.description && (
            <p
              className={`mt-1 line-clamp-2 text-xs leading-5 ${
                task.completed ? "text-slate-400" : "text-slate-500"
              }`}
            >
              {task.description}
            </p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span
              className={`inline-flex items-center gap-1.5 text-xs font-medium ${priority.text}`}
            >
              <span
                className={`h-2 w-2 rounded-full ${priority.dot}`}
              />
              {priority.label}
            </span>

            {task.due_date && (
              <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
                <CalendarDays size={13} />
                {formatDate(task.due_date)}
              </span>
            )}
          </div>
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={onMenu}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="เมนูงาน"
          >
            <MoreVertical size={18} />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-9 z-10 w-36 overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
              <button
                type="button"
                onClick={onEdit}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs hover:bg-slate-50"
              >
                <Pencil size={14} />
                แก้ไข
              </button>

              <button
                type="button"
                onClick={onDelete}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-red-600 hover:bg-red-50"
              >
                <Trash2 size={14} />
                ลบงาน
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function EmptyState({
  hasSearch,
  onAdd,
}: {
  hasSearch: boolean;
  onAdd: () => void;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-14 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
        <CheckCircle2 size={22} className="text-slate-400" />
      </div>

      <h3 className="mt-4 text-sm font-semibold">
        {hasSearch ? "ไม่พบงานที่ค้นหา" : "ยังไม่มีงาน"}
      </h3>

      <p className="mt-1 text-xs text-slate-400">
        {hasSearch
          ? "ลองเปลี่ยนคำค้นหาหรือตัวกรอง"
          : "เริ่มเพิ่มงานแรกของคุณได้เลย"}
      </p>

      {!hasSearch && (
        <button
          type="button"
          onClick={onAdd}
          className="mt-5 rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-semibold text-white"
        >
          เพิ่มงานแรก
        </button>
      )}
    </div>
  );
}

function TaskModal({
  mode,
  form,
  setForm,
  loading,
  onClose,
  onSubmit,
}: {
  mode: "add" | "edit";
  form: TaskForm;
  setForm: React.Dispatch<React.SetStateAction<TaskForm>>;
  loading: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/30 p-0 backdrop-blur-[2px] sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:max-w-lg sm:rounded-2xl sm:p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">
              {mode === "add" ? "เพิ่มงาน" : "แก้ไขงาน"}
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              ข้อมูลงานจะถูกบันทึกลง Supabase
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-5">
          <div>
            <label className="mb-2 block text-xs font-semibold">
              ชื่องาน
            </label>

            <input
              autoFocus
              value={form.title}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  title: event.target.value,
                }))
              }
              placeholder="เช่น สร้าง Landing Page"
              className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-slate-400"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold">
              รายละเอียด
            </label>

            <textarea
              value={form.description}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
              placeholder="รายละเอียดเพิ่มเติม..."
              rows={4}
              className="w-full resize-none rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-slate-400"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-xs font-semibold">
                Priority
              </label>

              <div className="relative">
                <select
                  value={form.priority}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      priority: event.target.value as Priority,
                    }))
                  }
                  className="h-11 w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 pr-10 text-sm outline-none focus:border-slate-400"
                >
                  <option value="high">สูง</option>
                  <option value="medium">กลาง</option>
                  <option value="low">ต่ำ</option>
                </select>

                <ChevronDown
                  size={16}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold">
                วันครบกำหนด
              </label>

              <input
                type="date"
                value={form.due_date}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    due_date: event.target.value,
                  }))
                }
                className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-slate-400"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="h-11 flex-1 rounded-xl border border-slate-200 text-sm font-semibold hover:bg-slate-50"
            >
              ยกเลิก
            </button>

            <button
              type="submit"
              disabled={loading}
              className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-slate-950 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {loading && (
                <Loader2 size={16} className="animate-spin" />
              )}

              {mode === "add"
                ? "เพิ่มงาน"
                : "บันทึกการเปลี่ยนแปลง"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DeleteDialog({
  task,
  loading,
  onCancel,
  onConfirm,
}: {
  task: Task;
  loading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
          <Trash2 size={21} />
        </div>

        <h2 className="mt-4 text-center text-lg font-bold">
          ลบงานนี้ใช่ไหม?
        </h2>

        <p className="mt-2 text-center text-sm leading-6 text-slate-500">
          คุณกำลังจะลบ
          <span className="font-semibold text-slate-800">
            {" "}
            “{task.title}”
          </span>
          <br />
          การลบไม่สามารถย้อนกลับได้
        </p>

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="h-11 flex-1 rounded-xl border border-slate-200 text-sm font-semibold hover:bg-slate-50"
          >
            ยกเลิก
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
          >
            {loading && (
              <Loader2 size={16} className="animate-spin" />
            )}
            ลบ
          </button>
        </div>
      </div>
    </div>
  );
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "short",
  }).format(new Date(`${date}T00:00:00`));
}

