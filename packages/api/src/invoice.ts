import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  type FacturXInput,
  type OrderWithItems,
  type SellerConfig,
  generateFacturXXml,
} from '@redbirdshop/core'
import PDFDocument from 'pdfkit'

/**
 * Locate the embeddable TTF font. PDF/A-3 requires fonts to be embedded, but
 * pdfkit's built-in Helvetica is a non-embedded standard font. Resolve across
 * dev (src), Docker (dist) and tests (repo cwd); return null to degrade
 * gracefully to standard fonts if missing.
 */
function findFontPath(): string | null {
  const fromUrl = (rel: string): string => {
    try {
      return fileURLToPath(new URL(rel, import.meta.url))
    } catch {
      return ''
    }
  }
  const candidates = [
    resolve(process.cwd(), 'packages/api/assets/NotoSans-Regular.ttf'),
    resolve(process.cwd(), 'assets/NotoSans-Regular.ttf'),
    fromUrl('../assets/NotoSans-Regular.ttf'),
    fromUrl('../../assets/NotoSans-Regular.ttf'),
  ].filter(Boolean)
  return candidates.find((p) => existsSync(p)) ?? null
}

type Address = {
  firstName: string
  lastName: string
  line1: string
  line2?: string
  city: string
  postalCode: string
  countryCode: string
  phone?: string
}

function fmt(cents: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(cents / 100)
}

/**
 * Map a stored order to a Factur-X invoice input, deriving internally-consistent
 * totals (BR-CO-13/15/16): taxBasis = lines + shipping − discount, grand = basis + VAT.
 * `invoiceNumber` must be the sequential, gapless legal number.
 */
export function facturXFromOrder(
  order: OrderWithItems,
  seller: SellerConfig,
  invoiceNumber: string,
): FacturXInput {
  const addr = order.shippingAddress as Address | null
  const shipping = order.shippingAmount ?? 0
  const discount = order.discountAmount ?? 0
  const tax = order.taxAmount ?? 0
  const subtotal = order.subtotalAmount
  const taxBasis = subtotal + shipping - discount
  const grandTotal = taxBasis + tax

  // Multi-rate VAT. Each line carries its captured rate (basis points); lines
  // without one fall back to the order's effective rate. Per-rate bases and
  // taxes are reconciled so they sum exactly to the charged taxBasis / taxAmount.
  const fallbackBp = taxBasis > 0 && tax > 0 ? Math.round((tax / taxBasis) * 10000) : 0
  const lineBp = (li: OrderWithItems['lineItems'][number]): number => li.taxRateBp ?? fallbackBp

  const netByBp = new Map<number, number>()
  for (const li of order.lineItems) {
    netByBp.set(lineBp(li), (netByBp.get(lineBp(li)) ?? 0) + li.totalAmount)
  }
  const bps = [...netByBp.keys()].sort((a, b) => b - a)
  const top = bps[0]

  // Spread (shipping − discount) across rate groups proportionally to net.
  const adjustment = shipping - discount
  const basisByBp = new Map<number, number>()
  let basisAlloc = 0
  for (const bp of bps) {
    const net = netByBp.get(bp) ?? 0
    const basis = net + (subtotal > 0 ? Math.round((adjustment * net) / subtotal) : 0)
    basisByBp.set(bp, basis)
    basisAlloc += basis
  }
  if (top !== undefined) basisByBp.set(top, (basisByBp.get(top) ?? 0) + (taxBasis - basisAlloc))

  // Spread the charged tax across groups proportionally to basis × rate.
  const weights = bps.map((bp) => (basisByBp.get(bp) ?? 0) * bp)
  const sumW = weights.reduce((a, b) => a + b, 0)
  const taxByBp = new Map<number, number>()
  let taxAlloc = 0
  bps.forEach((bp, i) => {
    const t = sumW > 0 ? Math.round((tax * (weights[i] ?? 0)) / sumW) : 0
    taxByBp.set(bp, t)
    taxAlloc += t
  })
  if (top !== undefined) taxByBp.set(top, (taxByBp.get(top) ?? 0) + (tax - taxAlloc))

  const vatBreakdown = bps.map((bp) => ({
    ratePercent: bp / 100,
    basisCents: basisByBp.get(bp) ?? 0,
    taxCents: taxByBp.get(bp) ?? 0,
  }))

  return {
    invoiceNumber,
    issueDate: new Date(order.createdAt),
    currency: order.currency,
    seller,
    buyer: {
      name: addr ? `${addr.firstName} ${addr.lastName}` : (order.customerEmail ?? 'Customer'),
      ...(order.customerEmail ? { email: order.customerEmail } : {}),
      ...(addr
        ? {
            address: {
              line1: addr.line1,
              ...(addr.line2 ? { line2: addr.line2 } : {}),
              postalCode: addr.postalCode,
              city: addr.city,
              countryCode: addr.countryCode,
            },
          }
        : {}),
    },
    lines: order.lineItems.map((li) => ({
      name: `${li.productName} — ${li.variantName}`,
      quantity: li.quantity,
      unitPriceCents: li.unitPriceAmount,
      lineTotalCents: li.totalAmount,
      vatRatePercent: lineBp(li) / 100,
    })),
    lineTotalCents: subtotal,
    ...(shipping ? { chargeTotalCents: shipping } : {}),
    ...(discount ? { allowanceTotalCents: discount } : {}),
    taxBasisTotalCents: taxBasis,
    taxTotalCents: tax,
    grandTotalCents: grandTotal,
    amountDueCents: grandTotal,
    vatBreakdown,
  }
}

