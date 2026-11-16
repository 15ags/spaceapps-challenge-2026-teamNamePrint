/**
 * In-memory crew data store with a deterministic seeded dataset.
 *
 * - Reads are per-request fresh: every query calls `connection()` first, which
 *   excludes it from prerendering under Cache Components (§ docs caching).
 * - `POST /api/v1/checkups` uploads are persisted to `data/db.json` so they
 *   survive server restarts; seeds are regenerated relative to "today".
 */

import { connection } from "next/server"
import fs from "node:fs"
import path from "node:path"

import type {
  AppMode,
  Astronaut,
  CheckupStatus,
  CrewAlert,
  CrewOverview,
  Environment,
  MissionDashboard,
  NightEntry,
  NightStatus,
  SleepCheckup,
} from "@/lib/types"
import { ENVIRONMENT_PROFILES } from "@/lib/guidance"

const NIGHTS_IN_WINDOW = 30
const DATA_DIR = path.join(process.cwd(), "data")
const DB_FILE = path.join(DATA_DIR, "db.json")

/* ------------------------------------------------------------------ */
/* Deterministic PRNG (so the demo dataset is stable within a process) */
/* ------------------------------------------------------------------ */

function hashCode(str: string): number {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), a | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function between(rnd: () => number, lo: number, hi: number): number {
  return Math.round(lo + rnd() * (hi - lo))
}

/* ------------------------------------------------------------------ */
/* Seed data                                                           */
/* ------------------------------------------------------------------ */

interface SeedSpec {
  astronaut: Astronaut
  /** Scenario name for the 30-night pattern. */
  scenario: "clean" | "steady" | "amber-pair" | "missed" | "mixed" | "red-now"
  /** Personal relaxed-HR baseline in bpm (before environment offset). */
  baseline: number
}

const SEED_SPECS: SeedSpec[] = [
  {
    astronaut: {
      id: "astro-001",
      name: "Yuna Park",
      callsign: "Nova",
      role: "Commander",
      environment: "station",
    },
    scenario: "steady",
    baseline: 51,
  },
  {
    astronaut: {
      id: "astro-002",
      name: "Marcus Webb",
      callsign: "Orbit",
      role: "Pilot",
      environment: "spacecraft",
    },
    scenario: "clean",
    baseline: 53,
  },
  {
    astronaut: {
      id: "astro-003",
      name: "Aya Okonkwo",
      callsign: "Aurora",
      role: "Flight Engineer",
      environment: "planetary_base",
    },
    scenario: "amber-pair",
    baseline: 55,
  },
  {
    astronaut: {
      id: "astro-004",
      name: "Dmitri Volkov",
      callsign: "Kosmos",
      role: "Mission Specialist",
      environment: "rover",
    },
    scenario: "missed",
    baseline: 49,
  },
  {
    astronaut: {
      id: "astro-005",
      name: "Lena Fischer",
      callsign: "Wander",
      role: "Flight Engineer",
      environment: "station",
    },
    scenario: "mixed",
    baseline: 54,
  },
  {
    astronaut: {
      id: "astro-006",
      name: "Raj Chandra",
      callsign: "Zenith",
      role: "Science Officer",
      environment: "spacecraft",
    },
    scenario: "red-now",
    baseline: 52,
  },
]

/** Build a 30-night status pattern, oldest → newest (index 29 = last night). */
function buildPattern(scenario: SeedSpec["scenario"]): NightStatus[] {
  const n = NIGHTS_IN_WINDOW
  const last = n - 1
  const p: NightStatus[] = Array<NightStatus>(n).fill("GREEN")
  switch (scenario) {
    case "clean":
      break
    case "steady":
      p[last - 8] = "AMBER"
      break
    case "amber-pair":
      p[last] = "AMBER"
      p[last - 1] = "AMBER"
      break
    case "missed":
      p[last] = "GRAY"
      p[last - 1] = "GRAY"
      p[last - 2] = "GRAY"
      p[last - 5] = "AMBER"
      break
    case "mixed":
      p[last - 1] = "AMBER"
      p[last - 4] = "AMBER"
      p[last - 10] = "RED"
      p[last - 11] = "AMBER"
      break
    case "red-now":
      p[last] = "RED"
      p[last - 1] = "AMBER"
      break
  }
  return p
}

