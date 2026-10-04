# Project architecture decisions

- Keep Allocation configurations and weekly manual slots in separate RLS-protected tables; campaign, creator, and TikTok records remain their existing sources of truth.
- Save Allocation weeks through the versioned RPC, not direct slot writes, to preserve capacity and campaign validity checks.
- Render automatic residual allocations without persisting them as manual slots, so the residual toggle is reversible.
- Keep scheduling arithmetic in pure helpers and separate data access in query hooks, so the interactions can be tested independently.
- Group Allocation by actual contract links while keeping one weekly row per creator, so overlapping contracts never double-count daily capacity.
- Keep the Allocation color and typography tokens scoped to its workspace, so the rest of the hub retains its existing theme.
- Mirror only campaign logo references into Allocation and synchronize them with company changes, so campaign managers can see logos without access to private CRM records.
- Store internal monthly planning targets on Allocation campaigns separately from campaign minimums, so operational goals never alter contractual campaign values.
- Derive the compact Allocation campaign timeline from existing allocation campaign dates and a fixed week-centered horizon, so long campaigns do not distort the view or require extra data access.- Creators linked to a contract named VE get default Allocation capacity via a database trigger on contract links, so planning never waits on manual setup.
