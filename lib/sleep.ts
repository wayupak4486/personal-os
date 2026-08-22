export type SleepStatus = "NO_SLEEP" | "SLEEPING" | "COMPLETED";

export type SleepSettingsRecord = {
  id?: string;
  user_id?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
};

export type SleepLogRecord = {
  id?: string;
  user_id?: string;
  bedtime?: string | null;
  wake_time?: string | null;
  sleep_date?: string | null;
  status?: string | null;
  duration_minutes?: number | null;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
};

export type SleepSettings = {
  targetWakeTime: string;
  targetSleepDurationHours: number;
  targetBedtime: string;
};

export type SleepSummary = {
  status: SleepStatus;
  targetWakeTime: string;
  targetBedtime: string;
  actualBedtime: string | null;
  actualWakeTime: string | null;
  durationMinutes: number | null;
  targetDurationMinutes: number;
  timeDiffMinutes: number | null;
  wakeTimingLabel: string;
  durationStatusLabel: string;
};

export function normalizeTimeValue(value: string | null | undefined): string | null {
  if (!value) return null;

  const raw = String(value).trim();
  if (!raw) return null;

  const match = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (match) {
    const hours = Number(match[1]);
    const minutes = Number(match[2]);

    if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;

    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;

  const hours = parsed.getHours();
  const minutes = parsed.getMinutes();

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function parseMinutesFromTime(value: string | null | undefined): number | null {
  const time = normalizeTimeValue(value);
  if (!time) return null;

  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export function formatClockTime(value: string | Date | null | undefined): string {
  if (!value) return "--:--";

  if (value instanceof Date) {
    const hours = value.getHours();
    const minutes = value.getMinutes();
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }

  const raw = typeof value === "string" ? value : String(value);
  const normalized = normalizeTimeValue(raw);
  if (!normalized) {
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return "--:--";
    return formatClockTime(parsed);
  }

  return normalized;
}

function asString(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return value.toISOString();
  return null;
}

export function formatDurationMinutes(totalMinutes: number | null): string {
  if (totalMinutes === null || Number.isNaN(totalMinutes)) return "—";

  const safeMinutes = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(safeMinutes / 60);
  const minutes = safeMinutes % 60;

  if (hours === 0) {
    return `${minutes} นาที`;
  }

  if (minutes === 0) {
    return `${hours} ชม.`;
  }

  return `${hours} ชม. ${minutes} นาที`;
}

export function computeTargetBedtime(targetWakeTime: string | null | undefined, targetSleepDurationHours: number): string {
  const wakeMinutes = parseMinutesFromTime(targetWakeTime ?? "06:30");
  const durationMinutes = Math.max(0, Number(targetSleepDurationHours || 8) * 60);

  if (wakeMinutes === null) {
    return "22:30";
  }

  const bedtimeMinutes = (wakeMinutes - durationMinutes + 24 * 60) % (24 * 60);
  const hours = Math.floor(bedtimeMinutes / 60);
  const minutes = bedtimeMinutes % 60;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function getSettingValue(record: SleepSettingsRecord | null | undefined, keys: string[]): unknown {
  if (!record) return undefined;

  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }

  return undefined;
}

export function getSleepSettingsFromRecord(record: SleepSettingsRecord | null | undefined): SleepSettings {
  const targetWakeTime = normalizeTimeValue(
    String(
      getSettingValue(record, [
        "target_wake_time",
        "wake_time_target",
        "wake_time",
        "target_wake",
      ]) ?? "06:30",
    ),
  ) ?? "06:30";

  const targetDurationRaw =
    Number(
      getSettingValue(record, [
        "target_sleep_duration_hours",
        "sleep_duration_hours",
        "target_duration_hours",
        "sleep_hours",
        "target_sleep_hours",
      ]) ?? 8,
    ) || 8;

  const targetBedtime = computeTargetBedtime(targetWakeTime, targetDurationRaw);

  return {
    targetWakeTime,
    targetSleepDurationHours: Math.max(1, Math.min(16, targetDurationRaw)),
    targetBedtime,
  };
}

export function getSleepLogValue(record: SleepLogRecord | null | undefined, keys: string[]): unknown {
  if (!record) return undefined;

  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null && !(typeof value === "string" && value.trim() === "")) {
      return value;
    }
  }

  return undefined;
}

export function formatSleepDateForNight(date: string | null | undefined): string | null {
  if (!date) return null;

  const normalized = String(date).trim();
  if (!normalized) return null;

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return normalized.slice(0, 10);

  return formatISODate(parsed);
}

export function formatISODate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function formatDateLabel(date: string | null | undefined) {
  if (!date) return "—";

  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return date;
  }

  return new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "short",
  }).format(parsed);
}

export function formatSignedMinutes(delta: number | null): string {
  if (delta === null) return "—";

  if (delta === 0) return "0 นาที";

  const abs = Math.abs(delta);
  const marker = delta > 0 ? "+" : "-";

  if (abs < 60) {
    return `${marker}${abs} นาที`;
  }

  const hours = Math.floor(abs / 60);
  const minutes = abs % 60;
  const minuteText = minutes === 0 ? "" : ` ${minutes} นาที`;

  return `${marker}${hours} ชม.${minuteText}`;
}

