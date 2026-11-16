"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react"
import {
  CalendarDays,
  Lock,
  NotebookPen,
  Plus,
  Search,
  Trash2,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  JOURNAL_PRIVACY_NOTE,
  JOURNAL_PROMPTS,
  NASA_ISOLATION_QUOTE,
  NASA_ISOLATION_URL,
} from "@/lib/guidance"
import { cn } from "@/lib/utils"

/**
 * Private journal (PROJECT.md §14).
 *
 * This is the web *secondary* journal: entries live in this browser's
 * localStorage under the astronaut id and are never sent to the crew server.
 * The shared dashboard only links here; it never renders entry content.
 */

const STORAGE_VERSION = 1

const emptySubscribe = () => () => {}
const getClientSnapshot = () => true
const getServerSnapshot = () => false

interface JournalEntry {
  id: string
  title: string
  body: string
  createdAt: number
  updatedAt: number
}

function storageKey(astronautId: string): string {
  return `astrorest.journal.v${STORAGE_VERSION}.${astronautId}`
}

function newEntryId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `j-${crypto.randomUUID()}`
  }
  return `j-${Date.now()}`
}

function wordCount(text: string): number {
  const trimmed = text.trim()
  return trimmed ? trimmed.split(/\s+/).length : 0
}

function displayTitle(entry: JournalEntry): string {
  return entry.title.trim() || "Untitled entry"
}

