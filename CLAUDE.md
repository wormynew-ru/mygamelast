Project Constitution: Junk Slayer (Fitness RPG)

## 0. Working with this project (READ FIRST)
**IMPORTANT:** 
- At the start of every new session, ALWAYS read section §6 "Project Status Summary" at the end of this file FIRST before doing anything else. It contains a complete snapshot of what's already implemented and tested.
- **At the end of EVERY task completion, AUTOMATICALLY update section §6** with new files, tests, feature statuses, and known limitations before reporting the work as done. This is NON-NEGOTIABLE.
- Update timestamps in §6.9 after each work session.

## 1. Project Vision
Cross-platform web-based Fitness RPG (desktop & mobile browsers, PWA-ready).
The player defeats fast-food monsters and bosses by performing real-world exercises tracked locally via the device camera.
- **Communication language:** Always respond to the user in Russian. Write all code, comments, commit messages, and technical docs in English.
- **UI Language & Localization:** The game UI must support multiple languages (Russian primary, English secondary). ALL user-facing strings (button labels, hints, monster/item names, achievements) MUST be externalized to `src/i18n/` translation files. Code MUST use translation keys, never hardcoded strings in Russian or English directly in components.

## 2. Tech Stack
- **Core:** Vite + React + TypeScript (`strict: true`, NO `any` types).
- **Styling & Animation:** Tailwind CSS + Framer Motion.
- **State Management:** Zustand (with persistence middleware for local saves).
- **Computer Vision:** `@mediapipe/tasks-vision` (PoseLandmarker) running 100% locally on the client.
- **Audio:** Web Audio API / lightweight synth or Howler.js (zero external audio file dependencies required for MVP).
- **Testing:** Vitest (unit tests for math, detectors, and RPG formulas).

## 3. Architectural Boundaries (Strict Separation of Concerns)
Never mix CV, RPG logic, and React UI in the same file. Follow this modular structure:

- `src/vision/` — **Pure Computer Vision & Exercise Detection.**
  - ZERO imports from `react`, `zustand`, or `src/game/`.
  - `PoseTracker.ts`: camera stream, MediaPipe initialization, frame loop, resource cleanup.
  - `angleMath.ts`: 2D/3D vector angles, EMA/low-pass smoothing, landmark visibility validation.
  - `exercises/`: Plugin-based exercise detectors. Every new exercise MUST implement a unified `ExerciseDetector` interface and live in its own file.
  - **Exercise Types:** The `ExerciseDetector` interface MUST support TWO exercise types:
    1. **rep-based** (squats, push-ups, jumping jacks): count completed repetitions via FSM (`repCount`).
    2. **hold-based** (plank, wall sit): track continuous correct pose hold (`isHolding: boolean`, `holdDurationMs: number`, ticks every 1 second for combat damage/defense).
- `src/session/` — **Workout Session Coordinator (Glue Layer).**
  - Bridge between pure vision/audio/game layers and UI. ZERO React imports allowed.
  - `WorkoutSession.ts`: orchestrates `PoseTracker` + `ExerciseDetector` -> `CombatEngine` -> `store` -> `SoundFX`.
  - Exposes clean API: `start()`, `pause()`, `resume()`, `reset()`, `onStateChange(callback)`.
  - React components in `src/ui/` MUST only subscribe to state and send commands — NO direct CV/combat logic in UI.
- `src/game/` — **Pure RPG Engine & Data.**
  - ZERO imports from `react`, DOM, or `src/vision/`.
  - `CombatEngine.ts`: damage calculation, crits, defense/shielding, boss phases, XP/leveling.
  - `store.ts`: Zustand store holding player stats, inventory, unlocked levels, settings/calibration.
    - **REQUIRED:** Use `persist` middleware with `version` field and `migrate` function to handle save format upgrades without breaking existing player saves in localStorage.
  - `data/`: Data-driven configs (`monsters.ts`, `items.ts`, `exercises.ts`). Adding new mobs or items must be possible purely by adding config entries.
- `src/audio/` — **Audio Feedback System.**
  - Crucial for UX: players often look at the floor during push-ups or planks. Every rep, block, hit, and boss warning must have distinct audio cues (and optional Web Speech API voice cues).
- `src/i18n/` — **Localization Layer.**
  - Translation files for all supported languages (RU primary, EN secondary).
  - Structure: `{ "ui.button.start": "Начать", "monsters.burger.name": "Бургер-Король", ... }`.
  - UI components MUST use translation keys via `t('key')`, NEVER hardcoded strings.
- `src/ui/` — **React Components & Canvas Overlay.**
  - Subscribes to `store.ts` and `WorkoutSession` state, renders HUD, battle arena, SVG/sprite mobs, and webcam skeleton overlay.
  - ZERO direct imports from `PoseTracker`, `CombatEngine`, or `SoundFX` — all interactions go through `WorkoutSession` API.

## 4. Computer Vision & Math Rules (Non-Negotiable)
1. **Local Execution Only:** Never send video frames or pose data to external APIs/LLMs for rep counting.
2. **Smoothing & Hysteresis:** Raw MediaPipe landmarks jitter. Always smooth coordinates/angles and use Finite State Machines (FSM) with hysteresis (distinct enter/exit thresholds) to prevent double-counting reps.
3. **Visibility Checks:** Ignore frames or pause detection if required landmarks have low visibility/confidence (e.g., `< 0.55`), and report a clear status (`LOW_VISIBILITY`) so the UI can warn the user.
4. **Configurable Calibration:** Never hardcode magic angle thresholds inside detectors without exposing them via a config object (players have different flexibility and camera angles).
5. **Mobile Camera Compatibility:** Always configure `<video>` with `playsInline`, `muted`, `autoPlay`, handle `facingMode: 'user'`, mirror the canvas horizontally for front-facing cameras, and handle resize/aspect-ratio changes cleanly.
6. **Exercise Type Support:** Every `ExerciseDetector` implementation MUST declare its type:
   - **Rep-based exercises** (squats, push-ups, jumping jacks): FSM-driven, emit `repCount` increments on completed cycles, trigger combat damage on each rep.
   - **Hold-based exercises** (plank, wall sit): Continuous pose validation, emit `isHolding` boolean + `holdDurationMs`, trigger combat damage/defense ticks every 1 second while holding correct form. Invalid form pauses timer and stops damage output.
