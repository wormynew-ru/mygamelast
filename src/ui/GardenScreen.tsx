/**
 * GardenScreen - Personal Fitness Garden hub.
 * Spend Fit-Coins on seeds, garden plots, and watering can upgrades; grow crops with water & workouts;
 * harvest rewards; and defend plots in live camera-tracked Weed Battles.
 */

import { useRef, useState } from 'react';
import {
  ArrowLeft,
  Coins,
  Droplets,
  FlaskConical,
  Lock,
  Sparkles,
  Sprout,
  Swords,
  ArrowUpCircle,
  X,
} from 'lucide-react';
import { EXERCISES, type ExerciseId } from '../game/data/exercises';
import {
  MAX_GARDEN_PLOTS,
  PLOT_UNLOCK_COSTS,
  QUICK_WEED_CLEAR_COST,
  SEEDS,
  SEED_ORDER,
  WATERING_CANS,
  WATER_REFILL_COST,
  getNextPlotUnlockCost,
  getNextWateringCanTier,
  getPlantStage,
  getPlantVisualEmoji,
  isPlotReadyToHarvest,
} from '../game/data/garden';
import {
  SANCTUARY_MIX_BLUEPRINTS,
  getTotalCropCount,
  isMixReadyToCraft,
} from '../game/data/sanctuary';
import { ITEMS } from '../game/data/items';
import { MONSTERS } from '../game/data/monsters';
import { useGameStore } from '../game/store';
import type { SeedId, WateringCanTier, WeedId } from '../game/types';
import { useTranslation, type TranslationKey } from '../i18n/useTranslation';
import {
  ARCHETYPE_KEYS,
  EXERCISE_NAME_KEYS,
  ITEM_NAME_KEYS,
  MONSTER_DESC_KEYS,
  MONSTER_NAME_KEYS,
  RARITY_KEYS,
  RARITY_TEXT_CLASS,
  SANCTUARY_MIX_KEYS,
  SEED_KEYS,
  WATERING_CAN_KEYS,
} from './gameKeys';
import { VoiceToggleButton, useVoiceCommandHandler } from './VoiceControl';

interface GardenScreenProps {
  onBack: () => void;
  onStartWeedBattle: (plotId: number, weedId: WeedId, exerciseId: ExerciseId) => void;
  onOpenSanctuary?: () => void;
}

const STAGE_KEYS: Record<ReturnType<typeof getPlantStage>, TranslationKey> = {
  EMPTY: 'garden.stage.EMPTY',
  SEEDLING: 'garden.stage.SEEDLING',
  SPROUT: 'garden.stage.SPROUT',
  BUDDING: 'garden.stage.BUDDING',
  MATURE: 'garden.stage.MATURE',
};

