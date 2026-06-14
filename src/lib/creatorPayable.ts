/**
 * Single source of truth for creator compensation.
 *
 * Business rules (authoritative):
 * - Creator rates come from the CONTRACT that covers the campaign of the video.
 *   · Campaigns in Premium contract → CPM €0.50 + fixed €200
 *   · Campaigns in FZ/Finance contract → CPM €1.00 + fixed €0
 * - A creator can have multiple contracts: total compensation is the SUM of
 *   per-contract portions (views of that contract's campaigns × that contract's CPM,
 *   plus the contract's fixed if earned in the period).
 * - Campaigns do not overlap across contracts.
 * - min_videos_per_day: from the contract; fallback DEFAULT_MIN_VIDEOS_PER_DAY (5)
 *   only if the contract value is null/undefined.
 * - NO hardcoded numeric fallback for CPM/fixed: a missing contract rate means
 *   "dato mancante" and contributes 0 to the payable, with a `rateMissing` flag.
 */

import { sumEffectiveViewsCapped, type VideoWithWindow } from "@/lib/videoWindow";
import { isFixedEarnedInPeriod } from "@/lib/contractPeriods";

/** Minimum videos/day fallback when the contract does not specify it.
 *  Premium obligation. NOT a tariff fallback. */
export const DEFAULT_MIN_VIDEOS_PER_DAY = 5;

/* ── Input shapes (minimal, structural) ── */

export interface ContractInput {
  id: string;
  name: string;
  creator_cpm: number | null | undefined;
  creator_fixed: number | null | undefined;
  min_videos_per_day: number | null | undefined;
}

export interface AccountLite {
  id: string;
  creator_id: string | null | undefined;
  campaign_id: string | null | undefined;
}

export interface CampaignLite {
  id: string;
  video_views_cap?: number | null;
}

export interface VideoLite extends VideoWithWindow {
  tiktok_account_id: string;
}

/* ── Outputs ── */

export interface ContractPortionResult {
  contractId: string;
  contractName: string;
  cpmRate: number;            // 0 if missing
  fixedRate: number;          // 0 if missing
  minVideosPerDay: number;
  totalViews: number;
  videoCount: number;
  fixedEarned: boolean;
  cpmAmount: number;
  fixedAmount: number;        // = fixedEarned ? fixedRate : 0
  subtotal: number;           // cpmAmount + fixedAmount
  /** True if contract.creator_cpm was null/undefined (missing data, NOT zero). */
  cpmRateMissing: boolean;
  /** True if contract.creator_fixed was null/undefined (missing data, NOT zero). */
  fixedRateMissing: boolean;
}

export interface CreatorPayableComposite {
  creatorId: string;
  portions: ContractPortionResult[];
  totalCpm: number;
  totalFixed: number;
  total: number;
  totalViewsAttributed: number;
  /** Views from this creator's videos in the period that belong to campaigns
   *  NOT covered by any of the creator's active contracts. Surfaces "buchi". */
  unattributedViews: number;
  hasMissingRate: boolean;
  hasNoActiveContract: boolean;
}

/* ── Helpers ── */

function readRate(v: number | null | undefined): { value: number; missing: boolean } {
  if (v === null || v === undefined) return { value: 0, missing: true };
  const n = Number(v);
  if (Number.isNaN(n)) return { value: 0, missing: true };
  // NOTE: 0 is a valid contractual value (e.g. FZ fixed=0). Not missing.
  return { value: n, missing: false };
}

function readMinVpd(v: number | null | undefined): number {
  if (v === null || v === undefined) return DEFAULT_MIN_VIDEOS_PER_DAY;
  const n = Number(v);
  if (Number.isNaN(n)) return DEFAULT_MIN_VIDEOS_PER_DAY;
  return n;
}

/**
 * Compute one contract's portion for a creator over [periodStart, periodEnd].
 * `videos` must already be filtered to the period; this function does NOT
 * re-filter by date.
 */
export function computeContractPortion(args: {
  creatorId: string;
  contract: ContractInput;
  contractCampaignIds: string[];
  videos: VideoLite[];
  accounts: AccountLite[];
  campaigns: CampaignLite[];
  periodStart: Date;
  periodEnd: Date;
}): ContractPortionResult {
  const { creatorId, contract, contractCampaignIds, videos, accounts, campaigns, periodStart, periodEnd } = args;

  const cpm = readRate(contract.creator_cpm);
  const fixed = readRate(contract.creator_fixed);
  const minVpd = readMinVpd(contract.min_videos_per_day);

  const campSet = new Set(contractCampaignIds);
  const capByCampaign = new Map<string, number | null>();
  campaigns.forEach((c) => capByCampaign.set(c.id, c.video_views_cap ?? null));

  // Creator's accounts linked to this contract's campaigns
  const crAccounts = accounts.filter(
    (a) => a.creator_id === creatorId && a.campaign_id && campSet.has(a.campaign_id),
  );
  const crAccIds = new Set(crAccounts.map((a) => a.id));
  const crVideos = videos.filter((v) => crAccIds.has(v.tiktok_account_id));
  const videoCount = crVideos.length;

  // Apply per-campaign view cap
  let totalViews = 0;
  contractCampaignIds.forEach((campId) => {
    const cap = capByCampaign.get(campId) ?? null;
    const accIdsInCamp = new Set(
      crAccounts.filter((a) => a.campaign_id === campId).map((a) => a.id),
    );
    const campVideos = crVideos.filter((v) => accIdsInCamp.has(v.tiktok_account_id));
    totalViews += sumEffectiveViewsCapped(campVideos, cap);
  });

  const fixedEarned = isFixedEarnedInPeriod(videoCount, minVpd, periodStart, periodEnd);
  const cpmAmount = cpm.value * (totalViews / 1000);
  const fixedAmount = fixedEarned ? fixed.value : 0;

  return {
    contractId: contract.id,
    contractName: contract.name,
    cpmRate: cpm.value,
    fixedRate: fixed.value,
    minVideosPerDay: minVpd,
    totalViews,
    videoCount,
    fixedEarned,
    cpmAmount,
    fixedAmount,
    subtotal: cpmAmount + fixedAmount,
    cpmRateMissing: cpm.missing,
    fixedRateMissing: fixed.missing,
  };
}

