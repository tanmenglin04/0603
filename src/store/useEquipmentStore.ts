import { create } from 'zustand';
import type { ElementType, RuneEquipment } from '../types';
import { getSlotsForLevel, REROLL_COST } from '../types';
import {
  loadEquipmentSave,
  addGold as lsAddGold,
  spendGold as lsSpendGold,
  addToInventory as lsAddToInventory,
  removeFromInventory as lsRemoveFromInventory,
  updateInInventory as lsUpdateInInventory,
  equipItem as lsEquipItem,
  unequipItem as lsUnequipItem,
  updateEquipmentHighestLevel as lsUpdateHighestLevel,
} from '../utils/localStorage';
import {
  generateRuneEquipment,
  canUpgrade,
  upgradeEquipment,
  rerollAffix,
  getEquipmentBonuses,
  recastSeries,
  getAvailableSeriesForRecast,
} from '../utils/runeEquipment';
import { useAchievementStore } from './useAchievementStore';

interface EquipmentState {
  gold: number;
  inventory: RuneEquipment[];
  equipped: Partial<Record<ElementType, (string | null)[]>>;
  highestLevel: number;
  selectedUpgradeItems: string[];
  selectedRecastItemId: string | null;
  selectedRecastMaterials: string[];
}

interface EquipmentActions {
  load: () => void;
  addReward: (levelId: number) => RuneEquipment[];
  equip: (element: ElementType, slotIndex: number, equipmentId: string) => void;
  unequip: (element: ElementType, slotIndex: number) => void;
  toggleUpgradeSelect: (id: string) => void;
  clearUpgradeSelect: () => void;
  performUpgrade: () => RuneEquipment | null;
  reroll: (equipmentId: string, affixIndex: number) => boolean;
  sell: (id: string) => number;
  getEquippedItems: () => RuneEquipment[];
  getBonuses: () => ReturnType<typeof getEquipmentBonuses>;
  getAvailableSlots: () => number;
  syncFromLS: () => void;
  selectRecastItem: (id: string | null) => void;
  toggleRecastMaterial: (id: string) => void;
  clearRecastSelect: () => void;
  performRecast: (targetSeries: EquipmentSeries) => RuneEquipment | null;
  canRecast: () => boolean;
  getRecastCost: () => { gold: number; materials: number } | null;
}

export type EquipmentStore = EquipmentState & EquipmentActions;

