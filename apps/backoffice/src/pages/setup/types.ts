export type Step = 'store' | 'modules' | 'branding' | 'theme' | 'admin' | 'summary'

export type ModuleState = {
  enabled: boolean
  [key: string]: string | boolean | number
}

export type SetupData = {
  // Step 1
  storeName: string
  currency: string
  // Step 2
  modules: {
    stripe: { enabled: boolean; secretKey: string; webhookSecret: string }
    paypal: { enabled: boolean; clientId: string; clientSecret: string }
    resend: { enabled: boolean; apiKey: string; from: string }
    smtp: {
      enabled: boolean
      host: string
      port: string
      user: string
      password: string
      from: string
    }
    flatShipping: { enabled: boolean }
    vatEu: { enabled: boolean; homeCountry: string }
    reviews: { enabled: boolean }
    analytics: { enabled: boolean; provider: string; siteId: string }
  }
  // Step 3
  branding: {
    logoUrl: string
    tagline: string
    contactEmail: string
    primaryColor: string
  }
  // Step 4
  theme: 'classic' | 'editorial' | 'minimal'
  // Step 5
  adminKey: string
  // Launch option
  seedData: boolean
}

export const INITIAL: SetupData = {
  storeName: '',
  currency: 'EUR',
  modules: {
    stripe: { enabled: false, secretKey: '', webhookSecret: '' },
    paypal: { enabled: false, clientId: '', clientSecret: '' },
    resend: { enabled: false, apiKey: '', from: '' },
    smtp: { enabled: false, host: '', port: '587', user: '', password: '', from: '' },
    flatShipping: { enabled: false },
    vatEu: { enabled: false, homeCountry: 'FR' },
    reviews: { enabled: false },
    analytics: { enabled: false, provider: 'console', siteId: '' },
  },
  branding: { logoUrl: '', tagline: '', contactEmail: '', primaryColor: '#4f46e5' },
  theme: 'classic',
  adminKey: '',
  seedData: false,
}