7. **Side Selection for Lateral Exercises:** Detectors for side-view exercises (`PushUpDetector`, `PlankDetector`) MUST auto-select the more visible body side (`left` or `right`) based on maximum landmark visibility, NOT fail with `LOW_VISIBILITY` when far limbs are occluded by near limbs. Return status `WRONG_ANGLE` if both sides have low visibility (user facing camera frontally instead of sideways) with UI hint: "Turn sideways to camera".
8. **3D World Coordinates for Ground Exercises:** For exercises performed on the ground with phone at an angle (push-ups, plank), prefer `poseWorldLandmarks` (3D metric coordinates) over screen-space `poseLandmarks` (2D normalized) to reduce perspective distortion when calculating body angles. MediaPipe provides both; use world coordinates when available and exercise requires accurate depth perception.
9. **MediaPipe Model Caching for Offline PWA:** `.wasm` and `.task` model files MUST be either hosted locally in `public/mediapipe/` OR aggressively cached by Service Worker with `Cache-First` strategy. NEVER depend solely on CDN availability for production PWA offline mode. Include fallback to local files if CDN fetch fails.

## 5. Performance & Code Quality Standards
- **Adaptive FPS Budget:** 
  - **Canvas/UI rendering**: 60 FPS via `requestAnimationFrame` (skeleton draw, HUD updates).
  - **MediaPipe inference**: 24-30 FPS with adaptive throttling. Skip frames if inference time exceeds frame budget (e.g., > 33ms). On mobile devices, prefer `lite` model variant over `full` to reduce heat and battery drain.
  - Do NOT trigger React state re-renders on every video frame. Draw skeleton directly on `<canvas>` via refs; emit store updates only when rep state, rep count, or throttled HUD metrics change.
- **Screen Wake Lock & Auto-Pause:**
  - Use `navigator.wakeLock.request('screen')` during active workout to prevent screen dimming on mobile (critical for plank holds).
  - Handle `visibilitychange` event: release camera and pause workout when tab loses focus or app is backgrounded.
  - Auto-pause combat if `LOW_VISIBILITY` persists > 5 seconds (prevent boss from killing player while they adjust camera).
- **Web Audio API Unlock (Autoplay Policy):**
  - `SoundFX.init()` MUST be called after first user interaction (button click: "Start", "Calibrate").
  - Explicitly call `audioContext.resume()` to unlock audio on iOS Safari and Chrome (autoplay policy blocks audio until user gesture).
  - Show "Tap to enable sound" prompt if audio initialization fails silently.
- **Tests Required:** Any changes to `angleMath.ts`, `exercises/*`, or `CombatEngine.ts` MUST include Vitest unit tests (test detectors using synthetic sequences of landmark frames).
- **Architectural Boundaries Enforcement:** ESLint must enforce strict import rules:
  - `src/vision/` — ZERO imports from `react`, `zustand`, or `src/game/`
  - `src/game/` — ZERO imports from `react`, DOM, or `src/vision/`
  - Strict `no-any` rule everywhere
- **Verification Gate:** Before concluding any task, ALWAYS run:
  1. `npm run typecheck` (or `tsc --noEmit`)
  2. `npm run lint`
  3. `npm test`
  4. `npm run build`
  Fix any errors before reporting completion.

---

## 6. Project Status Summary (READ THIS FIRST IN NEW SESSIONS)

### 6.1 What's Already Implemented ✅

#### **Vision System (100% complete, 142 tests)**
- ✅ `src/vision/types.ts` — Base interfaces (`ExerciseDetector` with optional `worldLandmarks`, `ExerciseState`, `PoseLandmark` enum, rep & hold support)
- ✅ `src/vision/angleMath.ts` — Zero-allocation 2D/3D vector math utilities (angles 2D/3D, EMA smoothing, hysteresis, distances) + 32 tests
- ✅ `src/vision/PoseTracker.ts` — Camera capture (`frameRate: { ideal }` 30/60 FPS), MediaPipe PoseLandmarker (`pose_landmarker_lite`, `GPU` default with configurable `CPU` delegate, runtime `getActiveDelegate()` & `didFallbackToCpu()` tracking, up to 60 FPS target with duplicate-frame `video.currentTime` guard, vsync jitter tolerance, adaptive inference throttling, batched `alpha: false, desynchronized: true` canvas skeleton rendering, `worldLandmarks` forwarding, StrictMode `lifecycleToken` cancellation & `srcObject` ownership guard, plus camera-free `scriptedPoseGenerator` / `setScriptedPoseGenerator()` driver), local `/mediapipe/` loading with CDN fallback + 16 tests
- ✅ `src/vision/ScriptedPoseSource.ts` — Deterministic 33-landmark 2D/3D pose generator for all 10 exercises for headless tests and camera-free demos + 2 tests
- ✅ `src/vision/exercises/SquatDetector.ts` — FSM-based squat detector with bilateral leg averaging, right-leg fallback, frame-0 EMA init, and hysteresis + 31 tests
- ✅ `src/vision/exercises/PushUpDetector.ts` — Push-up detector (hysteresis side switching, 3D `worldLandmarks` angle support, frame-0 EMA init, FSM) + 13 tests
- ✅ `src/vision/exercises/PlankDetector.ts` — Hold-based plank detector (`isHolding`, `holdDurationMs`, hysteresis side switching, frame-0 EMA init, 3D `worldLandmarks` support, grace period) + 17 tests
- ✅ `src/vision/exercises/JumpingJackDetector.ts` — Rep-based jumping jack detector (bilateral arm abduction + normalized leg spread ratio, zero-allocation visibility checks) + 6 tests
- ✅ `src/vision/exercises/ArmHoldDetector.ts` — Hold-based T-pose / lateral dumbbell raise hold detector (front-facing bilateral shoulder abduction + straight-arm check + grace period) + 4 tests
- ✅ `src/vision/exercises/WallSitDetector.ts` — Hold-based wall sit detector (side-view auto-selection + 3D `worldLandmarks` knee-angle validation + grace period) + 4 tests
- ✅ `src/vision/exercises/OverheadPressDetector.ts` — Rep-based overhead shoulder press detector (bilateral elbow lockout + wrist-above-shoulder validation + FSM with hysteresis) + 3 tests
- ✅ `src/vision/exercises/LungeDetector.ts` — Rep-based lunge detector (bilateral/lead-leg knee flexion, single-leg visibility fallback, FSM + hysteresis) + 6 tests
- ✅ `src/vision/exercises/HighKneesDetector.ts` — Rep-based high knees cardio detector (bilateral alternating hip flexion tracking + hysteresis) + 4 tests
- ✅ `src/vision/exercises/FrontRaiseDetector.ts` — Rep-based front dumbbell raise detector (bilateral shoulder flexion angle, FSM + hysteresis) + 4 tests
- ✅ `src/vision/exercises/index.ts` — Detector registry (exports all 10 detectors)

