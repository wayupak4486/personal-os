import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SleepClient from "@/components/sleep/SleepClient";

export const dynamic = "force-dynamic";

export default async function SleepPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login?next=/sleep");
  }

  const { data: settings, error: settingsError } = await supabase
    .from("sleep_settings")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: logs, error: logsError } = await supabase
    .from("sleep_logs")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const initialSleepLogs = (logs ?? []) as Array<Record<string, unknown>>;

  return (
    <SleepClient
      initialSettings={settings ?? null}
      initialLogs={initialSleepLogs as import("@/lib/sleep").SleepLogRecord[]}
      initialError={settingsError?.message ?? logsError?.message ?? null}
    />
  );
}
