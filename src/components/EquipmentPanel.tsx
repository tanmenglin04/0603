import React, { useState, useEffect, useMemo } from 'react';
import { useEquipmentStore } from '../store/useEquipmentStore';
import type { ElementType, EquipmentQuality, EquipmentSeries, RuneEquipment } from '../types';
import {
  ELEMENT_NAMES,
  ELEMENT_ICONS,
  ELEMENT_COLORS,
  QUALITY_NAMES,
  QUALITY_COLORS,
  getSlotsForLevel,
  SERIES_NAMES,
  SERIES_ICONS,
  SERIES_COLORS,
  SERIES_RESONANCE,
} from '../types';
import { canUpgrade, getActiveResonances, getSeriesPieceCount } from '../utils/runeEquipment';
import EquipmentCard from './EquipmentCard';
import { Coins, ArrowLeft, Package, Wand2, Sparkles } from 'lucide-react';

type TabKey = 'slots' | 'inventory' | 'upgrade' | 'resonance';

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: 'slots', label: '装备槽位', icon: <Package size={16} /> },
  { key: 'inventory', label: '背包', icon: <Coins size={16} /> },
  { key: 'upgrade', label: '升阶', icon: <Wand2 size={16} /> },
  { key: 'resonance', label: '共鸣', icon: <Sparkles size={16} /> },
];

const ELEMENTS: ElementType[] = ['fire', 'water', 'grass', 'thunder'];

const QUALITY_FILTERS: { key: EquipmentQuality | 'all'; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'common', label: '普通' },
  { key: 'rare', label: '稀有' },
  { key: 'epic', label: '史诗' },
  { key: 'legendary', label: '传说' },
];

const ELEMENT_FILTERS: { key: ElementType | 'all'; label: string; icon: string }[] = [
  { key: 'all', label: '全部', icon: '✦' },
  { key: 'fire', label: '火', icon: '🔥' },
  { key: 'water', label: '水', icon: '💧' },
  { key: 'grass', label: '草', icon: '🌿' },
  { key: 'thunder', label: '雷', icon: '⚡' },
];

const SERIES_FILTERS: { key: EquipmentSeries | 'all'; label: string; icon: string }[] = [
  { key: 'all', label: '全部', icon: '✦' },
  { key: 'blaze', label: '烈焰', icon: '🔥' },
  { key: 'frost', label: '寒冰', icon: '❄️' },
  { key: 'storm', label: '风暴', icon: '⛈️' },
  { key: 'earth', label: '大地', icon: '🌍' },
];

interface EquipmentPanelProps {
  onBack?: () => void;
}

