import type { EnergyPool, Enemy, GameState, CombatUnit, TowerSaveData, TowerBlessingType } from '../types';
import type { EquipmentSaveData } from '../types';
import type { ElementType } from '../types';

const STORAGE_KEY = 'rune-chess-save';
const EQUIPMENT_STORAGE_KEY = 'rune-chess-equipment';
const TOWER_STORAGE_KEY = 'rune-chess-tower';

export interface SaveData {
  unlockedLevels: number[];
  highestLevel: number;
  levelStars: Record<number, number>;
  currentBattle: {
    levelId: number;
    playerHp: number;
    playerMaxHp: number;
    playerShield: number;
    energy: EnergyPool;
    enemy: Enemy;
    enemyUnits: CombatUnit[];
    selectedTargetId: string | null;
    turn: number;
    comboSpellCooldowns: Record<string, number>;
  } | null;
}

const defaultSaveData: SaveData = {
  unlockedLevels: [1],
  highestLevel: 1,
  levelStars: {},
  currentBattle: null,
};

export const loadSaveData = (): SaveData => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      const parsed = JSON.parse(data);
      if (!parsed.levelStars) {
        parsed.levelStars = {};
      }
      return parsed;
    }
  } catch (error) {
    console.error('Failed to load save data:', error);
  }
  return { ...defaultSaveData };
};

export const saveSaveData = (data: SaveData): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Failed to save data:', error);
  }
};

export const saveBattleProgress = (state: GameState): void => {
  if (!state.currentLevelId || !state.enemy) return;
  
  const saveData = loadSaveData();
  saveData.currentBattle = {
    levelId: state.currentLevelId,
    playerHp: state.playerHp,
    playerMaxHp: state.playerMaxHp,
    playerShield: (state as any).playerShield || 0,
    energy: state.energy,
    enemy: state.enemy,
    enemyUnits: state.enemyUnits,
    selectedTargetId: state.selectedTargetId,
    turn: state.turn,
    comboSpellCooldowns: state.comboSpellCooldowns || {},
  };
  saveSaveData(saveData);
};

export const clearBattleProgress = (): void => {
  const saveData = loadSaveData();
  saveData.currentBattle = null;
  saveSaveData(saveData);
};

export const unlockLevel = (levelId: number): void => {
  const saveData = loadSaveData();
  if (!saveData.unlockedLevels.includes(levelId)) {
    saveData.unlockedLevels.push(levelId);
    saveData.unlockedLevels.sort((a, b) => a - b);
  }
  if (levelId > saveData.highestLevel) {
    saveData.highestLevel = levelId;
  }
  saveSaveData(saveData);
};

export const getUnlockedLevels = (): number[] => {
  return loadSaveData().unlockedLevels;
};

export const getHighestLevel = (): number => {
  return loadSaveData().highestLevel;
};

export const getCurrentBattle = (): SaveData['currentBattle'] => {
  return loadSaveData().currentBattle;
};

export const saveLevelStars = (levelId: number, stars: number): void => {
  const saveData = loadSaveData();
  const currentStars = saveData.levelStars[levelId] || 0;
  if (stars > currentStars) {
    saveData.levelStars[levelId] = stars;
    saveSaveData(saveData);
  }
};

export const getLevelStars = (levelId: number): number => {
  return loadSaveData().levelStars[levelId] || 0;
};

export const getAllLevelStars = (): Record<number, number> => {
  return loadSaveData().levelStars;
};

const defaultEquipmentSave: EquipmentSaveData = {
  gold: 0,
  inventory: [],
  equipped: {},
  highestLevel: 1,
};

export const loadEquipmentSave = (): EquipmentSaveData => {
  try {
    const data = localStorage.getItem(EQUIPMENT_STORAGE_KEY);
    if (data) {
      const parsed = JSON.parse(data);
      const result = { ...defaultEquipmentSave, ...parsed };
      if (result.inventory) {
        result.inventory = result.inventory.map((item: any) => {
          if (!item.series) {
            const seriesOptions = ['blaze', 'frost', 'storm', 'earth'];
            item.series = seriesOptions[Math.floor(Math.random() * seriesOptions.length)];
          }
          return item;
        });
      }
      return result;
    }
  } catch (error) {
    console.error('Failed to load equipment data:', error);
  }
  return { ...defaultEquipmentSave };
};

