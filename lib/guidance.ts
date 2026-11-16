import type { Environment, NightStatus } from "@/lib/types"

/**
 * Environment profiles (PROJECT.md §7) — expected relaxed-HR band offsets,
 * checkup-window notes, and the tip set shown alongside results.
 */
export interface EnvironmentProfile {
  label: string
  short: string
  /** bpm added to the personal relaxed band in this environment. */
  band_offset: number
  note: string
  tips: string[]
}

export const ENVIRONMENT_PROFILES: Record<Environment, EnvironmentProfile> = {
  spacecraft: {
    label: "Spacecraft (microgravity)",
    short: "Spacecraft",
    band_offset: 3,
    note: "Fluid shift and sleep disruption in microgravity nudge the relaxed band slightly upward.",
    tips: [
      "Sleep-shift constraints: your checkup window follows the crew sleep-shift schedule.",
      "Use the noise-reduction kit before lights-out.",
    ],
  },
  station: {
    label: "Space Station (microgravity)",
    short: "Station",
    band_offset: 4,
    note: "Microgravity fluid shift and station noise raise the expected relaxed band.",
    tips: [
      "Checkup window is aligned to the crew's sleep-shift schedule.",
      "Ear plugs + eye mask reduce station noise and light cycle disruption.",
    ],
  },
  rover: {
    label: "Rover (tight quarters)",
    short: "Rover",
    band_offset: 1,
    note: "Tighter quarters and irregular schedules shorten the checkup window.",
    tips: [
      "Keep the cabin temperature steady before your sleep period.",
      "Vibration during drive segments can raise HR — log drive nights as such.",
    ],
  },
  planetary_base: {
    label: "Planetary Base (Moon / Mars)",
    short: "Planetary base",
    band_offset: 0,
    note: "Gravity and a sol-day rhythm apply; on Mars the 24 h 39 m sol causes schedule drift.",
    tips: [
      "Anchor your sleep period to the habitat lighting cycle.",
      "On Mars, let the schedule drift with the sol — the checkup window follows it.",
    ],
  },
}

/**
 * Status color coding + matched recommendations (PROJECT.md §5).
 * Every color-coded result shows *why* (reason) and *what to do next* (action).
 */
export interface StatusMeta {
  label: string
  meaning: string
  action: string
  dot: string
  badge: string
  text: string
  bar: string
}

export const STATUS_META: Record<NightStatus, StatusMeta> = {
  GREEN: {
    label: "Rested",
    meaning:
      "You rested well; your body shows no stress signs — HR stayed within your relaxed range.",
    action:
      "Keep doing what works. Keep your current lights-out time and pre-sleep routine.",
    dot: "bg-emerald-500",
    badge:
      "bg-emerald-500/10 text-emerald-500 border-emerald-500/25 dark:text-emerald-400",
    text: "text-emerald-600 dark:text-emerald-400",
    bar: "bg-emerald-500",
  },
  AMBER: {
    label: "Not fully rested",
    meaning:
      "Sleep HR was higher than your relaxed range for part of the night — possible stress, heat, discomfort, or a short night.",
    action:
      "Reduce load and recheck: wind down before your next sleep period, review your sleep environment (temperature, noise, comfort), and recheck tomorrow. If amber repeats 2+ nights, mention it to a crewmate.",
    dot: "bg-amber-500",
    badge:
      "bg-amber-500/10 text-amber-600 border-amber-500/25 dark:text-amber-400",
    text: "text-amber-600 dark:text-amber-400",
    bar: "bg-amber-500",
  },
  RED: {
    label: "Too stressed — needs attention",
    meaning:
      "Sustained elevated HR or an unusual pattern; the crew has been notified.",
    action:
      "Don't manage it alone: speak with a crewmate (or ground medical when available). Your next-day workload will be lightened. Follow up with a recheck next sleep period.",
    dot: "bg-red-500",
    badge: "bg-red-500/10 text-red-600 border-red-500/25 dark:text-red-400",
    text: "text-red-600 dark:text-red-400",
    bar: "bg-red-500",
  },
  GRAY: {
    label: "Missed / no data",
    meaning:
      "No checkup completed for the night — sensor not worn, dead battery, or app closed.",
    action:
      "Get back on routine: put the sensor on before bedtime, confirm the BLE connection and charge, and complete a make-up checkup at the next opportunity.",
    dot: "bg-zinc-400 dark:bg-zinc-500",
    badge: "bg-muted text-muted-foreground border-border",
    text: "text-muted-foreground",
    bar: "bg-zinc-400 dark:bg-zinc-600",
  },
}

/** Escalated wording for the 2nd consecutive amber night (§5 recommendation rules). */
export const AMBER_ESCALATED_ACTION =
  "Two nights in a row above your relaxed range — worth mentioning to the crew tonight. Wind down before your next sleep period and recheck tomorrow."

export const RESTING_HR_EXPLAINER =
  "Resting HR is the low tail of your heart rate during sleep (about the 20th percentile of the night). It is the simplest proxy for how relaxed your body actually was while you slept: the lower and steadier it sits inside your personal relaxed band, the more you truly rested."

/* ------------------------------------------------------------------ */
/* Private journal (PROJECT.md §14)                                    */
/* ------------------------------------------------------------------ */

/**
 * NASA Human Research Program identifies isolation and confinement as a
 * behavioral-health hazard. Journaling is a private reflection tool, never a
 * crew metric: entries stay on the astronaut's device and are excluded from
 * checkups, alerts, insights and reports.
 */
export const NASA_ISOLATION_URL =
  "https://www.nasa.gov/hrp/hazard-isolation-and-confinement/"

export const NASA_ISOLATION_QUOTE =
  "Journaling will always play an important role in any journey. It’s an invaluable tool behavioral scientists use to assess the mental and emotional states associated with life in long-term isolation and confinement."

export const JOURNAL_PROMPTS = [
  "What stood out today?",
  "What helped you feel connected to people back home?",
  "What felt hardest about the close quarters today?",
  "What is one small thing that made today easier?",
  "How did your mood and energy change through the day?",
  "What would you like to remember from this mission?",
]

export const JOURNAL_PRIVACY_NOTE =
  "Entries are kept in this browser, for this astronaut, on this device only. They are not encrypted, not sent to the crew server and not shown on the shared crew dashboard. They are never included in checkup status, alerts, insights or reports. Clearing site data removes them. There is no share button."

