import { create } from 'zustand';
import type { 
  TowerStore, 
  TowerFloor, 
  Enemy, 
  TowerDebuff, 
  TowerBlessing, 
  TowerBlessingType,
  TowerDebuffType,
  SpecialTileConfig,
  TowerThemeType,
  TowerTheme,
  TowerBranchChoiceType,
  TowerBranchChoice,
  TowerBranchEffect,
  TowerEnding,
  TowerEndingType,
  TowerNarrative,
  TowerFloorNarrative,
  TowerFloorNarrativeEvent,
  TowerCampStoryEvent,
  TowerNarrativeChoice,
} from '../types';
import { 
  TOWER_DEBUFFS, 
  TOWER_BLESSINGS, 
  TOWER_TOTAL_FLOORS, 
  TOWER_CAMP_INTERVAL, 
  TOWER_BOSS_INTERVAL,
  TOWER_THEME_INTERVAL,
  TOWER_THEMES,
  TOWER_NARRATIVES,
  TOWER_ENDINGS,
  getThemeForFloor,
  getNarrativeForTheme,
  DEFAULT_BEHAVIOR_STATE,
  BLESSING_RARITY_WEIGHTS,
} from '../types';
import towerThemeEnemiesData from '../data/towerThemeEnemies.json';
import towerFloorNarrativesData from '../data/towerFloorNarratives.json';
import {
  loadTowerSave,
  saveTowerSave,
  clearTowerCurrentRun,
  unlockBlessing as saveUnlockedBlessing,
  updateHighestFloor as saveHighestFloor,
} from '../utils/localStorage';
import { useAchievementStore } from './useAchievementStore';

const towerThemeEnemies = towerThemeEnemiesData as Array<Omit<Enemy, 'type' | 'currentHp' | 'currentAttackIndex' | 'behaviorState' | 'behaviorLogs' | 'statusEffects' | 'isTargetable' | 'isSelected'> & { theme: TowerThemeType; enemyType: string }>;

const floorNarratives = towerFloorNarrativesData as TowerFloorNarrative[];

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

interface BranchEffectState {
  critChance: number;
  regenPerTurn: number;
  goldMultiplier: number;
  damageMultiplier: number;
  difficultyMultiplier: number;
  energyGain: number;
  companion: string | null;
  debuffImmune: TowerDebuffType[];
  shieldPerTurn: number;
  startShield: number;
}

const DEFAULT_BRANCH_EFFECTS: BranchEffectState = {
  critChance: 0,
  regenPerTurn: 0,
  goldMultiplier: 0,
  damageMultiplier: 0,
  difficultyMultiplier: 0,
  energyGain: 0,
  companion: null,
  debuffImmune: [],
  shieldPerTurn: 0,
  startShield: 0,
};

const MAX_CONSECUTIVE_SAME_DEBUFF = 2;

const createEnemyFromTowerData = (
  enemyData: typeof towerThemeEnemies[0], 
  floor: number, 
  isBoss: boolean,
  isElite: boolean,
  isEnraged: boolean,
  difficultyMultiplier: number = 0
): Enemy => {
  const scaleFactor = 1 + (floor - 1) * 0.08;
  const bossScale = isBoss ? 1.5 : 1;
  const eliteScale = isElite ? 1.25 : 1;
  const enrageScale = isEnraged ? 1.3 : 1;
  const diffScale = 1 + difficultyMultiplier;
  
  return {
    ...enemyData,
    id: `${enemyData.id}_${floor}_${Date.now()}`,
    type: 'enemy',
    maxHp: Math.floor(enemyData.maxHp * scaleFactor * bossScale * eliteScale * diffScale),
    currentHp: Math.floor(enemyData.maxHp * scaleFactor * bossScale * eliteScale * diffScale),
    attack: Math.floor(enemyData.attack * scaleFactor * bossScale * eliteScale * enrageScale * diffScale),
    attackPattern: enemyData.attackPattern.map(dmg => 
      Math.floor(dmg * scaleFactor * bossScale * eliteScale * enrageScale * diffScale)
    ),
    currentAttackIndex: 0,
    statusEffects: [],
    behaviorState: JSON.parse(JSON.stringify(DEFAULT_BEHAVIOR_STATE)),
    behaviorLogs: [],
    isTargetable: true,
    isSelected: false,
  };
};

