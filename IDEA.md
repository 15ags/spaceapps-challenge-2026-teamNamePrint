# The Idea — Astronaut Sleep HR & Stress Monitor

> Working name: **AstroRest** (placeholder). Team "(print)".
> One sentence: a nightly sleep checkup that tells astronauts whether they truly
> rested, warns the crew when someone is too stressed, and does it without
> turning private feelings into crew data.

This document explains the concept and how the three parts work together. It
deliberately stays away from code-level detail; the technical specification is
in `PROJECT.md`.

---

## 1. The problem

Astronauts work long shifts in loud, confined, high-consequence environments.
Poor sleep and mounting stress are easy to miss from the inside — you feel
tired, but you cannot tell whether your body actually recovered last night or
whether it is running on stress. By the time performance suffers, the problem
is already old.

There is no simple, routine way to answer: *"Did I actually rest, or is my body
under pressure?"* And if one crew member is struggling, the rest of the crew
may not notice until something goes wrong.

The available signals are also poor fits:

- A single heart-rate number means nothing without context: 58 bpm can be
  perfectly relaxed for one person and elevated for another.
- Clinical sleep studies are heavy, episodic and not part of a daily routine.
- Constant monitoring feels surveillance-like and can discourage honesty,
  especially about stress.

## 2. The idea in plain language

Treat sleep like a **routine checkup, not a medical exam**.

Every night the astronaut wears a small heart-rate sensor. While they sleep,
the sensor streams their heart rate to the phone. In the morning the app turns
that stream into one simple verdict:

- 🟢 **Green — you rested.**
- 🟡 **Amber — not fully rested; something kept your body working.**
- 🔴 **Red — too stressed; you should not handle this alone.**
- ⚪ **Gray — no checkup; get back on routine.**

Each verdict comes with one matched piece of advice, not a number to interpret:
keep the routine, wind down and recheck, talk to a crewmate or ground medical,
or put the sensor back on tonight.

The individual sees their own detail and history. The crew sees a shared
dashboard: who rested, who is at risk, who has missed checkups. And because
isolation is its own hazard, the astronaut also gets a **private journal** that
is never uploaded, never scored, and never shown to the crew.

The guiding principle: **the astronaut should never have to interpret a chart
or decide alone what a bad night means.**

## 3. What a night looks like

| When | What happens |
|------|--------------|
| Evening | The app sends the routine prompt: "Time for your nightly sleep checkup — put on the sensor." If battery is low or the sensor is not connected, it says so before bedtime. |
| Bedtime | The astronaut puts on the sensor; the app records the heart-rate stream for the night. No interaction is needed while sleeping. |
| During sleep | The phone keeps recording in the background, even if the app is closed. A partially recorded session is preserved if the process is killed. |
| Morning | The app finishes the session automatically at the end of the checkup window, computes the night, and posts a notification with the color and its advice. |
| Later | The astronaut can open the result, read *why* it was green/amber/red, see the night's heart-rate curve, and look at trends over 7 or 30 days. |
| Whenever | The checkup summary is queued and uploaded to the crew dashboard when connectivity allows — important where communication windows are limited. |
| If a night is missed | Reminders escalate (+1 h, +2 h, once more before morning); the night is recorded as gray, not silently green. |

## 4. The four colors, and why colors at all

Numbers require expertise and attention. Colors communicate at a glance, which
is exactly what a tired astronaut and a busy crew need.

| Color | Plain meaning | Matched advice |
|-------|---------------|----------------|
| 🟢 **Green — Rested** | Heart rate stayed inside the relaxed range expected for this person in this environment. | **Keep doing what works.** No action; keep the same lights-out time and pre-sleep routine. |
| 🟡 **Amber — Not fully rested** | Heart rate ran above the relaxed range for part of the night, or the night was short. Possible stress, heat, noise, discomfort. | **Reduce load and recheck.** Wind down, review temperature/noise/comfort, recheck tomorrow. If it repeats, mention it to a crewmate. Wording becomes firmer on consecutive amber nights. |
| 🔴 **Red — Too stressed** | Clearly elevated heart rate for most of the night, or several amber nights in a row. | **Don't manage it alone.** Talk to a crewmate or ground medical; lighten tomorrow's load; the crew dashboard has already raised the alert. |
| ⚪ **Gray — Missed** | No usable checkup for the night: sensor not worn, battery dead, app closed. | **Get back on routine.** Put the sensor on before bedtime, confirm connection and charge, do a make-up checkup. |