export const saveEquipmentSave = (data: EquipmentSaveData): void => {
  try {
    localStorage.setItem(EQUIPMENT_STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Failed to save equipment data:', error);
  }
};

export const addGold = (amount: number): number => {
  const data = loadEquipmentSave();
  data.gold += amount;
  saveEquipmentSave(data);
  return data.gold;
};

export const spendGold = (amount: number): boolean => {
  const data = loadEquipmentSave();
  if (data.gold < amount) return false;
  data.gold -= amount;
  saveEquipmentSave(data);
  return true;
};

export const getGold = (): number => {
  return loadEquipmentSave().gold;
};

export const addToInventory = (equipment: EquipmentSaveData['inventory']): void => {
  const data = loadEquipmentSave();
  data.inventory = [...data.inventory, ...equipment];
  saveEquipmentSave(data);
};

export const removeFromInventory = (ids: string[]): void => {
  const data = loadEquipmentSave();
  const idSet = new Set(ids);
  data.inventory = data.inventory.filter((e) => !idSet.has(e.id));
  saveEquipmentSave(data);
};

export const updateInInventory = (equipment: EquipmentSaveData['inventory'][0]): void => {
  const data = loadEquipmentSave();
  const idx = data.inventory.findIndex((e) => e.id === equipment.id);
  if (idx >= 0) {
    data.inventory[idx] = equipment;
    saveEquipmentSave(data);
  }
};

export const equipItem = (element: ElementType, slotIndex: number, equipmentId: string | null): void => {
  const data = loadEquipmentSave();
  if (!data.equipped[element]) {
    data.equipped[element] = [];
  }
  const arr = data.equipped[element]!;
  while (arr.length <= slotIndex) arr.push(null);

  const prevId = arr[slotIndex];
  if (prevId) {
    const prevItem = data.inventory.find((e) => e.id === prevId);
    if (!prevItem) {
      data.inventory = data.inventory.filter((e) => e.id !== prevId);
    }
  }

  arr[slotIndex] = equipmentId;
  saveEquipmentSave(data);
};

export const unequipItem = (element: ElementType, slotIndex: number): void => {
  const data = loadEquipmentSave();
  if (!data.equipped[element]) return;
  const arr = data.equipped[element]!;
  if (slotIndex < arr.length) {
    arr[slotIndex] = null;
  }
  saveEquipmentSave(data);
};

export const getEquippedItems = (): EquipmentSaveData['inventory'] => {
  const data = loadEquipmentSave();
  const equippedIds: string[] = [];
  for (const el of Object.values(data.equipped)) {
    if (el) {
      for (const id of el) {
        if (id) equippedIds.push(id);
      }
    }
  }
  return data.inventory.filter((e) => equippedIds.includes(e.id));
};

export const updateEquipmentHighestLevel = (highestLevel: number): void => {
  const data = loadEquipmentSave();
  if (highestLevel > data.highestLevel) {
    data.highestLevel = highestLevel;
    saveEquipmentSave(data);
  }
};

const defaultTowerSave: TowerSaveData = {
  highestFloor: 0,
  unlockedBlessings: [],
  totalGoldEarned: 0,
  bossKills: 0,
  currentRun: null,
};

export const loadTowerSave = (): TowerSaveData => {
  try {
    const data = localStorage.getItem(TOWER_STORAGE_KEY);
    if (data) {
      return { ...defaultTowerSave, ...JSON.parse(data) };
    }
  } catch (error) {
    console.error('Failed to load tower save data:', error);
  }
  return { ...defaultTowerSave };
};

export const saveTowerSave = (data: TowerSaveData): void => {
  try {
    localStorage.setItem(TOWER_STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Failed to save tower data:', error);
  }
};

export const clearTowerCurrentRun = (): void => {
  const data = loadTowerSave();
  data.currentRun = null;
  saveTowerSave(data);
};

export const updateHighestFloor = (floor: number): void => {
  const data = loadTowerSave();
  if (floor > data.highestFloor) {
    data.highestFloor = floor;
    saveTowerSave(data);
  }
};

export const unlockBlessing = (blessingType: TowerBlessingType): void => {
  const data = loadTowerSave();
  if (!data.unlockedBlessings.includes(blessingType)) {
    data.unlockedBlessings.push(blessingType);
    saveTowerSave(data);
  }
};

export const getUnlockedBlessings = (): TowerBlessingType[] => {
  return loadTowerSave().unlockedBlessings;
};

export const getTowerHighestFloor = (): number => {
  return loadTowerSave().highestFloor;
};
