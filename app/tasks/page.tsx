import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import TasksClient from "./TasksClient";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { data: tasks, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", {
      ascending: false,
    });

  return (
    <TasksClient
      initialTasks={(tasks ?? []) as Parameters<
        typeof TasksClient
      >[0]["initialTasks"]}
      initialError={error?.message ?? null}
    />
  );
}
