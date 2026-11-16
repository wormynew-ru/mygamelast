/**
 * BestiaryAnalyticsScreen - Time-range workout analytics (Today, 7 Days, Month, Year, All Time)
 * across exercises, calories, tonnage, wins, circuits, and workout duration, plus Monster Bestiary.
 */

import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Clock,
  Flame,
  BarChart3,
  Heart,
  MapPin,
  Shield,
  Sparkles,
  Swords,
} from 'lucide-react';
import { CIRCUITS } from '../game/data/circuits';
import { LEVELS } from '../game/data/levels';
import { MONSTERS, type MonsterTemplate } from '../game/data/monsters';
import { EXERCISES, type ExerciseId } from '../game/data/exercises';
import { MONSTER_TROPHIES, getTrophyForArchetype } from '../game/data/sanctuary';
import {
  buildPeriodAnalytics,
  type AnalyticsChartMetric,
  type AnalyticsPeriod,
} from '../game/data/analytics';
import { useGameStore } from '../game/store';
import type { MonsterArchetype } from '../game/types';
import { useTranslation, type TranslationKey } from '../i18n/useTranslation';
import {
  ARCHETYPE_KEYS,
  ARCHETYPE_TRAIT_KEYS,
  CIRCUIT_KEYS,
  EXERCISE_NAME_KEYS,
  MONSTER_DESC_KEYS,
  MONSTER_NAME_KEYS,
  MONSTER_TROPHY_KEYS,
} from './gameKeys';
import { useVoiceCommandHandler } from './VoiceControl';

interface BestiaryAnalyticsScreenProps {
  onBack: () => void;
}

const PERIOD_OPTIONS: { id: AnalyticsPeriod; labelKey: TranslationKey }[] = [
  { id: 'TODAY', labelKey: 'bestiary.period.TODAY' },
  { id: 'WEEK', labelKey: 'bestiary.period.WEEK' },
  { id: 'MONTH', labelKey: 'bestiary.period.MONTH' },
  { id: 'YEAR', labelKey: 'bestiary.period.YEAR' },
  { id: 'ALL', labelKey: 'bestiary.period.ALL' },
];

const METRIC_OPTIONS: { id: AnalyticsChartMetric; labelKey: TranslationKey }[] = [
  { id: 'VOLUME', labelKey: 'bestiary.metric.VOLUME' },
  { id: 'KCAL', labelKey: 'bestiary.metric.KCAL' },
  { id: 'TONNAGE', labelKey: 'bestiary.metric.TONNAGE' },
];

type MonsterCategory = 'ALL' | 'REGULAR' | 'BOSS' | 'WEED';

const MONSTER_CATEGORY_OPTIONS: { id: MonsterCategory; labelKey: TranslationKey }[] = [
  { id: 'ALL', labelKey: 'bestiary.filter.ALL' },
  { id: 'REGULAR', labelKey: 'bestiary.filter.REGULAR' },
  { id: 'BOSS', labelKey: 'bestiary.filter.BOSS' },
  { id: 'WEED', labelKey: 'bestiary.filter.WEED' },
];

const ARCHETYPE_BADGE_CLASS: Record<MonsterArchetype, string> = {
  FAST: 'text-sky-400',
  ARMORED: 'text-amber-400',
  TOXIC: 'text-violet-400',
  BOSS: 'text-rose-400',
};

function getMonsterCategory(monster: MonsterTemplate): Exclude<MonsterCategory, 'ALL'> {
  if (monster.isBoss) return 'BOSS';
  if (monster.id.startsWith('WEED_')) return 'WEED';
  return 'REGULAR';
}

function formatDurationCompact(totalSec: number): string {
  if (totalSec <= 0) return '0s';
  if (totalSec < 60) return `${totalSec}s`;
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  if (mins < 60) return `${mins}m ${String(secs).padStart(2, '0')}s`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `${hours}h ${String(remMins).padStart(2, '0')}m`;
}