export function GardenScreen({ onBack, onStartWeedBattle, onOpenSanctuary }: GardenScreenProps) {
  const { t } = useTranslation();

  const coins = useGameStore((state) => state.coins);
  const garden = useGameStore((state) => state.garden);
  const buySeed = useGameStore((state) => state.buySeed);
  const plantSeed = useGameStore((state) => state.plantSeed);
  const waterPlot = useGameStore((state) => state.waterPlot);
  const waterAllPlots = useGameStore((state) => state.waterAllPlots);
  const upgradeWateringCan = useGameStore((state) => state.upgradeWateringCan);
  const refillWateringCan = useGameStore((state) => state.refillWateringCan);
  const unlockGardenPlot = useGameStore((state) => state.unlockGardenPlot);
  const harvestPlot = useGameStore((state) => state.harvestPlot);
  const clearPlotWeedWithCoins = useGameStore((state) => state.clearPlotWeedWithCoins);
  const triggerGardenWeed = useGameStore((state) => state.triggerGardenWeed);

  const [shopTab, setShopTab] = useState<'SEEDS' | 'TOOLS' | 'SANCTUARY'>('SEEDS');
  const [feedbackBanner, setFeedbackBanner] = useState<string | null>(null);
  const [weedModal, setWeedModal] = useState<{ plotId: number; weedId: WeedId } | null>(null);
  const [selectedWeedExercise, setSelectedWeedExercise] = useState<ExerciseId>('SQUAT');
  const shopSectionRef = useRef<HTMLElement | null>(null);

  const currentCan = WATERING_CANS[garden.wateringCanTier];
  const nextTier = getNextWateringCanTier(garden.wateringCanTier);
  const nextCan = nextTier ? WATERING_CANS[nextTier] : null;
  const nextPlotCost = getNextPlotUnlockCost(garden.unlockedPlots);
  const waterPct = Math.round((garden.waterCharges / currentCan.maxCharges) * 100);

  const openWeedModalForPlot = (plotId: number, weedId: WeedId) => {
    const weedTemplate = MONSTERS[weedId];
    setSelectedWeedExercise(weedTemplate?.weakTo ?? 'SQUAT');
    setWeedModal({ plotId, weedId });
  };

  const handleWeedPatrol = () => {
    const existingInfested = garden.plots
      .slice(0, garden.unlockedPlots)
      .find((p) => p.weedId !== null);
    if (existingInfested && existingInfested.weedId) {
      openWeedModalForPlot(existingInfested.id, existingInfested.weedId);
      return;
    }

    const spawnedId = triggerGardenWeed();
    if (spawnedId !== null) {
      const updatedPlot = useGameStore.getState().garden.plots[spawnedId];
      if (updatedPlot?.weedId) {
        openWeedModalForPlot(spawnedId, updatedPlot.weedId);
      }
    }
  };

  const handleHarvest = (plotId: number) => {
    const plot = garden.plots[plotId];
    if (!plot?.seedId) return;
    const seedId = plot.seedId;
    const reward = harvestPlot(plotId);
    if (!reward) return;

    const parts = [
      `${t('garden.harvestToast')}: ${SEEDS[seedId].icon} ${t(SEED_KEYS[seedId].name)} ×${reward.cropQty}`,
      `+${reward.xp} XP`,
    ];
    if (reward.healHp > 0) {
      parts.push(`+${reward.healHp} HP`);
    }
    if (reward.leveledUp) {
      parts.push(t('battle.levelUp'));
    }
    if (reward.droppedItemId) {
      const itemName = ITEM_NAME_KEYS[reward.droppedItemId]
        ? t(ITEM_NAME_KEYS[reward.droppedItemId])
        : ITEMS[reward.droppedItemId]?.name;
      if (itemName) parts.push(itemName);
    }
    setFeedbackBanner(parts.join(' · '));
  };

  const handleHarvestAll = () => {
    const cropTotals: Partial<Record<SeedId, number>> = {};
    let totalXp = 0;
    let totalHeal = 0;
    let anyLeveledUp = false;
    const droppedNames: string[] = [];
    let count = 0;

    for (let idx = 0; idx < garden.unlockedPlots; idx++) {
      const p = garden.plots[idx];
      if (p && isPlotReadyToHarvest(p)) {
        const reward = harvestPlot(p.id);
        if (reward) {
          cropTotals[reward.cropId] = (cropTotals[reward.cropId] ?? 0) + reward.cropQty;
          totalXp += reward.xp;
          totalHeal += reward.healHp;
          if (reward.leveledUp) anyLeveledUp = true;
          if (reward.droppedItemId) {
            const itemName = ITEM_NAME_KEYS[reward.droppedItemId]
              ? t(ITEM_NAME_KEYS[reward.droppedItemId])
              : ITEMS[reward.droppedItemId]?.name;
            if (itemName) droppedNames.push(itemName);
          }
          count += 1;
        }
      }
    }

    if (count > 0) {
      const cropSummary = SEED_ORDER.filter((id) => (cropTotals[id] ?? 0) > 0)
        .map((id) => `${SEEDS[id].icon} ${t(SEED_KEYS[id].name)} ×${cropTotals[id]}`)
        .join(', ');
      const parts = [
        `${t('garden.harvestToast')}: ${cropSummary}`,
        `+${totalXp} XP`,
      ];
      if (totalHeal > 0) parts.push(`+${totalHeal} HP`);
      if (anyLeveledUp) parts.push(t('battle.levelUp'));
      if (droppedNames.length > 0) parts.push(...droppedNames);
      setFeedbackBanner(parts.join(' · '));
    }
  };

  const handleClearWeed = (plotId: number) => {
    if (clearPlotWeedWithCoins(plotId)) {
      setFeedbackBanner(`${t('garden.weedHerbicideToast')} (#${plotId + 1})`);
    }
  };

  const scrollToSeedShop = () => {
    setShopTab('SEEDS');
    shopSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  useVoiceCommandHandler((cmd) => {
    switch (cmd.type) {
      case 'GARDEN_WATER':
        waterAllPlots();
        return true;
      case 'GARDEN_HARVEST':
        handleHarvestAll();
        return true;
      case 'GARDEN_WEED':
        handleWeedPatrol();
        return true;
      case 'SELECT_EXERCISE':
        if (weedModal) {
          setSelectedWeedExercise(cmd.exerciseId);
          return true;
        }
        return false;
      case 'START_FIGHT':
        if (weedModal) {
          onStartWeedBattle(weedModal.plotId, weedModal.weedId, selectedWeedExercise);
          return true;
        }
        return false;
      case 'EXIT':
        if (weedModal) {
          setWeedModal(null);
          return true;
        }
        return false;
      default:
        return false;
    }
  });

  const readyHarvestCount = garden.plots
    .slice(0, garden.unlockedPlots)
    .filter((p) => isPlotReadyToHarvest(p)).length;

  const anyWaterable = garden.plots
    .slice(0, garden.unlockedPlots)
    .some(
      (p) =>
        p.seedId !== null && p.weedId === null && p.growth < SEEDS[p.seedId].growthRequired
    );

  const ownedSeedList = SEED_ORDER.filter((id) => (garden.seedInventory[id] ?? 0) > 0);
  const cropInventory = garden.cropInventory ?? {
    PROTEIN_MINT: 0,
    IRON_BAMBOO: 0,
    CHILI_PEPPER: 0,
    GOLDEN_LOTUS: 0,
  };
  const totalCropCount = getTotalCropCount(cropInventory);
  const canUpgradeCan = nextCan !== null && coins >= nextCan.upgradeCost;
  const canRefillWater =
    garden.waterCharges < currentCan.maxCharges && coins >= WATER_REFILL_COST;

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-950/90">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-300 hover:text-white rounded-lg hover:bg-slate-900 transition-colors whitespace-nowrap shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{t('menu.back')}</span>
          </button>

          <h1 className="font-display text-2xl font-bold tracking-tight text-white">
            {t('menu.garden')}
          </h1>

          <div className="flex items-center gap-3 shrink-0">
            <VoiceToggleButton compact />
            <div className="flex items-center gap-1.5 font-numeric text-sm font-bold text-amber-400">
              <Coins className="w-4 h-4" />
              <span>{coins}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <p className="text-sm text-slate-300 max-w-2xl">{t('garden.subtitle')}</p>
          <div className="flex items-center gap-4 font-numeric text-xs text-slate-400 shrink-0">
            <span>
              {t('garden.statsHarvested')}:{' '}
              <strong className="text-emerald-400">{garden.totalHarvested}</strong>
            </span>
            <span>
              {t('garden.statsWeeds')}:{' '}
              <strong className="text-amber-400">{garden.weedsDefeated}</strong>
            </span>
          </div>
        </div>

        {/* Watering Can & Quick Actions Bar */}
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="flex items-center gap-4 min-w-0">
            <div className="text-4xl shrink-0" aria-hidden="true">
              {currentCan.icon}
            </div>
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-base font-bold text-white">
                  {t(WATERING_CAN_KEYS[garden.wateringCanTier].name)}
                </span>
                <span className="text-xs text-emerald-400 font-medium">
                  {t(WATERING_CAN_KEYS[garden.wateringCanTier].perk)}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-44 h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-sky-500 transition-[width] duration-200"
                    style={{ width: `${waterPct}%` }}
                  />
                </div>
                <span className="font-numeric text-xs font-semibold text-sky-300">
                  {t('garden.waterCharges')}: {garden.waterCharges} / {currentCan.maxCharges}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              onClick={() => waterAllPlots()}
              disabled={!anyWaterable || garden.waterCharges <= 0}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap"
            >
              <Droplets className="w-4 h-4" />
              <span>{t('garden.waterAll')}</span>
            </button>

            <button
              onClick={() => refillWateringCan()}
              disabled={!canRefillWater}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-200 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap"
            >
              <Coins className="w-3.5 h-3.5 text-amber-400" />
              <span>
                {t('garden.refillWater')} ({WATER_REFILL_COST})
              </span>
            </button>

            {readyHarvestCount > 0 && (
              <button
                onClick={handleHarvestAll}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-colors whitespace-nowrap"
              >
                <Sprout className="w-4 h-4" />
                <span>
                  {t('garden.harvestAll')} ({readyHarvestCount})
                </span>
              </button>
            )}

            <button
              onClick={handleWeedPatrol}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-lg transition-colors whitespace-nowrap"
            >
              <Swords className="w-4 h-4" />
              <span>{t('garden.weedPatrol')}</span>
            </button>
          </div>
        </section>

        {/* Harvest Feedback Banner */}
        {feedbackBanner && (
          <div className="bg-emerald-950/60 border border-emerald-500/60 rounded-xl px-4 py-3 flex items-center justify-between gap-4 text-sm text-emerald-200">
            <span className="inline-flex items-center gap-2 font-medium">
              <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{feedbackBanner}</span>
            </span>
            <button
              onClick={() => setFeedbackBanner(null)}
              className="text-slate-400 hover:text-white"
              aria-label={t('pwa.close')}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Garden Plots Grid */}
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-white">
              {t('garden.plotsTitle')} ({garden.unlockedPlots} / {MAX_GARDEN_PLOTS})
            </h2>
            <span className="text-xs text-slate-400">{t('garden.workoutTip')}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {garden.plots.map((plot, idx) => {
              const isUnlocked = idx < garden.unlockedPlots;
              const isNextToUnlock = idx === garden.unlockedPlots;
              const unlockCost = PLOT_UNLOCK_COSTS[idx] ?? 0;

              if (!isUnlocked) {
                return (
                  <div
                    key={plot.id}
                    className={`rounded-xl border p-5 flex flex-col justify-between gap-4 min-h-[210px] ${
                      isNextToUnlock
                        ? 'bg-slate-900 border-slate-700'
                        : 'bg-slate-950/60 border-slate-800/60 opacity-60'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>
                        {t('garden.plotLabel')} #{idx + 1}
                      </span>
                      <Lock className="w-4 h-4" />
                    </div>

                    <div className="text-center py-2 space-y-1">
                      <div className="text-3xl opacity-50" aria-hidden="true">
                        🪨
                      </div>
                      <div className="text-sm font-medium text-slate-400">
                        {t('garden.lockedPlot')}
                      </div>
                    </div>

                    <button
                      onClick={() => unlockGardenPlot()}
                      disabled={!isNextToUnlock || coins < unlockCost}
                      className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 text-xs font-bold rounded-lg transition-colors whitespace-nowrap"
                    >
                      {t('garden.unlockPlot')} · {unlockCost} {t('stats.coins')}
                    </button>
                  </div>
                );
              }

              // Infested Plot (Weed Present!)
              if (plot.weedId) {
                const weedTemplate = MONSTERS[plot.weedId] ?? MONSTERS.WEED_DANDELION;
                const weedName = MONSTER_NAME_KEYS[plot.weedId]
                  ? t(MONSTER_NAME_KEYS[plot.weedId])
                  : weedTemplate.name;

                return (
                  <div
                    key={plot.id}
                    className="rounded-xl border border-red-500/60 bg-red-950/20 p-5 flex flex-col justify-between gap-4 min-h-[210px]"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-300 font-medium">
                        {t('garden.plotLabel')} #{idx + 1}
                      </span>
                      <span className="text-red-400 font-semibold">{t('garden.weedAlert')}</span>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-5xl select-none shrink-0" aria-hidden="true">
                        {weedTemplate.sprite}
                      </div>
                      <div className="min-w-0">
                        <div className="text-base font-bold text-white truncate">{weedName}</div>
                        <div className="text-xs text-emerald-400 mt-0.5">
                          {t('levels.weakTo')}: {t(EXERCISE_NAME_KEYS[weedTemplate.weakTo])}
                        </div>
                        {plot.seedId && (
                          <div className="text-xs text-slate-400 mt-0.5 truncate">
                            {SEEDS[plot.seedId].icon} {t(SEED_KEYS[plot.seedId].name)} ({plot.growth}/
                            {SEEDS[plot.seedId].growthRequired})
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => openWeedModalForPlot(plot.id, plot.weedId!)}
                        className="inline-flex items-center justify-center gap-1.5 py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-colors whitespace-nowrap"
                      >
                        <Swords className="w-3.5 h-3.5" />
                        <span>{t('garden.fightWeed')}</span>
                      </button>

                      <button
                        onClick={() => handleClearWeed(plot.id)}
                        disabled={coins < QUICK_WEED_CLEAR_COST}
                        className="inline-flex items-center justify-center gap-1 py-2 px-3 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap"
                      >
                        <Coins className="w-3.5 h-3.5 text-amber-400" />
                        <span>
                          {t('garden.herbicide')} ({QUICK_WEED_CLEAR_COST})
                        </span>
                      </button>
                    </div>
                  </div>
                );
              }

              // Empty Unlocked Plot
              if (!plot.seedId) {
                return (
                  <div
                    key={plot.id}
                    className="rounded-xl border border-slate-800 bg-slate-900 p-5 flex flex-col justify-between gap-3 min-h-[210px]"
                  >
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>
                        {t('garden.plotLabel')} #{idx + 1}
                      </span>
                      <span>{t('garden.stage.EMPTY')}</span>
                    </div>

                    <div className="space-y-2">
                      <div className="text-sm font-semibold text-white">
                        {t('garden.emptyPlot')}
                      </div>
                      <p className="text-xs text-slate-400">
                        {ownedSeedList.length > 0
                          ? t('garden.chooseSeedHint')
                          : t('garden.noSeedsHint')}
                      </p>
                    </div>

                    {ownedSeedList.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {ownedSeedList.map((seedId: SeedId) => (
                          <button
                            key={seedId}
                            onClick={() => plantSeed(plot.id, seedId)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-950 hover:bg-emerald-950/60 border border-slate-700 hover:border-emerald-500 text-xs font-semibold text-slate-100 rounded-lg transition-colors"
                          >
                            <span>{SEEDS[seedId].icon}</span>
                            <span>{t(SEED_KEYS[seedId].name)}</span>
                            <span className="font-numeric text-emerald-400">
                              ×{garden.seedInventory[seedId]}
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <button
                        onClick={scrollToSeedShop}
                        className="w-full py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition-colors"
                      >
                        {t('garden.buySeed')}
                      </button>
                    )}
                  </div>
                );
              }

              // Growing or Mature Plant Plot
              const seedDef = SEEDS[plot.seedId];
              const ready = isPlotReadyToHarvest(plot);
              const stage = getPlantStage(plot);
              const pct = Math.min(100, Math.round((plot.growth / seedDef.growthRequired) * 100));

              return (
                <div
                  key={plot.id}
                  className={`rounded-xl border p-5 flex flex-col justify-between gap-4 min-h-[210px] ${
                    ready
                      ? 'bg-emerald-950/25 border-emerald-500'
                      : 'bg-slate-900 border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">
                      {t('garden.plotLabel')} #{idx + 1}
                    </span>
                    <span className={ready ? 'text-emerald-400 font-bold' : 'text-amber-400 font-medium'}>
                      {ready ? t('garden.readyBadge') : t(STAGE_KEYS[stage])}
                    </span>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-5xl select-none shrink-0" aria-hidden="true">
                      {getPlantVisualEmoji(plot)}
                    </div>
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="text-base font-bold text-white truncate">
                        {t(SEED_KEYS[plot.seedId].name)}
                      </div>
                      <div className="flex justify-between text-xs text-slate-400 font-numeric">
                        <span>{t('garden.growthLabel')}</span>
                        <span className="text-slate-200">
                          {plot.growth} / {seedDef.growthRequired}
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-[width] duration-200 ${
                            ready ? 'bg-emerald-400' : 'bg-sky-500'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {ready ? (
                    <button
                      onClick={() => handleHarvest(plot.id)}
                      className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-colors whitespace-nowrap"
                    >
                      <Sprout className="w-4 h-4" />
                      <span>
                        {t('garden.harvest')} (+{seedDef.harvestCropYield} {t('garden.cropUnit')} · +
                        {seedDef.harvestXp} XP)
                      </span>
                    </button>
                  ) : (
                    <button
                      onClick={() => waterPlot(plot.id)}
                      disabled={garden.waterCharges <= 0}
                      className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-sky-600 hover:bg-sky-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap"
                    >
                      <Droplets className="w-4 h-4" />
                      <span>
                        {currentCan.watersAll ? t('garden.waterAll') : t('garden.waterOne')} (+
                        {currentCan.growthPerWater})
                      </span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Harvested Botanical Stash (Sanctuary Prep) */}
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <FlaskConical className="w-4 h-4 text-emerald-400 shrink-0" />
              <h2 className="text-base font-semibold text-white">{t('garden.stashTitle')}</h2>
            </div>
            <button
              onClick={() => {
                if (onOpenSanctuary) {
                  onOpenSanctuary();
                } else {
                  setShopTab('SANCTUARY');
                  shopSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
              }}
              className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors whitespace-nowrap"
            >
              {onOpenSanctuary ? t('sanctuary.openFullSanctuary') : t('garden.sanctuaryTab')} →
            </button>
          </div>

          {totalCropCount === 0 ? (
            <p className="text-xs text-slate-400">{t('garden.stashEmpty')}</p>
          ) : (
            <div className="space-y-2.5">
              <p className="text-xs text-slate-400">{t('garden.stashHint')}</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {SEED_ORDER.map((seedId) => {
                  const qty = cropInventory[seedId] ?? 0;
                  return (
                    <div
                      key={seedId}
                      className={`rounded-lg border px-3.5 py-2.5 flex items-center justify-between gap-2 ${
                        qty > 0
                          ? 'bg-slate-950 border-emerald-500/40'
                          : 'bg-slate-950/60 border-slate-800 opacity-65'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xl shrink-0" aria-hidden="true">
                          {SEEDS[seedId].icon}
                        </span>
                        <span className="text-xs font-semibold text-slate-200 truncate">
                          {t(SEED_KEYS[seedId].name)}
                        </span>
                      </div>
                      <span className="font-numeric text-sm font-bold text-emerald-400 shrink-0">
                        ×{qty}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {/* Garden Supply Shop & Sanctuary Prep */}
        <section ref={shopSectionRef} className="space-y-4 pt-2 border-t border-slate-800">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-lg font-bold text-white">{t('garden.shopTitle')}</h2>
            <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-lg">
              <button
                onClick={() => setShopTab('SEEDS')}
                className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                  shopTab === 'SEEDS'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {t('garden.seedsTab')}
              </button>
              <button
                onClick={() => setShopTab('TOOLS')}
                className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                  shopTab === 'TOOLS'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {t('garden.toolsTab')}
              </button>
              <button
                onClick={() => setShopTab('SANCTUARY')}
                className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                  shopTab === 'SANCTUARY'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {t('garden.sanctuaryTab')}
              </button>
            </div>
          </div>

          {shopTab === 'SEEDS' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {SEED_ORDER.map((seedId) => {
                const seed = SEEDS[seedId];
                const owned = garden.seedInventory[seedId] ?? 0;
                const canAfford = coins >= seed.price;

                return (
                  <div
                    key={seedId}
                    className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between gap-4"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-3xl leading-none" aria-hidden="true">
                          {seed.icon}
                        </span>
                        <span className={`text-xs font-semibold ${RARITY_TEXT_CLASS[seed.rarity]}`}>
                          {t(RARITY_KEYS[seed.rarity])}
                        </span>
                      </div>

                      <div className="text-sm font-bold text-white">
                        {t(SEED_KEYS[seedId].name)}
                      </div>
                      <p className="text-xs text-slate-400 leading-snug">
                        {t(SEED_KEYS[seedId].desc)}
                      </p>

                      <div className="flex items-center justify-between text-xs font-numeric text-slate-300 pt-1">
                        <span>
                          {t('garden.growthLabel')}: {seed.growthRequired}
                        </span>
                        <span>
                          {t('garden.owned')}: <strong className="text-emerald-400">{owned}</strong>
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => buySeed(seedId)}
                      disabled={!canAfford}
                      className="w-full py-2 px-3 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 text-xs font-bold rounded-lg transition-colors whitespace-nowrap"
                    >
                      {t('garden.buySeed')} · {seed.price}
                    </button>
                  </div>
                );
              })}
            </div>
          ) : shopTab === 'TOOLS' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {([1, 2, 3, 4] as WateringCanTier[]).map((tier) => {
                const can = WATERING_CANS[tier];
                const isCurrent = garden.wateringCanTier === tier;
                const isUnlocked = garden.wateringCanTier >= tier;
                const isNext = nextTier === tier;

                return (
                  <div
                    key={tier}
                    className={`rounded-xl border p-5 flex items-center justify-between gap-4 ${
                      isCurrent
                        ? 'bg-slate-900 border-sky-500'
                        : 'bg-slate-900 border-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <span className="text-3xl shrink-0" aria-hidden="true">
                        {can.icon}
                      </span>
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-white">
                          {t(WATERING_CAN_KEYS[tier].name)}
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          {t(WATERING_CAN_KEYS[tier].perk)}
                        </div>
                      </div>
                    </div>

                    {isNext ? (
                      <button
                        onClick={() => upgradeWateringCan()}
                        disabled={!canUpgradeCan}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 text-xs font-bold rounded-lg transition-colors whitespace-nowrap shrink-0"
                      >
                        <ArrowUpCircle className="w-3.5 h-3.5" />
                        <span>
                          {t('garden.upgradeCan')} · {can.upgradeCost}
                        </span>
                      </button>
                    ) : (
                      <span
                        className={`text-xs font-semibold whitespace-nowrap shrink-0 ${
                          isUnlocked ? 'text-emerald-400' : 'text-slate-500'
                        }`}
                      >
                        {isCurrent
                          ? t('inventory.equipped')
                          : isUnlocked
                            ? t('achievements.unlockedBadge')
                            : `${can.upgradeCost} ${t('stats.coins')}`}
                      </span>
                    )}
                  </div>
                );
              })}

              {nextPlotCost !== null && (
                <div className="md:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-bold text-white">
                      {t('garden.unlockPlot')} #{garden.unlockedPlots + 1}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      {garden.unlockedPlots} / {MAX_GARDEN_PLOTS} {t('garden.plotsTitle')}
                    </div>
                  </div>
                  <button
                    onClick={() => unlockGardenPlot()}
                    disabled={coins < nextPlotCost}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 text-xs font-bold rounded-lg transition-colors whitespace-nowrap"
                  >
                    {t('garden.unlockPlot')} · {nextPlotCost} {t('stats.coins')}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-emerald-950/30 border border-emerald-700/50 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1 max-w-xl">
                  <div className="inline-flex items-center gap-2 text-sm font-bold text-white">
                    <FlaskConical className="w-4 h-4 text-emerald-400" />
                    <span>{t('garden.sanctuaryReadyBannerTitle')}</span>
                  </div>
                  <p className="text-xs text-slate-300">{t('garden.sanctuaryReadyBannerDesc')}</p>
                </div>
                {onOpenSanctuary && (
                  <button
                    onClick={onOpenSanctuary}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-colors whitespace-nowrap shrink-0"
                  >
                    <FlaskConical className="w-4 h-4" />
                    <span>{t('sanctuary.openFullSanctuary')}</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {SANCTUARY_MIX_BLUEPRINTS.map((mix) => {
                  const readyToMix = isMixReadyToCraft(cropInventory, mix);
                  const keys = SANCTUARY_MIX_KEYS[mix.id];

                  return (
                    <div
                      key={mix.id}
                      className={`rounded-xl border p-4 space-y-3 ${
                        readyToMix
                          ? 'bg-slate-900 border-emerald-500/60'
                          : 'bg-slate-900 border-slate-800'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-3xl leading-none shrink-0" aria-hidden="true">
                            {mix.icon}
                          </span>
                          <div className="min-w-0">
                            <div className="text-sm font-bold text-white truncate">
                              {t(keys.name)}
                            </div>
                            <div className={`text-xs font-medium ${RARITY_TEXT_CLASS[mix.rarity]}`}>
                              {t(RARITY_KEYS[mix.rarity])}
                            </div>
                          </div>
                        </div>

                        <span
                          className={`text-xs font-semibold whitespace-nowrap shrink-0 ${
                            readyToMix ? 'text-emerald-400' : 'text-slate-500'
                          }`}
                        >
                          {readyToMix ? t('garden.ingredientsReady') : t('garden.comingSoonBadge')}
                        </span>
                      </div>

                      <p className="text-xs text-slate-300 leading-snug">{t(keys.effect)}</p>

                      <div className="flex flex-wrap gap-2 pt-1">
                        {mix.ingredients.map((req) => {
                          const have = cropInventory[req.seedId] ?? 0;
                          const enough = have >= req.qty;
                          return (
                            <span
                              key={req.seedId}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-numeric ${
                                enough
                                  ? 'bg-emerald-950/40 border-emerald-600/50 text-emerald-300'
                                  : 'bg-slate-950 border-slate-800 text-slate-400'
                              }`}
                            >
                              <span>{SEEDS[req.seedId].icon}</span>
                              <span>{t(SEED_KEYS[req.seedId].name)}</span>
                              <span className="font-bold">
                                {Math.min(have, req.qty)}/{req.qty}
                              </span>
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      </main>

      {/* Weed Battle Setup Modal */}
      {weedModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-emerald-600/60 rounded-xl p-6 max-w-lg w-full space-y-5">
            {(() => {
              const weedTemplate = MONSTERS[weedModal.weedId] ?? MONSTERS.WEED_DANDELION;
              const weedName = MONSTER_NAME_KEYS[weedModal.weedId]
                ? t(MONSTER_NAME_KEYS[weedModal.weedId])
                : weedTemplate.name;
              const weedDesc = MONSTER_DESC_KEYS[weedModal.weedId]
                ? t(MONSTER_DESC_KEYS[weedModal.weedId])
                : weedTemplate.description;

              return (
                <>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <span className="text-5xl" aria-hidden="true">
                        {weedTemplate.sprite}
                      </span>
                      <div>
                        <div className="text-xs font-semibold text-emerald-400">
                          {t('garden.modalWeedTitle')} #{weedModal.plotId + 1}
                        </div>
                        <h3 className="text-xl font-bold text-white">{weedName}</h3>
                        <div className="text-xs text-amber-400 mt-0.5">
                          {t(ARCHETYPE_KEYS[weedTemplate.archetype])} · {weedTemplate.maxHp} HP
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => setWeedModal(null)}
                      className="text-slate-400 hover:text-white"
                      aria-label={t('pwa.close')}
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <p className="text-xs text-slate-300">{weedDesc}</p>
                  <p className="text-xs text-emerald-300 font-medium">
                    {t('garden.modalWeedSubtitle')}
                  </p>

                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-slate-400">
                      {t('levels.chooseExercise')} ({t('levels.weakTo')}:{' '}
                      <span className="text-emerald-400">
                        {t(EXERCISE_NAME_KEYS[weedTemplate.weakTo])}
                      </span>
                      )
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {Object.values(EXERCISES).map((ex) => {
                        const isWeak = ex.id === weedTemplate.weakTo;
                        const isResistant = ex.id === weedTemplate.resistantTo;
                        const isSelected = selectedWeedExercise === ex.id;
                        return (
                          <button
                            key={ex.id}
                            onClick={() => setSelectedWeedExercise(ex.id)}
                            className={`px-3 py-2 rounded-lg border text-left text-xs transition-colors ${
                              isSelected
                                ? 'bg-emerald-600/25 border-emerald-400 text-white font-semibold'
                                : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                            }`}
                          >
                            <div className="truncate">
                              {EXERCISES[ex.id].icon} {t(EXERCISE_NAME_KEYS[ex.id])}
                            </div>
                            {isWeak && (
                              <div className="text-[10px] text-emerald-400 font-semibold mt-0.5">
                                {t('battle.matchupWeak')}
                              </div>
                            )}
                            {isResistant && (
                              <div className="text-[10px] text-slate-500 mt-0.5">
                                {t('battle.matchupResistant')}
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex gap-3 pt-1">
                    <button
                      onClick={() => {
                        const target = weedModal;
                        setWeedModal(null);
                        onStartWeedBattle(target.plotId, target.weedId, selectedWeedExercise);
                      }}
                      className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold rounded-lg transition-colors"
                    >
                      <Swords className="w-4 h-4" />
                      <span>{t('garden.startWeedFight')}</span>
                    </button>
                    <button
                      onClick={() => setWeedModal(null)}
                      className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold rounded-lg transition-colors"
                    >
                      {t('settings.cancel')}
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
