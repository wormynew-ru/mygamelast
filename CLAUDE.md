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

#### **Vision System (100% complete, 125 tests)**
- ✅ `src/vision/types.ts` — Base interfaces (`ExerciseDetector` with optional `worldLandmarks`, `ExerciseState`, `PoseLandmark` enum, rep & hold support)
- ✅ `src/vision/angleMath.ts` — Zero-allocation 2D/3D vector math utilities (angles 2D/3D, EMA smoothing, hysteresis, distances) + 32 tests
- ✅ `src/vision/PoseTracker.ts` — Camera capture (`frameRate: { ideal }` 30/60 FPS), MediaPipe PoseLandmarker (`pose_landmarker_lite`, `GPU` default with configurable `CPU` delegate, runtime `getActiveDelegate()` & `didFallbackToCpu()` tracking, up to 60 FPS target with duplicate-frame `video.currentTime` guard, vsync jitter tolerance, adaptive inference throttling, batched `alpha: false, desynchronized: true` canvas skeleton rendering, `worldLandmarks` forwarding, StrictMode `lifecycleToken` cancellation & `srcObject` ownership guard), local `/mediapipe/` loading with CDN fallback + 15 tests
- ✅ `src/vision/exercises/SquatDetector.ts` — FSM-based squat detector with bilateral leg averaging, right-leg fallback, frame-0 EMA init, and hysteresis + 31 tests
- ✅ `src/vision/exercises/PushUpDetector.ts` — Push-up detector (hysteresis side switching, 3D `worldLandmarks` angle support, frame-0 EMA init, FSM) + 13 tests
- ✅ `src/vision/exercises/PlankDetector.ts` — Hold-based plank detector (`isHolding`, `holdDurationMs`, hysteresis side switching, frame-0 EMA init, 3D `worldLandmarks` support, grace period) + 17 tests
- ✅ `src/vision/exercises/JumpingJackDetector.ts` — Rep-based jumping jack detector (bilateral arm abduction + normalized leg spread ratio, zero-allocation visibility checks) + 6 tests
- ✅ `src/vision/exercises/ArmHoldDetector.ts` — Hold-based T-pose / lateral dumbbell raise hold detector (front-facing bilateral shoulder abduction + straight-arm check + grace period) + 4 tests
- ✅ `src/vision/exercises/WallSitDetector.ts` — Hold-based wall sit detector (side-view auto-selection + 3D `worldLandmarks` knee-angle validation + grace period) + 4 tests
- ✅ `src/vision/exercises/OverheadPressDetector.ts` — Rep-based overhead shoulder press detector (bilateral elbow lockout + wrist-above-shoulder validation + FSM with hysteresis) + 3 tests
- ✅ `src/vision/exercises/index.ts` — Detector registry (exports all 7 detectors)

#### **Audio System (100% complete, 15 tests)**
- ✅ `src/audio/SoundFX.ts` — Web Audio API synthesizer (8 synthesized sounds incl. `WARNING` two-tone strike alert, NO external mp3/wav files), suspended AudioContext resume & `isUnlocked()` check + optional Web Speech `speak()` + 10 tests
- ✅ `src/audio/VoiceCommandEngine.ts` — Pure client-side Web Speech API (`SpeechRecognition`) hands-free command parser & continuous recognizer (`parseVoiceCommand` for RU/EN battle controls, navigation incl. `NAV_GARDEN`, garden actions `GARDEN_WATER`/`GARDEN_HARVEST`/`GARDEN_WEED`, all 7 exercises, dumbbell weights, circuits, analytics periods/metrics + cooldown deduplication + auto-restart) + 5 tests

