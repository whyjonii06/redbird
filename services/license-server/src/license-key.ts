import { randomBytes, randomUUID } from 'node:crypto'

export function generateLicenseKey(test = false): string {
  const prefix = test ? 'rb_test_' : 'rb_live_'
  return prefix + randomBytes(20).toString('hex')
}

export function generateId(): string {
  return randomUUID()
}
