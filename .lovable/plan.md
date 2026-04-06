

## Rolling 30-Day Payment Periods (from Contract Start Date)

### Current Problem
All payment calculations use calendar months (1st–end of month). You need periods based on contract start dates — e.g., contract started March 9 → Period 1 is March 9 – April 8, Period 2 is April 9 – May 8, etc.

### What Changes

#### 1. Database: Add `start_date` to `contracts` table
- New column `start_date DATE NOT NULL DEFAULT CURRENT_DATE`
- You'll set the correct start dates for existing contracts (e.g., "Contratto Premium" → March 9)

#### 2. New period calculation logic (`src/lib/contractPeriods.ts`)
- Function `getContractPeriod(startDate, periodNumber)` → returns `{ periodStart, periodEnd }`
- Function `getCurrentPeriodNumber(startDate)` → which period are we in today
- Function `getPeriodForDate(startDate, date)` → which period does a given date fall in
- Working days calculation adapted to arbitrary date ranges (not just calendar months)
- Fixed earned logic adapted: target = `min_videos_per_day × working_days_in_period`

#### 3. Rewrite `useCreatorPayable` hook
- Instead of `(year, month)`, accept a period selector that maps to contract-specific date ranges
- For each contract, compute: which period number are we viewing → derive `periodStart`/`periodEnd`
- Filter videos by `published_at` within the contract's period range (not calendar month)
- Compute fixed earned using working days in that specific period
- Since different contracts can have different start dates, each contract breakdown uses its own period window

#### 4. Update `PaymentsPayablePage` UI
- Replace month/year selectors with a **period navigator** — show "Periodo 1 (9 Mar – 8 Apr)", "Periodo 2 (9 Apr – 8 May)", etc.
- The period number is derived from the earliest active contract's start date, or allow per-contract period browsing
- Show the period date range clearly in the header

#### 5. Update `usePayoffData` (Generale page)
- Same logic: use contract start dates for period windows when calculating creator costs
- Campaign income side can stay calendar-based (client billing) unless you want to change that too

#### 6. Update `useCreatorPortal` (Creator Area earnings)
- Creator-facing earnings also shift to contract-based periods
- Show "Periodo 1", "Periodo 2" instead of month names

#### 7. Update `creator_payments` table
- Add `period_start DATE` and `period_end DATE` columns (to record the exact period window)
- Keep `period_month`/`period_year` for backward compatibility or replace entirely

### Key Design Decision
Since a creator can have multiple contracts with different start dates, each contract's breakdown is calculated independently using its own period. The "total" row aggregates across contracts even if their periods don't align perfectly. The period navigator will be based on the selected contract or the earliest contract start date.

### Technical Details
- All date math uses UTC methods (existing convention)
- Working days = Mon–Sat, excluding Sundays (same as current `getWorkingDaysInMonth`)
- Video window logic (30-day view accumulation) is unchanged
- CPM caps per campaign remain unchanged
- The `fixedEarned` check becomes: `videoCount >= minPerDay × workingDaysInPeriod(periodStart, periodEnd)`

### Files Modified
- `supabase/migrations/` — add `start_date` to contracts, add period columns to `creator_payments`
- `src/lib/contractPeriods.ts` — new file with period math
- `src/lib/fixedEarned.ts` — add period-range variants of existing functions
- `src/hooks/useCreatorPayable.ts` — rewrite to use contract periods
- `src/hooks/usePayoffData.ts` — adapt to contract periods
- `src/hooks/useCreatorPortal.ts` — adapt earnings to contract periods
- `src/pages/dashboard/PaymentsPayablePage.tsx` — new period navigator UI
- `src/components/creator/CreatorEarnings.tsx` — period labels

