import { cn } from "@/lib/utils"
import { STATUS_META } from "@/lib/guidance"
import type { NightStatus } from "@/lib/types"

export function StatusDot({
  status,
  className,
}: {
  status: NightStatus
  className?: string
}) {
  return (
    <span
      aria-hidden
      className={cn("inline-block size-2 shrink-0 rounded-full", STATUS_META[status].dot, className)}
    />
  )
}

export function StatusBadge({
  status,
  className,
  size = "sm",
}: {
  status: NightStatus
  className?: string
  size?: "sm" | "lg"
}) {
  const meta = STATUS_META[status]
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1.5 rounded-4xl border font-medium whitespace-nowrap",
        size === "lg" ? "px-3 py-1 text-sm" : "px-2 py-0.5 text-xs",
        meta.badge,
        className,
      )}
    >
      <span aria-hidden className={cn("inline-block size-2 shrink-0 rounded-full", meta.dot)} />
      {meta.label}
    </span>
  )
}

/** Compact strip of the last N nights, oldest → newest. */
export function StatusStrip({
  statuses,
  className,
}: {
  statuses: { status: NightStatus; label: string }[]
  className?: string
}) {
  return (
    <div className={cn("flex h-6 w-full items-stretch gap-[2px]", className)}>
      {statuses.map((s, i) => (
        <span
          key={i}
          title={`${s.label}: ${STATUS_META[s.status].label}`}
          className={cn("min-w-1.5 flex-1 rounded-sm opacity-90", STATUS_META[s.status].bar)}
        />
      ))}
    </div>
  )
}
