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
} from '../utils/runeEquipment';
import { useAchievementStore } from './useAchievementStore';

interface EquipmentState {
  gold: number;
  inventory: RuneEquipment[];
  equipped: Partial<Record<ElementType, (string | null)[]>>;
  highestLevel: number;
  selectedUpgradeItems: string[];
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
}

export type EquipmentStore = EquipmentState & EquipmentActions;

export const useEquipmentStore = create<EquipmentStore>((set, get) => ({
  gold: 0,
  inventory: [],
  equipped: {},
  highestLevel: 1,
  selectedUpgradeItems: [],

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
}));
