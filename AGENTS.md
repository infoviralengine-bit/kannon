# Project architecture decisions

- Keep Allocation configurations and weekly manual slots in separate RLS-protected tables; campaign, creator, and TikTok records remain their existing sources of truth.
- Save Allocation weeks through the versioned RPC, not direct slot writes, to preserve capacity and campaign validity checks.
- Render automatic residual allocations without persisting them as manual slots, so the residual toggle is reversible.
- Keep scheduling arithmetic in pure helpers and separate data access in query hooks, so the interactions can be tested independently.
- Group Allocation by actual contract links while keeping one weekly row per creator, so overlapping contracts never double-count daily capacity.
- Keep the Allocation color and typography tokens scoped to its workspace, so the rest of the hub retains its existing theme.