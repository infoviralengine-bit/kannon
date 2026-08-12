/**
 * Single source of truth for role constants.
 * Use ROLES.* instead of magic strings throughout the codebase.
 */

export const ROLES = {
  ADMIN: "admin",
  TEAM: "team",
  CAMPAIGN_MANAGER: "campaign_manager",
  CREATOR: "creator",
  CLIENT: "client",
} as const;

export type AppRole = typeof ROLES[keyof typeof ROLES];

/**
 * Role groups for sidebar visibility / page access.
 */
export const ROLE_GROUPS = {
  /** Full ops access (admin + team operators) */
  STAFF: [ROLES.ADMIN, ROLES.TEAM] as AppRole[],

  /** All dashboard-accessing internal roles (not creators/clients) */
  INTERNAL: [
    ROLES.ADMIN,
    ROLES.TEAM,
    ROLES.CAMPAIGN_MANAGER,
  ] as AppRole[],

  /** External roles routed to dedicated portals */
  EXTERNAL: [ROLES.CREATOR, ROLES.CLIENT] as AppRole[],
} as const;

/**
 * Helper: check if a role has access to a given menu item.
 */
export function canAccess(role: AppRole | null, allowedRoles: readonly AppRole[]): boolean {
  if (!role) return false;
  return allowedRoles.includes(role);
}

/**
 * Helper: is this role one of the "full access" staff?
 */
export function isStaff(role: AppRole | null): boolean {
  return canAccess(role, ROLE_GROUPS.STAFF);
}

/**
 * Default landing route for each role.
 */
export const ROLE_DEFAULT_ROUTE: Record<AppRole, string> = {
  [ROLES.ADMIN]: "/dashboard",
  [ROLES.TEAM]: "/dashboard",
  [ROLES.CAMPAIGN_MANAGER]: "/dashboard/content-calendar",
  [ROLES.CREATOR]: "/creator",
  [ROLES.CLIENT]: "/client",
};