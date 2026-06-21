import type { Order, OrderLineItem } from '@redbirdshop/plugin-sdk'

type TemplateContext = {
  order: Order
  lineItems?: ReadonlyArray<OrderLineItem> | undefined
  storeName?: string | undefined
  primaryColor?: string | undefined
}

function layout(title: string, body: string, primaryColor = '#1a1a1a'): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; margin: 0; padding: 40px 0; }
    .wrapper { max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,.08); }
    .header { background: ${primaryColor}; color: #fff; padding: 28px 32px; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 600; }
    .body { padding: 32px; color: #333; line-height: 1.6; }
    .order-ref { font-size: 13px; color: #888; margin-bottom: 24px; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th { text-align: left; font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: .5px; border-bottom: 1px solid #eee; padding: 8px 0; }
    td { padding: 10px 0; border-bottom: 1px solid #f5f5f5; font-size: 14px; }
    .total { font-weight: 600; font-size: 15px; }
    .footer { padding: 20px 32px; background: #fafafa; font-size: 12px; color: #aaa; border-top: 1px solid #eee; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header"><h1>${title}</h1></div>
    <div class="body">${body}</div>
    <div class="footer">You received this email because you placed an order. Please do not reply to this email.</div>
  </div>
</body>
</html>`
}

function formatAmount(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount / 100)
}

function lineItemsTable(lineItems: ReadonlyArray<OrderLineItem>, currency: string): string {
  const rows = lineItems
    .map(
      (li) =>
        `<tr>
          <td>${li.productName} — ${li.variantName}</td>
          <td style="text-align:center">${li.quantity}</td>
          <td style="text-align:right">${formatAmount(li.unitPriceAmount * li.quantity, currency)}</td>
        </tr>`,
    )
    .join('')
  return `<table>
    <thead><tr><th>Item</th><th style="text-align:center">Qty</th><th style="text-align:right">Price</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`
}

export function orderConfirmationTemplate({
  order,
  lineItems = [],
  storeName = 'Store',
  primaryColor,
}: TemplateContext): {
  subject: string
  html: string
  text: string
} {
  const subject = `Order confirmation #${order.number} — ${storeName}`
  const total = formatAmount(order.totalAmount, order.currency)
  const table = lineItemsTable(lineItems, order.currency)

  const html = layout(
    `Order confirmed — #${order.number}`,
    `<p>Thank you for your order! We've received it and will start processing it shortly.</p>
    <p class="order-ref">Order #${order.number}</p>
    ${table}
    <p class="total">Total: ${total}</p>
    <p>We'll send you another email when your order ships.</p>`,
    primaryColor,
  )

  const text = `Order #${order.number} confirmed\nTotal: ${total}\n\nThank you for shopping at ${storeName}.`
  return { subject, html, text }
}

export function orderPaidTemplate({ order, storeName = 'Store', primaryColor }: TemplateContext): {
  subject: string
  html: string
  text: string
} {
  const subject = `Payment received for order #${order.number}`
  const total = formatAmount(order.totalAmount, order.currency)

  const html = layout(
    `Payment received — #${order.number}`,
    `<p>Great news! We've received your payment of <strong>${total}</strong> for order #${order.number}.</p>
    <p>Your order is now being prepared for fulfillment.</p>`,
    primaryColor,
  )

  const text = `Payment received for order #${order.number}\nAmount: ${total}\n\nThank you, ${storeName}.`
  return { subject, html, text }
}

export function orderFulfilledTemplate({ order, storeName = 'Store', primaryColor }: TemplateContext): {
  subject: string
  html: string
  text: string
} {
  const subject = `Your order #${order.number} has shipped!`

  const html = layout(
    `Order shipped — #${order.number}`,
    `<p>Your order #${order.number} is on its way!</p>
    <p>You will receive a tracking number from the carrier shortly.</p>
    <p>Thank you for shopping at ${storeName}!</p>`,
    primaryColor,
  )

  const text = `Order #${order.number} has shipped.\n\nThank you for shopping at ${storeName}.`
  return { subject, html, text }
}

export function orderCancelledTemplate({ order, storeName = 'Store', primaryColor }: TemplateContext): {
  subject: string
  html: string
  text: string
} {
  const subject = `Order #${order.number} has been cancelled`

  const html = layout(
    `Order cancelled — #${order.number}`,
    `<p>Your order #${order.number} has been cancelled.</p>
    <p>If you paid for this order, a refund will be issued within 5–10 business days.</p>
    <p>If you have any questions, please contact us.</p>`,
    primaryColor,
  )

  const text = `Order #${order.number} has been cancelled.\n\nIf you have questions, contact ${storeName}.`
  return { subject, html, text }
}
