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
    .order("created_at", {
      ascending: false,
    });

  return (
    <TasksClient
      initialTasks={tasks ?? []}
      initialError={error?.message ?? null}
    />
  );
}