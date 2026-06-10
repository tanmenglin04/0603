import { create } from 'zustand';
import type { 
  TowerStore, 
  TowerFloor, 
  Enemy, 
  TowerDebuff, 
  TowerBlessing, 
  TowerBlessingType,
  TowerDebuffType,
  SpecialTileConfig
} from '../types';
import { 
  TOWER_DEBUFFS, 
  TOWER_BLESSINGS, 
  TOWER_TOTAL_FLOORS, 
  TOWER_CAMP_INTERVAL, 
  TOWER_BOSS_INTERVAL,
  DEFAULT_BEHAVIOR_STATE,
  BLESSING_RARITY_WEIGHTS
} from '../types';
import towerEnemiesData from '../data/towerEnemies.json';
import {
  loadTowerSave,
  saveTowerSave,
  clearTowerCurrentRun,
  unlockBlessing as saveUnlockedBlessing,
  updateHighestFloor as saveHighestFloor,
} from '../utils/localStorage';

const towerEnemies = towerEnemiesData as Array<Omit<Enemy, 'type' | 'currentHp' | 'currentAttackIndex' | 'behaviorState' | 'behaviorLogs' | 'statusEffects' | 'isTargetable' | 'isSelected'>>;

const pickRandom = <T>(arr: T[], count: number): T[] => {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
};

const pickWeightedBlessing = (weights: [number, number, number]): TowerBlessing => {
  const total = weights.reduce((a, b) => a + b, 0);
  let random = Math.random() * total;
  let rarityIndex = 0;
  
  for (let i = 0; i < weights.length; i++) {
    random -= weights[i];
    if (random <= 0) {
      rarityIndex = i;
      break;
    }
  }
  
  const rarityMap: Record<number, 'common' | 'rare' | 'epic'> = {
    0: 'common',
    1: 'rare',
    2: 'epic',
  };
  
  const rarity = rarityMap[rarityIndex];
  const filtered = TOWER_BLESSINGS.filter(b => b.rarity === rarity);
  return filtered[Math.floor(Math.random() * filtered.length)];
};

const createEnemyFromTowerData = (
  enemyData: typeof towerEnemies[0], 
  floor: number, 
  isBoss: boolean,
  isEnraged: boolean
): Enemy => {
  const scaleFactor = 1 + (floor - 1) * 0.08;
  const bossScale = isBoss ? 1.5 : 1;
  const enrageScale = isEnraged ? 1.3 : 1;
  
  return {
    ...enemyData,
    id: `${enemyData.id}_${floor}_${Date.now()}`,
    type: 'enemy',
    maxHp: Math.floor(enemyData.maxHp * scaleFactor * bossScale),
    currentHp: Math.floor(enemyData.maxHp * scaleFactor * bossScale),
    attack: Math.floor(enemyData.attack * scaleFactor * bossScale * enrageScale),
    attackPattern: enemyData.attackPattern.map(dmg => 
      Math.floor(dmg * scaleFactor * bossScale * enrageScale)
    ),
    currentAttackIndex: 0,
    statusEffects: [],
    behaviorState: JSON.parse(JSON.stringify(DEFAULT_BEHAVIOR_STATE)),
    behaviorLogs: [],
    isTargetable: true,
    isSelected: false,
  };
};

const MAX_CONSECUTIVE_SAME_DEBUFF = 2;