const getEnemiesForTheme = (theme: TowerThemeType, includeBoss: boolean = false, includeElite: boolean = false) => {
  return towerThemeEnemies.filter(e => {
    const isBoss = e.id.startsWith('boss_');
    const isElite = e.id.startsWith('elite_');
    if (e.theme !== theme) return false;
    if (isBoss) return includeBoss;
    if (isElite) return includeElite;
    return !includeBoss && !includeElite;
  });
};

const getNarrativeForFloor = (theme: TowerThemeType, floorInTheme: number): TowerFloorNarrative | undefined => {
  return floorNarratives.find(n => n.theme === theme && n.floorInTheme === floorInTheme);
};

const getFloorInTheme = (floor: number): number => {
  const theme = getThemeForFloor(floor);
  return floor - theme.startFloor + 1;
};

const getCampIndexInTheme = (floor: number): number => {
  const theme = getThemeForFloor(floor);
  const floorInTheme = floor - theme.startFloor + 1;
  const campFloorsInTheme: number[] = [];
  for (let f = 1; f <= 10; f++) {
    const globalFloor = theme.startFloor + f - 1;
    const isBoss = globalFloor % TOWER_BOSS_INTERVAL === 0;
    const isCamp = !isBoss && globalFloor > 1 && (globalFloor - 1) % TOWER_CAMP_INTERVAL === 0;
    if (isCamp) campFloorsInTheme.push(f);
  }
  return campFloorsInTheme.indexOf(floorInTheme);
};

const getDebuffPoolForTheme = (theme: TowerTheme, hasEnrageBlessing: boolean): TowerDebuff[] => {
  let pool = TOWER_DEBUFFS;
  
  if (!hasEnrageBlessing) {
    pool = pool.filter(d => d.type !== 'enrage_enemy');
  }
  
  if (theme.bannedElements && theme.bannedElements.length > 0) {
    const bannedDebuffs = theme.bannedElements.map(el => `no_${el}_rune` as TowerDebuffType);
    pool = pool.filter(d => !bannedDebuffs.includes(d.type));
  }
  
  const charDebuffs = theme.characteristicDebuffs;
  const charWeight = 2;
  const weightedPool: TowerDebuff[] = [];
  
  pool.forEach(d => {
    weightedPool.push(d);
    if (charDebuffs.includes(d.type)) {
      for (let i = 1; i < charWeight; i++) {
        weightedPool.push(d);
      }
    }
  });
  
  return weightedPool;
};

