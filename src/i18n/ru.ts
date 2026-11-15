/**
 * Russian translations (primary language).
 * All user-facing strings in Russian.
 */

export const ru = {
  // Main Menu
  'menu.title': 'JUNK SLAYER',
  'menu.subtitle': 'Побеждай фастфуд с помощью упражнений!',
  'menu.startBattle': 'Начать Бой',
  'menu.calibration': 'Калибровка',
  'menu.settings': 'Настройки',
  'menu.version': 'v0.1.0 - MVP Build',

  // Player Stats
  'stats.title': 'Статистика Игрока',
  'stats.level': 'Уровень',
  'stats.hp': 'HP',
  'stats.attack': 'Атака',
  'stats.defense': 'Защита',
  'stats.xp': 'XP',

  // Battle Screen
  'battle.player': 'Игрок',
  'battle.reps': 'ПОВТОРЕНИЙ',
  'battle.phase': 'Фаза',
  'battle.fps': 'FPS',
  'battle.pause': 'Пауза',
  'battle.resume': 'Продолжить',
  'battle.surrender': 'Сдаться',
  'battle.error': 'Ошибка',
  'battle.noEnemy': 'Враг не загружен!',

  // Battle End
  'battle.victory': 'ПОБЕДА!',
  'battle.defeat': 'ПОРАЖЕНИЕ',
  'battle.victoryMessage': 'Вы победили монстра! Так держать!',
  'battle.defeatMessage': 'Вы проиграли. Попробуйте снова!',
  'battle.nextFight': 'Следующий Бой',
  'battle.tryAgain': 'Попробовать Снова',
  'battle.exit': 'Выход',

  // Exercise Phases
  'phase.IDLE': 'ОЖИДАНИЕ',
  'phase.DOWN': 'ВНИЗ',
  'phase.UP': 'ВВЕРХ',
  'phase.TRANSITION': 'ПЕРЕХОД',

  // Monsters
  'monster.BURGER.name': 'Жирный Бургер',
  'monster.BURGER.description': 'Разумный бургер, капающий жиром.',
  'monster.PIZZA.name': 'Сырная Пицца',
  'monster.PIZZA.description': 'Пицца с расплавленным сыром и характером.',
  'monster.SODA.name': 'Газировка',
  'monster.SODA.description': 'Газированная банка, готовая взорваться.',
  'monster.DONUT.name': 'Сахарный Пончик',
  'monster.DONUT.description': 'Липкий пончик, покрытый посыпкой.',
  'monster.BOSS_KING_BURGER.name': 'Король Бургер',
  'monster.BOSS_KING_BURGER.description': 'Правитель всего фастфуда. Берегись его ярости!',

  // Exercises
  'exercise.SQUAT.name': 'Приседания',
  'exercise.SQUAT.description': 'Классические приседания. Спина прямая, колени не выходят за носки.',
  'exercise.PUSH_UP.name': 'Отжимания',
  'exercise.PUSH_UP.description': 'Отжимания от пола. Тело прямое, локти до 90°.',
  'exercise.PLANK.name': 'Планка',
  'exercise.PLANK.description': 'Удержание планки. Тело прямое, локти под плечами.',
  'exercise.JUMPING_JACK.name': 'Jumping Jacks',
  'exercise.JUMPING_JACK.description': 'Прыжки с разведением рук и ног.',

  // Items
  'item.PROTEIN_SHAKE.name': 'Протеиновый Коктейль',
  'item.PROTEIN_SHAKE.description': 'Восстанавливает 30 HP.',
  'item.RUNNING_SHOES.name': 'Беговые Кроссовки',
  'item.RUNNING_SHOES.description': 'Увеличивает защиту на 2.',
  'item.ENERGY_BAR.name': 'Энергетический Батончик',
  'item.ENERGY_BAR.description': 'Увеличивает атаку на 3.',
  'item.YOGA_MAT.name': 'Коврик для Йоги',
  'item.YOGA_MAT.description': 'Увеличивает защиту на 3.',
  'item.DUMBBELL.name': 'Гантель',
  'item.DUMBBELL.description': 'Увеличивает атаку на 5.',

  // Calibration
  'calibration.title': 'Калибровка',
  'calibration.instructions': 'Встаньте перед камерой боком. Выполните несколько приседаний для проверки.',
  'calibration.start': 'Начать',
  'calibration.stop': 'Стоп',
  'calibration.visibility': 'Видимость',
  'calibration.visible': 'Видно',
  'calibration.lowVisibility': 'Плохая Видимость',
  'calibration.notVisible': 'Не Видно',

  // Settings
  'settings.title': 'Настройки',
  'settings.language': 'Язык',
  'settings.audio': 'Звук',
  'settings.audioOn': 'Включён',
  'settings.audioOff': 'Выключен',
  'settings.cameraTest': 'Тест Камеры',
  'settings.resetProgress': 'Сбросить Прогресс',
  'settings.resetConfirm': 'Вы уверены? Весь прогресс будет удалён!',
  'settings.back': 'Назад',

  // Errors
  'error.cameraPermission': 'Нет доступа к камере. Разрешите доступ в настройках браузера.',
  'error.cameraNotFound': 'Камера не найдена.',
  'error.mediapipeLoad': 'Ошибка загрузки MediaPipe модели.',
  'error.unknown': 'Произошла неизвестная ошибка.',

  // Hints
  'hint.wrongAngle': 'Повернитесь боком к камере',
  'hint.tooFar': 'Отойдите дальше от камеры',
  'hint.tooClose': 'Подойдите ближе к камере',
  'hint.lowLight': 'Недостаточно света',
  'hint.adjustCamera': 'Настройте положение камеры',
} as const;

export type TranslationKey = keyof typeof ru;
