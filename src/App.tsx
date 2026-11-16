/**
 * App - Root component with screen navigation.
 * Connects MainMenu, LevelSelectScreen, InventoryScreen, BattleScreen,
 * CalibrationSandbox, SettingsScreen, and OfflineIndicator.
 */

import { useState, useEffect } from 'react';
import { MainMenu } from './ui/MainMenu';
import { LevelSelectScreen } from './ui/LevelSelectScreen';
import { InventoryScreen } from './ui/InventoryScreen';
import { BattleScreen } from './ui/BattleScreen';
import { CalibrationSandbox } from './ui/CalibrationSandbox';
import { SettingsScreen } from './ui/SettingsScreen';
import { OfflineIndicator } from './ui/PWAInstallButton';
import { useGameStore } from './game/store';
import { createMonster, MONSTERS } from './game/data/monsters';
import { getLevelById } from './game/data/levels';
import type { ExerciseId } from './game/data/exercises';
import { setCurrentLanguage } from './i18n';

type Screen = 'MENU' | 'CAMPAIGN' | 'INVENTORY' | 'BATTLE' | 'CALIBRATION' | 'SETTINGS';

interface ActiveEncounter {
  levelId: string;
  exerciseId: ExerciseId;
}

function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('MENU');
  const [activeEncounter, setActiveEncounter] = useState<ActiveEncounter>({
    levelId: 'LEVEL_1',
    exerciseId: 'JUMPING_JACK',
  });

  const language = useGameStore((state) => state.settings.language);
  const startCombat = useGameStore((state) => state.startCombat);
  const endCombat = useGameStore((state) => state.endCombat);
  const setCurrentLevel = useGameStore((state) => state.setCurrentLevel);

  // Sync i18n language with persisted store on mount and updates
  useEffect(() => {
    setCurrentLanguage(language);
  }, [language]);

  const handleStartEncounter = (levelId: string, exerciseId: ExerciseId) => {
    const level = getLevelById(levelId);
    const monsterTemplate = level ? MONSTERS[level.monsterId] : MONSTERS.BURGER;
    const monster = createMonster(monsterTemplate);

    setCurrentLevel(levelId);
    startCombat(monster);
    setActiveEncounter({ levelId, exerciseId });
    setCurrentScreen('BATTLE');
  };

  const handleQuickBattle = () => {
    const unlocked = useGameStore.getState().unlockedLevels;
    const completed = useGameStore.getState().completedLevels;
    const targetLevelId =
      unlocked.find((id) => !completed.includes(id)) ?? unlocked[unlocked.length - 1] ?? 'LEVEL_1';
    const level = getLevelById(targetLevelId);
    handleStartEncounter(targetLevelId, level?.recommendedExercise ?? 'SQUAT');
  };

  const handleExitBattle = () => {
    endCombat();
    setCurrentScreen('MENU');
  };

  return (
    <>
      {currentScreen === 'MENU' && (
        <MainMenu
          onOpenCampaign={() => setCurrentScreen('CAMPAIGN')}
          onQuickBattle={handleQuickBattle}
          onInventory={() => setCurrentScreen('INVENTORY')}
          onCalibration={() => setCurrentScreen('CALIBRATION')}
          onSettings={() => setCurrentScreen('SETTINGS')}
        />
      )}

      {currentScreen === 'CAMPAIGN' && (
        <LevelSelectScreen
          onBack={() => setCurrentScreen('MENU')}
          onStartEncounter={handleStartEncounter}
        />
      )}

      {currentScreen === 'INVENTORY' && (
        <InventoryScreen onBack={() => setCurrentScreen('MENU')} />
      )}

      {currentScreen === 'BATTLE' && (
        <BattleScreen
          levelId={activeEncounter.levelId}
          exerciseId={activeEncounter.exerciseId}
          onExit={handleExitBattle}
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

export default App;
