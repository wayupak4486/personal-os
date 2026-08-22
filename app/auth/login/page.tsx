import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type LoginPageProps = {
  searchParams: Promise<{
    next?: string;
    error?: string;
  }>;
};

export default async function LoginPage({
  searchParams,
}: LoginPageProps) {
  const params = await searchParams;

  async function login(formData: FormData) {
    "use server";

    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    if (!email || !password) {
      redirect("/auth/login?error=กรุณากรอกอีเมลและรหัสผ่าน");
    }

    const supabase = await createClient();

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      redirect(
        `/auth/login?error=${encodeURIComponent(
          "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
        )}`,
      );
    }

    const next =
      params.next && params.next.startsWith("/")
        ? params.next
        : "/tasks";

    redirect(next);
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
              Welcome back
            </h1>

            <p className="mt-2 text-sm text-neutral-500">
              เข้าสู่ Personal OS ของคุณ
            </p>
          </div>

          <form
            action={login}
            className="rounded-3xl border border-black/5 bg-white p-6 shadow-sm"
          >
            {params.error && (
              <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {params.error}
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
                  className="h-12 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 outline-none transition focus:border-neutral-400 focus:bg-white"
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
                  autoComplete="current-password"
                  required
                  minLength={6}
                  className="h-12 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 outline-none transition focus:border-neutral-400 focus:bg-white"
                  placeholder="••••••••"
                />
              </label>

              <button
                type="submit"
                className="h-12 w-full rounded-2xl bg-[#171717] text-sm font-semibold text-white transition hover:bg-black active:scale-[0.99]"
              >
                Sign in
              </button>
            </div>
          </form>

          <p className="mt-6 text-center text-sm text-neutral-500">
            ยังไม่มีบัญชี?{" "}
            <Link
              href="/auth/sign-up"
              className="font-medium text-[#171717] underline underline-offset-4"
            >
              สร้างบัญชี
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}