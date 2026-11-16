# Astronaut Sleep HR & Stress Monitor

> **Working name:** TBD (placeholder — team "(print)")
> **One-liner:** A sleep-time heart-rate system that tells astronauts whether they are truly resting, warns them when they are too stressed, and keeps the crew informed.

---

## 1. Overview

### Problem
Astronauts work in environments where poor sleep and elevated stress are easy to miss and hard to self-assess. There is no simple, routine way to know *"did I actually rest last night, or is my body stressed?"* — and if someone is struggling, the crew may not notice until performance suffers.

### Goal
A 3-part system that:

1. Measures heart rate **during sleep** using a small BLE wearable.
2. Turns the raw BPM stream into an easy-to-understand **sleep checkup** (resting HR, restfulness, stress status) in a mobile app.
3. Shares results with a **crew web dashboard**, which alerts the crew when someone needs attention.

### What the tool does NOT claim
- It is a **wellness / situational-awareness tool**, not a medical diagnostic device.
- It does not diagnose sleep disorders or cardiac conditions; it flags patterns worth attention.
- **Gamification is explicitly out of scope** (see §10).

---

## 2. System Architecture

```
┌─────────────────────┐        BLE (GATT)       ┌─────────────────────┐       HTTPS / REST      ┌─────────────────────┐
│  1. SENSOR NODE     │ ───────────────────────▶ │  2. ANDROID APP     │ ──────────────────────▶ │  3. WEB SERVER      │
│  Seeed XIAO nRF52840│   live BPM stream        │  (this repository)  │   checkup summaries     │  crew dashboard     │
│  + heart-rate sensor│                          │                     │   + optional raw data   │  + crew alerts      │
└─────────────────────┘                          └─────────────────────┘                         └─────────────────────┘
```

| # | Part | Responsibility | Technology |
|---|------|----------------|------------|
| 1 | **Sensor node** | Wear HR sensor during sleep; stream raw BPM over BLE | Seeed Studio XIAO nRF52840 (BLE built-in) + HR sensor (PPG, e.g. MAX30102-class) |
| 2 | **Android app** | Receive raw BPM → compute sleep checkup; store history; prompt & remind; explain results; show charts; upload to server | Kotlin (Android Studio) |
| 3 | **Web server** | Store checkups from all crew; display dashboard; alert the crew about problems | REST API + dashboard (stack TBD) |

**Data flow:** Sensor → App happens continuously during a sleep session. App → Server happens once per completed checkup (summary upload; raw samples optional).

---

## 3. Component Details

### 3.1 Part 1 — Sensor Node (firmware)

**Hardware**
- MCU: Seeed Studio XIAO nRF52840 (nRF52840, low-power BLE, small footprint — comfortable for sleep wear).
- Heart-rate monitor: **PulseSensor SEN-11574 (analog PPG, pulsesensor.com) on A0** — decided for Phase 0 (no I²C; a MAX30102-class part remains a future option, §12).
- Battery: small LiPo; firmware optimizes for a full night on one charge.

**Firmware responsibilities**
- Read BPM from the HR sensor at a steady sample rate.
- Expose a simple BLE GATT service, e.g.:
  - `BPM` characteristic (read/notify) — current beats per minute.
  - `Session control` characteristic (write) — app can start/stop a checkup session.
  - `Battery` characteristic — app can warn before bedtime if charge is low.
- Stay in a low-power sleep state between sample reads.
- Optional on-node sanity check: drop obviously invalid readings (motion noise) before sending.

### 3.2 Part 2 — Android App

**Core pipeline (as you described, kept simple):**
1. Receive **raw BPM** stream over BLE.
2. Convert the stream into a **sleep checkup** (see §5 data model).
3. Classify the result with **color-coded status** (§6).
4. Persist locally; upload to the web server.

**Screens (proposed)**
| Screen | Purpose |
|--------|---------|
| **Home / Tonight** | Current state: sensor connected? checkup scheduled? big color-coded status of the last result + one-line guidance ("Your resting HR was in the normal relaxed range"). |
| **Live session** | Real-time BPM during an active sleep checkup, connection status, battery. |
| **Summary (last 5 checkups)** | Required feature: list of the **last 5 sleep checkups** with date, duration, resting HR, and color-coded stress status; tap for detail. |
| **History & charts** | **Dynamic charts** of health indicators over time (resting HR trend, checkup compliance, sleep duration). Adjustable range (7d / 30d). |
| **Learn / Guidance** | Simple explanations: what resting HR means, what "too stressed" looks like, how to wear the sensor, what each status color means, what to do when a result is amber/red. |
| **Environment selector** | Spacecraft / space station / rover / planetary base — adjusts expected ranges and tips (§7). |
| **Private journal** | Private, on-device reflection with isolation-specific writing prompts, autosave, word count, title search, date filter and an optional local link to a sleep checkup. Never uploaded or shown to the crew (§14). |
| **Settings** | Astronaut name/ID, checkup schedule (routine time), server endpoint, alert preferences. |

