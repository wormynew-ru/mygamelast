/**
 * SanctuaryScreen - Hero's Hideout & Botanical Mix Lab.
 * Craft harvested Garden crops into combat mixes, upgrade lab capacity,
 * recover HP, and arm pre-battle buffs for upcoming fights.
 */

import { useState } from 'react';
import {
  ArrowLeft,
  ArrowUpCircle,
  Check,
  Coins,
  FlaskConical,
  Heart,
  Shield,
  Sprout,
  Sword,
  Swords,
  Zap,
} from 'lucide-react';
import { SEEDS, SEED_ORDER } from '../game/data/garden';
import {
  SANCTUARY_LAB_TIERS,
  SANCTUARY_MIX_BLUEPRINTS,
  SANCTUARY_MIX_MAP,
  getAggregatedSanctuaryBuffs,
  getMixEffectiveHeal,
  getNextSanctuaryLabTier,
  getTotalCropCount,
  getTotalMixCount,
  isMixReadyToCraft,
  type SanctuaryMixBlueprint,
} from '../game/data/sanctuary';
import type { SanctuaryLabTier, SanctuaryMixId } from '../game/types';
import { selectEffectivePlayerStats, useGameStore } from '../game/store';
import { useTranslation } from '../i18n/useTranslation';
import {
  RARITY_KEYS,
  RARITY_TEXT_CLASS,
  SANCTUARY_LAB_KEYS,
  SANCTUARY_MIX_KEYS,
  SEED_KEYS,
} from './gameKeys';
import { useVoiceCommandHandler } from './VoiceControl';

interface SanctuaryScreenProps {
  onBack: () => void;
  onOpenGarden: () => void;
  onOpenBattle: () => void;
}