#### **Game System (100% complete, 56 tests)**
- ✅ `src/game/types.ts` — RPG, `EquipmentLoadout`, `PoseComputeDelegate` (`'GPU' | 'CPU'`), `WorkoutStats` (incl. `totalTonnageKg`, `circuitsCompleted`, `totalEstimatedKcal`, `totalDurationSec`, `totalCoinsEarned`), `DailyActivityEntry` (with per-exercise breakdown, `circuitsCompleted`, `durationSec`), `GardenState` (with `seedInventory` & `cropInventory`), `GardenPlotState`, `SeedId`, `WeedId`, `WateringCanTier`, Combo/Matchup/Archetype/Rank, ItemRarity, DailyQuestState, StreakState, BestiaryEntry, EndlessArenaStats, Achievement, `ExerciseCalibrationSettings`, and `settings.voiceControlEnabled` interfaces
- ✅ `src/game/CombatEngine.ts` — Damage calculation, Dumbbell Loadout scaling (`getLoadoutDamageMultiplier` up to `×1.6`, `getLoadoutXpMultiplier` up to `×1.3`, `calculateTonnageDelta`), Ultimate Overdrive (`calculateUltimateChargeGain`, `ULTIMATE_CHARGE_MAX = 100`, `ULTIMATE_DAMAGE_MULTIPLIER = 1.8`), Tempo Combo streaks, exercise matchups, enemy shield mitigation, Boss Phase 1 Grease Shield, Toxic debuff, Battle Rank, weight-adjusted `estimateWorkoutKcal`, counter-attacks + hold blocking, equipment bonuses, consumable healing, loot drops + 45 tests
- ✅ `src/game/store.ts` — Zustand store with `Map`-safe localStorage persistence (`version: 11`, backwards-compatible `v0–v11` `migrateGameState`), `garden` state (`normalizeGardenState` incl. `cropInventory`) & full garden actions (`harvestPlot` yields XP + raw harvested crops into `cropInventory` instead of Fit-Coins), `voiceControlEnabled` setting, `poseDelegate: 'GPU' | 'CPU'` setting (defaults to `'GPU'`), `loadout` state + `setLoadout`, `targetPoseFps: 15 | 30 | 60` setting, Fit-Coins economy, daily quest claims, 7-day streak tracking, 400-day activity history, Bestiary tracking, Endless Arena records, 16-achievement sync, 7-exercise calibration, language hydration sync
- ✅ `src/game/data/` — `exercises.ts` (7 exercises + `supportsDumbbellWeight`), `monsters.ts` (13 monsters across 4 archetypes: 10 fast-food enemies + 3 garden weeds `WEED_DANDELION`/`WEED_THISTLE`/`WEED_VINE`), `circuits.ts` (3 presets), `items.ts` (10 items across 4 rarities + `SHOP_ITEM_IDS`), `levels.ts` (5 campaign stages), `dailyQuests.ts`, `achievements.ts` (16 achievements incl. `GARDENER` & `WEED_SLAYER`), `garden.ts` (Personal Fitness Garden engine: 4 seed tiers yielding XP + raw plants `harvestCropYield`, 4 watering cans, 6 plots, workout auto-growth/water refill/weed spawns, normalization + 7 tests), `sanctuary.ts` (Sanctuary / Hideout foundation: 4 planned botanical mix blueprints `SANCTUARY_MIX_BLUEPRINTS` & ingredient readiness helpers + 2 tests), `analytics.ts` (+ 2 tests)

#### **Session Layer (100% complete, 18 tests)**
- ✅ `src/session/WorkoutSession.ts` — Coordinator (`CAMPAIGN` | `ENDLESS` | `CIRCUIT` | `WEED`), passes `poseDelegate` (`'GPU' | 'CPU'`) and tracks runtime `poseDelegate` / `poseDelegateFallback` in `SessionStatus`, `advanceCircuitRoom()` mid-run switching without restarting camera, `WEED` garden battle victory clearing infested plots via `defeatPlotWeed()` while suppressing duplicate spawns (`suppressWeedSpawn: true`), Ultimate Overdrive `0..100%` charge & stun (resets enemy attack windup), universal static hold block & 3-tick Toxic debuff cleanse (`debuffCleansedId`), dumbbell tonnage/kcal/duration tracking, Circuit clear bonus coins/XP/loot chest, `startToken` async cancellation, Screen Wake Lock, auto-pause, audio unlock API + 18 tests

#### **Localization Layer (100% complete)**
- ✅ `src/i18n/ru.ts` & `src/i18n/en.ts` — Full RU/EN translation dictionaries covering all Junk Slayer 3.0 features, Personal Fitness Garden (crops, XP rewards, Botanical Stash, Sanctuary Mix Lab previews, watering cans, weeds), and voice commands
- ✅ `src/i18n/index.ts` & `src/i18n/useTranslation.ts` — Translation helpers & React hook synced with Zustand store

