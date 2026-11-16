/**
 * Shared data model — mirrors the SleepCheckup draft in PROJECT.md §4.
 *
 * The Android app computes status/stats from the raw BPM stream; this server
 * stores and surfaces what the app uploads.
 */

export type Environment = "spacecraft" | "station" | "rover" | "planetary_base"

/**
 * Server mode, chosen on first launch (PROJECT.md §2):
 * - "demo": seeded sample crew + simulated data, fixed astronaut ids astro-001…astro-006.
 * - "live": real deployment — astronaut profiles are created by the crew
 *   (dashboard UI or POST /api/v1/crew from the Android app) and the seeded
 *   dataset is hidden.
 */
export type AppMode = "demo" | "live"

/** Status uploaded by the app (computed from the raw BPM stream). */
export type CheckupStatus = "GREEN" | "AMBER" | "RED"

/** Display status: GRAY means "missed / no data" for a night (never uploaded). */
export type NightStatus = CheckupStatus | "GRAY"

export interface Astronaut {
  id: string
  name: string
  callsign: string
  role: string
  environment: Environment
}

export interface SleepCheckup {
  id: string
  astronaut_id: string
  environment: Environment
  started_at: string
  ended_at: string
  duration_minutes: number
  hr_min: number
  hr_avg: number
  hr_max: number
  resting_hr: number
  status: CheckupStatus
  /** Plain-language explanation of *why* the status was assigned (§6). */
  reason?: string
  /** Count of raw samples received with the upload (samples are optional). */
  samples_count?: number
  uploaded_at: string
}

export interface CrewAlert {
  id: string
  severity: "RED" | "AMBER" | "MISSED"
  astronaut_id: string
  astronaut_name: string
  /** Night (YYYY-MM-DD) that triggered the alert. */
  date: string
  title: string
  message: string
  action: string
}

/** One night in the 30-night window; `checkup` is null for missed nights. */
export interface NightEntry {
  date: string
  label: string
  checkup: SleepCheckup | null
}

export interface CrewOverview {
  now: string
  astronaut: Astronaut
  /** Nights, oldest → newest (the newest is "last night"). */
  nights: NightEntry[]
  /** Most recent completed checkup. */
  latest: SleepCheckup | null
  /** Consecutive completed nights ending at the most recent completed night. */
  streak: number
  /** Consecutive missed nights ending at last night. */
  missed_streak: number
  /** Consecutive amber nights ending at the most recent completed night. */
  amber_streak: number
  /** % of past 30 nights with a completed checkup. */
  compliance_pct: number
  avg_resting_7d: number | null
  /** Personal relaxed band (incl. environment offset) for the charts. */
  band: [number, number]
}

export interface MissionDashboard {
  now: string
  mode: AppMode
  crew: CrewOverview[]
  alerts: CrewAlert[]
  counts: {
    green: number
    amber: number
    red: number
    missed_last_night: number
  }
  avg_compliance_pct: number
}
