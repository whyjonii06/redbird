import { Topbar } from '@/components/Topbar'
import type { Metadata } from 'next'
import { IBM_Plex_Sans, JetBrains_Mono } from 'next/font/google'
import './globals.css'

const plex = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-plex-sans',
  display: 'swap',
})

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Redbird Pro · Grossiste café de spécialité',
  description:
    'Approvisionnement professionnel café de spécialité : cafés, restaurants, hôtellerie. Tarifs HT.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${plex.variable} ${jetbrains.variable}`}>
      <body>
        <Topbar />
        <main>{children}</main>
        <footer className="mt-24 border-t border-line bg-surface">
          <div className="mx-auto flex max-w-[1600px] flex-col gap-3 px-6 py-6 text-xs text-slate lg:flex-row lg:items-center lg:justify-between lg:px-10">
            <div className="font-mono">
              Redbird Pro SAS · SIRET 901 234 567 00012 · RCS Paris · TVA FR12345678901
            </div>
            <div className="font-mono">© 2026 · Tarifs HT · Conditions générales pro V2.4</div>
          </div>
        </footer>
      </body>
    </html>
  )
}
