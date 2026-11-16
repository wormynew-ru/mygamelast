/**
 * LevelSelectScreen - Campaign level & exercise selector.
 * Lets the player pick any unlocked stage and choose which real-world exercise
 * (Squats, Push-Ups, Plank, Jumping Jacks) to use in battle.
 */

import { useState } from 'react';
import { ArrowLeft, Lock, Check, Swords } from 'lucide-react';
import { LEVELS, type CampaignLevel } from '../game/data/levels';
import { MONSTERS } from '../game/data/monsters';
import { EXERCISES, type ExerciseId } from '../game/data/exercises';
import { useGameStore } from '../game/store';
import { useTranslation, type TranslationKey } from '../i18n/useTranslation';

interface LevelSelectScreenProps {
  onBack: () => void;
  onStartEncounter: (levelId: string, exerciseId: ExerciseId) => void;
}

const MONSTER_NAME_KEYS: Record<string, TranslationKey> = {
  BURGER: 'monster.BURGER.name',
  PIZZA: 'monster.PIZZA.name',
  SODA: 'monster.SODA.name',
  DONUT: 'monster.DONUT.name',
  BOSS_KING_BURGER: 'monster.BOSS_KING_BURGER.name',
};

const MONSTER_DESC_KEYS: Record<string, TranslationKey> = {
  BURGER: 'monster.BURGER.description',
  PIZZA: 'monster.PIZZA.description',
  SODA: 'monster.SODA.description',
  DONUT: 'monster.DONUT.description',
  BOSS_KING_BURGER: 'monster.BOSS_KING_BURGER.description',
};

const EXERCISE_NAME_KEYS: Record<ExerciseId, TranslationKey> = {
  SQUAT: 'exercise.SQUAT.name',
  PUSH_UP: 'exercise.PUSH_UP.name',
  PLANK: 'exercise.PLANK.name',
  JUMPING_JACK: 'exercise.JUMPING_JACK.name',
};

const EXERCISE_DESC_KEYS: Record<ExerciseId, TranslationKey> = {
  SQUAT: 'exercise.SQUAT.description',
  PUSH_UP: 'exercise.PUSH_UP.description',
  PLANK: 'exercise.PLANK.description',
  JUMPING_JACK: 'exercise.JUMPING_JACK.description',
};

export function LevelSelectScreen({ onBack, onStartEncounter }: LevelSelectScreenProps) {
  const { t } = useTranslation();
  const unlockedLevels = useGameStore((state) => state.unlockedLevels);
  const completedLevels = useGameStore((state) => state.completedLevels);

  const defaultLevel =
    LEVELS.find((lvl) => unlockedLevels.includes(lvl.id) && !completedLevels.includes(lvl.id)) ??
    LEVELS[0];

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

          <h1 className="font-display text-2xl font-bold tracking-tight text-white">
            {t('levels.title')}
          </h1>

          <div className="w-24" aria-hidden="true" />
        </div>
      </header>

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
                      {t('levels.stage')} {level.order}
                      {monster.isBoss ? ` · ${t('levels.bossLabel')}` : ''}
                    </div>
                    <div className="text-base font-semibold text-white truncate">
                      {monsterName}
                    </div>
                    <div className="text-xs text-slate-400 font-numeric mt-0.5">
                      HP {monster.maxHp} · {t('levels.xpReward')} {monster.xpReward}
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
                  {t('levels.stage')} {selectedLevel.order}
                  {selectedMonster.isBoss ? ` · ${t('levels.bossLabel')}` : ''}
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
                  HP {selectedMonster.maxHp} · {t('stats.defense')} {selectedMonster.defense} · {t('levels.xpReward')} +{selectedMonster.xpReward}
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
                  const isRecommended = selectedLevel.recommendedExercise === exerciseId;

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
                        {isRecommended ? ` · ${t('levels.recommended')}` : ''}
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
    </div>
  );
}