**Notifications (routine prompts + missed-checkup escalation)**
1. **Pre-checkup reminder** — a routine prompt at the scheduled time ("It's time for your nightly sleep checkup — put on the sensor"). This doubles as the mission-routine prompt required by the recommendations.
2. **Missed checkup escalation** — if no checkup is completed by N hours after the scheduled time, repeat reminders at increasing intervals (e.g., +1h, +2h, then once more before "morning").
3. **Low battery / sensor not connected** — prompt before bedtime so the checkup isn't lost.
4. **Result notice** — after a checkup completes, a brief notification with the color-coded outcome **and its matched recommendation** (e.g., "Amber — wind down tonight and recheck tomorrow"; "Red — talk to someone, don't manage it alone").

### 3.3 Part 3 — Web Server (crew dashboard)

**Responsibilities**
- Ingest checkups from every crew member's app (REST API).
- Show a dashboard: crew list with latest status (color-coded), latest resting HR, last checkup time, compliance streak.
- Per-astro detail page with **charts over time** (7/30-day resting HR trend, checkup history).
- Provide a secondary **browser-local private journal** per astronaut (§14) — written and stored only in that browser, never server-persisted and never shown on the shared dashboard.
- **Crew alerting**: when someone's status is **Red**, or a checkup has been **missed repeatedly**, notify the crew (dashboard alert banner + push/email — channel TBD).

**API sketch**
```
POST /api/v1/checkups            # app uploads one completed sleep checkup
GET  /api/v1/crew/{id}/checkups  # list (app summary screen + dashboard reuse)
GET  /api/v1/crew/{id}/summary   # aggregated stats for charts
GET  /api/v1/alerts              # crew alert feed
```

---

## 4. Data Model (working draft)

```text
SleepCheckup
  id, astronaut_id, environment
  started_at, ended_at, duration_minutes
  hr_min, hr_avg, hr_max            # summary stats from the BPM stream
  resting_hr                        # e.g. 20th-percentile nighttime HR
  status                            # GREEN | AMBER | RED (computed in app)
  samples[]                         # optional raw stream: [{t, bpm}]
  uploaded_at
```

- The **app computes** status/stats from raw BPM so the sensor stays dumb and cheap.
- Raw samples are stored locally first; upload is summary-first (raw optional, e.g. toggled for trend review or research).

---

## 5. Interpretation Logic & Color Coding

Color coding is required by the recommendations: the astronaut should read the status **at a glance**, without interpreting numbers themselves.

| Color | Meaning (plain language) | Typical signal | Recommended action (shown with the result) |
|-------|--------------------------|----------------|--------------------------------------------|
| 🟢 **Green — Rested** | You rested well; body shows no stress signs | HR within the relaxed range expected for you + your environment | **Keep doing what works** — no action needed. App may suggest keeping the same lights-out time and pre-sleep routine. |
| 🟡 **Amber — Not fully rested / elevated** | Sleep HR was higher than your relaxed range — possible stress, heat, discomfort, or a short night | HR above expected range for part of the night | **Reduce load and recheck** — wind down before the next sleep period, review sleep environment (temperature, noise, comfort), and recheck tomorrow. If amber repeats 2+ nights, mention it to a crewmate. |
| 🔴 **Red — Too stressed / needs attention** | Sustained elevated HR or unusual pattern; crew is notified | HR clearly above range for most of the night, or repeated amber nights | **Don't manage it alone** — the app prompts you to **speak with someone** (a crewmate, or ground medical when available), lightens the next-day workload suggestion, and the crew dashboard already raises the alert. Follow up with a recheck next sleep period. |
| ⚪ **Gray — Missed / no data** | No checkup completed for the night | Sensor not worn, dead battery, or app closed | **Get back on routine** — put the sensor on before bedtime, confirm the BLE connection and charge, and complete a make-up checkup at the next opportunity. |

**Recommendation rules (how the app picks the advice):**
- Recommendations are **matched to the diagnosis**, not generic: green → reinforce routine; amber → self-correction steps; red → reach out to people (crew/medical) plus workload relief; gray → recover the routine.
- Advice is shown **on the result itself** (Home one-liner, Summary detail, result notification) so no one has to interpret a number or decide alone what to do.
- Amber advice escalates: the same amber advice is worded more firmly on consecutive amber nights ("two nights in a row — worth mentioning to the crew").
- Red advice always includes a **human-contact step** ("talk to X"); the app never suggests self-managing a red result in isolation.

