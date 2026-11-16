import { getAstronautOverview } from "@/lib/store"

/** GET /api/v1/crew/{id}/checkups — list (app Summary screen "last 5" default). */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const overview = await getAstronautOverview(id)
  if (!overview) {
    return Response.json({ error: "Unknown astronaut id." }, { status: 404 })
  }

  const limitParam = Number(new URL(request.url).searchParams.get("limit") ?? 5)
  const limit = Math.min(
    Math.max(1, Number.isFinite(limitParam) ? limitParam : 5),
    60,
  )

  const checkups = [...overview.nights]
    .reverse()
    .filter((n) => n.checkup)
    .slice(0, limit)
    .map((n) => n.checkup)

  return Response.json({
    astronaut: overview.astronaut,
    count: checkups.length,
    checkups,
  })
}
