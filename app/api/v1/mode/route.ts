import { getMode, setMode } from "@/lib/store"
import type { AppMode } from "@/lib/types"

/** GET /api/v1/mode — current server mode (null until first-launch setup). */
export async function GET() {
  const mode = await getMode()
  return Response.json({ mode })
}

/**
 * POST /api/v1/mode — choose the mode (first-launch picker, or switch later).
 * Body: { "mode": "demo" | "live" }
 */
export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: "Body must be valid JSON." }, { status: 400 })
  }
  const mode = (body as { mode?: unknown })?.mode
  if (mode !== "demo" && mode !== "live") {
    return Response.json(
      { error: 'mode must be "demo" or "live".' },
      { status: 400 },
    )
  }
  await setMode(mode as AppMode)
  return Response.json({ status: "ok", mode })
}
