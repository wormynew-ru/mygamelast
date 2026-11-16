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

#### **Vision System (100% complete, 109 tests)**
- ✅ `src/vision/types.ts` — Base interfaces (`ExerciseDetector` with optional `worldLandmarks`, `ExerciseState`, `PoseLandmark` enum, rep & hold support)
- ✅ `src/vision/angleMath.ts` — Zero-allocation 2D/3D vector math utilities (angles 2D/3D, EMA smoothing, hysteresis, distances) + 32 tests
- ✅ `src/vision/PoseTracker.ts` — Camera capture, MediaPipe PoseLandmarker (`pose_landmarker_lite`, adaptive inference throttling, GPU→CPU delegate fallback, batched 60 FPS `alpha: false` canvas skeleton rendering, `worldLandmarks` forwarding), local `/mediapipe/` loading with CDN fallback + 10 tests
- ✅ `src/vision/exercises/SquatDetector.ts` — FSM-based squat detector with bilateral leg averaging, right-leg fallback, frame-0 EMA init, and hysteresis + 31 tests
- ✅ `src/vision/exercises/PushUpDetector.ts` — Push-up detector (hysteresis side switching, 3D `worldLandmarks` angle support, frame-0 EMA init, FSM) + 13 tests
- ✅ `src/vision/exercises/PlankDetector.ts` — Hold-based plank detector (`isHolding`, `holdDurationMs`, hysteresis side switching, frame-0 EMA init, 3D `worldLandmarks` support, grace period) + 17 tests
- ✅ `src/vision/exercises/JumpingJackDetector.ts` — Rep-based jumping jack detector (bilateral arm abduction + normalized leg spread ratio, zero-allocation visibility checks) + 6 tests
- ✅ `src/vision/exercises/index.ts` — Detector registry (exports all 4 detectors)

#### **Audio System (100% complete, 10 tests)**
- ✅ `src/audio/SoundFX.ts` — Web Audio API synthesizer (8 synthesized sounds incl. `WARNING` two-tone strike alert, NO external mp3/wav files), suspended AudioContext resume & `isUnlocked()` check + optional Web Speech `speak()` + 10 tests

#### **Game System (100% complete, 41 tests)**
- ✅ `src/game/types.ts` — RPG, WorkoutStats, Combo/Matchup/Archetype/Rank, ItemRarity, DailyQuestState, StreakState, BestiaryEntry, EndlessArenaStats, Achievement, and `ExerciseCalibrationSettings` interfaces
- ✅ `src/game/CombatEngine.ts` — Damage calculation, Tempo Combo streaks (`getComboMultiplier`, `COMBO_WINDOW_BASE_MS`), exercise matchups (`getExerciseMatchup`, `getMatchupMultiplier`), enemy shield mitigation, Boss Phase 1 Grease Shield (`applyBossPhaseTransition`), Toxic debuff (`TOXIC_DEBUFF_DAMAGE_MULTIPLIER`), Battle Rank (`calculateBattleRank`), kcal estimation (`estimateWorkoutKcal`), counter-attacks + Plank hold blocking, equipment bonuses (`comboWindowBonusMs`), consumable healing, loot drops + 41 tests
- ✅ `src/game/store.ts` — Zustand store with `Map`-safe localStorage persistence (`version: 4`, backwards-compatible `v0–v4` `migrateGameState`), Fit-Coins economy (`addCoins`, `spendCoins`, `buyItem`), daily quest claims (`claimDailyQuest`), 7-day streak tracking, 30-day activity history, Bestiary tracking (`recordMonsterBestiary`), Endless Arena records (`updateEndlessProgress`), 11-achievement sync, per-exercise calibration, language hydration sync
- ✅ `src/game/data/` — `exercises.ts` (4 exercises), `monsters.ts` (8 monsters across 4 archetypes `FAST`/`ARMORED`/`TOXIC`/`BOSS` + `createEndlessWaveMonster`), `items.ts` (10 items across `COMMON`/`RARE`/`EPIC`/`LEGENDARY` rarities + `SHOP_ITEM_IDS`), `levels.ts` (5 progressive campaign stages + drop tables), `dailyQuests.ts` (deterministic local-date Daily Quests & Streak helpers), `achievements.ts` (11 achievements + pure `evaluateNewAchievements`)