#### **Audio System (100% complete, 15 tests)**
- ✅ `src/audio/SoundFX.ts` — Web Audio API synthesizer (10 synthesized sounds incl. `WARNING` strike alert, `METRONOME_TICK`, and `INTERVAL_BELL` double-bell; NO external mp3/wav files), suspended AudioContext resume & `isUnlocked()` check + optional Web Speech `speak()` + 10 tests
- ✅ `src/audio/VoiceCommandEngine.ts` — Pure client-side Web Speech API (`SpeechRecognition`) hands-free command parser & continuous recognizer (`parseVoiceCommand` for RU/EN battle controls incl. `USE_CONSUMABLE`, navigation incl. `NAV_TABATA`, `START_BENCHMARK`, `NAV_GARDEN`, `NAV_SANCTUARY`, `NAV_TALENTS`, garden actions `GARDEN_WATER`/`GARDEN_HARVEST`/`GARDEN_WEED`, all 10 exercises for mid-battle switching too, dumbbell weights, circuits, analytics periods/metrics + cooldown deduplication + auto-restart) + 5 tests

#### **Game System (100% complete, 91 tests)**
- ✅ `src/game/types.ts` — RPG, `EquipmentLoadout`, `PoseComputeDelegate` (`'GPU' | 'CPU'`), `WorkoutStats` (incl. `tabataCompleted`, `totalParries`), `StageMasteryRecord` (`rankS`, `parryAce`, `tactician`), `DailyActivityEntry`, `GardenState` (`isMutant` plots), `SanctuaryState` (`SanctuaryLabTier` `1..3`, 12 `SanctuaryMixId` recipes, `MonsterTrophyId`, `SanctuaryPreset`, `AlchemyOrder`), `PlayerTalentState`, `ArtifactState` (dedicated 2-slot endgame relics), `ProgramProgressState`, `ExercisePersonalRecord`, `MutatorId`, `WeeklyChallengeState`, `TabataConfig`, `CadenceMode`, `CustomCircuitDefinition`, `BenchmarkEntry`, Combo/Matchup/Archetype/Rank, ItemRarity, DailyQuestState, StreakState, BestiaryEntry, EndlessArenaStats, Achievement, `ExerciseCalibrationSettings` (10 exercises)
- ✅ `src/game/CombatEngine.ts` — Damage calculation, Timed Reflex Parry (`PARRY_DAMAGE_MULTIPLIER = 1.35`, `PARRY_ULT_CHARGE_GAIN = 15`), Perfect Guard (`PERFECT_GUARD_ULT_CHARGE_GAIN = 10`, `calculateParryCounterDamage`), Boss Phase 2 enrage shield + attack scaling (`applyBossPhaseTransition`), Dumbbell Loadout scaling + `dumbbellDamageBonus`, Talent & Artifact passive modifiers, Mutator modifiers, Sanctuary combat modifiers, Ultimate Overdrive, Tempo Combo streaks, exercise matchups, enemy shield mitigation, Toxic debuff, Battle Rank, weight-adjusted `estimateWorkoutKcal`, counter-attacks + hold blocking, equipment bonuses, consumable healing, loot drops + 50 tests
- ✅ `src/game/store.ts` — Zustand store with `Map`-safe localStorage persistence (`SAVE_SCHEMA_VERSION = 16`, backwards-compatible `v0–v16` `migrateGameState` & `importGameState`), `useConsumable` clamping against `selectEffectivePlayerStats().maxHp`, `recordStageMastery` one-time tactical mastery coin bounties (`+35` Fit-Coins per new star), `totalParries` stat tracking, Sanctuary mixes/trophies/presets/daily alchemy orders, Garden mutations, Talents, Endgame Artifacts, Training Programs, Mutators, Weekly Challenge, Personal Records, Custom Circuits, 60s Fitness Benchmarks, `cadenceMode` & `warmUpEnabled` settings, `scriptedPoseEnabled` toggle, Fit-Coins economy, daily quests, 7-day streak, 400-day activity history, Bestiary, Endless Arena, 30 achievements sync, calibration, language sync + 8 tests (`store.v35.test.ts`)
- ✅ `src/game/portability.ts` — `Map`-safe full JSON save export/import (`exportSaveToJson`, `parseAndValidateSaveJson`) and RFC-4180 CSV activity log export (`exportActivityToCsv` covering all 10 exercises) + 3 tests
- ✅ `src/game/data/` — `exercises.ts` (10 exercises), `monsters.ts` (16 monsters incl. Endless Apex Bosses at Waves 10/15/20), `circuits.ts` (6 built-in presets + custom circuit helpers), `trainingFormats.ts` (Tabata presets, Tempo Cadence Metronome & `RPM`, Warm-up, Fresh Focus, 60s Benchmark ratings & Conditioning Index + 5 tests), `items.ts` (10 items), `levels.ts` (5 stages), `dailyQuests.ts`, `achievements.ts` (30 achievements incl. `PARRY_MASTER`, `STAGE_MASTER`), `talents.ts` (+ 4 tests), `artifacts.ts` (+ 3 tests), `programs.ts` (+ 3 tests), `garden.ts` (+ 7 tests), `sanctuary.ts` (+ 6 tests), `analytics.ts` (+ 2 tests)

