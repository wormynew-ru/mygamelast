/**
 * InventoryScreen - View collected loot, equip/unequip gear, and consume healing items.
 */

import { ArrowLeft, Shield, Sword, Heart } from 'lucide-react';
import { ITEMS } from '../game/data/items';
import { useGameStore, selectEffectivePlayerStats } from '../game/store';
import { useTranslation, type TranslationKey } from '../i18n/useTranslation';

interface InventoryScreenProps {
  onBack: () => void;
}

const ITEM_NAME_KEYS: Record<string, TranslationKey> = {
  PROTEIN_SHAKE: 'item.PROTEIN_SHAKE.name',
  ENERGY_BAR: 'item.ENERGY_BAR.name',
  RUNNING_SHOES: 'item.RUNNING_SHOES.name',
  WEIGHT_BELT: 'item.WEIGHT_BELT.name',
  ARMOR_VEST: 'item.ARMOR_VEST.name',
};

const ITEM_DESC_KEYS: Record<string, TranslationKey> = {
  PROTEIN_SHAKE: 'item.PROTEIN_SHAKE.description',
  ENERGY_BAR: 'item.ENERGY_BAR.description',
  RUNNING_SHOES: 'item.RUNNING_SHOES.description',
  WEIGHT_BELT: 'item.WEIGHT_BELT.description',
  ARMOR_VEST: 'item.ARMOR_VEST.description',
};

export function InventoryScreen({ onBack }: InventoryScreenProps) {
  const { t } = useTranslation();
  const basePlayer = useGameStore((state) => state.player);
  const itemsMap = useGameStore((state) => state.inventory.items);
  const equippedItems = useGameStore((state) => state.inventory.equippedItems);
  const equipItem = useGameStore((state) => state.equipItem);
  const unequipItem = useGameStore((state) => state.unequipItem);
  const useConsumable = useGameStore((state) => state.useConsumable);

  const effectivePlayer = selectEffectivePlayerStats(useGameStore.getState());

  const ownedEntries = Array.from(itemsMap.entries()).filter(
    ([id, qty]) => qty > 0 && Boolean(ITEMS[id])
  );

  const equipmentEntries = ownedEntries.filter(([id]) => ITEMS[id].type === 'EQUIPMENT');
  const consumableEntries = ownedEntries.filter(([id]) => ITEMS[id].type === 'CONSUMABLE');

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
            {t('inventory.title')}
          </h1>

          <div className="w-24" aria-hidden="true" />
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-8 space-y-8">
        {/* Live Effective Stats Bar */}
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-wrap items-center justify-between gap-6">
          <p className="text-sm text-slate-400">{t('inventory.subtitle')}</p>

          <div className="flex items-center gap-6 font-numeric text-sm">
            <div className="flex items-center gap-2">
              <Heart className="w-4 h-4 text-emerald-400" />
              <span>
                {effectivePlayer.hp} / {effectivePlayer.maxHp}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Sword className="w-4 h-4 text-amber-400" />
              <span>
                {t('stats.attack')}: {effectivePlayer.attack}
                {effectivePlayer.attack > basePlayer.attack && (
                  <span className="text-emerald-400 ml-1">
                    (+{effectivePlayer.attack - basePlayer.attack})
                  </span>
                )}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-sky-400" />
              <span>
                {t('stats.defense')}: {effectivePlayer.defense}
                {effectivePlayer.defense > basePlayer.defense && (
                  <span className="text-emerald-400 ml-1">
                    (+{effectivePlayer.defense - basePlayer.defense})
                  </span>
                )}
              </span>
            </div>
          </div>
        </section>

        {ownedEntries.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-10 text-center text-slate-400 text-sm">
            {t('inventory.empty')}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Equipment */}
            <section className="space-y-3">
              <h2 className="text-base font-semibold text-white">{t('inventory.equipment')}</h2>
              {equipmentEntries.length === 0 ? (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-sm text-slate-500">
                  —
                </div>
              ) : (
                equipmentEntries.map(([id, qty]) => {
                  const item = ITEMS[id];
                  const isEquipped = equippedItems.includes(id);
                  const name = ITEM_NAME_KEYS[id] ? t(ITEM_NAME_KEYS[id]) : item.name;
                  const desc = ITEM_DESC_KEYS[id] ? t(ITEM_DESC_KEYS[id]) : item.description;

                  return (
                    <div
                      key={id}
                      className={`p-4 rounded-xl border flex items-center justify-between gap-4 ${
                        isEquipped
                          ? 'bg-slate-900 border-emerald-500'
                          : 'bg-slate-900 border-slate-800'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-white text-sm truncate">
                          {name}{' '}
                          <span className="font-numeric text-xs text-slate-400">
                            · {qty} {t('inventory.qty')}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">{desc}</p>
                      </div>

                      <button
                        onClick={() => (isEquipped ? unequipItem(id) : equipItem(id))}
                        className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                          isEquipped
                            ? 'bg-slate-800 hover:bg-slate-700 text-emerald-400'
                            : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                        }`}
                      >
                        {isEquipped ? t('inventory.unequip') : t('inventory.equip')}
                      </button>
                    </div>
                  );
                })
              )}
            </section>

            {/* Consumables */}
            <section className="space-y-3">
              <h2 className="text-base font-semibold text-white">{t('inventory.consumables')}</h2>
              {consumableEntries.length === 0 ? (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-sm text-slate-500">
                  —
                </div>
              ) : (
                consumableEntries.map(([id, qty]) => {
                  const item = ITEMS[id];
                  const isFullHp = effectivePlayer.hp >= effectivePlayer.maxHp;
                  const name = ITEM_NAME_KEYS[id] ? t(ITEM_NAME_KEYS[id]) : item.name;
                  const desc = ITEM_DESC_KEYS[id] ? t(ITEM_DESC_KEYS[id]) : item.description;

                  return (
                    <div
                      key={id}
                      className="p-4 rounded-xl border border-slate-800 bg-slate-900 flex items-center justify-between gap-4"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-white text-sm truncate">
                          {name}{' '}
                          <span className="font-numeric text-xs text-slate-400">
                            · {qty} {t('inventory.qty')}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">{desc}</p>
                      </div>

                      <button
                        onClick={() => useConsumable(id)}
                        disabled={isFullHp}
                        className="px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors whitespace-nowrap shrink-0"
                      >
                        {isFullHp ? t('inventory.fullHp') : t('inventory.use')}
                      </button>
                    </div>
                  );
                })
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
