import { Suspense } from "react"
import { redirect } from "next/navigation"
import { MoonStar } from "lucide-react"

import { getMode } from "@/lib/store"
import { ModePicker } from "@/components/mode-picker"
import { Skeleton } from "@/components/ui/skeleton"

export const metadata = { title: "Welcome" }

/**
 * First-launch setup (PROJECT.md §2): pick Demo or Live before anything else
 * is shown. Once a mode is chosen this page always redirects to the dashboard;
 * the mode can be switched later from the sidebar.
 */
export default function WelcomePage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 py-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <MoonStar className="size-6" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Crew Sleep Monitor
        </h1>
        <p className="max-w-md text-sm text-muted-foreground">
          Sleep-time heart-rate checkups for astronauts — resting HR, color-coded
          stress status, and crew alerting. Pick how this deployment runs:
        </p>
      </div>

      <Suspense fallback={<Skeleton className="h-72 w-full" />}>
        <WelcomeGate />
      </Suspense>
    </div>
  )
}

async function WelcomeGate() {
  const mode = await getMode()
  if (mode !== null) {
    redirect("/")
  }
  return <ModePicker />
}