#### **Session Layer (100% complete, 31 tests)**
- ✅ `src/session/WorkoutSession.ts` — Coordinator (`CAMPAIGN` | `ENDLESS` | `CIRCUIT` | `WEED` | `WEEKLY` | `TABATA` | `BENCHMARK`), **Timed Reflex Parry** (rep inside enemy warning window cancels strike + `+35%` dmg + `+1` shield break + `+15%` Ult), **Perfect Guard** (hold `>= 2` ticks reflects parry counter damage + `+10%` Ult), **Superset Shatter** (switching `rep <-> hold` or into target weakness adds `+1` shield break & `+25%` crit), **In-Battle Consumables** (`useConsumableInBattle`, blocked under `NO_ITEMS` / `BENCHMARK`, emits `lastHealEvent`), Campaign **Stage Mastery** evaluation (`rankS`, `parryAce`, `tactician`), Tabata intervals, 60s clean Benchmark mode, Warm-up, Mid-Battle Exercise Switch, Tempo Cadence Metronome & `RPM`, Talent/Artifact/Mutator/Sanctuary aggregation, `scriptedPoseEnabled` support, `startToken` cancellation, Screen Wake Lock, auto-pause + 31 tests

#### **Localization Layer (100% complete)**
- ✅ `src/i18n/ru.ts` & `src/i18n/en.ts` — Complete RU/EN translation dictionaries covering all Junk Slayer v3.5 + Training Formats features (all 10 exercises, 3 Apex bosses, 12 talents, 6 artifacts, 4 programs, 5 mutators, Weekly Challenge, PR table, Garden mutations, Sanctuary presets & daily orders, JSON/CSV portability, Scripted Pose Driver, Tabata presets, 6 built-in circuits + Custom Circuit Builder, 60s Benchmark ratings, Warm-up & Superset switcher, Tempo Cadence modes)
- ✅ `src/i18n/index.ts` & `src/i18n/useTranslation.ts` — Translation helpers & React hook synced with Zustand store

#### **PWA & Offline Assets (100% complete)**
- ✅ `vite.config.ts` & `src/main.tsx` — `vite-plugin-pwa` with Web App Manifest, `registerSW({ immediate: true })`, `CacheFirst` Service Worker caching for `/mediapipe/`, fonts, and CDN fallbacks
- ✅ `public/mediapipe/` — Locally bundled `pose_landmarker_lite.task` (5.6 MB) and all 6 `@mediapipe/tasks-vision` WASM/JS runtime files for offline execution
- ✅ `public/icon.svg`, `public/pwa-192x192.png`, `public/pwa-512x512.png`, `public/pwa-maskable-512x512.png`, `public/apple-touch-icon.png` — Complete multi-platform PWA & iOS icon set
- ✅ `src/ui/PWAInstallButton.tsx` — In-app Chromium install prompt (`beforeinstallprompt`), iOS Safari installation modal, and `OfflineIndicator`

