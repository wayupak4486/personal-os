export type SleepStatus =
  | "sleeping"
  | "completed"
  | "cancelled";

export type SleepLogRecord = {
  id: string;
  user_id: string;

  // วันที่เริ่มต้นของ session
  sleep_date?: string | null;

  bedtime: string | null;
  wake_time: string | null;

  // Supabase บางกรณีอาจคืนค่าเป็น string
  duration_minutes: number | string | null;

  status: SleepStatus;

  created_at: string;
  updated_at?: string | null;
};

export type SleepSettingsRecord = {
  id: string;
  user_id: string;

  // schema เดิม
  target_minutes?: number | null;

  // schema ใหม่
  target_wake_time?: string | null;
  target_sleep_duration_hours?: number | null;
  target_bedtime?: string | null;

  created_at?: string;
  updated_at?: string;
};

export type SleepSettings = {
  targetWakeTime: string;
  targetSleepDurationHours: number;
  targetSleepDurationMinutes: number;
  targetBedtime: string;
};

export type SleepSummaryStatus =
  | "NO_SLEEP"
  | "SLEEPING"
  | "COMPLETED";

export type SleepSummary = {
  status: SleepSummaryStatus;

  actualBedtime: string | null;
  actualWakeTime: string | null;

  durationMinutes: number | null;

  targetBedtime: string;
  targetWakeTime: string;

  targetDurationMinutes: number;

  durationDifferenceMinutes: number | null;

  durationStatusLabel: string;
  wakeTimingLabel: string;
};

export type SleepHistoryItem = {
  id: string;
  date: string;

  bedtime: string;
  wakeTime: string;

  durationMinutes: number | null;

  targetDurationMinutes: number;

  diffMinutes: number | null;

  status: SleepSummaryStatus;
};

/* =========================================================
   Basic helpers
   ========================================================= */

export function secondsToMinutes(seconds: number): number {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return 0;
  }

  return Math.max(0, Math.round(seconds / 60));
}

export function formatISODate(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function formatClockTime(
  value: string | Date | null | undefined,
): string {
  if (!value) {
    return "—";
  }

  const date =
    value instanceof Date
      ? value
      : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/* =========================================================
   Number normalization
   ========================================================= */

/**
 * Normalize duration values coming from Supabase.
 *
 * รองรับ:
 * - number
 * - numeric string
 * - null
 * - undefined
 */
export function normalizeDuration(
  value: number | string | null | undefined,
): number | null {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const numberValue =
    typeof value === "number"
      ? value
      : Number(value);

  if (!Number.isFinite(numberValue)) {
    return null;
  }

  return Math.max(0, Math.round(numberValue));
}

/* =========================================================
   Duration
   ========================================================= */

export function calculateSleepDuration(
  bedtime: string,
  wakeTime: string,
): number {
  const start = new Date(bedtime).getTime();
  const end = new Date(wakeTime).getTime();

  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end)
  ) {
    return 0;
  }

  if (end <= start) {
    return 0;
  }

  return Math.round(
    (end - start) / 60000,
  );
}

export function formatSleepDuration(
  minutes: number | string | null | undefined,
): string {
  const normalized = normalizeDuration(minutes);

  if (normalized === null || normalized <= 0) {
    return "0 นาที";
  }

  const hours = Math.floor(
    normalized / 60,
  );

  const remainingMinutes =
    normalized % 60;

  if (hours === 0) {
    return `${remainingMinutes} นาที`;
  }

  if (remainingMinutes === 0) {
    return `${hours} ชม.`;
  }

  return `${hours} ชม. ${remainingMinutes} นาที`;
}

// Alias ที่ UI ใช้อยู่
export function formatDurationMinutes(
  minutes: number | string | null | undefined,
): string {
  return formatSleepDuration(minutes);
}

export function formatSignedMinutes(
  minutes: number | string | null | undefined,
): string {
  const normalized =
    normalizeDuration(minutes);

  if (normalized === null) {
    return "—";
  }

  const sign =
    normalized > 0 ? "+" : "";

  return `${sign}${normalized} นาที`;
}

/* =========================================================
   Sleep settings
   ========================================================= */

