const ADMIN_KEY = 'redbird_admin_key'
const STAFF_TOKEN = 'redbird_staff_token'
const STAFF_ROLE = 'redbird_staff_role'
const SELLER_TOKEN = 'redbird_seller_token'

export function getAdminKey(): string | null {
  return localStorage.getItem(ADMIN_KEY)
}

export function setAdminKey(key: string): void {
  localStorage.setItem(ADMIN_KEY, key)
}

export function clearAdminKey(): void {
  localStorage.removeItem(ADMIN_KEY)
}

export function getStaffToken(): string | null {
  return localStorage.getItem(STAFF_TOKEN)
}

export function getStaffRole(): string | null {
  return localStorage.getItem(STAFF_ROLE)
}

export function setStaffSession(token: string, role: string): void {
  localStorage.setItem(STAFF_TOKEN, token)
  localStorage.setItem(STAFF_ROLE, role)
}

export function clearStaffSession(): void {
  localStorage.removeItem(STAFF_TOKEN)
  localStorage.removeItem(STAFF_ROLE)
}

export function isAuthenticated(): boolean {
  return Boolean(getAdminKey() || getStaffToken())
}

export function clearSession(): void {
  clearAdminKey()
  clearStaffSession()
}

// ── Marketplace seller session — separate from staff/admin auth above ────────

export function getSellerToken(): string | null {
  return localStorage.getItem(SELLER_TOKEN)
}

export function setSellerToken(token: string): void {
  localStorage.setItem(SELLER_TOKEN, token)
}

export function clearSellerToken(): void {
  localStorage.removeItem(SELLER_TOKEN)
}

export function isSellerAuthenticated(): boolean {
  return Boolean(getSellerToken())
}
