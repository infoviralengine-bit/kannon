import { describe, it, expect } from "vitest";
import {
  computeContractPortion,
  computeMonthlyContractPortion,
  computeCreatorPayableSamePeriod,
  computeCreatorPayableMonth,
  DEFAULT_MIN_VIDEOS_PER_DAY,
  type ContractInput,
  type AccountLite,
  type CampaignLite,
  type VideoLite,
} from "@/lib/creatorPayable";

const PREMIUM: ContractInput = {
  id: "ct-premium",
  name: "Premium",
  creator_cpm: 0.5,
  creator_fixed: 200,
  min_videos_per_day: 5,
};

const FINANCE: ContractInput = {
  id: "ct-fz",
  name: "FZ Finance",
  creator_cpm: 1.0,
  creator_fixed: 0,
  min_videos_per_day: 5,
};

function video(accountId: string, views: number, publishedAt: string, closed = false): VideoLite {
  return {
    tiktok_account_id: accountId,
    views,
    views_final: closed ? views : null,
    window_closed: closed,
    window_expires_at: null,
    published_at: publishedAt,
  };
}

describe("computeContractPortion — Premium puro", () => {
  // June 2026: 1-30. Mon-Sat working days excl. Sundays (7, 14, 21, 28) = 26 days.
  // 5 × 26 = 130 videos required to earn fixed.
  const periodStart = new Date(Date.UTC(2026, 5, 1));
  const periodEnd = new Date(Date.UTC(2026, 5, 30));

  const accounts: AccountLite[] = [
    { id: "acc-A", creator_id: "cr1", campaign_id: "cmp-premium" },
  ];
  const campaigns: CampaignLite[] = [{ id: "cmp-premium", video_views_cap: null }];

  it("CPM only when fixed NOT earned (few videos)", () => {
    const videos = Array.from({ length: 10 }, (_, i) =>
      video("acc-A", 10_000, `2026-06-${String(i + 1).padStart(2, "0")}T10:00:00Z`),
    );
    const r = computeContractPortion({
      creatorId: "cr1",
      contract: PREMIUM,
      contractCampaignIds: ["cmp-premium"],
      videos,
      accounts,
      campaigns,
      periodStart,
      periodEnd,
    });
    expect(r.totalViews).toBe(100_000);
    expect(r.fixedEarned).toBe(false);
    expect(r.cpmAmount).toBeCloseTo(50, 6); // 100k/1000 × 0.5
    expect(r.fixedAmount).toBe(0);
    expect(r.subtotal).toBeCloseTo(50, 6);
    expect(r.cpmRateMissing).toBe(false);
    expect(r.fixedRateMissing).toBe(false);
  });

  it("CPM + fixed when target reached", () => {
    const videos = Array.from({ length: 130 }, (_, i) =>
      video("acc-A", 1_000, `2026-06-${String((i % 30) + 1).padStart(2, "0")}T10:00:00Z`),
    );
    const r = computeContractPortion({
      creatorId: "cr1",
      contract: PREMIUM,
      contractCampaignIds: ["cmp-premium"],
      videos,
      accounts,
      campaigns,
      periodStart,
      periodEnd,
    });
    expect(r.videoCount).toBe(130);
    expect(r.fixedEarned).toBe(true);
    expect(r.fixedAmount).toBe(200);
    expect(r.subtotal).toBeCloseTo(200 + (130_000 / 1000) * 0.5, 6);
  });
});