export function computeTargetBedtime(
  targetWakeTime: string,
  targetDurationHours: number,
): string {
  if (!targetWakeTime) {
    return "22:30";
  }

  const [
    hoursString,
    minutesString,
  ] = targetWakeTime.split(":");

  const hours = Number(hoursString);
  const minutes = Number(minutesString);

  if (
    !Number.isFinite(hours) ||
    !Number.isFinite(minutes)
  ) {
    return "22:30";
  }

  const durationMinutes =
    Math.round(
      targetDurationHours * 60,
    );

  let totalMinutes =
    hours * 60 +
    minutes -
    durationMinutes;

  while (totalMinutes < 0) {
    totalMinutes += 24 * 60;
  }

  while (totalMinutes >= 24 * 60) {
    totalMinutes -= 24 * 60;
  }

  const bedtimeHours =
    Math.floor(totalMinutes / 60);

  const bedtimeMinutes =
    totalMinutes % 60;

  return `${String(
    bedtimeHours,
  ).padStart(2, "0")}:${String(
    bedtimeMinutes,
  ).padStart(2, "0")}`;
}

export function getSleepSettingsFromRecord(
  record:
    | SleepSettingsRecord
    | null
    | undefined,
): SleepSettings {
  const defaultWakeTime = "07:00";
  const defaultDurationHours = 8;

  if (!record) {
    return {
      targetWakeTime: defaultWakeTime,
      targetSleepDurationHours:
        defaultDurationHours,
      targetSleepDurationMinutes:
        defaultDurationHours * 60,
      targetBedtime:
        computeTargetBedtime(
          defaultWakeTime,
          defaultDurationHours,
        ),
    };
  }

  const targetWakeTime =
    record.target_wake_time ||
    defaultWakeTime;

  let targetDurationMinutes: number;

  if (
    record.target_sleep_duration_hours !==
      null &&
    record.target_sleep_duration_hours !==
      undefined &&
    Number.isFinite(
      Number(
        record.target_sleep_duration_hours,
      ),
    )
  ) {
    targetDurationMinutes =
      Math.round(
        Number(
          record.target_sleep_duration_hours,
        ) * 60,
      );
  } else if (
    record.target_minutes !== null &&
    record.target_minutes !==
      undefined &&
    Number.isFinite(
      Number(record.target_minutes),
    ) &&
    Number(record.target_minutes) > 0
  ) {
    targetDurationMinutes =
      Math.round(
        Number(record.target_minutes),
      );
  } else {
    targetDurationMinutes =
      defaultDurationHours * 60;
  }

  const targetSleepDurationHours =
    targetDurationMinutes / 60;

  const targetBedtime =
    record.target_bedtime ||
    computeTargetBedtime(
      targetWakeTime,
      targetSleepDurationHours,
    );

  return {
    targetWakeTime,
    targetSleepDurationHours,
    targetSleepDurationMinutes:
      targetDurationMinutes,
    targetBedtime,
  };
}

/* =========================================================
   Session state
   ========================================================= */

export function isSleepSessionActive(
  log:
    | SleepLogRecord
    | null
    | undefined,
): boolean {
  return log?.status === "sleeping";
}

export function isSleepSessionCompleted(
  log:
    | SleepLogRecord
    | null
    | undefined,
): boolean {
  return log?.status === "completed";
}

export function getActiveSleepSession(
  logs: SleepLogRecord[],
): SleepLogRecord | null {
  return (
    logs.find(
      (log) =>
        log.status === "sleeping",
    ) ?? null
  );
}

/**
 * คืน logs ที่เริ่ม session ในวันที่กำหนด
 *
 * ใช้ sleep_date ก่อน
 * ถ้าไม่มีจึง fallback ไป created_at
 */
export function getSleepLogsForDate(
  logs: SleepLogRecord[],
  date: Date,
): SleepLogRecord[] {
  const targetDate =
    formatISODate(date);

  return logs.filter((log) => {
    if (log.sleep_date) {
      return (
        log.sleep_date ===
        targetDate
      );
    }

    if (!log.created_at) {
      return false;
    }

    const createdDate =
      new Date(log.created_at);

    if (
      Number.isNaN(
        createdDate.getTime(),
      )
    ) {
      return false;
    }

    return (
      formatISODate(
        createdDate,
      ) === targetDate
    );
  });
}

export function getTotalSleepMinutes(
  logs: SleepLogRecord[],
): number {
  return logs.reduce(
    (total, log) => {
      if (
        log.status !== "completed"
      ) {
        return total;
      }

      const duration =
        normalizeDuration(
          log.duration_minutes,
        );

      if (
        duration === null ||
        duration <= 0
      ) {
        return total;
      }

      return total + duration;
    },
    0,
  );
}

