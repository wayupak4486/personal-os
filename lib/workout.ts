export type WorkoutRecord = {
  id?: string;
  user_id?: string;
  workout_date?: string | null;
  name?: string | null;
  category?: string | null;
  scheduled_time?: string | null;
  exercise_count?: number | string | null;
  completed?: boolean | null;
  completed_at?: string | null;
  duration_minutes?: number | string | null;
  calories?: number | string | null;
  created_at?: string | null;
  updated_at?: string | null;
  [key: string]: unknown;
};

export type WorkoutSession = {
  id: string;
  date: string;
  name: string;
  category: string;
  scheduledTime: string | null;
  exerciseCount: number | null;
  completed: boolean;
  completedAt: string | null;
  durationMinutes: number | null;
  calories: number | null;
};

function numberValue(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : null;
}

export function mapWorkoutRecord(record: WorkoutRecord): WorkoutSession {
  return {
    id: String(record.id ?? ""),
    date: typeof record.workout_date === "string" ? record.workout_date : "",
    name: typeof record.name === "string" && record.name ? record.name : "Workout",
    category: typeof record.category === "string" && record.category ? record.category : "ทั่วไป",
    scheduledTime: typeof record.scheduled_time === "string" ? record.scheduled_time : null,
    exerciseCount: numberValue(record.exercise_count),
    completed: record.completed === true,
    completedAt: typeof record.completed_at === "string" ? record.completed_at : null,
    durationMinutes: numberValue(record.duration_minutes),
    calories: numberValue(record.calories),
  };
}

export function todayWorkout(records: WorkoutRecord[], today: string): WorkoutSession | null {
  const session = records.find((record) => record.workout_date === today);
  return session ? mapWorkoutRecord(session) : null;
}

export function workoutStatus(session: WorkoutSession | null): "none" | "scheduled" | "completed" {
  if (!session) return "none";
  return session.completed ? "completed" : "scheduled";
}
