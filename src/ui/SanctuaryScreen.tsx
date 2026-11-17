/**
 * SanctuaryScreen - Hero's Hideout & Mix Lab.
 * Craft harvested Garden crops and Monster Trophies into 12 combat mixes & risky mutagens,
 * combine 2-3 Lab slots for Combo Synergies, recover HP, and arm/swap pre-battle buffs.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpCircle,
  Bookmark,
  Check,
  ClipboardCheck,
  Coins,
  FlaskConical,
  Heart,
  Shield,
  Sparkles,
  Sprout,
  Sword,
  Swords,
  Trophy,
  X,
  Zap,
} from 'lucide-react';
import { SEEDS, SEED_ORDER } from '../game/data/garden';
import {
  MAX_SANCTUARY_PRESETS,
  MONSTER_TROPHIES,
  MONSTER_TROPHY_ORDER,
  SANCTUARY_LAB_TIERS,
  SANCTUARY_MIX_BLUEPRINTS,
  SANCTUARY_MIX_MAP,
  SANCTUARY_SYNERGIES,
  SANCTUARY_SYNERGY_MAP,
  getAggregatedSanctuaryBuffs,
  getMixEffectiveHeal,
  getNextSanctuaryLabTier,
  getTotalCropCount,
  getTotalMixCount,
  getTotalTrophyCount,
  isMixReadyToCraft,
  type SanctuaryMixBlueprint,
} from '../game/data/sanctuary';
import type { SanctuaryLabTier, SanctuaryMixCategory, SanctuaryMixId } from '../game/types';
import { selectEffectivePlayerStats, useGameStore } from '../game/store';
import { useTranslation, type TranslationKey } from '../i18n/useTranslation';
import {
  EXERCISE_DISCIPLINE_KEYS,
  MONSTER_TROPHY_KEYS,
  RARITY_KEYS,
  RARITY_TEXT_CLASS,
  SANCTUARY_CATEGORY_KEYS,
  SANCTUARY_LAB_KEYS,
  SANCTUARY_MIX_KEYS,
  SANCTUARY_SYNERGY_KEYS,
  SEED_KEYS,
} from './gameKeys';
import { useVoiceCommandHandler } from './VoiceControl';

interface SanctuaryScreenProps {
  onBack: () => void;
  onOpenGarden: () => void;
  onOpenBattle: () => void;
}

type RecipeFilter = 'ALL' | SanctuaryMixCategory | 'READY';

const FILTER_OPTIONS: { id: RecipeFilter; labelKey: TranslationKey }[] = [
  { id: 'ALL', labelKey: 'sanctuary.filter.ALL' },
  { id: 'BASE', labelKey: 'sanctuary.filter.BASE' },
  { id: 'DISCIPLINE', labelKey: 'sanctuary.filter.DISCIPLINE' },
  { id: 'MUTAGEN', labelKey: 'sanctuary.filter.MUTAGEN' },
  { id: 'READY', labelKey: 'sanctuary.filter.READY' },
];

export function SanctuaryScreen({
  onBack,
  onOpenGarden,
  onOpenBattle,
}: SanctuaryScreenProps) {
  const { t } = useTranslation();
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [recipeFilter, setRecipeFilter] = useState<RecipeFilter>('ALL');

  const coins = useGameStore((state) => state.coins);
  const basePlayer = useGameStore((state) => state.player);
  const cropInventory = useGameStore((state) => state.garden.cropInventory);
  const sanctuary = useGameStore((state) => state.sanctuary);
  const craftMix = useGameStore((state) => state.craftMix);
  const activateMixBuff = useGameStore((state) => state.activateMixBuff);
  const deactivateMixBuff = useGameStore((state) => state.deactivateMixBuff);
  const upgradeSanctuaryLab = useGameStore((state) => state.upgradeSanctuaryLab);
  const saveSanctuaryPreset = useGameStore((state) => state.saveSanctuaryPreset);
  const applySanctuaryPreset = useGameStore((state) => state.applySanctuaryPreset);
  const ensureDailyAlchemyOrder = useGameStore((state) => state.ensureDailyAlchemyOrder);
  const completeAlchemyOrder = useGameStore((state) => state.completeAlchemyOrder);

  useEffect(() => {
    ensureDailyAlchemyOrder();
  }, [ensureDailyAlchemyOrder]);

  const trophyInventory = sanctuary.trophyInventory ?? {
    TROPHY_FIZZ_CORE: 0,
    TROPHY_GLAZE_SHELL: 0,
    TROPHY_CAPSAICIN_DROP: 0,
    TROPHY_CROWN_SPICE: 0,
  };
  const presets = sanctuary.presets ?? [];
  const alchemyOrder = sanctuary.alchemyOrder ?? null;
  const completedOrdersCount = sanctuary.completedOrdersCount ?? 0;

  const canFulfillOrder = useMemo(() => {
    if (!alchemyOrder || alchemyOrder.completed) return false;
    return alchemyOrder.requirements.every((req) => {
      if (req.seedId) return (cropInventory[req.seedId] ?? 0) >= req.qty;
      if (req.trophyId) return (trophyInventory[req.trophyId] ?? 0) >= req.qty;
      if (req.mixId) return (sanctuary.mixInventory[req.mixId] ?? 0) >= req.qty;
      return true;
    });
  }, [alchemyOrder, cropInventory, trophyInventory, sanctuary.mixInventory]);

  const effectivePlayer = selectEffectivePlayerStats(useGameStore.getState());
  const currentLab = SANCTUARY_LAB_TIERS[sanctuary.labTier];
  const nextLabTier = getNextSanctuaryLabTier(sanctuary.labTier);
  const nextLab = nextLabTier ? SANCTUARY_LAB_TIERS[nextLabTier] : null;
  const aggregatedBuffs = getAggregatedSanctuaryBuffs(sanctuary.activeBuffs, sanctuary.labTier);

  const totalCrops = getTotalCropCount(cropInventory);
  const totalTrophies = getTotalTrophyCount(trophyInventory);
  const totalMixes = getTotalMixCount(sanctuary.mixInventory);
  const hpPercent =
    effectivePlayer.maxHp > 0
      ? Math.min(100, Math.round((effectivePlayer.hp / effectivePlayer.maxHp) * 100))
      : 0;

  const showToast = (msg: string) => {
    setToastMsg(msg);
  };

  const handleCraft = (blueprint: SanctuaryMixBlueprint) => {
    if (!craftMix(blueprint.id)) return;
    showToast(`${t('sanctuary.craftedToast')}: ${t(SANCTUARY_MIX_KEYS[blueprint.id].name)}`);
  };

  const handleActivate = (blueprint: SanctuaryMixBlueprint) => {
    const res = activateMixBuff(blueprint.id);
    if (!res) return;
    const mixName = t(SANCTUARY_MIX_KEYS[blueprint.id].name);
    if (res.healedHp > 0) {
      showToast(`${t('sanctuary.armedToast')}: ${mixName} (+${res.healedHp} HP)`);
    } else {
      showToast(`${t('sanctuary.armedToast')}: ${mixName}`);
    }
  };

  const handleDeactivate = (mixId: SanctuaryMixId) => {
    if (!deactivateMixBuff(mixId)) return;
    showToast(`${t('sanctuary.disarmedToast')}: ${t(SANCTUARY_MIX_KEYS[mixId].name)}`);
  };

  useVoiceCommandHandler((cmd) => {
    switch (cmd.type) {
      case 'NAV_GARDEN':
        onOpenGarden();
        return true;
      case 'NAV_CAMPAIGN':
      case 'START_FIGHT':
        onOpenBattle();
        return true;
      case 'EXIT':
        onBack();
        return true;
      default:
        return false;
    }
  });

  const filteredBlueprints = useMemo(() => {
    return SANCTUARY_MIX_BLUEPRINTS.filter((bp) => {
      if (recipeFilter === 'ALL') return true;
      if (recipeFilter === 'READY') {
        return isMixReadyToCraft(cropInventory, bp, trophyInventory);
      }
      return bp.category === recipeFilter;
    });
  }, [recipeFilter, cropInventory, trophyInventory]);

  const filterCounts = useMemo(() => {
    const readyCount = SANCTUARY_MIX_BLUEPRINTS.filter((bp) =>
      isMixReadyToCraft(cropInventory, bp, trophyInventory)
    ).length;
    return {
      ALL: SANCTUARY_MIX_BLUEPRINTS.length,
      BASE: SANCTUARY_MIX_BLUEPRINTS.filter((b) => b.category === 'BASE').length,
      DISCIPLINE: SANCTUARY_MIX_BLUEPRINTS.filter((b) => b.category === 'DISCIPLINE').length,
      MUTAGEN: SANCTUARY_MIX_BLUEPRINTS.filter((b) => b.category === 'MUTAGEN').length,
      READY: readyCount,
    };
  }, [cropInventory, trophyInventory]);

  const getSynergyHintForMix = (mixId: SanctuaryMixId): string[] => {
    const hints: string[] = [];
    for (const syn of SANCTUARY_SYNERGIES) {
      if (syn.requiredMixes?.includes(mixId)) {
        const partnerNames = syn.requiredMixes
          .filter((id) => id !== mixId)
          .map((id) => t(SANCTUARY_MIX_KEYS[id].name));
        const synName = t(SANCTUARY_SYNERGY_KEYS[syn.id].name);
        if (partnerNames.length > 0) {
          hints.push(`${synName} (+ ${partnerNames.join(', ')})`);
        } else {
          hints.push(synName);
        }
      }
    }
    return hints;
  };

  const renderMixStatLines = (bp: SanctuaryMixBlueprint) => {
    const eff = bp.effect;
    const healHp = getMixEffectiveHeal(bp, sanctuary.labTier);
    const positives: string[] = [];
    const drawbacks: string[] = [];

    if (healHp > 0) positives.push(`${t('sanctuary.statInstantHeal')}: +${healHp} HP`);
    if (eff.attackBonus > 0) positives.push(`${t('sanctuary.statAttack')} +${eff.attackBonus}`);
    if (eff.defenseBonus > 0) positives.push(`${t('sanctuary.statDefense')} +${eff.defenseBonus}`);
    if (eff.defenseBonus < 0) drawbacks.push(`${t('sanctuary.statDefense')} ${eff.defenseBonus}`);

    if (eff.globalDamageMultiplier && eff.globalDamageMultiplier > 1) {
      positives.push(
        `${t('sanctuary.statGlobalDmg')} +${Math.round((eff.globalDamageMultiplier - 1) * 100)}%`
      );
    }
    if (eff.strengthDamageMultiplier && eff.strengthDamageMultiplier > 1) {
      positives.push(
        `${t('sanctuary.statStrengthDmg')} +${Math.round((eff.strengthDamageMultiplier - 1) * 100)}%`
      );
    }
    if (eff.staticDamageMultiplier && eff.staticDamageMultiplier > 1) {
      positives.push(
        `${t('sanctuary.statStaticDmg')} +${Math.round((eff.staticDamageMultiplier - 1) * 100)}%`
      );
    }
    if (eff.cardioDamageMultiplier && eff.cardioDamageMultiplier > 1) {
      positives.push(
        `${t('sanctuary.statCardioDmg')} +${Math.round((eff.cardioDamageMultiplier - 1) * 100)}%`
      );
    }
    if (eff.dumbbellDamageBonus && eff.dumbbellDamageBonus > 0) {
      positives.push(
        `${t('sanctuary.statDumbbellDmg')} +${Math.round(eff.dumbbellDamageBonus * 100)}%`
      );
    }
    if (eff.armorPierceRatio && eff.armorPierceRatio > 0) {
      positives.push(
        `${t('sanctuary.statArmorPierce')} ${Math.round(eff.armorPierceRatio * 100)}%`
      );
    }
    if (eff.shieldBreakBonus && eff.shieldBreakBonus > 0) {
      positives.push(`${t('sanctuary.statShieldBreak')} +${eff.shieldBreakBonus}`);
    }
    if (eff.blockMitigationOverride) {
      positives.push(
        `${t('sanctuary.statStaticBlock')} ${Math.round(eff.blockMitigationOverride * 100)}%`
      );
    }
    if (eff.toxicCleanseHoldTicksOverride) {
      positives.push(`${t('sanctuary.statCleanseFast')} ${eff.toxicCleanseHoldTicksOverride}s`);
    }
    if (eff.toxicImmunity) {
      positives.push(t('sanctuary.statToxicImmunity'));
    }
    if (eff.critChanceBonus > 0) {
      positives.push(`${t('sanctuary.statCrit')} +${Math.round(eff.critChanceBonus * 100)}%`);
    }
    if (eff.critMultiplierBonus && eff.critMultiplierBonus > 0) {
      positives.push(
        `${t('sanctuary.statCritMult')} +${Math.round(eff.critMultiplierBonus * 100)}%`
      );
    }
    if (eff.comboWindowBonusMs > 0) {
      positives.push(
        `${t('sanctuary.statComboWindow')} +${(eff.comboWindowBonusMs / 1000).toFixed(1)}s`
      );
    } else if (eff.comboWindowBonusMs < 0) {
      drawbacks.push(
        `${t('sanctuary.statComboWindow')} ${(eff.comboWindowBonusMs / 1000).toFixed(1)}s`
      );
    }
    if (eff.incomingDamageMultiplier < 1) {
      positives.push(
        `${t('sanctuary.statDamageReduce')} -${Math.round((1 - eff.incomingDamageMultiplier) * 100)}%`
      );
    } else if (eff.incomingDamageMultiplier > 1) {
      drawbacks.push(
        `${t('sanctuary.statDamageReduce')} +${Math.round((eff.incomingDamageMultiplier - 1) * 100)}%`
      );
    }
    if (eff.maxHpMultiplier && eff.maxHpMultiplier < 1) {
      drawbacks.push(
        `${t('sanctuary.statMaxHp')} -${Math.round((1 - eff.maxHpMultiplier) * 100)}%`
      );
    }
    if (eff.startingUltimateCharge > 0) {
      positives.push(`${t('sanctuary.statStartUlt')} +${eff.startingUltimateCharge}%`);
    }
    if (eff.ultimateChargeMultiplier > 1) {
      positives.push(
        `${t('sanctuary.statUltCharge')} +${Math.round((eff.ultimateChargeMultiplier - 1) * 100)}%`
      );
    }
    if (eff.healOnUlt && eff.healOnUlt > 0) {
      positives.push(`${t('sanctuary.statUltHeal')} +${eff.healOnUlt} HP`);
    }
    if (eff.selfDamageOnUlt && eff.selfDamageOnUlt > 0) {
      drawbacks.push(`${t('sanctuary.statUltSelfDmg')} -${eff.selfDamageOnUlt} HP`);
    }
    if (eff.xpMultiplier > 1) {
      positives.push(`${t('sanctuary.statXpBoost')} +${Math.round((eff.xpMultiplier - 1) * 100)}%`);
    }
    if (eff.coinMultiplier && eff.coinMultiplier > 1) {
      positives.push(
        `${t('sanctuary.statCoinBoost')} +${Math.round((eff.coinMultiplier - 1) * 100)}%`
      );
    }

    return { positives, drawbacks };
  };

  const slotIndices = Array.from({ length: currentLab.maxBuffSlots }, (_, i) => i);

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-950/90">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-300 hover:text-white rounded-lg hover:bg-slate-900 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{t('menu.back')}</span>
          </button>

          <h1 className="font-display text-2xl font-bold tracking-tight text-white truncate">
            {t('sanctuary.title')}
          </h1>

          <div className="flex items-center gap-3 shrink-0">
            <span className="inline-flex items-center gap-1.5 font-numeric text-sm font-bold text-amber-400">
              <Coins className="w-4 h-4" />
              <span>{coins}</span>
            </span>
            <button
              onClick={onOpenBattle}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-lg transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
            >
              <Swords className="w-3.5 h-3.5" />
              <span>{t('sanctuary.openBattle')}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-8 space-y-8">
        {/* Subtitle + Inline Summary & Toast */}
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <p className="text-sm text-slate-400 max-w-2xl">{t('sanctuary.subtitle')}</p>
          <div className="flex items-center gap-3 text-xs font-numeric text-slate-400">
            <span>
              {t('sanctuary.inStock')}: <strong className="text-emerald-400">{totalMixes}</strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              {t('sanctuary.trophiesTitle')}: <strong className="text-amber-400">{totalTrophies}</strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              {t('sanctuary.craftedTotal')}: <strong className="text-white">{sanctuary.totalCrafted}</strong>
            </span>
          </div>
        </div>

        {toastMsg && (
          <div className="bg-emerald-950/60 border border-emerald-600/60 rounded-xl px-4 py-3 flex items-center justify-between gap-4 text-sm text-emerald-200">
            <span>{toastMsg}</span>
            <button
              onClick={() => setToastMsg(null)}
              className="text-xs font-semibold text-emerald-300 hover:text-white whitespace-nowrap shrink-0"
            >
              {t('pwa.close')}
            </button>
          </div>
        )}

        {/* Active Battle Buff Slots & Lab Tier / Hero Status Split */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Active Pre-Battle Buffs + Synergies */}
          <section className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between gap-5">
            <div className="space-y-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="flex items-center gap-2">
                  <FlaskConical className="w-4 h-4 text-emerald-400 shrink-0" />
                  <h2 className="text-base font-semibold text-white">
                    {t('sanctuary.activeBuffsTitle')}
                  </h2>
                </div>
                <span className="font-numeric text-xs font-semibold text-emerald-400">
                  {sanctuary.activeBuffs.length} / {currentLab.maxBuffSlots}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {slotIndices.map((slotIdx) => {
                  const mixId: SanctuaryMixId | undefined = sanctuary.activeBuffs[slotIdx];
                  const blueprint = mixId ? SANCTUARY_MIX_MAP[mixId] : undefined;

                  if (!blueprint || !mixId) {
                    return (
                      <div
                        key={slotIdx}
                        className="rounded-lg border border-dashed border-slate-800 bg-slate-950/60 px-3.5 py-4 flex flex-col items-center justify-center text-center gap-1 min-h-[96px]"
                      >
                        <span className="text-xs font-medium text-slate-500">
                          {t('sanctuary.emptySlot')} #{slotIdx + 1}
                        </span>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={slotIdx}
                      className={`rounded-lg border bg-slate-950 px-3.5 py-3 flex flex-col justify-between gap-2 min-h-[96px] ${
                        blueprint.isRisky ? 'border-rose-500/60' : 'border-emerald-500/50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-2xl leading-none" aria-hidden="true">
                          {blueprint.icon}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeactivate(mixId)}
                          title={t('sanctuary.deactivate')}
                          aria-label={`${t('sanctuary.deactivate')} ${t(SANCTUARY_MIX_KEYS[mixId].name)}`}
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 hover:text-rose-300 transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>{t('sanctuary.deactivate')}</span>
                        </button>
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-white truncate">
                          {t(SANCTUARY_MIX_KEYS[mixId].name)}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate mt-0.5">
                          {blueprint.isRisky ? (
                            <span className="text-rose-400 inline-flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3 shrink-0" />
                              <span>{t('sanctuary.riskyBadge')}</span>
                            </span>
                          ) : blueprint.disciplineFocus ? (
                            t(EXERCISE_DISCIPLINE_KEYS[blueprint.disciplineFocus])
                          ) : (
                            t(SANCTUARY_CATEGORY_KEYS[blueprint.category])
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Active Slot Synergies Panel */}
              {aggregatedBuffs.activeSynergies.length > 0 ? (
                <div className="rounded-lg border border-amber-500/50 bg-amber-950/20 px-3.5 py-3 space-y-2">
                  <div className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-300">
                    <Sparkles className="w-3.5 h-3.5 shrink-0" />
                    <span>{t('sanctuary.synergyActive')}</span>
                  </div>
                  <div className="space-y-1.5">
                    {aggregatedBuffs.activeSynergies.map((synId) => {
                      const synDef = SANCTUARY_SYNERGY_MAP[synId];
                      const synKeys = SANCTUARY_SYNERGY_KEYS[synId];
                      return (
                        <div key={synId} className="text-xs text-slate-200 leading-snug">
                          <span className="mr-1.5" aria-hidden="true">
                            {synDef.icon}
                          </span>
                          <strong className="text-amber-300">{t(synKeys.name)}:</strong>{' '}
                          <span className="text-slate-300">{t(synKeys.effect)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-400 leading-relaxed">
                  {currentLab.maxBuffSlots >= 2
                    ? t('sanctuary.synergyHint')
                    : t('sanctuary.activeBuffsHint')}
                </p>
              )}

              {aggregatedBuffs.hasRiskyMutagen && (
                <div className="flex items-center gap-2 text-xs text-rose-300 font-medium">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{t('sanctuary.riskyWarning')}</span>
                </div>
              )}
            </div>

            {/* Live Hero Readiness Strip */}
            <div className="pt-4 border-t border-slate-800 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-4 text-xs font-numeric">
                <span className="inline-flex items-center gap-1.5 text-slate-200 font-semibold">
                  <Heart className="w-4 h-4 text-emerald-400" />
                  <span>
                    {effectivePlayer.hp} / {effectivePlayer.maxHp} HP
                    {aggregatedBuffs.maxHpMultiplier < 1 && (
                      <strong className="text-rose-400 ml-1">
                        (-{Math.round((1 - aggregatedBuffs.maxHpMultiplier) * 100)}%)
                      </strong>
                    )}
                  </span>
                </span>
                <div className="flex flex-wrap items-center gap-4 text-slate-300">
                  <span className="inline-flex items-center gap-1">
                    <Sword className="w-3.5 h-3.5 text-amber-400" />
                    <span>
                      {effectivePlayer.attack}
                      {aggregatedBuffs.attackBonus > 0 && (
                        <strong className="text-emerald-400 ml-1">
                          (+{aggregatedBuffs.attackBonus})
                        </strong>
                      )}
                    </span>
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Shield className="w-3.5 h-3.5 text-sky-400" />
                    <span>
                      {effectivePlayer.defense}
                      {aggregatedBuffs.defenseBonus > 0 && (
                        <strong className="text-emerald-400 ml-1">
                          (+{aggregatedBuffs.defenseBonus})
                        </strong>
                      )}
                      {aggregatedBuffs.defenseBonus < 0 && (
                        <strong className="text-rose-400 ml-1">
                          ({aggregatedBuffs.defenseBonus})
                        </strong>
                      )}
                    </span>
                  </span>
                  {aggregatedBuffs.startingUltimateCharge > 0 && (
                    <span className="inline-flex items-center gap-1 text-fuchsia-300 font-semibold">
                      <Zap className="w-3.5 h-3.5" />
                      <span>+{aggregatedBuffs.startingUltimateCharge}%</span>
                    </span>
                  )}
                </div>
              </div>

              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-[width] duration-200"
                  style={{ width: `${hpPercent}%` }}
                />
              </div>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400 font-numeric">
                <span>
                  {t('stats.level')} {basePlayer.level}
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  {t('stats.crit')} {Math.round(effectivePlayer.critChance * 100)}% (×
                  {effectivePlayer.critMultiplier.toFixed(1)})
                </span>
                {aggregatedBuffs.xpMultiplier > 1 && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-emerald-400">
                      XP +{Math.round((aggregatedBuffs.xpMultiplier - 1) * 100)}%
                    </span>
                  </>
                )}
                {aggregatedBuffs.coinMultiplier > 1 && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-amber-400">
                      {t('sanctuary.statCoinBoost')} +{Math.round((aggregatedBuffs.coinMultiplier - 1) * 100)}%
                    </span>
                  </>
                )}
              </div>
            </div>
          </section>

          {/* Lab Tier & Upgrades */}
          <section className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between gap-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="text-3xl leading-none" aria-hidden="true">
                    {currentLab.icon}
                  </span>
                  <div>
                    <div className="text-xs text-slate-400">{t('sanctuary.labTitle')}</div>
                    <h2 className="text-base font-bold text-white">
                      {t(SANCTUARY_LAB_KEYS[sanctuary.labTier].name)}
                    </h2>
                  </div>
                </div>
                <span className="font-numeric text-xs font-semibold text-amber-400">
                  {sanctuary.labTier} / 3
                </span>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-800">
                {([1, 2, 3] as SanctuaryLabTier[]).map((tier) => {
                  const tierCfg = SANCTUARY_LAB_TIERS[tier];
                  const unlocked = sanctuary.labTier >= tier;
                  const isCurrent = sanctuary.labTier === tier;
                  return (
                    <div
                      key={tier}
                      className={`rounded-lg border px-3.5 py-2.5 flex items-center justify-between gap-3 ${
                        isCurrent
                          ? 'bg-slate-950 border-emerald-500/60'
                          : unlocked
                            ? 'bg-slate-950/60 border-slate-800'
                            : 'bg-slate-950/40 border-slate-800/70 opacity-75'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-white truncate">
                          {tierCfg.icon} {t(SANCTUARY_LAB_KEYS[tier].name)}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {t(SANCTUARY_LAB_KEYS[tier].perk)}
                        </div>
                      </div>
                      <span
                        className={`text-[11px] font-numeric font-semibold shrink-0 ${
                          unlocked ? 'text-emerald-400' : 'text-amber-400'
                        }`}
                      >
                        {unlocked ? t('achievements.unlockedBadge') : `${tierCfg.upgradeCost}`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {nextLab ? (
              <button
                onClick={() => {
                  if (upgradeSanctuaryLab()) {
                    showToast(`${t(SANCTUARY_LAB_KEYS[nextLab.tier].name)}`);
                  }
                }}
                disabled={coins < nextLab.upgradeCost}
                className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-slate-950 text-xs font-bold rounded-lg transition-colors whitespace-nowrap"
              >
                <ArrowUpCircle className="w-4 h-4" />
                <span>
                  {t('sanctuary.upgradeLab')} · {nextLab.upgradeCost} {t('stats.coins')}
                </span>
              </button>
            ) : (
              <div className="text-center text-xs font-semibold text-emerald-400 py-2">
                {t('garden.maxTier')}
              </div>
            )}
          </section>
        </div>

        {/* Mix Loadout Presets & Daily Alchemy Order */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* 3-Slot Mix Loadout Presets */}
          <section className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Bookmark className="w-4 h-4 text-emerald-400 shrink-0" />
                  <h2 className="text-base font-semibold text-white">
                    {t('sanctuary.presetsTitle')}
                  </h2>
                </div>
                <span className="font-numeric text-xs text-slate-400">
                  {presets.filter((p) => p.buffs.length > 0).length} / {MAX_SANCTUARY_PRESETS}
                </span>
              </div>
              <p className="text-xs text-slate-400">{t('sanctuary.presetsHint')}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {Array.from({ length: MAX_SANCTUARY_PRESETS }, (_, slotIdx) => {
                const preset = presets[slotIdx];
                const hasBuffs = Boolean(preset && preset.buffs.length > 0);
                return (
                  <div
                    key={slotIdx}
                    className={`rounded-lg border p-3.5 flex flex-col justify-between gap-3 ${
                      hasBuffs
                        ? 'bg-slate-950 border-slate-700'
                        : 'bg-slate-950/60 border-dashed border-slate-800'
                    }`}
                  >
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-semibold text-white font-numeric">
                          #{slotIdx + 1}
                        </span>
                        {hasBuffs && preset && (
                          <span className="text-[11px] font-numeric text-emerald-400">
                            {preset.buffs.length} {t('sanctuary.slotsLabel')}
                          </span>
                        )}
                      </div>

                      {hasBuffs && preset ? (
                        <div className="space-y-1">
                          {preset.buffs.map((mixId) => {
                            const bp = SANCTUARY_MIX_MAP[mixId];
                            if (!bp) return null;
                            return (
                              <div
                                key={mixId}
                                className="flex items-center gap-1.5 text-[11px] text-slate-200 truncate"
                              >
                                <span aria-hidden="true">{bp.icon}</span>
                                <span className="truncate">{t(SANCTUARY_MIX_KEYS[mixId].name)}</span>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-xs text-slate-500 py-2">
                          {t('sanctuary.emptyPreset')}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          if (applySanctuaryPreset(slotIdx)) {
                            showToast(`${t('sanctuary.presetAppliedToast')} #${slotIdx + 1}`);
                          }
                        }}
                        disabled={!hasBuffs}
                        className="w-full py-1.5 px-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-white text-[11px] font-bold rounded-md transition-colors whitespace-nowrap"
                      >
                        {t('sanctuary.applyPreset')}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (saveSanctuaryPreset(slotIdx)) {
                            showToast(`${t('sanctuary.presetSavedToast')} #${slotIdx + 1}`);
                          }
                        }}
                        disabled={sanctuary.activeBuffs.length === 0}
                        className="w-full py-1.5 px-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-200 text-[11px] font-semibold rounded-md transition-colors whitespace-nowrap"
                      >
                        {t('sanctuary.savePreset')}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Daily Alchemy Order */}
          <section className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between gap-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ClipboardCheck className="w-4 h-4 text-amber-400 shrink-0" />
                  <h2 className="text-base font-semibold text-white">
                    {t('sanctuary.orderTitle')}
                  </h2>
                </div>
                <span className="font-numeric text-xs text-slate-400">
                  {t('sanctuary.orderTotal')}: <strong className="text-amber-400">{completedOrdersCount}</strong>
                </span>
              </div>

              <p className="text-xs text-slate-400">{t('sanctuary.orderHint')}</p>

              {alchemyOrder && (
                <div className="space-y-2.5 pt-2 border-t border-slate-800">
                  {alchemyOrder.requirements.map((req, idx) => {
                    let icon = '🌿';
                    let label = '';
                    let have = 0;

                    if (req.seedId) {
                      icon = SEEDS[req.seedId].icon;
                      label = t(SEED_KEYS[req.seedId].name);
                      have = cropInventory[req.seedId] ?? 0;
                    } else if (req.trophyId) {
                      icon = MONSTER_TROPHIES[req.trophyId].icon;
                      label = t(MONSTER_TROPHY_KEYS[req.trophyId].name);
                      have = trophyInventory[req.trophyId] ?? 0;
                    } else if (req.mixId) {
                      icon = SANCTUARY_MIX_MAP[req.mixId].icon;
                      label = t(SANCTUARY_MIX_KEYS[req.mixId].name);
                      have = sanctuary.mixInventory[req.mixId] ?? 0;
                    }

                    const enough = have >= req.qty;
                    return (
                      <div
                        key={idx}
                        className={`rounded-lg border px-3 py-2 flex items-center justify-between gap-2 text-xs ${
                          enough
                            ? 'bg-slate-950 border-emerald-500/40 text-emerald-300'
                            : 'bg-slate-950/60 border-slate-800 text-slate-300'
                        }`}
                      >
                        <span className="inline-flex items-center gap-2 min-w-0">
                          <span aria-hidden="true">{icon}</span>
                          <span className="truncate font-medium">{label}</span>
                        </span>
                        <span className="font-numeric font-bold shrink-0">
                          {Math.min(have, req.qty)}/{req.qty}
                        </span>
                      </div>
                    );
                  })}

                  <div className="flex items-center justify-between text-xs font-numeric text-amber-300 pt-1">
                    <span>{t('bestiary.statReward')}:</span>
                    <span className="font-bold">
                      +{alchemyOrder.rewardCoins} {t('stats.coins')} · +{alchemyOrder.rewardXp} XP
                    </span>
                  </div>
                </div>
              )}
            </div>

            {alchemyOrder?.completed ? (
              <div className="w-full py-2.5 px-4 bg-emerald-950/60 border border-emerald-600/50 text-emerald-300 text-xs font-bold rounded-lg text-center inline-flex items-center justify-center gap-1.5">
                <Check className="w-4 h-4" />
                <span>{t('sanctuary.orderCompleted')}</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  const res = completeAlchemyOrder();
                  if (res) {
                    const parts = [
                      t('sanctuary.orderCompletedToast'),
                      `+${res.rewardCoins} ${t('stats.coins')}`,
                      `+${res.rewardXp} XP`,
                    ];
                    if (res.leveledUp) parts.push(t('battle.levelUp'));
                    showToast(parts.join(' · '));
                  }
                }}
                disabled={!canFulfillOrder}
                className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-slate-950 text-xs font-bold rounded-lg transition-colors whitespace-nowrap"
              >
                {t('sanctuary.orderSubmit')}
              </button>
            )}
          </section>
        </div>

        {/* Mix & Mutagen Recipes Workbench */}
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-lg font-bold text-white">{t('sanctuary.recipesTitle')}</h2>

            {/* Category Filter Tabs */}
            <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-lg max-w-full">
              {FILTER_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setRecipeFilter(opt.id)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                    recipeFilter === opt.id
                      ? opt.id === 'MUTAGEN'
                        ? 'bg-rose-500 text-white'
                        : 'bg-emerald-500 text-slate-950'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {t(opt.labelKey)} ({filterCounts[opt.id]})
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {filteredBlueprints.map((mix) => {
              const canCraft = isMixReadyToCraft(cropInventory, mix, trophyInventory);
              const stock = sanctuary.mixInventory[mix.id] ?? 0;
              const isArmed = sanctuary.activeBuffs.includes(mix.id);
              const slotsFull = sanctuary.activeBuffs.length >= currentLab.maxBuffSlots;
              const canArm = stock > 0 && !isArmed && !slotsFull;
              const keys = SANCTUARY_MIX_KEYS[mix.id];
              const { positives, drawbacks } = renderMixStatLines(mix);
              const synergyHints = getSynergyHintForMix(mix.id);

              return (
                <div
                  key={mix.id}
                  className={`rounded-xl border p-5 flex flex-col justify-between gap-4 ${
                    isArmed
                      ? 'bg-slate-900 border-emerald-500/70'
                      : mix.isRisky
                        ? 'bg-slate-900 border-rose-500/35'
                        : canCraft
                          ? 'bg-slate-900 border-amber-500/40'
                          : 'bg-slate-900 border-slate-800'
                  }`}
                >
                  <div className="space-y-3">
                    {/* Title + Metadata */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-3xl leading-none shrink-0" aria-hidden="true">
                          {mix.icon}
                        </span>
                        <div className="min-w-0">
                          <h3 className="text-base font-bold text-white truncate">{t(keys.name)}</h3>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs mt-0.5">
                            <span className={`font-medium ${RARITY_TEXT_CLASS[mix.rarity]}`}>
                              {t(RARITY_KEYS[mix.rarity])}
                            </span>
                            <span aria-hidden="true" className="text-slate-600">
                              ·
                            </span>
                            <span className={mix.isRisky ? 'text-rose-400 font-medium' : 'text-slate-400'}>
                              {mix.isRisky
                                ? t('sanctuary.riskyBadge')
                                : mix.disciplineFocus
                                  ? `${t(SANCTUARY_CATEGORY_KEYS[mix.category])} (${t(EXERCISE_DISCIPLINE_KEYS[mix.disciplineFocus])})`
                                  : t(SANCTUARY_CATEGORY_KEYS[mix.category])}
                            </span>
                            <span aria-hidden="true" className="text-slate-600">
                              ·
                            </span>
                            <span className="font-numeric text-slate-300">
                              {t('sanctuary.inStock')}: <strong className="text-white">{stock}</strong>
                            </span>
                          </div>
                        </div>
                      </div>

                      {isArmed && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400 shrink-0">
                          <Check className="w-3.5 h-3.5" />
                          <span>{t('sanctuary.alreadyArmed')}</span>
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed">{t(keys.effect)}</p>

                    {/* Stat Bonuses & Drawbacks */}
                    <div className="space-y-1">
                      {positives.length > 0 && (
                        <div className="text-[11px] font-numeric text-emerald-300/95 leading-relaxed">
                          {positives.join(' · ')}
                        </div>
                      )}
                      {drawbacks.length > 0 && (
                        <div className="inline-flex flex-wrap items-center gap-1.5 text-[11px] font-numeric text-rose-300/95 leading-relaxed">
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                          <span>{drawbacks.join(' · ')}</span>
                        </div>
                      )}
                    </div>

                    {synergyHints.length > 0 && (
                      <div className="text-[11px] text-amber-300/90 leading-snug">
                        <span className="font-semibold">{t('sanctuary.synergyPartners')}:</span>{' '}
                        {synergyHints.join(' · ')}
                      </div>
                    )}

                    {/* Required Ingredients (Crops + Monster Trophies) */}
                    <div className="flex flex-wrap gap-x-4 gap-y-2 pt-2 border-t border-slate-800 text-xs font-numeric">
                      {mix.ingredients.map((req) => {
                        const have = cropInventory[req.seedId] ?? 0;
                        const enough = have >= req.qty;
                        return (
                          <span
                            key={req.seedId}
                            className={`inline-flex items-center gap-1.5 ${
                              enough ? 'text-emerald-300 font-semibold' : 'text-slate-400'
                            }`}
                          >
                            <span>{SEEDS[req.seedId].icon}</span>
                            <span>{t(SEED_KEYS[req.seedId].name)}</span>
                            <span>
                              {Math.min(have, req.qty)}/{req.qty}
                            </span>
                          </span>
                        );
                      })}

                      {mix.trophyIngredients?.map((req) => {
                        const have = trophyInventory[req.trophyId] ?? 0;
                        const enough = have >= req.qty;
                        return (
                          <span
                            key={req.trophyId}
                            className={`inline-flex items-center gap-1.5 ${
                              enough ? 'text-amber-300 font-semibold' : 'text-slate-400'
                            }`}
                          >
                            <span>{MONSTER_TROPHIES[req.trophyId].icon}</span>
                            <span>{t(MONSTER_TROPHY_KEYS[req.trophyId].name)}</span>
                            <span>
                              {Math.min(have, req.qty)}/{req.qty}
                            </span>
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  {/* Craft & Activate Controls */}
                  <div className="flex flex-wrap gap-2.5 pt-1">
                    <button
                      onClick={() => handleCraft(mix)}
                      disabled={!canCraft}
                      className="flex-1 py-2.5 px-4 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-slate-950 text-xs font-bold rounded-lg transition-colors whitespace-nowrap"
                    >
                      {canCraft ? t('sanctuary.craft') : t('sanctuary.needIngredients')}
                    </button>

                    {isArmed ? (
                      <button
                        onClick={() => handleDeactivate(mix.id)}
                        className="flex-1 py-2.5 px-4 bg-emerald-950/60 hover:bg-rose-950/50 border border-emerald-600/50 hover:border-rose-500/60 text-emerald-300 hover:text-rose-200 text-xs font-bold rounded-lg transition-colors whitespace-nowrap"
                      >
                        {t('sanctuary.deactivate')}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleActivate(mix)}
                        disabled={!canArm}
                        className={`flex-1 py-2.5 px-4 text-xs font-bold rounded-lg transition-colors whitespace-nowrap ${
                          canArm
                            ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                            : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                        }`}
                      >
                        {slotsFull && stock > 0
                          ? t('sanctuary.slotsFull')
                          : t('sanctuary.activate')}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Monster Trophies & Botanical Stash */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Monster Trophies */}
          <section className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-400 shrink-0" />
                <h2 className="text-base font-semibold text-white">
                  {t('sanctuary.trophiesTitle')}
                </h2>
              </div>
              <span className="font-numeric text-xs font-semibold text-amber-400">
                {totalTrophies}
              </span>
            </div>

            <p className="text-xs text-slate-400">
              {totalTrophies === 0 ? t('sanctuary.trophiesEmpty') : t('sanctuary.trophiesHint')}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {MONSTER_TROPHY_ORDER.map((trophyId) => {
                const qty = trophyInventory[trophyId] ?? 0;
                const def = MONSTER_TROPHIES[trophyId];
                const keys = MONSTER_TROPHY_KEYS[trophyId];
                return (
                  <div
                    key={trophyId}
                    className={`rounded-lg border px-3.5 py-2.5 flex items-center justify-between gap-2 ${
                      qty > 0
                        ? 'bg-slate-950 border-amber-500/40'
                        : 'bg-slate-950/60 border-slate-800 opacity-65'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-xl shrink-0" aria-hidden="true">
                        {def.icon}
                      </span>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-slate-200 truncate">
                          {t(keys.name)}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">{t(keys.source)}</div>
                      </div>
                    </div>
                    <span className="font-numeric text-sm font-bold text-amber-400 shrink-0">
                      ×{qty}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Botanical Stash Summary & Link to Garden */}
          <section className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Sprout className="w-4 h-4 text-emerald-400 shrink-0" />
                <h2 className="text-base font-semibold text-white">{t('garden.stashTitle')}</h2>
              </div>
              <button
                onClick={onOpenGarden}
                className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors whitespace-nowrap"
              >
                {t('sanctuary.openGarden')} →
              </button>
            </div>

            {totalCrops === 0 ? (
              <p className="text-xs text-slate-400">{t('garden.stashEmpty')}</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
