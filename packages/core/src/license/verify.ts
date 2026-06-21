import type { LicenseInfo } from './types.js'

export const LICENSE_SERVER_URL = 'https://api.redbird.dev'

export async function verifyLicense(
  key: string,
  serverUrl: string = LICENSE_SERVER_URL,
): Promise<LicenseInfo | null> {
  try {
    const res = await fetch(`${serverUrl}/v1/licenses/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key }),
      signal: AbortSignal.timeout(5000),  // 5s timeout
    })
    if (!res.ok) return null
    return res.json() as Promise<LicenseInfo>
  } catch {
    // Network error or timeout — graceful degradation
    return null
  }
}
