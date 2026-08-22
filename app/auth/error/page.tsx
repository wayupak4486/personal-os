import Link from "next/link";

export default function AuthErrorPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F7F7F5] px-5">
      <div className="w-full max-w-md rounded-3xl border border-black/5 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
          !
        </div>

        <h1 className="text-2xl font-semibold">
          Authentication error
        </h1>

        <p className="mt-2 text-sm leading-6 text-neutral-500">
          ลิงก์ยืนยันอาจหมดอายุหรือไม่ถูกต้อง
        </p>

        <Link
          href="/auth/login"
          className="mt-6 inline-flex h-11 items-center justify-center rounded-2xl bg-[#171717] px-5 text-sm font-medium text-white"
        >
          กลับไปเข้าสู่ระบบ
        </Link>
      </div>
    </main>
  );
}