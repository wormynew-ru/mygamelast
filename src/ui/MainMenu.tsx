/**
 * MainMenu - Primary hub with hero RPG profile, Fit-Coins, daily quests & 7-day streak,
 * achievements progress, PWA installation CTA, and screen navigation.
 */

import { motion } from 'framer-motion';
import {
  Swords,
  Backpack,
  Crosshair,
  Settings,
  Play,
  Trophy,
  Coins,
  BookOpen,
  CalendarCheck,
  Sprout,
  FlaskConical,
  Sparkles,
  Calendar,
} from 'lucide-react';
import { isPlotReadyToHarvest } from '../game/data/garden';
import { getActiveSanctuarySynergies, getTotalMixCount } from '../game/data/sanctuary';
import { getAvailableTalentPoints } from '../game/data/talents';
import {
  PROGRAM_MAP,
  TRAINING_PROGRAMS,
  getISOWeekKey,
  getWeeklyChallengeForWeek,
} from '../game/data/programs';
import { MONSTERS } from '../game/data/monsters';
import type { ExerciseId } from '../game/data/exercises';
import { useGameStore, selectEffectivePlayerStats } from '../game/store';
import { ACHIEVEMENTS } from '../game/data/achievements';
import {
  getDailyQuestsForDate,
  getLocalDateKey,
  getQuestProgress,
  getRecentDateKeys,
  type DailyQuestMetric,
} from '../game/data/dailyQuests';
import { useTranslation, type TranslationKey } from '../i18n/useTranslation';
import { PWAInstallButton } from './PWAInstallButton';
import { VoiceToggleButton } from './VoiceControl';
import {
  ACHIEVEMENT_KEYS,
  EXERCISE_NAME_KEYS,
  MONSTER_NAME_KEYS,
  MUTATOR_KEYS,
  PROGRAM_KEYS,
} from './gameKeys';

interface MainMenuProps {
  onOpenCampaign: () => void;
  onQuickBattle: () => void;
  onStartWeeklyChallenge: () => void;
  onStartProgramDay: (levelId: string, exerciseId: ExerciseId, dayIndex: number) => void;
  onGarden: () => void;
  onSanctuary: () => void;
  onTalents: () => void;
  onInventory: () => void;
  onBestiary: () => void;
  onCalibration: () => void;
  onSettings: () => void;
}

const QUEST_TITLE_KEYS: Record<DailyQuestMetric, TranslationKey> = {
  reps: 'quests.repsTitle',
  holdSeconds: 'quests.plankTitle',
  wins: 'quests.winsTitle',
};