describe("computeContractPortion — Finance puro", () => {
  const periodStart = new Date(Date.UTC(2026, 5, 1));
  const periodEnd = new Date(Date.UTC(2026, 5, 30));
  const accounts: AccountLite[] = [{ id: "acc-F", creator_id: "cr2", campaign_id: "cmp-fz" }];
  const campaigns: CampaignLite[] = [{ id: "cmp-fz", video_views_cap: null }];

  it("CPM 1.00 applied, fixed always 0", () => {
    const videos = Array.from({ length: 200 }, (_, i) =>
      video("acc-F", 500, `2026-06-${String((i % 30) + 1).padStart(2, "0")}T10:00:00Z`),
    );
    const r = computeContractPortion({
      creatorId: "cr2",
      contract: FINANCE,
      contractCampaignIds: ["cmp-fz"],
      videos,
      accounts,
      campaigns,
      periodStart,
      periodEnd,
    });
    expect(r.cpmRate).toBe(1.0);
    expect(r.totalViews).toBe(100_000);
    expect(r.cpmAmount).toBeCloseTo(100, 6);
    expect(r.fixedEarned).toBe(true); // 200 ≥ 130
    expect(r.fixedAmount).toBe(0);    // fixed rate is 0 → amount 0
    expect(r.subtotal).toBeCloseTo(100, 6);
  });
});

describe("computeContractPortion — view cap", () => {
  it("caps each video at the campaign cap", () => {
    const periodStart = new Date(Date.UTC(2026, 5, 1));
    const periodEnd = new Date(Date.UTC(2026, 5, 30));
    const accounts: AccountLite[] = [{ id: "acc", creator_id: "cr", campaign_id: "cmp" }];
    const campaigns: CampaignLite[] = [{ id: "cmp", video_views_cap: 50_000 }];
    const videos: VideoLite[] = [
      video("acc", 1_000_000, "2026-06-05T10:00:00Z"),
      video("acc", 30_000, "2026-06-06T10:00:00Z"),
    ];
    const r = computeContractPortion({
      creatorId: "cr",
      contract: PREMIUM,
      contractCampaignIds: ["cmp"],
      videos,
      accounts,
      campaigns,
      periodStart,
      periodEnd,
    });
    expect(r.totalViews).toBe(50_000 + 30_000); // first capped, second under cap
  });
});

describe("computeContractPortion — missing rate", () => {
  it("treats null CPM as missing (rate=0, flag set), never assumes 0.5", () => {
    const periodStart = new Date(Date.UTC(2026, 5, 1));
    const periodEnd = new Date(Date.UTC(2026, 5, 30));
    const broken: ContractInput = {
      id: "ct",
      name: "broken",
      creator_cpm: null,
      creator_fixed: null,
      min_videos_per_day: null,
    };
    const r = computeContractPortion({
      creatorId: "cr",
      contract: broken,
      contractCampaignIds: ["cmp"],
      videos: [video("acc", 100_000, "2026-06-05T10:00:00Z")],
      accounts: [{ id: "acc", creator_id: "cr", campaign_id: "cmp" }],
      campaigns: [{ id: "cmp", video_views_cap: null }],
      periodStart,
      periodEnd,
    });
    expect(r.cpmRate).toBe(0);
    expect(r.fixedRate).toBe(0);
    expect(r.cpmRateMissing).toBe(true);
    expect(r.fixedRateMissing).toBe(true);
    expect(r.cpmAmount).toBe(0);
    expect(r.subtotal).toBe(0);
    expect(r.minVideosPerDay).toBe(DEFAULT_MIN_VIDEOS_PER_DAY);
  });

  it("treats 0 as a valid contractual rate (NOT missing)", () => {
    const periodStart = new Date(Date.UTC(2026, 5, 1));
    const periodEnd = new Date(Date.UTC(2026, 5, 30));
    const r = computeContractPortion({
      creatorId: "cr",
      contract: FINANCE, // fixed=0 valid
      contractCampaignIds: [],
      videos: [],
      accounts: [],
      campaigns: [],
      periodStart,
      periodEnd,
    });
    expect(r.fixedRateMissing).toBe(false);
    expect(r.cpmRateMissing).toBe(false);
  });
});

