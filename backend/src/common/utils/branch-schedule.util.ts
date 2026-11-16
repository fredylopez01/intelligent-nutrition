const BOGOTA_OFFSET_MS = 5 * 60 * 60 * 1000;

export const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export interface ScheduleInterval {
  opensAt: string;
  closesAt: string;
}

export interface ScheduleDay {
  dayOfWeek: number;
  intervals: ScheduleInterval[];
}

export interface ScheduleRow extends ScheduleInterval {
  dayOfWeek: number;
}

export function toMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export function businessWeekTime(now = new Date()): {
  dayOfWeek: number;
  minutes: number;
} {
  const local = new Date(now.getTime() - BOGOTA_OFFSET_MS);
  const day = local.getUTCDay();
  return {
    dayOfWeek: day === 0 ? 7 : day,
    minutes: local.getUTCHours() * 60 + local.getUTCMinutes(),
  };
}

export function groupSchedule(rows: ScheduleRow[]): ScheduleDay[] {
  return Array.from({ length: 7 }, (_, index) => {
    const dayOfWeek = index + 1;
    return {
      dayOfWeek,
      intervals: rows
        .filter((row) => row.dayOfWeek === dayOfWeek)
        .sort((a, b) => toMinutes(a.opensAt) - toMinutes(b.opensAt))
        .map(({ opensAt, closesAt }) => ({ opensAt, closesAt })),
    };
  });
}

export function isOpenAt(rows: ScheduleRow[], now = new Date()): boolean {
  const { dayOfWeek, minutes } = businessWeekTime(now);
  return rows.some(
    (row) =>
      row.dayOfWeek === dayOfWeek &&
      toMinutes(row.opensAt) <= minutes &&
      minutes < toMinutes(row.closesAt),
  );
}
