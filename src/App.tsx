/**
 * App - Root component with screen navigation.
 * Connects MainMenu, LevelSelectScreen (Campaign, Endless Arena, Circuits),
 * InventoryScreen (+ Shop), BestiaryAnalyticsScreen, BattleScreen, CalibrationSandbox,
 * SettingsScreen, and OfflineIndicator.
 */

import { useState, useEffect, useCallback } from 'react';
import { MainMenu } from './ui/MainMenu';
import { LevelSelectScreen } from './ui/LevelSelectScreen';
import { InventoryScreen } from './ui/InventoryScreen';
import { BestiaryAnalyticsScreen } from './ui/BestiaryAnalyticsScreen';
import { BattleScreen } from './ui/BattleScreen';
import { CalibrationSandbox } from './ui/CalibrationSandbox';
import { GardenScreen } from './ui/GardenScreen';
import { SettingsScreen } from './ui/SettingsScreen';
import { OfflineIndicator } from './ui/PWAInstallButton';
import { VoiceControlProvider, useVoiceCommandHandler } from './ui/VoiceControl';
import { useGameStore } from './game/store';
import { createEndlessWaveMonster, createMonster, MONSTERS } from './game/data/monsters';
import { getCircuitById, type CircuitId } from './game/data/circuits';
import { getLevelById } from './game/data/levels';
import type { ExerciseId } from './game/data/exercises';
import type { WeedId } from './game/types';
import type { BattleMode } from './session/WorkoutSession';
import { setCurrentLanguage } from './i18n';

type Screen =
  | 'MENU'
  | 'CAMPAIGN'
  | 'GARDEN'
  | 'INVENTORY'
  | 'BESTIARY'
  | 'BATTLE'
  | 'CALIBRATION'
  | 'SETTINGS';

type LevelSelectTab = 'CAMPAIGN' | 'ENDLESS' | 'CIRCUIT';

interface ActiveEncounter {
  levelId?: string;
  exerciseId: ExerciseId;
  mode: BattleMode;
  wave: number;
  circuitId?: CircuitId;
  gardenPlotId?: number;
}