export function getSleepSummary(settings: SleepSettings, log: SleepLogRecord | null): SleepSummary {
  const targetWakeTime = settings.targetWakeTime;
  const targetBedtime = settings.targetBedtime;
  const targetDurationMinutes = settings.targetSleepDurationHours * 60;

  const actualBedtimeRaw = log?.bedtime;
  const actualWakeRaw = log?.wake_time;

  const bedtimeText = asString(actualBedtimeRaw);
  const wakeText = asString(actualWakeRaw);

  const actualBedtime = bedtimeText ? formatClockTime(bedtimeText) : null;
  const actualWakeTime = wakeText ? formatClockTime(wakeText) : null;

  const durationMinutes =
    (() => {
      const value = log?.duration_minutes;

      if (typeof value === "number") return value;
      if (typeof value === "string") {
        const numeric = Number(value);
        if (!Number.isNaN(numeric)) return numeric;
      }

      if (bedtimeText && wakeText) {
        const bedtimeMinutes = parseMinutesFromTime(formatClockTime(bedtimeText));
        const wakeMinutes = parseMinutesFromTime(formatClockTime(wakeText));

        if (bedtimeMinutes !== null && wakeMinutes !== null) {
          const diff = wakeMinutes - bedtimeMinutes;
          return diff < 0 ? diff + 24 * 60 : diff;
        }
      }

      return null;
    })();

  const status: SleepStatus = log?.status === "completed"
    ? "COMPLETED"
    : log?.status === "sleeping"
      ? "SLEEPING"
      : "NO_SLEEP";

  const wakeTimeMinutes = parseMinutesFromTime(targetWakeTime) ?? 390;
  const actualWakeMinutes = wakeText ? parseMinutesFromTime(wakeText) ?? wakeTimeMinutes : null;
  const timeDiffMinutes = actualWakeMinutes === null ? null : actualWakeMinutes - wakeTimeMinutes;

  const wakeTimingLabel =
    timeDiffMinutes === null
      ? "รอการบันทึก"
      : timeDiffMinutes === 0
        ? "ตรงตามเวลา"
        : timeDiffMinutes > 0
          ? `สายกว่าเป้าหมาย ${Math.abs(timeDiffMinutes)} นาที`
          : `เร็วกว่าเป้าหมาย ${Math.abs(timeDiffMinutes)} นาที`;

  const durationStatusLabel =
    durationMinutes === null
      ? "รอการบันทึก"
      : durationMinutes >= targetDurationMinutes
        ? "ถึงเป้าหมาย"
        : durationMinutes > targetDurationMinutes * 0.9
          ? "ใกล้เป้าหมาย"
          : "ต่ำกว่าเป้าหมาย";

  return {
    status,
    targetWakeTime,
    targetBedtime,
    actualBedtime,
    actualWakeTime,
    durationMinutes,
    targetDurationMinutes,
    timeDiffMinutes,
    wakeTimingLabel,
    durationStatusLabel,
  };
}

export function solveSleepStatus(logs: SleepLogRecord[] | null | undefined, settings: SleepSettings): SleepSummary {
  const latestLog = logs?.find((log) => log.status === "sleeping") ?? logs?.[0] ?? null;
  const current = getSleepSummary(settings, latestLog);

  if (current.status === "COMPLETED") {
    return current;
  }

  if (current.status === "SLEEPING") {
    return current;
  }

  return {
    status: "NO_SLEEP",
    targetWakeTime: settings.targetWakeTime,
    targetBedtime: settings.targetBedtime,
    actualBedtime: null,
    actualWakeTime: null,
    durationMinutes: null,
    targetDurationMinutes: settings.targetSleepDurationHours * 60,
    timeDiffMinutes: null,
    wakeTimingLabel: "รอการบันทึก",
    durationStatusLabel: "รอการบันทึก",
  };
}

export function getSleepHistoryFromLogs(logs: SleepLogRecord[] | null | undefined, settings: SleepSettings) {
  return (logs ?? []).map((log) => {
    const bedtimeRaw = log.bedtime;
    const wakeTimeRaw = log.wake_time;
    const sleepDate = log.sleep_date;
    const bedtime = asString(bedtimeRaw);
    const wakeTime = asString(wakeTimeRaw);

    const targetWake = settings.targetWakeTime;
    const targetDuration = settings.targetSleepDurationHours * 60;

    const actualDuration = (() => {
      const value = log.duration_minutes;

      if (typeof value === "number") return value;
      if (typeof value === "string") {
        const numeric = Number(value);
        if (!Number.isNaN(numeric)) return numeric;
      }

      if (bedtime && wakeTime) {
        const start = parseMinutesFromTime(formatClockTime(bedtime));
        const end = parseMinutesFromTime(formatClockTime(wakeTime));
        if (start !== null && end !== null) {
          const diff = end - start;
          return diff < 0 ? diff + 24 * 60 : diff;
        }
      }

      return null;
    })();

    return {
      id: String(log.id ?? ""),
      date: formatSleepDateForNight(asString(sleepDate)) ?? "",
      bedtime: bedtime ? formatClockTime(bedtime) : "—",
      wakeTime: wakeTime ? formatClockTime(wakeTime) : "—",
      durationMinutes: actualDuration,
      targetDurationMinutes: targetDuration,
      targetWakeTime: normalizeTimeValue(targetWake) ?? settings.targetWakeTime,
      diffMinutes: actualDuration === null ? null : actualDuration - targetDuration,
      status: log.status === "completed"
        ? "COMPLETED"
        : log.status === "sleeping"
          ? "SLEEPING"
          : "NO_SLEEP",
    };
  });
}