#### **UI Layer (Complete Junk Slayer v4.0 RPG, Tactical Combat, Custom Monster SVGs, Stage Mastery, Talents, Artifacts, Programs, Weekly, Garden, Sanctuary & Analytics)**
- ✅ `src/ui/gameKeys.ts` — Typed i18n lookup dictionary covering all 10 exercises, 16 monsters, 12 talents, 6 artifacts, 4 programs, 5 mutators, 6 circuits, Tabata presets, Cadence modes, Benchmark ratings, `STAGE_MASTERY_KEYS`, 10 items, 4 seeds, 4 watering cans, 4 monster trophies, 12 Sanctuary mixes, 7 synergies, and 30 achievements
- ✅ `src/ui/MonsterArtwork.tsx` — Custom inline SVG illustrations for all 16 monsters & garden weeds (`sm`/`md`/`lg`) with Boss crowns, crystalline Shield Barrier rings, attack warning telegraphs, enrage embers, and damage flashes
- ✅ `src/ui/MainMenu.tsx` — Hero RPG card, Sanctuary Hub card, Personal Garden entry card, Weekly Challenge launcher card, Training Programs selector & day tracker, Talents navigation with available points counter, Daily Quests & 7-day Streak strip, PWA install CTA, 30-badge Achievements grid
- ✅ `src/ui/TalentTreeScreen.tsx` — Standalone 3-branch Talent Tree screen (`MIGHT` / `BASTION` / `BOTANY`) with rank progress, prerequisite validation, 100 Fit-Coin respec, and voice exit support
- ✅ `src/ui/GardenScreen.tsx` — Personal Fitness Garden hub: 6 plots with Mutant ×2 golden highlight, yield/XP bonus readout & mutant harvest toast, watering can upgrades/refills, Botanical Stash, Weed Battle modal
- ✅ `src/ui/SanctuaryScreen.tsx` — Hero's Hideout & Mix Lab: active pre-battle buff slots (`1..3`), 3-slot Mix Loadout Presets, Daily Alchemy Order turn-in panel, Lab tier upgrades, 12 mixes, 7 synergies, Monster Trophies
- ✅ `src/ui/LevelSelectScreen.tsx` — Segmented `Campaign | Endless Arena | Circuit Dungeon | Tabata & Test` selector with `<MonsterArtwork />` portraits, **3-Star Stage Tactical Mastery** progress & checklist, Loadout switcher, Run Mutators Bar, active Sanctuary strip, all 10 exercises, 6 built-in Circuits + Custom Circuit Builder, Tabata & 60s Benchmark launchers
- ✅ `src/ui/InventoryScreen.tsx` — Segmented `Bag | Shop` tabs with Fit-Coins, Endgame Artifacts (2 Dedicated Relic Slots), equipment & consumables, Monster Trophies, Botanical Stash
- ✅ `src/ui/BestiaryAnalyticsScreen.tsx` — Multi-period analytics, Export CSV, Conditioning Index & 60s Benchmarks, Personal Records table, and 16-monster Bestiary rendered with `<MonsterArtwork />`
- ✅ `src/ui/SettingsScreen.tsx` — Language, audio, voice commands, Tempo Cadence Metronome, Pre-Battle Warm-up toggle, camera, 15/30/60 FPS, GPU/CPU delegate selector, Scripted Pose Driver toggle, JSON Save Export & Import, reset modal
- ✅ `src/ui/BattleScreen.tsx` — Live CV arena supporting all 7 battle modes with `<MonsterArtwork />`, Reflex Parry & Perfect Guard popups, Boss Phase 1/2 Awakening banner, Superset Shatter badge, **Tactical Quick Belt (`[1-4]`)** + `USE_CONSUMABLE` voice command, keyboard hotkeys (`P`, `1-4`, `C`), `data-state` telemetry attribute, and Victory Stage Mastery reward callouts
- ✅ `src/ui/VoiceControl.tsx` — `VoiceControlProvider`, LIFO `useVoiceCommandHandler` hook, `<VoiceToggleButton />`, and floating command feedback toast
- ✅ `src/ui/CalibrationSandbox.tsx` — Multi-exercise calibration tool (all 10 detectors) with live `scriptedPoseEnabled` switcher (`DEMO POSE`), `poseDelegate` badge, and persistent live threshold sliders
- ✅ `src/App.tsx` — Root screen router wiring Weekly Challenge, Program Day, Tabata, 60s Benchmark, Custom Circuits, and Mutator-scaled runs

#### **Documentation**
- ✅ `README.md` — Comprehensive Russian technical & user guide
- ✅ `ROADMAP.md` — Persistent feature roadmap (v1.0–v4.0 complete, backlog updated)

### 6.2 Test Coverage Summary

**Total: 279/279 tests passing across 26 test files (100% ✅)**

| File | Tests | Status |
|------|-------|--------|
| `angleMath.test.ts` | 32 | ✅ Pass |
| `SquatDetector.test.ts` | 31 | ✅ Pass |
| `PushUpDetector.test.ts` | 13 | ✅ Pass |
| `PlankDetector.test.ts` | 17 | ✅ Pass |
| `JumpingJackDetector.test.ts` | 6 | ✅ Pass |
| `ArmHoldDetector.test.ts` | 4 | ✅ Pass |
| `WallSitDetector.test.ts` | 4 | ✅ Pass |
| `OverheadPressDetector.test.ts` | 3 | ✅ Pass |
| `LungeDetector.test.ts` | 6 | ✅ Pass |
| `HighKneesDetector.test.ts` | 4 | ✅ Pass |
| `FrontRaiseDetector.test.ts` | 4 | ✅ Pass |
| `ScriptedPoseSource.test.ts` | 2 | ✅ Pass |
| `PoseTracker.test.ts` | 16 | ✅ Pass |
| `SoundFX.test.ts` | 10 | ✅ Pass |
| `VoiceCommandEngine.test.ts` | 5 | ✅ Pass |
| `CombatEngine.test.ts` | 50 | ✅ Pass |
| `analytics.test.ts` | 2 | ✅ Pass |
| `trainingFormats.test.ts` | 5 | ✅ Pass |
| `garden.test.ts` | 7 | ✅ Pass |
| `sanctuary.test.ts` | 6 | ✅ Pass |
| `talents.test.ts` | 4 | ✅ Pass |
| `artifacts.test.ts` | 3 | ✅ Pass |
| `programs.test.ts` | 3 | ✅ Pass |
| `portability.test.ts` | 3 | ✅ Pass |
| `store.v35.test.ts` | 8 | ✅ Pass |
| `WorkoutSession.test.ts` | 31 | ✅ Pass |

### 6.3 What's NOT Implemented Yet ❌

#### **Future Polish / Post-v3.5 Roadmap (see `ROADMAP.md`):**
- ⏳ Optional cloud profile sync layered over JSON export
- ⏳ Automated browser Playwright E2E UI verification using built-in `ScriptedPoseSource`

### 6.4 File Structure Snapshot