export const useEquipmentStore = create<EquipmentStore>((set, get) => ({
  gold: 0,
  inventory: [],
  equipped: {},
  highestLevel: 1,
  selectedUpgradeItems: [],
  selectedRecastItemId: null,
  selectedRecastMaterials: [],

  load: () => {
    const data = loadEquipmentSave();
    set({
      gold: data.gold,
      inventory: data.inventory,
      equipped: data.equipped,
      highestLevel: data.highestLevel,
    });
  },

  addReward: (levelId: number) => {
    const goldReward = (() => {
      const rewards: Record<number, number> = { 1: 80, 2: 150, 3: 250, 4: 400, 5: 600 };
      return rewards[levelId] || 80;
    })();
    const equipment = generateRuneEquipment(levelId);

    try {
      useAchievementStore.getState().recordEquipmentAcquired(equipment.quality);
    } catch { /* non-critical */ }

    const newGold = lsAddGold(goldReward);
    lsAddToInventory([equipment]);
    lsUpdateHighestLevel(levelId);

    const data = loadEquipmentSave();
    set({
      gold: newGold,
      inventory: data.inventory,
      highestLevel: data.highestLevel,
    });

    return [equipment];
  },

  equip: (element, slotIndex, equipmentId) => {
    lsEquipItem(element, slotIndex, equipmentId);
    const data = loadEquipmentSave();
    set({ equipped: data.equipped, inventory: data.inventory });
  },

  unequip: (element, slotIndex) => {
    lsUnequipItem(element, slotIndex);
    const data = loadEquipmentSave();
    set({ equipped: data.equipped });
  },

  toggleUpgradeSelect: (id) => {
    const { selectedUpgradeItems } = get();
    if (selectedUpgradeItems.includes(id)) {
      set({ selectedUpgradeItems: selectedUpgradeItems.filter((i) => i !== id) });
    } else if (selectedUpgradeItems.length < 3) {
      set({ selectedUpgradeItems: [...selectedUpgradeItems, id] });
    }
  },

  clearUpgradeSelect: () => {
    set({ selectedUpgradeItems: [] });
  },

  performUpgrade: () => {
    const { selectedUpgradeItems, inventory } = get();
    if (selectedUpgradeItems.length !== 3) return null;

    const items = selectedUpgradeItems
      .map((id) => inventory.find((e) => e.id === id))
      .filter((e): e is RuneEquipment => e !== undefined);

    if (!canUpgrade(items)) return null;

    const result = upgradeEquipment(items);
    if (!result) return null;

    try {
      const ach = useAchievementStore.getState();
      for (const consumed of items) {
        ach.recordEquipmentConsumed(consumed.quality);
      }
      ach.recordEquipmentAcquired(result.quality);
    } catch { /* non-critical */ }

    lsRemoveFromInventory(selectedUpgradeItems);
    lsAddToInventory([result]);

    const data = loadEquipmentSave();
    set({
      inventory: data.inventory,
      selectedUpgradeItems: [],
    });

    return result;
  },

  reroll: (equipmentId, affixIndex) => {
    const { inventory } = get();
    const item = inventory.find((e) => e.id === equipmentId);
    if (!item) return false;

    const cost = REROLL_COST[item.quality];
    if (!lsSpendGold(cost)) return false;

    const rerolled = rerollAffix(item, affixIndex);
    lsUpdateInInventory(rerolled);

    const data = loadEquipmentSave();
    set({
      gold: data.gold,
      inventory: data.inventory,
    });

    return true;
  },

  sell: (id) => {
    const { inventory, equipped } = get();
    const item = inventory.find((e) => e.id === id);
    if (!item) return 0;

    const sellPrices: Record<string, number> = {
      common: 20,
      rare: 50,
      epic: 120,
      legendary: 300,
    };
    const price = sellPrices[item.quality] * item.level;

    for (const [el, slots] of Object.entries(equipped)) {
      if (slots) {
        for (let i = 0; i < slots.length; i++) {
          if (slots[i] === id) {
            lsUnequipItem(el as ElementType, i);
          }
        }
      }
    }

    lsRemoveFromInventory([id]);
    lsAddGold(price);

    const data = loadEquipmentSave();
    set({
      gold: data.gold,
      inventory: data.inventory,
      equipped: data.equipped,
      selectedUpgradeItems: get().selectedUpgradeItems.filter((i) => i !== id),
    });

    return price;
  },

  getEquippedItems: () => {
    const { inventory, equipped } = get();
    const equippedIds: string[] = [];
    for (const slots of Object.values(equipped)) {
      if (slots) {
        for (const id of slots) {
          if (id) equippedIds.push(id);
        }
      }
    }
    return inventory.filter((e) => equippedIds.includes(e.id));
  },

  getBonuses: () => {
    const equippedItems = get().getEquippedItems();
    return getEquipmentBonuses(equippedItems);
  },

  getAvailableSlots: () => {
    return getSlotsForLevel(get().highestLevel);
  },

  syncFromLS: () => {
    const data = loadEquipmentSave();
    set({
      gold: data.gold,
      inventory: data.inventory,
      equipped: data.equipped,
      highestLevel: data.highestLevel,
    });
  },

  selectRecastItem: (id) => {
    set({ selectedRecastItemId: id, selectedRecastMaterials: [] });
  },

  toggleRecastMaterial: (id) => {
    const { selectedRecastMaterials, selectedRecastItemId, inventory } = get();
    if (id === selectedRecastItemId) return;

    const targetItem = inventory.find((e) => e.id === selectedRecastItemId);
    const materialItem = inventory.find((e) => e.id === id);
    if (!targetItem || !materialItem) return;
    if (materialItem.quality !== targetItem.quality) return;

    if (selectedRecastMaterials.includes(id)) {
      set({ selectedRecastMaterials: selectedRecastMaterials.filter((i) => i !== id) });
    } else {
      const cost = get().getRecastCost();
      if (cost && selectedRecastMaterials.length < cost.materials) {
        set({ selectedRecastMaterials: [...selectedRecastMaterials, id] });
      }
    }
  },

  clearRecastSelect: () => {
    set({ selectedRecastItemId: null, selectedRecastMaterials: [] });
  },

  getRecastCost: () => {
    const { selectedRecastItemId, inventory } = get();
    if (!selectedRecastItemId) return null;
    const item = inventory.find((e) => e.id === selectedRecastItemId);
    if (!item) return null;
    const { RECAST_SERIES_COST } = require('../types');
    return RECAST_SERIES_COST[item.quality];
  },

  canRecast: () => {
    const { selectedRecastItemId, selectedRecastMaterials, gold, inventory } = get();
    if (!selectedRecastItemId) return false;
    const cost = get().getRecastCost();
    if (!cost) return false;
    if (gold < cost.gold) return false;
    if (selectedRecastMaterials.length !== cost.materials) return false;

    const targetItem = inventory.find((e) => e.id === selectedRecastItemId);
    if (!targetItem) return false;

    for (const matId of selectedRecastMaterials) {
      const mat = inventory.find((e) => e.id === matId);
      if (!mat || mat.quality !== targetItem.quality) return false;
    }

    return true;
  },

  performRecast: (targetSeries) => {
    if (!get().canRecast()) return null;

    const { selectedRecastItemId, selectedRecastMaterials, inventory } = get();
    const cost = get().getRecastCost();
    if (!cost || !selectedRecastItemId) return null;

    const targetItem = inventory.find((e) => e.id === selectedRecastItemId);
    if (!targetItem) return null;

    if (!lsSpendGold(cost.gold)) return null;

    lsRemoveFromInventory(selectedRecastMaterials);

    const newItem = recastSeries(targetItem, targetSeries);
    lsUpdateInInventory(newItem);

    try {
      const ach = useAchievementStore.getState();
      ach.recordEquipmentRecast(targetItem.quality);
    } catch { /* non-critical */ }

    const data = loadEquipmentSave();
    set({
      gold: data.gold,
      inventory: data.inventory,
      selectedRecastItemId: null,
      selectedRecastMaterials: [],
    });

    return newItem;
  },
}));