const generateFloor = (
  floor: number, 
  playerBlessings: TowerBlessingType[],
  consecutiveDebuffTypes: TowerDebuffType[] = [],
  branchEffects: BranchEffectState = DEFAULT_BRANCH_EFFECTS
): TowerFloor => {
  const isBoss = floor % TOWER_BOSS_INTERVAL === 0;
  const isCamp = !isBoss && floor > 1 && (floor - 1) % TOWER_CAMP_INTERVAL === 0;
  const isThemeTransition = floor > 1 && (floor - 1) % TOWER_THEME_INTERVAL === 0;
  
  const theme = getThemeForFloor(floor);
  const isBranchCamp = isCamp && isThemeTransition;
  const floorInTheme = getFloorInTheme(floor);
  
  const narrative = getNarrativeForFloor(theme.type, floorInTheme);
  
  if (isCamp) {
    let campNarrative: TowerCampStoryEvent | undefined;
    if (narrative && narrative.campEvents && narrative.campEvents.length > 0) {
      const campIndex = getCampIndexInTheme(floor);
      campNarrative = narrative.campEvents.find(ce => ce.campIndex === campIndex) || narrative.campEvents[0];
    }
    
    return {
      floor,
      enemy: null as unknown as Enemy,
      debuffs: [],
      floorBlessings: [],
      isBoss: false,
      isCamp: true,
      isBranchCamp,
      theme: theme.type,
      goldReward: 0,
      campNarrative,
    };
  }
  
  const isElite = !isBoss && floorInTheme === 5;
  
  const normalPool = getEnemiesForTheme(theme.type, false, false);
  const elitePool = getEnemiesForTheme(theme.type, false, true);
  const bossPool = getEnemiesForTheme(theme.type, true, false);
  
  let enemyData: typeof towerThemeEnemies[0];
  
  if (isBoss) {
    enemyData = bossPool[0];
  } else if (isElite && elitePool.length > 0) {
    enemyData = elitePool[0];
  } else {
    enemyData = normalPool[Math.floor(Math.random() * normalPool.length)];
  }
  
  const debuffCount = isBoss ? 2 : isElite ? 2 : Math.min(1 + Math.floor(floor / 15), 3);
  const hasEnrageBlessing = playerBlessings.includes('thorns');
  let debuffPool = getDebuffPoolForTheme(theme, hasEnrageBlessing);
  
  debuffPool = debuffPool.filter(d => !branchEffects.debuffImmune.includes(d.type));
  
  const recentDebuffCounts: Record<string, number> = {};
  consecutiveDebuffTypes.forEach(type => {
    recentDebuffCounts[type] = (recentDebuffCounts[type] || 0) + 1;
  });
  
  debuffPool = debuffPool.filter(d => {
    const count = recentDebuffCounts[d.type] || 0;
    return count < MAX_CONSECUTIVE_SAME_DEBUFF;
  });
  
  if (debuffPool.length === 0) {
    debuffPool = getDebuffPoolForTheme(theme, hasEnrageBlessing);
    debuffPool = debuffPool.filter(d => !branchEffects.debuffImmune.includes(d.type));
  }
  
  const selectedDebuffs = pickRandom(debuffPool, Math.min(debuffCount, debuffPool.length));
  const uniqueDebuffs = Array.from(new Map(selectedDebuffs.map(d => [d.type, d])).values());
  const isEnraged = uniqueDebuffs.some(d => d.type === 'enrage_enemy');
  
  const enemy = createEnemyFromTowerData(enemyData, floor, isBoss, isElite, isEnraged, branchEffects.difficultyMultiplier);
  
  const floorBlessings: TowerBlessing[] = [];
  if (!isBoss && !isElite && Math.random() < 0.3) {
    floorBlessings.push(pickWeightedBlessing(BLESSING_RARITY_WEIGHTS.floor));
  }
  if (isElite && Math.random() < 0.6) {
    floorBlessings.push(pickWeightedBlessing(BLESSING_RARITY_WEIGHTS.floor));
  }
  
  const baseGold = isBoss ? 150 : isElite ? 80 : 30;
  const goldReward = Math.floor(baseGold * (1 + floor * 0.1) * (1 + branchEffects.goldMultiplier));
  
  let narrativeEvent: TowerFloorNarrativeEvent | undefined;
  let victoryEvent: TowerFloorNarrativeEvent | undefined;
  if (narrative) {
    if (isElite && narrative.enterEvent) {
      narrativeEvent = { ...narrative.enterEvent, type: 'elite_encounter' };
    } else if (narrative.enterEvent) {
      narrativeEvent = narrative.enterEvent;
    }
    if (isBoss && narrative.victoryEvent) {
      victoryEvent = narrative.victoryEvent;
    }
  }
  
  return {
    floor,
    enemy,
    debuffs: uniqueDebuffs,
    floorBlessings,
    isBoss,
    isElite,
    isCamp: false,
    isBranchCamp: false,
    theme: theme.type,
    goldReward,
    narrativeEvent,
    victoryEvent,
  };
};

const getSpecialTilesFromDebuffs = (debuffs: TowerDebuff[]): Partial<SpecialTileConfig> & { excludedElements?: string[] } => {
  const excludedElements: string[] = [];
  let obstacle = 0;
  let frozen = 0;
  let doubleEnergy = 0;
  
  if (debuffs.some(d => d.type === 'no_fire_rune')) excludedElements.push('fire');
  if (debuffs.some(d => d.type === 'no_water_rune')) excludedElements.push('water');
  if (debuffs.some(d => d.type === 'no_grass_rune')) excludedElements.push('grass');
  if (debuffs.some(d => d.type === 'no_thunder_rune')) excludedElements.push('thunder');
  if (debuffs.some(d => d.type === 'darkness_veil')) excludedElements.push('thunder');
  
  if (debuffs.some(d => d.type === 'vines_entangle')) frozen += 2;
  if (debuffs.some(d => d.type === 'void_corruption')) {
    const elements = ['fire', 'water', 'grass', 'thunder'];
    excludedElements.push(elements[Math.floor(Math.random() * elements.length)]);
  }
  
  return {
    obstacle,
    frozen,
    doubleEnergy,
    excludedElements,
  };
};

