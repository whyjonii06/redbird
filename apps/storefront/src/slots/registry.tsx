import type { ComponentType } from 'react'
import { ReviewsWidget } from '../modules/reviews/ReviewsWidget.js'

/**
 * Storefront slot registry — the front-office "hook" mechanism.
 *
 * Modules register widgets against named slots (e.g. "product.tab",
 * "home.section", "footer"). Pages render a `<Slot name="…" />` where
 * extensions may inject UI, without the page knowing which modules exist.
 * This generalises the theme-section pattern into a module extension point.
 *
 * Props passed to <Slot> are forwarded to every widget; types are loose at
 * this boundary by design (each slot documents its own prop contract).
 */

type AnyProps = Record<string, unknown>

export type SlotWidget = {
  /** Owning module name (matches the backend module). */
  module: string
  /** Slot this widget fills. */
  slot: string
  Component: ComponentType<AnyProps>
}

export const SLOT_WIDGETS: SlotWidget[] = [
  {
    module: '@redbird/module-reviews',
    slot: 'product.tab',
    Component: ReviewsWidget as ComponentType<AnyProps>,
  },
]

/** Renders every widget registered for `name`, forwarding the remaining props. */
export function Slot({ name, ...props }: { name: string } & AnyProps) {
  const widgets = SLOT_WIDGETS.filter((w) => w.slot === name)
  if (widgets.length === 0) return null
  return (
    <>
      {widgets.map((w) => (
        <w.Component key={w.module} {...props} />
      ))}
    </>
  )
}
