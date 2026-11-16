"use client"

import { useState } from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceArea,
  XAxis,
  YAxis,
} from "recharts"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatDuration } from "@/lib/format"

export interface ChartNight {
  date: string
  label: string
  resting: number | null
  duration: number | null
  status: "GREEN" | "AMBER" | "RED" | "GRAY"
  reason?: string
}

const STATUS_HEX: Record<ChartNight["status"], string> = {
  GREEN: "#10b981",
  AMBER: "#f59e0b",
  RED: "#ef4444",
  GRAY: "#71717a",
}

const chartConfig = {
  resting: { label: "Resting HR", color: "var(--primary)" },
  duration: { label: "Sleep duration", color: "var(--chart-2)" },
} satisfies ChartConfig

function dotRenderer(dotProps: {
  cx?: number
  cy?: number
  key?: React.Key | null
  payload?: ChartNight
}) {
  const { cx, cy, payload, key } = dotProps
  if (cx == null || cy == null || payload?.resting == null) {
    return <g key={key} />
  }
  return (
    <circle
      key={key}
      cx={cx}
      cy={cy}
      r={3.5}
      fill={STATUS_HEX[payload.status] ?? STATUS_HEX.GRAY}
    />
  )
}

function ChartTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-1 flex items-baseline justify-between gap-2">
      <span className="text-sm font-medium">{children}</span>
    </div>
  )
}

export function SleepCharts({
  nights,
  band,
}: {
  nights: ChartNight[]
  band: [number, number]
}) {
  const [range, setRange] = useState<"7" | "30">("30")
  const slice = range === "7" ? nights.slice(-7) : nights

  const yDomain: [number, number] = [band[0] - 10, band[1] + 18]

  return (
    <Tabs
      defaultValue="30"
      onValueChange={(value) => setRange(value as "7" | "30")}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Personal relaxed band {band[0]}–{band[1]} bpm{" "}
          <span className="text-muted-foreground/70">(incl. environment offset)</span>
        </p>
        <TabsList>
          <TabsTrigger value="7">7 nights</TabsTrigger>
          <TabsTrigger value="30">30 nights</TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="7" className="mt-3 flex flex-col gap-6">
        <Charts slice={slice} band={band} yDomain={yDomain} />
      </TabsContent>
      <TabsContent value="30" className="mt-3 flex flex-col gap-6">
        <Charts slice={slice} band={band} yDomain={yDomain} />
      </TabsContent>
    </Tabs>
  )
}

function Charts({
  slice,
  band,
  yDomain,
}: {
  slice: ChartNight[]
  band: [number, number]
  yDomain: [number, number]
}) {
  return (
    <>
      <div>
        <ChartTitle>Resting HR trend</ChartTitle>
        <ChartContainer config={chartConfig} className="h-56 w-full">
          <LineChart data={slice} margin={{ left: -8, right: 8, top: 8 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={26}
            />
            <YAxis
              domain={yDomain}
              tickLine={false}
              axisLine={false}
              width={34}
              tickFormatter={(value: number) => `${value}`}
            />
            <ReferenceArea
              y1={band[0]}
              y2={band[1]}
              fill="var(--primary)"
              fillOpacity={0.08}
              stroke="var(--primary)"
              strokeOpacity={0.3}
              strokeDasharray="4 4"
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelKey="label"
                  indicator="line"
                />
              }
            />
            <Line
              dataKey="resting"
              type="monotone"
              stroke="var(--primary)"
              strokeWidth={2}
              dot={dotRenderer}
              connectNulls={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ChartContainer>
      </div>

      <div>
        <ChartTitle>Sleep duration</ChartTitle>
        <ChartContainer config={chartConfig} className="h-44 w-full">
          <BarChart data={slice} margin={{ left: -8, right: 8, top: 8 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={26}
            />
            <YAxis
              domain={[0, 600]}
              ticks={[0, 180, 360, 540]}
              tickLine={false}
              axisLine={false}
              width={34}
              tickFormatter={(value: number) => `${Math.round(value / 60)}h`}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelKey="label"
                  indicator="line"
                  formatter={(value) =>
                    typeof value === "number" ? formatDuration(value) : String(value)
                  }
                />
              }
            />
            <Bar dataKey="duration" radius={4} isAnimationActive={false}>
              {slice.map((night, index) => (
                <Cell
                  key={index}
                  fill={STATUS_HEX[night.status]}
                  fillOpacity={night.duration == null ? 0 : 0.75}
                />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      </div>
    </>
  )
}