function AppContent() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('MENU');
  const [levelSelectTab, setLevelSelectTab] = useState<LevelSelectTab>('CAMPAIGN');
  const [activeEncounter, setActiveEncounter] = useState<ActiveEncounter>({
    levelId: 'LEVEL_1',
    exerciseId: 'JUMPING_JACK',
    mode: 'CAMPAIGN',
    wave: 1,
  });

  const language = useGameStore((state) => state.settings.language);
  const startCombat = useGameStore((state) => state.startCombat);
  const endCombat = useGameStore((state) => state.endCombat);
  const setCurrentLevel = useGameStore((state) => state.setCurrentLevel);
  const setLoadout = useGameStore((state) => state.setLoadout);

  // Sync i18n language with persisted store on mount and updates
  useEffect(() => {
    setCurrentLanguage(language);
  }, [language]);

  const handleStartEncounter = useCallback(
    (levelId: string, exerciseId: ExerciseId) => {
      const level = getLevelById(levelId);
      const monsterTemplate = level ? MONSTERS[level.monsterId] : MONSTERS.BURGER;
      const monster = createMonster(monsterTemplate);

      setCurrentLevel(levelId);
      startCombat(monster);
      setActiveEncounter({ levelId, exerciseId, mode: 'CAMPAIGN', wave: 1 });
      setCurrentScreen('BATTLE');
    },
    [setCurrentLevel, startCombat]
  );

  const handleStartEndless = useCallback(
    (exerciseId: ExerciseId) => {
      const wave1Enemy = createEndlessWaveMonster(1);
      setCurrentLevel(null);
      startCombat(wave1Enemy);
      setActiveEncounter({ exerciseId, mode: 'ENDLESS', wave: 1 });
      setCurrentScreen('BATTLE');
    },
    [setCurrentLevel, startCombat]
  );

  const handleStartCircuit = useCallback(
    (circuitId: CircuitId) => {
      const circuit = getCircuitById(circuitId);
      if (!circuit || circuit.rooms.length === 0) return;
      const firstRoom = circuit.rooms[0];
      const monsterTemplate = MONSTERS[firstRoom.monsterId] ?? MONSTERS.BURGER;
      const monster = createMonster(monsterTemplate);

      setCurrentLevel(null);
      startCombat(monster);
      setActiveEncounter({
        exerciseId: firstRoom.exerciseId,
        mode: 'CIRCUIT',
        wave: 1,
        circuitId,
      });
      setCurrentScreen('BATTLE');
    },
    [setCurrentLevel, startCombat]
  );

  const handleStartWeedBattle = useCallback(
    (plotId: number, weedId: WeedId, exerciseId: ExerciseId) => {
      const weedTemplate = MONSTERS[weedId] ?? MONSTERS.WEED_DANDELION;
      const monster = createMonster(weedTemplate);

      setCurrentLevel(null);
      startCombat(monster);
      setActiveEncounter({
        exerciseId,
        mode: 'WEED',
        wave: 1,
        gardenPlotId: plotId,
      });
      setCurrentScreen('BATTLE');
    },
    [setCurrentLevel, startCombat]
  );

  const handleQuickBattle = useCallback(() => {
    const unlocked = useGameStore.getState().unlockedLevels;
    const completed = useGameStore.getState().completedLevels;
    const targetLevelId =
      unlocked.find((id) => !completed.includes(id)) ?? unlocked[unlocked.length - 1] ?? 'LEVEL_1';
    const level = getLevelById(targetLevelId);
    handleStartEncounter(targetLevelId, level?.recommendedExercise ?? 'SQUAT');
  }, [handleStartEncounter]);

  const handleExitBattle = useCallback(() => {
    endCombat();
    setCurrentScreen('MENU');
  }, [endCombat]);

  const handleBackToGarden = useCallback(() => {
    endCombat();
    setCurrentScreen('GARDEN');
  }, [endCombat]);

  useVoiceCommandHandler((cmd) => {
    switch (cmd.type) {
      case 'START_FIGHT':
        if (currentScreen === 'MENU') {
          handleQuickBattle();
          return true;
        }
        return false;
      case 'NAV_CAMPAIGN':
        setLevelSelectTab('CAMPAIGN');
        setCurrentScreen('CAMPAIGN');
        return true;
      case 'NAV_ENDLESS':
        setLevelSelectTab('ENDLESS');
        setCurrentScreen('CAMPAIGN');
        return true;
      case 'NAV_CIRCUIT':
        setLevelSelectTab('CIRCUIT');
        setCurrentScreen('CAMPAIGN');
        return true;
      case 'NAV_INVENTORY':
        setCurrentScreen('INVENTORY');
        return true;
      case 'NAV_BESTIARY':
        setCurrentScreen('BESTIARY');
        return true;
      case 'NAV_GARDEN':
        setCurrentScreen('GARDEN');
        return true;
      case 'NAV_CALIBRATION':
        setCurrentScreen('CALIBRATION');
        return true;
      case 'NAV_SETTINGS':
        setCurrentScreen('SETTINGS');
        return true;
      case 'SET_LOADOUT':
        if (cmd.weightKg === 0) {
          setLoadout({ mode: 'BODYWEIGHT', weightKg: 0 });
        } else {
          setLoadout({
            mode: 'DUMBBELLS',
            weightKg: cmd.weightKg ?? undefined,
          });
        }
        return true;
      case 'START_CIRCUIT':
        handleStartCircuit(cmd.circuitId);
        return true;
      case 'EXIT':
        if (currentScreen !== 'MENU') {
          setCurrentScreen('MENU');
          return true;
        }
        return false;
      default:
        return false;
    }
  });

  return (
    <>
      {currentScreen === 'MENU' && (
        <MainMenu
          onOpenCampaign={() => {
            setLevelSelectTab('CAMPAIGN');
            setCurrentScreen('CAMPAIGN');
          }}
          onQuickBattle={handleQuickBattle}
          onGarden={() => setCurrentScreen('GARDEN')}
          onInventory={() => setCurrentScreen('INVENTORY')}
          onBestiary={() => setCurrentScreen('BESTIARY')}
          onCalibration={() => setCurrentScreen('CALIBRATION')}
          onSettings={() => setCurrentScreen('SETTINGS')}
        />
      )}

      {currentScreen === 'GARDEN' && (
        <GardenScreen
          onBack={() => setCurrentScreen('MENU')}
          onStartWeedBattle={handleStartWeedBattle}
        />
      )}

      {currentScreen === 'CAMPAIGN' && (
        <LevelSelectScreen
          initialTab={levelSelectTab}
          onBack={() => setCurrentScreen('MENU')}
          onStartEncounter={handleStartEncounter}
          onStartEndless={handleStartEndless}
          onStartCircuit={handleStartCircuit}
        />
      )}

      {currentScreen === 'INVENTORY' && (
        <InventoryScreen onBack={() => setCurrentScreen('MENU')} />
      )}

      {currentScreen === 'BESTIARY' && (
        <BestiaryAnalyticsScreen onBack={() => setCurrentScreen('MENU')} />
      )}

      {currentScreen === 'BATTLE' && (
        <BattleScreen
          levelId={activeEncounter.levelId}
          exerciseId={activeEncounter.exerciseId}
          mode={activeEncounter.mode}
          initialWave={activeEncounter.wave}
          circuitId={activeEncounter.circuitId}
          gardenPlotId={activeEncounter.gardenPlotId}
          onExit={handleExitBattle}
          onBackToGarden={handleBackToGarden}
          onStartNextLevel={handleStartEncounter}
        />
      )}

      {currentScreen === 'CALIBRATION' && (
        <CalibrationSandbox onBack={() => setCurrentScreen('MENU')} />
      )}

      {currentScreen === 'SETTINGS' && (
        <SettingsScreen
          onBack={() => setCurrentScreen('MENU')}
          onOpenCalibration={() => setCurrentScreen('CALIBRATION')}
        />
      )}

      <OfflineIndicator />
    </>
  );
}

function App() {
  return (
    <VoiceControlProvider>
      <AppContent />
    </VoiceControlProvider>
  );
}

export default App;
