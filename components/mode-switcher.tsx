"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { FlaskConical, Radio, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { AppMode } from "@/lib/types"

/**
 * Sidebar mode switch (demo ↔ live). Mirrors the two-mode design: the same
 * choice is made once at first launch via /welcome.
 */
export function ModeSwitcher({ mode }: { mode: AppMode | null }) {
  const router = useRouter()
  const [pending, setPending] = useState<AppMode | null>(null)

  async function choose(next: AppMode) {
    if (pending || next === mode) return
    setPending(next)
    try {
      await fetch("/api/v1/mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: next }),
      })
      router.refresh()
      if (next === "live") {
        router.push("/crew")
      }
    } finally {
      setPending(null)
    }
  }

  return (
    <div className="grid grid-cols-2 gap-1 rounded-lg border p-1">
      <Button
        variant={mode === "demo" ? "secondary" : "ghost"}
        size="sm"
        onClick={() => choose("demo")}
        disabled={pending !== null}
        className="px-1.5 text-xs"
        aria-pressed={mode === "demo"}
      >
        {pending === "demo" ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <FlaskConical className="size-3.5" />
        )}
        Demo
      </Button>
      <Button
        variant={mode === "live" ? "secondary" : "ghost"}
        size="sm"
        onClick={() => choose("live")}
        disabled={pending !== null}
        className="px-1.5 text-xs"
        aria-pressed={mode === "live"}
      >
        {pending === "live" ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Radio className="size-3.5" />
        )}
        Live
      </Button>
    </div>
  )
}