describe("computeCreatorPayableSamePeriod — creator con DUE contratti", () => {
  it("somma correttamente Premium + Finance senza sovrapposizioni", () => {
    const periodStart = new Date(Date.UTC(2026, 5, 1));
    const periodEnd = new Date(Date.UTC(2026, 5, 30));
    const accounts: AccountLite[] = [
      { id: "acc-P", creator_id: "crX", campaign_id: "cmp-premium" },
      { id: "acc-F", creator_id: "crX", campaign_id: "cmp-fz" },
    ];
    const campaigns: CampaignLite[] = [
      { id: "cmp-premium", video_views_cap: null },
      { id: "cmp-fz", video_views_cap: null },
    ];
    const videos: VideoLite[] = [
      video("acc-P", 100_000, "2026-06-05T10:00:00Z"),
      video("acc-F", 50_000, "2026-06-06T10:00:00Z"),
    ];
    const r = computeCreatorPayableSamePeriod({
      creatorId: "crX",
      contracts: [PREMIUM, FINANCE],
      contractCampaignIds: new Map([
        ["ct-premium", ["cmp-premium"]],
        ["ct-fz", ["cmp-fz"]],
      ]),
      videos,
      accounts,
      campaigns,
      periodStart,
      periodEnd,
    });
    expect(r.portions).toHaveLength(2);
    expect(r.totalCpm).toBeCloseTo((100_000 / 1000) * 0.5 + (50_000 / 1000) * 1.0, 6); // 50 + 50 = 100
    expect(r.totalViewsAttributed).toBe(150_000);
    expect(r.unattributedViews).toBe(0);
    expect(r.hasMissingRate).toBe(false);
    expect(r.hasNoActiveContract).toBe(false);
  });
});

describe("computeCreatorPayableSamePeriod — views non attribuibili", () => {
  it("riporta in unattributedViews i video di campagne fuori dai contratti del creator", () => {
    const periodStart = new Date(Date.UTC(2026, 5, 1));
    const periodEnd = new Date(Date.UTC(2026, 5, 30));
    const accounts: AccountLite[] = [
      { id: "acc-P", creator_id: "crX", campaign_id: "cmp-premium" },
      { id: "acc-orphan", creator_id: "crX", campaign_id: "cmp-unknown" }, // non in nessun contratto
    ];
    const campaigns: CampaignLite[] = [
      { id: "cmp-premium", video_views_cap: null },
      { id: "cmp-unknown", video_views_cap: null },
    ];
    const videos: VideoLite[] = [
      video("acc-P", 20_000, "2026-06-05T10:00:00Z"),
      video("acc-orphan", 70_000, "2026-06-07T10:00:00Z"),
    ];
    const r = computeCreatorPayableSamePeriod({
      creatorId: "crX",
      contracts: [PREMIUM],
      contractCampaignIds: new Map([["ct-premium", ["cmp-premium"]]]),
      videos,
      accounts,
      campaigns,
      periodStart,
      periodEnd,
    });
    expect(r.totalViewsAttributed).toBe(20_000);
    expect(r.unattributedViews).toBe(70_000);
  });
});

describe("computeMonthlyContractPortion — fisso pro-rata sul mese", () => {
  it("calcola fisso maturato su giorni lavorativi del mese", () => {
    // June 2026 → 26 working days, target = 5 × 26 = 130
    const accounts: AccountLite[] = [{ id: "acc", creator_id: "cr", campaign_id: "cmp" }];
    const campaigns: CampaignLite[] = [{ id: "cmp", video_views_cap: null }];
    const videos = Array.from({ length: 130 }, (_, i) =>
      video("acc", 1_000, `2026-06-${String((i % 30) + 1).padStart(2, "0")}T10:00:00Z`),
    );
    const r = computeMonthlyContractPortion({
      creatorId: "cr",
      contract: PREMIUM,
      contractCampaignIds: ["cmp"],
      videos,
      accounts,
      campaigns,
      year: 2026,
      month: 5,
    });
    expect(r.fixedEarned).toBe(true);
    expect(r.fixedAmount).toBe(200);
  });
});

describe("composer — nessun contratto attivo", () => {
  it("hasNoActiveContract=true e total=0", () => {
    const r = computeCreatorPayableMonth({
      creatorId: "lonely",
      contracts: [],
      contractCampaignIds: new Map(),
      videos: [],
      accounts: [],
      campaigns: [],
      year: 2026,
      month: 5,
    });
    expect(r.hasNoActiveContract).toBe(true);
    expect(r.total).toBe(0);
  });
});