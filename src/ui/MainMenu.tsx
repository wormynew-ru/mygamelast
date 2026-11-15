/**
 * MainMenu - Start screen with game navigation.
 */

import { motion } from 'framer-motion';
import { useGameStore } from '../game/store';
import { useTranslation } from '../i18n/useTranslation';

interface MainMenuProps {
  onStartBattle: () => void;
  onCalibration: () => void;
  onSettings: () => void;
}

/**
 * Menu button with hover animation.
 */
function MenuButton({
  label,
  onClick,
  variant = 'primary',
  icon
}: {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
  icon?: string;
}) {
  const bgColor = variant === 'primary'
    ? 'bg-blue-600 hover:bg-blue-700'
    : 'bg-gray-700 hover:bg-gray-600';

  return (
    <motion.button
      onClick={onClick}
      className={`w-full px-8 py-4 ${bgColor} text-white font-bold text-xl rounded-lg transition shadow-lg flex items-center justify-center gap-3`}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      {icon && <span className="text-3xl">{icon}</span>}
      <span>{label}</span>
    </motion.button>
  );
}

/**
 * Player stats display.
 */
function PlayerStatsCard() {
  const player = useGameStore((state) => state.player);
  const { t } = useTranslation();

  return (
    <div className="bg-gray-800 rounded-lg p-6 border-2 border-gray-700">
      <h3 className="text-lg font-semibold text-white mb-4">{t('stats.title')}</h3>
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <div className="text-gray-400">{t('stats.level')}</div>
          <div className="text-2xl font-bold text-white">{player.level}</div>
        </div>
        <div>
          <div className="text-gray-400">{t('stats.hp')}</div>
          <div className="text-2xl font-bold text-green-500">{player.hp}/{player.maxHp}</div>
        </div>
        <div>
          <div className="text-gray-400">{t('stats.attack')}</div>
          <div className="text-xl font-semibold text-red-400">{player.attack}</div>
        </div>
        <div>
          <div className="text-gray-400">{t('stats.defense')}</div>
          <div className="text-xl font-semibold text-blue-400">{player.defense}</div>
        </div>
      </div>
      <div className="mt-4">
        <div className="flex justify-between text-xs text-gray-400 mb-1">
          <span>{t('stats.xp')}</span>
          <span>{player.xp} / {player.xpToNextLevel}</span>
        </div>
        <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
            style={{ width: `${(player.xp / player.xpToNextLevel) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * Main Menu component.
 */
export function MainMenu({ onStartBattle, onCalibration, onSettings }: MainMenuProps) {
  const { t } = useTranslation();

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        {/* Title */}
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1 className="text-6xl font-bold text-white mb-2 tracking-tight">
            🍔 <span className="bg-gradient-to-r from-red-500 to-yellow-500 bg-clip-text text-transparent">{t('menu.title')}</span>
          </h1>
          <p className="text-gray-400 text-lg">{t('menu.subtitle')}</p>
        </motion.div>

        {/* Player Stats */}
        <motion.div
          className="mb-8"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <PlayerStatsCard />
        </motion.div>

        {/* Menu Buttons */}
        <motion.div
          className="flex flex-col gap-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <MenuButton
            label={t('menu.startBattle')}
            onClick={onStartBattle}
            icon="⚔️"
            variant="primary"
          />
          <MenuButton
            label={t('menu.calibration')}
            onClick={onCalibration}
            icon="🎯"
            variant="secondary"
          />
          <MenuButton
            label={t('menu.settings')}
            onClick={onSettings}
            icon="⚙️"
            variant="secondary"
          />
        </motion.div>

        {/* Version */}
        <div className="text-center mt-8 text-gray-600 text-sm">
          {t('menu.version')}
        </div>
      </div>
    </div>
  );
}