/**
 * Monthly variant: fixed pro-rata on Mon-Sat working days of the calendar month.
 * `videos` must be filtered to [first day of month, last day of month].
 * Re-uses computeContractPortion with the full month range.
 */
export function computeMonthlyContractPortion(args: {
  creatorId: string;
  contract: ContractInput;
  contractCampaignIds: string[];
  videos: VideoLite[];
  accounts: AccountLite[];
  campaigns: CampaignLite[];
  year: number;
  /** 0-indexed month (Jan=0). */
  month: number;
}): ContractPortionResult {
  const periodStart = new Date(Date.UTC(args.year, args.month, 1));
  const periodEnd = new Date(Date.UTC(args.year, args.month + 1, 0));
  return computeContractPortion({
    creatorId: args.creatorId,
    contract: args.contract,
    contractCampaignIds: args.contractCampaignIds,
    videos: args.videos,
    accounts: args.accounts,
    campaigns: args.campaigns,
    periodStart,
    periodEnd,
  });
}

/**
 * Compose all contract portions for a creator over a single period.
 * Use this when the caller wants a unified "creator total" for the same
 * date range (e.g. a calendar month aggregating across contracts).
 *
 * IMPORTANT: when each contract uses its own rolling 30-day period (different
 * `periodStart/periodEnd` per contract), call computeContractPortion per
 * contract and sum manually — the periods cannot be unified.
 */
export function computeCreatorPayableSamePeriod(args: {
  creatorId: string;
  contracts: ContractInput[];
  contractCampaignIds: Map<string, string[]>; // contractId → campaignIds
  videos: VideoLite[];
  accounts: AccountLite[];
  campaigns: CampaignLite[];
  periodStart: Date;
  periodEnd: Date;
}): CreatorPayableComposite {
  const portions: ContractPortionResult[] = args.contracts.map((c) =>
    computeContractPortion({
      creatorId: args.creatorId,
      contract: c,
      contractCampaignIds: args.contractCampaignIds.get(c.id) ?? [],
      videos: args.videos,
      accounts: args.accounts,
      campaigns: args.campaigns,
      periodStart: args.periodStart,
      periodEnd: args.periodEnd,
    }),
  );

  // Unattributed views: creator's videos in period whose campaign is NOT
  // claimed by any of the creator's contracts.
  const claimedCampaigns = new Set<string>();
  args.contracts.forEach((c) => {
    (args.contractCampaignIds.get(c.id) ?? []).forEach((cid) => claimedCampaigns.add(cid));
  });
  const accountById = new Map(args.accounts.map((a) => [a.id, a]));
  let unattributedViews = 0;
  args.videos.forEach((v) => {
    const acc = accountById.get(v.tiktok_account_id);
    if (!acc || acc.creator_id !== args.creatorId) return;
    if (!acc.campaign_id || !claimedCampaigns.has(acc.campaign_id)) {
      const cap = acc?.campaign_id
        ? args.campaigns.find((c) => c.id === acc.campaign_id)?.video_views_cap ?? null
        : null;
      unattributedViews += sumEffectiveViewsCapped([v], cap);
    }
  });

  const totalCpm = portions.reduce((s, p) => s + p.cpmAmount, 0);
  const totalFixed = portions.reduce((s, p) => s + p.fixedAmount, 0);
  const totalViewsAttributed = portions.reduce((s, p) => s + p.totalViews, 0);

  return {
    creatorId: args.creatorId,
    portions,
    totalCpm,
    totalFixed,
    total: totalCpm + totalFixed,
    totalViewsAttributed,
    unattributedViews,
    hasMissingRate: portions.some((p) => p.cpmRateMissing || p.fixedRateMissing),
    hasNoActiveContract: args.contracts.length === 0,
  };
}

/**
 * Monthly variant of composer: fixed pro-rata on the month.
 */
export function computeCreatorPayableMonth(args: {
  creatorId: string;
  contracts: ContractInput[];
  contractCampaignIds: Map<string, string[]>;
  videos: VideoLite[];
  accounts: AccountLite[];
  campaigns: CampaignLite[];
  year: number;
  month: number; // 0-indexed
}): CreatorPayableComposite {
  const periodStart = new Date(Date.UTC(args.year, args.month, 1));
  const periodEnd = new Date(Date.UTC(args.year, args.month + 1, 0));
  return computeCreatorPayableSamePeriod({
    creatorId: args.creatorId,
    contracts: args.contracts,
    contractCampaignIds: args.contractCampaignIds,
    videos: args.videos,
    accounts: args.accounts,
    campaigns: args.campaigns,
    periodStart,
    periodEnd,
  });
}