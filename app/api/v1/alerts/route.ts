import { listAlerts } from "@/lib/store"

/** GET /api/v1/alerts — crew alert feed (dashboard banner + notifications). */
export async function GET() {
  const { alerts } = await listAlerts()
  return Response.json({
    generated_at: new Date().toISOString(),
    count: alerts.length,
    alerts,
  })
}
