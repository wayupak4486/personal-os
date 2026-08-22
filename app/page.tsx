import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // ยังไม่ได้ Login → ไปหน้า Login
  if (!user) {
    redirect("/auth/login");
  }

  // Login แล้ว → เข้า Today
  redirect("/today");
}