Two details make this more than a traffic light:

1. **The advice is matched to the diagnosis.** Green reinforces the routine,
   amber gives concrete self-correction steps, red always includes a human
   contact step, gray repairs the routine. Nobody gets a generic "take it easy".
2. **Colors escalate.** Repeated amber nights become red, because a pattern
   matters more than one bad night.

## 5. How the judgement is made (without the math)

The app does not compare every astronaut against one fixed number. That would
misfire: resting heart rate varies by person, by fitness, and by environment.

Instead each astronaut gets a **personal relaxed band**, learned from their own
first nights:

- **Calibration first.** The first three checkups use a sensible default range
  for the chosen environment, and the app says so ("learning your normal").
- **Then personal.** After that, the band is built from the median resting
  heart rate of recent non-red nights, with a small margin around it.
- **Resting HR is the low tail of the night**, around the 20th percentile —
  a robust summary of how relaxed the body actually was, less sensitive to a
  single odd reading.
- **Two things count as stress:** resting heart rate above the band, or a
  meaningful share of the night spent above it. A short night also counts as
  amber, because insufficient rest is itself a signal.
- **Sustained and repeated patterns dominate.** Clearly above the band for most
  of the night — or three amber nights in a row — becomes red.
- **No usable data is gray, never green.** The system refuses to call a night
  "rested" when it did not actually measure it.

The environment shifts the expected band. Microgravity pushes resting heart
rate up a little (fluid shift, station noise, sleep-shift schedules); a
planetary base settles lower; a rover has tighter quarters and shorter
windows; a Mars base has to cope with a 24 h 39 m sol. The astronaut picks the
environment, and the same raw data is interpreted with that context — switching
never rewrites history.

## 6. The three pieces of the system

```
 ┌────────────────────┐     Bluetooth      ┌────────────────────┐     network      ┌────────────────────┐
 │ 1. SENSOR NODE     │ ─────────────────▶ │ 2. ANDROID APP     │ ───────────────▶ │ 3. CREW DASHBOARD  │
 │ worn during sleep │   live heart rate  │ the astronaut's    │  one summary     │ the crew's shared  │
 │                    │                    │ brain & diary      │  per checkup     │ view & alert board │
 └────────────────────┘                    └────────────────────┘                  └────────────────────┘
```

### 1. The sensor node — measure quietly, send simply

A small, low-power board (Seeed XIAO nRF52840) with an analog pulse sensor,
small enough to wear through a night on a single charge.

It does one job: detect heartbeats and broadcast the current beats-per-minute
over standard Bluetooth, along with battery level and a start/stop control for
a session. It drops obviously invalid readings caused by motion or poor skin
contact before sending them. It stores nothing and knows nothing about stress —
keeping the wearable cheap, dumb and replaceable.

### 2. The Android app — the brain and the private space

This is where the night becomes meaning.

- **Records** the heart-rate stream for the night, reliably, in the background.
- **Computes** the checkup: resting heart rate, min/average/max, duration,
  how much of the night was elevated.
- **Classifies** the night using the personal band, environment context and
  recent history, and produces the color, the reasons and the matched advice.
- **Reminds** about the nightly routine, escalates when a checkup is missed,
  warns about low battery or a missing sensor, and reports the morning result.
- **Explains** every result: what resting HR means, why this color, what to do
  next, how to wear the sensor, and what is different in each environment.
- **Shows history**: the required last five checkups plus charts of resting HR,
  sleep duration and routine compliance over 7 or 30 days.
- **Queues uploads** so checkups survive patchy connectivity.
- **Keeps a private journal** with low-pressure prompts about isolation and
  confinement. It is stored only on the phone, excluded from cloud backup and
  device transfer, and is never read by the checkup, alert or sync code.

