/**
 * TalentTreeScreen - 3-Branch Hero Talent Tree (MIGHT / BASTION / BOTANY).
 * Earn 1 point per hero level beyond Level 1; respec anytime for 100 Fit-Coins.
 */

import { ArrowLeft, Coins, Lock, RotateCcw, Sparkles } from 'lucide-react';
import {
  TALENTS,
  TALENT_BRANCH_ORDER,
  TALENT_MAP,
  TALENT_RESPEC_COST,
  canUpgradeTalent,
  getAvailableTalentPoints,
} from '../game/data/talents';
import { useGameStore } from '../game/store';
import type { TalentBranch } from '../game/types';
import { useTranslation } from '../i18n/useTranslation';
import { TALENT_BRANCH_KEYS, TALENT_KEYS } from './gameKeys';
import { useVoiceCommandHandler } from './VoiceControl';

interface TalentTreeScreenProps {
  onBack: () => void;
}

const BRANCH_ACCENT_BORDER: Record<TalentBranch, string> = {
  MIGHT: 'border-rose-500/40',
  BASTION: 'border-sky-500/40',
  BOTANY: 'border-emerald-500/40',
};

const BRANCH_HEADER_TEXT: Record<TalentBranch, string> = {
  MIGHT: 'text-rose-400',
  BASTION: 'text-sky-400',
  BOTANY: 'text-emerald-400',
};

export function TalentTreeScreen({ onBack }: TalentTreeScreenProps) {
  const { t } = useTranslation();
  const level = useGameStore((state) => state.player.level);
  const coins = useGameStore((state) => state.coins);
  const talents = useGameStore((state) => state.talents);
  const upgradeTalent = useGameStore((state) => state.upgradeTalent);
  const respecTalents = useGameStore((state) => state.respecTalents);

  const availablePoints = getAvailableTalentPoints(level, talents);
  const canRespec = talents.spentPoints > 0 && coins >= TALENT_RESPEC_COST;

  useVoiceCommandHandler((cmd) => {
    if (cmd.type === 'EXIT') {
      onBack();
      return true;
    }
    return false;
  });

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-800">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-300 hover:text-white rounded-lg hover:bg-slate-900 transition-colors whitespace-nowrap shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{t('menu.back')}</span>
          </button>

          <h1 className="font-display text-2xl font-bold tracking-tight text-white">
            {t('talents.title')}
          </h1>

          <div className="inline-flex items-center gap-2 bg-slate-900 border border-slate-800 px-3.5 py-1.5 rounded-lg shrink-0">
            <Coins className="w-4 h-4 text-amber-400" />
            <span className="font-numeric font-bold text-amber-400">{coins}</span>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-8 space-y-6">
        {/* Points Summary & Respec Bar */}
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-sm text-slate-300">{t('talents.subtitle')}</p>
            <div className="flex flex-wrap items-center gap-5 text-sm pt-1">
              <div className="inline-flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span className="text-slate-400">{t('talents.availablePoints')}:</span>
                <span className="font-numeric text-lg font-bold text-amber-400">
                  {availablePoints}
                </span>
              </div>
              <div className="text-slate-400 font-numeric">
                {t('talents.spentPoints')}:{' '}
                <span className="font-semibold text-white">{talents.spentPoints}</span>
              </div>
              <div className="text-slate-400 font-numeric">
                {t('stats.level')}: <span className="font-semibold text-white">{level}</span>
              </div>
            </div>
          </div>

          <button
            onClick={respecTalents}
            disabled={!canRespec}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white border border-slate-700 transition-colors whitespace-nowrap shrink-0"
          >
            <RotateCcw className="w-4 h-4" />
            <span>
              {t('talents.respec')} ({TALENT_RESPEC_COST} {t('talents.respecCost')})
            </span>
          </button>
        </section>

        {/* 3-Branch Skill Tree Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {TALENT_BRANCH_ORDER.map((branch) => {
            const branchNodes = TALENTS.filter((node) => node.branch === branch).sort(
              (a, b) => a.tier - b.tier
            );

            return (
              <section
                key={branch}
                className={`bg-slate-900 border ${BRANCH_ACCENT_BORDER[branch]} rounded-xl p-5 flex flex-col gap-4`}
              >
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h2 className={`font-display text-lg font-bold ${BRANCH_HEADER_TEXT[branch]}`}>
                    {t(TALENT_BRANCH_KEYS[branch])}
                  </h2>
                  <span className="font-numeric text-xs text-slate-400">
                    {branchNodes.reduce((sum, n) => sum + (talents.ranks[n.id] ?? 0), 0)} /{' '}
                    {branchNodes.reduce((sum, n) => sum + n.maxRank, 0)}
                  </span>
                </div>

                <div className="space-y-3">
                  {branchNodes.map((node) => {
                    const currentRank = talents.ranks[node.id] ?? 0;
                    const isMaxed = currentRank >= node.maxRank;
                    const prereqDef = node.prerequisiteId ? TALENT_MAP[node.prerequisiteId] : null;
                    const prereqMet = prereqDef
                      ? (talents.ranks[prereqDef.id] ?? 0) >= (node.prerequisiteRank ?? 1)
                      : true;
                    const canUpgrade = canUpgradeTalent(level, talents, node.id);

                    return (
                      <div
                        key={node.id}
                        className={`bg-slate-950 border rounded-lg p-4 space-y-2.5 ${
                          currentRank > 0
                            ? 'border-amber-500/50'
                            : prereqMet
                              ? 'border-slate-800'
                              : 'border-slate-800/70 opacity-75'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 min-w-0">
                            <div className="text-2xl select-none shrink-0" aria-hidden="true">
                              {node.icon}
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm font-bold text-white leading-tight">
                                {t(TALENT_KEYS[node.id].name)}
                              </div>
                              <p className="text-xs text-slate-400 mt-1">
                                {t(TALENT_KEYS[node.id].desc)}
                              </p>
                            </div>
                          </div>

                          <div className="font-numeric text-xs font-bold text-amber-400 shrink-0">
                            {currentRank}/{node.maxRank}
                          </div>
                        </div>

                        {prereqDef && !prereqMet && (
                          <div className="inline-flex items-center gap-1.5 text-[11px] text-slate-400">
                            <Lock className="w-3 h-3 shrink-0" />
                            <span>
                              {t('talents.requires')}: {t(TALENT_KEYS[prereqDef.id].name)}
                            </span>
                          </div>
                        )}

                        <div className="flex items-center justify-between gap-3 pt-1">
                          <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-amber-500 transition-[width] duration-200"
                              style={{ width: `${(currentRank / node.maxRank) * 100}%` }}
                            />
                          </div>

                          <button
                            onClick={() => upgradeTalent(node.id)}
                            disabled={!canUpgrade}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                              isMaxed
                                ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-700/50'
                                : canUpgrade
                                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                            }`}
                          >
                            {isMaxed
                              ? t('talents.maxed')
                              : !prereqMet
                                ? t('talents.locked')
                                : availablePoints <= 0
                                  ? t('talents.noPoints')
                                  : t('talents.upgrade')}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </main>
    </div>
  );
}
