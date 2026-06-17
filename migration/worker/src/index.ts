import { Hono } from 'hono'
import { scheduledHandler } from './scheduled'

export interface Env {
  SUPABASE_URL: string
  SUPABASE_SERVICE_ROLE_KEY: string
}

const app = new Hono<{ Bindings: Env }>()

// Health check
app.get('/health', (c) => c.json({ status: 'ok', service: 'anes-worker' }))

// Schedule generation endpoint (called from admin frontend)
app.post('/generate-schedule', async (c) => {
  // TODO: Phase 3c — implement schedule generation
  return c.json({ error: 'not implemented' }, 501)
})

export default {
  fetch: app.fetch,
  scheduled: scheduledHandler,
}
