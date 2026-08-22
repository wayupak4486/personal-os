import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PaymentsClient from "@/components/payments/PaymentsClient";
import type { PaymentRecord } from "@/lib/payments";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { serializeSupabaseError, supabaseDiagnosticContext } from "@/lib/supabase/diagnostics";

export const dynamic = "force-dynamic";

export default async function PaymentsPage() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (!user) {
    if (process.env.NODE_ENV !== "production") {
      console.log(`Payments server auth unavailable error=${serializeSupabaseError(authError)}`);
    }
    redirect("/auth/login?next=/payments");
  }

  if (process.env.NODE_ENV !== "production") {
    const { projectRef } = getSupabaseConfig();
    console.log(`Payments server auth ${supabaseDiagnosticContext("SELECT", projectRef, user.id, user.email ?? null)}`);
  }

  if (process.env.NODE_ENV !== "production") {
    console.log(`Payments server query before ${supabaseDiagnosticContext("SELECT", getSupabaseConfig().projectRef, user.id, user.email ?? null)} table=payment_occurrences`);
  }

  const result = await supabase
    .from("payment_occurrences")
    .select("*")
    .eq("user_id", user.id)
    .order("billing_month", { ascending: false })
    .order("created_at", { ascending: false });

  if (result.error && process.env.NODE_ENV !== "production") {
    console.log(`Payments server query after ${supabaseDiagnosticContext("SELECT", getSupabaseConfig().projectRef, user.id, user.email ?? null)} count=0 error=${serializeSupabaseError(result.error)}`);
  } else if (process.env.NODE_ENV !== "production") {
    console.log(`Payments server query after ${supabaseDiagnosticContext("SELECT", getSupabaseConfig().projectRef, user.id, user.email ?? null)} count=${result.data?.length ?? 0} error=${serializeSupabaseError(null)}`);
  }

  return (
    <PaymentsClient
      initialRecords={(result.data ?? []) as PaymentRecord[]}
      initialError={result.error ? "ไม่สามารถโหลดข้อมูลค่าใช้จ่ายได้" : null}
    />
  );
}
