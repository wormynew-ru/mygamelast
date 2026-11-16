/**
 * LevelSelectScreen - Campaign, Endless Arena, and Circuit Dungeon selector
 * with Bodyweight / Dumbbell Loadout weight configuration.
 */

import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Lock,
  Check,
  Swords,
  Infinity as InfinityIcon,
  Shield,
  Dumbbell,
  Repeat,
  FlaskConical,
} from 'lucide-react';
import { LEVELS, type CampaignLevel } from '../game/data/levels';
import { MONSTERS } from '../game/data/monsters';
import { EXERCISES, type ExerciseId } from '../game/data/exercises';
import { CIRCUITS, type CircuitId } from '../game/data/circuits';
import { SANCTUARY_MIX_MAP } from '../game/data/sanctuary';
import { useGameStore } from '../game/store';
import { useTranslation } from '../i18n/useTranslation';
import {
  ARCHETYPE_KEYS,
  CIRCUIT_KEYS,
  EXERCISE_DESC_KEYS,
  EXERCISE_NAME_KEYS,
  MONSTER_DESC_KEYS,
  MONSTER_NAME_KEYS,
  SANCTUARY_MIX_KEYS,
} from './gameKeys';
import { useVoiceCommandHandler } from './VoiceControl';

interface LevelSelectScreenProps {
  initialTab?: 'CAMPAIGN' | 'ENDLESS' | 'CIRCUIT';
  onBack: () => void;
  onStartEncounter: (levelId: string, exerciseId: ExerciseId) => void;
  onStartEndless: (exerciseId: ExerciseId) => void;
  onStartCircuit: (circuitId: CircuitId) => void;
  onOpenSanctuary?: () => void;
}

const WEIGHT_PRESETS = [1, 2, 3, 5, 7.5, 10, 12.5, 15] as const;

