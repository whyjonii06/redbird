export type LicensePlan = 'free' | 'pro'

export type LicenseInfo = {
  valid: boolean
  plan: LicensePlan
  email: string
  expiresAt: string | null  // ISO date or null if active subscription
  authorizedPlugins: string[]  // ['*'] = all plugins authorized
}
