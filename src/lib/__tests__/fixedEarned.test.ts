import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getWorkingDaysInMonth,
  getWorkingDaysElapsed,
  getWorkingDaysRemaining,
  isFixedEarnedMonthly,
  getCreatorAlertLevel,
} from "../fixedEarned";

// March 2025: Sundays 2,9,16,23,30 → 5 Sundays, 31 days, 26 working days.
// Feb 2025: 28 days, Sundays 2,9,16,23 → 4 Sundays, 24 working days.
// April 2025: 30 days, Sundays 6,13,20,27 → 4 Sundays, 26 working days.
// Jan 2024 (leap year Feb): Feb 2024 has 29 days, Sundays 4,11,18,25 → 25 working days.

describe("getWorkingDaysInMonth", () => {
  it("counts Mon-Sat in a 31-day month (March 2025)", () => {
    expect(getWorkingDaysInMonth(2025, 2)).toBe(26);
  });
  it("counts Mon-Sat in a 28-day month (Feb 2025)", () => {
    expect(getWorkingDaysInMonth(2025, 1)).toBe(24);
  });
  it("counts Mon-Sat in a 30-day month (April 2025)", () => {
    expect(getWorkingDaysInMonth(2025, 3)).toBe(26);
  });
  it("handles leap February (Feb 2024)", () => {
    expect(getWorkingDaysInMonth(2024, 1)).toBe(25);
  });
});

describe("getWorkingDaysElapsed / Remaining with fake timer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Pretend today is Sat March 15, 2025 at noon local time.
    vi.setSystemTime(new Date(2025, 2, 15, 12, 0, 0));
  });
  afterEach(() => vi.useRealTimers());

  it("elapsed = working days up to yesterday in current month", () => {
    // Days 1..14: Sundays 2, 9 → 14-2 = 12.
    expect(getWorkingDaysElapsed(2025, 2)).toBe(12);
  });

  it("elapsed = all working days for past months", () => {
    expect(getWorkingDaysElapsed(2025, 1)).toBe(24); // Feb 2025
  });

  it("remaining = today + future working days in current month", () => {
    // Days 15..31: Sundays 16,23,30 → 17-3 = 14.
    expect(getWorkingDaysRemaining(2025, 2)).toBe(14);
    // Sanity: elapsed + remaining == total.
    expect(
      getWorkingDaysElapsed(2025, 2) + getWorkingDaysRemaining(2025, 2),
    ).toBe(getWorkingDaysInMonth(2025, 2));
  });

  it("remaining = 0 for a past month", () => {
    expect(getWorkingDaysRemaining(2025, 1)).toBe(0);
  });

  it("remaining = full month for a future month", () => {
    expect(getWorkingDaysRemaining(2025, 3)).toBe(26);
  });
});

describe("isFixedEarnedMonthly", () => {
  it("true when videos meet target", () => {
    // March 2025: 26 working days * 2 = 52 required.
    expect(isFixedEarnedMonthly(52, 2, 2025, 2)).toBe(true);
    expect(isFixedEarnedMonthly(100, 2, 2025, 2)).toBe(true);
  });
  it("false when videos below target", () => {
    expect(isFixedEarnedMonthly(51, 2, 2025, 2)).toBe(false);
  });
  it("0 minPerDay → trivially true", () => {
    expect(isFixedEarnedMonthly(0, 0, 2025, 2)).toBe(true);
  });
});

describe("getCreatorAlertLevel", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 2, 15, 12, 0, 0));
  });
  afterEach(() => vi.useRealTimers());

  it("green when target already reached", () => {
    expect(getCreatorAlertLevel(52, 2, 2025, 2)).toBe("green");
  });
  it("red when avg needed > 1.5x minPerDay", () => {
    // remaining 52, workingDaysLeft = 26-12 = 14, avgNeeded ~3.71 > 3.
    expect(getCreatorAlertLevel(0, 2, 2025, 2)).toBe("red");
  });
  it("yellow when avg needed > min but <= 1.5x", () => {
    // videosSoFar=20, remaining=32, avgNeeded=2.28.
    expect(getCreatorAlertLevel(20, 2, 2025, 2)).toBe("yellow");
  });
  it("green when avg needed <= minPerDay", () => {
    // videosSoFar=24, remaining=28, avgNeeded=2.0.
    expect(getCreatorAlertLevel(24, 2, 2025, 2)).toBe("green");
  });
  it("red when month is over and target not reached", () => {
    expect(getCreatorAlertLevel(10, 2, 2025, 1)).toBe("red"); // Feb (past)
  });
});