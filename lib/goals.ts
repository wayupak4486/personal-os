export const GOAL_STATUSES = ["not_started", "in_progress", "completed", "paused"] as const;
export const GOAL_PRIORITIES = ["low", "medium", "high"] as const;

export type GoalStatus = (typeof GOAL_STATUSES)[number];
export type GoalPriority = (typeof GOAL_PRIORITIES)[number];

export type GoalRecord = {
  id?: string;
  user_id?: string;
  title?: string | null;
  description?: string | null;
  category?: string | null;
  status?: string | null;
  progress?: number | string | null;
  priority?: string | null;
  start_date?: string | null;
  deadline?: string | null;
  completed_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  [key: string]: unknown;
};

export type Goal = {
  id: string;
  title: string;
  description: string;
  category: string;
  status: GoalStatus;
  progress: number;
  priority: GoalPriority;
  startDate: string | null;
  deadline: string | null;
  completedAt: string | null;
};

export function normalizeGoalStatus(value: unknown): GoalStatus {
  return GOAL_STATUSES.includes(value as GoalStatus) ? value as GoalStatus : "not_started";
}

export function normalizeGoalPriority(value: unknown): GoalPriority {
  return GOAL_PRIORITIES.includes(value as GoalPriority) ? value as GoalPriority : "medium";
}

export function normalizeProgress(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(100, Math.round(parsed))) : 0;
}

export function mapGoalRecord(record: GoalRecord): Goal {
  return {
    id: String(record.id ?? ""),
    title: typeof record.title === "string" ? record.title : "ไม่มีชื่อเป้าหมาย",
    description: typeof record.description === "string" ? record.description : "",
    category: typeof record.category === "string" && record.category ? record.category : "ทั่วไป",
    status: normalizeGoalStatus(record.status),
    progress: normalizeProgress(record.progress),
    priority: normalizeGoalPriority(record.priority),
    startDate: typeof record.start_date === "string" ? record.start_date : null,
    deadline: typeof record.deadline === "string" ? record.deadline : null,
    completedAt: typeof record.completed_at === "string" ? record.completed_at : null,
  };
}

export function isValidIsoDate(value: string | null): boolean {
  if (!value) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

export function daysUntilDeadline(deadline: string | null, today = new Date()): number | null {
  if (!deadline) return null;
  const [year, month, day] = deadline.split("-").map(Number);
  const target = new Date(year, month - 1, day);
  const current = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((target.getTime() - current.getTime()) / 86400000);
}

export function isOverdue(goal: Goal, today = new Date()): boolean {
  return goal.status !== "completed" && (daysUntilDeadline(goal.deadline, today) ?? 0) < 0;
}

export function averageGoalProgress(goals: Goal[]): number {
  return goals.length === 0 ? 0 : Math.round(goals.reduce((total, goal) => total + goal.progress, 0) / goals.length);
}

export function statusLabel(status: GoalStatus): string {
  return status === "completed" ? "สำเร็จ" : status === "in_progress" ? "กำลังทำ" : status === "paused" ? "พักไว้" : "ยังไม่เริ่ม";
}

export function priorityLabel(priority: GoalPriority): string {
  return priority === "high" ? "สูง" : priority === "low" ? "ต่ำ" : "กลาง";
}
