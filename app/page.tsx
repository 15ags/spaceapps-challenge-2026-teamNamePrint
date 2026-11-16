import { Suspense } from "react"
import Link from "next/link"
import {
  BedDouble,
  CalendarX,
  CircleCheck,
  FlaskConical,
  HeartPulse,
  RadioTower,
  ShieldAlert,
  Siren,
  TimerReset,
  TriangleAlert,
  UserRoundPlus,
} from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { ENVIRONMENT_PROFILES, STATUS_META } from "@/lib/guidance"
import { formatDate, formatDuration, timeAgo } from "@/lib/format"
import { getMissionDashboard } from "@/lib/store"
import { StatusBadge, StatusStrip } from "@/components/status"

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Crew Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Sleep checkups across the crew — status at a glance, alerts when someone
          needs attention.
        </p>
      </div>

      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent />
      </Suspense>
    </div>
  )
}

async function DashboardContent() {
  const dashboard = await getMissionDashboard()
  const { alerts, crew, counts, avg_compliance_pct, mode } = dashboard
  const now = dashboard.now

  return (
    <>
      {/* Mode banner — which dataset this deployment shows (§2 two-mode design) */}
      {mode === "demo" ? (
        <Alert className="border-l-4 border-l-violet-500 bg-violet-500/5 pl-3">
          <FlaskConical className="size-4 text-violet-500" />
          <AlertTitle>Demo mode — sample crew &amp; simulated data</AlertTitle>
          <AlertDescription>
            Fixed demo crew (astro-001 … astro-006) with seeded nights, so the
            full pipeline is explorable without hardware. Switch to live mode
            anytime via the sidebar.
          </AlertDescription>
        </Alert>
      ) : (
        <Alert className="border-l-4 border-l-emerald-500 pl-3">
          <RadioTower className="size-4 text-emerald-500" />
          <AlertTitle>Live mode — your crew</AlertTitle>
          <AlertDescription>
            Only real uploads are shown. Create astronaut profiles on the{" "}
            <Link href="/crew" className="underline underline-offset-4">
              Crew profiles
            </Link>{" "}
            page (or from the app), then point the app at this server.
          </AlertDescription>
        </Alert>
      )}

      {crew.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <UserRoundPlus className="size-4" /> No crew profiles yet
            </CardTitle>
            <CardDescription>
              Live deployments start empty. Create your astronaut profiles —
              each profile gets an id the Android app sends as{" "}
              <code className="font-mono text-xs">astronaut_id</code>.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button render={<Link href="/crew" />}>
              <UserRoundPlus className="size-4" /> Create astronaut profiles
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Crew alerting (§3.3): alert banner for Red statuses and missed checkups */}
      {alerts.length > 0 && (
        <div className="flex flex-col gap-2">
          {alerts.slice(0, 4).map((alert) => (
            <Alert
              key={alert.id}
              className={cn(
                "border-l-4 pl-3",
                alert.severity === "RED" && "border-l-red-500 bg-red-500/5",
                alert.severity === "AMBER" && "border-l-amber-500 bg-amber-500/5",
                alert.severity === "MISSED" && "border-l-zinc-500 bg-muted/40",
              )}
            >
              {alert.severity === "RED" ? (
                <Siren className="size-4 text-red-500" />
              ) : alert.severity === "AMBER" ? (
                <TriangleAlert className="size-4 text-amber-500" />
              ) : (
                <CalendarX className="size-4 text-zinc-400" />
              )}
              <AlertTitle>
                {alert.title} —{" "}
                <Link
                  href={`/crew/${alert.astronaut_id}`}
                  className="underline underline-offset-4 hover:text-foreground"
                >
                  {alert.astronaut_name}
                </Link>
              </AlertTitle>
              <AlertDescription>
                {alert.message}{" "}
                <span className="text-foreground/80">{alert.action}</span>
              </AlertDescription>
            </Alert>
          ))}
        </div>
      )}
      {alerts.length === 0 && (
        <Alert className="border-l-4 border-l-emerald-500 pl-3">
          <CircleCheck className="size-4 text-emerald-500" />
          <AlertTitle>All clear</AlertTitle>
          <AlertDescription>
            No red statuses, no amber streaks, no missed checkups right now.
          </AlertDescription>
        </Alert>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          icon={<CircleCheck className="size-4 text-emerald-500" />}
          label="Rested (green)"
          value={counts.green}
          sub={`of ${crew.length} crew`}
        />
        <StatCard
          icon={<TriangleAlert className="size-4 text-amber-500" />}
          label="Elevated (amber)"
          value={counts.amber}
          sub="recheck tonight"
        />
        <StatCard
          icon={<Siren className="size-4 text-red-500" />}
          label="Needs attention (red)"
          value={counts.red}
          sub="crew alerted"
        />
        <StatCard
          icon={<CalendarX className="size-4 text-zinc-400" />}
          label="Missed last night"
          value={counts.missed_last_night}
          sub={`avg ${avg_compliance_pct}% / 30 n`}
        />
      </div>

      {/* Crew table (§3.3 dashboard) */}
      <Card>
        <CardHeader>
          <CardTitle>Crew status</CardTitle>
          <CardDescription>
            Latest sleep checkup per astronaut — color-coded status, resting HR,
            and compliance over the last 30 nights.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Astronaut</TableHead>
                <TableHead>Environment</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Resting HR</TableHead>
                <TableHead>Last checkup</TableHead>
                <TableHead className="w-40">Last 30 nights</TableHead>
                <TableHead className="text-right">Compliance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {crew.map(({ astronaut, latest, nights, compliance_pct, streak, avg_resting_7d, band }) => {
                const status = latest?.status ?? "GRAY"
                const meta = STATUS_META[status]
                const delta =
                  latest && avg_resting_7d != null
                    ? latest.resting_hr - avg_resting_7d
                    : null
                return (
                  <TableRow key={astronaut.id}>
                    <TableCell>
                      <Link
                        href={`/crew/${astronaut.id}`}
                        className="flex items-center gap-2.5 hover:text-primary"
                      >
                        <Avatar size="default">
                          <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                            {astronaut.name
                              .split(" ")
                              .map((p) => p[0])
                              .join("")}
                          </AvatarFallback>
                        </Avatar>
                        <span className="min-w-0">
                          <span className="block truncate font-medium">
                            {astronaut.name}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            “{astronaut.callsign}” · {astronaut.role}
                          </span>
                        </span>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-muted-foreground">
                        {ENVIRONMENT_PROFILES[astronaut.environment].short}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={cn("font-medium tabular-nums", meta.text)}>
                        {latest ? `${latest.resting_hr} bpm` : "—"}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {delta != null
                          ? `${delta >= 0 ? "+" : ""}${delta} bpm vs 7 d avg`
                          : `band ${band[0]}–${band[1]} bpm`}
                      </span>
                    </TableCell>
                    <TableCell>
                      {latest ? (
                        <>
                          <span className="block whitespace-nowrap">
                            {timeAgo(latest.ended_at, now)}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {formatDate(latest.started_at)} ·{" "}
                            {formatDuration(latest.duration_minutes)}
                          </span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">no data</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusStrip
                        statuses={nights.map((n) => ({
                          status: n.checkup?.status ?? "GRAY",
                          label: n.label,
                        }))}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="tabular-nums">{compliance_pct}%</span>
                      <span className="block text-xs text-muted-foreground">
                        {streak > 0 ? `streak: ${streak} night${streak === 1 ? "" : "s"}` : "streak broken"}
                      </span>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  )
}

function StatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode
  label: string
  value: number
  sub: string
}) {
  return (
    <Card className="py-4">
      <CardContent className="flex items-center gap-3 px-4">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
          {icon}
        </div>
        <div className="min-w-0">
          <div className="text-2xl font-semibold tabular-nums leading-none">
            {value}
          </div>
          <div className="mt-1 truncate text-xs text-muted-foreground">
            {label} · {sub}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-16 w-full" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[72px]" />
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Crew status</CardTitle>
          <CardDescription className="flex items-center gap-2">
            <HeartPulse className="size-3.5" /> Loading latest checkups…
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2.5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <BedDouble className="size-3.5" /> 30-night window
            <TimerReset className="ml-2 size-3.5" /> streaming…
            <ShieldAlert className="ml-2 size-3.5" /> alert feed sync…
          </div>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
