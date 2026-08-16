import { ProductCard } from '@/components/ProductCard'
import { trpc } from '@/lib/trpc'
import Link from 'next/link'

export default async function HomePage() {
  const products = await trpc.catalog.list.query({ limit: 6, status: 'active' })

  return (
    <div className="relative">
      {/* ─── Hero ─── */}
      <section className="relative overflow-hidden border-b border-rule">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-12 px-6 py-20 lg:grid-cols-12 lg:px-10 lg:py-32">
          <div className="lg:col-span-7">
            <p className="mb-8 inline-flex items-center gap-3 text-xs uppercase tracking-widest text-copper">
              <span className="h-px w-8 bg-copper" />
              Torréfaction #027 — Juin 2026
            </p>
            <h1 className="font-display text-[clamp(3rem,8vw,7rem)] font-medium leading-[0.95] tracking-tight text-ink">
              Le café <em className="font-display italic text-copper">infusé</em>
              <br />
              comme il devrait l'être.
            </h1>
            <p className="mt-10 max-w-xl text-lg leading-relaxed text-ink-soft">
              Six origines sélectionnées chaque saison, torréfiées à la commande dans notre atelier
              de Pantin. Pas de stock, pas de compromis.
            </p>
            <div className="mt-12 flex flex-wrap items-center gap-6">
              <Link
                href="/products"
                className="group inline-flex items-center gap-3 bg-ink px-8 py-4 text-sm uppercase tracking-widest text-paper transition-colors hover:bg-copper"
              >
                Découvrir le catalogue
                <span className="inline-block transition-transform group-hover:translate-x-1">
                  →
                </span>
              </Link>
              <Link
                href="#story"
                className="text-sm uppercase tracking-widest text-ink-soft underline-offset-4 hover:underline"
              >
                Notre approche
              </Link>
            </div>
          </div>

          <div className="hidden lg:col-span-5 lg:flex lg:items-end">
            <div className="grid w-full grid-cols-2 gap-px bg-rule">
              <Stat label="origines" value="06" />
              <Stat label="torréfactions" value="027" />
              <Stat label="jours fraîcheur" value="14" />
              <Stat label="grammes par sachet" value="250" />
            </div>
          </div>
        </div>
      </section>

      {/* ─── Featured ─── */}
      <section className="mx-auto max-w-7xl px-6 py-24 lg:px-10">
        <div className="mb-16 flex items-end justify-between gap-8">
          <div>
            <p className="mb-3 text-xs uppercase tracking-widest text-copper">Sélection du mois</p>
            <h2 className="font-display text-5xl font-medium tracking-tight text-ink">
              Cafés d'origine
            </h2>
          </div>
          <Link
            href="/products"
            className="hidden text-sm uppercase tracking-widest text-ink-soft underline-offset-4 hover:underline md:inline-block"
          >
            Tout voir →
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-x-8 gap-y-16 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      {/* ─── Story ─── */}
      <section id="story" className="border-t border-rule bg-paper-deep">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-12 px-6 py-24 lg:grid-cols-12 lg:px-10">
          <div className="lg:col-span-5">
            <p className="mb-3 text-xs uppercase tracking-widest text-copper">Notre approche</p>
            <h2 className="font-display text-5xl font-medium leading-tight tracking-tight text-ink">
              Cinq jours entre la torréfaction et votre tasse.
            </h2>
          </div>
          <div className="space-y-8 lg:col-span-6 lg:col-start-7">
            <p className="text-lg leading-relaxed text-ink-soft">
              Nous torréfions chaque mardi et chaque jeudi, sur des lots de moins de 10 kg. Vous
              recevez votre café au maximum 5 jours après sa sortie du tambour.
            </p>
            <div className="grid grid-cols-3 gap-px border border-rule bg-rule">
              <Step n="01" label="Mardi — torréfaction" />
              <Step n="02" label="Mercredi — préparation" />
              <Step n="03" label="Jeudi — expédition" />
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-paper p-8">
      <div className="font-display text-5xl tracking-tight text-ink">{value}</div>
      <div className="mt-2 text-xs uppercase tracking-widest text-ink-soft">{label}</div>
    </div>
  )
}

function Step({ n, label }: { n: string; label: string }) {
  return (
    <div className="bg-paper p-6">
      <div className="font-display text-2xl text-copper">{n}</div>
      <div className="mt-3 text-xs uppercase tracking-widest text-ink-soft">{label}</div>
    </div>
  )
}