The app can also run with a **simulated sensor**, producing realistic calm,
elevated and stressed nights. That makes the entire system demonstrable with no
hardware at all — useful for judges, crew training and testing.

### 3. The crew dashboard — the shared safety net

A web dashboard that collects the summaries and answers one question: *does
anyone need attention right now?*

- Crew list with each person's latest color, resting HR and last checkup.
- A prominent alert feed for red statuses and repeatedly missed checkups.
- Per-astronaut detail with trends over time.
- Environment context and tips alongside the numbers.
- Two modes: **demo** (a seeded six-person crew with thirty nights of realistic
  history) and **live** (starts empty; the crew creates real astronaut
  profiles, and the app uploads against them).
- A secondary, browser-local private journal per astronaut — the honest demo
  version of "private means private", since the shared dashboard has no login.

The dashboard never computes the diagnosis. It displays and alerts on the
summary the app produced.

## 7. Design decisions worth knowing

- **The phone decides; the sensor and server stay simple.** Keeping the
  interpretation on the device makes the wearable cheap, lets it work offline,
  and avoids sending raw physiology anywhere by default.
- **Summary first, raw samples optional.** By default only the checkup summary
  travels; raw heart-rate series can be enabled when there is a reason. Less
  data, less bandwidth, less exposure.
- **Routine instead of gamification.** The challenge allows points and badges;
  we deliberately excluded them. The engagement mechanism is a dependable
  nightly routine, a clear morning answer and advice that respects the
  astronaut as an adult.
- **Privacy is structural, not a promise.** The journal is a separate store
  that the rest of the system cannot read. The crew sees status and aggregates;
  detailed physiology stays with the individual. Health data is shared by
  consent, not by default.
- **The system is honest about uncertainty.** Calibration is visible. Missing
  data is gray. The app never claims a diagnosis and never says "you are fine"
  when it did not measure anything.
- **Built for constrained operations.** Checkups queue offline and sync when a
  communication window opens; reminders survive reboots; a killed app does not
  lose the night.

## 8. What is actually built today

The three repositories are one system, split by where the work happens:

| Repository | Role | Current state |
|------------|------|---------------|
| `~/Arduino/spaceapps-2026` | Sensor firmware | Working Phase 0 node: samples the pulse sensor, detects beats, streams over standard Bluetooth with battery and session control, filters invalid readings. |
| `~/AndroidStudioProjects/SpaceAppsChallenge2026teamNameprintandroidapp` | Astronaut app | Working app: transfer, nightly recording, checkup engine, personal baseline, environment profiles, reminders and escalation, last-five summary, charts, guidance, private journal, offline upload queue, simulated sensor. |
| `~/code/nextjs/sppaceapps-challenge-2026` | Crew dashboard | Working dashboard: crew overview, alerts, per-astronaut trends, upload API, demo and live modes, browser-local private journal. |

All three carry the same `PROJECT.md`, which is the shared specification and
the source of truth for both repositories' behavior.

**Still open (honest list):** a comfortable, secure wearable form factor and
battery life validation; real-world calibration of thresholds and the sensor
signal during sleep; deciding the alert channel beyond the dashboard banner;
and server hosting policy for on-board versus ground operations.

## 9. What this is not

- **Not a medical device.** It is a wellness and situational-awareness tool.
  It does not diagnose sleep disorders or heart conditions; it flags patterns
  worth a conversation.
- **Not surveillance.** There is no live audio or video, no continuous crew
  tracking, and no shared view of private journal text.
- **Not a scoreboard.** There are no points, badges or leaderboards. A bad
  night is information, not a penalty.

## 10. Why it matters

Long-duration spaceflight is limited less by hardware than by people. Sleep and
stress are among the quietest failure modes: they degrade judgment, teamwork
and health long before they become obvious. A nightly checkup that is simple
enough to keep doing, clear enough to act on, and private enough to be honest
with gives a crew an early, humane warning system — and gives each astronaut a
better answer to "how am I actually doing?" than a number on a screen.
