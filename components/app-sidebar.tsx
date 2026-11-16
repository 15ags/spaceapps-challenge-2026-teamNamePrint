import { Suspense } from "react"
import Link from "next/link"

import {
  Antenna,
  FlaskConical,
  LayoutDashboard,
  MoonStar,
  Radio,
  UserPlus,
  Users,
} from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import { StatusDot } from "@/components/status"
import { Skeleton } from "@/components/ui/skeleton"
import { getMode, listCrewOverview } from "@/lib/store"
import { ModeSwitcher } from "@/components/mode-switcher"

const NAV_ITEMS = [
  { title: "Dashboard", href: "/", icon: LayoutDashboard },
  { title: "Crew profiles", href: "/crew", icon: Users },
  { title: "Alerts", href: "/alerts", icon: Radio },
  { title: "API Reference", href: "/api-reference", icon: Antenna },
]

export function AppSidebar() {
  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <MoonStar className="size-4" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold tracking-tight">
              Crew Sleep Monitor
            </div>
            <div className="truncate text-xs text-muted-foreground">
              Sleep HR &amp; stress watch
            </div>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Mission</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton render={<Link href={item.href} />}>
                    <item.icon />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Crew status</SidebarGroupLabel>
          <SidebarGroupContent>
            <Suspense fallback={<CrewNavSkeleton />}>
              <CrewNavList />
            </Suspense>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <Suspense fallback={<SidebarFooterSkeleton />}>
          <ModeFooter />
        </Suspense>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

async function CrewNavList() {
  const { crew, mode } = await listCrewOverview()
  return (
    <SidebarMenu>
      {crew.length === 0 && mode === "live" && (
        <SidebarMenuItem>
          <SidebarMenuButton render={<Link href="/crew" />}>
            <UserPlus />
            <span>Add crew member</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      )}
      {crew.map(({ astronaut, latest }) => (
        <SidebarMenuItem key={astronaut.id}>
          <SidebarMenuButton
            render={<Link href={`/crew/${astronaut.id}`} />}
            tooltip={`${astronaut.name} — ${latest?.status ?? "no data"}`}
          >
            <StatusDot status={latest?.status ?? "GRAY"} />
            <span>{astronaut.name}</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  )
}

/** Two-mode deployment footer: switch + what the current dataset is. */
async function ModeFooter() {
  const mode = await getMode()
  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-sidebar-accent/50 p-2 text-xs text-muted-foreground">
      <ModeSwitcher mode={mode} />
      <div className="flex items-start gap-1.5">
        {mode === "live" ? (
          <Radio className="mt-0.5 size-3.5 shrink-0" />
        ) : (
          <FlaskConical className="mt-0.5 size-3.5 shrink-0" />
        )}
        <span>
          {mode === "live"
            ? "Live — real uploads from the app; profiles on the Crew page."
            : mode === "demo"
              ? "Demo — seeded sample crew & simulated sensor data."
              : "Pick demo or live to finish setup."}
        </span>
      </div>
      {mode === "demo" && (
        <div className="flex items-start gap-1.5">
          <Antenna className="mt-0.5 size-3.5 shrink-0" />
          <span>Demo crew: astro-001 … astro-006 (app uploads still accepted).</span>
        </div>
      )}
    </div>
  )
}

function CrewNavSkeleton() {
  return (
    <SidebarMenu>
      {Array.from({ length: 4 }).map((_, i) => (
        <SidebarMenuItem key={i}>
          <div className="flex items-center gap-2 p-2">
            <Skeleton className="size-2 rounded-full" />
            <Skeleton className="h-3 w-24" />
          </div>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  )
}

function SidebarFooterSkeleton() {
  return <Skeleton className="h-20 w-full rounded-lg" />
}