#### **Session Layer (100% complete, 12 tests)**
- ✅ `src/session/WorkoutSession.ts` — Coordinator (CV→Exercise→Combat→Audio→Store glue), tempo combo window & decay tracking, matchup & shield & Boss Phase 1 Grease Shield handling, Toxic debuff application & Plank-block cleanse, Fit-Coins & Battle Rank (`S/A/B/C`) & `~kcal` summary, Bestiary encounter/defeat tracking, Endless Arena wave reset support without tearing down camera, ~100ms steady-state HUD throttling, `worldLandmarks` forwarding, localized camera/MediaPipe error mapping, rep & 1s hold-tick damage, counter-attack timer & 1.5s warning telegraph, Screen Wake Lock, auto-pause, audio unlock API + 12 tests

#### **Localization Layer (100% complete)**
- ✅ `src/i18n/ru.ts` & `src/i18n/en.ts` — Full RU/EN translation dictionaries (type-checked `TranslationKey`) covering Junk Slayer 2.0 combat, shop, daily quests, streaks, bestiary analytics, Endless Arena, and PWA
- ✅ `src/i18n/index.ts` & `src/i18n/useTranslation.ts` — Translation helpers & React hook synced with Zustand store

#### **PWA & Offline Assets (100% complete)**
- ✅ `vite.config.ts` & `src/main.tsx` — `vite-plugin-pwa` with Web App Manifest (`id: '/'`, `display: 'standalone'`), `registerSW({ immediate: true })`, `CacheFirst` Service Worker caching for `/mediapipe/`, fonts, and CDN fallbacks
- ✅ `public/mediapipe/` — Locally bundled `pose_landmarker_lite.task` (5.6 MB) and all 6 `@mediapipe/tasks-vision` WASM/JS runtime files for offline execution
- ✅ `public/icon.svg`, `public/pwa-192x192.png`, `public/pwa-512x512.png`, `public/pwa-maskable-512x512.png`, `public/apple-touch-icon.png` — Complete multi-platform PWA & iOS icon set
- ✅ `src/ui/PWAInstallButton.tsx` — In-app Chromium install prompt (`beforeinstallprompt`), iOS Safari installation modal, and `OfflineIndicator`

#### **UI Layer (Complete Junk Slayer 2.0 RPG, Shop, Modes & Metagame)**
- ✅ `src/ui/gameKeys.ts` — Shared lookup dictionary mapping game item/monster/exercise/archetype/rarity/achievement IDs to i18n keys
- ✅ `src/ui/MainMenu.tsx` — Hero RPG card (Fit-Coins, effective stats, Endless record), Daily Quests & 7-day Streak calendar strip with rewards, PWA install CTA, 11-badge Achievements grid, navigation to Campaign/Endless, Inventory/Shop, Bestiary/Analytics, Calibration, Settings
- ✅ `src/ui/LevelSelectScreen.tsx` — Segmented `Campaign | Endless Arena` selector, monster archetypes & weaknesses preview, 4-exercise selector
- ✅ `src/ui/InventoryScreen.tsx` — Segmented `Bag | Shop` tabs with Fit-Coins, 4-tier rarity labels, equipment equip/unequip, consumables (used strictly between battles)
- ✅ `src/ui/BestiaryAnalyticsScreen.tsx` — 7-day workout bar chart, `~kcal` estimate, streak summary, per-exercise totals, and 8-monster Bestiary with unlocked weaknesses/resistances
- ✅ `src/ui/SettingsScreen.tsx` — RU/EN language switcher, Sound/Voice toggles, Front/Rear camera selector, in-app reset confirmation modal
- ✅ `src/ui/BattleScreen.tsx` — Live CV battle HUD with Tempo Combo meter/decay bar, Matchup indicator, Enemy Shield counter, Toxic debuff indicator, 1.5s counter-attack wind-up warning, Plank block/damage popups, boss phase alerts, Victory Rank `S/A/B/C` + Fit-Coins + `~kcal` summary, and seamless multi-wave Endless Arena progression (`Next Wave` vs `Bank Loot & Exit`)
- ✅ `src/ui/CalibrationSandbox.tsx` — Multi-exercise calibration tool (all 4 detectors) with persistent live angle-threshold sliders and localized camera error handling
- ✅ `src/App.tsx` — Root screen router (`MENU`, `LEVEL_SELECT`, `INVENTORY`, `BESTIARY`, `SETTINGS`, `CALIBRATION`, `BATTLE`) + global `OfflineIndicator`

