import type { Env } from './index'

export async function scheduledHandler(
  _event: ScheduledEvent,
  env: Env,
  _ctx: ExecutionContext,
): Promise<void> {
  // TODO: Phase 2 — doctor schedule Cron sync
  // Fetch from docdutyapi.claramane.com/schedule/{start}/{end}
  // Write to doctor_schedules / day_shift_doctors in Supabase
  console.log('Cron triggered — doctor schedule sync not yet implemented', env.SUPABASE_URL)
}
