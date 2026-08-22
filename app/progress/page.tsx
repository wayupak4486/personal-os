"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BarChart3, CheckCircle2, Dumbbell, Home, Loader2, MoonStar, MoreVertical, Target, WalletCards } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { averageGoalProgress, mapGoalRecord, type GoalRecord } from "@/lib/goals";
import { formatBaht, mapPaymentRecord, type PaymentRecord } from "@/lib/payments";
import { formatDurationMinutes, normalizeDuration, type SleepLogRecord } from "@/lib/sleep";
import { mapWorkoutRecord, type WorkoutRecord } from "@/lib/workout";

type Task = { completed: boolean; due_date: string | null; created_at: string };
type Data = { tasks: Task[]; goals: GoalRecord[]; workouts: WorkoutRecord[]; sleep: SleepLogRecord[]; payments: PaymentRecord[] };

export default function ProgressPage() {
  const [supabase] = useState(() => createClient());
  const [data, setData] = useState<Data>({ tasks: [], goals: [], workouts: [], sleep: [], payments: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) { window.location.href = "/auth/login?next=/progress"; return; }
      const [tasks, goals, workouts, sleep, payments] = await Promise.all([
        supabase.from("tasks").select("completed, due_date, created_at").eq("user_id", user.id),
        supabase.from("goals").select("*").eq("user_id", user.id),
        supabase.from("workout_sessions").select("*").eq("user_id", user.id),
        supabase.from("sleep_logs").select("*").eq("user_id", user.id),
        supabase.from("payment_occurrences").select("*").eq("user_id", user.id),
      ]);
      const firstError = tasks.error || goals.error || workouts.error || sleep.error || payments.error;
      if (firstError) throw firstError;
      setData({ tasks: (tasks.data ?? []) as Task[], goals: (goals.data ?? []) as GoalRecord[], workouts: (workouts.data ?? []) as WorkoutRecord[], sleep: (sleep.data ?? []) as SleepLogRecord[], payments: (payments.data ?? []) as PaymentRecord[] });
    } catch (caught) { setError(caught instanceof Error ? caught.message : "ไม่สามารถโหลด Progress ได้"); }
    finally { setLoading(false); }
  }, [supabase]);

  useEffect(() => { void load(); }, [load]);

  const startDate = useMemo(() => { const d = new Date(); d.setDate(d.getDate() - 6); return d.toISOString().slice(0, 10); }, []);
  const todayString = new Date().toISOString().slice(0, 10);

  const taskStats = useMemo(() => {
    const recent = data.tasks.filter(t => t.created_at.slice(0, 10) >= startDate);
    const completed = recent.filter(t => t.completed).length;
    const overdue = data.tasks.filter(t => !t.completed && t.due_date && t.due_date < todayString).length;
    return { total: recent.length, completed, overdue, rate: recent.length ? Math.round(completed / recent.length * 100) : 0 };
  }, [data.tasks, startDate, todayString]);

  const goalProgress = useMemo(() => averageGoalProgress(data.goals.map(mapGoalRecord)), [data.goals]);
  const workoutStats = useMemo(() => { const rows = data.workouts.map(mapWorkoutRecord).filter(w => w.date >= startDate); return { total: rows.length, completed: rows.filter(w => w.completed).length, minutes: rows.reduce((n, w) => n + (w.durationMinutes ?? 0), 0) }; }, [data.workouts, startDate]);
  const sleepAverage = useMemo(() => { const values = data.sleep.filter(s => s.status === "completed").map(s => normalizeDuration(s.duration_minutes)).filter((n): n is number => n !== null && n > 0); return values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null; }, [data.sleep]);
  const outstanding = useMemo(() => data.payments.map(mapPaymentRecord).reduce((n, p) => n + Math.max(0, (p.amount ?? 0) - p.paidAmount), 0), [data.payments]);
  const score = useMemo(() => { const workout = workoutStats.total ? Math.round(workoutStats.completed / workoutStats.total * 100) : null; const values = workout === null ? [taskStats.rate, goalProgress] : [taskStats.rate, goalProgress, workout]; return Math.round(values.reduce((a, b) => a + b, 0) / values.length); }, [taskStats.rate, goalProgress, workoutStats]);

  return <div className="min-h-screen bg-[#f8fafc] text-slate-950"><div className="flex min-h-screen">
    <aside className="hidden w-[240px] shrink-0 border-r border-slate-200 bg-white lg:flex lg:flex-col"><div className="px-6 py-7"><div className="text-lg font-bold">PERSONAL OS</div><p className="mt-1 text-xs text-slate-400">Personal productivity system</p></div><nav className="space-y-1 px-3"><NavItem icon={<Home size={18}/>} label="Today" href="/today"/><NavItem icon={<CheckCircle2 size={18}/>} label="Tasks" href="/tasks"/><NavItem icon={<Target size={18}/>} label="Goals" href="/goals"/><NavItem icon={<Dumbbell size={18}/>} label="Workout" href="/workout"/><NavItem active icon={<BarChart3 size={18}/>} label="Progress" href="/progress"/><NavItem icon={<WalletCards size={18}/>} label="Payments" href="/payments"/></nav><div className="mt-auto px-3 pb-6"><NavItem icon={<MoreVertical size={18}/>} label="Settings" href="/settings"/></div></aside>
    <main className="min-w-0 flex-1 pb-24 lg:pb-0"><div className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8"><header><p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">ANALYTICS</p><h1 className="mt-2 text-3xl font-bold sm:text-4xl">Progress</h1><p className="mt-2 text-sm text-slate-500">ภาพรวมจากข้อมูลจริงใน Personal OS</p></header>
      {error && <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
      {loading ? <div className="mt-10 flex justify-center gap-2 text-sm text-slate-400"><Loader2 size={18} className="animate-spin"/>กำลังคำนวณ Progress...</div> : <>
        <section className="mt-7 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="flex items-end justify-between"><div><p className="text-xs uppercase tracking-[0.16em] text-slate-400">DAILY SCORE</p><p className="mt-2 text-5xl font-bold">{score}%</p></div><BarChart3 size={30} className="text-slate-400"/></div><div className="mt-6 h-3 rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-600" style={{width:`${score}%`}}/></div><p className="mt-3 text-xs text-slate-400">Tasks + Goals + Workout เมื่อมีข้อมูล Workout</p></section>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Metric label="Tasks 7 วัน" value={`${taskStats.rate}%`} detail={`${taskStats.completed}/${taskStats.total} เสร็จ`} icon={<CheckCircle2 size={20}/>}/><Metric label="Goal Progress" value={`${goalProgress}%`} detail={`${data.goals.length} goals`} icon={<Target size={20}/>}/><Metric label="Workout" value={`${workoutStats.completed}/${workoutStats.total}`} detail={`${workoutStats.minutes} นาที`} icon={<Dumbbell size={20}/>}/><Metric label="Sleep" value={sleepAverage === null ? "—" : formatDurationMinutes(sleepAverage)} detail="ค่าเฉลี่ยจาก history" icon={<MoonStar size={20}/>}/></div>
        <div className="mt-6 grid gap-6 lg:grid-cols-2"><section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-xl font-bold">Productivity</h2><div className="mt-5 space-y-4"><Row label="Task completion" value={taskStats.rate}/><Row label="Goal progress" value={goalProgress}/>{taskStats.overdue > 0 && <div className="rounded-2xl bg-red-50 p-4 text-sm text-red-700">มีงานเลยกำหนด {taskStats.overdue} งาน</div>}</div></section><section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-xl font-bold">Payments</h2><div className="mt-5 rounded-2xl bg-amber-50 p-4"><p className="text-xs text-slate-500">ยอดค้างจากข้อมูลปัจจุบัน</p><p className="mt-1 text-2xl font-bold text-amber-700">{formatBaht(outstanding)}</p></div><Link href="/payments" className="mt-4 inline-flex text-sm font-semibold text-slate-600">ดู Payments →</Link></section></div>
      </>}
    </div></main></div></div>;
}

function Metric({label,value,detail,icon}:{label:string;value:string;detail:string;icon:React.ReactNode}){return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex justify-between text-slate-400"><span className="text-xs">{label}</span>{icon}</div><p className="mt-3 text-2xl font-bold">{value}</p><p className="mt-1 text-xs text-slate-400">{detail}</p></div>}
function Row({label,value}:{label:string;value:number}){return <div><div className="flex justify-between text-sm"><span className="text-slate-600">{label}</span><span className="font-bold">{value}%</span></div><div className="mt-2 h-2 rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-600" style={{width:`${Math.min(100,Math.max(0,value))}%`}}/></div></div>}
function NavItem({icon,label,href,active=false}:{icon:React.ReactNode;label:string;href:string;active?:boolean}){return <Link href={href} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm ${active?"bg-slate-100 font-semibold text-slate-950":"text-slate-500 hover:bg-slate-50"}`}>{icon}{label}</Link>}
