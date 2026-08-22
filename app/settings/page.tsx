"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { BarChart3, CheckCircle2, Dumbbell, Home, Loader2, LogOut, MoonStar, Settings as SettingsIcon, Target, WalletCards } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function SettingsPage() {
  const [supabase] = useState(() => createClient());
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [locale, setLocale] = useState("th-TH");
  const [timezone, setTimezone] = useState("Asia/Bangkok");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) {
        window.location.href = "/auth/login?next=/settings";
        return;
      }
      setEmail(user.email ?? "");

      const [profileResult, settingsResult] = await Promise.all([
        supabase.from("profiles").select("id, display_name").eq("id", user.id).maybeSingle(),
        supabase.from("user_settings").select("user_id, locale, timezone").eq("user_id", user.id).maybeSingle(),
      ]);
      if (profileResult.error) throw profileResult.error;
      if (settingsResult.error) throw settingsResult.error;
      setDisplayName(profileResult.data?.display_name ?? "");
      setLocale(settingsResult.data?.locale ?? "th-TH");
      setTimezone(settingsResult.data?.timezone ?? "Asia/Bangkok");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "ไม่สามารถโหลดการตั้งค่าได้");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => { void loadSettings(); }, [loadSettings]);

  async function saveSettings() {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) throw new Error("กรุณาเข้าสู่ระบบ");

      const [profileResult, settingsResult] = await Promise.all([
        supabase.from("profiles").upsert({ id: user.id, display_name: displayName.trim() || null, updated_at: new Date().toISOString() }, { onConflict: "id" }).select("id, display_name").single(),
        supabase.from("user_settings").upsert({ user_id: user.id, locale, timezone, updated_at: new Date().toISOString() }, { onConflict: "user_id" }).select("user_id, locale, timezone").single(),
      ]);
      if (profileResult.error) throw profileResult.error;
      if (settingsResult.error) throw settingsResult.error;
      setDisplayName(profileResult.data.display_name ?? "");
      setLocale(settingsResult.data.locale);
      setTimezone(settingsResult.data.timezone);
      setSuccess("บันทึกการตั้งค่าแล้ว");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "ไม่สามารถบันทึกการตั้งค่าได้");
    } finally {
      setSaving(false);
    }
  }

  async function logout() {
    if (loggingOut) return;
    setLoggingOut(true);
    setError(null);
    try {
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) throw signOutError;
      window.location.href = "/auth/login";
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "ไม่สามารถออกจากระบบได้");
      setLoggingOut(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-950">
      <div className="flex min-h-screen">
        <aside className="hidden w-[240px] shrink-0 border-r border-slate-200 bg-white lg:flex lg:flex-col">
          <div className="px-6 py-7"><div className="text-lg font-bold tracking-tight">PERSONAL OS</div><p className="mt-1 text-xs text-slate-400">Personal productivity system</p></div>
          <nav className="space-y-1 px-3">
            <NavItem icon={<Home size={18} />} label="Today" href="/today" />
            <NavItem icon={<CheckCircle2 size={18} />} label="Tasks" href="/tasks" />
            <NavItem icon={<Target size={18} />} label="Goals" href="/goals" />
            <NavItem icon={<Dumbbell size={18} />} label="Workout" href="/workout" />
            <NavItem icon={<BarChart3 size={18} />} label="Progress" href="/progress" />
            <NavItem icon={<WalletCards size={18} />} label="Payments" href="/payments" />
          </nav>
          <div className="mt-auto px-3 pb-6"><NavItem active icon={<SettingsIcon size={18} />} label="Settings" href="/settings" /></div>
        </aside>

        <main className="min-w-0 flex-1 pb-24 lg:pb-0">
          <div className="mx-auto max-w-[900px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
            <header><p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">SYSTEM</p><h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Settings</h1><p className="mt-2 text-sm text-slate-500">จัดการข้อมูลบัญชีและค่าพื้นฐานของ Personal OS</p></header>

            {error && <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><p className="font-semibold">เกิดข้อผิดพลาด</p><p className="mt-1 break-words">{error}</p></div>}
            {success && <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{success}</div>}

            <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100"><SettingsIcon size={19} /></div><div><h2 className="font-bold">Profile</h2><p className="text-xs text-slate-400">ข้อมูลที่ใช้ระบุตัวคุณในระบบ</p></div></div>
              {loading ? <Loading /> : <div className="mt-6 space-y-5">
                <label className="block"><span className="mb-2 block text-sm font-medium">ชื่อที่แสดง</span><input value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={80} placeholder="ชื่อของคุณ" className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition focus:border-slate-400 focus:bg-white" /></label>
                <div><span className="mb-2 block text-sm font-medium">Email</span><div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-500">{email || "—"}</div><p className="mt-2 text-xs text-slate-400">Email มาจาก Supabase Auth และแก้ไขจากหน้านี้ไม่ได้</p></div>
              </div>}
            </section>

            <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100"><MoonStar size={19} /></div><div><h2 className="font-bold">Preferences</h2><p className="text-xs text-slate-400">ภาษาและ timezone ที่ใช้กับข้อมูลรายวัน</p></div></div>
              {loading ? <Loading /> : <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <label className="block"><span className="mb-2 block text-sm font-medium">ภาษา</span><select value={locale} onChange={(event) => setLocale(event.target.value)} className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-slate-400"><option value="th-TH">ไทย</option><option value="en-US">English</option></select></label>
                <label className="block"><span className="mb-2 block text-sm font-medium">Timezone</span><select value={timezone} onChange={(event) => setTimezone(event.target.value)} className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-slate-400"><option value="Asia/Bangkok">Asia/Bangkok (UTC+7)</option><option value="Asia/Singapore">Asia/Singapore (UTC+8)</option><option value="Asia/Tokyo">Asia/Tokyo (UTC+9)</option><option value="UTC">UTC</option></select></label>
              </div>}
              <button type="button" onClick={() => void saveSettings()} disabled={loading || saving} className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60">{saving && <Loader2 size={16} className="animate-spin" />}{saving ? "กำลังบันทึก..." : "บันทึกการตั้งค่า"}</button>
            </section>

            <section className="mt-6 rounded-3xl border border-red-100 bg-white p-5 shadow-sm sm:p-6"><h2 className="font-bold text-red-700">Account</h2><p className="mt-1 text-sm text-slate-500">ออกจาก session นี้บนอุปกรณ์ปัจจุบัน</p><button type="button" onClick={() => void logout()} disabled={loggingOut} className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-red-200 px-5 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-60">{loggingOut ? <Loader2 size={16} className="animate-spin" /> : <LogOut size={16} />}{loggingOut ? "กำลังออกจากระบบ..." : "ออกจากระบบ"}</button></section>
          </div>
        </main>
      </div>
    </div>
  );
}

function Loading() { return <div className="mt-6 flex items-center gap-2 text-sm text-slate-400"><Loader2 size={17} className="animate-spin" />กำลังโหลด...</div>; }

function NavItem({ icon, label, href, active = false }: { icon: React.ReactNode; label: string; href: string; active?: boolean }) {
  return <Link href={href} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${active ? "bg-slate-100 font-semibold text-slate-950" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"}`}>{icon}{label}</Link>;
}
