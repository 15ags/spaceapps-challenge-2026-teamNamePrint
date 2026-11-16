import { getAstronautOverview } from "@/lib/store"

/** GET /api/v1/crew/{id}/summary — aggregated stats for charts (?range=7|30). */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const overview = await getAstronautOverview(id)
  if (!overview) {
    return Response.json({ error: "Unknown astronaut id." }, { status: 404 })
  }

  const rangeParam = Number(new URL(request.url).searchParams.get("range") ?? 30)
  const range =
    rangeParam === 7 ? 7 : 30

  const nights = overview.nights.slice(-range)

  const done = nights.filter((n) => n.checkup)
  const avg_resting_hr = done.length
    ? Math.round(
        done.reduce((sum, n) => sum + (n.checkup?.resting_hr ?? 0), 0) / done.length,
      )
    : null

  return Response.json({
    astronaut: overview.astronaut,
    range_nights: range,
    band: overview.band,
    compliance_pct: complianceFor(nights),
    avg_resting_hr,
    avg_sleep_minutes: done.length
      ? Math.round(
          done.reduce((sum, n) => sum + (n.checkup?.duration_minutes ?? 0), 0) /
            done.length,
        )
      : null,
    nights: nights.map((n) => ({
      date: n.date,
      resting_hr: n.checkup?.resting_hr ?? null,
      duration_minutes: n.checkup?.duration_minutes ?? null,
      status: n.checkup?.status ?? "GRAY",
      reason: n.checkup?.reason ?? null,
    })),
  })
}

function complianceFor(nights: { checkup: unknown }[]): number {
  const done = nights.filter((n) => n.checkup).length
  return nights.length ? Math.round((done / nights.length) * 100) : 0
}
