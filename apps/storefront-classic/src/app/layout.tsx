import { Header } from '@/components/Header'
import type { Metadata } from 'next'
import { Fraunces, Inter } from 'next/font/google'
import './globals.css'

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  axes: ['SOFT', 'WONK', 'opsz'],
  display: 'swap',
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Redbird Coffee — Café de spécialité',
  description: 'Café de spécialité torréfié à la commande. Origines uniques et blends signature.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${fraunces.variable} ${inter.variable}`}>
      <body className="min-h-screen">
        <Header />
        <main className="relative z-10">{children}</main>
        <footer className="relative z-10 mt-32 border-t border-rule">
          <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-12 text-sm text-ink-soft lg:flex-row lg:items-center lg:justify-between lg:px-10">
            <div className="font-display text-xl text-ink">Redbird Coffee.</div>
            <p className="max-w-md">
              Torréfaction artisanale en région parisienne. Livraison en 48 h. Café torréfié dans la
              semaine.
            </p>
            <p className="text-xs uppercase tracking-widest">© 2026 — Made with Redbird</p>
          </div>
        </footer>
      </body>
    </html>
  )
}
