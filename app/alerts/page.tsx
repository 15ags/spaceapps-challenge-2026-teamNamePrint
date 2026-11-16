import { Suspense } from "react"
import Link from "next/link"
import { redirect } from "next/navigation"
import { BellRing, CalendarX, CircleCheck, Siren, TriangleAlert } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { formatDate, timeAgo } from "@/lib/format"
import { getMode, listAlerts } from "@/lib/store"
import type { CrewAlert } from "@/lib/types"

export const metadata = { title: "Crew alerts" }

export default function AlertsPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Crew Alerts</h1>
        <p className="text-sm text-muted-foreground">
          Red statuses, repeated ambers, and missed checkups — what the crew should
          look at today.
        </p>
      </div>
      <Suspense fallback={<AlertsSkeleton />}>
        <AlertsContent />
      </Suspense>
    </div>
  )
}

async function AlertsContent() {
  const mode = await getMode()
  if (mode === null) {
    redirect("/welcome")
  }
  const { alerts, now } = await listAlerts()

  if (alerts.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
          <CircleCheck className="size-8 text-emerald-500" />
          <div className="font-medium">No active alerts</div>
          <p className="text-sm text-muted-foreground">
            Nobody is red, no amber streaks, nobody has missed checkups. Keep the
            routine going.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {alerts.map((alert) => (
        <AlertCard key={alert.id} alert={alert} now={now} />
      ))}
    </div>
  )
}

function AlertCard({ alert, now }: { alert: CrewAlert; now: string }) {
  const config = {
    RED: {
      icon: <Siren className="size-4 text-red-500" />,
      badge: "border-red-500/40 text-red-500",
      border: "border-l-4 border-l-red-500 bg-red-500/5",
    },
    AMBER: {
      icon: <TriangleAlert className="size-4 text-amber-500" />,
      badge: "border-amber-500/40 text-amber-500",
      border: "border-l-4 border-l-amber-500 bg-amber-500/5",
    },
    MISSED: {
      icon: <CalendarX className="size-4 text-zinc-400" />,
      badge: "text-muted-foreground",
      border: "border-l-4 border-l-zinc-500 bg-muted/40",
    },
  }[alert.severity]

  return (
    <Card className={cn("py-4", config.border)}>
      <CardHeader className="px-4">
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          {config.icon}
          {alert.title}
          <Badge variant="outline" className={config.badge}>
            {alert.severity}
          </Badge>
          <span className="ml-auto text-xs font-normal text-muted-foreground">
            Night of {formatDate(`${alert.date}T12:00:00Z`)} ·{" "}
            {timeAgo(`${alert.date}T22:00:00Z`, now)}
          </span>
        </CardTitle>
        <CardDescription>
          <Link
            href={`/crew/${alert.astronaut_id}`}
            className="underline underline-offset-4 hover:text-foreground"
          >
            {alert.astronaut_name}
          </Link>
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 px-4 text-sm">
        <p>{alert.message}</p>
        <p className="rounded-lg border bg-muted/30 p-2.5">{alert.action}</p>
      </CardContent>
    </Card>
  )
}

function AlertsSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <BellRing className="size-3.5" /> Syncing alert feed…
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-32 w-full" />
      ))}
    </div>
  )
}