export function calculateSleepProgress(
  totalMinutes: number,
  targetMinutes: number,
): number {
  if (
    !Number.isFinite(totalMinutes) ||
    !Number.isFinite(targetMinutes) ||
    targetMinutes <= 0
  ) {
    return 0;
  }

  return Math.min(
    100,
    Math.round(
      (totalMinutes /
        targetMinutes) *
        100,
    ),
  );
}

export function canStartSleep(
  logs: SleepLogRecord[],
): boolean {
  return (
    getActiveSleepSession(logs) ===
    null
  );
}

export function createSleepStartPayload(
  userId: string,
  bedtime: Date = new Date(),
) {
  return {
    user_id: userId,
    sleep_date:
      formatISODate(bedtime),
    bedtime:
      bedtime.toISOString(),
    wake_time: null,
    duration_minutes: null,
    status:
      "sleeping" as const,
  };
}

export function createSleepEndPayload(
  bedtime: string,
  wakeTime: Date = new Date(),
) {
  const wakeTimeIso =
    wakeTime.toISOString();

  return {
    wake_time: wakeTimeIso,
    duration_minutes:
      calculateSleepDuration(
        bedtime,
        wakeTimeIso,
      ),
    status:
      "completed" as const,
  };
}

/**
 * หา log ล่าสุดจากเวลาที่เกี่ยวข้องกับ session จริง
 *
 * ลำดับความสำคัญ:
 * wake_time
 * updated_at
 * bedtime
 * created_at
 */
export function getLatestSleepLog(
  logs: SleepLogRecord[],
): SleepLogRecord | null {
  if (logs.length === 0) {
    return null;
  }

  return (
    [...logs].sort(
      (a, b) =>
        getSleepLogTimestamp(b) -
        getSleepLogTimestamp(a),
    )[0] ?? null
  );
}

function getSleepLogTimestamp(
  log: SleepLogRecord,
): number {
  const values = [
    log.wake_time,
    log.updated_at,
    log.bedtime,
    log.created_at,
  ];

  for (const value of values) {
    if (!value) {
      continue;
    }

    const timestamp =
      new Date(value).getTime();

    if (Number.isFinite(timestamp)) {
      return timestamp;
    }
  }

  return 0;
}

export function getCompletedSleepSessionCount(
  logs: SleepLogRecord[],
): number {
  return logs.filter(
    (log) =>
      log.status ===
      "completed",
  ).length;
}

export function hasSleepToday(
  logs: SleepLogRecord[],
  date: Date = new Date(),
): boolean {
  return getSleepLogsForDate(
    logs,
    date,
  ).some(
    (log) =>
      log.status ===
      "completed",
  );
}

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
  /* ---------------------------------------------------------
     1. ถ้ามี session ที่กำลังนอน
     --------------------------------------------------------- */

  const activeSession =
    getActiveSleepSession(logs);

  if (activeSession) {
    const actualBedtimeValue =
      activeSession.bedtime ||
      activeSession.created_at ||
      null;

    const actualBedtime =
      actualBedtimeValue
        ? formatClockTime(
            actualBedtimeValue,
          )
        : null;

    return {
      status: "SLEEPING",

      actualBedtime,
      actualWakeTime: null,

      durationMinutes: null,

      targetBedtime:
        settings.targetBedtime,

      targetWakeTime:
        settings.targetWakeTime,

      targetDurationMinutes:
        settings.targetSleepDurationMinutes,

      durationDifferenceMinutes:
        null,

      durationStatusLabel:
        "กำลังนอน",

      wakeTimingLabel:
        "กำลังนอน",
    };
  }

  /* ---------------------------------------------------------
     2. หา completed session ล่าสุด
     --------------------------------------------------------- */

  const completedSessions =
    logs
      .filter(
        (log) =>
          log.status ===
            "completed" &&
          normalizeDuration(
            log.duration_minutes,
          ) !== null,
      )
      .sort(
        (a, b) =>
          getSleepLogTimestamp(b) -
          getSleepLogTimestamp(a),
      );

  const latest =
    completedSessions[0] ??
    null;

  /* ---------------------------------------------------------
     3. ยังไม่มีข้อมูล
     --------------------------------------------------------- */

  if (!latest) {
    return {
      status: "NO_SLEEP",

      actualBedtime: null,
      actualWakeTime: null,

      durationMinutes: null,

      targetBedtime:
        settings.targetBedtime,

      targetWakeTime:
        settings.targetWakeTime,

      targetDurationMinutes:
        settings.targetSleepDurationMinutes,

      durationDifferenceMinutes:
        null,

      durationStatusLabel:
        "ยังไม่ได้เข้านอน",

      wakeTimingLabel:
        "ยังไม่มีข้อมูล",
    };
  }

  /* ---------------------------------------------------------
     4. Completed session ล่าสุด
     --------------------------------------------------------- */

  const durationMinutes =
    normalizeDuration(
      latest.duration_minutes,
    );

  const actualBedtimeValue =
    latest.bedtime ||
    latest.created_at ||
    null;

  const actualWakeTimeValue =
    latest.wake_time ||
    latest.updated_at ||
    null;

  const actualBedtime =
    actualBedtimeValue
      ? formatClockTime(
          actualBedtimeValue,
        )
      : null;

  const actualWakeTime =
    actualWakeTimeValue
      ? formatClockTime(
          actualWakeTimeValue,
        )
      : null;

  const difference =
    durationMinutes !== null
      ? durationMinutes -
        settings.targetSleepDurationMinutes
      : null;

  return {
    status: "COMPLETED",

    actualBedtime,
    actualWakeTime,

    durationMinutes,

    targetBedtime:
      settings.targetBedtime,

    targetWakeTime:
      settings.targetWakeTime,

    targetDurationMinutes:
      settings.targetSleepDurationMinutes,

    durationDifferenceMinutes:
      difference,

    durationStatusLabel:
      difference === null
        ? "มีข้อมูลแล้ว"
        : difference >= 0
          ? "นอนถึงเป้าหมาย"
          : "นอนน้อยกว่าเป้าหมาย",

    wakeTimingLabel:
      getWakeTimingLabel(
        actualWakeTimeValue,
        settings.targetWakeTime,
      ),
  };
}

