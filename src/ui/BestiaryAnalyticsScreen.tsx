/**
 * BestiaryAnalyticsScreen - 7-day fitness analytics (kcal, reps, plank hold, streaks)
 * and Monster Bestiary tracking encounters, defeats, best clear time, and discovered weaknesses.
 */

import { ArrowLeft, BookOpen, Flame, BarChart3, Shield, Swords } from 'lucide-react';
import { MONSTERS } from '../game/data/monsters';
import { EXERCISES, type ExerciseId } from '../game/data/exercises';
import { getRecentDateKeys } from '../game/data/dailyQuests';
import { useGameStore } from '../game/store';
import { useTranslation } from '../i18n/useTranslation';
import {
  ARCHETYPE_KEYS,
  EXERCISE_NAME_KEYS,
  MONSTER_DESC_KEYS,
  MONSTER_NAME_KEYS,
} from './gameKeys';

interface BestiaryAnalyticsScreenProps {
  onBack: () => void;
}

export function BestiaryAnalyticsScreen({ onBack }: BestiaryAnalyticsScreenProps) {
  const { t } = useTranslation();
  const workoutStats = useGameStore((state) => state.workoutStats);
  const exerciseTotals = useGameStore((state) => state.exerciseTotals);
  const dailyHistory = useGameStore((state) => state.dailyHistory);
  const streak = useGameStore((state) => state.streak);
  const bestiary = useGameStore((state) => state.bestiary);
  const endlessStats = useGameStore((state) => state.endlessStats);

  const recentDates = getRecentDateKeys(7);
  const chartDays = recentDates.map((dateKey) => {
    const entry = dailyHistory[dateKey];
    const volume = (entry?.reps ?? 0) + (entry?.holdSeconds ?? 0);
    return {
      dateKey,
      shortDate: dateKey.slice(5),
      reps: entry?.reps ?? 0,
      holdSeconds: entry?.holdSeconds ?? 0,
      wins: entry?.battlesWon ?? 0,
      kcal: entry?.estimatedKcal ?? 0,
      volume,
    };
  });

  const maxVolume = Math.max(10, ...chartDays.map((d) => d.volume));
  const total7DayKcal =
    Math.round(chartDays.reduce((sum, d) => sum + d.kcal, 0) * 10) / 10;
  const total7DayWins = chartDays.reduce((sum, d) => sum + d.wins, 0);

  const monsterTemplates = Object.values(MONSTERS);
  const exerciseList = Object.values(EXERCISES);

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

          <div className="w-24" aria-hidden="true" />
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-8 space-y-8">
        {/* 7-Day Activity & Fitness Metrics */}
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-emerald-400" />
              <h2 className="text-lg font-semibold text-white">{t('bestiary.analyticsTitle')}</h2>
            </div>

            <div className="flex items-center gap-5 text-xs font-numeric text-slate-300">
              <span className="inline-flex items-center gap-1.5">
                <Flame className="w-4 h-4 text-amber-400" />
                <span>
                  {t('bestiary.kcalApprox')}: {total7DayKcal} {t('battle.kcalUnit')}
                </span>
              </span>
              <span>
                {t('bestiary.activeWins')}: {total7DayWins}
              </span>
              <span>
                {t('quests.streakLabel')}: {streak.current} {t('quests.daysUnit')} ({t('quests.streakBest')}:{' '}
                {streak.best})
              </span>
            </div>
          </div>

          {/* 7-Day Bar Chart */}
          <div className="grid grid-cols-7 gap-3 items-end h-36 pt-4 border-b border-slate-800 pb-4">
            {chartDays.map((day) => {
              const heightPct = day.volume > 0 ? Math.max(10, Math.round((day.volume / maxVolume) * 100)) : 4;
              return (
                <div key={day.dateKey} className="flex flex-col items-center justify-end h-full gap-1.5">
                  <div className="text-[11px] font-numeric text-slate-400">
                    {day.volume > 0 ? day.volume : ''}
                  </div>
                  <div className="w-full max-w-[38px] flex-1 flex items-end justify-center">
                    <div
                      className={`w-full rounded-t transition-[height] duration-200 ${
                        day.volume > 0 ? 'bg-emerald-500' : 'bg-slate-800'
                      }`}
                      style={{ height: `${heightPct}%` }}
                      title={`${day.dateKey}: ${day.reps} reps, ${day.holdSeconds}s plank`}
                    />
                  </div>
                  <div className="text-[11px] font-numeric text-slate-400">{day.shortDate}</div>
                </div>
              );
            })}
          </div>

          {/* Exercise Breakdown + Lifetime Totals */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2.5">
              <h3 className="text-xs font-semibold text-slate-400">{t('bestiary.exerciseBreakdown')}</h3>
              <div className="grid grid-cols-2 gap-3">
                {exerciseList.map((ex) => {
                  const totals = exerciseTotals[ex.id as ExerciseId] ?? { reps: 0, holdSeconds: 0 };
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

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 items-center">
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
            </div>
          </div>
        </section>

        {/* Monster Bestiary */}
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-amber-400" />
              <h2 className="text-lg font-semibold text-white">{t('bestiary.monstersTitle')}</h2>
            </div>
            <span className="font-numeric text-xs text-slate-400">
              {Object.keys(bestiary).length} / {monsterTemplates.length}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {monsterTemplates.map((monster) => {
              const entry = bestiary[monster.id];
              const isDiscovered = Boolean(entry && entry.encounters > 0);
              const name = MONSTER_NAME_KEYS[monster.id]
                ? t(MONSTER_NAME_KEYS[monster.id])
                : monster.name;
              const desc = MONSTER_DESC_KEYS[monster.id]
                ? t(MONSTER_DESC_KEYS[monster.id])
                : monster.description;

              return (
                <div
                  key={monster.id}
                  className={`rounded-xl border p-5 space-y-3 ${
                    isDiscovered
                      ? 'bg-slate-900 border-slate-800'
                      : 'bg-slate-900/40 border-slate-800/60 opacity-75'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className="text-4xl shrink-0" aria-hidden="true">
                      {monster.sprite}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <h3 className="text-base font-bold text-white truncate">{name}</h3>
                        <span className="text-xs font-medium text-amber-400 shrink-0">
                          {t(ARCHETYPE_KEYS[monster.archetype])}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">{desc}</p>
                    </div>
                  </div>

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

                  <div className="text-xs pt-1">
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
