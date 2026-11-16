import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export const metadata = { title: "API Reference" }

const ENDPOINTS = [
  {
    method: "GET",
    path: "/api/v1/mode",
    purpose:
      "Current server mode — \"demo\" (seeded sample crew) or \"live\" (profiles you create). null until the first-launch picker at /welcome has been completed.",
    request: `GET /api/v1/mode`,
    response: `200 OK

{ "mode": "live" }`,
  },
  {
    method: "POST",
    path: "/api/v1/mode",
    purpose:
      "Choose the mode (first-launch setup, or switch later). Demo shows the fixed sample crew; live starts empty and accepts created profiles.",
    request: `POST /api/v1/mode
Content-Type: application/json

{ "mode": "live" }`,
    response: `200 OK

{ "status": "ok", "mode": "live" }`,
  },
  {
    method: "POST",
    path: "/api/v1/crew",
    purpose:
      "Create an astronaut profile (live mode). The generated id is the astronaut_id the app sends with uploads. Returns 409-style 400 in demo mode (fixed crew).",
    request: `POST /api/v1/crew
Content-Type: application/json

{
  "name": "Sofia Ríos",
  "callsign": "Nova",
  "role": "Flight Engineer",
  "environment": "station"
}`,
    response: `201 Created

{
  "astronaut": {
    "id": "sofia-rios",
    "name": "Sofia Ríos",
    "callsign": "Nova",
    "role": "Flight Engineer",
    "environment": "station"
  }
}`,
  },
  {
    method: "DELETE",
    path: "/api/v1/crew/{id}",
    purpose:
      "Remove a live-mode profile and its uploaded checkups (demo crew is fixed).",
    request: `DELETE /api/v1/crew/sofia-rios`,
    response: `200 OK

{ "status": "deleted", "id": "sofia-rios" }`,
  },
  {
    method: "POST",
    path: "/api/v1/checkups",
    purpose:
      "App uploads one completed sleep checkup. Upserts by night — re-sending a checkup for the same night replaces it (offline queue sync is idempotent).",
    request: `POST /api/v1/checkups
Content-Type: application/json

{
  "astronaut_id": "astro-006",
  "environment": "spacecraft",
  "started_at": "2026-11-14T21:35:00Z",
  "ended_at": "2026-11-15T05:02:00Z",
  "hr_min": 49,
  "hr_avg": 58,
  "hr_max": 81,
  "resting_hr": 63,
  "status": "RED",
  "reason": "Sustained elevated HR: 13 bpm above your range for ~5 h.",
  "samples": [{ "t": "2026-11-14T21:35:10Z", "bpm": 62 }]
}`,
    response: `201 Created

{
  "status": "accepted",
  "checkup": { "id": "chk-astro-006-20261114", "...": "stored fields" },
  "alerts_created": [
    {
      "severity": "RED",
      "title": "Red status — needs attention",
      "...": "alert payload"
    }
  ]
}`,
  },
  {
    method: "GET",
    path: "/api/v1/crew",
    purpose:
      "Crew list with the latest color-coded status, resting HR, last checkup, streak, and compliance — powers the dashboard.",
    request: `GET /api/v1/crew`,
    response: `200 OK

{
  "generated_at": "2026-11-15T09:12:40Z",
  "crew": [
    {
      "astronaut": {
        "id": "astro-006",
        "name": "Raj Chandra",
        "callsign": "Zenith",
        "role": "Science Officer",
        "environment": "spacecraft"
      },
      "latest": {
        "status": "RED",
        "resting_hr": 63,
        "ended_at": "2026-11-15T05:02:00Z",
        "duration_minutes": 447
      },
      "compliance_pct": 100,
      "streak": 27
    }
  ]
}`,
  },
  {
    method: "GET",
    path: "/api/v1/crew/{id}/checkups",
    purpose:
      "List checkups for one astronaut. `?limit=5` (default, matches the app's Summary screen) up to 60.",
    request: `GET /api/v1/crew/astro-006/checkups?limit=5`,
    response: `200 OK

{
  "astronaut": { "id": "astro-006", "...": "…" },
  "checkups": [
    {
      "id": "chk-astro-006-20261114",
      "started_at": "2026-11-14T21:35:00Z",
      "ended_at": "2026-11-15T05:02:00Z",
      "duration_minutes": 447,
      "hr_min": 49,
      "hr_avg": 58,
      "hr_max": 81,
      "resting_hr": 63,
      "status": "RED",
      "reason": "…",
      "samples_count": 7312,
      "uploaded_at": "2026-11-15T05:24:00Z"
    }
  ]
}`,
  },
  {
    method: "GET",
    path: "/api/v1/crew/{id}/summary",
    purpose:
      "Aggregated stats for charts: per-night resting HR / duration / status over `?range=7` or `?range=30` nights, plus the personalized relaxed band and compliance.",
    request: `GET /api/v1/crew/astro-006/summary?range=30`,
    response: `200 OK

{
  "astronaut": { "id": "astro-006", "...": "…" },
  "range_nights": 30,
  "band": [46, 58],
  "compliance_pct": 100,
  "avg_resting_hr": 55,
  "nights": [
    {
      "date": "2026-11-14",
      "resting_hr": 63,
      "duration_minutes": 447,
      "status": "RED"
    }
  ]
}`,
  },
  {
    method: "GET",
    path: "/api/v1/alerts",
    purpose:
      "Crew alert feed: red statuses, amber streaks (2+ nights), and repeated missed checkups. Drives the dashboard banner and crew notifications.",
    request: `GET /api/v1/alerts`,
    response: `200 OK

{
  "generated_at": "2026-11-15T09:12:40Z",
  "alerts": [
    {
      "id": "astro-006:RED:2026-11-14",
      "severity": "RED",
      "astronaut_id": "astro-006",
      "astronaut_name": "Raj Chandra",
      "date": "2026-11-14",
      "title": "Red status — needs attention",
      "message": "63 bpm resting HR during sleep — sustained elevated pattern.",
      "action": "Crew prompt: check in with them today."
    }
  ]
}`,
  },
]

