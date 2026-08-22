import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type SignUpPageProps = {
  searchParams: Promise<{
    error?: string;
    success?: string;
  }>;
};

export default async function SignUpPage({
  searchParams,
}: SignUpPageProps) {
  const params = await searchParams;

  async function signUp(formData: FormData) {
    "use server";

    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    if (!email || password.length < 6) {
      redirect(
        "/auth/sign-up?error=กรุณากรอกข้อมูลให้ครบและใช้รหัสผ่านอย่างน้อย 6 ตัวอักษร",
      );
    }

    const supabase = await createClient();

    const origin =
      process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${origin}/auth/confirm`,
      },
    });

    if (error) {
      redirect(
        `/auth/sign-up?error=${encodeURIComponent(error.message)}`,
      );
    }

    if (data.session) {
      redirect("/tasks");
    }

    redirect(
      "/auth/sign-up?success=สร้างบัญชีแล้ว กรุณาตรวจสอบอีเมลเพื่อยืนยันบัญชี",
    );
  }

  return (
    <main className="min-h-screen bg-[#F7F7F5] px-5 py-10 text-[#171717]">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-md items-center">
        <div className="w-full">
          <div className="mb-8">
            <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#171717] text-sm font-bold text-white">
              P
            </div>

            <h1 className="text-3xl font-semibold tracking-tight">
              Create your account
            </h1>

            <p className="mt-2 text-sm text-neutral-500">
              เริ่มสร้าง Personal OS ของคุณ
            </p>
          </div>

          <form
            action={signUp}
            className="rounded-3xl border border-black/5 bg-white p-6 shadow-sm"
          >
            {params.error && (
              <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {params.error}
              </div>
            )}

            {params.success && (
              <div className="mb-5 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                {params.success}
              </div>
            )}

            <div className="space-y-5">
              <label className="block">
                <span className="mb-2 block text-sm font-medium">
                  Email
                </span>

                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="h-12 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 outline-none focus:border-neutral-400 focus:bg-white"
                  placeholder="you@example.com"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium">
                  Password
                </span>

                <input
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={6}
                  className="h-12 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 outline-none focus:border-neutral-400 focus:bg-white"
                  placeholder="อย่างน้อย 6 ตัวอักษร"
                />
              </label>

              <button
                type="submit"
                className="h-12 w-full rounded-2xl bg-[#171717] text-sm font-semibold text-white transition hover:bg-black"
              >
                Create account
              </button>
            </div>
          </form>

          <p className="mt-6 text-center text-sm text-neutral-500">
            มีบัญชีอยู่แล้ว?{" "}
            <Link
              href="/auth/login"
              className="font-medium text-[#171717] underline underline-offset-4"
            >
              เข้าสู่ระบบ
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}