/**
 * LevelSelectScreen - Campaign level & Endless Arena survival mode selector.
 * Shows enemy archetypes, exercise weaknesses/resistances, and lets the player
 * start either a campaign stage or Endless Arena Wave 1.
 */

import { useState } from 'react';
import { ArrowLeft, Lock, Check, Swords, Infinity as InfinityIcon, Shield } from 'lucide-react';
import { LEVELS, type CampaignLevel } from '../game/data/levels';
import { MONSTERS } from '../game/data/monsters';
import { EXERCISES, type ExerciseId } from '../game/data/exercises';
import { useGameStore } from '../game/store';
import { useTranslation } from '../i18n/useTranslation';
import {
  ARCHETYPE_KEYS,
  EXERCISE_DESC_KEYS,
  EXERCISE_NAME_KEYS,
  MONSTER_DESC_KEYS,
  MONSTER_NAME_KEYS,
} from './gameKeys';

interface LevelSelectScreenProps {
  onBack: () => void;
  onStartEncounter: (levelId: string, exerciseId: ExerciseId) => void;
  onStartEndless: (exerciseId: ExerciseId) => void;
}

export function LevelSelectScreen({
  onBack,
  onStartEncounter,
  onStartEndless,
}: LevelSelectScreenProps) {
  const { t } = useTranslation();
  const unlockedLevels = useGameStore((state) => state.unlockedLevels);
  const completedLevels = useGameStore((state) => state.completedLevels);
  const endlessStats = useGameStore((state) => state.endlessStats);

  const defaultLevel =
    LEVELS.find((lvl) => unlockedLevels.includes(lvl.id) && !completedLevels.includes(lvl.id)) ??
    LEVELS[0];

  const [modeTab, setModeTab] = useState<'CAMPAIGN' | 'ENDLESS'>('CAMPAIGN');
  const [selectedLevelId, setSelectedLevelId] = useState<string>(defaultLevel.id);
  const [selectedExercise, setSelectedExercise] = useState<ExerciseId>(
    defaultLevel.recommendedExercise
  );

  const selectedLevel: CampaignLevel =
    LEVELS.find((lvl) => lvl.id === selectedLevelId) ?? LEVELS[0];
  const selectedMonster = MONSTERS[selectedLevel.monsterId];
  const isSelectedUnlocked = unlockedLevels.includes(selectedLevel.id);

  const handleSelectLevel = (level: CampaignLevel) => {
    if (!unlockedLevels.includes(level.id)) {
      return;
    }
    setSelectedLevelId(level.id);
    setSelectedExercise(level.recommendedExercise);
  };

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-800">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-300 hover:text-white rounded-lg hover:bg-slate-900 transition-colors whitespace-nowrap shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{t('menu.back')}</span>
          </button>

          <div className="inline-flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-lg">
            <button
              onClick={() => setModeTab('CAMPAIGN')}
              className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                modeTab === 'CAMPAIGN'
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              {t('levels.campaignTab')}
            </button>
            <button
              onClick={() => setModeTab('ENDLESS')}
              className={`inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                modeTab === 'ENDLESS'
                  ? 'bg-emerald-500 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <InfinityIcon className="w-3.5 h-3.5" />
              <span>{t('levels.endlessTab')}</span>
            </button>
          </div>

          <div className="w-24" aria-hidden="true" />
        </div>
      </header>

      {modeTab === 'CAMPAIGN' ? (
        <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Stage List */}
          <section className="lg:col-span-6 space-y-3">
            <p className="text-sm text-slate-400 mb-4">{t('levels.subtitle')}</p>

            {LEVELS.map((level) => {
              const monster = MONSTERS[level.monsterId];
              const isUnlocked = unlockedLevels.includes(level.id);
              const isCompleted = completedLevels.includes(level.id);
              const isSelected = level.id === selectedLevel.id;

              const nameKey = MONSTER_NAME_KEYS[level.monsterId];
              const monsterName = nameKey ? t(nameKey) : monster.name;

              return (
                <button
                  key={level.id}
                  onClick={() => handleSelectLevel(level)}
                  disabled={!isUnlocked}
                  className={`w-full text-left p-4 rounded-xl border transition-colors flex items-center justify-between gap-4 ${
                    !isUnlocked
                      ? 'bg-slate-900/40 border-slate-800/60 opacity-50 cursor-not-allowed'
                      : isSelected
                      ? 'bg-slate-900 border-amber-500'
                      : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="text-3xl shrink-0" aria-hidden="true">
                      {monster.sprite}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs text-slate-400">
                        {t('levels.stage')} {level.order} · {t(ARCHETYPE_KEYS[monster.archetype])}
                      </div>
                      <div className="text-base font-semibold text-white truncate">
                        {monsterName}
                      </div>
                      <div className="text-xs text-slate-400 font-numeric mt-0.5">
                        HP {monster.maxHp} · +{monster.xpReward} {t('levels.xpReward')} · +
                        {monster.coinReward} {t('stats.coins')}
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 text-xs font-medium">
                    {!isUnlocked ? (
                      <span className="inline-flex items-center gap-1 text-slate-500">
                        <Lock className="w-4 h-4" />
                        <span>{t('levels.locked')}</span>
                      </span>
                    ) : isCompleted ? (
                      <span className="inline-flex items-center gap-1 text-emerald-400">
                        <Check className="w-4 h-4" />
                        <span>{t('levels.completed')}</span>
                      </span>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </section>

          {/* Encounter Setup & Exercise Picker */}
          <section className="lg:col-span-6 bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col justify-between gap-6">
            <div className="space-y-6">
              {/* Selected Monster Info */}
              <div className="flex items-start gap-4 pb-6 border-b border-slate-800">
                <div className="text-5xl shrink-0" aria-hidden="true">
                  {selectedMonster.sprite}
                </div>
                <div>
                  <div className="text-xs text-amber-400 font-medium">
                    {t('levels.stage')} {selectedLevel.order} ·{' '}
                    {t(ARCHETYPE_KEYS[selectedMonster.archetype])}
                  </div>
                  <h2 className="text-2xl font-bold text-white mt-0.5">
                    {MONSTER_NAME_KEYS[selectedLevel.monsterId]
                      ? t(MONSTER_NAME_KEYS[selectedLevel.monsterId])
                      : selectedMonster.name}
                  </h2>
                  <p className="text-sm text-slate-400 mt-1">
                    {MONSTER_DESC_KEYS[selectedLevel.monsterId]
                      ? t(MONSTER_DESC_KEYS[selectedLevel.monsterId])
                      : selectedMonster.description}
                  </p>
                  <div className="text-xs text-slate-300 font-numeric mt-3">
                    HP {selectedMonster.maxHp} · {t('stats.defense')} {selectedMonster.defense} · +
                    {selectedMonster.xpReward} {t('levels.xpReward')} · +{selectedMonster.coinReward}{' '}
                    {t('stats.coins')}
                  </div>
                  <div className="flex flex-wrap gap-4 text-xs mt-2">
                    <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
                      <Swords className="w-3.5 h-3.5" />
                      <span>
                        {t('levels.weakTo')}: {t(EXERCISE_NAME_KEYS[selectedMonster.weakTo])}
                      </span>
                    </span>
                    <span className="inline-flex items-center gap-1 text-slate-400">
                      <Shield className="w-3.5 h-3.5" />
                      <span>
                        {t('levels.resistantTo')}: {t(EXERCISE_NAME_KEYS[selectedMonster.resistantTo])}
                      </span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Exercise Selection */}
              <div>
                <h3 className="text-sm font-semibold text-slate-200 mb-3">
                  {t('levels.chooseExercise')}
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(Object.keys(EXERCISES) as ExerciseId[]).map((exerciseId) => {
                    const def = EXERCISES[exerciseId];
                    const isActive = selectedExercise === exerciseId;
                    const isWeakness = selectedMonster.weakTo === exerciseId;
                    const isResistant = selectedMonster.resistantTo === exerciseId;

                    return (
                      <button
                        key={exerciseId}
                        onClick={() => setSelectedExercise(exerciseId)}
                        className={`p-3.5 rounded-lg border text-left transition-colors ${
                          isActive
                            ? 'bg-slate-800 border-emerald-500'
                            : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-sm text-white">
                            {def.icon} {t(EXERCISE_NAME_KEYS[exerciseId])}
                          </span>
                          <span className="text-xs font-numeric text-amber-400">
                            ×{def.damageMultiplier}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400 mt-1">
                          {def.trackingType === 'hold' ? t('levels.holdType') : t('levels.repType')}
                          {isWeakness ? (
                            <span className="text-emerald-400 font-medium"> · ×1.5</span>
                          ) : isResistant ? (
                            <span className="text-slate-500"> · ×0.75</span>
                          ) : null}
                        </div>
                      </button>
                    );
                  })}
                </div>

                <p className="text-xs text-slate-400 mt-3">
                  {t(EXERCISE_DESC_KEYS[selectedExercise])}
                </p>
              </div>
            </div>

            <button
              onClick={() => onStartEncounter(selectedLevel.id, selectedExercise)}
              disabled={!isSelectedUnlocked}
              className="w-full inline-flex items-center justify-center gap-2.5 px-6 py-3.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-base rounded-lg transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            >
              <Swords className="w-5 h-5" />
              <span>{t('levels.startFight')}</span>
            </button>
          </section>
        </main>
      ) : (
        /* Endless Arena Setup */
        <main className="flex-1 max-w-3xl w-full mx-auto px-6 py-10">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-4 pb-6 border-b border-slate-800">
              <div>
                <div className="text-xs font-semibold text-emerald-400">
                  {t('levels.endlessTab')}
                </div>
                <h2 className="font-display text-3xl font-bold text-white mt-1">
                  {t('levels.endlessTitle')}
                </h2>
                <p className="text-sm text-slate-400 mt-2 max-w-xl">
                  {t('levels.endlessSubtitle')}
                </p>
              </div>
              <div className="bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-right">
                <div className="text-xs text-slate-400">{t('levels.endlessRecord')}</div>
                <div className="font-numeric text-2xl font-bold text-amber-400 mt-0.5">
                  {t('battle.waveLabel')} {endlessStats.bestWave}
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-slate-200 mb-3">
                {t('levels.chooseExercise')}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(Object.keys(EXERCISES) as ExerciseId[]).map((exerciseId) => {
                  const def = EXERCISES[exerciseId];
                  const isActive = selectedExercise === exerciseId;

                  return (
                    <button
                      key={exerciseId}
                      onClick={() => setSelectedExercise(exerciseId)}
                      className={`p-3.5 rounded-lg border text-left transition-colors ${
                        isActive
                          ? 'bg-slate-800 border-emerald-500'
                          : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-sm text-white">
                          {def.icon} {t(EXERCISE_NAME_KEYS[exerciseId])}
                        </span>
                        <span className="text-xs font-numeric text-amber-400">
                          ×{def.damageMultiplier}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 mt-1">
                        {def.trackingType === 'hold' ? t('levels.holdType') : t('levels.repType')}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              onClick={() => onStartEndless(selectedExercise)}
              className="w-full inline-flex items-center justify-center gap-2.5 px-6 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-base rounded-lg transition-colors whitespace-nowrap"
            >
              <InfinityIcon className="w-5 h-5" />
              <span>{t('levels.endlessStart')}</span>
            </button>
          </div>
        </main>
      )}
    </div>
  );
}