const EquipmentPanel: React.FC<EquipmentPanelProps> = ({ onBack }) => {
  const {
    gold,
    inventory,
    equipped,
    highestLevel,
    selectedUpgradeItems,
    load,
    equip,
    unequip,
    toggleUpgradeSelect,
    clearUpgradeSelect,
    performUpgrade,
    getAvailableSlots,
    syncFromLS,
  } = useEquipmentStore();

  const [activeTab, setActiveTab] = useState<TabKey>('slots');
  const [elementFilter, setElementFilter] = useState<ElementType | 'all'>('all');
  const [qualityFilter, setQualityFilter] = useState<EquipmentQuality | 'all'>('all');
  const [seriesFilter, setSeriesFilter] = useState<EquipmentSeries | 'all'>('all');

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    syncFromLS();
  }, [syncFromLS]);

  const availableSlots = getAvailableSlots();

  const getItemById = (id: string): RuneEquipment | undefined =>
    inventory.find((item) => item.id === id);

  const getEquippedForElement = (element: ElementType): (RuneEquipment | null)[] => {
    const slots = equipped[element] || [];
    const result: (RuneEquipment | null)[] = [];
    for (let i = 0; i < availableSlots; i++) {
      const id = slots[i];
      if (id) {
        const item = getItemById(id);
        result.push(item || null);
      } else {
        result.push(null);
      }
    }
    return result;
  };

  const allEquippedItems = useMemo(() => {
    const items: RuneEquipment[] = [];
    for (const element of ELEMENTS) {
      const slots = equipped[element] || [];
      for (const id of slots) {
        if (id) {
          const item = getItemById(id);
          if (item) items.push(item);
        }
      }
    }
    return items;
  }, [equipped, inventory]);

  const activeResonances = useMemo(() => getActiveResonances(allEquippedItems), [allEquippedItems]);
  const seriesCounts = useMemo(() => getSeriesPieceCount(allEquippedItems), [allEquippedItems]);

  const getElementBonuses = (element: ElementType) => {
    const items = getEquippedForElement(element).filter((i): i is RuneEquipment => i !== null);
    let energyBoost = 0;
    let spellDamage = 0;
    let initialEnergy = 0;
    for (const item of items) {
      for (const affix of item.affixes) {
        if (affix.type === 'energy_boost') energyBoost += affix.value;
        else if (affix.type === 'spell_damage') spellDamage += affix.value;
        else if (affix.type === 'initial_energy') initialEnergy += affix.value;
      }
    }
    return { energyBoost, spellDamage, initialEnergy };
  };

  const filteredInventory = useMemo(() => {
    return inventory.filter((item) => {
      if (elementFilter !== 'all' && item.element !== elementFilter) return false;
      if (qualityFilter !== 'all' && item.quality !== qualityFilter) return false;
      if (seriesFilter !== 'all' && item.series !== seriesFilter) return false;
      return true;
    });
  }, [inventory, elementFilter, qualityFilter, seriesFilter]);

  const selectedItems = useMemo(() => {
    return selectedUpgradeItems
      .map((id) => inventory.find((item) => item.id === id))
      .filter((i): i is RuneEquipment => i !== undefined);
  }, [selectedUpgradeItems, inventory]);

  const upgradeValid = useMemo(() => canUpgrade(selectedItems), [selectedItems]);

  const handleSmartEquip = (equipmentId: string) => {
    const item = getItemById(equipmentId);
    if (!item) return;
    const element = item.element;
    const slots = equipped[element] || [];
    for (let i = 0; i < availableSlots; i++) {
      if (!slots[i]) {
        equip(element, i, equipmentId);
        return;
      }
    }
  };

  const handleUnequip = (element: ElementType, slotIndex: number) => {
    unequip(element, slotIndex);
  };

  const handleUpgrade = () => {
    performUpgrade();
  };

  const renderSlotsTab = () => (
    <div className="space-y-4">
      {activeResonances.length > 0 && (
        <div className="bg-gradient-to-r from-purple-900/40 to-indigo-900/40 border border-purple-500/30 rounded-xl p-3">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles size={16} className="text-purple-300" />
            <span className="text-sm font-bold text-purple-200">共鸣效果</span>
          </div>
          <div className="space-y-1">
            {activeResonances.map((r) => {
              const config = SERIES_RESONANCE.find((c) => c.series === r.series)!;
              return (
                <div key={r.series} className="flex items-center gap-2 text-xs">
                  <span style={{ color: SERIES_COLORS[r.series] }}>
                    {SERIES_ICONS[r.series]} {SERIES_NAMES[r.series]}
                  </span>
                  <span className="text-gray-400">({r.pieces}件)</span>
                  <span style={{ color: SERIES_COLORS[r.series] }}>{r.desc}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {ELEMENTS.map((element) => {
        const equippedItems = getEquippedForElement(element);
        const bonuses = getElementBonuses(element);
        const hasBonuses = bonuses.energyBoost > 0 || bonuses.spellDamage > 0 || bonuses.initialEnergy > 0;

        return (
          <div key={element} className="game-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">{ELEMENT_ICONS[element]}</span>
              <h3
                className="font-bold text-sm"
                style={{ color: ELEMENT_COLORS[element] }}
              >
                {ELEMENT_NAMES[element]}元素
              </h3>
              <span className="text-xs text-gray-400 ml-auto">
                {availableSlots} 个槽位
              </span>
            </div>

            <div className="flex gap-3 mb-3">
              {equippedItems.map((item, index) => {
                if (item) {
                  return (
                    <div key={item.id} className="flex-1 min-w-0">
                      <EquipmentCard
                        equipment={item}
                        compact
                        onUnequip={() => handleUnequip(element, index)}
                      />
                    </div>
                  );
                }

                return (
                  <div
                    key={`empty-${index}`}
                    className="flex-1 min-h-[80px] rounded-lg border-2 border-dashed border-gray-600/50 flex items-center justify-center"
                  >
                    <span className="text-gray-600 text-2xl">⊘</span>
                  </div>
                );
              })}
              {Array.from({ length: Math.max(0, 3 - availableSlots) }).map((_, i) => (
                <div
                  key={`locked-${i}`}
                  className="flex-1 min-h-[80px] rounded-lg border-2 border-dashed border-gray-700/30 flex items-center justify-center bg-gray-900/20"
                >
                  <span className="text-gray-700 text-xl">🔒</span>
                </div>
              ))}
            </div>

            {hasBonuses && (
              <div className="bg-game-bg-dark/60 rounded-lg p-2 text-xs flex gap-4 text-gray-300">
                {bonuses.energyBoost > 0 && (
                  <span>⚡能量+{bonuses.energyBoost}</span>
                )}
                {bonuses.spellDamage > 0 && (
                  <span>⚔️伤害+{bonuses.spellDamage}%</span>
                )}
                {bonuses.initialEnergy > 0 && (
                  <span>✨初始+{bonuses.initialEnergy}</span>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  const renderInventoryTab = () => (
    <div>
      <div className="flex flex-wrap gap-2 mb-3">
        {ELEMENT_FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setElementFilter(f.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              elementFilter === f.key
                ? 'bg-game-gold text-game-bg-dark'
                : 'bg-game-bg-dark text-gray-300 hover:bg-game-card-hover'
            }`}
          >
            {f.icon} {f.label}
          </button>
        ))}
        <div className="w-px bg-gray-600/50 mx-1" />
        {QUALITY_FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setQualityFilter(f.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              qualityFilter === f.key
                ? 'bg-game-gold text-game-bg-dark'
                : 'bg-game-bg-dark text-gray-300 hover:bg-game-card-hover'
            }`}
          >
            <span
              style={{
                color:
                  f.key !== 'all' ? QUALITY_COLORS[f.key as EquipmentQuality] : undefined,
              }}
            >
              {f.label}
            </span>
          </button>
        ))}
        <div className="w-px bg-gray-600/50 mx-1" />
        {SERIES_FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setSeriesFilter(f.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              seriesFilter === f.key
                ? 'bg-game-gold text-game-bg-dark'
                : 'bg-game-bg-dark text-gray-300 hover:bg-game-card-hover'
            }`}
          >
            <span
              style={{
                color:
                  f.key !== 'all' ? SERIES_COLORS[f.key as EquipmentSeries] : undefined,
              }}
            >
              {f.icon} {f.label}
            </span>
          </button>
        ))}
      </div>

      {filteredInventory.length === 0 ? (
        <div className="game-card p-8 text-center text-gray-500">
          <Package size={40} className="mx-auto mb-3 opacity-50" />
          <p>没有符合条件的装备</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {filteredInventory.map((item) => (
            <EquipmentCard
              key={item.id}
              equipment={item}
              onEquip={() => handleSmartEquip(item.id)}
              onSell={() => useEquipmentStore.getState().sell(item.id)}
              onReroll={(affixIndex) => useEquipmentStore.getState().reroll(item.id, affixIndex)}
            />
          ))}
        </div>
      )}
    </div>
  );

  const renderUpgradeTab = () => (
    <div>
      <div className="game-card p-4 mb-4">
        <div className="flex items-center gap-2 mb-2">
          <Wand2 size={18} className="text-game-gold" />
          <h3 className="font-bold text-game-gold text-sm">升阶说明</h3>
        </div>
        <p className="text-xs text-gray-400">
          选择3件同元素、同品质、同等级的装备进行升阶
        </p>
      </div>

      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-300">
            已选择 {selectedUpgradeItems.length}/3
          </span>
          {selectedUpgradeItems.length > 0 && (
            <button
              onClick={clearUpgradeSelect}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              清除选择
            </button>
          )}
        </div>

        {selectedUpgradeItems.length === 0 ? (
          <div className="game-card p-6 text-center text-gray-500 text-sm">
            点击下方背包中的装备进行选择
          </div>
        ) : (
          <div className="flex gap-3 mb-4">
            {[0, 1, 2].map((i) => {
              const item = selectedItems[i];
              if (item) {
                return (
                  <div key={item.id} className="flex-1">
                    <EquipmentCard
                      equipment={item}
                      compact
                      isSelected
                      onSelect={() => toggleUpgradeSelect(item.id)}
                    />
                  </div>
                );
              }
              return (
                <div
                  key={`empty-${i}`}
                  className="flex-1 min-h-[80px] rounded-lg border-2 border-dashed border-gray-600/50 flex items-center justify-center"
                >
                  <span className="text-gray-600">空</span>
                </div>
              );
            })}
          </div>
        )}

        {selectedItems.length === 3 && (
          <div className="game-card p-3 mb-4">
            <div className="text-xs text-gray-400 mb-1">升阶预览</div>
            {upgradeValid ? (
              <div className="text-sm text-green-400">
                ✅ 可升阶 — 3件{ELEMENT_ICONS[selectedItems[0].element]}
                {ELEMENT_NAMES[selectedItems[0].element]}元素
                {QUALITY_NAMES[selectedItems[0].quality]}品质 Lv.{selectedItems[0].level} 装备
              </div>
            ) : (
              <div className="text-sm text-red-400">
                ❌ 无法升阶 — 需要同元素、同品质、同等级的3件装备
              </div>
            )}
          </div>
        )}

        <button
          onClick={handleUpgrade}
          disabled={selectedUpgradeItems.length !== 3 || !upgradeValid}
          className={`game-button w-full py-3 text-sm font-bold ${
            selectedUpgradeItems.length === 3 && upgradeValid
              ? 'game-button-primary'
              : 'bg-gray-700 text-gray-500 cursor-not-allowed'
          }`}
        >
          <Wand2 size={16} className="inline mr-2" />
          升阶
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {inventory.map((item) => {
          const isSelected = selectedUpgradeItems.includes(item.id);
          return (
            <EquipmentCard
              key={item.id}
              equipment={item}
              compact
              isSelected={isSelected}
              onSelect={() => toggleUpgradeSelect(item.id)}
            />
          );
        })}
      </div>
    </div>
  );

  const renderResonanceTab = () => (
    <div className="space-y-3">
      <div className="game-card p-4 mb-2">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles size={18} className="text-purple-300" />
          <h3 className="font-bold text-purple-200 text-sm">套装共鸣</h3>
        </div>
        <p className="text-xs text-gray-400">
          穿戴同一系列的装备达到2件或4件时，触发共鸣效果。不同系列之间可叠加。
        </p>
      </div>

      {activeResonances.length > 0 && (
        <div className="bg-gradient-to-r from-purple-900/50 to-indigo-900/50 border border-purple-500/40 rounded-xl p-3">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles size={16} className="text-yellow-300" />
            <span className="text-sm font-bold text-yellow-200">当前激活共鸣</span>
          </div>
          <div className="space-y-2">
            {activeResonances.map((r) => (
              <div
                key={r.series}
                className="bg-black/30 rounded-lg p-2.5 border"
                style={{ borderColor: `${SERIES_COLORS[r.series]}40` }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span style={{ color: SERIES_COLORS[r.series] }} className="font-bold text-sm">
                    {SERIES_ICONS[r.series]} {SERIES_NAMES[r.series]}系列
                  </span>
                  <span
                    className="text-xs px-1.5 py-0.5 rounded font-bold"
                    style={{
                      color: SERIES_COLORS[r.series],
                      backgroundColor: `${SERIES_COLORS[r.series]}20`,
                    }}
                  >
                    {r.pieces}件套
                  </span>
                </div>
                <div className="text-xs" style={{ color: SERIES_COLORS[r.series] }}>
                  {r.desc}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {SERIES_RESONANCE.map((config) => {
        const count = seriesCounts[config.series];
        const isActive2 = count >= 2;
        const isActive4 = count >= 4;

        return (
          <div
            key={config.series}
            className="game-card p-4 border-l-4"
            style={{ borderLeftColor: config.color }}
          >
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">{config.icon}</span>
              <h3 className="font-bold text-sm" style={{ color: config.color }}>
                {config.name}
              </h3>
              <span className="ml-auto text-xs text-gray-400">
                已穿戴 {count} 件
              </span>
            </div>

            <div className="space-y-2">
              <div
                className={`rounded-lg p-2.5 border ${
                  isActive2
                    ? 'bg-green-900/20 border-green-500/40'
                    : 'bg-gray-900/30 border-gray-700/30'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                      isActive2 ? 'bg-green-500/30 text-green-300' : 'bg-gray-700/50 text-gray-500'
                    }`}
                  >
                    2件套
                  </span>
                  {isActive2 && <span className="text-xs text-green-400">✅ 已激活</span>}
                </div>
                <p className={`text-xs ${isActive2 ? 'text-green-200' : 'text-gray-500'}`}>
                  {config.piece2Desc}
                </p>
              </div>

              <div
                className={`rounded-lg p-2.5 border ${
                  isActive4
                    ? 'bg-yellow-900/20 border-yellow-500/40'
                    : 'bg-gray-900/30 border-gray-700/30'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                      isActive4 ? 'bg-yellow-500/30 text-yellow-300' : 'bg-gray-700/50 text-gray-500'
                    }`}
                  >
                    4件套
                  </span>
                  {isActive4 && <span className="text-xs text-yellow-400">✅ 已激活</span>}
                </div>
                <p className={`text-xs ${isActive4 ? 'text-yellow-200' : 'text-gray-500'}`}>
                  {config.piece4Desc}
                </p>
              </div>
            </div>

            <div className="mt-2">
              <div className="flex gap-1">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className={`h-1.5 flex-1 rounded-full ${
                      i < count ? '' : 'bg-gray-700/50'
                    }`}
                    style={i < count ? { backgroundColor: config.color } : undefined}
                  />
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="min-h-screen w-full overflow-auto p-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={onBack}
            className="game-button px-3 py-2 bg-game-card text-gray-300 hover:text-white"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-2xl font-bold text-game-gold font-display">
            符文装备
          </h1>
          <div className="flex items-center gap-1.5 bg-game-card px-4 py-2 rounded-lg">
            <Coins size={18} className="text-game-gold" />
            <span className="text-game-gold font-bold">{gold}</span>
          </div>
        </div>

        <div className="flex gap-1 mb-4 bg-game-card rounded-xl p-1">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === tab.key
                  ? 'bg-game-gold text-game-bg-dark'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        <div>
          {activeTab === 'slots' && renderSlotsTab()}
          {activeTab === 'inventory' && renderInventoryTab()}
          {activeTab === 'upgrade' && renderUpgradeTab()}
          {activeTab === 'resonance' && renderResonanceTab()}
        </div>
      </div>
    </div>
  );
};

export default EquipmentPanel;
