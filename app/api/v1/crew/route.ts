import { createAstronaut, listCrewOverview } from "@/lib/store"

/** GET /api/v1/crew — crew list with latest status (dashboard + app reuse). */
export async function GET() {
  const { crew } = await listCrewOverview()
  return Response.json({
    generated_at: new Date().toISOString(),
    crew: crew.map((c) => ({
      astronaut: c.astronaut,
      latest: c.latest
        ? {
            id: c.latest.id,
            status: c.latest.status,
            resting_hr: c.latest.resting_hr,
            hr_avg: c.latest.hr_avg,
            duration_minutes: c.latest.duration_minutes,
            started_at: c.latest.started_at,
            ended_at: c.latest.ended_at,
            reason: c.latest.reason,
          }
        : null,
      streak: c.streak,
      missed_streak: c.missed_streak,
      amber_streak: c.amber_streak,
      compliance_pct: c.compliance_pct,
      band: c.band,
    })),
  })
}

/**
 * POST /api/v1/crew — create an astronaut profile (live mode; the Android app
 * calls this from its profile-creation flow). The generated `astronaut.id` is
 * what the app then sends as `astronaut_id` with its checkup uploads.
 *
 * Body: { name, callsign?, role?, environment }
 */
export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: "Body must be valid JSON." }, { status: 400 })
  }

  const result = await createAstronaut(body)
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 400 })
  }

  return Response.json({ astronaut: result.astronaut }, { status: 201 })
}
