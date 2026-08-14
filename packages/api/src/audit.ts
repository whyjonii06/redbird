import type { Context } from './trpc.js'

/** Resolve who's performing the current request, for audit log entries. */
async function auditActor(
  ctx: Context,
): Promise<{ actorType: 'admin' | 'staff'; actorId?: string; actorLabel: string }> {
  if (ctx.staffId) {
    const staff = await ctx.redbird.staff.get(ctx.staffId)
    return {
      actorType: 'staff',
      actorId: ctx.staffId,
      actorLabel: staff ? `${staff.email} (${staff.role})` : ctx.staffId,
    }
  }
  return { actorType: 'admin', actorLabel: 'Master admin key' }
}

/** Record a sensitive admin/staff action. Never throws — a logging failure must not fail the action. */
export async function writeAudit(
  ctx: Context,
  action: string,
  entityType: string,
  entityId?: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  const actor = await auditActor(ctx)
  await ctx.redbird.auditLog.write({
    ...actor,
    action,
    entityType,
    ...(entityId ? { entityId } : {}),
    ...(metadata ? { metadata } : {}),
    ip: ctx.ip,
  })
}