const generateFloor = (
  floor: number, 
  playerBlessings: TowerBlessingType[],
  consecutiveDebuffTypes: TowerDebuffType[] = []
): TowerFloor => {
  const isBoss = floor % TOWER_BOSS_INTERVAL === 0;
  const isCamp = !isBoss && floor > 1 && (floor - 1) % TOWER_CAMP_INTERVAL === 0;
  
  if (isCamp) {
    return {
      floor,
      enemy: null as unknown as Enemy,
      debuffs: [],
      blessings: [],
      isBoss: false,
      isCamp: true,
      goldReward: 0,
    };
  }
  
  let enemyPool = towerEnemies.filter(e => !e.id.startsWith('boss_'));
  if (isBoss) {
    const bossPool = towerEnemies.filter(e => e.id.startsWith('boss_'));
    const bossIndex = Math.min(Math.floor(floor / TOWER_BOSS_INTERVAL) - 1, bossPool.length - 1);
    enemyPool = [bossPool[bossIndex]];
  }
  
  const enemyData = enemyPool[Math.floor(Math.random() * enemyPool.length)];
  const debuffCount = isBoss ? 2 : Math.min(1 + Math.floor(floor / 15), 3);
  
  const hasEnrageDebuff = playerBlessings.includes('thorns');
  let debuffPool = hasEnrageDebuff 
    ? TOWER_DEBUFFS 
    : TOWER_DEBUFFS.filter(d => d.type !== 'enrage_enemy');
  
  const recentDebuffCounts: Record<string, number> = {};
  consecutiveDebuffTypes.forEach(type => {
    recentDebuffCounts[type] = (recentDebuffCounts[type] || 0) + 1;
  });
  
  debuffPool = debuffPool.filter(d => {
    const count = recentDebuffCounts[d.type] || 0;
    return count < MAX_CONSECUTIVE_SAME_DEBUFF;
  });
  
  if (debuffPool.length === 0) {
    debuffPool = hasEnrageDebuff 
      ? TOWER_DEBUFFS 
      : TOWER_DEBUFFS.filter(d => d.type !== 'enrage_enemy');
  }
  
  const selectedDebuffs = pickRandom(debuffPool, Math.min(debuffCount, debuffPool.length));
  const isEnraged = selectedDebuffs.some(d => d.type === 'enrage_enemy');
  
  const enemy = createEnemyFromTowerData(enemyData, floor, isBoss, isEnraged);
  
  const floorBlessings: TowerBlessing[] = [];
  if (!isBoss && Math.random() < 0.3) {
    floorBlessings.push(pickWeightedBlessing(BLESSING_RARITY_WEIGHTS.floor));
  }
  
  const baseGold = isBoss ? 150 : 30;
  const goldReward = Math.floor(baseGold * (1 + floor * 0.1));
  
  return {
    floor,
    enemy,
    debuffs: selectedDebuffs,
    blessings: floorBlessings,
    isBoss,
    isCamp: false,
    goldReward,
  };
};

const getSpecialTilesFromDebuffs = (debuffs: TowerDebuff[]): Partial<SpecialTileConfig> & { excludedElements?: string[] } => {
  const excludedElements: string[] = [];
  
  if (debuffs.some(d => d.type === 'no_fire_rune')) excludedElements.push('fire');
  if (debuffs.some(d => d.type === 'no_water_rune')) excludedElements.push('water');
  if (debuffs.some(d => d.type === 'no_grass_rune')) excludedElements.push('grass');
  if (debuffs.some(d => d.type === 'no_thunder_rune')) excludedElements.push('thunder');
  
  return {
    obstacle: 0,
    frozen: 0,
    doubleEnergy: 0,
    excludedElements,
  };
};

const getGridSizeFromDebuffs = (debuffs: TowerDebuff[]): number => {
  return debuffs.some(d => d.type === 'small_grid') ? 5 : 6;
};

const getMaxEnergyFromDebuffs = (debuffs: TowerDebuff[]): number => {
  return debuffs.some(d => d.type === 'half_energy') ? 5 : 10;
};

