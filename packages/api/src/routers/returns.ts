import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { adminProcedure, protectedProcedure, router } from '../trpc.js'

export const returnsRouter = router({
  /** Authenticated customers only — request a return on an order they own. */
  create: protectedProcedure
    .input(
      z.object({
        orderId: z.string().uuid(),
        reason: z.string().min(10).max(1000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const order = await ctx.redbird.orders.get(input.orderId)
      if (!order || order.customerId !== ctx.customerId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Order not found' })
      }
      return ctx.redbird.returns.create(input)
    }),

  list: adminProcedure
    .input(
      z
        .object({
          orderId: z.string().uuid().optional(),
          status: z.enum(['pending', 'approved', 'rejected']).optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const opts: Parameters<typeof ctx.redbird.returns.list>[0] = {}
      if (input?.orderId !== undefined) opts.orderId = input.orderId
      if (input?.status !== undefined) opts.status = input.status
      return ctx.redbird.returns.list(opts)
    }),

  get: adminProcedure.input(z.object({ id: z.string().uuid() })).query(async ({ ctx, input }) => {
    return ctx.redbird.returns.get(input.id)
  }),

  approve: adminProcedure
    .input(z.object({ id: z.string().uuid(), adminNote: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const req = await ctx.redbird.returns.approve(input.id, input.adminNote)
      // Auto-trigger refund on the order
      await ctx.redbird.orders.refund(req.orderId)
      return req
    }),

  reject: adminProcedure
    .input(z.object({ id: z.string().uuid(), adminNote: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.redbird.returns.reject(input.id, input.adminNote)
    }),

  /** Authenticated customers — list their own return requests. */
  myRequests: protectedProcedure
    .input(z.object({ status: z.enum(['pending', 'approved', 'rejected']).optional() }).optional())
    .query(async ({ ctx, input }) => {
      // Fetch orders for this customer, then find return requests for those order IDs
      const customerOrders = await ctx.redbird.orders.list({ customerId: ctx.customerId, limit: 200 })
      if (customerOrders.length === 0) return []
      const orderIds = new Set(customerOrders.map((o) => o.id))
      const all = await ctx.redbird.returns.list({ status: input?.status })
      return all.filter((r) => orderIds.has(r.orderId))
    }),
})
