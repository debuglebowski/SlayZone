import { z } from 'zod'
import { observable } from '@trpc/server/observable'
import { TRPCError } from '@trpc/server'
import {
  automationsEvents,
  listAutomationsByProject,
  getAutomation,
  createAutomation,
  updateAutomation,
  deleteAutomation,
  toggleAutomation,
  reorderAutomations,
  listAutomationRuns,
  clearAutomationRuns,
} from '@slayzone/automations/server'
import type { CreateAutomationInput, UpdateAutomationInput } from '@slayzone/automations/shared'
import { router, publicProcedure } from '../trpc'

const createInput = z.unknown() as unknown as z.ZodType<CreateAutomationInput>
const updateInput = z.unknown() as unknown as z.ZodType<UpdateAutomationInput>

export const automationsRouter = router({
  getByProject: publicProcedure
    .input(z.object({ projectId: z.string() }))
    .query(({ ctx, input }) => listAutomationsByProject(ctx.db, input.projectId)),

  get: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(({ ctx, input }) => getAutomation(ctx.db, input.id)),

  create: publicProcedure
    .input(createInput)
    .mutation(({ ctx, input }) => createAutomation(ctx.db, input)),

  update: publicProcedure
    .input(updateInput)
    .mutation(({ ctx, input }) => updateAutomation(ctx.db, input)),

  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) => deleteAutomation(ctx.db, input.id)),

  toggle: publicProcedure
    .input(z.object({ id: z.string(), enabled: z.boolean() }))
    .mutation(({ ctx, input }) => toggleAutomation(ctx.db, input.id, input.enabled)),

  reorder: publicProcedure
    .input(z.object({ ids: z.array(z.string()) }))
    .mutation(({ ctx, input }) => {
      reorderAutomations(ctx.db, input.ids)
    }),

  getRuns: publicProcedure
    .input(z.object({ automationId: z.string(), limit: z.number().int().positive().optional() }))
    .query(({ ctx, input }) => listAutomationRuns(ctx.db, input.automationId, input.limit)),

  runManual: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) => {
      if (!ctx.automationEngine) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Automation engine not available in this server context',
        })
      }
      return ctx.automationEngine.executeManual(input.id)
    }),

  clearRuns: publicProcedure
    .input(z.object({ automationId: z.string() }))
    .mutation(({ ctx, input }) => {
      clearAutomationRuns(ctx.db, input.automationId)
    }),

  onChanged: publicProcedure.subscription(() =>
    observable<void>((emit) => {
      const handler = (): void => emit.next()
      automationsEvents.on('changed', handler)
      return () => {
        automationsEvents.off('changed', handler)
      }
    }),
  ),
})