export function LevelSelectScreen({
  initialTab = 'CAMPAIGN',
  onBack,
  onStartEncounter,
  onStartEndless,
  onStartCircuit,
  onOpenSanctuary,
}: LevelSelectScreenProps) {
  const { t } = useTranslation();
  const unlockedLevels = useGameStore((state) => state.unlockedLevels);
  const completedLevels = useGameStore((state) => state.completedLevels);
  const endlessStats = useGameStore((state) => state.endlessStats);
  const loadout = useGameStore((state) => state.loadout);
  const activeBuffs = useGameStore((state) => state.sanctuary.activeBuffs);
  const setLoadout = useGameStore((state) => state.setLoadout);

  const defaultLevel =
    LEVELS.find((lvl) => unlockedLevels.includes(lvl.id) && !completedLevels.includes(lvl.id)) ??
    LEVELS[0];

  const [modeTab, setModeTab] = useState<'CAMPAIGN' | 'ENDLESS' | 'CIRCUIT'>(initialTab);
  const [selectedLevelId, setSelectedLevelId] = useState<string>(defaultLevel.id);
  const [selectedExercise, setSelectedExercise] = useState<ExerciseId>(
    defaultLevel.recommendedExercise
  );

  useEffect(() => {
    setModeTab(initialTab);
  }, [initialTab]);

  const selectedLevel: CampaignLevel =
    LEVELS.find((lvl) => lvl.id === selectedLevelId) ?? LEVELS[0];
  const selectedMonster = MONSTERS[selectedLevel.monsterId];
  const isSelectedUnlocked = unlockedLevels.includes(selectedLevel.id);

  const dmgBonusPct =
    loadout.mode === 'DUMBBELLS' ? Math.round(Math.min(60, loadout.weightKg * 4)) : 0;

  const handleSelectLevel = (level: CampaignLevel) => {
    if (!unlockedLevels.includes(level.id)) {
      return;
    }
    setSelectedLevelId(level.id);
    setSelectedExercise(level.recommendedExercise);
  };

  useVoiceCommandHandler((cmd) => {
    switch (cmd.type) {
      case 'NAV_CAMPAIGN':
        setModeTab('CAMPAIGN');
        return true;
      case 'NAV_ENDLESS':
        setModeTab('ENDLESS');
        return true;
      case 'NAV_CIRCUIT':
        setModeTab('CIRCUIT');
        return true;
      case 'SELECT_EXERCISE':
        setSelectedExercise(cmd.exerciseId);
        return true;
      case 'START_CIRCUIT':
        onStartCircuit(cmd.circuitId);
        return true;
      case 'START_FIGHT':
      case 'RESUME':
        if (modeTab === 'CAMPAIGN' && isSelectedUnlocked) {
          onStartEncounter(selectedLevel.id, selectedExercise);
        } else if (modeTab === 'ENDLESS') {
          onStartEndless(selectedExercise);
        } else if (modeTab === 'CIRCUIT' && CIRCUITS[0]) {
          onStartCircuit(CIRCUITS[0].id);
        }
        return true;
      case 'EXIT':
        onBack();
        return true;
      default:
        return false;
    }
  });

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-800">
        <div className="max-w-5xl mx-auto px-6 py-4 flex flex-wrap items-center justify-between gap-4">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-300 hover:text-white rounded-lg hover:bg-slate-900 transition-colors whitespace-nowrap shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{t('menu.back')}</span>
          </button>

          <div className="flex flex-wrap items-center justify-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-lg max-w-full">
            <button
              onClick={() => setModeTab('CAMPAIGN')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                modeTab === 'CAMPAIGN'
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              {t('levels.campaignTab')}
            </button>
            <button
              onClick={() => setModeTab('ENDLESS')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                modeTab === 'ENDLESS'
                  ? 'bg-emerald-500 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <InfinityIcon className="w-3.5 h-3.5" />
              <span>{t('levels.endlessTab')}</span>
            </button>
            <button
              onClick={() => setModeTab('CIRCUIT')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                modeTab === 'CIRCUIT'
                  ? 'bg-sky-400 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Repeat className="w-3.5 h-3.5" />
              <span>{t('levels.circuitTab')}</span>
            </button>
          </div>

          <div className="hidden sm:block w-24" aria-hidden="true" />
        </div>
      </header>

      {/* Equipment Loadout Bar (Bodyweight vs Dumbbells kg) */}
      <div className="border-b border-slate-800/80 bg-slate-900/50">
        <div className="max-w-5xl mx-auto px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-300">
              <Dumbbell className="w-4 h-4 text-amber-400" />
              <span>{t('loadout.title')}:</span>
            </span>

            <div className="inline-flex items-center p-0.5 bg-slate-950 border border-slate-800 rounded-lg">
              <button
                type="button"
                onClick={() => setLoadout({ mode: 'BODYWEIGHT', weightKg: 0 })}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                  loadout.mode === 'BODYWEIGHT'
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {t('loadout.bodyweight')}
              </button>
              <button
                type="button"
                onClick={() =>
                  setLoadout({
                    mode: 'DUMBBELLS',
                    weightKg: loadout.weightKg > 0 ? loadout.weightKg : 2,
                  })
                }
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                  loadout.mode === 'DUMBBELLS'
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {t('loadout.dumbbells')}
              </button>
            </div>

            {loadout.mode === 'DUMBBELLS' && (
              <div className="flex flex-wrap items-center gap-1">
                {WEIGHT_PRESETS.map((kg) => (
                  <button
                    key={kg}
                    type="button"
                    onClick={() => setLoadout({ mode: 'DUMBBELLS', weightKg: kg })}
                    className={`px-2 py-1 text-xs font-numeric font-semibold rounded border transition-colors whitespace-nowrap ${
                      loadout.weightKg === kg
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {kg} {t('loadout.kgUnit')}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 font-numeric">
            {loadout.mode === 'DUMBBELLS' ? (
              <span className="text-amber-300 font-semibold">
                ×2 · +{dmgBonusPct}% {t('levels.damageLabel')}
              </span>
            ) : (
              <span>{t('loadout.bodyweightHint')}</span>
            )}

            {onOpenSanctuary && (
              <>
                <span aria-hidden="true" className="text-slate-700">
                  ·
                </span>
                <button
                  type="button"
                  onClick={onOpenSanctuary}
                  className={`inline-flex items-center gap-1.5 font-semibold transition-colors whitespace-nowrap ${
                    activeBuffs.length > 0
                      ? 'text-emerald-400 hover:text-emerald-300'
                      : 'text-slate-400 hover:text-emerald-300'
                  }`}
                >
                  <FlaskConical className="w-3.5 h-3.5" />
                  <span>
                    {activeBuffs.length > 0
                      ? activeBuffs
                          .map((id) => `${SANCTUARY_MIX_MAP[id]?.icon ?? ''} ${t(SANCTUARY_MIX_KEYS[id].name)}`)
                          .join(', ')
                      : t('sanctuary.goCraftMixes')}
                  </span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

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
                        {t('levels.resistantTo')}:{' '}
                        {t(EXERCISE_NAME_KEYS[selectedMonster.resistantTo])}
                      </span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Exercise Selection (7 exercises) */}
              <div>
                <h3 className="text-sm font-semibold text-slate-200 mb-3">
                  {t('levels.chooseExercise')}
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {(Object.keys(EXERCISES) as ExerciseId[]).map((exerciseId) => {
                    const def = EXERCISES[exerciseId];
                    const isActive = selectedExercise === exerciseId;
                    const isWeakness = selectedMonster.weakTo === exerciseId;
                    const isResistant = selectedMonster.resistantTo === exerciseId;

                    return (
                      <button
                        key={exerciseId}
                        onClick={() => setSelectedExercise(exerciseId)}
                        className={`p-3 rounded-lg border text-left transition-colors ${
                          isActive
                            ? 'bg-slate-800 border-emerald-500'
                            : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-semibold text-sm text-white leading-snug">
                            {def.icon} {t(EXERCISE_NAME_KEYS[exerciseId])}
                          </span>
                          <span className="text-xs font-numeric text-amber-400 shrink-0 pt-0.5">
                            ×{def.damageMultiplier}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400 mt-1 flex items-center justify-between gap-1">
                          <span>
                            {def.trackingType === 'hold'
                              ? t('levels.holdType')
                              : t('levels.repType')}
                            {isWeakness ? (
                              <span className="text-emerald-400 font-medium"> · ×1.5</span>
                            ) : isResistant ? (
                              <span className="text-slate-500"> · ×0.75</span>
                            ) : null}
                          </span>
                          {def.supportsDumbbellWeight && loadout.mode === 'DUMBBELLS' && (
                            <span className="text-amber-300 font-numeric text-[11px]">
                              +{loadout.weightKg}
                              {t('loadout.kgUnit')}
                            </span>
                          )}
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
      ) : modeTab === 'ENDLESS' ? (
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
                      <div className="text-xs text-slate-400 mt-1 flex items-center justify-between">
                        <span>
                          {def.trackingType === 'hold' ? t('levels.holdType') : t('levels.repType')}
                        </span>
                        {def.supportsDumbbellWeight && loadout.mode === 'DUMBBELLS' && (
                          <span className="text-amber-300 font-numeric text-[11px]">
                            +{loadout.weightKg}
                            {t('loadout.kgUnit')}
                          </span>
                        )}
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
      ) : (
        /* Circuit Training Dungeons */
        <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-8 space-y-6">
          <div>
            <h2 className="font-display text-3xl font-bold text-white">{t('circuits.title')}</h2>
            <p className="text-sm text-slate-400 mt-1">{t('circuits.subtitle')}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {CIRCUITS.map((circuit) => {
              const keys = CIRCUIT_KEYS[circuit.id];
              return (
                <div
                  key={circuit.id}
                  className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col justify-between gap-5"
                >
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-4xl" aria-hidden="true">
                        {circuit.icon}
                      </span>
                      <span className="text-xs font-numeric text-sky-400 font-semibold">
                        {circuit.rooms.length} {t('circuits.roomsCount')}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-lg font-bold text-white">{t(keys.name)}</h3>
                      <p className="text-xs text-slate-400 mt-1">{t(keys.description)}</p>
                    </div>

                    <div className="space-y-1.5 pt-3 border-t border-slate-800 text-xs">
                      {circuit.rooms.map((room, idx) => {
                        const monster = MONSTERS[room.monsterId];
                        const ex = EXERCISES[room.exerciseId];
                        return (
                          <div
                            key={`${circuit.id}-${idx}`}
                            className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 text-slate-300"
                          >
                            <span className="font-medium text-slate-200">
                              {idx + 1}. {ex.icon} {t(EXERCISE_NAME_KEYS[room.exerciseId])}
                            </span>
                            <span className="text-slate-400">
                              vs {monster?.sprite}{' '}
                              {MONSTER_NAME_KEYS[room.monsterId]
                                ? t(MONSTER_NAME_KEYS[room.monsterId])
                                : monster?.name}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-3 pt-2 border-t border-slate-800">
                    <div className="text-xs font-numeric text-amber-400 font-semibold">
                      +{circuit.bonusCoins} {t('stats.coins')} · +{circuit.bonusXp} XP
                    </div>
                    <button
                      onClick={() => onStartCircuit(circuit.id)}
                      className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-sm rounded-lg transition-colors whitespace-nowrap"
                    >
                      <Repeat className="w-4 h-4" />
                      <span>{t('circuits.startCircuit')}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </main>
      )}
    </div>
  );
}
