/* =========================================================
   Sleep status
   ========================================================= */

/**
 * ระบบรองรับหลาย completed sessions
 * ในวันเดียวกัน
 *
 * ตัวอย่าง:
 *
 * 01:00 - 07:00 = completed
 * 14:00 - 15:00 = completed
 *
 * completed session ไม่ถือว่า active
 * จึงสามารถเริ่มรอบใหม่ได้
 *
 * IMPORTANT:
 * Today และหน้า Sleep ต้องใช้
 * session ล่าสุดจาก logs ชุดเดียวกัน
 *
 * ไม่บังคับ completed session
 * ให้ตรงกับ sleep_date ของ calendar day
 * เพราะ session อาจเริ่มก่อนเที่ยงคืน
 * และตื่นหลังเที่ยงคืน
 */
export function solveSleepStatus(
  logs: SleepLogRecord[],
  settings: SleepSettings,
  _date: Date = new Date(),
): SleepSummary {
  void _date;

  /* ---------------------------------------------------------
     1. ถ้ามี session ที่กำลังนอน
     --------------------------------------------------------- */

  const activeSession = getActiveSleepSession(logs);

  if (activeSession) {
    const actualBedtimeValue =
      activeSession.bedtime || activeSession.created_at || null;

    const actualBedtime = actualBedtimeValue
      ? formatClockTime(actualBedtimeValue)
      : null;

    return {
      status: "SLEEPING",
      actualBedtime,
      actualWakeTime: null,
      durationMinutes: null,
      durationText: null,
      targetDurationMinutes: settings.targetDurationMinutes,
      targetDurationText: formatDurationMinutes(settings.targetDurationMinutes),
      sleepDebtMinutes: null,
      quality: null,
    };
  }

  const completedSessions = logs
    .filter((log) => log.status === "completed")
    .sort((a, b) => {
      const aTime = a.wake_time || a.created_at || a.bedtime || "";
      const bTime = b.wake_time || b.created_at || b.bedtime || "";
      return bTime.localeCompare(aTime);
    });

  const latestSession = completedSessions[0] ?? null;

  if (!latestSession) {
    return {
      status: "AWAKE",
      actualBedtime: null,
      actualWakeTime: null,
      durationMinutes: null,
      durationText: null,
      targetDurationMinutes: settings.targetDurationMinutes,
      targetDurationText: formatDurationMinutes(settings.targetDurationMinutes),
      sleepDebtMinutes: null,
      quality: null,
    };
  }

  const durationMinutes = normalizeDuration(latestSession.duration_minutes);
  const actualBedtime = latestSession.bedtime
    ? formatClockTime(latestSession.bedtime)
    : null;
  const actualWakeTime = latestSession.wake_time
    ? formatClockTime(latestSession.wake_time)
    : null;

  return {
    status: "AWAKE",
    actualBedtime,
    actualWakeTime,
    durationMinutes,
    durationText:
      durationMinutes === null
        ? null
        : formatDurationMinutes(durationMinutes),
    targetDurationMinutes: settings.targetDurationMinutes,
    targetDurationText: formatDurationMinutes(settings.targetDurationMinutes),
    sleepDebtMinutes:
      durationMinutes === null
        ? null
        : Math.max(0, settings.targetDurationMinutes - durationMinutes),
    quality: durationMinutes === null ? null : getSleepQuality(durationMinutes, settings),
  };
}