#### **PWA & Offline Assets (100% complete)**
- ✅ `vite.config.ts` & `src/main.tsx` — `vite-plugin-pwa` with Web App Manifest, `registerSW({ immediate: true })`, `CacheFirst` Service Worker caching for `/mediapipe/`, fonts, and CDN fallbacks
- ✅ `public/mediapipe/` — Locally bundled `pose_landmarker_lite.task` (5.6 MB) and all 6 `@mediapipe/tasks-vision` WASM/JS runtime files for offline execution
- ✅ `public/icon.svg`, `public/pwa-192x192.png`, `public/pwa-512x512.png`, `public/pwa-maskable-512x512.png`, `public/apple-touch-icon.png` — Complete multi-platform PWA & iOS icon set
- ✅ `src/ui/PWAInstallButton.tsx` — In-app Chromium install prompt (`beforeinstallprompt`), iOS Safari installation modal, and `OfflineIndicator`

#### **UI Layer (Complete Junk Slayer 3.0 RPG, Garden, Botanical Stash, Loadouts, Circuits & Analytics)**
- ✅ `src/ui/gameKeys.ts` — Shared lookup dictionary mapping all 7 exercises, 13 monsters, 3 circuits, 10 items, 4 seeds, 4 watering cans, 4 planned Sanctuary mixes, and 16 achievements to i18n keys
- ✅ `src/ui/MainMenu.tsx` — Hero RPG card (with Total Tonnage & Circuits Completed), Personal Garden entry card with live ready-to-harvest / weed alerts, Daily Quests & 7-day Streak calendar strip, PWA install CTA, 16-badge Achievements grid
- ✅ `src/ui/GardenScreen.tsx` — Personal Fitness Garden hub: watering can status & refill/upgrade, "Water All" / "Harvest All" / "Weed Patrol" controls, 6 unlockable plots harvesting XP + raw plants, Botanical Stash ("Склад растений") panel, Seed/Tool/Sanctuary Mix Lab (`Убежище`) tabs, herbicide quick-clear, and Weed Battle setup modal
- ✅ `src/ui/LevelSelectScreen.tsx` — Segmented `Campaign | Endless Arena | Circuit Dungeon` selector, Bodyweight vs Dumbbell (`1..15 kg` per hand) Loadout switcher, 7-exercise picker, 3 Circuit cards
- ✅ `src/ui/InventoryScreen.tsx` — Segmented `Bag | Shop` tabs with Fit-Coins, 4-tier rarity labels, equipment equip/unequip, consumables (used strictly between battles), and Botanical Stash crop inventory section
- ✅ `src/ui/BestiaryAnalyticsScreen.tsx` — Multi-period workout analytics (`TODAY`, `WEEK`, `MONTH`, `YEAR`, `ALL`) with KPI grid (`~kcal`, reps, hold seconds, tonnage, wins, circuits, coins, battle time), Volume/Calories/Tonnage chart metric toggle, per-exercise breakdown across 7 exercises, lifetime records, and detailed 13-monster Bestiary (category filters `All / Fast Food / Bosses / Weeds`, base `HP/ATK/DEF`, attack interval, shield charges, XP/Coin rewards, boss phase thresholds, archetype mechanics, habitats, Endless scaling info & personal records)
- ✅ `src/ui/SettingsScreen.tsx` — RU/EN language switcher, Sound/Voice cues/Hands-Free Voice Control toggles (+ command cheatsheet incl. garden commands), Front/Rear camera selector, Pose Detection FPS (`15 FPS | 30 FPS | 60 FPS`) selector, Neural Compute Engine (`GPU (WebGL) | CPU (WASM)`) selector, in-app reset confirmation modal
- ✅ `src/ui/BattleScreen.tsx` — Live CV arena supporting `CAMPAIGN`, `ENDLESS`, `CIRCUIT`, and `WEED` battles (preserving `weedId` across victory/defeat/retry & routing back to Garden), Tempo Combo meter, Ultimate Overdrive bar (`0..100%`), Dumbbell Loadout badge, live `GPU` / `CPU` delegate badge, universal static hold block & 3s Toxic cleanse indicator, Circuit room rest countdown (`advanceCircuitRoom()` keeping camera alive), Victory Rank `S/A/B/C` + Fit-Coins + Tonnage + `~kcal` summary, and voice command toggle/controls
- ✅ `src/ui/VoiceControl.tsx` — `VoiceControlProvider`, LIFO `useVoiceCommandHandler` hook, `<VoiceToggleButton />`, and floating command feedback toast
- ✅ `src/ui/CalibrationSandbox.tsx` — Multi-exercise calibration tool (all 7 detectors) respecting `poseDelegate` (`GPU`/`CPU`) with live backend badge, persistent live angle-threshold sliders & voice exercise switching
- ✅ `src/App.tsx` — Root screen router (`MENU | CAMPAIGN | GARDEN | INVENTORY | BESTIARY | BATTLE | CALIBRATION | SETTINGS`) wrapped in `VoiceControlProvider` + global `OfflineIndicator`

