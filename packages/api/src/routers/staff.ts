import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { writeAudit } from '../audit.js'
import { signStaffToken } from '../auth.js'
import { authLimitedProcedure, ownerProcedure, router, staffProcedure } from '../trpc.js'

const roleEnum = z.enum(['owner', 'admin', 'warehouse', 'support'])

export const staffRouter = router({
  /** Login with email + password → returns staff JWT */
  login: authLimitedProcedure
    .input(z.object({ email: z.string().email(), password: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const member = await ctx.redbird.staff.login(input.email, input.password)
      if (!member) throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid credentials' })
      const token = signStaffToken(member.id, member.role, ctx.jwtSecret)
      return { token, staff: member }
    }),

  /** Get authenticated staff member's profile */
  me: staffProcedure.query(async ({ ctx }) => {
    if (!ctx.staffId) throw new TRPCError({ code: 'UNAUTHORIZED' })
    const member = await ctx.redbird.staff.get(ctx.staffId)
    if (!member) throw new TRPCError({ code: 'NOT_FOUND' })
    return member
  }),

  /** List all staff — owner only */
  list: ownerProcedure.query(async ({ ctx }) => ctx.redbird.staff.list()),

  /** Create a staff member — owner only */
  create: ownerProcedure
    .input(
      z.object({
        email: z.string().email(),
        password: z.string().min(8),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        role: roleEnum.default('support'),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const member = await ctx.redbird.staff.create(input)
        await writeAudit(ctx, 'staff.create', 'staff', member.id, {
          email: member.email,
          role: member.role,
        })
        return member
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to create staff'
        if (msg.includes('already exists')) throw new TRPCError({ code: 'CONFLICT', message: msg })
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: msg })
      }
    }),

  /** Update role or active status — owner only */
  update: ownerProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        role: roleEnum.optional(),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        active: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input
      const member = await ctx.redbird.staff.update(id, data)
      await writeAudit(ctx, 'staff.update', 'staff', id, data)
      return member
    }),

  /** Delete a staff member permanently — owner only */
  delete: ownerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const member = await ctx.redbird.staff.get(input.id)
      await ctx.redbird.staff.delete(input.id)
      await writeAudit(ctx, 'staff.delete', 'staff', input.id, {
        email: member?.email,
        role: member?.role,
      })
      return { ok: true }
    }),
})
