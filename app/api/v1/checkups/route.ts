import { insertCheckup, listUploadedCheckups } from "@/lib/store"

/** POST /api/v1/checkups — app uploads one completed sleep checkup (§3.3). */
export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json(
      { error: "Body must be valid JSON." },
      { status: 400 },
    )
  }

  const result = await insertCheckup(body)
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 400 })
  }

  return Response.json(
    {
      status: "accepted",
      checkup: result.checkup,
      alerts_created: result.alerts_created,
    },
    { status: 201 },
  )
}

/** GET /api/v1/checkups — debug feed of recently uploaded checkups. */
export async function GET(request: Request) {
  const limit = Number(new URL(request.url).searchParams.get("limit") ?? 20)
  const uploaded = await listUploadedCheckups(Number.isFinite(limit) ? limit : 20)
  return Response.json({
    count: uploaded.length,
    checkups: uploaded,
  })
}