```
README.md                            ✅ User & developer guide (RU)
ROADMAP.md                           ✅ Persistent project roadmap (v1.0–v3.5)

public/
├── apple-touch-icon.png             ✅ 180x180 iOS home screen icon
├── icon.svg                         ✅ Brand vector icon
├── pwa-192x192.png                  ✅ 192x192 manifest icon
├── pwa-512x512.png                  ✅ 512x512 manifest icon
├── pwa-maskable-512x512.png         ✅ 512x512 padded maskable icon
└── mediapipe/
    ├── pose_landmarker_lite.task    ✅ Local MediaPipe pose model
    └── wasm/                        ✅ 6 local WASM/JS runtime files

src/
├── vision/                          ✅ Complete (142 tests)
│   ├── types.ts                    ✅ Interfaces (ExerciseDetector, rep/hold types)
│   ├── angleMath.ts / .test.ts     ✅ Math utils (32 tests)
│   ├── ScriptedPoseSource.ts / .test.ts ✅ Deterministic 33-landmark driver for 10 exercises (2 tests)
│   ├── PoseTracker.ts / .test.ts   ✅ Camera + local MediaPipe + CDN fallback + GPU/CPU + Scripted mode (16 tests)
│   └── exercises/
│       ├── index.ts                ✅ Registry (10 detectors)
│       ├── SquatDetector.ts / .test.ts         ✅ (31 tests)
│       ├── PushUpDetector.ts / .test.ts        ✅ (13 tests)
│       ├── PlankDetector.ts / .test.ts         ✅ (17 tests)
│       ├── JumpingJackDetector.ts / .test.ts   ✅ (6 tests)
│       ├── ArmHoldDetector.ts / .test.ts       ✅ (4 tests)
│       ├── WallSitDetector.ts / .test.ts       ✅ (4 tests)
│       ├── OverheadPressDetector.ts / .test.ts ✅ (3 tests)
│       ├── LungeDetector.ts / .test.ts         ✅ (6 tests)
│       ├── HighKneesDetector.ts / .test.ts     ✅ (4 tests)
│       └── FrontRaiseDetector.ts / .test.ts    ✅ (4 tests)
│
├── session/                         ✅ Complete (31 tests)
│   ├── WorkoutSession.ts           ✅ Coordinator (Campaign/Endless/Circuit/Weed/Weekly/Tabata/Benchmark), Reflex Parry, Perfect Guard, Superset Shatter, In-Battle Consumables, Stage Mastery, Cadence RPM
│   └── WorkoutSession.test.ts      ✅
│
├── game/                            ✅ Complete (91 tests)
│   ├── types.ts                    ✅ RPG, StageMastery, Talents, Artifacts, Programs, PRs, Mutators, Weekly, Tabata, Cadence, Custom Circuits, Benchmarks, Garden, Sanctuary, Loadout, Calibration & Achievement interfaces
│   ├── CombatEngine.ts / .test.ts  ✅ Combat, Parry/Counter, Boss Phase 2 Shields, Talents/Artifacts/Mutators/Sanctuary multipliers, loadouts, tonnage, Overdrive, combos, matchups (50 tests)
│   ├── portability.ts / .test.ts   ✅ Map-safe JSON save export/import & RFC-4180 CSV activity export (3 tests)
│   ├── store.ts                    ✅ Zustand v16 persist + v0–v16 migration + effective maxHp consumable healing + one-time Stage Mastery bounties + totalParries
│   ├── store.v35.test.ts           ✅ v3.5–v4.0 store actions & migration integration tests (8 tests)
│   └── data/
│       ├── exercises.ts            ✅ 10 exercises (rep/hold + dumbbell support)
│       ├── monsters.ts             ✅ 16 monsters (4 archetypes; incl. Endless Apex Bosses at Waves 10/15/20 + 3 garden weeds)
│       ├── circuits.ts             ✅ 6 Circuit Dungeon presets + custom circuit builder helpers
│       ├── trainingFormats.ts / .test.ts ✅ Tabata presets, Cadence Metronome & RPM, Warm-up, Fresh Switch, 60s Benchmark ratings & Conditioning Index (5 tests)
│       ├── items.ts                ✅ 10 items (4 rarities) + SHOP_ITEM_IDS
│       ├── levels.ts               ✅ 5 campaign stages + drop tables
│       ├── dailyQuests.ts          ✅ Deterministic Daily Quests & 7-day Streak calendar helpers
│       ├── achievements.ts         ✅ 30 achievements + pure evaluator
│       ├── talents.ts / .test.ts   ✅ 3-branch Talent Tree (12 nodes, respec) (4 tests)
│       ├── artifacts.ts / .test.ts ✅ 6 Endgame Artifacts (2 dedicated slots) (3 tests)
│       ├── programs.ts / .test.ts  ✅ 4 Training Programs (3–7d), 5 Mutators & ISO-week Weekly Challenge (3 tests)
│       ├── garden.ts / .test.ts    ✅ Personal Fitness Garden + Mutant plots (7 tests)
│       ├── sanctuary.ts / .test.ts ✅ Sanctuary Lab tiers, 4 trophies, 12 mixes, 7 synergies, 3 presets, Daily Alchemy Orders (6 tests)
│       └── analytics.ts / .test.ts ✅ Multi-period workout analytics aggregator (Today/7d/Month/Year/All) (2 tests)
│
├── audio/                           ✅ Complete (15 tests)
│   ├── SoundFX.ts / .test.ts       ✅ 10 synthesized sounds (incl. WARNING, METRONOME_TICK, INTERVAL_BELL) + unlock check + speak() (10 tests)
│   └── VoiceCommandEngine.ts / .test.ts ✅ Client-side Web Speech API parser & recognizer (incl. USE_CONSUMABLE) (5 tests)
│
├── i18n/                            ✅ Complete
│   ├── index.ts                    ✅ Helpers & language list
│   ├── useTranslation.ts           ✅ React hook synced with store
│   ├── ru.ts                       ✅ Primary Russian translations
│   └── en.ts                       ✅ Secondary English translations
│
└── ui/                              ✅ Complete Junk Slayer v4.0 RPG UI
    ├── MonsterArtwork.tsx          ✅ Custom inline SVG artwork for all 16 monsters/weeds + Boss crown, shield barrier, warning telegraph & phase embers
    ├── gameKeys.ts                 ✅ Shared entity/mastery/training-format/talent/artifact/program/mutator/sanctuary/achievement i18n dictionary
    ├── VoiceControl.tsx            ✅ VoiceControlProvider, useVoiceCommandHandler, VoiceToggleButton & toast
    ├── MainMenu.tsx                ✅ Hero profile, Weekly Challenge, Training Programs, Talents nav, Sanctuary & Garden hubs, Daily Quests, 30 Achievements
    ├── TalentTreeScreen.tsx        ✅ 3-branch Hero Talent Tree & respec UI
    ├── GardenScreen.tsx            ✅ Personal Fitness Garden (6 plots w/ Mutant ×2 bonus, Botanical Stash, Sanctuary shortcut, Weed Patrol)
    ├── SanctuaryScreen.tsx         ✅ Hero Hideout & Mix Lab (Lab tiers 1..3, 3-slot Presets, Daily Alchemy Orders, 12 mixes, 7 synergies, Trophies)
    ├── LevelSelectScreen.tsx       ✅ Campaign (w/ 3-star Stage Mastery & SVG art) / Endless / Circuit / Tabata & 60s Benchmark + Mutators + Loadout
    ├── InventoryScreen.tsx         ✅ Segmented Bag (incl. 2-slot Endgame Artifacts, Monster Trophies, Botanical Stash) & Fit-Coins Shop
    ├── BestiaryAnalyticsScreen.tsx ✅ Multi-period analytics, Conditioning Index & 60s Benchmarks, Export CSV, Personal Records table, 16-monster SVG Bestiary
    ├── SettingsScreen.tsx          ✅ Language, audio, voice, Cadence Metronome, Pre-Battle Warm-up, camera, 15/30/60 FPS, GPU/CPU delegate, Scripted Pose Driver, JSON Export/Import
    ├── BattleScreen.tsx            ✅ Live CV arena (SVG Boss/Mob artwork, Reflex Parry & Perfect Guard, Boss Phase banner, Superset Shatter, Quick Belt [1-4], keyboard/voice hotkeys, Stage Mastery victory card)
    ├── CalibrationSandbox.tsx      ✅ 10-exercise calibration + live Scripted Pose Driver + GPU/CPU badge + threshold sliders
    └── PWAInstallButton.tsx        ✅ Chromium/iOS install prompt + OfflineIndicator
```

