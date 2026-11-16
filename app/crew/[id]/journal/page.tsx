import { Suspense } from "react"
import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ArrowLeft } from "lucide-react"

import { PrivateJournal } from "@/components/private-journal"
import { Skeleton } from "@/components/ui/skeleton"
import { getAstronautOverview, getMode } from "@/lib/store"

export const metadata = { title: "Private journal" }

/**
 * Secondary, browser-local journal (PROJECT.md §14). The server only resolves
 * the astronaut profile; entry text is loaded from localStorage inside the
 * client component and is never sent to the crew server.
 */
export default function JournalPage(props: PageProps<"/crew/[id]/journal">) {
  return (
    <Suspense fallback={<JournalSkeleton />}>
      <JournalContent params={props.params} />
    </Suspense>
  )
}

async function JournalContent({
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

  return (
    <div className="flex flex-col gap-4">
      <Link
        href={`/crew/${overview.astronaut.id}`}
        className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to {overview.astronaut.name}
      </Link>
      <PrivateJournal
        key={overview.astronaut.id}
        astronautId={overview.astronaut.id}
        astronautName={overview.astronaut.name}
        callsign={overview.astronaut.callsign}
      />
    </div>
  )
}

function JournalSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-4 w-40" />
      <div className="flex flex-col gap-1.5">
        <Skeleton className="h-6 w-52" />
        <Skeleton className="h-3.5 w-80" />
      </div>
      <Skeleton className="h-24 w-full" />
      <div className="grid gap-4 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <Skeleton className="h-80" />
        <Skeleton className="h-96" />
      </div>
    </div>
  )
}