- Thresholds are **personalized**: the app builds a rolling personal baseline (first days = calibration mode, shown as "learning your normal").
- Both directions you care about are covered: *"not stressed"* (Green means genuinely relaxed) and *"not too stressed"* (Amber/Red flags the opposite).

---

## 6. Guidance & Education (do not assume the astronaut knows)

The recommendations require simple instructions and explanations. Baked into the app:

- **Wearing instructions** — short, illustrated steps to position the sensor for sleep.
- **"What is resting HR?"** — one-paragraph explanation on the summary screen, expandable.
- **"Why this matters"** — short explanations per indicator (resting HR, sleep duration, consecutive amber days) and their risks.
- **Status explainers** — every color-coded result shows *why* ("Your sleep HR stayed 8 bpm above your usual range for 4 hours").
- **What to do next** — every color-coded result ships with a **matched recommendation** (§5): keep-the-routine for green, self-correction steps for amber, "speak with someone / don't manage it alone" for red, and get-back-on-routine steps for gray.
- **Environment context** — why expected HR differs in microgravity vs. a lunar base (see §7).

---

## 7. Environment Profiles (insights per environment)

The tool adapts insights and routine prompts to the environment, as the recommendations suggest:

| Environment | Adjustments |
|-------------|-------------|
| **Spacecraft / Space station (microgravity)** | Expected relaxed HR band adjusted upward (fluid shift & sleep disruption in microgravity); tip set covers sleep-shift constraints and noise; checkup window aligned to the crew's sleep-shift schedule. |
| **Rover** | Tighter quarters and irregular schedules → shorter checkup window, emphasis on missed-checkup reminders; tips cover cabin temperature and vibration. |
| **Planetary base (Moon / Mars)** | Gravity + sol-day rhythm adjustments (Mars day ≈ 24h39m) → schedule drift handling; tips cover habitat conditions and schedule adaptation. |

Implementation: an environment enum on each checkup + a per-environment config (expected HR band offset, schedule rules, tip set). Switching environment re-labels history **with context**, never retroactively changes raw data.

---

## 8. Compliance Matrix — Challenge Recommendations

| Recommendation | How the design complies |
|---|---|
| Health insights for different environments (spacecraft, station, rover, planetary base) | §7 environment profiles adjust ranges, schedules, and tips. |
| Prompt measurements / routine actions | Nightly checkup is the mission routine; app sends scheduled reminders + missed-checkup escalations (§3.2). |
| Gamification | **Excluded by decision** — see §10. |
| Dynamic charts of health indicators over time | App History & charts screen + server dashboard charts (resting HR trend, compliance, sleep duration) (§3.2, §3.3). |
| Color coding for at-a-glance interpretation | §5 status system (🟢🟡🔴⚪) used consistently on Home, Summary, and server dashboard. |
| Simple instructions & explanations (no assumed expertise) | §6 Learn/Guidance layer: wearing steps, indicator explainers, status reasons, next actions. |
| Recommendations matched to the diagnosis | §5 per-status recommended actions (green → keep routine, amber → self-correct & recheck, red → speak with someone + crew alert, gray → recover routine), shown on the result itself. |
| Behavioral-health support for isolation & confinement | Private journal with NASA HRP context and isolation-specific prompts (§14); never scored, shared or mixed with checkup data. |

---

## 9. Roadmap (build order)

1. **Phase 0 — Sensor node bring-up** — XIAO nRF52840 + HR sensor streams live BPM over BLE to a test client.
2. **Phase 1 — App core** — BLE client, nightly session recording, local checkup computation, Summary screen (last 5) with color statuses.
3. **Phase 2 — Routine & charts** — scheduled reminders, missed-checkup escalation, dynamic charts, Learn/Guidance content, environment selector.
4. **Phase 3 — Server & crew alerts** — REST API, dashboard, Red-status and missed-checkup crew alerting.
5. **Phase 4 — Personalization** — rolling personal baseline, calibration mode, threshold tuning per environment.

---

## 10. Explicitly Out of Scope

- **Gamification** (points, badges, streaks-as-game) — excluded by team decision, even though the challenge lists it as an optional feature. The engagement strategy is **routine prompts + clear feedback** instead.
- Medical diagnosis / clinical sleep-study features (sleep apnea staging, EEG, etc.).
- Live video/audio monitoring.

---

## 11. Assumptions

- One wearable per astronaut; the phone is on/near the sleeping area during checkups (BLE range).
- The web server accepts uploads when connectivity is available; the app queues checkups offline and syncs later (comm windows).
- Health data shown to the whole crew is acceptable **by consent** — see open question on privacy.
- Journal text is private to the astronaut: it stays on the astronaut's device/browser, is never uploaded, and never affects checkups, alerts, insights or reports (§14).

