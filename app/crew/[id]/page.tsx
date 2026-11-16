import { Suspense } from "react"
import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import {
  ArrowLeft,
  BatteryLow,
  CircleAlert,
  Info,
  Lock,
  MoonStar,
  NotebookPen,
  Siren,
  TriangleAlert,
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import {
  AMBER_ESCALATED_ACTION,
  ENVIRONMENT_PROFILES,
  RESTING_HR_EXPLAINER,
  STATUS_META,
} from "@/lib/guidance"
import {
  formatClock,
  formatDate,
  formatDuration,
  timeAgo,
} from "@/lib/format"
import { getAstronautOverview, getMode } from "@/lib/store"
import { SleepCharts, type ChartNight } from "@/components/sleep-charts"
import { StatusBadge } from "@/components/status"

export const metadata = { title: "Crew member" }

export default function CrewMemberPage(props: PageProps<"/crew/[id]">) {
  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/"
        className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Crew dashboard
      </Link>
      <Suspense fallback={<DetailSkeleton />}>
        <DetailContent params={props.params} />
      </Suspense>
    </div>
  )
}

async function DetailContent({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const mode = await getMode()
  if (mode === null) {
    redirect("/welcome")
  }
  const overview = await getAstronautOverview(id)
  if (!overview) notFound()

  const { astronaut, nights, latest, band, streak, missed_streak, amber_streak, compliance_pct, avg_resting_7d, now } =
    overview
  const status = latest?.status ?? "GRAY"
  const meta = STATUS_META[status]
  const env = ENVIRONMENT_PROFILES[astronaut.environment]

  const chartNights: ChartNight[] = nights.map((n) => ({
    date: n.date,
    label: n.label,
    resting: n.checkup?.resting_hr ?? null,
    duration: n.checkup?.duration_minutes ?? null,
    status: n.checkup?.status ?? "GRAY",
    reason: n.checkup?.reason,
  }))

  // Recommended action — amber escalates on consecutive amber nights (§5).
  const action =
    status === "AMBER" && amber_streak >= 2 ? AMBER_ESCALATED_ACTION : meta.action

  return (
    <>
      {/* Header */}
      <div className="flex flex-wrap items-center gap-4">
        <Avatar size="lg" className="size-12">
          <AvatarFallback className="bg-primary/10 text-base font-semibold text-primary">
            {astronaut.name
              .split(" ")
              .map((p) => p[0])
              .join("")}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight">
            {astronaut.name}{" "}
            <span className="font-normal text-muted-foreground">
              “{astronaut.callsign}”
            </span>
          </h1>
          <p className="text-sm text-muted-foreground">
            {astronaut.role} · <Badge variant="outline">{env.short}</Badge>
          </p>
        </div>
        <div className="ml-auto hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
          <MoonStar className="size-3.5" />
          Checkup window ~{formatClock(latest?.started_at ?? `${nights[nights.length - 1].date}T21:30:00Z`)} UTC
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {/* Latest checkup — color-coded result with matched recommendation (§5, §6) */}
        <Card className={cn("xl:col-span-2", status === "RED" && "border-red-500/40")}>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2.5">
              <StatusBadge status={status} size="lg" />
              {status === "RED" && <Siren className="size-4 text-red-500" />}
              {status === "AMBER" && amber_streak >= 2 && (
                <Badge variant="outline" className="border-amber-500/40 text-amber-500">
                  {amber_streak} amber nights in a row
                </Badge>
              )}
              {status === "GRAY" && missed_streak > 0 && (
                <Badge variant="outline">
                  {missed_streak} night{missed_streak === 1 ? "" : "s"} without data
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              {latest
                ? `Last checkup ${formatDate(latest.started_at)}, ended ${timeAgo(latest.ended_at, now)}`
                : "No completed checkup in the last 30 nights"}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {latest ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Metric label="Resting HR" value={`${latest.resting_hr}`} unit="bpm" accent={meta.text} />
                <Metric label="Sleep duration" value={formatDuration(latest.duration_minutes)} />
                <Metric label="HR range" value={`${latest.hr_min}–${latest.hr_max}`} unit="bpm" />
                <Metric label="HR average" value={`${latest.hr_avg}`} unit="bpm" />
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <BatteryLow className="size-4" />
                Sensor may not be worn, charged, or connected over BLE.
              </div>
            )}

            <div className="rounded-lg border bg-muted/30 p-3 text-sm">
              <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase">
                <CircleAlert className="size-3.5" /> Why this status
              </div>
              {latest?.reason ?? STATUS_META.GRAY.meaning}
            </div>

            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
              <div className="mb-1 text-xs font-medium text-muted-foreground uppercase">
                What to do next
              </div>
              {action}
            </div>
          </CardContent>
        </Card>

        {/* Personal stats */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Personal baseline</CardTitle>
            <CardDescription>
              Thresholds are personalized to {astronaut.callsign} and adjusted for
              their environment.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <Row label="Relaxed band (current env)" value={`${band[0]}–${band[1]} bpm`} />
            <Row label="Resting HR, 7-night avg" value={avg_resting_7d != null ? `${avg_resting_7d} bpm` : "—"} />
            <Row label="Checkup streak" value={`${streak} night${streak === 1 ? "" : "s"}`} />
            <Row label="Compliance (30 n)" value={`${compliance_pct}%`} />
            <Row
              label="Amber / missed now"
              value={`${amber_streak} / ${missed_streak}`}
            />
            <p className="text-xs text-muted-foreground">
              {env.note} Raw history is never rewritten when the environment changes —
              only labels and ranges adapt.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Private journal entry point — content itself is browser-local (§14) */}
      <Card className="border-primary/25 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Lock className="size-4 text-primary" /> Private journal
          </CardTitle>
          <CardDescription>
            A browser-local, per-astronaut space to reflect on sleep, stress and
            life in isolation. Entries never reach the crew server and never
            appear in checkup status, alerts or reports.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            render={<Link href={`/crew/${astronaut.id}/journal`} />}
          >
            <NotebookPen className="size-4" /> Open private journal
          </Button>
        </CardContent>
      </Card>

      {/* Dynamic charts (§8: charts of health indicators over time, 7/30-day range) */}
      <Card>
        <CardHeader>
          <CardTitle>Health indicators over time</CardTitle>
          <CardDescription>
            Resting HR against the relaxed band, sleep duration, and the color-coded
            night status.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SleepCharts nights={chartNights} band={band} />
        </CardContent>
      </Card>

      {/* Checkup history */}
      <Card>
        <CardHeader>
          <CardTitle>Checkup history</CardTitle>
          <CardDescription>
            Last 30 nights — missed nights are listed too, so gaps stay visible.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="max-h-96">
            <Table>
              <TableHeader className="sticky top-0 z-1 bg-card">
                <TableRow>
                  <TableHead>Night</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead className="text-right">HR min–max</TableHead>
                  <TableHead className="text-right">Avg</TableHead>
                  <TableHead className="text-right">Resting</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">Why</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...nights].reverse().map((n) => {
                  const st = n.checkup?.status ?? "GRAY"
                  const sm = STATUS_META[st]
                  return (
                    <TableRow key={n.date}>
                      <TableCell className="whitespace-nowrap">
                        {formatDate(`${n.date}T12:00:00Z`)}
                      </TableCell>
                      <TableCell>
                        {n.checkup ? formatDuration(n.checkup.duration_minutes) : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {n.checkup ? `${n.checkup.hr_min}–${n.checkup.hr_max}` : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {n.checkup?.hr_avg ?? "—"}
                      </TableCell>
                      <TableCell className={cn("text-right font-medium tabular-nums", sm.text)}>
                        {n.checkup?.resting_hr ?? "—"}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={st} />
                      </TableCell>
                      <TableCell
                        className="hidden max-w-72 truncate text-xs text-muted-foreground md:table-cell"
                        title={n.checkup?.reason}
                      >
                        {n.checkup?.reason ?? "No checkup completed for this night."}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Guidance & education (§6) */}
      <Card>
        <CardHeader>
          <CardTitle>Guidance</CardTitle>
          <CardDescription>
            Simple explanations — no assumed expertise.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border p-3">
            <div className="mb-1.5 flex items-center gap-1.5 text-sm font-medium">
              <Info className="size-4 text-primary" /> What is resting HR?
            </div>
            <p className="text-sm text-muted-foreground">{RESTING_HR_EXPLAINER}</p>
          </div>
          <div className="rounded-lg border p-3">
            <div className="mb-1.5 flex items-center gap-1.5 text-sm font-medium">
              <TriangleAlert className="size-4 text-amber-500" /> Why this matters here
            </div>
            <p className="text-sm text-muted-foreground">
              {STATUS_META.AMBER.meaning} When amber repeats, the advice escalates; a
              red result always comes with a human-contact step — never self-managed
              in isolation.
            </p>
          </div>
          <div className="rounded-lg border p-3 md:col-span-2">
            <div className="mb-1.5 text-sm font-medium">
              {env.label} — environment adjustments
            </div>
            <ul className="list-inside list-disc text-sm text-muted-foreground">
              {env.tips.map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-muted-foreground">
              Status of a given night: color at a glance —{" "}
              {(["GREEN", "AMBER", "RED", "GRAY"] as const)
                .map((s) => STATUS_META[s].label.split(" —")[0].toLowerCase())
                .join(" / ")}
              {" "}with the matched recommendation shown on the result itself.
            </p>
          </div>
        </CardContent>
      </Card>
    </>
  )
}

function Metric({
  label,
  value,
  unit,
  accent,
}: {
  label: string
  value: string
  unit?: string
  accent?: string
}) {
  return (
    <div className="rounded-lg border bg-muted/30 px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn("mt-0.5 text-lg font-semibold tabular-nums", accent)}>
        {value}
        {unit && <span className="ml-1 text-xs font-normal text-muted-foreground">{unit}</span>}
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-dashed pb-2 last:border-0 last:pb-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  )
}

function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <Skeleton className="size-12 rounded-full" />
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-5 w-44" />
          <Skeleton className="h-3.5 w-28" />
        </div>
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <Skeleton className="h-72 xl:col-span-2" />
        <Skeleton className="h-72" />
      </div>
      <Skeleton className="h-96" />
      <Skeleton className="h-64" />
    </div>
  )
}
