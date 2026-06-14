import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getEffectiveViews,
  sumEffectiveViewsCapped,
  sumEffectiveViews,
  getWindowStatus,
  getWindowDaysRemaining,
  countByWindowStatus,
  type VideoWithWindow,
} from "../videoWindow";

const mkVideo = (overrides: Partial<VideoWithWindow> = {}): VideoWithWindow => ({
  views: 0,
  views_final: null,
  window_closed: false,
  window_expires_at: null,
  published_at: "2025-01-01T00:00:00Z",
  ...overrides,
});

describe("getEffectiveViews", () => {
  it("uses views_final when closed", () => {
    expect(getEffectiveViews(mkVideo({ window_closed: true, views: 100, views_final: 80 }))).toBe(80);
  });
  it("falls back to views when closed but views_final missing", () => {
    expect(getEffectiveViews(mkVideo({ window_closed: true, views: 100, views_final: null }))).toBe(100);
  });
  it("uses views when open", () => {
    expect(getEffectiveViews(mkVideo({ views: 250 }))).toBe(250);
  });
  it("applies cap when provided", () => {
    expect(getEffectiveViews(mkVideo({ views: 1000 }), 500)).toBe(500);
    expect(getEffectiveViews(mkVideo({ views: 100 }), 500)).toBe(100);
  });
  it("ignores cap <= 0 or null", () => {
    expect(getEffectiveViews(mkVideo({ views: 999 }), 0)).toBe(999);
    expect(getEffectiveViews(mkVideo({ views: 999 }), null)).toBe(999);
  });
  it("treats nullish views as 0", () => {
    expect(getEffectiveViews(mkVideo({ views: null }))).toBe(0);
  });
});

describe("sumEffectiveViews(Capped)", () => {
  const vids = [
    mkVideo({ views: 100 }),
    mkVideo({ window_closed: true, views_final: 200 }),
    mkVideo({ views: 1000 }),
  ];
  it("sums without cap", () => {
    expect(sumEffectiveViews(vids)).toBe(1300);
  });
  it("sums with per-video cap", () => {
    expect(sumEffectiveViewsCapped(vids, 500)).toBe(100 + 200 + 500);
  });
});

describe("getWindowStatus / getWindowDaysRemaining", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-06-01T00:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("closed when window_closed=true", () => {
    expect(getWindowStatus(mkVideo({ window_closed: true }))).toBe("closed");
    expect(getWindowDaysRemaining(mkVideo({ window_closed: true }))).toBe(0);
  });
  it("open with no expiry returns 30 days", () => {
    expect(getWindowStatus(mkVideo())).toBe("open");
    expect(getWindowDaysRemaining(mkVideo())).toBe(30);
  });
  it("closing within 24h", () => {
    const exp = new Date("2025-06-01T12:00:00Z").toISOString();
    expect(getWindowStatus(mkVideo({ window_expires_at: exp }))).toBe("closing");
  });
  it("closed when expired but not yet marked", () => {
    const exp = new Date("2025-05-30T00:00:00Z").toISOString();
    expect(getWindowStatus(mkVideo({ window_expires_at: exp }))).toBe("closed");
    expect(getWindowDaysRemaining(mkVideo({ window_expires_at: exp }))).toBe(0);
  });
  it("open with > 24h returns ceiled days remaining", () => {
    const exp = new Date("2025-06-11T00:00:00Z").toISOString();
    expect(getWindowStatus(mkVideo({ window_expires_at: exp }))).toBe("open");
    expect(getWindowDaysRemaining(mkVideo({ window_expires_at: exp }))).toBe(10);
  });
});

describe("countByWindowStatus", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-06-01T00:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("counts open vs closed correctly", () => {
    const result = countByWindowStatus([
      mkVideo({ window_closed: true }),
      mkVideo(),
      mkVideo({ window_expires_at: new Date("2025-05-01T00:00:00Z").toISOString() }),
    ]);
    expect(result).toEqual({ open: 1, closed: 2 });
  });
});