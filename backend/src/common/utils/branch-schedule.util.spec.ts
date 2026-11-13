import { describe, expect, it } from "@jest/globals";
import {
  businessWeekTime,
  groupSchedule,
  isOpenAt,
} from "./branch-schedule.util.js";

const weekday = [
  { dayOfWeek: 1, opensAt: "15:00", closesAt: "20:00" },
  { dayOfWeek: 1, opensAt: "08:00", closesAt: "13:00" },
  { dayOfWeek: 6, opensAt: "09:00", closesAt: "14:00" },
];

describe("branch schedule utils", () => {
  it("reads the weekday and minutes in Bogota time", () => {
    expect(businessWeekTime(new Date("2026-11-16T13:30:00.000Z"))).toEqual({
      dayOfWeek: 1,
      minutes: 8 * 60 + 30,
    });
    expect(businessWeekTime(new Date("2026-11-16T03:00:00.000Z"))).toEqual({
      dayOfWeek: 7,
      minutes: 22 * 60,
    });
  });

  it("groups the rows by day and sorts the intervals", () => {
    const days = groupSchedule(weekday);

    expect(days).toHaveLength(7);
    expect(days[0]).toEqual({
      dayOfWeek: 1,
      intervals: [
        { opensAt: "08:00", closesAt: "13:00" },
        { opensAt: "15:00", closesAt: "20:00" },
      ],
    });
    expect(days[6]).toEqual({ dayOfWeek: 7, intervals: [] });
  });

  it("is open inside an interval and closed at lunch, at closing time and on closed days", () => {
    expect(isOpenAt(weekday, new Date("2026-11-16T13:00:00.000Z"))).toBe(true);
    expect(isOpenAt(weekday, new Date("2026-11-16T18:30:00.000Z"))).toBe(false);
    expect(isOpenAt(weekday, new Date("2026-11-17T01:00:00.000Z"))).toBe(false);
    expect(isOpenAt(weekday, new Date("2026-11-15T15:00:00.000Z"))).toBe(false);
  });
});