### 6.5 Build Status

```bash
✅ npm run typecheck  — Strict TypeScript, 0 errors
✅ npm run lint       — ESLint strict boundaries & no-any, 0 errors / 0 warnings
✅ npx vitest run     — 279/279 tests passing (26/26 files)
✅ npm run build      — Clean Vite production build + PWA manifest & Service Worker
```

### 6.6 Architecture Compliance

**Separation of Concerns (fully enforced via ESLint):**
- ✅ `src/vision/` — ZERO React/Zustand/`src/game/` imports
- ✅ `src/game/` — ZERO React/DOM/`src/vision/` imports
- ✅ `src/audio/` — ZERO React/Zustand imports
- ✅ `src/session/` — ZERO React imports
- ✅ `src/ui/` — Subscribes to `WorkoutSession` and `store.ts`; BattleScreen & BestiaryAnalyticsScreen have ZERO direct `PoseTracker`/`CombatEngine`/`SoundFX` imports

### 6.7 Quick Start for New Sessions

```bash
npm run dev
# Opens on http://0.0.0.0:3000
```

**⚠️ Mobile testing over local network:**
- Browser security requires **HTTPS** for `getUserMedia()` over network (localhost/preview HTTPS works directly).

### 6.8 Known Limitations

- `CalibrationSandbox` and `BattleScreen` require browser camera permission (`getUserMedia`); devices without a webcam show a localized fallback notice.
- Web Audio autoplay policies on mobile Safari/Chrome require a tap gesture to unlock audio; handled in `BattleScreen` via the "Tap to enable sound" prompt.

---

### 6.9 Session History & Timestamps

**Latest update:** 2026-11-17 18:10 UTC

**Recent work:**
- ✅ 2026-11-17: **Shipped Release v4.0 — Tactical Combat Mastery & Living Arena (`v16` save schema, `279/279` tests across 26 test files)**:
  - **Timed Reflex Parry & Perfect Guard**: Reps completed inside an enemy's `isAttackWarning` telegraph window cancel & reset the monster's strike, deal `×1.35` damage, break `+1` shield, and award `+15%` Ult charge; static holds across `>= 2` ticks trigger Perfect Guard counter-damage (`calculateParryCounterDamage`) and `+10%` Ult charge.
  - **Boss Phase 2 Awakening & Superset Shatter**: Boss Phase `>= 2` raises a 3-hit energy barrier (`+15%` ATK) with a live battle banner; switching `rep <-> hold` or into enemy weakness arms Superset Shatter (`+1` shield break & `+25%` crit on the next strike).
  - **Tactical Quick Belt (`[1-4]`), Keyboard Hotkeys & `USE_CONSUMABLE` Voice**: Wired 4 in-battle consumable slots + `[P]`/`[1-4]`/`[C]` hotkeys + voice healing (`«Аптечка»`/`«Зелье»`/`«Heal»`), blocked by `NO_ITEMS` mutator / `BENCHMARK`, and fixed `store.useConsumable` to respect `selectEffectivePlayerStats().maxHp`.
  - **Custom SVG Monster Artwork (`MonsterArtwork.tsx`) & Anti-Grind Stage Mastery (3★)**: Crafted custom vector SVG portraits for all 16 monsters & garden weeds (with Boss crowns, shield barrier rings, attack warning telegraphs & phase embers) across Battle, Campaign Select, and Bestiary; added 3 one-time Campaign Mastery stars (`rankS`, `parryAce`, `tactician`, `+35` Fit-Coins per newly earned star) + 2 new achievements (`PARRY_MASTER`, `STAGE_MASTER` = 30 total).
