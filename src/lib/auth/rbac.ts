// Role-based access control helpers for server components and API routes.
// Roles: admin (full), door_staff (check-in only). See docs/security/auth.md.

export type Role = 'admin' | 'door_staff'

export interface AuthUser {
  id?: string
  role?: Role
  email?: string
  mfaEnabled?: boolean
}

export function isAdmin(user: unknown): user is AuthUser {
  return (user as AuthUser | null)?.role === 'admin'
}

export function isDoorStaff(user: unknown): user is AuthUser {
  return (user as AuthUser | null)?.role === 'door_staff'
}

export function isAuthenticated(user: unknown): user is AuthUser {
  return Boolean(user) && Boolean((user as AuthUser | null)?.role)
}

// Admin: manage bookings (CRUD, financial, cancel/refund). Door-staff: NEVER.
export function canManageBookings(user: unknown): boolean {
  return isAdmin(user)
}

// Door-staff may read bookings (for check-in context) and update ONLY check-in fields.
export function canCheckIn(user: unknown): boolean {
  return isAuthenticated(user) && (isAdmin(user) || isDoorStaff(user))
}

// Door-staff may update only the checkedInAt / checkInStaff fields on a booking.
export function canUpdateCheckInFields(user: unknown): boolean {
  return canCheckIn(user)
}

export function canManageContent(user: unknown): boolean {
  return isAdmin(user)
}

export function canManageUsers(user: unknown): boolean {
  return isAdmin(user)
}
