/**
 * English translations (secondary language).
 * All user-facing strings in English.
 */

export const en = {
  // Main Menu
  'menu.title': 'JUNK SLAYER',
  'menu.subtitle': 'Defeat fast food by exercising!',
  'menu.startBattle': 'Start Battle',
  'menu.calibration': 'Calibration',
  'menu.settings': 'Settings',
  'menu.version': 'v0.1.0 - MVP Build',

  // Player Stats
  'stats.title': 'Player Stats',
  'stats.level': 'Level',
  'stats.hp': 'HP',
  'stats.attack': 'Attack',
  'stats.defense': 'Defense',
  'stats.xp': 'XP',

  // Battle Screen
  'battle.player': 'Player',
  'battle.reps': 'REPS',
  'battle.phase': 'Phase',
  'battle.fps': 'FPS',
  'battle.pause': 'Pause',
  'battle.resume': 'Resume',
  'battle.surrender': 'Surrender',
  'battle.error': 'Error',
  'battle.noEnemy': 'No enemy loaded!',

  // Battle End
  'battle.victory': 'VICTORY!',
  'battle.defeat': 'DEFEAT',
  'battle.victoryMessage': 'You defeated the monster! Keep up the good work!',
  'battle.defeatMessage': 'You were defeated. Try again!',
  'battle.nextFight': 'Next Fight',
  'battle.tryAgain': 'Try Again',
  'battle.exit': 'Exit',

  // Exercise Phases
  'phase.IDLE': 'IDLE',
  'phase.DOWN': 'DOWN',
  'phase.UP': 'UP',
  'phase.TRANSITION': 'TRANSITION',

  // Monsters
  'monster.BURGER.name': 'Greasy Burger',
  'monster.BURGER.description': 'A sentient burger dripping with grease.',
  'monster.PIZZA.name': 'Cheesy Pizza',
  'monster.PIZZA.description': 'A molten cheese pizza with attitude.',
  'monster.SODA.name': 'Fizzy Soda',
  'monster.SODA.description': 'A bubbly soda can ready to explode.',
  'monster.DONUT.name': 'Sugary Donut',
  'monster.DONUT.description': 'A sticky donut covered in sprinkles.',
  'monster.BOSS_KING_BURGER.name': 'King Burger',
  'monster.BOSS_KING_BURGER.description': 'The ruler of all junk food. Beware his rage!',

  // Exercises
  'exercise.SQUAT.name': 'Squats',
  'exercise.SQUAT.description': 'Classic squats. Keep back straight, knees behind toes.',
  'exercise.PUSH_UP.name': 'Push-Ups',
  'exercise.PUSH_UP.description': 'Floor push-ups. Keep body straight, elbows to 90°.',
  'exercise.PLANK.name': 'Plank',
  'exercise.PLANK.description': 'Plank hold. Keep body straight, elbows under shoulders.',
  'exercise.JUMPING_JACK.name': 'Jumping Jacks',
  'exercise.JUMPING_JACK.description': 'Jump with arms and legs spread.',

  // Items
  'item.PROTEIN_SHAKE.name': 'Protein Shake',
  'item.PROTEIN_SHAKE.description': 'Restores 30 HP.',
  'item.RUNNING_SHOES.name': 'Running Shoes',
  'item.RUNNING_SHOES.description': 'Increases defense by 2.',
  'item.ENERGY_BAR.name': 'Energy Bar',
  'item.ENERGY_BAR.description': 'Increases attack by 3.',
  'item.YOGA_MAT.name': 'Yoga Mat',
  'item.YOGA_MAT.description': 'Increases defense by 3.',
  'item.DUMBBELL.name': 'Dumbbell',
  'item.DUMBBELL.description': 'Increases attack by 5.',

  // Calibration
  'calibration.title': 'Calibration',
  'calibration.instructions': 'Stand sideways to the camera. Perform a few squats to test.',
  'calibration.start': 'Start',
  'calibration.stop': 'Stop',
  'calibration.visibility': 'Visibility',
  'calibration.visible': 'Visible',
  'calibration.lowVisibility': 'Low Visibility',
  'calibration.notVisible': 'Not Visible',

  // Settings
  'settings.title': 'Settings',
  'settings.language': 'Language',
  'settings.audio': 'Audio',
  'settings.audioOn': 'On',
  'settings.audioOff': 'Off',
  'settings.cameraTest': 'Camera Test',
  'settings.resetProgress': 'Reset Progress',
  'settings.resetConfirm': 'Are you sure? All progress will be deleted!',
  'settings.back': 'Back',

  // Errors
  'error.cameraPermission': 'No camera access. Allow access in browser settings.',
  'error.cameraNotFound': 'Camera not found.',
  'error.mediapipeLoad': 'Failed to load MediaPipe model.',
  'error.unknown': 'An unknown error occurred.',

  // Hints
  'hint.wrongAngle': 'Turn sideways to the camera',
  'hint.tooFar': 'Move away from the camera',
  'hint.tooClose': 'Move closer to the camera',
  'hint.lowLight': 'Not enough light',
  'hint.adjustCamera': 'Adjust camera position',
} as const;

export type TranslationKey = keyof typeof en;