export function SanctuaryScreen({
  onBack,
  onOpenGarden,
  onOpenBattle,
}: SanctuaryScreenProps) {
  const { t } = useTranslation();
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const coins = useGameStore((state) => state.coins);
  const basePlayer = useGameStore((state) => state.player);
  const cropInventory = useGameStore((state) => state.garden.cropInventory);
  const sanctuary = useGameStore((state) => state.sanctuary);
  const craftMix = useGameStore((state) => state.craftMix);
  const activateMixBuff = useGameStore((state) => state.activateMixBuff);
  const upgradeSanctuaryLab = useGameStore((state) => state.upgradeSanctuaryLab);

  const effectivePlayer = selectEffectivePlayerStats(useGameStore.getState());
  const currentLab = SANCTUARY_LAB_TIERS[sanctuary.labTier];
  const nextLabTier = getNextSanctuaryLabTier(sanctuary.labTier);
  const nextLab = nextLabTier ? SANCTUARY_LAB_TIERS[nextLabTier] : null;
  const aggregatedBuffs = getAggregatedSanctuaryBuffs(sanctuary.activeBuffs, sanctuary.labTier);

  const totalCrops = getTotalCropCount(cropInventory);
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

  const renderMixStatLines = (bp: SanctuaryMixBlueprint) => {
    const healHp = getMixEffectiveHeal(bp, sanctuary.labTier);
    const parts: string[] = [];
    if (healHp > 0) parts.push(`${t('sanctuary.statInstantHeal')}: +${healHp} HP`);
    if (bp.effect.attackBonus > 0) {
      parts.push(`${t('sanctuary.statAttack')} +${bp.effect.attackBonus}`);
    }
    if (bp.effect.defenseBonus > 0) {
      parts.push(`${t('sanctuary.statDefense')} +${bp.effect.defenseBonus}`);
    }
    if (bp.effect.critChanceBonus > 0) {
      parts.push(`${t('sanctuary.statCrit')} +${Math.round(bp.effect.critChanceBonus * 100)}%`);
    }
    if (bp.effect.comboWindowBonusMs > 0) {
      parts.push(`${t('sanctuary.statComboWindow')} +${(bp.effect.comboWindowBonusMs / 1000).toFixed(1)}s`);
    }
    if (bp.effect.incomingDamageMultiplier < 1) {
      parts.push(
        `${t('sanctuary.statDamageReduce')} -${Math.round((1 - bp.effect.incomingDamageMultiplier) * 100)}%`
      );
    }
    if (bp.effect.startingUltimateCharge > 0) {
      parts.push(`${t('sanctuary.statStartUlt')} +${bp.effect.startingUltimateCharge}%`);
    }
    if (bp.effect.ultimateChargeMultiplier > 1) {
      parts.push(
        `${t('sanctuary.statUltCharge')} +${Math.round((bp.effect.ultimateChargeMultiplier - 1) * 100)}%`
      );
    }
    if (bp.effect.xpMultiplier > 1) {
      parts.push(`${t('sanctuary.statXpBoost')} +${Math.round((bp.effect.xpMultiplier - 1) * 100)}%`);
    }
    return parts;
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
          {/* Active Pre-Battle Buffs */}
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
                        className="rounded-lg border border-dashed border-slate-800 bg-slate-950/60 px-3.5 py-4 flex flex-col items-center justify-center text-center gap-1 min-h-[88px]"
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
                      className="rounded-lg border border-emerald-500/50 bg-slate-950 px-3.5 py-3 flex flex-col justify-between gap-1.5 min-h-[88px]"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-2xl leading-none" aria-hidden="true">
                          {blueprint.icon}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
                          <Check className="w-3.5 h-3.5" />
                          <span>{t('sanctuary.alreadyArmed')}</span>
                        </span>
                      </div>
                      <div className="text-xs font-bold text-white truncate">
                        {t(SANCTUARY_MIX_KEYS[mixId].name)}
                      </div>
                    </div>
                  );
                })}
              </div>

              <p className="text-xs text-slate-400 leading-relaxed">{t('sanctuary.activeBuffsHint')}</p>
            </div>

            {/* Live Hero Readiness Strip */}
            <div className="pt-4 border-t border-slate-800 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-4 text-xs font-numeric">
                <span className="inline-flex items-center gap-1.5 text-slate-200 font-semibold">
                  <Heart className="w-4 h-4 text-emerald-400" />
                  <span>
                    {effectivePlayer.hp} / {effectivePlayer.maxHp} HP
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
              {effectivePlayer.attack > basePlayer.attack && (
                <div className="text-[11px] text-slate-500 font-numeric">
                  {t('stats.level')} {basePlayer.level} · {t('stats.crit')}{' '}
                  {Math.round(effectivePlayer.critChance * 100)}%
                </div>
              )}
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

        {/* Botanical Mix Recipes & Crafting Workbench */}
        <section className="space-y-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-bold text-white">{t('sanctuary.recipesTitle')}</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {SANCTUARY_MIX_BLUEPRINTS.map((mix) => {
              const canCraft = isMixReadyToCraft(cropInventory, mix);
              const stock = sanctuary.mixInventory[mix.id] ?? 0;
              const isArmed = sanctuary.activeBuffs.includes(mix.id);
              const slotsFull = sanctuary.activeBuffs.length >= currentLab.maxBuffSlots;
              const canArm = stock > 0 && !isArmed && !slotsFull;
              const keys = SANCTUARY_MIX_KEYS[mix.id];
              const statLines = renderMixStatLines(mix);

              return (
                <div
                  key={mix.id}
                  className={`rounded-xl border p-5 flex flex-col justify-between gap-4 ${
                    isArmed
                      ? 'bg-slate-900 border-emerald-500/70'
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
                          <div className="flex items-center gap-2 text-xs mt-0.5">
                            <span className={`font-medium ${RARITY_TEXT_CLASS[mix.rarity]}`}>
                              {t(RARITY_KEYS[mix.rarity])}
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

                    {/* Stat Bonuses */}
                    <div className="text-[11px] font-numeric text-emerald-300/95 leading-relaxed">
                      {statLines.join(' · ')}
                    </div>

                    {/* Required Ingredients */}
                    <div className="flex flex-wrap gap-3 pt-2 border-t border-slate-800 text-xs font-numeric">
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

                    <button
                      onClick={() => handleActivate(mix)}
                      disabled={!canArm}
                      className={`flex-1 py-2.5 px-4 text-xs font-bold rounded-lg transition-colors whitespace-nowrap ${
                        isArmed
                          ? 'bg-emerald-950/60 border border-emerald-600/50 text-emerald-300 cursor-default'
                          : canArm
                            ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                            : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      {isArmed
                        ? t('sanctuary.alreadyArmed')
                        : slotsFull && stock > 0
                          ? t('sanctuary.slotsFull')
                          : t('sanctuary.activate')}
                    </button>
                  </div>
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
          )}
        </section>
      </main>
    </div>
  );
}
