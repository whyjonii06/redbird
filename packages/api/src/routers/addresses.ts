import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { protectedProcedure, router } from '../trpc.js'

const addressInput = z.object({
  label: z.string().min(1).max(50).optional(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  line1: z.string().min(1),
  line2: z.string().optional(),
  city: z.string().min(1),
  postalCode: z.string().min(1),
  countryCode: z.string().length(2),
  phone: z.string().optional(),
  isDefault: z.boolean().optional(),
})

export const addressesRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.redbird.addresses.list(ctx.customerId)
  }),

  create: protectedProcedure.input(addressInput).mutation(async ({ ctx, input }) => {
    return ctx.redbird.addresses.create(ctx.customerId, input)
  }),

  update: protectedProcedure
    .input(z.object({ id: z.string().uuid() }).merge(addressInput.partial()))
    .mutation(async ({ ctx, input }) => {
      try {
        const patch: Parameters<typeof ctx.redbird.addresses.update>[2] = {}
        if (input.label !== undefined) patch.label = input.label
        if (input.firstName !== undefined) patch.firstName = input.firstName
        if (input.lastName !== undefined) patch.lastName = input.lastName
        if (input.line1 !== undefined) patch.line1 = input.line1
        if (input.line2 !== undefined) patch.line2 = input.line2
        if (input.city !== undefined) patch.city = input.city
        if (input.postalCode !== undefined) patch.postalCode = input.postalCode
        if (input.countryCode !== undefined) patch.countryCode = input.countryCode
        if (input.phone !== undefined) patch.phone = input.phone
        if (input.isDefault !== undefined) patch.isDefault = input.isDefault
        return await ctx.redbird.addresses.update(ctx.customerId, input.id, patch)
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Update failed'
        throw new TRPCError({ code: 'NOT_FOUND', message: msg })
      }
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await ctx.redbird.addresses.delete(ctx.customerId, input.id)
        return { success: true }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Not found'
        throw new TRPCError({ code: 'NOT_FOUND', message: msg })
      }
    }),

  setDefault: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await ctx.redbird.addresses.setDefault(ctx.customerId, input.id)
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Not found'
        throw new TRPCError({ code: 'NOT_FOUND', message: msg })
      }
    }),
})