#### **Documentation**
- ✅ `README.md` — Comprehensive Russian technical & user guide
- ✅ `ROADMAP.md` — Persistent feature roadmap (v1.0–v3.0 + Personal Garden & Voice Control complete, post-v3.0 backlog)

### 6.2 Test Coverage Summary

**Total: 214/214 tests passing across 16 test files (100% ✅)**

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
| `PoseTracker.test.ts` | 15 | ✅ Pass |
| `SoundFX.test.ts` | 10 | ✅ Pass |
| `VoiceCommandEngine.test.ts` | 5 | ✅ Pass |
| `CombatEngine.test.ts` | 45 | ✅ Pass |
| `analytics.test.ts` | 2 | ✅ Pass |
| `garden.test.ts` | 7 | ✅ Pass |
| `sanctuary.test.ts` | 2 | ✅ Pass |
| `WorkoutSession.test.ts` | 18 | ✅ Pass |

### 6.3 What's NOT Implemented Yet ❌

#### **Next Major Milestone — Sanctuary & Botanical Mix Crafting (see `ROADMAP.md`):**
- ⏳ **Sanctuary Screen (`Убежище`) & Mix Lab**: Interactive crafting of harvested crops (`cropInventory`) into tonics, isotonics, and pre-battle buffs (`MINT_ISOTONIC`, `BAMBOO_FORTIFIER`, `CHILI_OVERDRIVE_SHOT`, `LOTUS_NECTAR`), plus combat buff integration in `WorkoutSession` / `CombatEngine` and Sanctuary upgrades

#### **Future Polish / Post-v3.0 Roadmap (see `ROADMAP.md`):**
- ⏳ Automated E2E synthetic webcam stream tests (real-time MediaPipe pose injection in Playwright CI)
- ⏳ Multi-set Workout Programs / Personal Records / Training Log Export (JSON/CSV)

### 6.4 File Structure Snapshot

