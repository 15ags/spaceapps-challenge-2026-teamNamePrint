"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  FlaskConical,
  HeartPulse,
  Radio,
  TriangleAlert,
} from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"

/**
 * First-launch mode selection, mirrored in the Android app: "demo" runs the
 * full pipeline on simulated data, "live" is the real deployment where the
 * crew creates their own astronaut profiles.
 */
export function ModePicker() {
  const router = useRouter()
  const [pending, setPending] = useState<"demo" | "live" | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function choose(mode: "demo" | "live") {
    setPending(mode)
    setError(null)
    try {
      const response = await fetch("/api/v1/mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      })
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as
          | { error?: string }
          | null
        throw new Error(data?.error ?? `Request failed (${response.status})`)
      }
      router.refresh()
      // Live deployments start empty: go straight to crew profile setup.
      router.replace(mode === "live" ? "/crew" : "/")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.")
      setPending(null)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 md:grid-cols-2">
        <ModeCard
          icon={<FlaskConical className="size-5" />}
          title="Demo mission"
          description="Explore the full system with a sample crew and simulated sensor data. The Android app can use its built-in fake sensor — no hardware needed."
          bullets={[
            "Seeded crew (astro-001 … astro-006) with 30 nights of data",
            "Alerts, charts, and color-coded statuses out of the box",
            "App uploads still work against the demo crew",
          ]}
          action={
            <Button
              onClick={() => choose("demo")}
              disabled={pending !== null}
              className="w-full"
            >
              {pending === "demo" ? "Starting demo…" : "Run in demo mode"}
            </Button>
          }
        />
        <ModeCard
          icon={<Radio className="size-5" />}
          title="Live mission"
          description="The real deployment: empty to start, crew profiles are created by you, and the Android app syncs real checkups from the XIAO sensor over BLE."
          bullets={[
            "Create your astronaut profiles on the Crew page",
            "Register profiles from the app (POST /api/v1/crew)",
            "Point the app at this server's URL and sync",
          ]}
          action={
            <Button
              onClick={() => choose("live")}
              disabled={pending !== null}
              className="w-full"
            >
              {pending === "live" ? "Setting up…" : "Start live setup"}
            </Button>
          }
        />
      </div>

      {error && (
        <Card className="border-destructive/40 py-3">
          <CardContent className="flex items-center gap-2 px-4 text-sm text-destructive">
            <TriangleAlert className="size-4 shrink-0" />
            {error}
          </CardContent>
        </Card>
      )}

      <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
        <HeartPulse className="size-3.5" />
        Wellness / situational-awareness tool — not a medical device. You can
        switch modes anytime from the sidebar.
      </p>
    </div>
  )
}

function ModeCard({
  icon,
  title,
  description,
  bullets,
  action,
}: {
  icon: React.ReactNode
  title: string
  description: string
  bullets: string[]
  action: React.ReactNode
}) {
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="flex size-8 items-center justify-center rounded-lg bg-muted">
            {icon}
          </span>
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="mt-auto flex flex-1 flex-col justify-between gap-4">
        <ul className="list-inside list-disc space-y-1 text-xs text-muted-foreground">
          {bullets.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
        {action}
      </CardContent>
    </Card>
  )
}