### 6.2 Test Coverage Summary

**Total: 172/172 tests passing across 9 test files (100% ✅)**

| File | Tests | Status |
|------|-------|--------|
| `angleMath.test.ts` | 32 | ✅ Pass |
| `SquatDetector.test.ts` | 31 | ✅ Pass |
| `PushUpDetector.test.ts` | 13 | ✅ Pass |
| `PlankDetector.test.ts` | 17 | ✅ Pass |
| `JumpingJackDetector.test.ts` | 6 | ✅ Pass |
| `PoseTracker.test.ts` | 10 | ✅ Pass |
| `SoundFX.test.ts` | 10 | ✅ Pass |
| `CombatEngine.test.ts` | 41 | ✅ Pass |
| `WorkoutSession.test.ts` | 12 | ✅ Pass |

### 6.3 What's NOT Implemented Yet ❌

#### **Future Polish / Optional Enhancements:**
- ⏳ Automated E2E synthetic webcam stream tests (real-time MediaPipe pose injection in Playwright CI)

### 6.4 File Structure Snapshot

```
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
├── vision/                          ✅ Complete (109 tests)
│   ├── types.ts                    ✅ Interfaces (ExerciseDetector, rep/hold types)
│   ├── angleMath.ts                ✅ Math utils (32 tests)
│   ├── angleMath.test.ts           ✅
│   ├── PoseTracker.ts              ✅ Camera + local MediaPipe + CDN fallback (10 tests)
│   ├── PoseTracker.test.ts         ✅
│   └── exercises/
│       ├── index.ts                ✅ Registry (4 detectors)
│       ├── SquatDetector.ts / .test.ts       ✅ (31 tests)
│       ├── PushUpDetector.ts / .test.ts      ✅ (13 tests)
│       ├── PlankDetector.ts / .test.ts       ✅ (17 tests)
│       └── JumpingJackDetector.ts / .test.ts ✅ (6 tests)
│
├── session/                         ✅ Complete (12 tests)
│   ├── WorkoutSession.ts           ✅ Coordinator, combos/matchups/shields/debuffs, Endless waves, counter-attacks, warning, calibration
│   └── WorkoutSession.test.ts      ✅
│
├── game/                            ✅ Complete (41 tests)
│   ├── types.ts                    ✅ RPG, Combo, Rank, Economy, DailyQuests, Streaks, Bestiary, Endless, Calibration & Achievement interfaces
│   ├── CombatEngine.ts / .test.ts  ✅ Combat, combos, matchups, shields, boss transitions, toxic debuff, ranks, kcal, counter-attacks, gear, consumables (41 tests)
│   ├── store.ts                    ✅ Zustand v4 persist + backwards-compatible v0–v4 migration + Map serializer
│   └── data/
│       ├── exercises.ts            ✅ 4 exercises (rep/hold)
│       ├── monsters.ts             ✅ 8 monsters (4 archetypes) + createEndlessWaveMonster
│       ├── items.ts                ✅ 10 items (4 rarities) + SHOP_ITEM_IDS
│       ├── levels.ts               ✅ 5 campaign stages + drop tables
│       ├── dailyQuests.ts          ✅ Deterministic Daily Quests & 7-day Streak calendar helpers
│       └── achievements.ts         ✅ 11 achievements + pure evaluator
│
├── audio/                           ✅ Complete (10 tests)
│   ├── SoundFX.ts                  ✅ 8 synthesized sounds (incl. WARNING) + unlock check + speak()
│   └── SoundFX.test.ts             ✅
│
├── i18n/                            ✅ Complete
│   ├── index.ts                    ✅ Helpers & language list
│   ├── useTranslation.ts           ✅ React hook synced with store
│   ├── ru.ts                       ✅ Primary Russian translations
│   └── en.ts                       ✅ Secondary English translations
│
└── ui/                              ✅ Complete Junk Slayer 2.0 RPG & PWA UI Flow
    ├── gameKeys.ts                 ✅ Shared entity/archetype/rarity i18n lookup dictionary
    ├── MainMenu.tsx                ✅ Hero profile, Fit-Coins, Daily Quests & 7-day Streak strip, 11-item Achievements, PWA CTA
    ├── LevelSelectScreen.tsx       ✅ Segmented Campaign & Endless Arena selector + archetype/weakness badges
    ├── InventoryScreen.tsx         ✅ Segmented Bag & Fit-Coins Shop (4 rarities, consumables, gear)
    ├── BestiaryAnalyticsScreen.tsx ✅ 7-day workout bar chart, ~kcal, exercise totals & 8-monster Bestiary
    ├── SettingsScreen.tsx          ✅ Language, audio, camera, reset modal
    ├── BattleScreen.tsx            ✅ Live CV arena, Combo meter, Matchups, Shields, Toxic debuff, Rank S/A/B/C & multi-wave Endless flow
    ├── CalibrationSandbox.tsx      ✅ Multi-exercise calibration + angle threshold sliders
    └── PWAInstallButton.tsx        ✅ Chromium/iOS install prompt + OfflineIndicator
```