- ✅ 2026-11-17: **Implemented Real Training Formats & Tempo Expansion (Section 3, `v15` save schema, `272/272` tests across 26 test files)**:
  - **Tabata / HIIT Interval Mode (`TABATA`)**: Added `20/10 × 6` (`CLASSIC_20_10`), `30/15 × 6` (`POWER_30_15`), and `40/20 × 4` (`ENDURANCE_40_20`) interval protocols where `REST` pauses monster counter-attacks & combo decay with double-bell `INTERVAL_BELL` cues and victory tracking (`tabataCompleted`).
  - **Expanded Circuits + Custom Circuit Builder**: Kept all 3 original circuits and added 3 new built-in circuits (`LOWER_POWER_SPLIT`, `CARDIO_SHRED`, `DUMBBELL_SCULPT` = 6 total) plus a Custom Circuit Builder (2–6 rooms, exercise + monster + rest sec, up to 6 saved presets in `store.customCircuits`).
  - **Pre-Battle Warm-up & Mid-Battle Superset Exercise Switcher**: Optional `20s` / `8 reps` Warm-up phase granting `+25%` starting Ult charge (`skipWarmUp()` available); mid-battle `switchExerciseMidBattle` selector & `SELECT_EXERCISE` voice trigger preserving combo/Ult/HP with `×1.25` 8s Fresh Focus bonus and superset hint at `15+` hits.
  - **Tempo Cadence Metronome, Live `RPM` & 60s Fitness Benchmark (`BENCHMARK`)**: Synthesized `METRONOME_TICK` (`OFF` / `STRENGTH_2_1_2` / `STEADY_60` / `CARDIO_90`), sliding-window live `currentCadenceRpm` & `avgCadenceRpm`, clean 60s Benchmark test (no counter-attacks) with `BRONZE`/`SILVER`/`GOLD`/`ELITE` ratings, `0–100` Physical Conditioning Index (`BestiaryAnalyticsScreen`), `NAV_TABATA` & `START_BENCHMARK` voice triggers, and 3 new achievements (`TABATA_FINISHER`, `CUSTOM_ARCHITECT`, `BENCHMARK_TESTED` = 28 total).
- ✅ 2026-11-17: **Shipped Junk Slayer v3.5 Major Meta-Progression, CV & Portability Update (all 8 pillars, `262/262` tests across 25 test files)**:
  - **CV & Exercises (10 total)**: Added `LungeDetector`, `HighKneesDetector`, `FrontRaiseDetector` + combat multipliers, voice commands, calibration sliders, and `ScriptedPoseSource` camera-free 33-landmark driver integrated into `PoseTracker`, `SettingsScreen`, `CalibrationSandbox`, and `BattleScreen`.
  - **Endgame Bosses & Dedicated Artifacts**: Added 3 Endless Apex Bosses (`BOSS_DONUT_TITAN` Wave 10, `BOSS_SODA_OVERLORD` Wave 15, `BOSS_FRIES_EMPEROR` Wave 20+) and standalone 2-slot `artifacts` system (6 relics unlocked via Arena waves, Circuits, and Weekly Challenges).
  - **Hero Talent Tree (`TalentTreeScreen`)**: 3-branch progression (`MIGHT` / `BASTION` / `BOTANY`, 12 nodes, 1 pt/level above Lv 1, 100 Fit-Coin respec).
  - **Training Programs, Personal Records, Run Mutators & Weekly Challenge**: 4 3–7 day programs, per-exercise PR table (`BestiaryAnalyticsScreen`) + Victory callouts, 5 selectable pre-run mutators (`MAX_ACTIVE_MUTATORS = 3`), and ISO-week deterministic Weekly Challenge (`VAMPIRIC_FANG` relic reward).
  - **Garden Mutations, Sanctuary Extensions & Portability (`v14` save schema)**: Mutant garden plots (`×2` yield, `1.5×` XP, `+35%` loot chance), 3 Sanctuary Mix Loadout Presets, Daily Alchemy Orders, `Map`-safe JSON save Export/Import (`SettingsScreen`), RFC-4180 CSV daily log export (`BestiaryAnalyticsScreen`), and 6 new achievements (25 total).
- ✅ 2026-11-16: **Expanded Sanctuary Mix System: 12 Mixes, Monster Trophies, 7 Slot Synergies, Discipline Specializations & Risky Mutagens (`sanctuary.ts`, `CombatEngine.ts`, `WorkoutSession.ts`, `store.ts` v13, `achievements.ts`, `SanctuaryScreen.tsx`, `GardenScreen.tsx`, `InventoryScreen.tsx`, `LevelSelectScreen.tsx`, `BattleScreen.tsx`, `BestiaryAnalyticsScreen.tsx`, `MainMenu.tsx`, `gameKeys.ts`, `ru.ts`, `en.ts`)**:
  - Added 4 archetype Monster Trophies (`TROPHY_FIZZ_CORE`, `TROPHY_GLAZE_SHELL`, `TROPHY_CAPSAICIN_DROP`, `TROPHY_CROWN_SPICE`, Boss `×2`) dropped on victory and displayed across Sanctuary, Bag, and Bestiary.
  - Expanded Sanctuary from 4 to 12 recipes across 3 categories (`BASE`, `DISCIPLINE` for `STRENGTH`/`STATIC`/`CARDIO`/`ARENA`, and `MUTAGEN` high-risk glass-cannon/economy/toxic-catalyst formulas), plus 7 automatic slot synergies (`ISOTONIC_RHYTHM`, `IRON_BASTION`, `POWER_SURGE`, `ADRENALINE_GUARD`, `PURE_FURY`, `ENDLESS_ENDURANCE`, `ALCHEMIST_TRIUMVIRATE`) and 2 new achievements (`SYNERGY_ARCHITECT`, `MASTER_ALCHEMIST`).
  - Added anti-double-heal-exploit tracking (`healedBuffIds`) with safe `deactivateMixBuff`, discipline multipliers, 90% block mitigation, 1s Toxic cleanse, thorns reflect, Toxic immunity & Surge stacks, armor pierce, shield-shatter Ult, and persistent full-run buff lifetime across `ENDLESS` Arena waves (`223/223` tests passing).

**Next session priorities:**
1. Optional cloud profile sync layered over JSON export
2. Headless Playwright E2E UI test suite driving `BattleScreen` via `scriptedPoseEnabled`

---

**End of Constitution**