/** Generate the Factur-X (BASIC) CII XML for an order. */
export function generateFacturXForOrder(
  order: OrderWithItems,
  seller: SellerConfig,
  invoiceNumber: string,
): string {
  return generateFacturXXml(facturXFromOrder(order, seller, invoiceNumber))
}

type PdfDoc = InstanceType<typeof PDFDocument>

function drawInvoiceBody(
  doc: PdfDoc,
  order: OrderWithItems,
  storeName: string,
  displayNumber: string,
): void {
  const addr = order.shippingAddress as Address | null

  // ── Header ──────────────────────────────────────────────────────────────────
  doc.fontSize(20).font('Helvetica-Bold').text(storeName, 50, 50)
  doc.fontSize(10).font('Helvetica').fillColor('#6b7280')

  doc
    .fontSize(22)
    .font('Helvetica-Bold')
    .fillColor('#111827')
    .text('INVOICE', 400, 50, { align: 'right' })
  doc
    .fontSize(10)
    .font('Helvetica')
    .fillColor('#6b7280')
    .text(`#${displayNumber}`, 400, 76, { align: 'right' })
    .text(
      new Date(order.createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
      400,
      89,
      { align: 'right' },
    )

  // ── Bill to ──────────────────────────────────────────────────────────────────
  doc.moveDown(3)
  const billY = doc.y
  doc.fontSize(8).fillColor('#9ca3af').font('Helvetica-Bold').text('BILL TO', 50, billY)
  doc.fontSize(11).fillColor('#111827').font('Helvetica-Bold')
  if (addr) doc.text(`${addr.firstName} ${addr.lastName}`, 50, billY + 14)
  doc.fontSize(10).font('Helvetica').fillColor('#374151')
  if (order.customerEmail) doc.text(order.customerEmail)
  if (addr) {
    doc.text(addr.line1)
    if (addr.line2) doc.text(addr.line2)
    doc.text(`${addr.postalCode} ${addr.city}`)
    doc.text(addr.countryCode)
    if (addr.phone) doc.text(addr.phone)
  }

  // ── Line items table ─────────────────────────────────────────────────────────
  doc.moveDown(2)
  const tableTop = doc.y
  const col = { item: 50, qty: 310, unit: 370, total: 460 }

  doc.fillColor('#f9fafb').rect(50, tableTop, 510, 20).fill()
  doc
    .fontSize(9)
    .font('Helvetica-Bold')
    .fillColor('#6b7280')
    .text('ITEM', col.item, tableTop + 5)
    .text('QTY', col.qty, tableTop + 5)
    .text('UNIT PRICE', col.unit, tableTop + 5)
    .text('TOTAL', col.total, tableTop + 5, { align: 'right', width: 100 })

  let y = tableTop + 24
  doc.font('Helvetica').fontSize(10).fillColor('#111827')

  for (const li of order.lineItems) {
    const label = `${li.productName} — ${li.variantName}`
    const lineHeight = doc.heightOfString(label, { width: 250 })
    doc
      .fillColor('#f3f4f6')
      .rect(50, y - 2, 510, lineHeight + 10)
      .fill()
    doc
      .fillColor('#111827')
      .text(label, col.item, y, { width: 250 })
      .text(String(li.quantity), col.qty, y)
      .text(fmt(li.unitPriceAmount, li.unitPriceCurrency), col.unit, y)
      .text(fmt(li.totalAmount, li.unitPriceCurrency), col.total, y, { align: 'right', width: 100 })
    doc
      .fillColor('#e5e7eb')
      .rect(50, y + lineHeight + 7, 510, 1)
      .fill()
    y += lineHeight + 14
  }

  // ── Totals ───────────────────────────────────────────────────────────────────
  y += 10
  const labelX = 390
  const valueX = 460

  if (order.subtotalAmount !== order.totalAmount) {
    doc
      .fontSize(10)
      .fillColor('#6b7280')
      .font('Helvetica')
      .text('Subtotal', labelX, y)
      .text(fmt(order.subtotalAmount, order.currency), valueX, y, { align: 'right', width: 100 })
    y += 18
  }

  if ((order.shippingAmount ?? 0) > 0) {
    doc
      .text('Shipping', labelX, y)
      .text(fmt(order.shippingAmount!, order.currency), valueX, y, { align: 'right', width: 100 })
    y += 18
  }

  if ((order.taxAmount ?? 0) > 0) {
    doc
      .text('VAT', labelX, y)
      .text(fmt(order.taxAmount!, order.currency), valueX, y, { align: 'right', width: 100 })
    y += 18
  }

  if ((order.discountAmount ?? 0) > 0) {
    doc.fillColor('#16a34a')
    doc
      .text(`Discount${order.promoCode ? ` (${order.promoCode})` : ''}`, labelX, y)
      .text(`−${fmt(order.discountAmount!, order.currency)}`, valueX, y, {
        align: 'right',
        width: 100,
      })
    doc.fillColor('#111827')
    y += 18
  }

  doc.fillColor('#e5e7eb').rect(labelX, y, 160, 1).fill()
  y += 6
  doc
    .fontSize(12)
    .font('Helvetica-Bold')
    .fillColor('#111827')
    .text('Total', labelX, y)
    .text(fmt(order.totalAmount, order.currency), valueX, y, { align: 'right', width: 100 })

  // ── Status badge ─────────────────────────────────────────────────────────────
  y += 40
  const statusColors: Record<string, string> = {
    paid: '#16a34a',
    fulfilled: '#16a34a',
    pending: '#d97706',
    cancelled: '#6b7280',
    refunded: '#6b7280',
  }
  doc
    .fontSize(9)
    .font('Helvetica-Bold')
    .fillColor(statusColors[order.status] ?? '#6b7280')
    .text(order.status.toUpperCase(), 50, y)
}

/** Collect a pdfkit document into a single Buffer once it finishes writing. */
function renderDoc(doc: PdfDoc): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    doc.on('data', (c: Buffer) => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
    doc.end()
  })
}

