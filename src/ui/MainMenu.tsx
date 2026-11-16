/**
 * MainMenu - Primary hub with hero RPG profile, aggregate workout stats,
 * achievements progress, PWA installation CTA, and screen navigation.
 */

import { motion } from 'framer-motion';
import { Swords, Backpack, Crosshair, Settings, Play, Trophy } from 'lucide-react';
import { useGameStore, selectEffectivePlayerStats } from '../game/store';
import { ACHIEVEMENTS, type AchievementId } from '../game/data/achievements';
import { useTranslation, type TranslationKey } from '../i18n/useTranslation';
import { PWAInstallButton } from './PWAInstallButton';

interface MainMenuProps {
  onOpenCampaign: () => void;
  onQuickBattle: () => void;
  onInventory: () => void;
  onCalibration: () => void;
  onSettings: () => void;
}

const ACHIEVEMENT_KEYS: Record<
  AchievementId,
  { name: TranslationKey; description: TranslationKey }
> = {
  FIRST_REP: {
    name: 'achievement.FIRST_REP.name',
    description: 'achievement.FIRST_REP.description',
  },
  FIFTY_REPS: {
    name: 'achievement.FIFTY_REPS.name',
    description: 'achievement.FIFTY_REPS.description',
  },
  PLANK_SURVIVOR: {
    name: 'achievement.PLANK_SURVIVOR.name',
    description: 'achievement.PLANK_SURVIVOR.description',
  },
  FIRST_VICTORY: {
    name: 'achievement.FIRST_VICTORY.name',
    description: 'achievement.FIRST_VICTORY.description',
  },
  BOSS_SLAYER: {
    name: 'achievement.BOSS_SLAYER.name',
    description: 'achievement.BOSS_SLAYER.description',
  },
  GEAR_COLLECTOR: {
    name: 'achievement.GEAR_COLLECTOR.name',
    description: 'achievement.GEAR_COLLECTOR.description',
  },
  VETERAN_HERO: {
    name: 'achievement.VETERAN_HERO.name',
    description: 'achievement.VETERAN_HERO.description',
  },
};

export function MainMenu({
  onOpenCampaign,
  onQuickBattle,
  onInventory,
  onCalibration,
  onSettings,
}: MainMenuProps) {
  const { t } = useTranslation();
  const basePlayer = useGameStore((state) => state.player);
  const equippedItems = useGameStore((state) => state.inventory.equippedItems);
  const inventoryItems = useGameStore((state) => state.inventory.items);
  const workoutStats = useGameStore((state) => state.workoutStats);
  const completedLevels = useGameStore((state) => state.completedLevels);
  const unlockedAchievements = useGameStore((state) => state.unlockedAchievements);

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

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Bar */}
      <header className="border-b border-slate-800 bg-slate-950/90">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <span className="font-display text-2xl font-bold tracking-tight text-slate-100 whitespace-nowrap shrink-0">
            {t('menu.title')}
          </span>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-400">
            <button
              onClick={onOpenCampaign}
              className="hover:text-slate-100 transition-colors whitespace-nowrap shrink-0"
            >
              {t('menu.startBattle')}
            </button>
            <button
              onClick={onInventory}
              className="hover:text-slate-100 transition-colors whitespace-nowrap shrink-0"
            >
              {t('menu.inventory')}
            </button>
            <button
              onClick={onCalibration}
              className="hover:text-slate-100 transition-colors whitespace-nowrap shrink-0"
            >
              {t('menu.calibration')}
            </button>
            <button
              onClick={onSettings}
              className="hover:text-slate-100 transition-colors whitespace-nowrap shrink-0"
            >
              {t('menu.settings')}
            </button>
          </nav>

          <div className="flex items-center gap-2.5 shrink-0">
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
              <span className="font-numeric text-sm text-amber-400 font-semibold">
                {t('stats.level')} {basePlayer.level}
              </span>
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
                    className="h-full bg-emerald-500 transition-all duration-200"
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
                    className="h-full bg-amber-500 transition-all duration-200"
                    style={{ width: `${xpPercent}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Combat & Workout Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-800">
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
                <div className="text-xs text-slate-400">{t('stats.totalReps')}</div>
                <div className="font-numeric text-lg font-semibold text-slate-200 mt-0.5">
                  {workoutStats.totalReps}
                </div>
              </div>

              <div>
                <div className="text-xs text-slate-400">{t('stats.totalHold')}</div>
                <div className="font-numeric text-lg font-semibold text-slate-200 mt-0.5">
                  {workoutStats.totalHoldSeconds}
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
              onClick={onInventory}
              className="flex-1 bg-slate-900 hover:bg-slate-800/80 border border-slate-800 rounded-xl p-5 text-left transition-colors flex items-center justify-between gap-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              <div>
                <div className="text-base font-semibold text-white">{t('menu.inventory')}</div>
                <div className="text-xs text-slate-400 mt-1 font-numeric">
                  {totalInventoryCount} {t('inventory.qty')} · {equippedItems.length}{' '}
                  {t('inventory.equipped')}
                </div>
              </div>
              <Backpack className="w-5 h-5 text-slate-400 shrink-0" />
            </button>

            <button
              onClick={onCalibration}
              className="flex-1 bg-slate-900 hover:bg-slate-800/80 border border-slate-800 rounded-xl p-5 text-left transition-colors flex items-center justify-between gap-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              <div>
                <div className="text-base font-semibold text-white">{t('menu.calibration')}</div>
                <div className="text-xs text-slate-400 mt-1">{t('calibration.instructions')}</div>
              </div>
              <Crosshair className="w-5 h-5 text-slate-400 shrink-0" />
            </button>

            <button
              onClick={onSettings}
              className="flex-1 bg-slate-900 hover:bg-slate-800/80 border border-slate-800 rounded-xl p-5 text-left transition-colors flex items-center justify-between gap-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              <div>
                <div className="text-base font-semibold text-white">{t('menu.settings')}</div>
                <div className="text-xs text-slate-400 mt-1">{t('settings.subtitle')}</div>
              </div>
              <Settings className="w-5 h-5 text-slate-400 shrink-0" />
            </button>
          </section>
        </div>

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
