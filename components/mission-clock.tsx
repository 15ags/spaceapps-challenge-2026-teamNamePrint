"use client"

import { useEffect, useState } from "react"

const MISSION_START = new Date("2026-07-14T00:00:00Z")

/** Mission clock — renders a placeholder on the server, ticks every second after mount. */
export function MissionClock() {
  const [state, setState] = useState<string | null>(null)

  useEffect(() => {
    const tick = () => {
      const now = new Date()
      const clock = now.toISOString().slice(11, 19)
      const day = Math.floor((now.getTime() - MISSION_START.getTime()) / 86_400_000) + 1
      setState(`Mission Day ${day} · ${clock} UTC`)
    }
    tick()
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [])

  return (
    <span className="font-mono text-xs tabular-nums text-muted-foreground sm:text-sm">
      {state ?? "--:--:-- UTC"}
    </span>
  )
}