/** Plain visual invoice PDF. */
export function generateInvoicePdf(order: OrderWithItems, storeName: string): Promise<Buffer> {
  const doc = new PDFDocument({ margin: 50, size: 'A4' })
  drawInvoiceBody(doc, order, storeName, order.number)
  return renderDoc(doc)
}

/**
 * Factur-X XMP: the fx: properties + the mandatory PDF/A extension schema that
 * declares them (PDF/A-3 requires every custom XMP property to be described in
 * an extension schema — veraPDF clause 6.6.2.3).
 */
function facturXXmp(): string {
  const prop = (name: string, desc: string): string =>
    [
      '<rdf:li rdf:parseType="Resource">',
      `<pdfaProperty:name>${name}</pdfaProperty:name>`,
      '<pdfaProperty:valueType>Text</pdfaProperty:valueType>',
      '<pdfaProperty:category>external</pdfaProperty:category>',
      `<pdfaProperty:description>${desc}</pdfaProperty:description>`,
      '</rdf:li>',
    ].join('')

  const extensionSchema = [
    '<rdf:Description rdf:about="" xmlns:pdfaExtension="http://www.aiim.org/pdfa/ns/extension/" xmlns:pdfaSchema="http://www.aiim.org/pdfa/ns/schema#" xmlns:pdfaProperty="http://www.aiim.org/pdfa/ns/property#">',
    '<pdfaExtension:schemas><rdf:Bag><rdf:li rdf:parseType="Resource">',
    '<pdfaSchema:schema>Factur-X PDFA Extension Schema</pdfaSchema:schema>',
    '<pdfaSchema:namespaceURI>urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#</pdfaSchema:namespaceURI>',
    '<pdfaSchema:prefix>fx</pdfaSchema:prefix>',
    '<pdfaSchema:property><rdf:Seq>',
    prop('DocumentFileName', 'name of the embedded XML invoice file'),
    prop('DocumentType', 'INVOICE'),
    prop('Version', 'The actual version of the Factur-X XML schema'),
    prop('ConformanceLevel', 'The conformance level of the embedded Factur-X data'),
    '</rdf:Seq></pdfaSchema:property>',
    '</rdf:li></rdf:Bag></pdfaExtension:schemas>',
    '</rdf:Description>',
  ].join('')

  const facturX = [
    '<rdf:Description xmlns:fx="urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#" rdf:about="">',
    '<fx:DocumentType>INVOICE</fx:DocumentType>',
    '<fx:DocumentFileName>factur-x.xml</fx:DocumentFileName>',
    '<fx:Version>1.0</fx:Version>',
    '<fx:ConformanceLevel>BASIC</fx:ConformanceLevel>',
    '</rdf:Description>',
  ].join('')

  return extensionSchema + facturX
}