### 6.5 Build Status

```bash
✅ npm run typecheck  — Strict TypeScript, 0 errors
✅ npm run lint       — ESLint strict boundaries & no-any, 0 errors / 0 warnings
✅ npm test           — 172/172 tests passing (9/9 files)
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

**Latest update:** 2026-11-16 06:18 UTC

**Recent work:**
- ✅ 2026-11-16: Implemented **Junk Slayer 2.0** expansion:
  - **Combat Depth**: Tempo Combo streaks (`x1.0 → x1.25 → x1.5 → x2.0`) with item-extendable combo decay window, exercise matchups (`weakTo` 1.5x / `resistantTo` 0.75x), 4 monster archetypes (`FAST`, `ARMORED`, `TOXIC`, `BOSS`), enemy shields & Boss Phase 1 Grease Shield (`applyBossPhaseTransition`), Toxic debuff (`-25%` damage when unblocked, cleared by Plank block), and Battle Rank (`S/A/B/C`) + `~kcal` calculation.
  - **Game Modes**: Endless Arena (`ENDLESS`) with scaling waves, Boss every 5th wave, seamless `Next Wave` vs `Bank Loot & Exit` without restarting camera, and deterministic local-date Daily Quests.
  - **RPG Economy & Gear**: Fit-Coins rewards & `Bag | Shop` in `InventoryScreen`, `COMMON`/`RARE`/`EPIC`/`LEGENDARY` rarities, and 5 new items (`ISOTONIC_FLASK`, `MEGA_RECOVERY_SMOOTHIE`, `FITNESS_WRISTBANDS`, `TITANIUM_DUMBBELLS`, `CHAMPION_BELT`) with Zustand `v4` backwards-compatible migration.
  - **Metagame & Analytics**: 7-day Workout Streaks + calendar strip, 8-monster Bestiary & 7-day bar chart + per-exercise breakdown (`BestiaryAnalyticsScreen`), 3 new monsters (`FRIES`, `HOT_SAUCE`, `BOSS_PIZZA_EMPEROR`), and 4 new achievements (11 total).
  - Verified cleanly via `typecheck`, `lint`, `vitest` (172/172), `vite build`, and live headless Chromium inspection across desktop (`1440x900`) and mobile (`390x844`).
- ✅ 2026-11-15: Optimized pose recognition and game runtime (`PoseTracker` batched skeleton rendering, adaptive throttling, GPU→CPU fallback, `worldLandmarks` 3D pipeline; detector bilateral/hysteresis improvements; zero-alloc `angle3D`/`JumpingJackDetector`; `WorkoutSession` throttled HUD; 164/164 tests)
- ✅ 2026-11-15: Implemented 1.5s enemy/boss attack wind-up telegraph (`ATTACK_WARNING_WINDOW_MS`, `SoundFX` `'WARNING'`, `BattleScreen` warning HUD) and integrated offline PWA + local MediaPipe assets

**Next session priorities:**
1. Consider E2E Playwright mock-stream harness for automated CV battle regression testing

---

**End of Constitution**