/* =========================================================
   Wake timing
   ========================================================= */

function getWakeTimingLabel(
  actualWakeTime: string | null,
  targetWakeTime: string,
): string {
  if (!actualWakeTime) {
    return "—";
  }

  const formattedActualWakeTime =
    formatClockTime(
      actualWakeTime,
    );

  const actual =
    getMinutesFromTime(
      formattedActualWakeTime,
    );

  const target =
    getMinutesFromTime(
      targetWakeTime,
    );

  if (
    actual === null ||
    target === null
  ) {
    return "—";
  }

  let diff =
    actual - target;

  /**
   * รองรับกรณีข้ามเที่ยงคืน
   *
   * เช่น
   * target = 07:00
   * actual = 06:50
   *
   * หรือ
   * target = 23:30
   * actual = 00:10
   */
  if (diff > 720) {
    diff -= 1440;
  }

  if (diff < -720) {
    diff += 1440;
  }

  if (Math.abs(diff) <= 5) {
    return "ตรงเวลา";
  }

  if (diff < 0) {
    return `เร็ว ${Math.abs(diff)} นาที`;
  }

  return `ช้า ${diff} นาที`;
}

function getMinutesFromTime(
  value: string,
): number | null {
  const match =
    value.match(
      /^(\d{1,2}):(\d{2})$/,
    );

  if (!match) {
    return null;
  }

  const hours =
    Number(match[1]);

  const minutes =
    Number(match[2]);

  if (
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }

  return (
    hours * 60 + minutes
  );
}

/* =========================================================
   History
   ========================================================= */

export function getSleepHistoryFromLogs(
  logs: SleepLogRecord[],
  settings: SleepSettings,
): SleepHistoryItem[] {
  return [...logs]
    .sort(
      (a, b) =>
        getSleepLogTimestamp(b) -
        getSleepLogTimestamp(a),
    )
    .map((log) => {
      const durationMinutes =
        normalizeDuration(
          log.duration_minutes,
        );

      const diffMinutes =
        durationMinutes !== null
          ? durationMinutes -
            settings.targetSleepDurationMinutes
          : null;

      const status: SleepSummaryStatus =
        log.status === "sleeping"
          ? "SLEEPING"
          : log.status ===
              "completed"
            ? "COMPLETED"
            : "NO_SLEEP";

      const date =
        log.sleep_date ||
        (
          log.created_at
            ? formatISODate(
                new Date(
                  log.created_at,
                ),
              )
            : ""
        );

      return {
        id: log.id,

        date,

        bedtime:
          log.bedtime
            ? formatClockTime(
                log.bedtime,
              )
            : "—",

        wakeTime:
          log.wake_time
            ? formatClockTime(
                log.wake_time,
              )
            : "—",

        durationMinutes,

        targetDurationMinutes:
          settings.targetSleepDurationMinutes,

        diffMinutes,

        status,
      };
    });
}