/** UTC date (YYYY-MM-DD) for a night, `offsetFromToday` nights ago. */
function nightDate(now: Date, offsetFromToday: number): string {
  const d = new Date(now.getTime() - offsetFromToday * 86_400_000)
  return d.toISOString().slice(0, 10)
}

function labelFor(dateISO: string): string {
  return new Date(`${dateISO}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  })
}

function bandFor(spec: SeedSpec): [number, number] {
  const offset = ENVIRONMENT_PROFILES[spec.astronaut.environment].band_offset
  const center = spec.baseline + offset
  return [center - 5, center + 7]
}

function checkupId(astronautId: string, date: string): string {
  return `chk-${astronautId}-${date.replaceAll("-", "")}`
}

function reasonFor(
  status: CheckupStatus,
  resting: number,
  band: [number, number],
  duration: number,
  hrMax: number,
): string {
  const above = Math.max(1, Math.round(resting - band[1]))
  if (status === "GREEN") {
    return "Your sleep HR stayed inside your relaxed range all night."
  }
  if (status === "AMBER") {
    const hours = Math.max(1, Math.round(duration / 120))
    return `Your sleep HR ran ${above} bpm above your usual range for ~${hours} h — possible stress, heat, discomfort, or a short night.`
  }
  const hours = Math.max(2, Math.round(duration / 90))
  return `Sustained elevated HR: ${above} bpm above your range for ~${hours} h, peaking at ${hrMax} bpm.`
}

function seedCheckups(now: Date): SleepCheckup[] {
  const out: SleepCheckup[] = []
  for (const spec of SEED_SPECS) {
    const rnd = mulberry32(hashCode(spec.astronaut.id))
    const pattern = buildPattern(spec.scenario)
    const band = bandFor(spec)
    for (let i = 0; i < pattern.length; i++) {
      const status = pattern[i]
      if (status === "GRAY") continue
      // i = pattern.length - 1 is "last night" → offset 1 from today
      // (today is excluded: tonight's checkup is still upcoming).
      const date = nightDate(now, pattern.length - i)

      let resting: number
      let duration: number
      if (status === "GREEN") {
        resting = between(rnd, band[0], band[1])
        duration = between(rnd, 405, 525)
      } else if (status === "AMBER") {
        resting = band[1] + between(rnd, 4, 9)
        duration = between(rnd, 330, 440)
      } else {
        resting = band[1] + between(rnd, 12, 16)
        duration = between(rnd, 290, 400)
      }

      const hrMin = resting - between(rnd, 3, 6)
      const hrMax = resting + between(rnd, 18, 32)
      const hrAvg = resting + between(rnd, 4, 8)

      // Start the checkup around the scheduled 21:30 UTC window.
      const startMinutes = 21 * 60 + 30 + between(rnd, -20, 25)
      const startedAt = new Date(
        `${date}T00:00:00Z`.replace(
          "T00:00:00Z",
          `T${String(Math.floor(startMinutes / 60)).padStart(2, "0")}:${String(startMinutes % 60).padStart(2, "0")}:00Z`,
        ),
      )
      const endedAt = new Date(startedAt.getTime() + duration * 60_000)
      const uploadedAt = new Date(endedAt.getTime() + between(rnd, 2, 25) * 60_000)

      out.push({
        id: checkupId(spec.astronaut.id, date),
        astronaut_id: spec.astronaut.id,
        environment: spec.astronaut.environment,
        started_at: startedAt.toISOString(),
        ended_at: endedAt.toISOString(),
        duration_minutes: duration,
        hr_min: hrMin,
        hr_avg: hrAvg,
        hr_max: hrMax,
        resting_hr: resting,
        status,
        reason: reasonFor(status, resting, band, duration, hrMax),
        samples_count: between(rnd, 3000, 9000),
        uploaded_at: uploadedAt.toISOString(),
      })
    }
  }
  return out
}

/* ------------------------------------------------------------------ */
/* Persistence: mode, live-mode crew profiles, and app uploads          */
/* ------------------------------------------------------------------ */

interface PersistedDb {
  /** null until the first-launch mode picker has been completed. */
  mode: AppMode | null
  /** Astronaut profiles created in live mode (demo crew is code-seeded). */
  crew: Astronaut[]
  uploaded: SleepCheckup[]
}

function emptyDb(): PersistedDb {
  return { mode: null, crew: [], uploaded: [] }
}

function readDb(): PersistedDb {
  try {
    if (!fs.existsSync(DB_FILE)) return emptyDb()
    const raw = JSON.parse(fs.readFileSync(DB_FILE, "utf-8")) as
      | (Partial<PersistedDb> & { mode?: AppMode | null })
      | null
    if (!raw || typeof raw !== "object") return emptyDb()
    return {
      mode: raw.mode === "demo" || raw.mode === "live" ? raw.mode : null,
      crew: Array.isArray(raw.crew) ? raw.crew.filter(isAstronaut) : [],
      uploaded: Array.isArray(raw.uploaded) ? raw.uploaded : [],
    }
  } catch {
    return emptyDb()
  }
}

function writeDb(db: PersistedDb) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true })
    // Keep uploads bounded — last 500.
    fs.writeFileSync(
      DB_FILE,
      JSON.stringify(
        { ...db, uploaded: db.uploaded.slice(-500) },
        null,
        2,
      ),
    )
  } catch {
    // Read-only filesystem or similar — in-memory still works.
  }
}

function isAstronaut(value: unknown): value is Astronaut {
  if (typeof value !== "object" || value === null) return false
  const a = value as Record<string, unknown>
  return (
    typeof a.id === "string" &&
    typeof a.name === "string" &&
    typeof a.environment === "string" &&
    a.environment in ENVIRONMENT_PROFILES
  )
}

/* ------------------------------------------------------------------ */
/* Store                                                               */
/* ------------------------------------------------------------------ */

interface Store {
  mode: AppMode
  now: Date
  astronauts: Map<string, Astronaut>
  /** night date → astronaut id → checkup */
  byNight: Map<string, Map<string, SleepCheckup>>
  uploaded: SleepCheckup[]
}

let store: Store | null = null

/** Astronauts visible in a mode: fixed demo crew, or live-created profiles. */
function crewFor(db: PersistedDb, mode: AppMode): Astronaut[] {
  if (mode === "demo") {
    return SEED_SPECS.map((spec) => spec.astronaut)
  }
  return db.crew
}

function ensureStore(now: Date, mode: AppMode): Store {
  if (store && store.mode === mode) return store

  const db = readDb()
  const s: Store = {
    mode,
    now,
    astronauts: new Map(),
    byNight: new Map(),
    uploaded: db.uploaded,
  }

  for (const astro of crewFor(db, mode)) s.astronauts.set(astro.id, astro)
  // Demo mode additionally displays the seeded 30-night dataset; live mode
  // starts empty and only shows real uploads.
  const seeded = mode === "demo" ? seedCheckups(now) : []
  for (const chk of [...seeded, ...db.uploaded]) {
    const band = bandForAstronaut(s.astronauts.get(chk.astronaut_id))
    if (!chk.reason) {
      chk.reason = reasonFor(
        chk.status,
        chk.resting_hr,
        band,
        chk.duration_minutes,
        chk.hr_max,
      )
    }
    put(s, chk)
  }
  store = s
  return s
}

/** The current mode — null until the first-launch picker completes (§2). */
export async function getMode(): Promise<AppMode | null> {
  await connection()
  return readDb().mode
}

/** Until a mode is picked, pages redirect to /welcome; queries fall back to demo. */
function modeOrDefault(mode: AppMode | null): AppMode {
  return mode ?? "demo"
}

export async function setMode(mode: AppMode): Promise<void> {
  await connection()
  const db = readDb()
  if (db.mode === mode) return
  writeDb({ ...db, mode })
  store = null // rebuild for the new mode's crew dataset
}

function bandForAstronaut(astro: Astronaut | undefined): [number, number] {
  const spec = SEED_SPECS.find((s) => s.astronaut.id === astro?.id)
  if (spec) return bandFor(spec)
  const offset = astro
    ? ENVIRONMENT_PROFILES[astro.environment].band_offset
    : 0
  const center = 53 + offset
  return [center - 5, center + 7]
}

function put(s: Store, chk: SleepCheckup) {
  let perAstronaut = s.byNight.get(chk.astronaut_id)
  if (!perAstronaut) {
    perAstronaut = new Map()
    s.byNight.set(chk.astronaut_id, perAstronaut)
  }
  perAstronaut.set(chk.started_at.slice(0, 10), chk)
}

function bandOf(s: Store, astroId: string): [number, number] {
  const spec = SEED_SPECS.find((sp) => sp.astronaut.id === astroId)
  if (spec) return bandFor(spec)
  // Created profiles (live mode): personal baseline until calibrated →
  // environment-adjusted default center, matching bandForAstronaut.
  const astro = s.astronauts.get(astroId)
  const offset = astro ? ENVIRONMENT_PROFILES[astro.environment].band_offset : 0
  const center = 53 + offset
  return [center - 5, center + 7]
}

/* ------------------------------------------------------------------ */
/* Derived helpers                                                     */
/* ------------------------------------------------------------------ */

function nightsWindow(
  s: Store,
  astronautId: string,
  nights: number,
): NightEntry[] {
  const perAstronaut = s.byNight.get(astronautId) ?? new Map<string, SleepCheckup>()
  const out: NightEntry[] = []
  // i = 0 → last night … i = nights-1 → oldest; "today" is excluded.
  for (let i = 0; i < nights; i++) {
    const date = nightDate(s.now, i + 1)
    out.push({ date, label: labelFor(date), checkup: perAstronaut.get(date) ?? null })
  }
  return out.reverse()
}

function streakFrom(entries: NightEntry[]): number {
  // entries are oldest → newest; count completed nights ending at the newest.
  let streak = 0
  for (let i = entries.length - 1; i >= 0; i--) {
    if (!entries[i].checkup) break
    streak++
  }
  return streak
}

function missedStreak(entries: NightEntry[]): number {
  const ordered = [...entries].reverse() // newest first
  let missed = 0
  for (const e of ordered) {
    if (e.checkup) break
    missed++
  }
  return missed
}

function amberStreak(entries: NightEntry[]): number {
  const ordered = [...entries].reverse()
  let amber = 0
  for (const e of ordered) {
    if (!e.checkup) break
    if (e.checkup.status !== "AMBER") break
    amber++
  }
  return amber
}

function compliancePct(entries: NightEntry[]): number {
  const done = entries.filter((e) => e.checkup).length
  return Math.round((done / entries.length) * 100)
}

function avgResting(entries: NightEntry[], count: number): number | null {
  const done = [...entries]
    .reverse()
    .filter((e) => e.checkup)
    .slice(0, count)
  if (!done.length) return null
  return Math.round(
    done.reduce((sum, e) => sum + (e.checkup?.resting_hr ?? 0), 0) / done.length,
  )
}

function statusForEntry(e: NightEntry): NightStatus {
  return e.checkup?.status ?? "GRAY"
}

/* ------------------------------------------------------------------ */
/* Public queries — all call connection() for per-request freshness    */
/* ------------------------------------------------------------------ */

export async function listCrewOverview(): Promise<{
  now: string
  mode: AppMode
  crew: CrewOverview[]
}> {
  await connection()
  const mode = modeOrDefault(await getMode())
  const s = ensureStore(new Date(), mode)

  const crew = [...s.astronauts.values()].map((astro) => {
    const nights = nightsWindow(s, astro.id, NIGHTS_IN_WINDOW)
    // nights are oldest → newest; the latest completed checkup is the last one.
    const latest = [...nights].reverse().find((e) => e.checkup)?.checkup ?? null
    const band = bandOf(s, astro.id)
    return {
      now: s.now.toISOString(),
      astronaut: astro,
      nights,
      latest,
      streak: streakFrom(nights),
      missed_streak: missedStreak(nights),
      amber_streak: amberStreak(nights),
      compliance_pct: compliancePct(nights),
      avg_resting_7d: avgResting(nights, 7),
      band,
    } satisfies CrewOverview
  })

  return { now: s.now.toISOString(), mode, crew }
}

export async function getMissionDashboard(): Promise<MissionDashboard> {
  await connection()
  const mode = modeOrDefault(await getMode())
  const s = ensureStore(new Date(), mode)
  const { crew } = await listCrewOverview()

  const counts = {
    // Same semantics as the table's Status column: the latest completed checkup.
    green: crew.filter((c) => c.latest?.status === "GREEN").length,
    amber: crew.filter((c) => c.latest?.status === "AMBER").length,
    red: crew.filter((c) => c.latest?.status === "RED").length,
    missed_last_night: crew.filter(
      (c) => statusForEntry(c.nights[c.nights.length - 1]) === "GRAY",
    ).length,
  }

  return {
    now: s.now.toISOString(),
    mode,
    crew,
    alerts: computeAlerts(crew),
    counts,
    avg_compliance_pct:
      crew.length === 0
        ? 0
        : Math.round(crew.reduce((sum, c) => sum + c.compliance_pct, 0) / crew.length),
  }
}

export async function getAstronautOverview(
  id: string,
): Promise<CrewOverview | null> {
  await connection()
  const mode = modeOrDefault(await getMode())
  const s = ensureStore(new Date(), mode)
  if (!s.astronauts.has(id)) return null
  const nights = nightsWindow(s, id, NIGHTS_IN_WINDOW)
  const latest = [...nights].reverse().find((e) => e.checkup)?.checkup ?? null
  const band = bandOf(s, id)
  return {
    now: s.now.toISOString(),
    astronaut: s.astronauts.get(id) as Astronaut,
    nights,
    latest,
    streak: streakFrom(nights),
    missed_streak: missedStreak(nights),
    amber_streak: amberStreak(nights),
    compliance_pct: compliancePct(nights),
    avg_resting_7d: avgResting(nights, 7),
    band,
  }
}

function computeAlerts(crew: CrewOverview[]): CrewAlert[] {
  const alerts: CrewAlert[] = []
  for (const c of crew) {
    const { astronaut: astro, nights } = c
    // Most recent completed night (oldest→newest array → take from the end).
    const latestCompleted = [...nights].reverse().find((e) => e.checkup)
    const latest = latestCompleted?.checkup ?? null
    const triggerDate = latestCompleted?.date ?? nights[nights.length - 1].date

    // Red status → notify the crew (§3.3).
    if (latest?.status === "RED") {
      alerts.push({
        id: `${astro.id}:RED:${triggerDate}`,
        severity: "RED",
        astronaut_id: astro.id,
        astronaut_name: astro.name,
        date: triggerDate,
        title: "Red status — needs attention",
        message: `${latest.resting_hr} bpm resting HR during sleep — sustained elevated pattern. ${latest.reason ?? ""}`,
        action: "Crew prompt: check in with them today; don't leave the red result to self-manage.",
      })
    }

    // Repeated amber nights (§5: amber escalates on the 2nd consecutive night).
    if (latest?.status === "AMBER" && c.amber_streak >= 2) {
      alerts.push({
        id: `${astro.id}:AMBER:${triggerDate}`,
        severity: "AMBER",
        astronaut_id: astro.id,
        astronaut_name: astro.name,
        date: triggerDate,
        title: `Amber ${c.amber_streak} nights in a row`,
        message: `${latest.resting_hr} bpm resting HR — above the relaxed range ${c.amber_streak} nights running.`,
        action: "Worth mentioning to a crewmate; reduce load and recheck tonight.",
      })
    }

    // Missed checkups (§3.3: missed repeatedly → notify the crew).
    if (c.missed_streak >= 2) {
      const missedUntil = nights[nights.length - 1].date
      alerts.push({
        id: `${astro.id}:MISSED:${missedUntil}`,
        severity: "MISSED",
        astronaut_id: astro.id,
        astronaut_name: astro.name,
        date: missedUntil,
        title: `No checkup for ${c.missed_streak} nights`,
        message: `Sleep checkup missed ${c.missed_streak} nights in a row — sensor may not be worn, charged, or connected.`,
        action: "Confirm the sensor, battery, and BLE connection before bedtime.",
      })
    }
  }

  const severityOrder: Record<CrewAlert["severity"], number> = {
    RED: 0,
    MISSED: 1,
    AMBER: 2,
  }
  return alerts.sort(
    (a, b) =>
      severityOrder[a.severity] - severityOrder[b.severity] ||
      b.date.localeCompare(a.date),
  )
}

export async function listAlerts(): Promise<{ now: string; alerts: CrewAlert[] }> {
  await connection()
  const mode = modeOrDefault(await getMode())
  const s = ensureStore(new Date(), mode)
  const { crew } = await listCrewOverview()
  return { now: s.now.toISOString(), alerts: computeAlerts(crew) }
}

/* ------------------------------------------------------------------ */
/* Mutation — POST /api/v1/checkups                                    */
/* ------------------------------------------------------------------ */

export type InsertResult =
  | { ok: true; checkup: SleepCheckup; alerts_created: CrewAlert[] }
  | { ok: false; error: string }

const HR_KEYS = ["hr_min", "hr_avg", "hr_max", "resting_hr"] as const

/** Older app builds sent the legacy "space_station" id; accept it as an alias. */
const ENVIRONMENT_ALIASES: Record<string, Environment> = {
  space_station: "station",
}

/** Timestamps as ISO strings (canonical) or epoch millis (older app builds). */
function asDate(value: unknown): Date {
  if (typeof value === "number") return new Date(value)
  return new Date(String(value ?? ""))
}

export async function insertCheckup(payload: unknown): Promise<InsertResult> {
  await connection()
  const mode = modeOrDefault(await getMode())
  const s = ensureStore(new Date(), mode)

  if (typeof payload !== "object" || payload === null) {
    return { ok: false, error: "Body must be a JSON object." }
  }
  const body = payload as Record<string, unknown>

  const astronautId = typeof body.astronaut_id === "string" ? body.astronaut_id : null
  if (!astronautId || !s.astronauts.has(astronautId)) {
    if (mode === "live") {
      return {
        ok: false,
        error:
          "Unknown astronaut_id — create the crew profile first (dashboard → Crew profiles, or POST /api/v1/crew) and use its id.",
      }
    }
    return {
      ok: false,
      error: "Unknown astronaut_id (demo crew: astro-001 … astro-006).",
    }
  }
  const astro = s.astronauts.get(astronautId) as Astronaut

  const envRaw = typeof body.environment === "string" ? body.environment : ""
  const environment =
    envRaw in ENVIRONMENT_PROFILES
      ? (envRaw as Environment)
      : (ENVIRONMENT_ALIASES[envRaw] as Environment | undefined) ??
        astro.environment

  const started = asDate(body.started_at)
  const ended = asDate(body.ended_at)
  if (Number.isNaN(started.getTime())) {
    return { ok: false, error: "started_at must be an ISO date-time string." }
  }
  if (Number.isNaN(ended.getTime())) {
    return { ok: false, error: "ended_at must be an ISO date-time string." }
  }
  if (ended.getTime() <= started.getTime()) {
    return { ok: false, error: "ended_at must be after started_at." }
  }

  const numbers: Record<string, number> = {}
  for (const key of HR_KEYS) {
    const value = Number(body[key])
    if (!Number.isFinite(value) || value <= 0 || value > 250) {
      return { ok: false, error: `${key} must be a positive number (bpm).` }
    }
    numbers[key] = Math.round(value)
  }

  // Canonical `reason` (string); older app builds sent a `reasons` array.
  const reasonFromList = Array.isArray(body.reasons)
    ? body.reasons
        .filter((r): r is string => typeof r === "string")
        .join("; ")
        .trim()
    : ""
  const reason =
    typeof body.reason === "string" && body.reason.trim()
      ? body.reason.trim().slice(0, 280)
      : reasonFromList
        ? reasonFromList.slice(0, 280)
        : undefined

  const status = body.status
  if (status !== "GREEN" && status !== "AMBER" && status !== "RED") {
    return { ok: false, error: "status must be one of GREEN, AMBER, RED." }
  }

  if (numbers.hr_min > numbers.hr_avg || numbers.hr_avg > numbers.hr_max) {
    return { ok: false, error: "HR stats must satisfy hr_min ≤ hr_avg ≤ hr_max." }
  }

  const duration = Math.round((ended.getTime() - started.getTime()) / 60_000)
  const samplesCount = Array.isArray(body.samples) ? body.samples.length : undefined

  const date = started.toISOString().slice(0, 10)
  const band = bandOf(s, astronautId)
  const checkup: SleepCheckup = {
    id: checkupId(astronautId, date),
    astronaut_id: astronautId,
    environment,
    started_at: started.toISOString(),
    ended_at: ended.toISOString(),
    duration_minutes: duration,
    hr_min: numbers.hr_min,
    hr_avg: numbers.hr_avg,
    hr_max: numbers.hr_max,
    resting_hr: numbers.resting_hr,
    status,
    reason: reason ?? reasonFor(status, numbers.resting_hr, band, duration, numbers.hr_max),
    samples_count: samplesCount,
    uploaded_at: s.now.toISOString(),
  }

  // Upsert by id (one checkup per astronaut per night).
  put(s, checkup)
  s.uploaded = [...s.uploaded.filter((c) => c.id !== checkup.id), checkup]
  const db = readDb()
  writeDb({
    mode: db.mode,
    crew: db.crew,
    uploaded: s.uploaded,
  })

  const { crew } = await listCrewOverview()
  const overview = crew.find((c) => c.astronaut.id === astronautId)
  const newAlerts = overview ? computeAlertsFor(overview, date) : []

  return { ok: true, checkup, alerts_created: newAlerts }
}

/** Alerts triggered by the freshly-uploaded night. */
function computeAlertsFor(overview: CrewOverview, date: string): CrewAlert[] {
  return computeAlerts([overview]).filter((a) => a.date === date)
}

export async function listUploadedCheckups(limit = 20): Promise<SleepCheckup[]> {
  await connection()
  const mode = modeOrDefault(await getMode())
  const s = ensureStore(new Date(), mode)
  return [...s.uploaded]
    .sort((a, b) => b.uploaded_at.localeCompare(a.uploaded_at))
    .slice(0, Math.min(Math.max(1, limit), 100))
}

/* ------------------------------------------------------------------ */
/* Astronaut profiles (live mode) — create / delete                     */
/* ------------------------------------------------------------------ */

export type CreateAstronautResult =
  | { ok: true; astronaut: Astronaut }
  | { ok: false; error: string }

/** "Sofia Ríos" → "sofia-rios" (id for the app to send as astronaut_id). */
function slugifyName(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
  return slug || "astro"
}

function uniqueId(existing: Set<string>, base: string): string {
  if (!existing.has(base)) return base
  let n = 2
  while (existing.has(`${base}-${n}`)) n++
  return `${base}-${n}`
}

export async function listAstronauts(): Promise<Astronaut[]> {
  await connection()
  const mode = modeOrDefault(await getMode())
  const s = ensureStore(new Date(), mode)
  return [...s.astronauts.values()]
}

export async function createAstronaut(
  payload: unknown,
): Promise<CreateAstronautResult> {
  await connection()
  const mode = modeOrDefault(await getMode())
  if (mode === "demo") {
    return {
      ok: false,
      error:
        "Demo mode uses the fixed sample crew (astro-001 … astro-006). Switch to Live mode to create your own profiles.",
    }
  }
  if (typeof payload !== "object" || payload === null) {
    return { ok: false, error: "Body must be a JSON object." }
  }
  const body = payload as Record<string, unknown>

  const name = typeof body.name === "string" ? body.name.trim() : ""
  if (!name || name.length > 60) {
    return { ok: false, error: "name is required (1–60 characters)." }
  }
  const callsign =
    typeof body.callsign === "string" && body.callsign.trim()
      ? body.callsign.trim().slice(0, 20)
      : name.split(/\s+/)[0].slice(0, 20)
  const role =
    typeof body.role === "string" && body.role.trim()
      ? body.role.trim().slice(0, 40)
      : "Mission Specialist"
  const envRaw = typeof body.environment === "string" ? body.environment : ""
  if (!(envRaw in ENVIRONMENT_PROFILES)) {
    return {
      ok: false,
      error: "environment must be one of spacecraft, station, rover, planetary_base.",
    }
  }
  const environment = envRaw as Environment

  const db = readDb()
  const taken = new Set(db.crew.map((a) => a.id))
  const astronaut: Astronaut = {
    id: uniqueId(taken, slugifyName(name)),
    name,
    callsign,
    role,
    environment,
  }
  writeDb({ mode: db.mode, crew: [...db.crew, astronaut], uploaded: db.uploaded })
  store = null
  return { ok: true, astronaut }
}

export type DeleteAstronautResult =
  | { ok: true; id: string }
  | { ok: false; error: string }

export async function deleteAstronaut(id: string): Promise<DeleteAstronautResult> {
  await connection()
  const mode = modeOrDefault(await getMode())
  if (mode === "demo") {
    return {
      ok: false,
      error: "The demo crew is fixed. Switch to Live mode to manage profiles.",
    }
  }
  const db = readDb()
  const crew = db.crew.filter((a) => a.id !== id)
  if (crew.length === db.crew.length) {
    return { ok: false, error: `No profile "${id}" in the live crew.` }
  }
  // Drop their uploads too — a deleted profile keeps no history behind.
  const uploaded = db.uploaded.filter((c) => c.astronaut_id !== id)
  writeDb({ mode: db.mode, crew, uploaded })
  store = null
  return { ok: true, id }
}
