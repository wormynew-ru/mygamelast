/**
 * App - Root component with screen navigation.
 */

import { useState, useEffect, useRef } from 'react';
import { MainMenu } from './ui/MainMenu';
import { BattleScreen } from './ui/BattleScreen';
import { CalibrationSandbox } from './ui/CalibrationSandbox';
import { WorkoutSession } from './session/WorkoutSession';
import { SquatDetector } from './vision/exercises/SquatDetector';
import { useGameStore } from './game/store';
import { createMonster, MONSTERS } from './game/data/monsters';

type Screen = 'MENU' | 'BATTLE' | 'CALIBRATION' | 'SETTINGS';

function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('MENU');
  const [workoutSession, setWorkoutSession] = useState<WorkoutSession | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const startCombat = useGameStore((state) => state.startCombat);
  const endCombat = useGameStore((state) => state.endCombat);

  // Initialize workout session when entering battle
  useEffect(() => {
    if (currentScreen === 'BATTLE' && videoRef.current && canvasRef.current) {
      // Create exercise detector (for now, only squats)
      const detector = new SquatDetector();

      // Create workout session
      const session = new WorkoutSession({
        videoElement: videoRef.current,
        canvasElement: canvasRef.current,
        exerciseDetector: detector,
        exerciseDamageMultiplier: 1.0, // Base damage multiplier for squats
        enableSound: true,
      });

      setWorkoutSession(session);

      // Start session
      session.start().catch((error) => {
        console.error('Failed to start workout session:', error);
        alert(`Failed to start camera: ${error.message}`);
        setCurrentScreen('MENU');
      });

      // Cleanup on unmount
      return () => {
        session.stop();
        setWorkoutSession(null);
      };
    }

    return undefined;
  }, [currentScreen]);

  const handleStartBattle = () => {
    // Load first monster (BURGER)
    const monster = createMonster(MONSTERS.BURGER);
    startCombat(monster);

    setCurrentScreen('BATTLE');
  };

  const handleExitBattle = () => {
    endCombat();
    setCurrentScreen('MENU');
  };

  const handleCalibration = () => {
    setCurrentScreen('CALIBRATION');
  };

  const handleSettings = () => {
    setCurrentScreen('SETTINGS');
    // TODO: Implement settings screen
    alert('Settings screen not implemented yet!');
    setCurrentScreen('MENU');
  };

  const handleExitCalibration = () => {
    setCurrentScreen('MENU');
  };

  return (
    <>
      {/* Hidden video/canvas elements for battle screen */}
      {currentScreen === 'BATTLE' && (
        <>
          <video ref={videoRef} style={{ display: 'none' }} />
          <canvas ref={canvasRef} style={{ display: 'none' }} />
        </>
      )}

      {/* Screen routing */}
      {currentScreen === 'MENU' && (
        <MainMenu
          onStartBattle={handleStartBattle}
          onCalibration={handleCalibration}
          onSettings={handleSettings}
        />
      )}

      {currentScreen === 'BATTLE' && workoutSession && (
        <BattleScreen
          session={workoutSession}
          onExit={handleExitBattle}
        />
      )}

      {currentScreen === 'CALIBRATION' && (
        <div className="relative">
          <button
            onClick={handleExitCalibration}
            className="absolute top-4 left-4 z-50 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg transition"
          >
            ← Back to Menu
          </button>
          <CalibrationSandbox />
        </div>
      )}
    </>
  );
}

export default App;
