import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import GoalsClient from "@/components/goals/GoalsClient";
import type { GoalRecord } from "@/lib/goals";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { serializeSupabaseError, supabaseDiagnosticContext } from "@/lib/supabase/diagnostics";

export const dynamic = "force-dynamic";

export default async function GoalsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login?next=/goals");

  const result = await supabase
    .from("goals")
    .select("*")
    .eq("user_id", user.id)
    .order("deadline", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (process.env.NODE_ENV !== "production") {
    console.log(`Goals server SELECT after ${supabaseDiagnosticContext("SELECT", getSupabaseConfig().projectRef, user.id, user.email ?? null)} count=${result.data?.length ?? 0} error=${serializeSupabaseError(result.error)}`);
  }

  return <GoalsClient initialGoals={(result.data ?? []) as GoalRecord[]} initialError={result.error ? "ไม่สามารถโหลดเป้าหมายได้" : null} />;
}