```
README.md                            ✅ User & developer guide (RU)
ROADMAP.md                           ✅ Persistent project roadmap

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
├── vision/                          ✅ Complete (125 tests)
│   ├── types.ts                    ✅ Interfaces (ExerciseDetector, rep/hold types)
│   ├── angleMath.ts / .test.ts     ✅ Math utils (32 tests)
│   ├── PoseTracker.ts / .test.ts   ✅ Camera + local MediaPipe + CDN fallback + GPU/CPU delegate + 30/60 FPS + StrictMode safety (15 tests)
│   └── exercises/
│       ├── index.ts                ✅ Registry (7 detectors)
│       ├── SquatDetector.ts / .test.ts         ✅ (31 tests)
│       ├── PushUpDetector.ts / .test.ts        ✅ (13 tests)
│       ├── PlankDetector.ts / .test.ts         ✅ (17 tests)
│       ├── JumpingJackDetector.ts / .test.ts   ✅ (6 tests)
│       ├── ArmHoldDetector.ts / .test.ts       ✅ (4 tests)
│       ├── WallSitDetector.ts / .test.ts       ✅ (4 tests)
│       └── OverheadPressDetector.ts / .test.ts ✅ (3 tests)
│
├── session/                         ✅ Complete (18 tests)
│   ├── WorkoutSession.ts           ✅ Coordinator (Campaign/Endless/Circuit/Weed), GPU/CPU delegate, Overdrive stun, Toxic cleanse, tonnage, counter-attacks
│   └── WorkoutSession.test.ts      ✅
│
├── game/                            ✅ Complete (56 tests)
│   ├── types.ts                    ✅ RPG, Garden (incl. cropInventory), Loadout, PoseComputeDelegate, Tonnage, Combo, Rank, Economy, DailyQuests, Streaks, Bestiary, Endless, Calibration & Achievement interfaces
│   ├── CombatEngine.ts / .test.ts  ✅ Combat, loadouts, tonnage, Overdrive, combos, matchups, shields, boss transitions, toxic debuff, ranks, kcal, counter-attacks, gear, consumables (45 tests)
│   ├── store.ts                    ✅ Zustand v11 persist + backwards-compatible v0–v11 migration + poseDelegate ('GPU'|'CPU') + garden crop harvests + 400-day dailyHistory + Map serializer
│   └── data/
│       ├── exercises.ts            ✅ 7 exercises (rep/hold + dumbbell support)
│       ├── monsters.ts             ✅ 13 monsters (4 archetypes; 10 enemies + 3 garden weeds) + createEndlessWaveMonster
│       ├── circuits.ts             ✅ 3 Circuit Dungeon presets
│       ├── items.ts                ✅ 10 items (4 rarities) + SHOP_ITEM_IDS
│       ├── levels.ts               ✅ 5 campaign stages + drop tables
│       ├── dailyQuests.ts          ✅ Deterministic Daily Quests & 7-day Streak calendar helpers
│       ├── achievements.ts         ✅ 16 achievements + pure evaluator
│       ├── garden.ts / .test.ts    ✅ Personal Fitness Garden (4 seeds yielding XP + crops, 4 cans, 6 plots, weeds & drops) (7 tests)
│       ├── sanctuary.ts / .test.ts ✅ Sanctuary mix blueprints & ingredient readiness helpers (2 tests)
│       └── analytics.ts / .test.ts ✅ Multi-period workout analytics aggregator (Today/7d/Month/Year/All) (2 tests)
│
├── audio/                           ✅ Complete (15 tests)
│   ├── SoundFX.ts / .test.ts       ✅ 8 synthesized sounds (incl. WARNING) + unlock check + speak() (10 tests)
│   └── VoiceCommandEngine.ts / .test.ts ✅ Client-side Web Speech API hands-free parser & recognizer (5 tests)
│
├── i18n/                            ✅ Complete
│   ├── index.ts                    ✅ Helpers & language list
│   ├── useTranslation.ts           ✅ React hook synced with store
│   ├── ru.ts                       ✅ Primary Russian translations
│   └── en.ts                       ✅ Secondary English translations
│
└── ui/                              ✅ Complete Junk Slayer 3.0 RPG, Garden, Botanical Stash & PWA UI Flow
    ├── gameKeys.ts                 ✅ Shared entity/seed/can/sanctuaryMix/circuit/archetype/rarity i18n lookup dictionary
    ├── VoiceControl.tsx            ✅ VoiceControlProvider, useVoiceCommandHandler, VoiceToggleButton & toast
    ├── MainMenu.tsx                ✅ Hero profile (Tonnage & Circuits), Garden alerts, Fit-Coins, Daily Quests & Streak strip, 16-item Achievements
    ├── GardenScreen.tsx            ✅ Personal Fitness Garden UI (6 plots harvesting crops + XP, Botanical Stash, Sanctuary Mix Lab preview tab, Weed Patrol)
    ├── LevelSelectScreen.tsx       ✅ Campaign / Endless Arena / Circuit Dungeons + Bodyweight/Dumbbell Loadout bar + 7 exercises
    ├── InventoryScreen.tsx         ✅ Segmented Bag (incl. Botanical Stash) & Fit-Coins Shop (4 rarities, consumables, gear)
    ├── BestiaryAnalyticsScreen.tsx ✅ Multi-period workout analytics (Today/7d/Month/Year/All), KPI grid, metric chart toggle & detailed 13-monster Bestiary (filters, full combat stats, traits, habitats)
    ├── SettingsScreen.tsx          ✅ Language, audio, voice commands, camera, 15/30/60 FPS, GPU/CPU neural delegate selector, reset modal
    ├── BattleScreen.tsx            ✅ Live CV arena (incl. WEED mode), GPU/CPU badge, Combo + Ultimate Overdrive bars, Dumbbell tag, Hold block/cleanse, Circuit room rest countdown
    ├── CalibrationSandbox.tsx      ✅ 7-exercise calibration + GPU/CPU delegate status + angle threshold sliders
    └── PWAInstallButton.tsx        ✅ Chromium/iOS install prompt + OfflineIndicator
```