const NOTES = [
  "Two modes: demo (seeded sample crew astro-001 … astro-006) and live (profiles you create on the Crew page or via POST /api/v1/crew). Mode is chosen on first launch at /welcome and switchable from the sidebar.",
  "Status (GREEN / AMBER / RED) is computed by the Android app from the raw BPM stream — the server stores and distributes it, it never re-interprets HR numbers.",
  "GRAY (missed night) is never uploaded: it is a gap in the night window, rendered as “missed / no data”.",
  "environment is one of spacecraft, station, rover, planetary_base. It adjusts expected ranges on the server and re-labels history with context — it never rewrites raw data.",
  "The app queues checkups offline and syncs later (comm windows); uploads are idempotent per night.",
  "Uploads, mode, and live-mode profiles are persisted to data/db.json so they survive server restarts in this demo.",
]

export default function ApiReferencePage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">API Reference</h1>
        <p className="text-sm text-muted-foreground">
          REST endpoints the Android app (and anything else) talks to. JSON in, JSON
          out.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {ENDPOINTS.map((endpoint) => (
          <Card key={endpoint.path}>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2 font-mono text-base">
                <Badge
                  variant={endpoint.method === "POST" ? "destructive" : "secondary"}
                  className="font-mono"
                >
                  {endpoint.method}
                </Badge>
                {endpoint.path}
              </CardTitle>
              <CardDescription>{endpoint.purpose}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 lg:grid-cols-2">
              <div>
                <div className="mb-1 text-xs font-medium text-muted-foreground uppercase">
                  Request
                </div>
                <pre className="overflow-x-auto rounded-lg border bg-muted/40 p-3 font-mono text-xs leading-relaxed">
                  {endpoint.request}
                </pre>
              </div>
              <div>
                <div className="mb-1 text-xs font-medium text-muted-foreground uppercase">
                  Response
                </div>
                <pre className="overflow-x-auto rounded-lg border bg-muted/40 p-3 font-mono text-xs leading-relaxed">
                  {endpoint.response}
                </pre>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Good to know</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-inside list-disc space-y-1.5 text-sm text-muted-foreground">
            {NOTES.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