const getGridSizeFromDebuffs = (debuffs: TowerDebuff[]): number => {
  return debuffs.some(d => d.type === 'small_grid') ? 5 : 6;
};

const getMaxEnergyFromDebuffs = (debuffs: TowerDebuff[]): number => {
  return debuffs.some(d => d.type === 'half_energy') ? 5 : 10;
};

const determineEnding = (choices: TowerBranchChoiceType[]): TowerEnding | null => {
  let bestMatch: { ending: TowerEnding; score: number } | null = null;
  
  for (const ending of TOWER_ENDINGS) {
    const meetsRequired = ending.requiredChoices.every(c => choices.includes(c));
    const noForbidden = !ending.forbiddenChoices || !ending.forbiddenChoices.some(c => choices.includes(c));
    
    if (!noForbidden) continue;
    
    if (ending.requiredChoices.length === 0) {
      if (!bestMatch) {
        bestMatch = { ending, score: 0 };
      }
      continue;
    }
    
    if (meetsRequired) {
      const score = ending.requiredChoices.length * 10 + 100;
      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { ending, score };
      }
      continue;
    }
    
    const partialMatches = ending.requiredChoices.filter(c => choices.includes(c)).length;
    if (partialMatches > 0) {
      const score = partialMatches * 5;
      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { ending, score };
      }
    }
  }
  
  return bestMatch ? bestMatch.ending : null;
};

interface ExtendedTowerState {
  currentTheme: TowerThemeType;
  branchChoices: TowerBranchChoiceType[];
  branchEffects: BranchEffectState;
  branchChoicesMade: boolean[];
  currentEnding: TowerEnding | null;
  showNarrative: boolean;
  narrativePhase: 'intro' | 'branch' | 'boss_intro' | 'boss_victory' | 'floor_event' | 'camp_story' | 'elite_intro' | null;
  currentNarrativeText: string;
  currentNarrativeTitle: string;
  currentBranchChoices: TowerBranchChoice[];
  currentNarrativeChoices: TowerNarrativeChoice[];
  triggeredNarrativeEvents: string[];
  currentCampNarrative: TowerCampStoryEvent | null;
  narrativeResultText: string;
}

interface ExtendedTowerActions {
  getCurrentTheme: () => TowerTheme;
  getCurrentNarrative: () => TowerNarrative;
  makeBranchChoice: (choice: TowerBranchChoice) => void;
  makeNarrativeChoice: (choice: TowerNarrativeChoice) => void;
  applyBranchEffect: (effect: TowerBranchEffect) => void;
  calculateDamage: (baseDamage: number) => number;
  getEnding: () => TowerEnding | null;
  proceedFromNarrative: () => void;
  showThemeIntro: () => void;
  showBossIntro: () => void;
  showBossVictory: () => void;
  showVictoryNarrative: (event: TowerFloorNarrativeEvent) => void;
  showFloorNarrative: (event: TowerFloorNarrativeEvent) => void;
  showCampNarrative: (event: TowerCampStoryEvent) => void;
  getBranchChoicesForCurrentCamp: () => TowerBranchChoice[];
  hasMadeChoiceForTheme: (themeIndex: number) => boolean;
  getCritChance: () => number;
  getRegenPerTurn: () => number;
  getDamageMultiplier: () => number;
  getShieldPerTurn: () => number;
  getStartShield: () => number;
}

