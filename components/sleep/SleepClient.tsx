"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlarmClockCheck,
  ArrowLeft,
  BedDouble,
  Clock3,
  Loader2,
  MoonStar,
  Plus,
  Target,
  TrendingUp,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  computeTargetBedtime,
  formatDurationMinutes,
  formatSignedMinutes,
  formatISODate,
  getSleepHistoryFromLogs,
  getSleepSettingsFromRecord,
  solveSleepStatus,
  type SleepLogRecord,
  type SleepSettings,
  type SleepSettingsRecord,
} from "@/lib/sleep";

type SleepClientProps = {
  initialSettings: SleepSettingsRecord | null;
  initialLogs: SleepLogRecord[];
  initialError: string | null;
};

type SleepFormState = {
  targetWakeTime: string;
  targetDurationHours: number;
};

const defaultForm = (settings: SleepSettings): SleepFormState => ({
  targetWakeTime: settings.targetWakeTime,
  targetDurationHours: settings.targetSleepDurationHours,
});

export default function SleepClient({
  initialSettings,
  initialLogs,
  initialError,
}: SleepClientProps) {
  const [supabase] = useState(() => createClient());

  const [settings, setSettings] = useState<SleepSettings>(() =>
    getSleepSettingsFromRecord(initialSettings)
  );

  const [logs, setLogs] = useState<SleepLogRecord[]>(initialLogs);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState<string | null>(initialError);
  const [success, setSuccess] = useState<string | null>(null);

  const [form, setForm] = useState<SleepFormState>(() =>
    defaultForm(getSleepSettingsFromRecord(initialSettings))
  );

  const [editingId, setEditingId] = useState<string | null>(null);

  const [editingData, setEditingData] = useState<{
    sleep_date: string;
    bedtime: string;
    wake_time: string;
  } | null>(null);

  const refreshSleepData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) {
        throw new Error(authError.message);
      }

      if (!user) {
        throw new Error("กรุณาเข้าสู่ระบบก่อนใช้งาน Sleep Tracking");
      }

      const { data: settingsData, error: settingsError } = await supabase
        .from("sleep_settings")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (settingsError) {
        throw settingsError;
      }

      const derivedSettings = getSleepSettingsFromRecord(settingsData);

      setSettings(derivedSettings);
      setForm(defaultForm(derivedSettings));

      const { data: logData, error: logsError } = await supabase
        .from("sleep_logs")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (logsError) {
        throw logsError;
      }

      setLogs((logData ?? []) as SleepLogRecord[]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "ไม่สามารถโหลดข้อมูล Sleep ได้"
      );
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void refreshSleepData();
    }, 0);

    return () => clearTimeout(timer);
  }, [refreshSleepData]);

  async function handleSaveSettings() {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;

      if (!user) {
        throw new Error("กรุณาเข้าสู่ระบบก่อนบันทึกข้อมูล");
      }

      const targetBedtime = computeTargetBedtime(
        form.targetWakeTime,
        form.targetDurationHours
      );

      const payload = {
        user_id: user.id,
        target_wake_time: form.targetWakeTime,
        target_sleep_duration_hours: form.targetDurationHours,
        target_bedtime: targetBedtime,
      };

      const { data: existingSettings, error: existingError } =
        await supabase
          .from("sleep_settings")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();

      if (existingError) throw existingError;

      let savedSettings: SleepSettingsRecord | null = null;

      if (existingSettings?.id) {
        const { data, error } = await supabase
          .from("sleep_settings")
          .update(payload)
          .eq("id", existingSettings.id)
          .eq("user_id", user.id)
          .select("*")
          .single();

        if (error) throw error;

        savedSettings = data as SleepSettingsRecord;
      } else {
        const { data, error } = await supabase
          .from("sleep_settings")
          .insert(payload)
          .select("*")
          .single();

        if (error) throw error;

        savedSettings = data as SleepSettingsRecord;
      }

      const nextSettings = getSleepSettingsFromRecord(savedSettings);

      setSettings(nextSettings);
      setForm(defaultForm(nextSettings));

      setSuccess("บันทึกเป้าหมายการนอนแล้ว");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "ไม่สามารถบันทึกการตั้งค่าได้"
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleStartSleep() {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;

      if (!user) {
        throw new Error("กรุณาเข้าสู่ระบบก่อนบันทึกการเข้านอน");
      }

      // อนุญาตให้มีหลาย session ที่เสร็จแล้วในวันเดียว
      // แต่ห้ามมี session ที่กำลังนอนอยู่พร้อมกัน
      const { data: activeLogs, error: activeError } =
        await supabase
          .from("sleep_logs")
          .select("id, status, bedtime")
          .eq("user_id", user.id)
          .eq("status", "sleeping")
          .limit(1);

      if (activeError) {
        throw new Error(
          `ตรวจสอบสถานะการนอนไม่สำเร็จ: ${activeError.message}`
        );
      }

      if (activeLogs && activeLogs.length > 0) {
        throw new Error(
          "มีเซสชันการนอนที่กำลังเปิดอยู่แล้ว กรุณากด 'ฉันตื่นแล้ว' ก่อน"
        );
      }

      const now = new Date();

      const payload = {
        user_id: user.id,
        sleep_date: formatISODate(now),
        bedtime: now.toISOString(),
        wake_time: null,
        duration_minutes: null,
        status: "sleeping",
      };

      const { data, error: insertError } = await supabase
        .from("sleep_logs")
        .insert(payload)
        .select("*")
        .single();

      if (insertError) {
        throw new Error(
          `บันทึกเวลาเข้านอนไม่สำเร็จ: ${insertError.message}`
        );
      }

      setLogs((current) => [
        data as SleepLogRecord,
        ...current,
      ]);

      setSuccess("เริ่มเซสชันการนอนใหม่แล้ว");

      await refreshSleepData();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "ไม่สามารถเริ่มการนอนได้"
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleWakeUp() {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;

      if (!user) {
        throw new Error("กรุณาเข้าสู่ระบบก่อนบันทึกการตื่น");
      }

      const { data: active, error: activeError } =
        await supabase
          .from("sleep_logs")
          .select("*")
          .eq("user_id", user.id)
          .eq("status", "sleeping")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

      if (activeError) {
        throw activeError;
      }

      if (!active?.id) {
        throw new Error("ไม่พบเซสชันการนอนที่กำลังเปิดอยู่");
      }

      const now = new Date();

      const bedtime =
        typeof active.bedtime === "string"
          ? new Date(active.bedtime)
          : null;

      if (!bedtime || Number.isNaN(bedtime.getTime())) {
        throw new Error("เวลาเข้านอนไม่ถูกต้อง");
      }

      const durationMinutes = Math.max(
        0,
        Math.round(
          (now.getTime() - bedtime.getTime()) / 60000
        )
      );

      const { data, error: updateError } = await supabase
        .from("sleep_logs")
        .update({
          wake_time: now.toISOString(),
          duration_minutes: durationMinutes,
          status: "completed",
        })
        .eq("id", active.id)
        .eq("user_id", user.id)
        .eq("status", "sleeping")
        .select("*")
        .single();

      if (updateError) {
        throw new Error(
          `บันทึกเวลาตื่นไม่สำเร็จ: ${updateError.message}`
        );
      }

      setLogs((current) =>
        current.map((item) =>
          item.id === active.id
            ? (data as SleepLogRecord)
            : item
        )
      );

      setSuccess(
        `บันทึกเวลาตื่นแล้ว (${formatDurationMinutes(durationMinutes)})`
      );

      await refreshSleepData();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "ไม่สามารถบันทึกการตื่นได้"
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleEditSave(rowId: string) {
    if (!editingData) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;

      if (!user) {
        throw new Error("กรุณาเข้าสู่ระบบก่อนแก้ไขข้อมูล");
      }

      const existingLog = logs.find(
        (item) => item.id === rowId
      );

      const dateKey =
        editingData.sleep_date ||
        existingLog?.sleep_date ||
        formatISODate(new Date());

      const bedtimeDate = new Date(
        `${dateKey}T${editingData.bedtime}:00`
      );

      const wakeDate = new Date(
        `${dateKey}T${editingData.wake_time}:00`
      );

      if (
        Number.isNaN(bedtimeDate.getTime()) ||
        Number.isNaN(wakeDate.getTime())
      ) {
        throw new Error("วันหรือเวลาไม่ถูกต้อง");
      }

      // รองรับการนอนข้ามวัน
      if (wakeDate.getTime() <= bedtimeDate.getTime()) {
        wakeDate.setDate(wakeDate.getDate() + 1);
      }

      const durationMinutes = Math.round(
        (wakeDate.getTime() - bedtimeDate.getTime()) / 60000
      );

      const { data, error } = await supabase
        .from("sleep_logs")
        .update({
          sleep_date: dateKey,
          bedtime: bedtimeDate.toISOString(),
          wake_time: wakeDate.toISOString(),
          duration_minutes: durationMinutes,
          status: "completed",
        })
        .eq("id", rowId)
        .eq("user_id", user.id)
        .select("*")
        .single();

      if (error) throw error;

      setLogs((current) =>
        current.map((item) =>
          item.id === rowId
            ? (data as SleepLogRecord)
            : item
        )
      );

      setEditingId(null);
      setEditingData(null);

      setSuccess("แก้ไขประวัติการนอนแล้ว");

      await refreshSleepData();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "ไม่สามารถแก้ไขข้อมูลได้"
      );
    } finally {
      setSaving(false);
    }
  }

  const summary = solveSleepStatus(logs, settings);
  const history = getSleepHistoryFromLogs(logs, settings);

  const statusPanel = loading
    ? "กำลังโหลดข้อมูล"
    : summary.status === "NO_SLEEP"
      ? "ยังไม่ได้เข้านอน"
      : summary.status === "SLEEPING"
        ? "กำลังนอน"
        : "นอนรอบล่าสุดเสร็จแล้ว";

  const canStartNewSleep = summary.status !== "SLEEPING";

  return (
    <main className="min-h-screen bg-[#f6f8fb] text-slate-900">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">

        <header className="mb-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600"
            >
              <ArrowLeft size={18} />
            </Link>

            <div>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
                Personal OS
              </p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight">
                Sleep
              </h1>
            </div>
          </div>

          <Link
            href="/"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700"
          >
            กลับหน้า Today
          </Link>
        </header>

        {error && (
          <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {success}
          </div>
        )}

        <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#edf4ff] text-[#2452c5]">
                  <MoonStar size={20} />
                </div>

                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                    Sleep settings
                  </p>
                  <h2 className="mt-1 text-lg font-semibold">
                    เป้าหมายการนอน
                  </h2>
                </div>
              </div>

              {saving && (
                <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
              )}
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-600">
                  เวลาตื่นเป้าหมาย
                </span>

                <input
                  type="time"
                  value={form.targetWakeTime}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      targetWakeTime: event.target.value,
                    }))
                  }
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 outline-none focus:border-sky-400 focus:bg-white"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-600">
                  จำนวนเวลานอนเป้าหมาย
                </span>

                <div className="flex h-12 items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3">
                  <input
                    type="number"
                    min={4}
                    max={12}
                    value={form.targetDurationHours}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        targetDurationHours:
                          Number(event.target.value) || 8,
                      }))
                    }
                    className="w-full bg-transparent outline-none"
                  />

                  <span className="text-sm text-slate-500">
                    ชั่วโมง
                  </span>
                </div>
              </label>
            </div>

            <div className="mt-5 rounded-2xl border border-sky-100 bg-sky-50/60 p-4">
              <div className="flex items-center justify-between text-sm text-slate-600">
                <span>เวลาเข้านอนเป้าหมาย</span>

                <span className="text-base font-bold text-slate-900">
                  {computeTargetBedtime(
                    form.targetWakeTime,
                    form.targetDurationHours
                  )}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => void handleSaveSettings()}
              disabled={saving}
              className="mt-6 inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus size={16} />
              )}

              บันทึกเป้าหมายการนอน
            </button>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">

            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#edf7f3] text-[#1f7a5a]">
                <Target size={20} />
              </div>

              <div>
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                  Status
                </p>

                <h2 className="mt-1 text-lg font-semibold">
                  {statusPanel}
                </h2>
              </div>
            </div>

            <div className="mt-6 space-y-4">

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between text-sm text-slate-500">
                  <span>เวลาเข้านอนเป้าหมาย</span>

                  <span className="font-semibold text-slate-900">
                    {settings.targetBedtime}
                  </span>
                </div>
              </div>

              {summary.status === "SLEEPING" && (
                <>
                  <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm text-amber-700">
                    <div className="flex items-center justify-between">
                      <span>เวลาเข้านอนจริง</span>

                      <span className="font-semibold">
                        {summary.actualBedtime ?? "—"}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => void handleWakeUp()}
                    disabled={saving}
                    className="w-full rounded-2xl bg-[#0f172a] px-4 py-4 text-base font-semibold text-white hover:bg-black disabled:opacity-60"
                  >
                    {saving ? "กำลังบันทึก..." : "ฉันตื่นแล้ว"}
                  </button>
                </>
              )}

              {canStartNewSleep && (
                <button
                  type="button"
                  onClick={() => void handleStartSleep()}
                  disabled={saving}
                  className="w-full rounded-2xl bg-[#2452c5] px-4 py-4 text-base font-semibold text-white shadow-sm hover:bg-[#1d45ac] disabled:opacity-60"
                >
                  {saving
                    ? "กำลังบันทึก..."
                    : summary.status === "COMPLETED"
                      ? "เข้านอนรอบใหม่"
                      : "เข้านอน"}
                </button>
              )}

              {summary.status === "COMPLETED" && (
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-700">
                  <div className="flex items-center justify-between">
                    <span>รอบล่าสุด</span>

                    <span className="font-semibold">
                      {formatDurationMinutes(
                        summary.durationMinutes
                      )}
                    </span>
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <span>เข้านอนจริง</span>

                    <span className="font-semibold">
                      {summary.actualBedtime ?? "—"}
                    </span>
                  </div>

                  <div className="mt-2 flex items-center justify-between">
                    <span>ตื่นจริง</span>

                    <span className="font-semibold">
                      {summary.actualWakeTime ?? "—"}
                    </span>
                  </div>

                  <p className="mt-3 text-xs text-emerald-600">
                    สามารถเริ่มรอบการนอนใหม่ได้
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">

            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                  Sleep summary
                </p>

                <h2 className="mt-1 text-lg font-semibold">
                  ภาพรวมการนอน
                </h2>
              </div>

              <div className="rounded-xl bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-600">
                {summary.durationStatusLabel}
              </div>
            </div>

            {summary.status === "NO_SLEEP" ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
                <p className="text-base font-semibold text-slate-700">
                  รอการบันทึก
                </p>
              </div>
            ) : (
              <div className="space-y-4">

                <div className="grid gap-3 sm:grid-cols-2">
                  <InfoTile
                    icon={<BedDouble size={16} />}
                    label="เข้านอน"
                    value={
                      summary.actualBedtime ??
                      summary.targetBedtime
                    }
                  />

                  <InfoTile
                    icon={<AlarmClockCheck size={16} />}
                    label="ตื่น"
                    value={
                      summary.actualWakeTime ??
                      summary.targetWakeTime
                    }
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-3">

                  <InfoTile
                    icon={<Clock3 size={16} />}
                    label="ระยะเวลานอน"
                    value={
                      summary.durationMinutes !== null
                        ? formatDurationMinutes(
                            summary.durationMinutes
                          )
                        : "—"
                    }
                  />

                  <InfoTile
                    icon={<Target size={16} />}
                    label="เป้าหมาย"
                    value={`${settings.targetSleepDurationHours} ชม.`}
                  />

                  <InfoTile
                    icon={<TrendingUp size={16} />}
                    label="เวลาตื่น"
                    value={summary.wakeTimingLabel}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">

            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                  History
                </p>

                <h2 className="mt-1 text-lg font-semibold">
                  ประวัติการนอน
                </h2>
              </div>

              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                <Zap size={18} />
              </div>
            </div>

            <div className="mt-5 space-y-3">

              {history.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
                  ยังไม่มีประวัติการนอน
                </div>
              ) : (
                history.slice(0, 10).map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-slate-700">
                        {item.date || "—"}
                      </span>

                      <span className="text-[11px] font-medium text-slate-500">
                        {item.status === "COMPLETED"
                          ? "เสร็จสิ้น"
                          : item.status === "SLEEPING"
                            ? "กำลังนอน"
                            : "ยังไม่ได้เริ่ม"}
                      </span>
                    </div>

                    <div className="mt-3 flex items-center justify-between text-sm text-slate-600">
                      <span>{item.bedtime}</span>
                      <span>→</span>
                      <span>{item.wakeTime}</span>
                    </div>

                    <div className="mt-3 space-y-1 text-sm text-slate-600">

                      <div className="flex justify-between">
                        <span>ระยะเวลานอน</span>

                        <span>
                          {item.durationMinutes !== null
                            ? formatDurationMinutes(
                                item.durationMinutes
                              )
                            : "—"}
                        </span>
                      </div>

                      <div className="flex justify-between">
                        <span>เป้าหมาย</span>

                        <span>
                          {formatDurationMinutes(
                            item.targetDurationMinutes
                          )}
                        </span>
                      </div>

                      {item.diffMinutes !== null && (
                        <div className="flex justify-between">
                          <span>ความแตกต่าง</span>

                          <span
                            className={
                              item.diffMinutes <= 0
                                ? "text-emerald-600"
                                : "text-amber-600"
                            }
                          >
                            {formatSignedMinutes(
                              item.diffMinutes
                            )}
                          </span>
                        </div>
                      )}
                    </div>

                    {item.status === "COMPLETED" && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(item.id);

                          setEditingData({
                            sleep_date:
                              item.date ||
                              formatISODate(new Date()),

                            bedtime:
                              item.bedtime === "—"
                                ? "22:30"
                                : item.bedtime,

                            wake_time:
                              item.wakeTime === "—"
                                ? "06:30"
                                : item.wakeTime,
                          });
                        }}
                        className="mt-3 text-xs font-medium text-sky-700"
                      >
                        แก้ไขข้อมูล
                      </button>
                    )}

                    {editingId === item.id &&
                      editingData && (
                        <div className="mt-3 space-y-2 rounded-2xl border border-slate-200 bg-white p-3">

                          <input
                            type="date"
                            value={editingData.sleep_date}
                            onChange={(event) =>
                              setEditingData((current) =>
                                current
                                  ? {
                                      ...current,
                                      sleep_date:
                                        event.target.value,
                                    }
                                  : current
                              )
                            }
                            className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5"
                          />

                          <input
                            type="time"
                            value={editingData.bedtime}
                            onChange={(event) =>
                              setEditingData((current) =>
                                current
                                  ? {
                                      ...current,
                                      bedtime:
                                        event.target.value,
                                    }
                                  : current
                              )
                            }
                            className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5"
                          />

                          <input
                            type="time"
                            value={editingData.wake_time}
                            onChange={(event) =>
                              setEditingData((current) =>
                                current
                                  ? {
                                      ...current,
                                      wake_time:
                                        event.target.value,
                                    }
                                  : current
                              )
                            }
                            className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5"
                          />

                          <div className="flex gap-2 pt-1">

                            <button
                              type="button"
                              onClick={() =>
                                void handleEditSave(item.id)
                              }
                              disabled={saving}
                              className="flex-1 rounded-xl bg-slate-950 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                            >
                              บันทึก
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setEditingId(null);
                                setEditingData(null);
                              }}
                              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
                            >
                              ยกเลิก
                            </button>

                          </div>
                        </div>
                      )}
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function InfoTile({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center gap-2 text-slate-500">
        {icon}
        <span className="text-xs font-medium uppercase tracking-[0.18em]">
          {label}
        </span>
      </div>

      <p className="mt-3 text-base font-semibold text-slate-900">
        {value}
      </p>
    </div>
  );
}