---

## 12. Open Questions / Decisions Needed

1. **HR sensor choice** — *resolved for Phase 0: analog PulseSensor SEN-11574 on A0* (dependency-free PulseSensorPlayground port; analog PPG kept). Revisit finger PPG (MAX30102-class) vs. chest strap vs. ear-clip only if comfort during sleep in microgravity demands it.
2. **Battery & wearability** — strap/wrap form factor, one full night per charge target.
3. **Privacy to the crew** — does the dashboard show only color status, or full HR numbers? Propose: status + aggregates public to crew, detailed HR visible to the individual (and crew on Red alerts).
4. **Server hosting** — on-board (local network, no comm dependency) vs. ground (long-term records) vs. both with sync.
5. **Alert thresholds** — fixed defaults vs. fully personal baseline; how many amber days escalate to red.
6. **App name / branding** — current strings.xml label is a placeholder.

---

## 13. Demo & Live modes (first-launch choice)

Both the Android app and the crew web server run in one of two modes, chosen
once on first launch (and switchable later):

| Mode | Web dashboard | Android app |
|------|---------------|-------------|
| **Demo** | Seeded sample crew (`astro-001` … `astro-006`) with 30 nights of simulated data; uploads for demo ids still accepted. Sidebar switch. | Built-in **fake sensor** (`SimulatedHeartRateRepository`) drives the full pipeline — sessions, checkups, history, charts. No hardware or server needed. |
| **Live** | Starts empty. Astronaut profiles are **created by the crew** (Crew profiles page, or `POST /api/v1/crew` from the app); only real uploads are shown. | Real XIAO sensor over BLE; the astronaut profile is created on first launch (name + environment + server URL, optionally registered on the server) or later from Settings. |

- **First launch:** the web shows `/welcome` until a mode is stored in
  `data/db.json` (`mode`); the app shows the onboarding screen until
  `settings.onboarded` is set.
- **Mode persistence (web):** `GET/POST /api/v1/mode`; `mode` and live-mode
  `crew` profiles are persisted to `data/db.json` next to the uploads.
- **Profile flow (live):** `POST /api/v1/crew {name, callsign?, role?, environment}`
  → generated `astronaut.id` (slug of the name) → the app sends that id as
  `astronaut_id` with every `POST /api/v1/checkups`. Demo mode rejects profile
  creation (fixed sample crew).
- The rest of the spec (data model §4, status logic §5, environments §7) is
  identical in both modes; only the data source/crew differs.

---

## 14. Private Journal (behavioral-health support)

NASA's Human Research Program lists **isolation and confinement** as a behavioral-health hazard. Journaling is described there as "an invaluable tool behavioral scientists use to assess the mental and emotional states associated with life in long-term isolation and confinement" ([NASA HRP](https://www.nasa.gov/hrp/hazard-isolation-and-confinement/)). The system therefore includes a journal — but as a **private reflection tool, never a crew metric**.

### Placement

| Part | Journal role | Why |
|------|--------------|-----|
| **Android app (primary)** | Full private journal: new/edit entry, title + body, isolation-specific writing prompts, autosave, word count, title search, date filter, delete confirmation, optional link to a specific sleep checkup, latest-entry summary. | The phone is the astronaut's personal device, already holds checkup history, and has the input surface for longer text. Entries live in app-private `journal.json`. |
| **Web dashboard (secondary)** | Per-astronaut private journal page opened from the astronaut detail page. Entries are stored in that browser's `localStorage` only. | The shared dashboard is unauthenticated in the current demo, so server-side journal storage would expose private text. Browser-local storage keeps the demo honest. |
| **Sensor node (out of scope)** | None. | The XIAO has no display, keyboard or persistent journal storage; its firmware only streams BPM. Journal authoring belongs in the app. |

### Privacy rules

- Journal text is never included in `SleepCheckup` uploads or any API payload.
- Journal text never affects status, alerts, insights, charts or reports.
- There is no share button and no crew-visible journal view.
- Android excludes `journal.json` from cloud backup and device transfer.
- Entries are **not encrypted**. Android app-private storage and browser `localStorage` protect against casual access, not a compromised or unlocked device/browser profile. Clearing app/site data deletes them.
- The optional checkup link is local metadata only; it is not uploaded.

### Writing prompts (isolation & confinement)

- What stood out today?
- What helped you feel connected to people back home?
- What felt hardest about the close quarters today?
- What is one small thing that made today easier?
- How did your mood and energy change through the day?
- What would you like to remember from this mission?

The journal is intentionally **not** scored, sentiment-analysed or turned into a health assessment. It supports the familiar, low-pressure practice behavioral scientists point to for long-duration isolation, without making private text part of the monitored data stream.
