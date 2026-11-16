/** Formatting helpers — pure functions, safe in server and client components. */

export function formatDuration(minutes: number | null | undefined): string {
  if (minutes == null) return "—"
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h > 0 ? `${h} h ${String(m).padStart(2, "0")} m` : `${m} m`
}

export function timeAgo(iso: string, nowISO: string): string {
  const diffMs = new Date(nowISO).getTime() - new Date(iso).getTime()
  const diffMin = Math.max(1, Math.round(diffMs / 60_000))
  if (diffMin < 60) return `${diffMin} min ago`
  const diffH = Math.round(diffMin / 60)
  if (diffH < 24) return `${diffH} h ago`
  const diffD = Math.round(diffH / 24)
  return `${diffD} d ago`
}

export function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  })
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  })
}

export function formatDateTimeUTC(iso: string): string {
  return `${formatDate(iso)}, ${formatClock(iso)} UTC`
}