export const useTowerStore = create<TowerStore>((set, get) => ({
  isInTower: false,
  currentFloor: 1,
  playerHp: 100,
  playerMaxHp: 100,
  playerShield: 0,
  gold: 0,
  currentBlessings: [],
  currentFloorData: null,
  highestFloor: 1,
  unlockedBlessings: [],
  totalGoldEarned: 0,
  bossKills: 0,
  battleStatus: 'idle',
  isAnimating: false,
  activeDebuffs: [],
  consecutiveDebuffTypes: [],
  shopBlessings: [],

  init: () => {
    const saveData = loadTowerSave();
    set({
      highestFloor: saveData.highestFloor,
      unlockedBlessings: saveData.unlockedBlessings,
      totalGoldEarned: saveData.totalGoldEarned,
      bossKills: saveData.bossKills,
    });
  },

  startRun: () => {
    const startHp = 100;
    const startBlessings: TowerBlessingType[] = [];
    const firstFloor = generateFloor(1, startBlessings, []);
    
    let shield = 0;
    if (startBlessings.includes('start_with_shield')) {
      shield = 15;
    }
    
    set({
      isInTower: true,
      currentFloor: 1,
      playerHp: startHp,
      playerMaxHp: startHp,
      playerShield: shield,
      gold: 0,
      currentBlessings: startBlessings,
      currentFloorData: firstFloor,
      battleStatus: 'preparing',
      isAnimating: false,
      activeDebuffs: firstFloor.debuffs,
      consecutiveDebuffTypes: firstFloor.debuffs.map(d => d.type),
      shopBlessings: [],
    });
  },

  prepareBattle: () => {
    const { currentFloorData } = get();
    if (!currentFloorData || currentFloorData.isCamp) return;
    
    set({ battleStatus: 'playing' });
  },

  getGridSize: () => {
    const { currentFloorData } = get();
    if (!currentFloorData) return 6;
    return getGridSizeFromDebuffs(currentFloorData.debuffs);
  },

  getMaxEnergy: () => {
    const { currentFloorData } = get();
    if (!currentFloorData) return 10;
    return getMaxEnergyFromDebuffs(currentFloorData.debuffs);
  },

  getSpecialTiles: () => {
    const { currentFloorData } = get();
    if (!currentFloorData) return { obstacle: 0, frozen: 0, doubleEnergy: 0 };
    return getSpecialTilesFromDebuffs(currentFloorData.debuffs);
  },

  getHealMultiplier: () => {
    const { currentFloorData } = get();
    if (!currentFloorData) return 1;
    return currentFloorData.debuffs.some(d => d.type === 'low_heal') ? 0.5 : 1;
  },

  hasBlessing: (type: TowerBlessingType) => {
    return get().currentBlessings.includes(type);
  },

  applyShieldDamage: (damage: number): number => {
    const { playerShield } = get();
    if (playerShield <= 0) return damage;
    
    const absorbed = Math.min(playerShield, damage);
    set({ playerShield: playerShield - absorbed });
    return damage - absorbed;
  },

  addShield: (amount: number) => {
    set(state => ({ playerShield: state.playerShield + amount }));
  },

  healPlayer: (amount: number) => {
    const healMult = get().getHealMultiplier();
    const actualHeal = Math.floor(amount * healMult);
    set(state => ({
      playerHp: Math.min(state.playerMaxHp, state.playerHp + actualHeal),
    }));
  },

  damagePlayer: (damage: number) => {
    const actualDamage = get().applyShieldDamage(damage);
    
    if (get().hasBlessing('thorns')) {
      const thornDamage = Math.floor(damage * 0.15);
    }
    
    set(state => {
      const newHp = Math.max(0, state.playerHp - actualDamage);
      if (newHp <= 0) {
        return { playerHp: 0, battleStatus: 'defeat' };
      }
      return { playerHp: newHp };
    });
  },

  gainGold: (amount: number) => {
    set(state => ({ gold: state.gold + amount }));
  },

  buyBlessing: (blessing: TowerBlessing): boolean => {
    const { gold, currentBlessings } = get();
    if (gold < blessing.cost) return false;
    if (currentBlessings.includes(blessing.type)) return false;
    
    set(state => ({
      gold: state.gold - blessing.cost,
      currentBlessings: [...state.currentBlessings, blessing.type],
    }));
    
    saveUnlockedBlessing(blessing.type);
    set(state => ({
      unlockedBlessings: [...new Set([...state.unlockedBlessings, blessing.type])],
    }));
    
    return true;
  },

  restAtCamp: (cost: number): boolean => {
    const { gold, playerHp, playerMaxHp } = get();
    if (gold < cost) return false;
    if (playerHp >= playerMaxHp) return false;
    
    const healAmount = Math.floor(playerMaxHp * 0.3);
    set(state => ({
      gold: state.gold - cost,
      playerHp: Math.min(state.playerMaxHp, state.playerHp + healAmount),
    }));
    return true;
  },

  removeDebuff: (debuffType: TowerDebuffType, cost: number): boolean => {
    const { gold, activeDebuffs } = get();
    if (gold < cost) return false;
    
    const hasDebuff = activeDebuffs.some(d => d.type === debuffType);
    if (!hasDebuff) return false;
    
    const newActiveDebuffs = activeDebuffs.filter(d => d.type !== debuffType);
    
    set(state => ({
      gold: state.gold - cost,
      activeDebuffs: newActiveDebuffs,
    }));
    
    return true;
  },

  completeFloor: () => {
    const { currentFloor, currentFloorData, currentBlessings, gold, playerHp, playerMaxHp, playerShield, consecutiveDebuffTypes, activeDebuffs } = get();
    if (!currentFloorData) return;
    
    const newGold = gold + currentFloorData.goldReward;
    
    if (currentFloorData.floorBlessings && currentFloorData.floorBlessings.length > 0) {
      const floorBlessing = currentFloorData.floorBlessings[0];
      if (!currentBlessings.includes(floorBlessing.type)) {
        set(state => ({
          currentBlessings: [...state.currentBlessings, floorBlessing.type],
        }));
        saveUnlockedBlessing(floorBlessing.type);
      }
    }
    
    if (currentFloorData.isBoss) {
      set(state => ({ bossKills: state.bossKills + 1 }));
    }
    
    if (currentFloor >= TOWER_TOTAL_FLOORS) {
      set({ 
        battleStatus: 'victory', 
        gold: newGold,
        totalGoldEarned: get().totalGoldEarned + newGold,
      });
      saveHighestFloor(TOWER_TOTAL_FLOORS);
      clearTowerCurrentRun();
      return;
    }
    
    const newActiveDebuffs = [...activeDebuffs, ...currentFloorData.debuffs];
    let newConsecutiveDebuffTypes = [...consecutiveDebuffTypes, ...currentFloorData.debuffs.map(d => d.type)];
    
    if (currentFloorData.isCamp) {
      newConsecutiveDebuffTypes = [];
    } else if (newConsecutiveDebuffTypes.length > MAX_CONSECUTIVE_SAME_DEBUFF * 2) {
      newConsecutiveDebuffTypes = newConsecutiveDebuffTypes.slice(-MAX_CONSECUTIVE_SAME_DEBUFF * 2);
    }
    
    const nextFloor = currentFloor + 1;
    const nextFloorData = generateFloor(nextFloor, currentBlessings, newConsecutiveDebuffTypes);
    
    let newShield = playerShield;
    if (currentBlessings.includes('start_with_shield') && !nextFloorData.isCamp) {
      newShield += 15;
    }
    
    if (currentBlessings.includes('damage_shield') && nextFloor % 3 === 0 && !nextFloorData.isCamp) {
      newShield += 20;
    }
    
    const newHighestFloor = Math.max(get().highestFloor, nextFloor);
    
    set({
      currentFloor: nextFloor,
      currentFloorData: nextFloorData,
      gold: newGold,
      playerShield: newShield,
      highestFloor: newHighestFloor,
      battleStatus: nextFloorData.isCamp ? 'camp' : 'preparing',
      totalGoldEarned: get().totalGoldEarned + currentFloorData.goldReward,
      activeDebuffs: nextFloorData.debuffs,
      consecutiveDebuffTypes: nextFloorData.isCamp ? [] : newConsecutiveDebuffTypes,
    });
    
    saveHighestFloor(newHighestFloor);
    saveTowerSave({
      highestFloor: newHighestFloor,
      unlockedBlessings: get().unlockedBlessings,
      totalGoldEarned: get().totalGoldEarned + currentFloorData.goldReward,
      bossKills: get().bossKills,
      currentRun: {
        currentFloor: nextFloor,
        playerHp,
        playerMaxHp,
        gold: newGold,
        blessings: currentBlessings,
        shield: newShield,
      },
    });
  },

  getShopBlessings: (): TowerBlessing[] => {
    const blessings: TowerBlessing[] = [];
    const usedTypes = new Set<string>();
    
    for (let i = 0; i < 3; i++) {
      let blessing = pickWeightedBlessing(BLESSING_RARITY_WEIGHTS.shop);
      let attempts = 0;
      while (usedTypes.has(blessing.type) && attempts < 10) {
        blessing = pickWeightedBlessing(BLESSING_RARITY_WEIGHTS.shop);
        attempts++;
      }
      if (!usedTypes.has(blessing.type)) {
        blessings.push(blessing);
        usedTypes.add(blessing.type);
      }
    }
    
    return blessings;
  },

  continueFromCamp: () => {
    const { currentFloor, currentBlessings } = get();
    const nextFloor = currentFloor + 1;
    const nextFloorData = generateFloor(nextFloor, currentBlessings);
    
    let newShield = get().playerShield;
    if (currentBlessings.includes('start_with_shield')) {
      newShield += 15;
    }
    
    set({
      currentFloor: nextFloor,
      currentFloorData: nextFloorData,
      playerShield: newShield,
      battleStatus: 'preparing',
    });
  },

  handleDefeat: () => {
    const { highestFloor, unlockedBlessings, totalGoldEarned, bossKills } = get();
    clearTowerCurrentRun();
    
    set({
      isInTower: false,
      currentFloor: 1,
      playerHp: 100,
      playerMaxHp: 100,
      playerShield: 0,
      gold: 0,
      currentBlessings: [],
      currentFloorData: null,
      battleStatus: 'idle',
    });
    
    saveTowerSave({
      highestFloor,
      unlockedBlessings,
      totalGoldEarned,
      bossKills,
      currentRun: null,
    });
  },

  exitTower: () => {
    const { highestFloor, unlockedBlessings, totalGoldEarned, bossKills } = get();
    clearTowerCurrentRun();
    
    set({
      isInTower: false,
      currentFloor: 1,
      playerHp: 100,
      playerMaxHp: 100,
      playerShield: 0,
      gold: 0,
      currentBlessings: [],
      currentFloorData: null,
      battleStatus: 'idle',
    });
  },

  setBattleStatus: (status: 'idle' | 'preparing' | 'playing' | 'victory' | 'defeat' | 'camp') => {
    set({ battleStatus: status });
  },

  setAnimating: (animating: boolean) => {
    set({ isAnimating: animating });
  },
}));
