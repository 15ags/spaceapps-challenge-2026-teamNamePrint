import { Suspense } from "react"
import { redirect } from "next/navigation"
import { UserPlus, Users } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { getMode, listAstronauts } from "@/lib/store"
import { CrewManager, CrewList } from "@/components/crew-manager"

export const metadata = { title: "Crew profiles" }

/**
 * Astronaut profile management (PROJECT.md §4 astronaut_id): live mode is
 * where profiles are created — on this page or from the Android app via
 * POST /api/v1/crew. Demo mode shows the fixed sample crew read-only.
 */
export default function CrewPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Crew Profiles</h1>
        <p className="text-sm text-muted-foreground">
          One profile per astronaut — the app sends checkups under its profile id.
        </p>
      </div>

      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <CrewContent />
      </Suspense>
    </div>
  )
}

async function CrewContent() {
  const mode = await getMode()
  if (mode === null) {
    redirect("/welcome")
  }
  const crew = await listAstronauts()

  if (mode === "demo") {
    return (
      <div className="flex flex-col gap-4">
        <Card className="border-l-4 border-l-amber-500 pl-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="size-4" /> Demo crew (read-only)
            </CardTitle>
            <CardDescription>
              Demo mode runs on a fixed sample crew. Switch to Live mode to
              create your own astronaut profiles — the sidebar has the switch.
            </CardDescription>
          </CardHeader>
        </Card>
        <CrewList crew={crew} editable={false} />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserPlus className="size-4" /> Add a crew member
          </CardTitle>
          <CardDescription>
            The generated id (e.g. <code className="font-mono text-xs">sofia-rios</code>)
            is the <code className="font-mono text-xs">astronaut_id</code> the
            Android app sends with its checkup uploads.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CrewManager />
        </CardContent>
      </Card>

      <CrewList crew={crew} editable />
    </div>
  )
}
