/**
 * InventoryScreen - View collected loot, equip/unequip gear, consume healing items,
 * and spend Fit-Coins in the Shop for gear rarities and consumables.
 */

import { useState } from 'react';
import { ArrowLeft, Shield, Sword, Heart, Coins, ShoppingBag, Backpack, Sprout } from 'lucide-react';
import { ITEMS, SHOP_ITEM_IDS } from '../game/data/items';
import { SEEDS, SEED_ORDER } from '../game/data/garden';
import {
  MONSTER_TROPHIES,
  MONSTER_TROPHY_ORDER,
  getTotalCropCount,
  getTotalTrophyCount,
} from '../game/data/sanctuary';
import { useGameStore, selectEffectivePlayerStats } from '../game/store';
import { useTranslation } from '../i18n/useTranslation';
import {
  ITEM_DESC_KEYS,
  ITEM_NAME_KEYS,
  MONSTER_TROPHY_KEYS,
  RARITY_KEYS,
  RARITY_TEXT_CLASS,
  SEED_KEYS,
} from './gameKeys';

interface InventoryScreenProps {
  onBack: () => void;
}

export function InventoryScreen({ onBack }: InventoryScreenProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'BAG' | 'SHOP'>('BAG');

  const basePlayer = useGameStore((state) => state.player);
  const coins = useGameStore((state) => state.coins);
  const itemsMap = useGameStore((state) => state.inventory.items);
  const equippedItems = useGameStore((state) => state.inventory.equippedItems);
  const cropInventory = useGameStore((state) => state.garden.cropInventory);
  const trophyInventory = useGameStore((state) => state.sanctuary.trophyInventory);
  const equipItem = useGameStore((state) => state.equipItem);
  const unequipItem = useGameStore((state) => state.unequipItem);
  const useConsumable = useGameStore((state) => state.useConsumable);
  const buyItem = useGameStore((state) => state.buyItem);

  const effectivePlayer = selectEffectivePlayerStats(useGameStore.getState());
  const totalCrops = getTotalCropCount(cropInventory);
  const totalTrophies = getTotalTrophyCount(trophyInventory);

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
            {t('menu.shopAndGear')}
          </h1>

          <div className="flex items-center gap-1.5 font-numeric text-sm font-bold text-amber-400 shrink-0">
            <Coins className="w-4 h-4" />
            <span>{coins}</span>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-8 space-y-6">
        {/* Live Effective Stats Bar + Segmented Tabs */}
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-wrap items-center justify-between gap-6">
          <div className="inline-flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-lg">
            <button
              onClick={() => setActiveTab('BAG')}
              className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                activeTab === 'BAG'
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Backpack className="w-3.5 h-3.5" />
              <span>{t('shop.tabBag')}</span>
            </button>
            <button
              onClick={() => setActiveTab('SHOP')}
              className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                activeTab === 'SHOP'
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>{t('shop.tabShop')}</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-6 font-numeric text-sm">
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

        {activeTab === 'BAG' ? (
          <div className="space-y-8">
            {ownedEntries.length === 0 && totalCrops === 0 && totalTrophies === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-10 text-center text-slate-400 text-sm">
                {t('inventory.empty')}
              </div>
            ) : (
              <>
                {ownedEntries.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Equipment */}
                    <section className="space-y-3">
                      <h2 className="text-base font-semibold text-white">
                        {t('inventory.equipment')}
                      </h2>
                      {equipmentEntries.length === 0 ? (
                        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-sm text-slate-500">
                          —
                        </div>
                      ) : (
                        equipmentEntries.map(([id, qty]) => {
                          const item = ITEMS[id];
                          const isEquipped = equippedItems.includes(id);
                          const name = ITEM_NAME_KEYS[id] ? t(ITEM_NAME_KEYS[id]) : item.name;
                          const desc = ITEM_DESC_KEYS[id]
                            ? t(ITEM_DESC_KEYS[id])
                            : item.description;

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
                                  {name}
                                </div>
                                <div className="text-xs mt-0.5 flex items-center gap-2">
                                  <span className={`font-medium ${RARITY_TEXT_CLASS[item.rarity]}`}>
                                    {t(RARITY_KEYS[item.rarity])}
                                  </span>
                                  <span aria-hidden="true" className="text-slate-600">
                                    ·
                                  </span>
                                  <span className="font-numeric text-slate-400">
                                    {qty} {t('inventory.qty')}
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
                      <h2 className="text-base font-semibold text-white">
                        {t('inventory.consumables')}
                      </h2>
                      {consumableEntries.length === 0 ? (
                        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-sm text-slate-500">
                          —
                        </div>
                      ) : (
                        consumableEntries.map(([id, qty]) => {
                          const item = ITEMS[id];
                          const isFullHp = effectivePlayer.hp >= effectivePlayer.maxHp;
                          const name = ITEM_NAME_KEYS[id] ? t(ITEM_NAME_KEYS[id]) : item.name;
                          const desc = ITEM_DESC_KEYS[id]
                            ? t(ITEM_DESC_KEYS[id])
                            : item.description;

                          return (
                            <div
                              key={id}
                              className="p-4 rounded-xl border border-slate-800 bg-slate-900 flex items-center justify-between gap-4"
                            >
                              <div className="min-w-0">
                                <div className="font-semibold text-white text-sm truncate">
                                  {name}
                                </div>
                                <div className="text-xs mt-0.5 flex items-center gap-2">
                                  <span className={`font-medium ${RARITY_TEXT_CLASS[item.rarity]}`}>
                                    {t(RARITY_KEYS[item.rarity])}
                                  </span>
                                  <span aria-hidden="true" className="text-slate-600">
                                    ·
                                  </span>
                                  <span className="font-numeric text-slate-400">
                                    {qty} {t('inventory.qty')}
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

                {totalCrops > 0 && (
                  <section className="space-y-3 pt-2 border-t border-slate-800">
                    <div className="flex items-center gap-2">
                      <Sprout className="w-4 h-4 text-emerald-400" />
                      <h2 className="text-base font-semibold text-white">
                        {t('garden.stashTitle')}
                      </h2>
                    </div>
                    <p className="text-xs text-slate-400">{t('garden.stashHint')}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                      {SEED_ORDER.filter((id) => (cropInventory[id] ?? 0) > 0).map((seedId) => (
                        <div
                          key={seedId}
                          className="p-3.5 rounded-xl border border-emerald-600/40 bg-slate-900 flex items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="text-2xl shrink-0" aria-hidden="true">
                              {SEEDS[seedId].icon}
                            </span>
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-white truncate">
                                {t(SEED_KEYS[seedId].name)}
                              </div>
                              <div className={`text-[11px] ${RARITY_TEXT_CLASS[SEEDS[seedId].rarity]}`}>
                                {t(RARITY_KEYS[SEEDS[seedId].rarity])}
                              </div>
                            </div>
                          </div>
                          <span className="font-numeric text-sm font-bold text-emerald-400 shrink-0">
                            ×{cropInventory[seedId]}
                          </span>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
                {totalTrophies > 0 && (
                  <section className="space-y-3 pt-2 border-t border-slate-800">
                    <div className="flex items-center gap-2">
                      <ShoppingBag className="w-4 h-4 text-amber-400" />
                      <h2 className="text-base font-semibold text-white">
                        {t('sanctuary.trophiesTitle')}
                      </h2>
                    </div>
                    <p className="text-xs text-slate-400">{t('sanctuary.trophiesHint')}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                      {MONSTER_TROPHY_ORDER.filter((id) => (trophyInventory?.[id] ?? 0) > 0).map(
                        (trophyId) => {
                          const def = MONSTER_TROPHIES[trophyId];
                          const keys = MONSTER_TROPHY_KEYS[trophyId];
                          return (
                            <div
                              key={trophyId}
                              className="p-3.5 rounded-xl border border-amber-500/40 bg-slate-900 flex items-center justify-between gap-3"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span className="text-2xl shrink-0" aria-hidden="true">
                                  {def.icon}
                                </span>
                                <div className="min-w-0">
                                  <div className="text-xs font-semibold text-white truncate">
                                    {t(keys.name)}
                                  </div>
                                  <div className="text-[11px] text-slate-400 truncate">
                                    {t(keys.source)}
                                  </div>
                                </div>
                              </div>
                              <span className="font-numeric text-sm font-bold text-amber-400 shrink-0">
                                ×{trophyInventory[trophyId]}
                              </span>
                            </div>
                          );
                        }
                      )}
                    </div>
                  </section>
                )}
              </>
            )}
          </div>
        ) : (
          /* Shop View */
          <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {SHOP_ITEM_IDS.map((id) => {
              const item = ITEMS[id];
              if (!item) return null;
              const ownedQty = itemsMap.get(id) ?? 0;
              const canAfford = coins >= item.price;
              const name = ITEM_NAME_KEYS[id] ? t(ITEM_NAME_KEYS[id]) : item.name;
              const desc = ITEM_DESC_KEYS[id] ? t(ITEM_DESC_KEYS[id]) : item.description;

              return (
                <div
                  key={id}
                  className="p-4 rounded-xl border border-slate-800 bg-slate-900 flex items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-white text-sm truncate">{name}</div>
                    <div className="text-xs mt-0.5 flex items-center gap-2">
                      <span className={`font-medium ${RARITY_TEXT_CLASS[item.rarity]}`}>
                        {t(RARITY_KEYS[item.rarity])}
                      </span>
                      <span aria-hidden="true" className="text-slate-600">·</span>
                      <span className="text-slate-400">
                        {item.type === 'EQUIPMENT'
                          ? t('inventory.equipment')
                          : t('inventory.consumables')}
                      </span>
                      {ownedQty > 0 && (
                        <>
                          <span aria-hidden="true" className="text-slate-600">·</span>
                          <span className="font-numeric text-emerald-400">
                            {t('shop.owned')}: {ownedQty}
                          </span>
                        </>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-1">{desc}</p>
                  </div>

                  <button
                    onClick={() => buyItem(id)}
                    disabled={!canAfford}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-slate-950 transition-colors whitespace-nowrap shrink-0 font-numeric"
                  >
                    <Coins className="w-3.5 h-3.5" />
                    <span>
                      {canAfford ? `${t('shop.buy')} · ${item.price}` : item.price}
                    </span>
                  </button>
                </div>
              );
            })}
          </section>
        )}
      </main>
    </div>
  );
}
