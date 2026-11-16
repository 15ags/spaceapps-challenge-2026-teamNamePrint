"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Loader2, Trash2, Users } from "lucide-react"

import type { Astronaut, Environment } from "@/lib/types"
import { ENVIRONMENT_PROFILES } from "@/lib/guidance"
import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const ENVIRONMENTS = Object.keys(ENVIRONMENT_PROFILES) as Environment[]

/**
 * Live-mode crew profile creation ("create your astronaut profiles"):
 * posts to POST /api/v1/crew, which returns the astronaut id the Android app
 * then sends with its uploads.
 */
export function CrewManager() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [callsign, setCallsign] = useState("")
  const [role, setRole] = useState("")
  const [environment, setEnvironment] = useState<Environment>("station")
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null,
  )

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || pending) return
    setPending(true)
    setMessage(null)
    try {
      const response = await fetch("/api/v1/crew", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          callsign: callsign || undefined,
          role: role || undefined,
          environment,
        }),
      })
      const data = (await response.json().catch(() => null)) as
        | { astronaut?: Astronaut; error?: string }
        | null
      if (!response.ok) {
        throw new Error(data?.error ?? `Request failed (${response.status})`)
      }
      setMessage({
        ok: true,
        text: `Profile created — astronaut id: ${data?.astronaut?.id}. The app can now upload checkups for it.`,
      })
      setName("")
      setCallsign("")
      setRole("")
      router.refresh()
    } catch (err) {
      setMessage({
        ok: false,
        text: err instanceof Error ? err.message : "Something went wrong.",
      })
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="crew-name">Name</Label>
          <Input
            id="crew-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Sofia Ríos"
            required
            maxLength={60}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="crew-callsign">Callsign (optional)</Label>
          <Input
            id="crew-callsign"
            value={callsign}
            onChange={(e) => setCallsign(e.target.value)}
            placeholder="Nova"
            maxLength={20}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="crew-role">Role (optional)</Label>
          <Input
            id="crew-role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="Flight Engineer"
            maxLength={40}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="crew-environment">Environment</Label>
          <select
            id="crew-environment"
            value={environment}
            onChange={(e) => setEnvironment(e.target.value as Environment)}
            className="border-input bg-transparent flex h-9 w-full items-center justify-between rounded-md border px-3 py-2 text-sm shadow-xs outline-none focus:ring-1 focus:ring-ring"
          >
            {ENVIRONMENTS.map((env) => (
              <option key={env} value={env}>
                {ENVIRONMENT_PROFILES[env].label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending || !name.trim()}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          Create profile
        </Button>
        {message && (
          <span
            className={
              message.ok
                ? "text-xs text-emerald-600 dark:text-emerald-400"
                : "text-xs text-destructive"
            }
          >
            {message.text}
          </span>
        )}
      </div>
    </form>
  )
}

/** Profile list with delete actions (live mode) or read-only (demo mode). */
export function CrewList({
  crew,
  editable,
}: {
  crew: Astronaut[]
  editable: boolean
}) {
  const router = useRouter()
  const [deleting, setDeleting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function remove(id: string) {
    if (deleting) return
    setDeleting(id)
    setError(null)
    try {
      const response = await fetch(`/api/v1/crew/${id}`, { method: "DELETE" })
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as
          | { error?: string }
          | null
        throw new Error(data?.error ?? `Request failed (${response.status})`)
      }
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed.")
    } finally {
      setDeleting(null)
    }
  }

  if (crew.length === 0) {
    return (
      <Card className="py-8">
        <CardContent className="flex flex-col items-center gap-2 text-center">
          <Users className="size-8 text-muted-foreground" />
          <div className="font-medium">No profiles yet</div>
          <p className="max-w-md text-sm text-muted-foreground">
            Create the first crew member above, or have the Android app register
            its profile (Settings → Create profile on server). The app&apos;s
            astronaut id must match a profile here before checkups are accepted.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="grid gap-2">
        {crew.map((astro) => (
          <div
            key={astro.id}
            className="flex items-center gap-3 rounded-lg border p-3"
          >
            <Avatar size="default">
              <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                {astro.name
                  .split(" ")
                  .map((p) => p[0])
                  .join("")}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/crew/${astro.id}`}
                  className="truncate font-medium hover:text-primary hover:underline"
                >
                  {astro.name}
                </Link>
                {astro.callsign && (
                  <span className="text-xs text-muted-foreground">
                    &ldquo;{astro.callsign}&rdquo;
                  </span>
                )}
                {astro.role && (
                  <span className="text-xs text-muted-foreground">
                    · {astro.role}
                  </span>
                )}
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-2">
                <code className="font-mono text-xs text-muted-foreground">
                  {astro.id}
                </code>
                <Badge variant="outline" className="text-muted-foreground">
                  {ENVIRONMENT_PROFILES[astro.environment].short}
                </Badge>
              </div>
            </div>
            {editable && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => remove(astro.id)}
                disabled={deleting !== null}
                aria-label={`Delete ${astro.name}`}
              >
                {deleting === astro.id ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Trash2 className="size-4" />
                )}
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
