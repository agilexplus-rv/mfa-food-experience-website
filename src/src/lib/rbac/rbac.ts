/**
 * Role-Based Access Control helpers for the Malta Food Experience platform.
 *
 * Used in Payload collection access control, Next.js middleware,
 * and server components / API routes.
 *
 * Roles:
 *   'admin'      — Full access to all collections and admin routes.
 *   'door_staff' — Check-in only: read bookings, update check-in fields.
 */

export type UserRole = 'admin' | 'door_staff'

export interface SessionUser {
  id: string
  email: string
  role: UserRole
  collection: string
}

// ── Role predicates ──────────────────────────────────────────────

export function isAdmin(user: SessionUser | null | undefined): boolean {
  return user?.role === 'admin'
}

export function isDoorStaff(user: SessionUser | null | undefined): boolean {
  return user?.role === 'door_staff'
}

export function isAuthenticated(user: SessionUser | null | undefined): boolean {
  return Boolean(user?.id)
}

// ── Permission predicates ────────────────────────────────────────

/** Admin only: can manage bookings (CRUD, financial data, cancel). */
export function canManageBookings(user: SessionUser | null | undefined): boolean {
  return isAdmin(user)
}

/** Admin or door_staff: can access the check-in flow. */
export function canCheckIn(user: SessionUser | null | undefined): boolean {
  return isAdmin(user) || isDoorStaff(user)
}

/** Admin only: can manage users (create, delete, assign roles). */
export function canManageUsers(user: SessionUser | null | undefined): boolean {
  return isAdmin(user)
}

/** Admin only: can access audit logs. */
export function canAccessAuditLog(user: SessionUser | null | undefined): boolean {
  return isAdmin(user)
}

// ── Payload access control helpers ───────────────────────────────

/**
 * Admin has full access; everyone else denied.
 * For create/update/delete on collections door_staff must not touch.
 */
export function adminOnlyAccess({
  req: { user },
}: {
  req: { user: SessionUser | null }
}): boolean {
  return isAdmin(user)
}