function localDateKey(timestamp: number): string {
  const date = new Date(timestamp)
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${date.getFullYear()}-${month}-${day}`
}

function formatEntryDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function formatEntryDateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function isJournalEntry(value: unknown): value is JournalEntry {
  if (!value || typeof value !== "object") return false
  const entry = value as Record<string, unknown>
  return (
    typeof entry.id === "string" &&
    typeof entry.title === "string" &&
    typeof entry.body === "string" &&
    typeof entry.createdAt === "number" &&
    typeof entry.updatedAt === "number"
  )
}

function parseEntries(raw: string | null): JournalEntry[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as { entries?: unknown }
    if (!Array.isArray(parsed.entries)) return []
    return parsed.entries.filter(isJournalEntry)
  } catch {
    return []
  }
}

function upsertEntry(
  entries: JournalEntry[],
  currentId: string | null,
  title: string,
  body: string,
): { entry: JournalEntry; next: JournalEntry[] } {
  const now = Date.now()
  const id = currentId ?? newEntryId()
  const existing = entries.find((entry) => entry.id === id)
  const entry: JournalEntry = {
    id,
    title,
    body,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  }
  const next = [entry, ...entries.filter((item) => item.id !== id)].sort(
    (a, b) => b.updatedAt - a.updatedAt,
  )
  return { entry, next }
}

export function PrivateJournal({
  astronautId,
  astronautName,
  callsign,
}: {
  astronautId: string
  astronautName: string
  callsign?: string
}) {
  const hydrated = useSyncExternalStore(
    emptySubscribe,
    getClientSnapshot,
    getServerSnapshot,
  )
  const [entries, setEntries] = useState<JournalEntry[]>(() => {
    if (typeof window === "undefined") return []
    try {
      return parseEntries(
        window.localStorage.getItem(storageKey(astronautId)),
      )
    } catch {
      return []
    }
  })
  const [activeId, setActiveId] = useState<string | null>(null)
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving">("saved")
  const [query, setQuery] = useState("")
  const [dateFilter, setDateFilter] = useState("")
  const [confirmDelete, setConfirmDelete] = useState(false)

  const entriesRef = useRef<JournalEntry[]>(entries)
  const activeIdRef = useRef<string | null>(null)
  const draftRef = useRef({ title: "", body: "" })
  const savedRef = useRef<{ id: string | null; title: string; body: string }>({
    id: null,
    title: "",
    body: "",
  })

  const persist = useCallback(
    (next: JournalEntry[]) => {
      try {
        window.localStorage.setItem(
          storageKey(astronautId),
          JSON.stringify({ v: STORAGE_VERSION, entries: next }),
        )
      } catch {
        // Storage can be unavailable (private mode/quota); the in-memory
        // journal still works for this visit but cannot be persisted.
      }
    },
    [astronautId],
  )

  const applyEntries = useCallback(
    (next: JournalEntry[]) => {
      entriesRef.current = next
      setEntries(next)
      persist(next)
    },
    [persist],
  )

  const commitDraft = useCallback((): string | null => {
    const draft = draftRef.current
    const currentId = activeIdRef.current
    if (!currentId && draft.title.trim() === "" && draft.body.trim() === "") {
      return null
    }
    const { entry, next } = upsertEntry(
      entriesRef.current,
      currentId,
      draft.title,
      draft.body,
    )
    applyEntries(next)
    activeIdRef.current = entry.id
    setActiveId(entry.id)
    savedRef.current = {
      id: entry.id,
      title: entry.title,
      body: entry.body,
    }
    setSaveStatus("saved")
    return entry.id
  }, [applyEntries])

  // Entries are read in the lazy useState initializer above. `hydrated` is
  // false for the server render and the hydration pass, so both show the same
  // loading card; the stored journal appears once the browser takes over.

  // Debounced autosave, mirroring the ASTRA prototype (600 ms).
  useEffect(() => {
    if (!hydrated) return
    const draft = draftRef.current
    const saved = savedRef.current
    if (
      activeIdRef.current === saved.id &&
      draft.title === saved.title &&
      draft.body === saved.body
    ) {
      return
    }
    if (
      activeIdRef.current === null &&
      draft.title.trim() === "" &&
      draft.body.trim() === ""
    ) {
      return
    }
    setSaveStatus("saving")
    const timer = window.setTimeout(() => {
      commitDraft()
    }, 600)
    return () => window.clearTimeout(timer)
  }, [hydrated, title, body, activeId, commitDraft])

  // Best-effort flush if the astronaut navigates away before the debounce.
  useEffect(() => {
    return () => {
      const draft = draftRef.current
      const currentId = activeIdRef.current
      const saved = savedRef.current
      if (!currentId && draft.title.trim() === "" && draft.body.trim() === "") {
        return
      }
      if (
        currentId === saved.id &&
        draft.title === saved.title &&
        draft.body === saved.body
      ) {
        return
      }
      const { next } = upsertEntry(
        entriesRef.current,
        currentId,
        draft.title,
        draft.body,
      )
      try {
        window.localStorage.setItem(
          storageKey(astronautId),
          JSON.stringify({ v: STORAGE_VERSION, entries: next }),
        )
      } catch {
        // Nothing else can be done during teardown.
      }
    }
  }, [astronautId])

  const openEntry = useCallback(
    (entry: JournalEntry) => {
      commitDraft()
      const latest =
        entriesRef.current.find((item) => item.id === entry.id) ?? entry
      activeIdRef.current = latest.id
      setActiveId(latest.id)
      setTitle(latest.title)
      setBody(latest.body)
      draftRef.current = { title: latest.title, body: latest.body }
      savedRef.current = {
        id: latest.id,
        title: latest.title,
        body: latest.body,
      }
      setSaveStatus("saved")
      setConfirmDelete(false)
    },
    [commitDraft],
  )

  const startNewEntry = useCallback(() => {
    commitDraft()
    activeIdRef.current = null
    setActiveId(null)
    setTitle("")
    setBody("")
    draftRef.current = { title: "", body: "" }
    savedRef.current = { id: null, title: "", body: "" }
    setSaveStatus("saved")
    setConfirmDelete(false)
  }, [commitDraft])

  function updateTitle(value: string) {
    setTitle(value)
    draftRef.current.title = value
  }

  function updateBody(value: string) {
    setBody(value)
    draftRef.current.body = value
  }

  function addPrompt(prompt: string) {
    const prefix = body.trimEnd()
    updateBody(prefix === "" ? `${prompt}\n` : `${prefix}\n\n${prompt}\n`)
  }

  function deleteEntry() {
    const currentId = activeIdRef.current
    if (!currentId) return
    applyEntries(entriesRef.current.filter((entry) => entry.id !== currentId))
    activeIdRef.current = null
    setActiveId(null)
    setTitle("")
    setBody("")
    draftRef.current = { title: "", body: "" }
    savedRef.current = { id: null, title: "", body: "" }
    setSaveStatus("saved")
    setConfirmDelete(false)
  }

  const latest = entries[0] ?? null
  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return entries.filter((entry) => {
      if (
        normalizedQuery &&
        !displayTitle(entry).toLowerCase().includes(normalizedQuery)
      ) {
        return false
      }
      if (dateFilter && localDateKey(entry.createdAt) !== dateFilter) {
        return false
      }
      return true
    })
  }, [entries, query, dateFilter])

  if (!hydrated) {
    return (
      <Card>
        <CardContent className="py-10 text-sm text-muted-foreground">
          Loading this browser&apos;s private journal…
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
            <NotebookPen className="size-5 text-primary" />
            Private journal
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            A quiet place for {astronautName}
            {callsign ? ` “${callsign}”` : ""} to put thoughts into words —
            separate from the shared crew dashboard.
          </p>
        </div>
        <Badge variant="outline" className="ml-auto gap-1">
          <Lock className="size-3" /> Browser-local
        </Badge>
      </div>

      <div className="rounded-lg border border-primary/25 bg-primary/5 p-3 text-sm">
        <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase">
          <Lock className="size-3.5" /> Isolation &amp; confinement
        </div>
        <p className="text-muted-foreground">{NASA_ISOLATION_QUOTE}</p>
        <a
          href={NASA_ISOLATION_URL}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-block text-xs font-medium text-primary underline-offset-4 hover:underline"
        >
          Source: NASA Human Research Program
        </a>
      </div>

      {latest && (
        <Card size="sm" className="border-primary/20 bg-primary/5">
          <CardContent className="flex flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-xs text-muted-foreground uppercase">
                Latest entry
              </div>
              <div className="truncate text-sm font-medium">
                {displayTitle(latest)}
              </div>
              <div className="text-xs text-muted-foreground">
                {formatEntryDateTime(latest.updatedAt)} · {wordCount(latest.body)}{" "}
                words
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => openEntry(latest)}>
              Continue writing
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <NotebookPen className="size-4" /> Entries
            </CardTitle>
            <CardDescription>
              Most recently edited first. Search only looks at titles.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Button size="sm" onClick={startNewEntry}>
              <Plus className="size-4" /> New entry
            </Button>

            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search titles"
                aria-label="Search journal titles"
                className="pl-8"
              />
            </div>

            <div className="flex items-center gap-2">
              <CalendarDays className="size-3.5 shrink-0 text-muted-foreground" />
              <Input
                type="date"
                value={dateFilter}
                onChange={(event) => setDateFilter(event.target.value)}
                aria-label="Filter journal entries by date"
              />
              {dateFilter && (
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => setDateFilter("")}
                >
                  Clear
                </Button>
              )}
            </div>

            <div className="mt-1 flex max-h-[28rem] flex-col gap-1 overflow-y-auto pr-1">
              {filtered.length === 0 ? (
                <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
                  {entries.length === 0
                    ? "No entries yet. Start a new one when you are ready — there is no target length."
                    : "No entries match this search or date."}
                </p>
              ) : (
                filtered.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => openEntry(entry)}
                    aria-current={activeId === entry.id}
                    className={cn(
                      "rounded-lg border border-transparent px-2.5 py-2 text-left transition-colors hover:bg-muted/60",
                      activeId === entry.id &&
                        "border-primary/40 bg-primary/10 hover:bg-primary/10",
                    )}
                  >
                    <span className="block truncate text-sm font-medium">
                      {displayTitle(entry)}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {formatEntryDate(entry.createdAt)} ·{" "}
                      {wordCount(entry.body)} words
                    </span>
                  </button>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="size-4 text-primary" />
              {activeId ? "Edit entry" : "New entry"}
            </CardTitle>
            <CardDescription>
              Autosaves in this browser. No target length, no score, no share
              button.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="journal-title"
                className="text-xs font-medium text-muted-foreground"
              >
                Title
              </label>
              <Input
                id="journal-title"
                value={title}
                onChange={(event) => updateTitle(event.target.value)}
                placeholder="Give this entry a title (optional)"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="text-xs font-medium text-muted-foreground">
                Need a starting point?
              </div>
              <div className="flex flex-wrap gap-1.5">
                {JOURNAL_PROMPTS.map((prompt) => (
                  <Button
                    key={prompt}
                    type="button"
                    variant="outline"
                    size="xs"
                    onClick={() => addPrompt(prompt)}
                  >
                    {prompt}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="journal-body"
                className="text-xs font-medium text-muted-foreground"
              >
                Entry
              </label>
              <textarea
                id="journal-body"
                value={body}
                onChange={(event) => updateBody(event.target.value)}
                placeholder="Write freely. There is no target length."
                className="min-h-72 w-full resize-y rounded-lg border border-input bg-transparent px-3 py-2 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {wordCount(body)} words ·{" "}
                {saveStatus === "saving" ? "Saving…" : "Saved in this browser"}
              </span>
              <div className="ml-auto">
                {activeId ? (
                  confirmDelete ? (
                    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-2 text-xs">
                      <span>Delete this entry? This cannot be undone.</span>
                      <Button
                        size="xs"
                        variant="destructive"
                        onClick={deleteEntry}
                      >
                        Delete entry
                      </Button>
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={() => setConfirmDelete(false)}
                      >
                        Keep entry
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setConfirmDelete(true)}
                    >
                      <Trash2 className="size-4" /> Delete
                    </Button>
                  )
                ) : null}
              </div>
            </div>

            <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
              <div className="mb-1 flex items-center gap-1.5 font-medium text-foreground">
                <Lock className="size-3.5" /> Where this lives
              </div>
              {JOURNAL_PRIVACY_NOTE}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
