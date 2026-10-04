# Project architecture decisions

- Keep Allocation configurations and weekly manual slots in separate RLS-protected tables; campaign, creator, and TikTok records remain their existing sources of truth.
- Save Allocation weeks through the versioned RPC, not direct slot writes, to preserve capacity and campaign validity checks.
- Render automatic residual allocations without persisting them as manual slots, so the residual toggle is reversible.
- Keep scheduling arithmetic in pure helpers and separate data access in query hooks, so the interactions can be tested independently.