export function BestiaryAnalyticsScreen({ onBack }: BestiaryAnalyticsScreenProps) {
  const { t } = useTranslation();
  const [period, setPeriod] = useState<AnalyticsPeriod>('WEEK');
  const [chartMetric, setChartMetric] = useState<AnalyticsChartMetric>('VOLUME');
  const [monsterCategory, setMonsterCategory] = useState<MonsterCategory>('ALL');

  useVoiceCommandHandler((cmd) => {
    if (cmd.type === 'ANALYTICS_PERIOD') {
      setPeriod(cmd.period);
      return true;
    }
    if (cmd.type === 'ANALYTICS_METRIC') {
      setChartMetric(cmd.metric);
      return true;
    }
    if (cmd.type === 'EXIT') {
      onBack();
      return true;
    }
    return false;
  });

  const workoutStats = useGameStore((state) => state.workoutStats);
  const exerciseTotals = useGameStore((state) => state.exerciseTotals);
  const dailyHistory = useGameStore((state) => state.dailyHistory);
  const streak = useGameStore((state) => state.streak);
  const bestiary = useGameStore((state) => state.bestiary);
  const endlessStats = useGameStore((state) => state.endlessStats);

  const summary = useMemo(
    () =>
      buildPeriodAnalytics({
        period,
        dailyHistory,
        workoutStats,
        exerciseTotals,
      }),
    [period, dailyHistory, workoutStats, exerciseTotals]
  );

  const monsterTemplates = useMemo(() => Object.values(MONSTERS), []);
  const exerciseList = useMemo(() => Object.values(EXERCISES), []);

  const categoryCounts = useMemo(
    () => ({
      ALL: monsterTemplates.length,
      REGULAR: monsterTemplates.filter((m) => getMonsterCategory(m) === 'REGULAR').length,
      BOSS: monsterTemplates.filter((m) => getMonsterCategory(m) === 'BOSS').length,
      WEED: monsterTemplates.filter((m) => getMonsterCategory(m) === 'WEED').length,
    }),
    [monsterTemplates]
  );

  const filteredMonsters = useMemo(() => {
    if (monsterCategory === 'ALL') return monsterTemplates;
    return monsterTemplates.filter((m) => getMonsterCategory(m) === monsterCategory);
  }, [monsterTemplates, monsterCategory]);

  const discoveredCount = useMemo(
    () => monsterTemplates.filter((m) => (bestiary[m.id]?.encounters ?? 0) > 0).length,
    [monsterTemplates, bestiary]
  );

  const monsterHabitats = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const monster of monsterTemplates) {
      const places: string[] = [];
      if (monster.id.startsWith('WEED_')) {
        places.push(t('bestiary.habitatGarden'));
      } else {
        for (const lvl of LEVELS) {
          if (lvl.monsterId === monster.id) {
            places.push(`${t('bestiary.habitatStage')} ${lvl.order}`);
          }
        }
        places.push(
          monster.isBoss ? t('bestiary.habitatEndlessBoss') : t('bestiary.habitatEndless')
        );
        for (const circuit of CIRCUITS) {
          if (circuit.rooms.some((r) => r.monsterId === monster.id)) {
            places.push(`${t('bestiary.habitatCircuit')}: ${t(CIRCUIT_KEYS[circuit.id].name)}`);
          }
        }
      }
      map[monster.id] = places;
    }
    return map;
  }, [monsterTemplates, t]);

  const getBucketValue = (bucket: (typeof summary.buckets)[number]): number => {
    switch (chartMetric) {
      case 'KCAL':
        return bucket.estimatedKcal;
      case 'TONNAGE':
        return bucket.tonnageKg;
      case 'VOLUME':
      default:
        return bucket.volume;
    }
  };

  const maxBucketValue = Math.max(1, ...summary.buckets.map((b) => getBucketValue(b)));
  const barFillClass =
    chartMetric === 'KCAL'
      ? 'bg-amber-500'
      : chartMetric === 'TONNAGE'
        ? 'bg-sky-400'
        : 'bg-emerald-500';

  const maxTodayExerciseVal = Math.max(
    1,
    ...exerciseList.map((ex) => {
      const item = summary.exerciseBreakdown[ex.id as ExerciseId];
      return ex.trackingType === 'hold' ? item.holdSeconds : item.reps;
    })
  );

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
            {t('bestiary.title')}
          </h1>

          <div className="w-24 hidden sm:block" aria-hidden="true" />
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-8 space-y-8">
        {/* Time-Range Workout Analytics */}
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-emerald-400" />
              <h2 className="text-lg font-semibold text-white">{t('bestiary.analyticsTitle')}</h2>
            </div>

            {/* Period Selector Tabs */}
            <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-lg max-w-full">
              {PERIOD_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setPeriod(opt.id)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                    period === opt.id
                      ? 'bg-emerald-500 text-slate-950'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {t(opt.labelKey)}
                </button>
              ))}
            </div>
          </div>

          {/* 8 Period Summary KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-950 border border-slate-800 rounded-lg p-3.5">
              <div className="inline-flex items-center gap-1 text-xs text-slate-400">
                <Flame className="w-3.5 h-3.5 text-amber-400" />
                <span>{t('bestiary.kcalApprox')}</span>
              </div>
              <div className="font-numeric text-xl font-bold text-amber-400 mt-1">
                ~{summary.estimatedKcal} {t('battle.kcalUnit')}
              </div>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-lg p-3.5">
              <div className="text-xs text-slate-400">{t('stats.totalReps')}</div>
              <div className="font-numeric text-xl font-bold text-white mt-1">
                {summary.totalReps}
              </div>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-lg p-3.5">
              <div className="text-xs text-slate-400">{t('stats.totalHold')}</div>
              <div className="font-numeric text-xl font-bold text-emerald-400 mt-1">
                {summary.totalHoldSeconds}s
              </div>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-lg p-3.5">
              <div className="text-xs text-slate-400">{t('stats.tonnage')}</div>
              <div className="font-numeric text-xl font-bold text-amber-300 mt-1">
                {summary.tonnageKg} {t('loadout.kgUnit')}
              </div>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-lg p-3.5">
              <div className="text-xs text-slate-400">{t('bestiary.activeWins')}</div>
              <div className="font-numeric text-xl font-bold text-white mt-1">
                {summary.battlesWon}
              </div>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-lg p-3.5">
              <div className="text-xs text-slate-400">{t('stats.circuits')}</div>
              <div className="font-numeric text-xl font-bold text-sky-400 mt-1">
                {summary.circuitsCompleted}
              </div>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-lg p-3.5">
              <div className="text-xs text-slate-400">{t('stats.coins')}</div>
              <div className="font-numeric text-xl font-bold text-amber-400 mt-1">
                {summary.coinsEarned}
              </div>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-lg p-3.5">
              <div className="text-xs text-slate-400">{t('bestiary.workoutTime')}</div>
              <div className="font-numeric text-xl font-bold text-slate-200 mt-1">
                {formatDurationCompact(summary.durationSec)}
              </div>
            </div>
          </div>

          {/* Chart Section */}
          <div className="space-y-3 pt-2 border-t border-slate-800">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-4 text-xs font-numeric text-slate-400">
                <span>
                  {t('bestiary.activeDays')}: <strong className="text-white">{summary.activeDays}</strong>
                </span>
                <span>
                  {t('quests.streakLabel')}:{' '}
                  <strong className="text-emerald-400">
                    {streak.current} {t('quests.daysUnit')}
                  </strong>{' '}
                  ({t('quests.streakBest')}: {streak.best})
                </span>
              </div>

              {period !== 'TODAY' && (
                <div className="inline-flex items-center gap-1 p-0.5 bg-slate-950 border border-slate-800 rounded-lg">
                  {METRIC_OPTIONS.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setChartMetric(m.id)}
                      className={`px-2.5 py-1 text-[11px] font-semibold rounded transition-colors ${
                        chartMetric === m.id
                          ? 'bg-slate-800 text-white'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {t(m.labelKey)}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {period === 'TODAY' ? (
              summary.totalReps === 0 && summary.totalHoldSeconds === 0 ? (
                <div className="py-6 text-center text-xs text-slate-500 border-b border-slate-800">
                  {t('bestiary.noActivity')}
                </div>
              ) : (
                <div className="space-y-2.5 py-2 border-b border-slate-800">
                  {exerciseList.map((ex) => {
                    const item = summary.exerciseBreakdown[ex.id as ExerciseId];
                    const val = ex.trackingType === 'hold' ? item.holdSeconds : item.reps;
                    const pct = val > 0 ? Math.max(6, Math.round((val / maxTodayExerciseVal) * 100)) : 0;
                    return (
                      <div key={ex.id} className="flex items-center gap-3 text-xs">
                        <span className="w-36 shrink-0 text-slate-300 truncate">
                          {ex.icon} {t(EXERCISE_NAME_KEYS[ex.id])}
                        </span>
                        <div className="flex-1 h-2.5 bg-slate-950 border border-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 transition-[width] duration-200"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="w-12 text-right font-numeric font-semibold text-white shrink-0">
                          {ex.trackingType === 'hold' ? `${val}s` : val}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )
            ) : (
              <div className="space-y-1.5 border-b border-slate-800 pb-4 pt-3">
                <div
                  className={`flex items-end h-36 ${
                    summary.buckets.length > 20 ? 'gap-1' : 'gap-2 sm:gap-3'
                  }`}
                >
                  {summary.buckets.map((bucket) => {
                    const value = getBucketValue(bucket);
                    const heightPct =
                      value > 0 ? Math.max(10, Math.round((value / maxBucketValue) * 100)) : 4;
                    const showTopVal = summary.buckets.length <= 7 && value > 0;
                    const showDesktopTopVal = summary.buckets.length <= 12 && value > 0;
                    return (
                      <div
                        key={bucket.key}
                        className="flex-1 min-w-0 flex flex-col items-center justify-end h-full gap-1"
                      >
                        {showDesktopTopVal && (
                          <div
                            className={`text-[10px] font-numeric text-slate-400 truncate max-w-full ${
                              showTopVal ? '' : 'hidden sm:block'
                            }`}
                          >
                            {value}
                          </div>
                        )}
                        <div className="w-full max-w-[38px] flex-1 flex items-end justify-center">
                          <div
                            className={`w-full rounded-t transition-[height] duration-200 ${
                              value > 0 ? barFillClass : 'bg-slate-800'
                            }`}
                            style={{ height: `${heightPct}%` }}
                            title={`${bucket.tooltipLabel}: ${bucket.reps} reps, ${bucket.holdSeconds}s hold, ~${bucket.estimatedKcal} kcal, ${bucket.tonnageKg} kg`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* X-Axis Labels */}
                {summary.buckets.length <= 7 ? (
                  <div className="flex gap-2 sm:gap-3">
                    {summary.buckets.map((bucket) => (
                      <div
                        key={`lbl-${bucket.key}`}
                        className="flex-1 min-w-0 text-center text-[10px] font-numeric text-slate-400"
                      >
                        {bucket.label}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-between text-[10px] font-numeric text-slate-400 pt-0.5">
                    {[
                      0,
                      Math.floor((summary.buckets.length - 1) * 0.25),
                      Math.floor((summary.buckets.length - 1) * 0.5),
                      Math.floor((summary.buckets.length - 1) * 0.75),
                      summary.buckets.length - 1,
                    ].map((idx) => (
                      <span key={`tick-${idx}-${summary.buckets[idx]?.key}`}>
                        {summary.buckets[idx]?.label ?? ''}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Exercise Breakdown + Lifetime Records */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2.5">
              <h3 className="text-xs font-semibold text-slate-400">
                {t('bestiary.exerciseBreakdown')} ({t(`bestiary.period.${period}` as TranslationKey)})
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {exerciseList.map((ex) => {
                  const totals = summary.exerciseBreakdown[ex.id as ExerciseId] ?? {
                    reps: 0,
                    holdSeconds: 0,
                  };
                  return (
                    <div
                      key={ex.id}
                      className="bg-slate-950 border border-slate-800 rounded-lg p-3 flex items-center justify-between gap-2"
                    >
                      <span className="text-xs text-slate-300 truncate">
                        {ex.icon} {t(EXERCISE_NAME_KEYS[ex.id])}
                      </span>
                      <span className="font-numeric text-sm font-bold text-white shrink-0">
                        {ex.trackingType === 'hold' ? `${totals.holdSeconds}s` : totals.reps}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2.5">
              <h3 className="text-xs font-semibold text-slate-400">{t('bestiary.recordsTitle')}</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 content-start">
                <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
                  <div className="text-xs text-slate-400">{t('battle.maxComboLabel')}</div>
                  <div className="font-numeric text-xl font-bold text-amber-400 mt-0.5">
                    x{workoutStats.maxCombo ?? 0}
                  </div>
                </div>
                <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
                  <div className="text-xs text-slate-400">{t('stats.bestWave')}</div>
                  <div className="font-numeric text-xl font-bold text-emerald-400 mt-0.5">
                    {endlessStats.bestWave}
                  </div>
                </div>
                <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
                  <div className="text-xs text-slate-400">{t('stats.defeated')}</div>
                  <div className="font-numeric text-xl font-bold text-white mt-0.5">
                    {workoutStats.monstersDefeated}
                  </div>
                </div>
                <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
                  <div className="text-xs text-slate-400">{t('stats.tonnage')}</div>
                  <div className="font-numeric text-xl font-bold text-amber-300 mt-0.5">
                    {workoutStats.totalTonnageKg ?? 0} {t('loadout.kgUnit')}
                  </div>
                </div>
                <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
                  <div className="text-xs text-slate-400">{t('stats.circuits')}</div>
                  <div className="font-numeric text-xl font-bold text-sky-400 mt-0.5">
                    {workoutStats.circuitsCompleted ?? 0}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Monster Bestiary */}
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-amber-400" />
                <h2 className="text-lg font-semibold text-white">{t('bestiary.monstersTitle')}</h2>
              </div>
              <span className="font-numeric text-xs text-slate-400">
                {discoveredCount} / {monsterTemplates.length}
              </span>
            </div>

            {/* Category Filter Tabs */}
            <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-lg max-w-full">
              {MONSTER_CATEGORY_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setMonsterCategory(opt.id)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                    monsterCategory === opt.id
                      ? 'bg-amber-500 text-slate-950'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {t(opt.labelKey)} ({categoryCounts[opt.id]})
                </button>
              ))}
            </div>
          </div>

          <p className="text-xs text-slate-400 bg-slate-900/70 border border-slate-800 rounded-lg px-4 py-2.5">
            {t('bestiary.endlessScalingNote')}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredMonsters.map((monster) => {
              const entry = bestiary[monster.id];
              const isDiscovered = Boolean(entry && entry.encounters > 0);
              const name = MONSTER_NAME_KEYS[monster.id]
                ? t(MONSTER_NAME_KEYS[monster.id])
                : monster.name;
              const desc = MONSTER_DESC_KEYS[monster.id]
                ? t(MONSTER_DESC_KEYS[monster.id])
                : monster.description;

              const secUnit = t('bestiary.secUnit');
              const hitsUnit = t('bestiary.hitsUnit');
              const speedDisplay = monster.isBoss
                ? `6.0→5.0→4.0${secUnit}`
                : `${((monster.attackIntervalMs ?? 7000) / 1000).toFixed(1)}${secUnit}`;

              const shieldCount = monster.maxShieldHits ?? monster.shieldHits ?? 0;
              const shieldDisplay = monster.isBoss
                ? t('bestiary.bossPhaseShield')
                : shieldCount > 0
                  ? `${shieldCount} ${hitsUnit}`
                  : t('bestiary.noShield');

              const habitats = monsterHabitats[monster.id] ?? [];

              return (
                <div
                  key={monster.id}
                  className={`rounded-xl border p-5 space-y-3.5 ${
                    isDiscovered
                      ? 'bg-slate-900 border-slate-800'
                      : 'bg-slate-900/50 border-slate-800/70'
                  }`}
                >
                  {/* Header */}
                  <div className="flex items-start gap-4">
                    <div className="text-4xl shrink-0" aria-hidden="true">
                      {monster.sprite}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <h3 className="text-base font-bold text-white truncate">{name}</h3>
                        <span
                          className={`text-xs font-semibold shrink-0 ${ARCHETYPE_BADGE_CLASS[monster.archetype]}`}
                        >
                          {t(ARCHETYPE_KEYS[monster.archetype])}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">{desc}</p>
                    </div>
                  </div>

                  {/* Base Combat Stats Grid */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2">
                      <div className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                        <Heart className="w-3 h-3 text-rose-400" />
                        <span>{t('bestiary.statHp')}</span>
                      </div>
                      <div className="font-numeric text-sm font-bold text-white mt-0.5">
                        {monster.maxHp}
                      </div>
                    </div>

                    <div className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2">
                      <div className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                        <Swords className="w-3 h-3 text-amber-400" />
                        <span>{t('bestiary.statAtk')}</span>
                      </div>
                      <div className="font-numeric text-sm font-bold text-amber-300 mt-0.5">
                        {monster.attack}
                      </div>
                    </div>

                    <div className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2">
                      <div className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                        <Shield className="w-3 h-3 text-sky-400" />
                        <span>{t('bestiary.statDef')}</span>
                      </div>
                      <div className="font-numeric text-sm font-bold text-sky-300 mt-0.5">
                        {monster.defense}
                      </div>
                    </div>

                    <div className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2">
                      <div className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>{t('bestiary.statInterval')}</span>
                      </div>
                      <div className="font-numeric text-xs font-bold text-slate-200 mt-0.5">
                        {speedDisplay}
                      </div>
                    </div>

                    <div className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2">
                      <div className="text-[11px] text-slate-400">{t('bestiary.statShield')}</div>
                      <div
                        className={`font-numeric text-xs font-bold mt-0.5 ${
                          shieldCount > 0 || monster.isBoss ? 'text-amber-300' : 'text-slate-500'
                        }`}
                      >
                        {shieldDisplay}
                      </div>
                    </div>

                    <div className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2">
                      <div className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                        <Sparkles className="w-3 h-3 text-emerald-400" />
                        <span>{t('bestiary.statReward')}</span>
                      </div>
                      <div className="font-numeric text-xs font-bold text-emerald-300 mt-0.5">
                        +{monster.xpReward} XP · +{monster.coinReward}🪙
                      </div>
                    </div>
                  </div>

                  {/* Archetype Trait & Boss Phase Thresholds */}
                  <div className="bg-slate-950/80 border border-slate-800/80 rounded-lg px-3 py-2 space-y-1 text-xs">
                    <p className="text-slate-300 leading-relaxed">
                      {t(ARCHETYPE_TRAIT_KEYS[monster.archetype])}
                    </p>
                    {monster.phaseThresholds && monster.phaseThresholds.length > 0 && (
                      <div className="font-numeric text-[11px] text-rose-300 font-medium">
                        {t('bestiary.bossPhases')}:{' '}
                        {monster.phaseThresholds.map((pct) => `${Math.round(pct * 100)}%`).join(' / ')}{' '}
                        HP
                      </div>
                    )}
                  </div>

                  {/* Habitats & Trophy Drop */}
                  <div className="space-y-1 text-[11px] text-slate-400">
                    <div className="flex items-start gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                      <span>
                        <strong className="text-slate-300 font-medium">
                          {t('bestiary.habitatsLabel')}:
                        </strong>{' '}
                        {habitats.join(' · ')}
                      </span>
                    </div>
                    {(() => {
                      const trophyId = getTrophyForArchetype(monster.archetype);
                      const trophyDef = MONSTER_TROPHIES[trophyId];
                      return (
                        <div className="text-amber-300/90 font-medium">
                          {t('bestiary.trophyDropLabel')}: {trophyDef.icon}{' '}
                          {t(MONSTER_TROPHY_KEYS[trophyId].name)}
                          {monster.isBoss ? ' ×2' : ' ×1'}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Personal Encounters & Matchups */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-numeric text-slate-300 pt-2 border-t border-slate-800">
                    <span>
                      {t('bestiary.encounters')}: {entry?.encounters ?? 0}
                    </span>
                    <span>
                      {t('bestiary.defeats')}: {entry?.defeats ?? 0}
                    </span>
                    {entry?.fastestVictorySec != null && (
                      <span>
                        {t('bestiary.bestTime')}: {entry.fastestVictorySec}s
                      </span>
                    )}
                  </div>

                  <div className="text-xs pt-0.5">
                    {entry?.weaknessDiscovered ? (
                      <div className="flex flex-wrap items-center gap-4">
                        <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
                          <Swords className="w-3.5 h-3.5" />
                          <span>
                            {t('levels.weakTo')}: {t(EXERCISE_NAME_KEYS[monster.weakTo])}
                          </span>
                        </span>
                        <span className="inline-flex items-center gap-1 text-slate-400">
                          <Shield className="w-3.5 h-3.5" />
                          <span>
                            {t('levels.resistantTo')}: {t(EXERCISE_NAME_KEYS[monster.resistantTo])}
                          </span>
                        </span>
                      </div>
                    ) : (
                      <span className="text-slate-500">{t('bestiary.unknownWeakness')}</span>
                    )}
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