/**
 * Factur-X invoice: a PDF/A-3 with the CII XML embedded as an associated file
 * (AFRelationship=Data) plus the Factur-X XMP (incl. the PDF/A extension schema).
 * pdfkit adds the OutputIntent + sRGB ICC + pdfaid metadata for PDF/A-3b.
 *
 * The text font is a real embedded TTF (Noto Sans) set as the document default,
 * so no non-embedded standard font (Helvetica) ends up in the file — required
 * for strict PDF/A-3b conformance.
 */
export function generateFacturXPdf(
  order: OrderWithItems,
  seller: SellerConfig,
  invoiceNumber: string,
  storeName: string,
): Promise<Buffer> {
  const xml = generateFacturXForOrder(order, seller, invoiceNumber)
  const issuedAt = order.invoicedAt ? new Date(order.invoicedAt) : new Date()
  // Resolve the embeddable font BEFORE constructing the doc, so it can be the
  // default font — otherwise pdfkit creates a non-embedded Helvetica at init.
  const fontPath = findFontPath()
  const doc = new PDFDocument({
    margin: 50,
    size: 'A4',
    pdfVersion: '1.7',
    subset: 'PDF/A-3b',
    tagged: true,
    lang: 'fr-FR',
    info: { Title: `Invoice ${invoiceNumber}`, Author: storeName },
    ...(fontPath ? { font: fontPath } : {}),
  } as ConstructorParameters<typeof PDFDocument>[0])

  // Map the Helvetica names used by drawInvoiceBody to the embedded TTF too.
  if (fontPath) {
    doc.registerFont('Helvetica', fontPath)
    doc.registerFont('Helvetica-Bold', fontPath)
  }

  // appendXML / file (embedded files) exist in pdfkit 0.19 but not in @types/pdfkit.
  const pdfa = doc as unknown as {
    appendXML(xml: string): void
    file(src: Buffer, opts: Record<string, unknown>): void
  }
  pdfa.appendXML(facturXXmp())
  drawInvoiceBody(doc, order, storeName, invoiceNumber)
  pdfa.file(Buffer.from(xml, 'utf8'), {
    name: 'factur-x.xml',
    type: 'text/xml',
    relationship: 'Data',
    description: 'Factur-X',
    creationDate: issuedAt,
    modifiedDate: issuedAt,
  })
  return renderDoc(doc)
}