export function MainMenu({
  onOpenCampaign,
  onQuickBattle,
  onStartWeeklyChallenge,
  onStartProgramDay,
  onGarden,
  onSanctuary,
  onTalents,
  onInventory,
  onBestiary,
  onCalibration,
  onSettings,
}: MainMenuProps) {
  const { t } = useTranslation();
  const basePlayer = useGameStore((state) => state.player);
  const coins = useGameStore((state) => state.coins);
  const equippedItems = useGameStore((state) => state.inventory.equippedItems);
  const inventoryItems = useGameStore((state) => state.inventory.items);
  const workoutStats = useGameStore((state) => state.workoutStats);
  const completedLevels = useGameStore((state) => state.completedLevels);
  const unlockedAchievements = useGameStore((state) => state.unlockedAchievements);
  const streak = useGameStore((state) => state.streak);
  const dailyQuests = useGameStore((state) => state.dailyQuests);
  const dailyHistory = useGameStore((state) => state.dailyHistory);
  const endlessStats = useGameStore((state) => state.endlessStats);
  const garden = useGameStore((state) => state.garden);
  const sanctuary = useGameStore((state) => state.sanctuary);
  const talents = useGameStore((state) => state.talents);
  const programs = useGameStore((state) => state.programs);
  const weeklyChallenge = useGameStore((state) => state.weeklyChallenge);
  const startProgram = useGameStore((state) => state.startProgram);
  const abandonProgram = useGameStore((state) => state.abandonProgram);
  const claimDailyQuest = useGameStore((state) => state.claimDailyQuest);
  const syncAchievements = useGameStore((state) => state.syncAchievements);

  const readyHarvestCount = garden.plots
    .slice(0, garden.unlockedPlots)
    .filter((p) => isPlotReadyToHarvest(p)).length;
  const activeWeedCount = garden.plots
    .slice(0, garden.unlockedPlots)
    .filter((p) => p.weedId !== null).length;
  const totalMixes = getTotalMixCount(sanctuary.mixInventory);
  const activeSynergies = getActiveSanctuarySynergies(sanctuary.activeBuffs);
  const availableTalentPoints = getAvailableTalentPoints(basePlayer.level, talents);

  const weekKey = getISOWeekKey();
  const weeklySpec = getWeeklyChallengeForWeek(weekKey);
  const weeklyBoss = MONSTERS[weeklySpec.monsterId] ?? MONSTERS.BOSS_KING_BURGER;
  const weeklyCompletedThisWeek = weeklyChallenge.completedWeekKeys.includes(weekKey);
  const weeklyBestRank = weeklyChallenge.bestRankByWeek[weekKey];

  const effectivePlayer = selectEffectivePlayerStats(useGameStore.getState());
  const attackBonus = effectivePlayer.attack - basePlayer.attack;
  const defenseBonus = effectivePlayer.defense - basePlayer.defense;

  let totalInventoryCount = 0;
  inventoryItems.forEach((qty) => {
    totalInventoryCount += qty;
  });

  const xpPercent = Math.min(100, Math.round((basePlayer.xp / basePlayer.xpToNextLevel) * 100));
  const hpPercent = Math.min(100, Math.round((effectivePlayer.hp / effectivePlayer.maxHp) * 100));
  const unlockedSet = new Set(unlockedAchievements);

  const todayKey = getLocalDateKey();
  const todaysQuests = getDailyQuestsForDate(todayKey);
  const normalizedQuests =
    dailyQuests.date === todayKey
      ? dailyQuests
      : { date: todayKey, claimedIds: [], repsToday: 0, holdSecondsToday: 0, winsToday: 0 };
  const recent7Days = getRecentDateKeys(7);

  const handleClaimQuest = (questId: string) => {
    const reward = claimDailyQuest(questId, todayKey);
    if (reward) {
      syncAchievements();
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Bar (Strict 3-zone contract) */}
      <header className="border-b border-slate-800 bg-slate-950/90">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <span className="font-display text-2xl font-bold tracking-tight text-slate-100 whitespace-nowrap shrink-0">
            {t('menu.title')}
          </span>

          <nav className="hidden md:flex items-center gap-5 text-sm font-medium text-slate-400">
            <button
              onClick={onOpenCampaign}
              className="hover:text-slate-100 transition-colors whitespace-nowrap shrink-0"
            >
              {t('menu.startBattle')}
            </button>
            <button
              onClick={onGarden}
              className="hover:text-emerald-300 transition-colors whitespace-nowrap shrink-0"
            >
              {t('menu.garden')}
            </button>
            <button
              onClick={onSanctuary}
              className="hover:text-emerald-300 transition-colors whitespace-nowrap shrink-0"
            >
              {t('menu.sanctuary')}
            </button>
            <button
              onClick={onTalents}
              className="hover:text-amber-300 transition-colors whitespace-nowrap shrink-0"
            >
              {t('menu.talents')}
            </button>
            <button
              onClick={onInventory}
              className="hover:text-slate-100 transition-colors whitespace-nowrap shrink-0"
            >
              {t('menu.shopAndGear')}
            </button>
            <button
              onClick={onBestiary}
              className="hover:text-slate-100 transition-colors whitespace-nowrap shrink-0"
            >
              {t('menu.bestiary')}
            </button>
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <VoiceToggleButton compact />
            <PWAInstallButton />
            <button
              onClick={onQuickBattle}
              data-start="true"
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            >
              <Play className="w-4 h-4" />
              <span>{t('menu.quickBattle')}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-10 flex flex-col justify-center gap-8">
        {/* Hero Headline */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-8 border-b border-slate-800"
        >
          <div className="max-w-2xl">
            <p className="text-sm text-slate-400 mb-2">{t('menu.version')}</p>
            <h1 className="font-display text-5xl sm:text-6xl font-bold tracking-tight text-white [text-wrap:balance]">
              {t('menu.title')}
            </h1>
            <p className="text-slate-300 text-base sm:text-lg mt-3 max-w-xl">
              {t('menu.subtitle')}
            </p>
          </div>

          <button
            onClick={onOpenCampaign}
            className="inline-flex items-center justify-center gap-2.5 px-7 py-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-base rounded-lg transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
          >
            <Swords className="w-5 h-5" />
            <span>{t('menu.startBattle')}</span>
          </button>
        </motion.section>

        {/* Hero Stats + Navigation Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Hero RPG Card */}
          <section className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col justify-between gap-6">
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="text-lg font-semibold text-white">{t('stats.title')}</h2>
              <div className="flex items-center gap-4 font-numeric text-sm font-semibold">
                <span className="inline-flex items-center gap-1 text-amber-400">
                  <Coins className="w-4 h-4" />
                  <span>{coins}</span>
                </span>
                <span className="text-slate-600" aria-hidden="true">·</span>
                <span className="text-amber-400">
                  {t('stats.level')} {basePlayer.level}
                </span>
              </div>
            </div>

            {/* HP & XP Progress */}
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1.5">
                  <span>{t('stats.hp')}</span>
                  <span className="font-numeric text-slate-200">
                    {effectivePlayer.hp} / {effectivePlayer.maxHp}
                  </span>
                </div>
                <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-[width] duration-200"
                    style={{ width: `${hpPercent}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1.5">
                  <span>{t('stats.xp')}</span>
                  <span className="font-numeric text-slate-200">
                    {basePlayer.xp} / {basePlayer.xpToNextLevel}
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500 transition-[width] duration-200"
                    style={{ width: `${xpPercent}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Combat & Workout Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-slate-800">
              <div>
                <div className="text-xs text-slate-400">{t('stats.attack')}</div>
                <div className="font-numeric text-xl font-bold text-white mt-0.5">
                  {effectivePlayer.attack}
                  {attackBonus > 0 && (
                    <span className="text-xs text-emerald-400 ml-1">(+{attackBonus})</span>
                  )}
                </div>
              </div>

              <div>
                <div className="text-xs text-slate-400">{t('stats.defense')}</div>
                <div className="font-numeric text-xl font-bold text-white mt-0.5">
                  {effectivePlayer.defense}
                  {defenseBonus > 0 && (
                    <span className="text-xs text-emerald-400 ml-1">(+{defenseBonus})</span>
                  )}
                </div>
              </div>

              <div>
                <div className="text-xs text-slate-400">{t('stats.crit')}</div>
                <div className="font-numeric text-xl font-bold text-white mt-0.5">
                  {Math.round(effectivePlayer.critChance * 100)}%
                </div>
              </div>

              <div>
                <div className="text-xs text-slate-400">{t('stats.tonnage')}</div>
                <div className="font-numeric text-lg font-semibold text-amber-300 mt-0.5">
                  {workoutStats.totalTonnageKg ?? 0} {t('loadout.kgUnit')}
                </div>
              </div>

              <div>
                <div className="text-xs text-slate-400">{t('stats.totalReps')}</div>
                <div className="font-numeric text-lg font-semibold text-slate-200 mt-0.5">
                  {workoutStats.totalReps}
                </div>
              </div>

              <div>
                <div className="text-xs text-slate-400">{t('stats.bestWave')}</div>
                <div className="font-numeric text-lg font-semibold text-emerald-400 mt-0.5">
                  {endlessStats.bestWave}
                </div>
              </div>

              <div>
                <div className="text-xs text-slate-400">{t('stats.circuits')}</div>
                <div className="font-numeric text-lg font-semibold text-sky-400 mt-0.5">
                  {workoutStats.circuitsCompleted ?? 0}
                </div>
              </div>

              <div>
                <div className="text-xs text-slate-400">{t('stats.defeated')}</div>
                <div className="font-numeric text-lg font-semibold text-slate-200 mt-0.5">
                  {workoutStats.monstersDefeated} · {completedLevels.length}/5
                </div>
              </div>
            </div>
          </section>

          {/* Secondary Actions Column */}
          <section className="lg:col-span-5 flex flex-col gap-3 justify-between">
            <button
              onClick={onGarden}
              className="flex-1 bg-emerald-950/35 hover:bg-emerald-950/60 border border-emerald-700/60 rounded-xl p-4 text-left transition-colors flex items-center justify-between gap-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            >
              <div>
                <div className="text-base font-semibold text-white">{t('menu.garden')}</div>
                <div className="text-xs text-emerald-300/90 mt-0.5 font-numeric">
                  {activeWeedCount > 0
                    ? `${t('garden.weedAlert')} (${activeWeedCount})`
                    : readyHarvestCount > 0
                      ? `${t('garden.readyBadge')} (${readyHarvestCount})`
                      : t('menu.gardenDesc')}
                </div>
              </div>
              <Sprout className="w-5 h-5 text-emerald-400 shrink-0" />
            </button>

            <button
              onClick={onSanctuary}
              className="flex-1 bg-slate-900 hover:bg-slate-800/80 border border-slate-800 hover:border-emerald-600/60 rounded-xl p-4 text-left transition-colors flex items-center justify-between gap-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            >
              <div>
                <div className="text-base font-semibold text-white">{t('menu.sanctuary')}</div>
                <div className="text-xs text-slate-400 mt-0.5 font-numeric">
                  {sanctuary.activeBuffs.length > 0 ? (
                    <span className="text-emerald-400 font-semibold">
                      {t('sanctuary.alreadyArmed')}: {sanctuary.activeBuffs.length}
                      {activeSynergies.length > 0 ? (
                        <span className="text-amber-300 ml-1">
                          ({activeSynergies.length} {t('sanctuary.synergyActive').toLowerCase()})
                        </span>
                      ) : null}{' '}
                      ·{' '}
                    </span>
                  ) : null}
                  {totalMixes > 0
                    ? `${t('sanctuary.inStock')}: ${totalMixes}`
                    : t('menu.sanctuaryDesc')}
                </div>
              </div>
              <FlaskConical className="w-5 h-5 text-emerald-400 shrink-0" />
            </button>

            <button
              onClick={onTalents}
              className={`flex-1 bg-slate-900 hover:bg-slate-800/80 border rounded-xl p-4 text-left transition-colors flex items-center justify-between gap-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                availableTalentPoints > 0 ? 'border-amber-500/60' : 'border-slate-800'
              }`}
            >
              <div>
                <div className="text-base font-semibold text-white">{t('menu.talents')}</div>
                <div className="text-xs text-slate-400 mt-0.5 font-numeric">
                  {availableTalentPoints > 0 ? (
                    <span className="text-amber-400 font-semibold">
                      {t('talents.availablePoints')}: {availableTalentPoints}
                    </span>
                  ) : (
                    t('menu.talentsDesc')
                  )}
                </div>
              </div>
              <Sparkles
                className={`w-5 h-5 shrink-0 ${
                  availableTalentPoints > 0 ? 'text-amber-400' : 'text-slate-400'
                }`}
              />
            </button>

            <button
              onClick={onInventory}
              className="flex-1 bg-slate-900 hover:bg-slate-800/80 border border-slate-800 rounded-xl p-4 text-left transition-colors flex items-center justify-between gap-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              <div>
                <div className="text-base font-semibold text-white">{t('menu.shopAndGear')}</div>
                <div className="text-xs text-slate-400 mt-0.5 font-numeric">
                  {totalInventoryCount} {t('inventory.qty')} · {equippedItems.length}{' '}
                  {t('inventory.equipped')} · {coins} {t('stats.coins')}
                </div>
              </div>
              <Backpack className="w-5 h-5 text-slate-400 shrink-0" />
            </button>

            <button
              onClick={onBestiary}
              className="flex-1 bg-slate-900 hover:bg-slate-800/80 border border-slate-800 rounded-xl p-4 text-left transition-colors flex items-center justify-between gap-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              <div>
                <div className="text-base font-semibold text-white">{t('menu.bestiary')}</div>
                <div className="text-xs text-slate-400 mt-0.5">{t('menu.bestiaryDesc')}</div>
              </div>
              <BookOpen className="w-5 h-5 text-slate-400 shrink-0" />
            </button>

            <button
              onClick={onCalibration}
              className="flex-1 bg-slate-900 hover:bg-slate-800/80 border border-slate-800 rounded-xl p-4 text-left transition-colors flex items-center justify-between gap-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              <div>
                <div className="text-base font-semibold text-white">{t('menu.calibration')}</div>
                <div className="text-xs text-slate-400 mt-0.5">{t('calibration.instructions')}</div>
              </div>
              <Crosshair className="w-5 h-5 text-slate-400 shrink-0" />
            </button>

            <button
              onClick={onSettings}
              className="flex-1 bg-slate-900 hover:bg-slate-800/80 border border-slate-800 rounded-xl p-4 text-left transition-colors flex items-center justify-between gap-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              <div>
                <div className="text-base font-semibold text-white">{t('menu.settings')}</div>
                <div className="text-xs text-slate-400 mt-0.5">{t('settings.subtitle')}</div>
              </div>
              <Settings className="w-5 h-5 text-slate-400 shrink-0" />
            </button>
          </section>
        </div>

        {/* Weekly Challenge & Training Programs Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Weekly Challenge */}
          <section className="lg:col-span-5 bg-slate-900 border border-amber-500/40 rounded-xl p-6 flex flex-col justify-between gap-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Swords className="w-4 h-4 text-amber-400" />
                  <h2 className="text-base font-semibold text-white">{t('weekly.title')}</h2>
                </div>
                <span className="font-numeric text-xs font-semibold text-amber-400">
                  {t('weekly.weekLabel')} {weeklySpec.weekKey}
                </span>
              </div>

              <div className="flex items-center gap-3.5 bg-slate-950 border border-slate-800 rounded-lg p-3.5">
                <span className="text-3xl shrink-0" aria-hidden="true">
                  {weeklyBoss.sprite}
                </span>
                <div className="min-w-0 space-y-0.5">
                  <div className="text-sm font-bold text-white truncate">
                    {MONSTER_NAME_KEYS[weeklySpec.monsterId]
                      ? t(MONSTER_NAME_KEYS[weeklySpec.monsterId])
                      : weeklyBoss.name}
                  </div>
                  <div className="text-xs text-slate-400">
                    {t('weekly.exerciseLabel')}:{' '}
                    <span className="text-emerald-400 font-medium">
                      {t(EXERCISE_NAME_KEYS[weeklySpec.recommendedExerciseId])}
                    </span>
                  </div>
                  <div className="text-xs text-rose-300">
                    {t('weekly.mutatorsLabel')}:{' '}
                    {weeklySpec.mutators.map((m) => t(MUTATOR_KEYS[m].name)).join(' · ')}
                  </div>
                </div>
              </div>

              <p className="text-xs text-slate-400">
                {weeklyCompletedThisWeek ? t('weekly.repeatRewardNote') : t('weekly.firstRewardNote')}
              </p>

              {weeklyCompletedThisWeek && (
                <div className="text-xs font-numeric text-emerald-400 font-semibold">
                  {t('weekly.completed')}
                  {weeklyBestRank ? ` · ${t('weekly.bestRank')}: ${weeklyBestRank}` : ''}
                </div>
              )}
            </div>

            <button
              onClick={onStartWeeklyChallenge}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm rounded-lg transition-colors whitespace-nowrap"
            >
              <Swords className="w-4 h-4" />
              <span>{t('weekly.launch')}</span>
            </button>
          </section>

          {/* 3-7 Day Training Programs */}
          <section className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col justify-between gap-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-sky-400" />
                <h2 className="text-base font-semibold text-white">{t('programs.title')}</h2>
              </div>
              <span className="font-numeric text-xs text-slate-400">
                {t('programs.completedCount')}:{' '}
                <span className="text-white font-semibold">{programs.totalProgramsFinished}</span>
              </span>
            </div>

            {programs.active && PROGRAM_MAP[programs.active.programId] ? (
              (() => {
                const activeState = programs.active;
                const def = PROGRAM_MAP[activeState.programId];
                const dayPlan = def.days[activeState.currentDayIndex] ?? def.days[0];
                return (
                  <div className="space-y-4 flex-1 flex flex-col justify-between">
                    <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-3">
                      <div className="flex items-baseline justify-between gap-3">
                        <div className="text-sm font-bold text-white">
                          {def.icon} {t(PROGRAM_KEYS[def.id].name)}
                        </div>
                        <span className="font-numeric text-xs text-sky-400 font-semibold">
                          {t('programs.dayLabel')} {activeState.currentDayIndex + 1}/{def.durationDays}
                        </span>
                      </div>

                      <div className="grid grid-cols-7 gap-1.5">
                        {def.days.map((day, idx) => {
                          const done = activeState.completedDays.includes(idx);
                          const isCurrent = idx === activeState.currentDayIndex;
                          return (
                            <div
                              key={day.dayNumber}
                              className={`text-center py-1.5 rounded text-xs font-numeric font-semibold border ${
                                done
                                  ? 'bg-emerald-950/60 border-emerald-600 text-emerald-300'
                                  : isCurrent
                                    ? 'bg-sky-950/60 border-sky-500 text-sky-300'
                                    : 'bg-slate-900 border-slate-800 text-slate-500'
                              }`}
                            >
                              {day.dayNumber}
                            </div>
                          );
                        })}
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300">
                        <span>
                          {t(EXERCISE_NAME_KEYS[dayPlan.exerciseId])} ·{' '}
                          <span className="text-slate-400">{dayPlan.levelId}</span>
                        </span>
                        <span className="font-numeric text-amber-400">
                          +{dayPlan.bonusCoins} {t('stats.coins')} · +{dayPlan.bonusXp} XP
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        onClick={() =>
                          onStartProgramDay(
                            dayPlan.levelId,
                            dayPlan.exerciseId,
                            activeState.currentDayIndex
                          )
                        }
                        className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-sm rounded-lg transition-colors whitespace-nowrap"
                      >
                        <Play className="w-4 h-4" />
                        <span>
                          {t('programs.launchToday')} {activeState.currentDayIndex + 1}
                        </span>
                      </button>
                      <button
                        onClick={abandonProgram}
                        className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap"
                      >
                        {t('programs.abandon')}
                      </button>
                    </div>
                  </div>
                );
              })()
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-slate-400">{t('programs.chooseHint')}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {TRAINING_PROGRAMS.map((prog) => {
                    const isFinishedBefore = programs.completedProgramIds.includes(prog.id);
                    return (
                      <div
                        key={prog.id}
                        className="bg-slate-950 border border-slate-800 rounded-lg p-3.5 flex flex-col justify-between gap-2.5"
                      >
                        <div>
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="text-sm font-semibold text-white">
                              {prog.icon} {t(PROGRAM_KEYS[prog.id].name)}
                            </span>
                            {isFinishedBefore && (
                              <span className="text-[11px] font-semibold text-emerald-400 shrink-0">
                                {t('programs.doneTag')}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 mt-1">
                            {t(PROGRAM_KEYS[prog.id].desc)}
                          </p>
                        </div>
                        <div className="flex items-center justify-between gap-2 pt-1">
                          <span className="font-numeric text-[11px] text-amber-400">
                            +{prog.completionCoins} {t('stats.coins')} · +{prog.completionXp} XP
                          </span>
                          <button
                            onClick={() => startProgram(prog.id)}
                            className="px-3 py-1 bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-xs rounded-md transition-colors whitespace-nowrap"
                          >
                            {t('programs.start')}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        </div>

        {/* Daily Quests & 7-Day Streak Section */}
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <CalendarCheck className="w-4 h-4 text-emerald-400" />
              <h2 className="text-base font-semibold text-white">{t('quests.title')}</h2>
            </div>

            <div className="flex items-center gap-4 text-xs font-numeric">
              <span className="text-emerald-400 font-semibold">
                {t('quests.streakLabel')}: {streak.current} {t('quests.daysUnit')}
              </span>
              <span className="text-slate-400">
                {t('quests.streakBest')}: {streak.best} {t('quests.daysUnit')}
              </span>
              <div className="flex items-center gap-1" aria-label={t('quests.streakLabel')}>
                {recent7Days.map((dateKey) => {
                  const active = Boolean(
                    dailyHistory[dateKey] &&
                      (dailyHistory[dateKey].reps > 0 ||
                        dailyHistory[dateKey].holdSeconds > 0 ||
                        dailyHistory[dateKey].battlesWon > 0)
                  );
                  return (
                    <span
                      key={dateKey}
                      title={dateKey}
                      className={`w-5 h-5 rounded text-[10px] flex items-center justify-center border ${
                        active
                          ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                          : 'bg-slate-950 border-slate-800 text-slate-600'
                      }`}
                    >
                      {dateKey.slice(8)}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {todaysQuests.map((quest) => {
              const current = getQuestProgress(quest, normalizedQuests);
              const pct = Math.min(100, Math.round((current / quest.target) * 100));
              const isClaimed = normalizedQuests.claimedIds.includes(quest.id);
              const isReady = current >= quest.target && !isClaimed;

              return (
                <div
                  key={quest.id}
                  className="bg-slate-950 border border-slate-800 rounded-lg p-4 flex flex-col justify-between gap-3"
                >
                  <div>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-semibold text-white">
                        {t(QUEST_TITLE_KEYS[quest.metric])}
                      </span>
                      <span className="font-numeric text-xs text-slate-400 shrink-0">
                        {Math.min(current, quest.target)} / {quest.target}
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden mt-2">
                      <div
                        className="h-full bg-emerald-500 transition-[width] duration-200"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1">
                    <span className="font-numeric text-xs text-amber-400">
                      +{quest.rewardCoins} {t('stats.coins')} · +{quest.rewardXp} XP
                    </span>
                    <button
                      onClick={() => handleClaimQuest(quest.id)}
                      disabled={!isReady}
                      className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                        isClaimed
                          ? 'bg-slate-800 text-emerald-400'
                          : isReady
                          ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                          : 'bg-slate-900 text-slate-500 border border-slate-800 cursor-not-allowed'
                      }`}
                    >
                      {isClaimed ? t('quests.claimed') : t('quests.claim')}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Achievements Progress Section */}
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-400" />
              <h2 className="text-base font-semibold text-white">{t('achievements.title')}</h2>
            </div>
            <span className="font-numeric text-xs font-semibold text-slate-400">
              {unlockedAchievements.length} / {ACHIEVEMENTS.length}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {ACHIEVEMENTS.map((achievement) => {
              const unlocked = unlockedSet.has(achievement.id);
              const keys = ACHIEVEMENT_KEYS[achievement.id];

              return (
                <div
                  key={achievement.id}
                  className={`rounded-lg border p-3.5 transition-colors ${
                    unlocked
                      ? 'bg-slate-950 border-amber-500/40'
                      : 'bg-slate-950/60 border-slate-800 opacity-65'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xl leading-none" aria-hidden="true">
                      {achievement.icon}
                    </span>
                    <span
                      className={`text-[11px] font-semibold ${
                        unlocked ? 'text-emerald-400' : 'text-slate-500'
                      }`}
                    >
                      {unlocked ? t('achievements.unlockedBadge') : t('achievements.lockedBadge')}
                    </span>
                  </div>
                  <div className="text-sm font-semibold text-white mt-2">{t(keys.name)}</div>
                  <div className="text-xs text-slate-400 mt-0.5 leading-snug">
                    {t(keys.description)}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