### 6.5 Build Status

```bash
✅ npm run typecheck  — Strict TypeScript, 0 errors
✅ npm run lint       — ESLint strict boundaries & no-any, 0 errors / 0 warnings
✅ npm test           — 214/214 tests passing (16/16 files)
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

**Latest update:** 2026-11-16 15:40 UTC

**Recent work:**
- ✅ 2026-11-16: **Added 15 FPS Option + GPU-Default Pose Neural Network + Settings CPU Toggle (`PoseTracker.ts`, `WorkoutSession.ts`, `store.ts` v11, `SettingsScreen.tsx`, `CalibrationSandbox.tsx`, `BattleScreen.tsx`, `ru.ts`, `en.ts`)**:
  - Added `15 FPS` alongside `30 FPS` and `60 FPS` (`targetPoseFps: 15 | 30 | 60`) in Settings while keeping webcam capture at `>= 30 FPS` for smooth preview rendering.
  - Set `settings.poseDelegate` to `'GPU'` by default (`version: 11` migration) with a segmented `GPU (WebGL) | CPU (WASM)` selector in `SettingsScreen.tsx`.
  - Tracked active runtime delegate (`getActiveDelegate()`, `didFallbackToCpu()`) and added `desynchronized: true` hardware-composited 2D canvas hint in `PoseTracker.ts`, wired through `WorkoutSession` and `CalibrationSandbox`, and rendered live `GPU` / `CPU` / `CPU (fallback)` badges in both `BattleScreen` and `CalibrationSandbox` (`214/214` tests passing).
- ✅ 2026-11-16: **Detailed Monster Bestiary Cards & Category Filtering (`BestiaryAnalyticsScreen.tsx`, `gameKeys.ts`, `ru.ts`, `en.ts`)**:
  - Upgraded Bestiary monster cards to display complete combat parameters (`HP`, `ATK`, `DEF`, attack interval / boss phase speed `6.0→5.0→4.0s`, shield hit charges, `XP` & `Fit-Coins` rewards), boss enrage HP thresholds, archetype tactical mechanic hints (`FAST / ARMORED / TOXIC / BOSS`), habitats (Campaign stages, Endless Arena, Circuit Dungeons, Garden), Endless Arena wave scaling formula note, and category filter tabs (`Все / Фастфуд / Боссы / Сорняки`).
- ✅ 2026-11-16: **Reworked Garden Harvest Rewards & Laid Sanctuary Foundation (`Убежище`)**:
  - **Garden Crop Economy (`types.ts`, `garden.ts`, `store.ts` v10)**: Removed Fit-Coin payouts from crop harvesting; kept Hero XP (`harvestXp`), HP heal, and bonus gear drops while rewarding the harvested plants themselves (`harvestCropYield` stored in `garden.cropInventory` with seamless `v0–v10` persistence migration).
  - **Sanctuary Foundation & UI (`sanctuary.ts`, `GardenScreen.tsx`, `InventoryScreen.tsx`, `gameKeys.ts`, `ru.ts`, `en.ts`, `ROADMAP.md`)**: Added `SANCTUARY_MIX_BLUEPRINTS` + ingredient readiness helpers, Botanical Stash (`Склад растений`) display in both Garden and Inventory Bag, and a dedicated "Sanctuary (Mixes)" preview tab in `GardenScreen.tsx`. Documented the full upcoming Sanctuary & Mix Crafting system in `ROADMAP.md` (`210/210` Vitest tests across 16 files).
- ✅ 2026-11-16: Audited, fixed, and completed **Personal Fitness Garden & Weed Battle integration** (`208/208` tests).
- ✅ 2026-11-16: Implemented **Hands-Free Voice Command Control (`Управление голосом`)** (`200/200` tests across 14 files).
- ✅ 2026-11-16: Added full **Time-Period Workout Analytics** (`Сегодня` / `7 дней` / `Месяц` / `Год` / `Всё время`) (`195/195` tests).

**Next session priorities:**
1. Implement **Sanctuary (`Убежище`)** interactive Mix Crafting & pre-battle combat buffs once design details are confirmed with user
2. Consider E2E Playwright mock-stream harness for automated CV battle regression testing

---

**End of Constitution**