export const useTowerStore = create<TowerStore & ExtendedTowerState & ExtendedTowerActions>((set, get) => ({
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
  
  currentTheme: 'dungeon',
  branchChoices: [],
  branchEffects: { ...DEFAULT_BRANCH_EFFECTS },
  branchChoicesMade: [false, false, false, false, false],
  currentEnding: null,
  showNarrative: false,
  narrativePhase: null,
  currentNarrativeText: '',
  currentNarrativeTitle: '',
  currentBranchChoices: [],
  currentNarrativeChoices: [],
  triggeredNarrativeEvents: [],
  currentCampNarrative: null,
  narrativeResultText: '',

  init: () => {
    const saveData = loadTowerSave();
    set({
      highestFloor: saveData.highestFloor,
      unlockedBlessings: saveData.unlockedBlessings,
      totalGoldEarned: saveData.totalGoldEarned,
      bossKills: saveData.bossKills,
    });
  },

  getCurrentTheme: () => {
    return getThemeForFloor(get().currentFloor);
  },

  getCurrentNarrative: () => {
    const theme = get().getCurrentTheme();
    return getNarrativeForTheme(theme.type);
  },

  startRun: () => {
    const startHp = 100;
    const startBlessings: TowerBlessingType[] = [];
    const firstFloor = generateFloor(1, startBlessings, [], DEFAULT_BRANCH_EFFECTS);
    
    let shield = 0;
    if (startBlessings.includes('start_with_shield')) {
      shield = 15;
    }
    
    const theme = getThemeForFloor(1);
    const narrative = getNarrativeForTheme(theme.type);
    
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
      currentTheme: theme.type,
      branchChoices: [],
      branchEffects: { ...DEFAULT_BRANCH_EFFECTS },
      branchChoicesMade: [false, false, false, false, false],
      currentEnding: null,
      showNarrative: true,
      narrativePhase: 'intro',
      currentNarrativeText: narrative.introText,
      currentNarrativeTitle: narrative.title,
      currentBranchChoices: [],
      currentNarrativeChoices: [],
      triggeredNarrativeEvents: [],
      currentCampNarrative: null,
      narrativeResultText: '',
    });
  },

  showThemeIntro: () => {
    const narrative = get().getCurrentNarrative();
    set({
      showNarrative: true,
      narrativePhase: 'intro',
      currentNarrativeText: narrative.introText,
      currentNarrativeTitle: narrative.title,
      currentNarrativeChoices: [],
      narrativeResultText: '',
    });
  },

  showBossIntro: () => {
    const narrative = get().getCurrentNarrative();
    set({
      showNarrative: true,
      narrativePhase: 'boss_intro',
      currentNarrativeText: narrative.bossIntro,
      currentNarrativeTitle: 'BOSS出现',
      currentNarrativeChoices: [],
      narrativeResultText: '',
    });
  },

  showBossVictory: () => {
    const narrative = get().getCurrentNarrative();
    set({
      showNarrative: true,
      narrativePhase: 'boss_victory',
      currentNarrativeText: narrative.bossVictoryText,
      currentNarrativeTitle: 'BOSS击败',
      currentNarrativeChoices: [],
      narrativeResultText: '',
    });
  },

  showVictoryNarrative: (event: TowerFloorNarrativeEvent) => {
    set({
      showNarrative: true,
      narrativePhase: 'boss_victory',
      currentNarrativeText: event.text,
      currentNarrativeTitle: event.title,
      currentNarrativeChoices: event.choices || [],
      narrativeResultText: '',
    });
  },

  showFloorNarrative: (event: TowerFloorNarrativeEvent) => {
    const { triggeredNarrativeEvents } = get();
    if (triggeredNarrativeEvents.includes(event.id)) return;
    
    const phase = event.type === 'elite_encounter' ? 'elite_intro' : 'floor_event';
    set({
      showNarrative: true,
      narrativePhase: phase,
      currentNarrativeText: event.text,
      currentNarrativeTitle: event.title,
      currentNarrativeChoices: event.choices || [],
      triggeredNarrativeEvents: [...triggeredNarrativeEvents, event.id],
      narrativeResultText: '',
    });
  },

  showCampNarrative: (event: TowerCampStoryEvent) => {
    set({
      showNarrative: true,
      narrativePhase: 'camp_story',
      currentNarrativeText: event.text,
      currentNarrativeTitle: event.title,
      currentNarrativeChoices: event.choices || [],
      currentCampNarrative: event,
      narrativeResultText: '',
    });
  },

  getBranchChoicesForCurrentCamp: () => {
    const narrative = get().getCurrentNarrative();
    return narrative.branchChoices;
  },

  hasMadeChoiceForTheme: (themeIndex: number) => {
    return get().branchChoicesMade[themeIndex] || false;
  },

  proceedFromNarrative: () => {
    const { narrativePhase, currentFloor, currentFloorData } = get();
    
    if (narrativePhase === 'intro') {
      set({
        showNarrative: false,
        narrativePhase: null,
        narrativeResultText: '',
      });
    } else if (narrativePhase === 'boss_intro') {
      set({
        showNarrative: false,
        narrativePhase: null,
        battleStatus: 'playing',
        narrativeResultText: '',
      });
    } else if (narrativePhase === 'boss_victory') {
      const themeIndex = Math.floor((currentFloor - 1) / TOWER_THEME_INTERVAL);
      const narrative = get().getCurrentNarrative();
      
      set({
        showNarrative: true,
        narrativePhase: 'branch',
        currentNarrativeText: narrative.campTexts[0] || '',
        currentNarrativeTitle: narrative.title,
        currentBranchChoices: narrative.branchChoices,
        branchChoicesMade: get().branchChoicesMade.map((v, i) => i === themeIndex ? false : v),
        narrativeResultText: '',
      });
    } else if (narrativePhase === 'floor_event' || narrativePhase === 'elite_intro') {
      set({
        showNarrative: false,
        narrativePhase: null,
        battleStatus: 'playing',
        narrativeResultText: '',
      });
    } else if (narrativePhase === 'camp_story') {
      set({
        showNarrative: false,
        narrativePhase: null,
        narrativeResultText: '',
      });
    }
  },

  makeBranchChoice: (choice: TowerBranchChoice) => {
    const { currentFloor, branchChoices, branchChoicesMade } = get();
    const themeIndex = Math.floor((currentFloor - 1) / TOWER_THEME_INTERVAL);
    
    get().applyBranchEffect(choice.effect);
    
    if (choice.effect.blessingType && !get().currentBlessings.includes(choice.effect.blessingType)) {
      set(state => ({
        currentBlessings: [...state.currentBlessings, choice.effect.blessingType!],
      }));
      saveUnlockedBlessing(choice.effect.blessingType);
    }
    
    set({
      branchChoices: [...branchChoices, choice.id],
      branchChoicesMade: branchChoicesMade.map((v, i) => i === themeIndex ? true : v),
      showNarrative: false,
      narrativePhase: null,
      battleStatus: 'camp',
      narrativeResultText: choice.narrativeText,
    });
  },

  makeNarrativeChoice: (choice: TowerNarrativeChoice) => {
    get().applyBranchEffect(choice.effect as TowerBranchEffect);
    
    if (choice.effect.blessingType && !get().currentBlessings.includes(choice.effect.blessingType as TowerBlessingType)) {
      set(state => ({
        currentBlessings: [...state.currentBlessings, choice.effect.blessingType as TowerBlessingType],
      }));
      saveUnlockedBlessing(choice.effect.blessingType as TowerBlessingType);
    }
    
    if (choice.effect.debuffImmune) {
      set(state => ({
        branchEffects: {
          ...state.branchEffects,
          debuffImmune: [...state.branchEffects.debuffImmune, ...choice.effect.debuffImmune! as TowerDebuffType[]],
        },
      }));
    }
    
    set({
      narrativeResultText: choice.resultText,
      currentNarrativeChoices: [],
    });
  },

  applyBranchEffect: (effect: TowerBranchEffect) => {
    const { branchEffects, playerMaxHp, playerHp, playerShield } = get();
    
    const newEffects = { ...branchEffects };
    let newMaxHp = playerMaxHp;
    let newHp = playerHp;
    let newShield = playerShield;
    
    if (effect.playerMaxHp !== undefined) {
      newMaxHp = Math.max(20, newMaxHp + effect.playerMaxHp);
      newHp = Math.min(newHp, newMaxHp);
    }
    
    if (effect.playerHp !== undefined) {
      newHp = Math.max(1, newHp + effect.playerHp);
    }
    
    if (effect.playerShield !== undefined) {
      newShield = Math.max(0, newShield + effect.playerShield);
    }
    
    if (effect.critChance !== undefined) newEffects.critChance += effect.critChance;
    if (effect.regenPerTurn !== undefined) newEffects.regenPerTurn += effect.regenPerTurn;
    if (effect.goldMultiplier !== undefined) newEffects.goldMultiplier += effect.goldMultiplier;
    if (effect.damageMultiplier !== undefined) newEffects.damageMultiplier += effect.damageMultiplier;
    if (effect.difficultyMultiplier !== undefined) newEffects.difficultyMultiplier += effect.difficultyMultiplier;
    if (effect.energyGain !== undefined) newEffects.energyGain += effect.energyGain;
    if (effect.companion !== undefined) newEffects.companion = effect.companion;
    if (effect.shieldPerTurn !== undefined) newEffects.shieldPerTurn += effect.shieldPerTurn;
    if (effect.startShield !== undefined) newEffects.startShield += effect.startShield;
    if (effect.debuffImmune !== undefined) {
      newEffects.debuffImmune = [...newEffects.debuffImmune, ...effect.debuffImmune];
    }
    
    set({
      branchEffects: newEffects,
      playerMaxHp: newMaxHp,
      playerHp: newHp,
      playerShield: newShield,
    });
  },

  calculateDamage: (baseDamage: number) => {
    const { branchEffects } = get();
    let damage = baseDamage * (1 + branchEffects.damageMultiplier);
    
    if (Math.random() * 100 < branchEffects.critChance) {
      damage *= 1.5;
    }
    
    return Math.floor(damage);
  },

  getCritChance: () => get().branchEffects.critChance,
  getRegenPerTurn: () => get().branchEffects.regenPerTurn,
  getDamageMultiplier: () => get().branchEffects.damageMultiplier,
  getShieldPerTurn: () => get().branchEffects.shieldPerTurn,
  getStartShield: () => get().branchEffects.startShield,

  prepareBattle: () => {
    const { currentFloorData } = get();
    if (!currentFloorData || currentFloorData.isCamp) return;
    
    if (currentFloorData.narrativeEvent) {
      get().showFloorNarrative(currentFloorData.narrativeEvent);
      return;
    }
    
    if (currentFloorData.isBoss) {
      get().showBossIntro();
    } else {
      set({ battleStatus: 'playing' });
    }
  },

  getGridSize: () => {
    const { currentFloorData } = get();
    if (!currentFloorData) return 6;
    return getGridSizeFromDebuffs(currentFloorData.debuffs);
  },

  getMaxEnergy: () => {
    const { currentFloorData, branchEffects } = get();
    if (!currentFloorData) return 10;
    const base = getMaxEnergyFromDebuffs(currentFloorData.debuffs);
    return base + branchEffects.energyGain;
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
    const regenBonus = get().branchEffects.regenPerTurn;
    const actualHeal = Math.floor((amount + regenBonus) * healMult);
    set(state => ({
      playerHp: Math.min(state.playerMaxHp, state.playerHp + actualHeal),
    }));
  },

  damagePlayer: (damage: number) => {
    const actualDamage = get().applyShieldDamage(damage);
    
    set(state => {
      const newHp = Math.max(0, state.playerHp - actualDamage);
      if (newHp <= 0) {
        return { playerHp: 0, battleStatus: 'defeat' };
      }
      return { playerHp: newHp };
    });
  },

  gainGold: (amount: number) => {
    const { branchEffects } = get();
    const bonusGold = Math.floor(amount * (1 + branchEffects.goldMultiplier));
    set(state => ({ gold: state.gold + bonusGold }));
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

  getEnding: () => {
    return determineEnding(get().branchChoices);
  },

  completeFloor: () => {
    const { currentFloor, currentFloorData, currentBlessings, gold, playerHp, playerMaxHp, playerShield, consecutiveDebuffTypes, activeDebuffs, branchEffects } = get();
    if (!currentFloorData) return;
    
    try {
      const ach = useAchievementStore.getState();
      ach.recordTowerFloorCleared();
      if (!currentFloorData.isCamp && currentFloorData.enemy) {
        const enemyData = currentFloorData.enemy;
        ach.recordEnemyKilled(enemyData.id);
        ach.recordEnemyKilled(enemyData.name);
      }
    } catch { /* non-critical */ }
    
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
      if (currentFloorData.victoryEvent) {
        get().showVictoryNarrative(currentFloorData.victoryEvent);
      } else {
        get().showBossVictory();
      }
      return;
    }
    
    if (currentFloor >= TOWER_TOTAL_FLOORS) {
      const ending = get().getEnding();
      const endingGold = ending ? ending.goldBonus : 0;
      
      set({ 
        battleStatus: 'victory', 
        gold: newGold + endingGold,
        totalGoldEarned: get().totalGoldEarned + newGold + endingGold,
        currentEnding: ending,
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
    const nextFloorData = generateFloor(nextFloor, currentBlessings, newConsecutiveDebuffTypes, branchEffects);
    
    let newShield = playerShield;
    if (currentBlessings.includes('start_with_shield') && !nextFloorData.isCamp) {
      newShield += 15;
    }
    
    if (currentBlessings.includes('damage_shield') && nextFloor % 3 === 0 && !nextFloorData.isCamp) {
      newShield += 20;
    }
    
    const newHighestFloor = Math.max(get().highestFloor, nextFloor);
    const nextTheme = getThemeForFloor(nextFloor).type;
    
    if (nextFloorData.isBranchCamp) {
      const narrative = getNarrativeForTheme(nextTheme);
      const themeIndex = Math.floor((nextFloor - 1) / TOWER_THEME_INTERVAL);
      const hasMadeChoice = get().hasMadeChoiceForTheme(themeIndex);
      
      set({
        currentFloor: nextFloor,
        currentFloorData: nextFloorData,
        gold: newGold,
        playerShield: newShield,
        highestFloor: newHighestFloor,
        currentTheme: nextTheme,
        totalGoldEarned: get().totalGoldEarned + currentFloorData.goldReward,
        activeDebuffs: nextFloorData.debuffs,
        consecutiveDebuffTypes: nextFloorData.isCamp ? [] : newConsecutiveDebuffTypes,
      });
      
      if (!hasMadeChoice) {
        set({
          showNarrative: true,
          narrativePhase: 'intro',
          currentNarrativeText: narrative.introText,
          currentNarrativeTitle: narrative.title,
          battleStatus: 'preparing',
        });
      } else {
        set({
          battleStatus: 'camp',
        });
      }
    } else {
      set({
        currentFloor: nextFloor,
        currentFloorData: nextFloorData,
        gold: newGold,
        playerShield: newShield,
        highestFloor: newHighestFloor,
        currentTheme: nextTheme,
        battleStatus: nextFloorData.isCamp ? 'camp' : 'preparing',
        totalGoldEarned: get().totalGoldEarned + currentFloorData.goldReward,
        activeDebuffs: nextFloorData.debuffs,
        consecutiveDebuffTypes: nextFloorData.isCamp ? [] : newConsecutiveDebuffTypes,
      });
    }
    
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
    const { currentFloor, currentBlessings, branchEffects } = get();
    const nextFloor = currentFloor + 1;
    const nextFloorData = generateFloor(nextFloor, currentBlessings, [], branchEffects);
    
    let newShield = get().playerShield;
    if (currentBlessings.includes('start_with_shield')) {
      newShield += 15;
    }
    
    const nextTheme = getThemeForFloor(nextFloor).type;
    
    set({
      currentFloor: nextFloor,
      currentFloorData: nextFloorData,
      playerShield: newShield,
      currentTheme: nextTheme,
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
      currentTheme: 'dungeon',
      branchChoices: [],
      branchEffects: { ...DEFAULT_BRANCH_EFFECTS },
      branchChoicesMade: [false, false, false, false, false],
      currentEnding: null,
      showNarrative: false,
      narrativePhase: null,
      currentNarrativeText: '',
      currentNarrativeTitle: '',
      currentBranchChoices: [],
      currentNarrativeChoices: [],
      triggeredNarrativeEvents: [],
      currentCampNarrative: null,
      narrativeResultText: '',
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
      currentTheme: 'dungeon',
      branchChoices: [],
      branchEffects: { ...DEFAULT_BRANCH_EFFECTS },
      branchChoicesMade: [false, false, false, false, false],
      currentEnding: null,
      showNarrative: false,
      narrativePhase: null,
      currentNarrativeText: '',
      currentNarrativeTitle: '',
      currentBranchChoices: [],
      currentNarrativeChoices: [],
      triggeredNarrativeEvents: [],
      currentCampNarrative: null,
      narrativeResultText: '',
    });
  },

  setBattleStatus: (status: 'idle' | 'preparing' | 'playing' | 'victory' | 'defeat' | 'camp') => {
    set({ battleStatus: status });
  },

  setAnimating: (animating: boolean) => {
    set({ isAnimating: animating });
  },
}));
