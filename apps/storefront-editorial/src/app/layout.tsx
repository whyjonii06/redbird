import { Masthead } from '@/components/Masthead'
import type { Metadata } from 'next'
import { Bodoni_Moda, Manrope } from 'next/font/google'
import './globals.css'

const bodoni = Bodoni_Moda({
  subsets: ['latin'],
  variable: '--font-bodoni',
  display: 'swap',
})

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-manrope',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Redbird · Cahier — Vol. XXVII',
  description: 'Le cahier mensuel du café de spécialité. Origines, torréfactions, gestes.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${bodoni.variable} ${manrope.variable}`}>
      <body>
        <Masthead />
        <main>{children}</main>
        <footer className="mt-32 border-t border-coal-rule">
          <div className="mx-auto max-w-[1400px] px-6 py-12 lg:px-12">
            <div className="flex flex-col gap-6 text-xs uppercase tracking-[0.25em] text-ivory-muted lg:flex-row lg:items-center lg:justify-between">
              <div>Édité depuis Pantin — Atelier de torréfaction №27</div>
              <div>© 2026 — Redbird Cahier — Tous droits réservés</div>
            </div>
            <div className="mt-12 font-serif text-[clamp(3rem,12vw,9rem)] italic leading-none text-ruby">
              Bon café.
            </div>
          </div>
        </footer>
      </body>
    </html>
  )
}
