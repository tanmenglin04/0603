export type ElementType = 'fire' | 'water' | 'grass' | 'thunder';

export type ComboElementType = 'fire+grass' | 'water+thunder' | 'fire+water';

export type StatusEffectType = 'burn' | 'paralyze' | 'resistance_down' | 'frozen' | 'thorns' | 'regen';

export type TileType = 'normal' | 'obstacle' | 'frozen' | 'double_energy';

export type TerrainType = 'magma' | 'frost' | 'thorns' | 'storm';

export interface TerrainCell {
  type: TerrainType | null;
  age: number;
  hasSpreadThisTurn?: boolean;
}

export interface TerrainConfig {
  magma: number;
  frost: number;
  thorns: number;
  storm: number;
  magmaSpreadChance?: number;
}

export type EnemyBehaviorType = 'charge' | 'defend' | 'summon' | 'berserk' | 'normal';

export type EnemyAIPriority = 'aggressive' | 'defensive' | 'balanced' | 'tactical';

export interface StatusEffect {
  type: StatusEffectType;
  duration: number;
  value: number;
  source?: string;
}

export interface SummonedMinion {
  id: string;
  name: string;
  maxHp: number;
  currentHp: number;
  attack: number;
  sprite: string;
  turnsUntilExplosion: number;
  explosionDamage: number;
}

export interface ChargeState {
  isCharging: boolean;
  chargeTurnsRemaining: number;
  chargedDamage: number;
  skillName: string;
}

export interface DefenseState {
  isDefending: boolean;
  damageReduction: number;
  attackPenalty: number;
}

export interface EnemyAIConfig {
  priority: EnemyAIPriority;
  enabledBehaviors: EnemyBehaviorType[];
  chargeDamageMultiplier: number;
  defendDamageReduction: number;
  defendAttackPenalty: number;
  summonCooldown: number;
  minionBaseHp: number;
  minionBaseAttack: number;
  minionExplosionDamage: number;
  berserkThreshold: number;
  berserkAttackMultiplier: number;
  berserkSelfDamagePerTurn: number;
}

export interface EnemyBehaviorState {
  currentBehavior: EnemyBehaviorType;
  isBerserk: boolean;
  chargeState: ChargeState;
  defenseState: DefenseState;
  summonedMinions: SummonedMinion[];
  summonCooldownRemaining: number;
  consecutiveNormalAttacks: number;
}

export interface EnemyBehaviorLog {
  type: EnemyBehaviorType;
  message: string;
  turn: number;
}

export interface Rune {
  id: string;
  element: ElementType;
  row: number;
  col: number;
  isSelected: boolean;
  isMatched: boolean;
  isNew: boolean;
  tileType: TileType;
  frozenHitCount: number;
  doubleEnergyTurnsLeft: number;
  burnMarked?: boolean;
  terrainFrozenTurns?: number;
}

export interface EnergyPool {
  fire: number;
  water: number;
  grass: number;
  thunder: number;
}

export interface Spell {
  id: string;
  name: string;
  element: ElementType;
  cost: number;
  damage: number;
  heal: number;
  description: string;
  icon: string;
}

export interface ComboSpell {
  id: string;
  name: string;
  elements: ComboElementType;
  cost: Partial<Record<ElementType, number>>;
  damage: number;
  heal: number;
  effect: StatusEffectType;
  effectValue: number;
  effectDuration: number;
  cooldown: number;
  description: string;
  icon: string;
}

export type CombatUnitType = 'enemy' | 'minion';

export interface CombatUnit {
  id: string;
  type: CombatUnitType;
  name: string;
  maxHp: number;
  currentHp: number;
  attack: number;
  resistance: Partial<Record<ElementType, number>>;
  sprite: string;
  statusEffects: StatusEffect[];
  isTargetable: boolean;
  isSelected: boolean;
}

export interface Enemy extends CombatUnit {
  type: 'enemy';
  attackPattern: number[];
  currentAttackIndex: number;
  description: string;
  aiConfig: EnemyAIConfig;
  behaviorState: EnemyBehaviorState;
  behaviorLogs: EnemyBehaviorLog[];
}

export interface Minion extends CombatUnit {
  type: 'minion';
  attack: number;
  turnsUntilExplosion: number;
  explosionDamage: number;
  masterEnemyId: string;
}

export interface SpecialTileConfig {
  obstacle: number;
  frozen: number;
  doubleEnergy: number;
  doubleEnergyDuration: number;
}

export interface Level {
  id: number;
  name: string;
  description: string;
  enemy: Omit<Enemy, 'currentHp' | 'currentAttackIndex' | 'behaviorState' | 'behaviorLogs' | 'statusEffects' | 'type' | 'isTargetable' | 'isSelected'>;
  playerMaxHp: number;
  maxEnergy: number;
  stars: number[];
  background: string;
  specialTiles: SpecialTileConfig;
  terrain?: Partial<TerrainConfig>;
}

export interface FloatingText {
  id: string;
  text: string;
  x: number;
  y: number;
  color: string;
  createdAt: number;
}

export type BattleStatus = 'idle' | 'playing' | 'victory' | 'defeat';

export interface GameState {
  currentLevelId: number | null;
  playerHp: number;
  playerMaxHp: number;
  playerShield: number;
  energy: EnergyPool;
  maxEnergy: number;
  gridSize: number;
  runeGrid: Rune[][];
  terrainGrid: TerrainCell[][];
  selectedRunes: Rune[];
  enemy: Enemy | null;
  enemyUnits: CombatUnit[];
  selectedTargetId: string | null;
  turn: number;
  isPlayerTurn: boolean;
  battleStatus: BattleStatus;
  unlockedLevels: number[];
  highestLevel: number;
  comboCount: number;
  floatingTexts: FloatingText[];
  isAnimating: boolean;
  screenShake: boolean;
  spellEffect: ElementType | ComboElementType | null;
  comboSpellCooldowns: Record<string, number>;
  battleRecorder: any | null;
  lastReplayData: BattleReplayV2 | null;
  lastReplayShareCards: ShareCardData[];
}

export interface WorkshopLevelConfig {
  levelId: string;
  name: string;
  enemy: Omit<Enemy, 'currentHp' | 'currentAttackIndex' | 'behaviorState' | 'behaviorLogs' | 'statusEffects' | 'type' | 'isTargetable' | 'isSelected'>;
  playerMaxHp: number;
  maxEnergy: number;
  gridSize: number;
  specialTiles: SpecialTileConfig;
  terrain?: Partial<TerrainConfig>;
}

export interface GameActions {
  initLevel: (levelId: number) => void;
  initWorkshopLevel: (config: WorkshopLevelConfig) => void;
  selectRune: (rune: Rune) => void;
  addSelectedRune: (rune: Rune) => void;
  clearSelectedRunes: () => void;
  confirmMatch: () => void;
  castSpell: (spell: Spell) => void;
  castComboSpell: (spell: ComboSpell) => void;
  endTurn: () => void;
  enemyAttack: () => void;
  addFloatingText: (text: string, x: number, y: number, color: string) => void;
  removeFloatingText: (id: string) => void;
  saveProgress: () => void;
  loadProgress: () => void;
  resetBattle: () => void;
  returnToMenu: () => void;
  setScreenShake: (shake: boolean) => void;
  setSpellEffect: (element: ElementType | ComboElementType | null) => void;
  notifyVictory: (levelName: string) => void;
  decrementCooldowns: () => void;
  applyStatusEffects: () => void;
  selectTarget: (unitId: string) => void;
  damageUnit: (unitId: string, damage: number) => void;
  addMinion: (minion: Minion) => void;
  removeMinion: (minionId: string) => void;
  updateMinion: (minionId: string, updates: Partial<Minion>) => void;
  processTerrainEffects: () => void;
  saveCurrentReplay: () => boolean;
  getLastReplay: () => BattleReplayV2 | null;
  addShield: (amount: number) => void;
  damagePlayer: (damage: number) => number;
}

export type GameStore = GameState & GameActions;

export type TowerBattleStatus = 'idle' | 'preparing' | 'playing' | 'victory' | 'defeat' | 'camp';

export interface TowerState {
  isInTower: boolean;
  currentFloor: number;
  playerHp: number;
  playerMaxHp: number;
  playerShield: number;
  gold: number;
  currentBlessings: TowerBlessingType[];
  currentFloorData: TowerFloor | null;
  highestFloor: number;
  unlockedBlessings: TowerBlessingType[];
  totalGoldEarned: number;
  bossKills: number;
  battleStatus: TowerBattleStatus;
  isAnimating: boolean;
  activeDebuffs: TowerDebuff[];
  consecutiveDebuffTypes: TowerDebuffType[];
  shopBlessings: TowerBlessing[];
}

export interface TowerActions {
  init: () => void;
  startRun: () => void;
  prepareBattle: () => void;
  getGridSize: () => number;
  getMaxEnergy: () => number;
  getSpecialTiles: () => Partial<SpecialTileConfig> & { excludedElements?: string[] };
  getHealMultiplier: () => number;
  hasBlessing: (type: TowerBlessingType) => boolean;
  applyShieldDamage: (damage: number) => number;
  addShield: (amount: number) => void;
  healPlayer: (amount: number) => void;
  damagePlayer: (damage: number) => void;
  gainGold: (amount: number) => void;
  buyBlessing: (blessing: TowerBlessing) => boolean;
  restAtCamp: (cost: number) => boolean;
  removeDebuff: (debuffType: TowerDebuffType, cost: number) => boolean;
  completeFloor: () => void;
  getShopBlessings: () => TowerBlessing[];
  continueFromCamp: () => void;
  handleDefeat: () => void;
  exitTower: () => void;
  setBattleStatus: (status: TowerBattleStatus) => void;
  setAnimating: (animating: boolean) => void;
}

export type TowerStore = TowerState & TowerActions;

export const ELEMENT_COLORS: Record<ElementType, string> = {
  fire: '#ff4d4d',
  water: '#4da6ff',
  grass: '#4dff88',
  thunder: '#ffcc00',
};

export const ELEMENT_NAMES: Record<ElementType, string> = {
  fire: '火',
  water: '水',
  grass: '草',
  thunder: '雷',
};

export const ELEMENT_ICONS: Record<ElementType, string> = {
  fire: '🔥',
  water: '💧',
  grass: '🌿',
  thunder: '⚡',
};

export const TERRAIN_NAMES: Record<TerrainType, string> = {
  magma: '岩浆裂隙',
  frost: '冰霜之地',
  thorns: '荆棘丛',
  storm: '雷暴云',
};

export const TERRAIN_ICONS: Record<TerrainType, string> = {
  magma: '🌋',
  frost: '❄️',
  thorns: '🌵',
  storm: '⛈️',
};

export const TERRAIN_COLORS: Record<TerrainType, string> = {
  magma: '#ff4500',
  frost: '#87ceeb',
  thorns: '#228b22',
  storm: '#9370db',
};

export const SPELLS: Spell[] = [
  {
    id: 'fireball',
    name: '火球术',
    element: 'fire',
    cost: 3,
    damage: 30,
    heal: 0,
    description: '发射炽热的火球，造成30点火焰伤害',
    icon: '🔥',
  },
  {
    id: 'water-heal',
    name: '治愈之泉',
    element: 'water',
    cost: 3,
    damage: 0,
    heal: 25,
    description: '召唤治愈之水，恢复25点生命值',
    icon: '💧',
  },
  {
    id: 'vine-whip',
    name: '藤蔓抽击',
    element: 'grass',
    cost: 3,
    damage: 25,
    heal: 5,
    description: '藤蔓缠绕敌人，造成25点伤害并恢复5点生命',
    icon: '🌿',
  },
  {
    id: 'thunder-strike',
    name: '雷霆一击',
    element: 'thunder',
    cost: 4,
    damage: 45,
    heal: 0,
    description: '召唤雷电打击敌人，造成45点雷电伤害',
    icon: '⚡',
  },
];

export const COMBO_SPELLS: ComboSpell[] = [
  {
    id: 'flame-thorns',
    name: '烈焰荆棘',
    elements: 'fire+grass',
    cost: { fire: 3, grass: 3 },
    damage: 25,
    heal: 0,
    effect: 'burn',
    effectValue: 10,
    effectDuration: 3,
    cooldown: 3,
    description: '火与草的融合，释放燃烧的荆棘造成25点伤害并附加持续灼烧（每回合10点伤害，持续3回合）',
    icon: '🔥🌿',
  },
  {
    id: 'thunder-storm',
    name: '雷暴洪流',
    elements: 'water+thunder',
    cost: { water: 3, thunder: 3 },
    damage: 35,
    heal: 0,
    effect: 'paralyze',
    effectValue: 50,
    effectDuration: 1,
    cooldown: 4,
    description: '水与雷的共鸣，召唤雷暴洪流造成35点伤害并麻痹敌人（下回合攻击力减半）',
    icon: '💧⚡',
  },
  {
    id: 'steam-burst',
    name: '蒸汽爆裂',
    elements: 'fire+water',
    cost: { fire: 3, water: 3 },
    damage: 40,
    heal: 0,
    effect: 'resistance_down',
    effectValue: 20,
    effectDuration: 3,
    cooldown: 3,
    description: '火与水的碰撞，产生蒸汽爆裂造成40点伤害并降低敌人20%元素抗性（持续3回合）',
    icon: '🔥💧',
  },
];

export const COMBO_ELEMENT_COLORS: Record<ComboElementType, string> = {
  'fire+grass': '#ff994d',
  'water+thunder': '#9966ff',
  'fire+water': '#66ccff',
};

export const STATUS_EFFECT_NAMES: Record<StatusEffectType, string> = {
  burn: '灼烧',
  paralyze: '麻痹',
  resistance_down: '抗性降低',
  frozen: '冰冻',
  thorns: '荆棘',
  regen: '回复',
};

export const STATUS_EFFECT_ICONS: Record<StatusEffectType, string> = {
  burn: '🔥',
  paralyze: '⚡',
  resistance_down: '💨',
  frozen: '❄️',
  thorns: '🌵',
  regen: '💚',
};

export const GRID_SIZE = 6;

export const ENEMY_BEHAVIOR_NAMES: Record<EnemyBehaviorType, string> = {
  normal: '普通攻击',
  charge: '蓄力',
  defend: '防御姿态',
  summon: '召唤小怪',
  berserk: '狂暴',
};

export const ENEMY_BEHAVIOR_ICONS: Record<EnemyBehaviorType, string> = {
  normal: '⚔️',
  charge: '💥',
  defend: '🛡️',
  summon: '👻',
  berserk: '🔥',
};

export const ENEMY_AI_PRIORITY_NAMES: Record<EnemyAIPriority, string> = {
  aggressive: '激进型',
  defensive: '防御型',
  balanced: '平衡型',
  tactical: '战术型',
};

export const DEFAULT_AI_CONFIG: EnemyAIConfig = {
  priority: 'balanced',
  enabledBehaviors: ['normal'],
  chargeDamageMultiplier: 2.5,
  defendDamageReduction: 0.5,
  defendAttackPenalty: 0.3,
  summonCooldown: 4,
  minionBaseHp: 30,
  minionBaseAttack: 8,
  minionExplosionDamage: 25,
  berserkThreshold: 0.3,
  berserkAttackMultiplier: 2,
  berserkSelfDamagePerTurn: 5,
};

export type EquipmentQuality = 'common' | 'rare' | 'epic' | 'legendary';

export type AffixType = 'energy_boost' | 'spell_damage' | 'initial_energy';

export type EquipmentSeries = 'blaze' | 'frost' | 'storm' | 'earth';

export type ResonanceEffectType = 
  | 'aoe_burn'
  | 'free_turn_on_chain'
  | 'frozen_on_spell'
  | 'thorns_aura'
  | 'spell_refund'
  | 'double_cast_chance'
  | 'energy_shield'
  | 'lifesteal';

export interface ResonanceEffect {
  spellDamageBonus?: number;
  energyBoostBonus?: number;
  initialEnergyBonus?: number;
  hpRegenPerTurn?: number;
  critChance?: number;
  damageMultiplier?: number;
  aoeBurnDamage?: number;
  aoeBurnDuration?: number;
  freeTurnChainThreshold?: number;
  frozenChance?: number;
  frozenDuration?: number;
  thornsDamage?: number;
  spellRefundChance?: number;
  spellRefundPercent?: number;
  doubleCastChance?: number;
  energyShieldPerTurn?: number;
  lifestealPercent?: number;
}

export interface SeriesResonanceConfig {
  series: EquipmentSeries;
  name: string;
  icon: string;
  color: string;
  piece2: ResonanceEffect;
  piece4: ResonanceEffect;
  piece2Desc: string;
  piece4Desc: string;
}

export interface EquipmentAffix {
  type: AffixType;
  value: number;
}

export interface RuneEquipment {
  id: string;
  element: ElementType;
  quality: EquipmentQuality;
  level: number;
  affixes: EquipmentAffix[];
  series: EquipmentSeries;
}

export interface EquipmentSaveData {
  gold: number;
  inventory: RuneEquipment[];
  equipped: Partial<Record<ElementType, (string | null)[]>>;
  highestLevel: number;
}

export const QUALITY_ORDER: EquipmentQuality[] = ['common', 'rare', 'epic', 'legendary'];

export const QUALITY_NAMES: Record<EquipmentQuality, string> = {
  common: '普通',
  rare: '稀有',
  epic: '史诗',
  legendary: '传说',
};

export const QUALITY_COLORS: Record<EquipmentQuality, string> = {
  common: '#9ca3af',
  rare: '#3b82f6',
  epic: '#a855f7',
  legendary: '#f59e0b',
};

export const QUALITY_BG: Record<EquipmentQuality, string> = {
  common: 'bg-gray-500/20 border-gray-500/50',
  rare: 'bg-blue-500/20 border-blue-500/50',
  epic: 'bg-purple-500/20 border-purple-500/50',
  legendary: 'bg-amber-500/20 border-amber-500/50',
};

export const AFFIX_NAMES: Record<AffixType, string> = {
  energy_boost: '消除能量加成',
  spell_damage: '法术伤害加成',
  initial_energy: '初始能量',
};

export const AFFIX_ICONS: Record<AffixType, string> = {
  energy_boost: '⚡',
  spell_damage: '⚔️',
  initial_energy: '✨',
};

export const AFFIX_FORMAT: Record<AffixType, (value: number) => string> = {
  energy_boost: (v) => `+${v}`,
  spell_damage: (v) => `+${v}%`,
  initial_energy: (v) => `+${v}`,
};

export const QUALITY_AFFIX_COUNT: Record<EquipmentQuality, number> = {
  common: 1,
  rare: 2,
  epic: 3,
  legendary: 4,
};

export const SERIES_NAMES: Record<EquipmentSeries, string> = {
  blaze: '烈焰',
  frost: '寒冰',
  storm: '风暴',
  earth: '大地',
};

export const SERIES_ICONS: Record<EquipmentSeries, string> = {
  blaze: '🔥',
  frost: '❄️',
  storm: '⛈️',
  earth: '🌍',
};

export const SERIES_COLORS: Record<EquipmentSeries, string> = {
  blaze: '#ff6b35',
  frost: '#4fc3f7',
  storm: '#ab47bc',
  earth: '#66bb6a',
};

export const SERIES_BG: Record<EquipmentSeries, string> = {
  blaze: 'bg-orange-500/20 border-orange-500/50',
  frost: 'bg-cyan-500/20 border-cyan-500/50',
  storm: 'bg-purple-500/20 border-purple-500/50',
  earth: 'bg-green-500/20 border-green-500/50',
};

export const ALL_EQUIPMENT_SERIES: EquipmentSeries[] = ['blaze', 'frost', 'storm', 'earth'];

export const SERIES_RESONANCE: SeriesResonanceConfig[] = [
  {
    series: 'blaze',
    name: '烈焰系列',
    icon: '🔥',
    color: '#ff6b35',
    piece2: { spellDamageBonus: 15, spellRefundChance: 0.2, spellRefundPercent: 0.5 },
    piece4: { spellDamageBonus: 35, aoeBurnDamage: 5, aoeBurnDuration: 2, doubleCastChance: 0.15 },
    piece2Desc: '法术伤害+15%，火系法术20%概率返还50%能量消耗',
    piece4Desc: '法术伤害+35%，火球术附带范围灼烧（全体每回合5点伤害，持续2回合），15%概率双重施法',
  },
  {
    series: 'frost',
    name: '寒冰系列',
    icon: '❄️',
    color: '#4fc3f7',
    piece2: { energyBoostBonus: 2, frozenChance: 0.3, frozenDuration: 1 },
    piece4: { energyBoostBonus: 5, initialEnergyBonus: 3, frozenChance: 0.5, frozenDuration: 2 },
    piece2Desc: '消除能量+2，水系法术30%概率冰冻敌人1回合（无法行动）',
    piece4Desc: '消除能量+5，初始能量+3，水系法术50%概率冰冻敌人2回合，冰冻持续期间受到伤害+25%',
  },
  {
    series: 'storm',
    name: '风暴系列',
    icon: '⛈️',
    color: '#ab47bc',
    piece2: { initialEnergyBonus: 3, energyBoostBonus: 1 },
    piece4: { initialEnergyBonus: 6, critChance: 0.15, freeTurnChainThreshold: 2 },
    piece2Desc: '初始能量+3，每次消除≥4个符文额外获得1点能量',
    piece4Desc: '初始能量+6，暴击率+15%，每次连锁消除（≥2连）额外获得一次免费回合',
  },
  {
    series: 'earth',
    name: '大地系列',
    icon: '🌍',
    color: '#66bb6a',
    piece2: { hpRegenPerTurn: 5, thornsDamage: 8 },
    piece4: { hpRegenPerTurn: 12, energyShieldPerTurn: 15, lifestealPercent: 0.1 },
    piece2Desc: '每回合恢复5点生命，受到伤害时反弹8点伤害',
    piece4Desc: '每回合恢复12点生命，每回合获得15点护盾，造成伤害的10%转化为生命值',
  },
];

export const LEVEL_GOLD_REWARD: Record<number, number> = {
  1: 80,
  2: 150,
  3: 250,
  4: 400,
  5: 600,
};

export const REROLL_COST: Record<EquipmentQuality, number> = {
  common: 50,
  rare: 120,
  epic: 250,
  legendary: 500,
};

export const RECAST_SERIES_COST: Record<EquipmentQuality, { gold: number; materials: number }> = {
  common: { gold: 100, materials: 1 },
  rare: { gold: 250, materials: 2 },
  epic: { gold: 500, materials: 3 },
  legendary: { gold: 1000, materials: 4 },
};

export const SLOT_UNLOCK_THRESHOLDS = [
  { minLevel: 1, slots: 1 },
  { minLevel: 3, slots: 2 },
  { minLevel: 5, slots: 3 },
];

export const getSlotsForLevel = (highestLevel: number): number => {
  let slots = 1;
  for (const t of SLOT_UNLOCK_THRESHOLDS) {
    if (highestLevel >= t.minLevel) slots = t.slots;
  }
  return slots;
};

export const QUALITY_DROP_WEIGHTS: Record<number, [number, number, number, number]> = {
  1: [70, 22, 7, 1],
  2: [55, 28, 13, 4],
  3: [40, 30, 20, 10],
  4: [25, 30, 28, 17],
  5: [15, 25, 32, 28],
};

export const AFFIX_BASE_VALUES: Record<AffixType, Record<EquipmentQuality, number>> = {
  energy_boost: { common: 1, rare: 2, epic: 3, legendary: 5 },
  spell_damage: { common: 5, rare: 10, epic: 18, legendary: 28 },
  initial_energy: { common: 1, rare: 2, epic: 3, legendary: 4 },
};

export const DEFAULT_BEHAVIOR_STATE: EnemyBehaviorState = {
  currentBehavior: 'normal',
  isBerserk: false,
  chargeState: {
    isCharging: false,
    chargeTurnsRemaining: 0,
    chargedDamage: 0,
    skillName: '',
  },
  defenseState: {
    isDefending: false,
    damageReduction: 0,
    attackPenalty: 0,
  },
  summonedMinions: [],
  summonCooldownRemaining: 0,
  consecutiveNormalAttacks: 0,
};

export type TowerDebuffType = 
  | 'no_fire_rune' 
  | 'no_water_rune' 
  | 'no_grass_rune' 
  | 'no_thunder_rune'
  | 'small_grid'
  | 'half_energy'
  | 'low_heal'
  | 'enrage_enemy'
  | 'poison_aura'
  | 'mana_drain'
  | 'vines_entangle'
  | 'darkness_veil'
  | 'lava_burn'
  | 'dragon_fear'
  | 'void_corruption'
  | 'spell_seal'
  | 'confusion'
  | 'amnesia'
  | 'despair'
  | 'void_touch'
  | 'fear'
  | 'darkness'
  | 'curse'
  | 'poison'
  | 'blind'
  | 'corruption'
  | 'mind_control'
  | 'burn';

export type TowerBlessingType =
  | 'double_first_energy'
  | 'extra_turn_big_match'
  | 'spell_splash'
  | 'energy_convert'
  | 'damage_shield'
  | 'critical_hit'
  | 'life_steal'
  | 'double_combo'
  | 'start_with_shield'
  | 'thorns'
  | 'holy_shield'
  | 'holy_ward'
  | 'nature_ward'
  | 'jungle_eye'
  | 'purification'
  | 'nature_bane'
  | 'dark_sight'
  | 'abyss_whisper'
  | 'holy_power'
  | 'angel_blessing'
  | 'true_name'
  | 'hidden_name'
  | 'abyss_mastery'
  | 'flame_imbue'
  | 'dragon_blood'
  | 'ritual_breaker'
  | 'dragon_breath'
  | 'dragon_lullaby'
  | 'dragon_flame'
  | 'void_insight'
  | 'memory_anchor'
  | 'void_embrace'
  | 'echo_power'
  | 'empathy_resonance'
  | 'light_slasher'
  | 'light_vessel'
  | 'star_forge';

export interface TowerDebuff {
  type: TowerDebuffType;
  name: string;
  description: string;
  icon: string;
}

export interface TowerBlessing {
  type: TowerBlessingType;
  name: string;
  description: string;
  icon: string;
  rarity: 'common' | 'rare' | 'epic';
  cost: number;
}

export type TowerNarrativeEventType = 
  | 'enter_floor'
  | 'before_battle'
  | 'after_victory'
  | 'camp_story'
  | 'camp_choice'
  | 'elite_encounter'
  | 'treasure_found'
  | 'trap_triggered'
  | 'mysterious_event';

export interface TowerFloorNarrativeEvent {
  id: string;
  type: TowerNarrativeEventType;
  title: string;
  text: string;
  choices?: TowerNarrativeChoice[];
  autoTrigger?: boolean;
  icon?: string;
}

export interface TowerNarrativeChoice {
  id: string;
  text: string;
  resultText: string;
  icon: string;
  effect: TowerBranchEffect;
}

export interface TowerCampStoryEvent {
  id: string;
  theme: TowerThemeType;
  campIndex: number;
  title: string;
  text: string;
  npcName?: string;
  npcSprite?: string;
  choices: TowerNarrativeChoice[];
  unlockCondition?: string;
}

export interface TowerFloorNarrative {
  theme: TowerThemeType;
  floorInTheme: number;
  enterEvent?: TowerFloorNarrativeEvent;
  victoryEvent?: TowerFloorNarrativeEvent;
  campEvents?: TowerCampStoryEvent[];
}

export interface TowerFloor {
  floor: number;
  enemy: Enemy;
  debuffs: TowerDebuff[];
  blessings?: TowerBlessing[];
  floorBlessings?: TowerBlessing[];
  isBoss: boolean;
  isCamp: boolean;
  isBranchCamp?: boolean;
  isElite?: boolean;
  theme?: TowerThemeType;
  goldReward: number;
  narrativeEvent?: TowerFloorNarrativeEvent;
  victoryEvent?: TowerFloorNarrativeEvent;
  campNarrative?: TowerCampStoryEvent;
}

export interface TowerSaveData {
  highestFloor: number;
  unlockedBlessings: TowerBlessingType[];
  totalGoldEarned: number;
  bossKills: number;
  currentRun: {
    currentFloor: number;
    playerHp: number;
    playerMaxHp: number;
    gold: number;
    blessings: TowerBlessingType[];
    shield: number;
  } | null;
}

export const TOWER_DEBUFFS: TowerDebuff[] = [
  { type: 'no_fire_rune', name: '火焰封印', description: '本层不生成火属性符文', icon: '🔥🚫' },
  { type: 'no_water_rune', name: '水流封印', description: '本层不生成水属性符文', icon: '💧🚫' },
  { type: 'no_grass_rune', name: '自然封印', description: '本层不生成草属性符文', icon: '🌿🚫' },
  { type: 'no_thunder_rune', name: '雷霆封印', description: '本层不生成雷属性符文', icon: '⚡🚫' },
  { type: 'small_grid', name: '空间压缩', description: '棋盘缩小为 5×5', icon: '📐' },
  { type: 'half_energy', name: '能量衰减', description: '能量上限减半', icon: '🔋↓' },
  { type: 'low_heal', name: '治愈抑制', description: '治疗效果降低50%', icon: '💔' },
  { type: 'enrage_enemy', name: '狂暴光环', description: '敌人攻击力提升30%', icon: '💢' },
  { type: 'poison_aura', name: '毒雾弥漫', description: '丛林毒雾，每回合损失5点生命', icon: '☠️' },
  { type: 'mana_drain', name: '魔力汲取', description: '深渊魔力吞噬，初始能量减2', icon: '🌀' },
  { type: 'vines_entangle', name: '藤蔓缠绕', description: '额外生成2个冰冻格', icon: '🌿' },
  { type: 'darkness_veil', name: '黑暗面纱', description: '深渊黑雾，不生成雷属性符文', icon: '🌑' },
  { type: 'lava_burn', name: '熔岩灼烧', description: '龙巢余热，每回合损失3点生命', icon: '🌋' },
  { type: 'dragon_fear', name: '龙威震慑', description: '龙族恐惧，首回合无法施法', icon: '🐲' },
  { type: 'void_corruption', name: '虚空侵蚀', description: '虚空腐化，随机封印一种元素', icon: '🕳️' },
  { type: 'spell_seal', name: '法术封印', description: '本层无法使用组合法术', icon: '🔮' },
  { type: 'confusion', name: '精神混乱', description: '虚空扭曲认知，消除方向随机', icon: '😵' },
  { type: 'amnesia', name: '记忆遗忘', description: '虚空吞噬记忆，无法查看敌人血量', icon: '🧠' },
  { type: 'despair', name: '绝望光环', description: '虚空绝望，护盾效果减半', icon: '😢' },
  { type: 'void_touch', name: '虚空之触', description: '虚空侵蚀，治疗转化为伤害', icon: '👻' },
  { type: 'fear', name: '恐惧', description: '敌人威压，有概率跳过回合', icon: '😨' },
  { type: 'darkness', name: '黑暗', description: '黑暗笼罩，部分格子不可见', icon: '🌑' },
  { type: 'curse', name: '诅咒', description: '受到伤害增加25%', icon: '💀' },
  { type: 'poison', name: '毒素', description: '每回合损失2点生命', icon: '☠️' },
  { type: 'blind', name: '失明', description: '无法预判敌人行动', icon: '👁️' },
  { type: 'corruption', name: '腐化', description: '能量获取减少30%', icon: '🖤' },
  { type: 'mind_control', name: '精神控制', description: '有概率自动攻击自己', icon: '🌀' },
  { type: 'burn', name: '灼烧', description: '每回合损失3点生命', icon: '🔥' },
];

export const TOWER_BLESSINGS: TowerBlessing[] = [
  { type: 'double_first_energy', name: '初始充能', description: '首回合能量翻倍', icon: '✨', rarity: 'common', cost: 50 },
  { type: 'extra_turn_big_match', name: '连锁反应', description: '消除≥5个符文时额外获得一回合', icon: '🔄', rarity: 'rare', cost: 100 },
  { type: 'spell_splash', name: '法术溅射', description: '法术伤害溅射至所有敌人', icon: '💥', rarity: 'rare', cost: 120 },
  { type: 'energy_convert', name: '能量转换', description: '每回合将1点随机能量转为其他元素', icon: '🔃', rarity: 'common', cost: 60 },
  { type: 'damage_shield', name: '伤害护盾', description: '每3回合获得可吸收20伤害的护盾', icon: '🛡️', rarity: 'rare', cost: 100 },
  { type: 'critical_hit', name: '暴击精通', description: '20%概率造成1.5倍伤害', icon: '💎', rarity: 'epic', cost: 180 },
  { type: 'life_steal', name: '生命汲取', description: '造成伤害的10%转化为生命值', icon: '💉', rarity: 'epic', cost: 200 },
  { type: 'double_combo', name: '连击大师', description: '连击能量收益翻倍', icon: '⚡⚡', rarity: 'rare', cost: 150 },
  { type: 'start_with_shield', name: '守护祝福', description: '每层开始时获得15点护盾', icon: '🌟', rarity: 'common', cost: 80 },
  { type: 'thorns', name: '荆棘护甲', description: '受到伤害时反弹15%伤害', icon: '🌵', rarity: 'rare', cost: 130 },
  { type: 'holy_shield', name: '神圣护盾', description: '每回合回复5点生命', icon: '🛡️✨', rarity: 'common', cost: 70 },
  { type: 'holy_ward', name: '圣光驱散', description: '免疫诅咒、恐惧和黑暗效果', icon: '📿', rarity: 'rare', cost: 120 },
  { type: 'nature_ward', name: '自然守护', description: '免疫毒素，每回合回复2点生命', icon: '🌿', rarity: 'common', cost: 80 },
  { type: 'jungle_eye', name: '丛林之眼', description: '免疫毒素和失明，暴击率+15%', icon: '👁️', rarity: 'rare', cost: 110 },
  { type: 'purification', name: '净化之力', description: '免疫腐化和毒素，伤害+15%', icon: '✨', rarity: 'rare', cost: 130 },
  { type: 'nature_bane', name: '天灾之力', description: '对丛林敌人伤害+35%', icon: '💀🌿', rarity: 'epic', cost: 200 },
  { type: 'dark_sight', name: '黑暗视野', description: '暴击率+10%，最大生命-5', icon: '👁️🌑', rarity: 'rare', cost: 90 },
  { type: 'abyss_whisper', name: '深渊低语', description: '伤害+25%，暴击率+15%', icon: '🌑', rarity: 'rare', cost: 140 },
  { type: 'holy_power', name: '神圣之力', description: '对亡灵敌人伤害+35%，最大生命-10', icon: '✨💀', rarity: 'epic', cost: 190 },
  { type: 'angel_blessing', name: '天使祝福', description: '免疫诅咒和黑暗，每回合回复4点生命', icon: '👼', rarity: 'epic', cost: 220 },
  { type: 'true_name', name: '真名之力', description: '伤害+30%，敌人伤害-15%', icon: '📜', rarity: 'epic', cost: 250 },
  { type: 'hidden_name', name: '隐名之力', description: '暴击率+15%，最大生命+20', icon: '🔮', rarity: 'rare', cost: 150 },
  { type: 'abyss_mastery', name: '深渊精通', description: '伤害+35%，免疫恐惧、混乱和黑暗', icon: '🌑💎', rarity: 'epic', cost: 280 },
  { type: 'flame_imbue', name: '烈焰淬炼', description: '伤害+10%', icon: '🔥', rarity: 'common', cost: 60 },
  { type: 'dragon_blood', name: '龙血觉醒', description: '伤害+25%，最大生命+15', icon: '🐲💉', rarity: 'rare', cost: 160 },
  { type: 'ritual_breaker', name: '破魔之人', description: '免疫精神控制和恐惧，暴击率+15%', icon: '📜⚔️', rarity: 'rare', cost: 140 },
  { type: 'dragon_breath', name: '龙息吐息', description: '伤害+30%，最大生命+10', icon: '🐲🔥', rarity: 'epic', cost: 230 },
  { type: 'dragon_lullaby', name: '龙之摇篮曲', description: '免疫精神控制、恐惧和灼烧，每回合回复3点生命', icon: '🎵🐲', rarity: 'epic', cost: 240 },
  { type: 'dragon_flame', name: '龙焰附体', description: '伤害+20%，最大生命+25，护盾+15', icon: '🐲🔥✨', rarity: 'epic', cost: 260 },
  { type: 'void_insight', name: '虚空洞察', description: '暴击率+10%', icon: '🕳️👁️', rarity: 'common', cost: 70 },
  { type: 'memory_anchor', name: '记忆锚点', description: '免疫混乱和遗忘，最大生命+20', icon: '💎', rarity: 'epic', cost: 220 },
  { type: 'void_embrace', name: '虚空拥抱', description: '伤害+25%，最大生命-5', icon: '🌀', rarity: 'rare', cost: 140 },
  { type: 'echo_power', name: '回响之力', description: '伤害+35%，最大生命+20', icon: '💫', rarity: 'epic', cost: 280 },
  { type: 'empathy_resonance', name: '共情共鸣', description: '免疫绝望和虚空之触，每回合回复3点生命', icon: '💝', rarity: 'epic', cost: 270 },
  { type: 'light_slasher', name: '光之斩击者', description: '伤害+40%，暴击率+20%', icon: '⚔️✨', rarity: 'epic', cost: 300 },
  { type: 'light_vessel', name: '光之容器', description: '免疫虚空之触、绝望和遗忘，每回合回复4点生命', icon: '✨', rarity: 'epic', cost: 320 },
  { type: 'star_forge', name: '星光锻造', description: '伤害+50%，暴击率+25%，最大生命-20', icon: '⚔️🌟', rarity: 'epic', cost: 350 },
];

export const BLESSING_RARITY_WEIGHTS: Record<string, [number, number, number]> = {
  shop: [50, 35, 15],
  floor: [60, 30, 10],
};

export const TOWER_TOTAL_FLOORS = 50;
export const TOWER_CAMP_INTERVAL = 3;
export const TOWER_BOSS_INTERVAL = 10;
export const TOWER_THEME_INTERVAL = 10;

export type TowerThemeType = 'dungeon' | 'jungle' | 'abyss' | 'dragon_nest' | 'void';

export type TowerBranchChoiceType =
  | 'sacrifice_shield_for_crit'
  | 'reduce_hp_for_regen'
  | 'accept_curse_for_power'
  | 'gain_gold_for_difficulty'
  | 'embrace_void_for_energy'
  | 'tame_beast_for_companion'
  | 'dragon_blessing'
  | 'dragon_curse'
  | 'abyss_power'
  | 'void_enlightenment'
  | 'dungeon_steady_guard'
  | 'dungeon_prayer'
  | 'jungle_herbalist'
  | 'jungle_hunter'
  | 'jungle_ancient_totem'
  | 'abyss_soul_sacrifice'
  | 'abyss_light_guardian'
  | 'abyss_dark_pact'
  | 'dragon_hoard'
  | 'dragon_knight_oath'
  | 'dragon_ancestor_wisdom'
  | 'void_reality_bender'
  | 'void_star_weaver'
  | 'void_eternal_guardian'
  | 'balanced_path'
  | 'knowledge_seeker'
  | 'wealth_collector';

export interface TowerBranchEffect {
  playerMaxHp?: number;
  playerShield?: number;
  critChance?: number;
  regenPerTurn?: number;
  goldMultiplier?: number;
  damageMultiplier?: number;
  difficultyMultiplier?: number;
  energyGain?: number;
  companion?: string;
  blessingType?: TowerBlessingType;
  debuffImmune?: TowerDebuffType[];
}

export interface TowerBranchChoice {
  id: TowerBranchChoiceType;
  name: string;
  description: string;
  icon: string;
  effect: TowerBranchEffect;
  narrativeText: string;
  endingPath?: string;
}

export interface TowerNarrative {
  theme: TowerThemeType;
  title: string;
  introText: string;
  campTexts: string[];
  branchChoices: TowerBranchChoice[];
  bossIntro: string;
  bossVictoryText: string;
}

export interface TowerTheme {
  type: TowerThemeType;
  name: string;
  icon: string;
  color: string;
  startFloor: number;
  endFloor: number;
  description: string;
  enemyTypes: string[];
  preferredElements: ElementType[];
  bannedElements?: ElementType[];
  characteristicDebuffs: TowerDebuffType[];
  enemyPool: string[];
  bossId: string;
  eliteId?: string;
}

export type TowerEndingType =
  | 'hero_victory'
  | 'abyss_corrupted'
  | 'void_enlightened'
  | 'dragon_tamer'
  | 'beast_master'
  | 'greedy_fool'
  | 'cursed_power'
  | 'sacrificial_hero'
  | 'balanced_sage'
  | 'guardian_legend'
  | 'dragon_blood_warrior'
  | 'void_architect'
  | 'jungle_avatar'
  | 'dungeon_conqueror'
  | 'default_wanderer';

export interface TowerEnding {
  type: TowerEndingType;
  name: string;
  icon: string;
  color: string;
  description: string;
  requiredChoices: TowerBranchChoiceType[];
  forbiddenChoices?: TowerBranchChoiceType[];
  goldBonus: number;
  achievementId?: string;
}

export interface TowerEnemyThemeData {
  id: string;
  theme: TowerThemeType;
  enemyType: string;
  name: string;
  maxHp: number;
  attack: number;
  resistance: Partial<Record<ElementType, number>>;
  sprite: string;
  attackPattern: number[];
  description: string;
  aiConfig: Partial<EnemyAIConfig>;
}

export const TOWER_THEMES: TowerTheme[] = [
  {
    type: 'dungeon',
    name: '石砌地牢',
    icon: '🏰',
    color: '#8B7355',
    startFloor: 1,
    endFloor: 10,
    description: '阴暗潮湿的地牢，充斥着低级魔物和陷阱。这是一切冒险的起点。',
    enemyTypes: ['slime', 'elemental', 'undead'],
    preferredElements: ['fire', 'thunder'],
    characteristicDebuffs: ['small_grid', 'no_grass_rune', 'mana_drain', 'curse', 'darkness'],
    enemyPool: [
      'dungeon_slime',
      'dungeon_rat',
      'dungeon_skeleton',
      'dungeon_spider',
      'dungeon_golem',
      'dungeon_bat',
      'dungeon_mimic',
      'dungeon_shade',
    ],
    bossId: 'boss_dungeon_warden',
    eliteId: 'elite_dungeon_jailer',
  },
  {
    type: 'jungle',
    name: '翠绿丛林',
    icon: '🌳',
    color: '#228B22',
    startFloor: 11,
    endFloor: 20,
    description: '生机盎然却危机四伏的丛林，野兽横行，藤蔓缠绕。',
    enemyTypes: ['beast', 'elemental'],
    preferredElements: ['grass', 'water'],
    bannedElements: [],
    characteristicDebuffs: ['no_fire_rune', 'low_heal', 'poison_aura', 'vines_entangle', 'poison', 'blind'],
    enemyPool: [
      'jungle_wolf',
      'jungle_snake',
      'jungle_treant',
      'jungle_spore',
      'jungle_panther',
      'jungle_frog',
      'jungle_mantis',
      'jungle_mushroom',
    ],
    bossId: 'boss_jungle_guardian',
    eliteId: 'elite_jungle_hunter',
  },
  {
    type: 'abyss',
    name: '幽暗深渊',
    icon: '🕳️',
    color: '#4B0082',
    startFloor: 21,
    endFloor: 30,
    description: '深不见底的深渊，黑暗中潜伏着难以名状的恐怖。',
    enemyTypes: ['undead', 'demon'],
    preferredElements: ['water', 'thunder'],
    bannedElements: ['fire'],
    characteristicDebuffs: ['half_energy', 'enrage_enemy', 'no_fire_rune', 'mana_drain', 'darkness_veil', 'darkness', 'fear', 'corruption', 'mind_control'],
    enemyPool: [
      'abyss_ghost',
      'abyss_wraith',
      'abyss_demon',
      'abyss_eye',
      'abyss_tentacle',
      'abyss_shade',
      'abyss_crawler',
      'abyss_siren',
    ],
    bossId: 'boss_abyss_lord',
    eliteId: 'elite_abyss_keeper',
  },
  {
    type: 'dragon_nest',
    name: '烈焰龙巢',
    icon: '🐲',
    color: '#B22222',
    startFloor: 31,
    endFloor: 40,
    description: '灼热的龙巢，龙族的领地，空气中弥漫着硫磺和危险。',
    enemyTypes: ['dragon', 'demon'],
    preferredElements: ['fire'],
    bannedElements: ['water'],
    characteristicDebuffs: ['enrage_enemy', 'no_water_rune', 'low_heal', 'lava_burn', 'dragon_fear', 'burn', 'fear'],
    enemyPool: [
      'dragon_whelp',
      'dragon_drake',
      'dragon_guardian',
      'dragon_flame_elemental',
      'dragon_knight',
      'dragon_hatchling',
      'dragon_cultist',
      'dragon_salamander',
    ],
    bossId: 'boss_ancient_dragon',
    eliteId: 'elite_dragon_champion',
  },
  {
    type: 'void',
    name: '虚空裂隙',
    icon: '🌌',
    color: '#1a1a2e',
    startFloor: 41,
    endFloor: 50,
    description: '扭曲的虚空世界，现实与幻象交织，一切规则都将被打破。',
    enemyTypes: ['undead', 'demon', 'elemental'],
    preferredElements: ['thunder'],
    bannedElements: [],
    characteristicDebuffs: ['half_energy', 'small_grid', 'no_grass_rune', 'no_fire_rune', 'void_corruption', 'spell_seal', 'confusion', 'amnesia', 'despair', 'void_touch', 'darkness', 'mind_control'],
    enemyPool: [
      'void_walker',
      'void_horror',
      'void_mage',
      'void_eater',
      'void_titan',
      'void_phantom',
      'void_seer',
      'void_fragment',
    ],
    bossId: 'boss_void_emperor',
    eliteId: 'elite_void_herald',
  },
];

export const TOWER_NARRATIVES: Record<TowerThemeType, TowerNarrative> = {
  dungeon: {
    theme: 'dungeon',
    title: '踏入地牢',
    introText: '你推开沉重的石门，一股霉味扑面而来。火把在墙上摇曳，照亮了前方蜿蜒的走廊。地牢深处传来诡异的声响...典狱长的王座就在前方，而你必须先做出选择。',
    campTexts: [
      '典狱长的力量被击碎了，你在通往丛林的阶梯旁找到了一处废弃的守卫室作为营地。墙壁上的刻痕显示曾有无数前人在此休息，有人活了下来，有人永远留在了这里。',
      '火光驱散了黑暗，却也引来了周围生物的注意。远处传来丛林的风声——你即将离开这片阴暗之地。',
      '地上散落着前人的遗物，似乎在诉说着这里曾经发生的故事。一枚生锈的徽章引起了你的注意...',
    ],
    branchChoices: [
      {
        id: 'sacrifice_shield_for_crit',
        name: '破釜沉舟',
        description: '卸下所有护盾，换取致命的暴击能力（护盾-20，暴击率+25%）',
        icon: '⚔️',
        effect: {
          playerShield: -20,
          critChance: 0.25,
        },
        narrativeText: '你将盾牌弃置一旁，双手紧握武器。虽然失去了防护，但每一击都将更加致命。你的眼中只有进攻！',
        endingPath: 'sacrificial_hero',
      },
      {
        id: 'reduce_hp_for_regen',
        name: '生命律动',
        description: '以生命力为代价，获得每回合自动回复（最大HP-20，每回合回复+5）',
        icon: '💚',
        effect: {
          playerMaxHp: -20,
          regenPerTurn: 5,
        },
        narrativeText: '你感受着生命力的流动，用匕首划破掌心施下古老的愈合咒文。虽然整体变得脆弱，但伤口将以更快的速度愈合。持久战，从此刻开始。',
      },
      {
        id: 'dungeon_steady_guard',
        name: '坚守之道',
        description: '锻造地牢守护者的铠甲（护盾+25，最大HP+15，但伤害降低10%）',
        icon: '🛡️',
        effect: {
          playerShield: 25,
          playerMaxHp: 15,
          damageMultiplier: -0.1,
        },
        narrativeText: '你穿上了从典狱长军械库中找到的残缺铠甲，用牢房门上的铁皮加固了防御。厚重的护甲让你的动作稍显迟缓，但你知道——活着才有输出。',
        endingPath: 'guardian_legend',
      },
      {
        id: 'dungeon_prayer',
        name: '囚徒的祈祷',
        description: '聆听老囚犯的临终教诲，获得祝福（暴击率+10%，伤害+10%，金币奖励+20%）',
        icon: '🙏',
        effect: {
          critChance: 0.1,
          damageMultiplier: 0.1,
          goldMultiplier: 0.2,
        },
        narrativeText: '你跪在老囚犯化为光粒的地方，轻声祈祷。一缕温暖的力量融入你的身体——那是千年来所有死在地牢中的囚徒对你的祝福。愿他们的意志与你同在。',
        endingPath: 'balanced_sage',
      },
    ],
    bossIntro: '地牢尽头传来沉重的脚步声。地牢守护者出现了——它曾是守护此地的骑士，如今却沦为了黑暗的囚徒。',
    bossVictoryText: '守护者倒下了，它的眼中闪过一丝解脱。通往更深层的道路在你面前展开。',
  },
  jungle: {
    theme: 'jungle',
    title: '深入丛林',
    introText: '茂密的树冠遮蔽了阳光，空气中弥漫着潮湿的气息。野兽的低吼从四面八方传来，你已经进入了它们的领地。丛林深处的守护者正在苏醒...',
    campTexts: [
      '守护者的腐化终于被净化，你在世界树的根须旁找到了一片可以休息的空地。藤蔓为你编织了一张天然的吊床，荧光虫围绕着你飞舞。',
      '篝火的烟味引来了好奇的丛林生物。一只小猴子战战兢兢地递给你一颗发光的果实...',
      '一棵古老的大树下，你发现了神秘的祭坛。上面刻着远古的图腾，似乎在等待着你的选择。',
    ],
    branchChoices: [
      {
        id: 'tame_beast_for_companion',
        name: '野兽伙伴',
        description: '驯服一只丛林狼作为战斗伙伴（伤害+15%，每回合回复+2）',
        icon: '🐺',
        effect: {
          companion: 'jungle_wolf',
          damageMultiplier: 0.15,
          regenPerTurn: 2,
        },
        narrativeText: '你用食物和耐心赢得了一只受伤丛林狼的信任。它舔舐着你的手，眼中闪烁着忠诚的光芒。它将在接下来的战斗中为你撕咬敌人，用毛皮温暖你的寒夜。',
        endingPath: 'beast_master',
      },
      {
        id: 'accept_curse_for_power',
        name: '自然馈赠',
        description: '接受丛林的生命之礼（获得生命汲取祝福，最大HP+25，但难度+15%）',
        icon: '🌿',
        effect: {
          blessingType: 'life_steal',
          playerMaxHp: 25,
          difficultyMultiplier: 0.15,
        },
        narrativeText: '你将手伸向祭坛，藤蔓缠绕上你的手臂——不是攻击，而是将远古的生命力注入你的身体。你感受到了丛林的意志：它要考验你，也将成就你。',
        endingPath: 'jungle_avatar',
      },
      {
        id: 'jungle_herbalist',
        name: '采药人之道',
        description: '学习丛林德鲁伊的草药知识（免疫毒素，每回合回复+3，最大HP+15）',
        icon: '🌱',
        effect: {
          debuffImmune: ['poison'],
          regenPerTurn: 3,
          playerMaxHp: 15,
        },
        narrativeText: '德鲁伊将一本草药古籍交到你手中，并在你的皮肤上绘制了天然的防护纹路。绿色的光芒渗入肌肤，你感到身体变得轻盈而坚韧。毒雾沼泽，从此如履平地。',
      },
      {
        id: 'jungle_hunter',
        name: '丛林猎手',
        description: '领悟丛林狩猎的精髓（暴击率+20%，伤害+15%，金币奖励+25%）',
        icon: '🏹',
        effect: {
          critChance: 0.2,
          damageMultiplier: 0.15,
          goldMultiplier: 0.25,
        },
        narrativeText: '你在丛林中猎取了数头凶猛的野兽，用它们的利齿和皮革强化了武器。饥饿和危险教会了你一件事：在丛林中，要么成为猎手，要么成为猎物。你选择了前者。',
      },
      {
        id: 'jungle_ancient_totem',
        name: '远古图腾',
        description: '激活原住民留下的神秘图腾（免疫失明和恐惧，暴击+15%，每回合+1能量）',
        icon: '🗿',
        effect: {
          debuffImmune: ['blind', 'fear'],
          critChance: 0.15,
          energyGain: 1,
        },
        narrativeText: '你将手掌按在图腾之上，用血液唤醒了远古的力量。原住民的灵魂在你耳边低语，传授着这个世界最原始的秘密。你的双眼中燃起了翡翠色的火焰。',
        endingPath: 'cursed_power',
      },
    ],
    bossIntro: '大地开始颤抖，参天古树缓缓移动。森林守护者苏醒了，它将用千年的力量来驱逐入侵者。',
    bossVictoryText: '古老的守护者回归了大地。它的根系中涌出清泉，似乎在表达对你的认可。通往深渊的裂缝，在你脚下缓缓打开。',
  },
  abyss: {
    theme: 'abyss',
    title: '坠落深渊',
    introText: '你踏入了深渊的领域。在这里，光明是奢侈品，黑暗是永恒的伴侣。你能感受到深渊正在凝视着你...深渊领主在黑暗深处等待，而你，必须先直面自己的选择。',
    campTexts: [
      '深渊领主终于消散了。你在黑暗与光明的交界之处找到了一处暂时的营地。脚下是深渊，头顶是龙巢的方向——你的旅途远未结束。',
      '周围的岩壁在蠕动。不，那不是岩壁，那是某种更恐怖的存在...但此刻，它们似乎在畏惧你的力量。',
      '你在黑暗中发现了一处祭坛——坠落天使留下的最后圣坛。它散发着矛盾的气息：神圣与邪恶，光明与黑暗。',
    ],
    branchChoices: [
      {
        id: 'abyss_soul_sacrifice',
        name: '灵魂献祭',
        description: '牺牲护盾换取深渊级暴击（护盾-25，暴击率+30%，伤害+10%）',
        icon: '💥',
        effect: {
          playerShield: -25,
          critChance: 0.3,
          damageMultiplier: 0.1,
        },
        narrativeText: '你脱下所有护具，将灵魂的一部分交给深渊换取力量。黑暗的纹路爬满你的皮肤，每当你握紧武器，紫色的电弧便在指尖跳跃。这是一场豪赌，你相信自己的剑胜过一切。',
        endingPath: 'sacrificial_hero',
      },
      {
        id: 'abyss_light_guardian',
        name: '圣光庇护',
        description: '燃烧生命换取圣光护佑（最大HP-15，每回合回复+6，免疫诅咒和恐惧）',
        icon: '✨',
        effect: {
          playerMaxHp: -15,
          regenPerTurn: 6,
          debuffImmune: ['curse', 'fear', 'darkness'],
        },
        narrativeText: '你将天使的羽毛刺入胸膛，神圣的火焰在你心中燃烧。你的皮肤变得苍白，眼角渗出金色的泪水——但你不再畏惧黑暗，因为你自己已经成为了黑暗中的光。',
      },
      {
        id: 'abyss_dark_pact',
        name: '深渊契约',
        description: '与深渊签订禁忌契约（伤害+35%，暴击+15%，但最大HP-25，难度+20%）',
        icon: '🌑',
        effect: {
          damageMultiplier: 0.35,
          critChance: 0.15,
          playerMaxHp: -25,
          difficultyMultiplier: 0.2,
        },
        narrativeText: '你对着虚空念出了深渊领主的真名，以鲜血为墨签下了禁忌契约。力量如洪流般涌入你的身体，你的瞳孔化为纯黑。深渊笑了——它从不做亏本买卖，但或许，你可以打破规则。',
        endingPath: 'abyss_corrupted',
      },
      {
        id: 'gain_gold_for_difficulty',
        name: '贪婪之选',
        description: '献祭部分生命力换取大量金币（当前HP-30，金币奖励+60%）',
        icon: '💰',
        effect: {
          playerHp: -30,
          goldMultiplier: 0.6,
        },
        narrativeText: '你向祭坛献祭了自己的生命力，金币如雨点般从虚空中落下，堆积如山。财富近在咫尺，你的脸色也变得苍白如纸。但你笑了——这个世界，钱能买到的东西太多了。',
        endingPath: 'greedy_fool',
      },
      {
        id: 'abyss_power',
        name: '深渊融合',
        description: '彻底拥抱深渊的力量（全伤害+40%，免疫恐惧和混乱，但最大HP-35）',
        icon: '👁️',
        effect: {
          damageMultiplier: 0.4,
          debuffImmune: ['fear', 'confusion'],
          playerMaxHp: -35,
        },
        narrativeText: '你张开双臂，任由深渊的力量将你彻底吞噬。力量在血管中咆哮，你的背后长出了黑色的虚影翅膀。你知道这力量终将吞噬你——但也许，在那之前，你可以先抵达终点。',
        endingPath: 'abyss_corrupted',
      },
    ],
    bossIntro: '黑暗凝聚成实体，深渊领主现身了。它是这片黑暗的化身，是所有恐惧的根源。',
    bossVictoryText: '深渊领主发出无声的嘶吼，化为黑雾消散。但你知道，深渊永远不会真正消失...龙穴的灼热，从裂缝的另一端扑面而来。',
  },
  dragon_nest: {
    theme: 'dragon_nest',
    title: '龙巢烈焰',
    introText: '灼热的空气几乎让人窒息。你来到了龙族的领地，每一步都可能惊醒沉睡中的巨龙。远古巨龙的咆哮震撼着整片山脉...在踏入最终战斗之前，你必须做出抉择。',
    campTexts: [
      '远古巨龙终于安息了。你在它的宝藏堆中搭起了临时营地——金币没过脚踝，宝石闪烁如繁星。龙的气息还在空气中流转，而你，即将踏入最后的虚空。',
      '龙鳞散落一地，闪烁着金色的光芒。你随手捡起一片，它温热如活着的心脏。',
      '一处古老的祭坛上，放置着龙族传承万年的圣物——龙心水晶。它在呼唤着你，但代价又是什么？',
    ],
    branchChoices: [
      {
        id: 'dragon_blessing',
        name: '龙族祝福',
        description: '接受龙族的神圣祝福（伤害+25%，暴击+15%，金币+20%）',
        icon: '✨',
        effect: {
          blessingType: 'critical_hit',
          damageMultiplier: 0.25,
          goldMultiplier: 0.2,
        },
        narrativeText: '你将手放在龙心水晶上，远古巨龙的灵魂认可了你的勇气。金色的龙纹从水晶蔓延到你的手臂，它们不是诅咒，而是荣耀的印记。从此，龙族视你为友。',
        endingPath: 'dragon_tamer',
      },
      {
        id: 'dragon_curse',
        name: '龙血契约',
        description: '饮下龙血获得狂暴力量（最大HP+40，荆棘反伤祝福，难度+30%）',
        icon: '🩸',
        effect: {
          playerMaxHp: 40,
          blessingType: 'thorns',
          difficultyMultiplier: 0.3,
        },
        narrativeText: '你割开巨龙的血管，将滚烫的龙血一饮而尽。力量在体内沸腾，你的皮肤长出了金色的鳞片，呼吸间带着火星。龙的诅咒与祝福并存——未来的敌人将因你而战栗。',
        endingPath: 'dragon_blood_warrior',
      },
      {
        id: 'dragon_hoard',
        name: '龙之宝藏',
        description: '带走龙族积聚千年的财富（金币+100%，最大HP+20，护盾+20）',
        icon: '💎',
        effect: {
          goldMultiplier: 1.0,
          playerMaxHp: 20,
          playerShield: 20,
        },
        narrativeText: '你将龙穴中最珍贵的宝藏收入囊中：不是金币，而是龙族世代守护的魔法圣物。每一件都价值连城，更能在战斗中为你提供保护。钱不是万能的，但没钱是万万不能的。',
        endingPath: 'wealth_collector',
      },
      {
        id: 'dragon_knight_oath',
        name: '龙骑士誓约',
        description: '与龙族缔结神圣誓约（免疫灼烧和恐惧，伤害+20%，每回合回复+3）',
        icon: '🐲',
        effect: {
          debuffImmune: ['burn', 'fear'],
          damageMultiplier: 0.2,
          regenPerTurn: 3,
        },
        narrativeText: '你跪在巨龙的遗体前立下誓言——将以龙族的名义守护这个世界。一缕龙魂融入你的身体，在你背后凝聚出半透明的金色之翼。从今以后，你就是最后一位龙骑士。',
        endingPath: 'guardian_legend',
      },
      {
        id: 'dragon_ancestor_wisdom',
        name: '龙魂智慧',
        description: '汲取远古龙族的千年智慧（暴击+20%，伤害+20%，能量+2，最大HP-15）',
        icon: '📜',
        effect: {
          critChance: 0.2,
          damageMultiplier: 0.2,
          energyGain: 2,
          playerMaxHp: -15,
        },
        narrativeText: '你将额头贴在巨龙的第三只眼位置，远古龙族的千年智慧如星河般涌入你的脑海。你看到了这个世界的诞生与毁灭，学会了无数失传的禁术。头痛欲裂，但你的眼中闪烁着星辰。',
        endingPath: 'knowledge_seeker',
      },
    ],
    bossIntro: '震天动地的咆哮响彻整个洞穴。远古巨龙睁开了它的双眼，瞳孔中燃烧着不灭的火焰。',
    bossVictoryText: '巨龙发出最后的悲鸣，缓缓闭上了双眼。它的力量归于大地，也归于你。通往虚空的裂隙在天空中缓缓打开...',
  },
  void: {
    theme: 'void',
    title: '虚空终焉',
    introText: '现实在这里扭曲，时间在这里停滞。你踏入了虚空的核心，一切规则都将被打破。虚空之主在混沌的尽头等待着你...这是最后的选择，也将决定你成为什么样的存在。',
    campTexts: [
      '虚空在你脚下裂开了一道通往真实世界的裂缝。在这里，在虚无与存在的边界上，你搭起了最后的营地。记忆碎片在你周围飘浮，每一片都是一种可能性。',
      '虚空中飘浮着无数的记忆碎片。你看到了过去，也看到了可能的未来...每一条路都通向不同的结局。',
      '一座漂浮的祭坛出现在你面前。它连接着无数的世界，也连接着最终的真相。你的手放在祭坛上——它在问：你想成为什么？',
    ],
    branchChoices: [
      {
        id: 'void_enlightenment',
        name: '虚空悟道',
        description: '超越凡俗领悟虚空真理（能量+2，法术溅射祝福，最大HP-40，伤害+25%）',
        icon: '🌌',
        effect: {
          energyGain: 2,
          blessingType: 'spell_splash',
          playerMaxHp: -40,
          damageMultiplier: 0.25,
        },
        narrativeText: '你放弃了肉身的束缚，将意识融入虚空。肉体变得脆弱，但你的精神达到了前所未有的高度。你看到了因果的线条，看到了每一个选择的涟漪——而你，将亲手编织属于自己的命运。',
        endingPath: 'void_enlightened',
      },
      {
        id: 'embrace_void_for_energy',
        name: '能量掌控',
        description: '拥抱虚空获得无尽能量（初始能量+3，连击大师祝福，伤害+20%）',
        icon: '⚡',
        effect: {
          energyGain: 3,
          blessingType: 'double_combo',
          damageMultiplier: 0.2,
        },
        narrativeText: '你张开双臂，任由虚空能量如风暴般涌入体内。符文在你的皮肤上流动，你感到自己可以释放无穷无尽的法术。能量，是一切变化的根源——而你，将成为变化本身。',
        endingPath: 'hero_victory',
      },
      {
        id: 'void_reality_bender',
        name: '现实扭曲者',
        description: '改写虚空法则为己所用（免疫所有负面效果，暴击+25%，伤害+25%，但最大HP-30）',
        icon: '🌀',
        effect: {
          debuffImmune: ['fear', 'confusion', 'amnesia', 'despair', 'darkness', 'mind_control', 'poison', 'curse', 'corruption', 'burn', 'blind'],
          critChance: 0.25,
          damageMultiplier: 0.25,
          playerMaxHp: -30,
        },
        narrativeText: '你伸手撕裂了虚空的法则，将逻辑和因果捏成你想要的形状。debuff？在你面前不过是可以随手撕碎的纸片。你不再遵守规则——你就是规则。但代价是，你将永远无法完全回到正常的世界。',
        endingPath: 'void_architect',
      },
      {
        id: 'void_star_weaver',
        name: '星辰编织者',
        description: '在虚空中收集星辰之力（伤害+40%，暴击+25%，金币+40%）',
        icon: '⭐',
        effect: {
          damageMultiplier: 0.4,
          critChance: 0.25,
          goldMultiplier: 0.4,
        },
        narrativeText: '你将虚空中飘浮的星辰一颗颗摘下，编织成一件闪耀的星光披风。每一颗星都是一个逝去世界的最后光芒，它们渴望着在你的战斗中再次绽放。你背负着亿万星光，踏上了最后的征途。',
        endingPath: 'hero_victory',
      },
      {
        id: 'void_eternal_guardian',
        name: '永恒守护者',
        description: '选择成为两个世界的守门人（最大HP+50，每回合回复+5，护盾+30，免疫绝望和虚空之触）',
        icon: '🛡️',
        effect: {
          playerMaxHp: 50,
          regenPerTurn: 5,
          playerShield: 30,
          debuffImmune: ['despair', 'void_touch'],
        },
        narrativeText: '你在祭坛前跪下，选择了最艰难也最伟大的道路——不是成为神，而是成为守护者。温暖的光从裂缝的另一边涌入你的身体，那是所有你所爱的人、所有你想守护的事物在为你加油。无论前方多么黑暗，你将永不倒下。',
        endingPath: 'guardian_legend',
      },
    ],
    bossIntro: '虚空开始剧烈震动，虚空之主从混沌中现身。它是一切的终点，也是一切的起点。',
    bossVictoryText: '虚空之主缓缓消散，化为漫天星辰。你站在虚空的尽头，一个新的世界在你面前展开...',
  },
};

export const TOWER_ENDINGS: TowerEnding[] = [
  {
    type: 'hero_victory',
    name: '英雄凯旋',
    icon: '🏆',
    color: '#FFD700',
    description: '你凭借智慧和勇气，成功征服了大秘境。你背负着亿万星辰归来，你的名字将在吟游诗人的歌声中被永远铭记。万民欢呼，举国同庆——你是真正的英雄！',
    requiredChoices: ['embrace_void_for_energy', 'void_star_weaver'],
    forbiddenChoices: ['abyss_power', 'abyss_dark_pact', 'dragon_curse'],
    goldBonus: 800,
    achievementId: 'tower_hero_victory',
  },
  {
    type: 'abyss_corrupted',
    name: '深渊腐化',
    icon: '👁️',
    color: '#4B0082',
    description: '深渊的力量最终吞噬了你的心。在击败虚空之主的那一刻，你仰天大笑——笑声却不属于人类。你的瞳孔化为无尽的黑暗，你成为了新的深渊领主，坐在虚无的王座上，等待着下一个冒险者的到来...也许有一天，会有人来终结这一切。',
    requiredChoices: ['abyss_power'],
    goldBonus: 300,
    achievementId: 'tower_abyss_corrupted',
  },
  {
    type: 'void_enlightened',
    name: '虚空悟道',
    icon: '🌌',
    color: '#1a1a2e',
    description: '你超越了凡俗的界限，领悟了虚空的真理。肉体对你而言不过是牢笼，你选择了打破它。你化作一道纯净的意识流，融入了宇宙的底层结构中。从此你无处不在，又无处可寻。凡人的悲欢离合已与你无关——因为你，就是真理本身。',
    requiredChoices: ['void_enlightenment'],
    forbiddenChoices: ['dragon_curse', 'abyss_dark_pact'],
    goldBonus: 500,
    achievementId: 'tower_void_enlightened',
  },
  {
    type: 'void_architect',
    name: '世界建筑师',
    icon: '🌀',
    color: '#6366f1',
    description: '你撕碎了旧世界的法则，成为了新规则的制定者。虚空在你面前颤抖，你随手一捏便是一颗恒星的诞生，轻轻一叹便是一个星系的寂灭。你没有选择离开虚空——你选择了留在这里，用双手构筑一个更美好的世界。也许万年之后，会有新的冒险者踏入你创造的秘境。',
    requiredChoices: ['void_reality_bender'],
    goldBonus: 600,
    achievementId: 'tower_void_architect',
  },
  {
    type: 'dragon_tamer',
    name: '御龙者',
    icon: '🐲',
    color: '#B22222',
    description: '你赢得了龙族最古老灵魂的尊重。远古巨龙的灵魂化为实体，亲昵地用头蹭着你的脸颊。你跃上它的脊背，一声长啸响彻云霄——从此，天空归你所有。你骑着巨龙翱翔于天际，所过之处万民跪拜。你的传说，将与龙族的寿命一样漫长。',
    requiredChoices: ['dragon_blessing'],
    forbiddenChoices: ['dragon_curse', 'abyss_dark_pact'],
    goldBonus: 1000,
    achievementId: 'tower_dragon_tamer',
  },
  {
    type: 'dragon_blood_warrior',
    name: '龙血战神',
    icon: '⚔️🔥',
    color: '#dc2626',
    description: '滚烫的龙血永远改变了你。你的皮肤覆有金色的鳞甲，呼吸间带着灼热的火星，一声怒吼便可震碎山岳。你拒绝了龙族的和平，选择了以战士的身份行走于世间——哪里有邪恶，哪里便有你的身影。你的剑永不卷刃，你的战意永不停歇。',
    requiredChoices: ['dragon_curse'],
    goldBonus: 700,
    achievementId: 'tower_dragon_blood_warrior',
  },
  {
    type: 'beast_master',
    name: '兽王',
    icon: '🦁',
    color: '#228B22',
    description: '丛林狼只是开始。当你走出秘境的那一刻，整个世界的野兽都感受到了你的气息，从四面八方汇聚而来。猛虎为你开路，群鸟为你歌唱，深海中的巨鲸浮出水面向你致敬。你成为了万物的共主，丛林与荒野因你的存在而重归平衡。',
    requiredChoices: ['tame_beast_for_companion'],
    goldBonus: 600,
    achievementId: 'tower_beast_master',
  },
  {
    type: 'jungle_avatar',
    name: '自然化身',
    icon: '🌳✨',
    color: '#16a34a',
    description: '丛林的生命力与你融为一体，你成为了大自然的代言者。你走过的地方鲜花盛开，枯木重新抽出新芽。你选择回到丛林，在世界树下安住——从此，大地不再有饥荒和瘟疫。每当有人在森林中迷失方向，就会看到一道绿光，那是你在为迷途者指路。',
    requiredChoices: ['accept_curse_for_power'],
    forbiddenChoices: ['abyss_power', 'abyss_dark_pact'],
    goldBonus: 500,
    achievementId: 'tower_jungle_avatar',
  },
  {
    type: 'greedy_fool',
    name: '贪婪愚人',
    icon: '💰',
    color: '#ca8a04',
    description: '你获得了可以买下十个王国的财富，却也付出了惨痛的代价。当你回到故乡，发现亲人已白发苍苍，挚友皆化为尘土——你用生命力换的金币，买不回流逝的时光。你坐在金山上度过余生，每晚都能听到深渊中传来的讥笑声。钱很多，但你一无所有。',
    requiredChoices: ['gain_gold_for_difficulty'],
    forbiddenChoices: ['void_eternal_guardian', 'dragon_knight_oath'],
    goldBonus: 2000,
    achievementId: 'tower_greedy_fool',
  },
  {
    type: 'cursed_power',
    name: '图腾继承者',
    icon: '🗿🔥',
    color: '#65a30d',
    description: '远古图腾的力量将你与这片土地永远绑定。你获得了原住民千年的智慧与力量，但你也永远无法离开丛林超过三天。你成为了新一代的图腾守护人，在岁月的长河中静静看着文明兴衰。三千年后，考古学家发现了一座神秘的图腾——他们不知道，那上面的纹路，正是你年轻时刻下的签名。',
    requiredChoices: ['jungle_ancient_totem'],
    goldBonus: 450,
    achievementId: 'tower_cursed_power',
  },
  {
    type: 'sacrificial_hero',
    name: '无名战神',
    icon: '⚔️',
    color: '#8B0000',
    description: '你舍弃了一切防御，选择了最危险的道路。每一场战斗都是生死豪赌，每一次挥剑都是背水一战。你的勇气将被后人传颂，但你的名字——无人知晓。你在击败虚空之主后力竭倒下，嘴角带着微笑。史书上称你为"无名的第十位神"，而你墓前的鲜花，从未中断。',
    requiredChoices: ['sacrifice_shield_for_crit', 'abyss_soul_sacrifice'],
    forbiddenChoices: ['gain_gold_for_difficulty', 'dragon_hoard'],
    goldBonus: 650,
    achievementId: 'tower_sacrificial_hero',
  },
  {
    type: 'guardian_legend',
    name: '永恒守护者',
    icon: '🛡️✨',
    color: '#3b82f6',
    description: '你立下了最伟大的誓言——成为两个世界之间的守门人。你站在虚空与现实的裂缝之上，左手握着地牢囚徒的祝福，右手持着龙骑士的荣耀，背后是丛林生灵的祈祷。无论多么恐怖的虚空魔物试图入侵，都无法越过你的防线。千年万年，你将永远站在那里，直到时间的尽头。',
    requiredChoices: ['void_eternal_guardian'],
    forbiddenChoices: ['abyss_power', 'abyss_dark_pact', 'gain_gold_for_difficulty'],
    goldBonus: 900,
    achievementId: 'tower_guardian_legend',
  },
  {
    type: 'balanced_sage',
    name: '平衡贤者',
    icon: '🙏',
    color: '#a855f7',
    description: '你没有选择任何极端的道路，而是在光与暗、攻与守、舍与得之间找到了完美的平衡点。你走出秘境时，身上没有夸张的力量增幅，却也没有任何代价与诅咒。你带着这份智慧回到人间，成为了一代宗师，门下弟子三千。你教导他们——真正的强大，是不被力量所改变。',
    requiredChoices: ['dungeon_prayer'],
    forbiddenChoices: ['abyss_power', 'abyss_dark_pact', 'gain_gold_for_difficulty', 'void_reality_bender'],
    goldBonus: 550,
    achievementId: 'tower_balanced_sage',
  },
  {
    type: 'dungeon_conqueror',
    name: '地牢征服者',
    icon: '🏰⚔️',
    color: '#78350f',
    description: '你与地牢中千年囚徒的灵魂产生了最深的共鸣。当你走出秘境，第一件事便是回到那座古老的地牢——用你的力量彻底摧毁了它，释放了所有被困的灵魂。千年来的第一缕阳光照进地牢最深处，囚徒们的灵魂化为光点向你道谢后升天。你成为了自由的象征，而地牢的旧址上，人们建起了以你命名的广场。',
    requiredChoices: ['dungeon_steady_guard', 'dungeon_prayer'],
    forbiddenChoices: ['abyss_power', 'abyss_dark_pact'],
    goldBonus: 750,
    achievementId: 'tower_dungeon_conqueror',
  },
  {
    type: 'default_wanderer',
    name: '世间旅者',
    icon: '🎒',
    color: '#6b7280',
    description: '你没有走任何一条极端的路，你只是......选择了活着。你带着一身伤痕和疲惫的微笑走出了秘境，没有成神，也没有成魔。你拒绝了所有的荣耀和邀约，只向国王要了一匹马、一袋干粮和一壶酒。你踏上了新的旅途——这个世界很大，秘境不过是其中的一站。远方有更多的故事在等着你。',
    requiredChoices: [],
    goldBonus: 400,
    achievementId: 'tower_default_wanderer',
  },
];

export const getThemeForFloor = (floor: number): TowerTheme => {
  return TOWER_THEMES.find(t => floor >= t.startFloor && floor <= t.endFloor) || TOWER_THEMES[0];
};

export const getNarrativeForTheme = (theme: TowerThemeType): TowerNarrative => {
  return TOWER_NARRATIVES[theme];
};

// ============== 竞技场 PVP 系统类型定义 ==============

export type RankTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'master' | 'grandmaster' | 'king' | 'legend' | '王者';

export interface RankConfig {
  tier: RankTier;
  name: string;
  minPoints: number;
  maxPoints: number;
  icon: string;
  color: string;
  starsRequired: number;
}

export const RANK_CONFIGS: RankConfig[] = [
  { tier: 'bronze', name: '青铜', minPoints: 0, maxPoints: 149, icon: '🥉', color: '#cd7f32', starsRequired: 5 },
  { tier: 'silver', name: '白银', minPoints: 150, maxPoints: 399, icon: '🥈', color: '#c0c0c0', starsRequired: 5 },
  { tier: 'gold', name: '黄金', minPoints: 400, maxPoints: 749, icon: '🥇', color: '#ffd700', starsRequired: 5 },
  { tier: 'platinum', name: '铂金', minPoints: 750, maxPoints: 1199, icon: '💎', color: '#e5e4e2', starsRequired: 5 },
  { tier: 'diamond', name: '钻石', minPoints: 1200, maxPoints: 1799, icon: '💠', color: '#b9f2ff', starsRequired: 5 },
  { tier: 'master', name: '大师', minPoints: 1800, maxPoints: 2499, icon: '🏆', color: '#9966cc', starsRequired: 5 },
  { tier: 'grandmaster', name: '宗师', minPoints: 2500, maxPoints: 3299, icon: '👑', color: '#ff6b6b', starsRequired: 5 },
  { tier: 'king', name: '王者', minPoints: 3300, maxPoints: 4199, icon: '🏅', color: '#ff4757', starsRequired: 5 },
  { tier: 'legend', name: '传奇', minPoints: 4200, maxPoints: 999999, icon: '🌟', color: '#ffa502', starsRequired: 0 },
];

export const getRankByPoints = (points: number): RankConfig => {
  for (let i = RANK_CONFIGS.length - 1; i >= 0; i--) {
    if (points >= RANK_CONFIGS[i].minPoints) return RANK_CONFIGS[i];
  }
  return RANK_CONFIGS[0];
};

export interface RankStars {
  tier: RankTier;
  stars: number;
  consecutiveWins: number;
}

export type DefenderAIStyle = 'aggressive' | 'defensive' | 'balanced' | 'tactical' | 'random';

export const DEFENDER_AI_STYLE_NAMES: Record<DefenderAIStyle, string> = {
  aggressive: '激进进攻',
  defensive: '保守防御',
  balanced: '均衡型',
  tactical: '战术型',
  random: '随机应变',
};

export const DEFENDER_AI_STYLE_DESC: Record<DefenderAIStyle, string> = {
  aggressive: '优先选择高伤害消除和攻击法术，不惜牺牲血量',
  defensive: '优先治疗和防御，积累能量后释放大法术',
  balanced: '攻守兼备，根据局势灵活调整策略',
  tactical: '注重连消和Combo法术，追求最大收益',
  random: '决策带有随机性，难以预测',
};

export interface DefenderLoadout {
  id: string;
  name: string;
  createdAt: number;
  equippedRunes: Partial<Record<ElementType, (string | null)[]>>;
  selectedSpellIds: string[];
  aiStyle: DefenderAIStyle;
  aiConfig: Partial<EnemyAIConfig>;
  playerMaxHp: number;
  description?: string;
}

export interface ArenaPlayerProfile {
  playerId: string;
  playerName: string;
  avatar: string;
  currentRank: RankTier;
  currentStars: number;
  rankPoints: number;
  highestRank: RankTier;
  highestPoints: number;
  totalWins: number;
  totalLosses: number;
  totalDraws: number;
  winStreak: number;
  bestWinStreak: number;
  seasonsPlayed: number;
  currentLoadoutId: string | null;
  loadouts: DefenderLoadout[];
  unlockedAvatarFrames: string[];
  equippedAvatarFrame: string | null;
}

export interface SeasonInfo {
  seasonId: string;
  seasonNumber: number;
  name: string;
  startDate: number;
  endDate: number;
  isActive: boolean;
  rewardsDistributed: boolean;
  pointDecayRate: number;
  description: string;
}

export interface AvatarFrameReward {
  id: string;
  name: string;
  minRank: RankTier;
  icon: string;
  borderColor: string;
  bgColor: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
}

export const AVATAR_FRAME_REWARDS: AvatarFrameReward[] = [
  { id: 'frame_bronze', name: '青铜框', minRank: 'bronze', icon: '🥉', borderColor: '#cd7f32', bgColor: 'rgba(205,127,50,0.2)', rarity: 'common' },
  { id: 'frame_silver', name: '白银框', minRank: 'silver', icon: '🥈', borderColor: '#c0c0c0', bgColor: 'rgba(192,192,192,0.2)', rarity: 'common' },
  { id: 'frame_gold', name: '黄金框', minRank: 'gold', icon: '🥇', borderColor: '#ffd700', bgColor: 'rgba(255,215,0,0.2)', rarity: 'rare' },
  { id: 'frame_platinum', name: '铂金框', minRank: 'platinum', icon: '💎', borderColor: '#e5e4e2', bgColor: 'rgba(229,228,226,0.2)', rarity: 'rare' },
  { id: 'frame_diamond', name: '钻石框', minRank: 'diamond', icon: '💠', borderColor: '#b9f2ff', bgColor: 'rgba(185,242,255,0.2)', rarity: 'epic' },
  { id: 'frame_master', name: '大师框', minRank: 'master', icon: '🏆', borderColor: '#9966cc', bgColor: 'rgba(153,102,204,0.2)', rarity: 'epic' },
  { id: 'frame_grandmaster', name: '宗师框', minRank: 'grandmaster', icon: '👑', borderColor: '#ff6b6b', bgColor: 'rgba(255,107,107,0.2)', rarity: 'legendary' },
  { id: 'frame_king', name: '王者框', minRank: 'king', icon: '🏅', borderColor: '#ff4757', bgColor: 'rgba(255,71,87,0.2)', rarity: 'legendary' },
  { id: 'frame_legend', name: '传奇框', minRank: 'legend', icon: '🌟', borderColor: '#ffa502', bgColor: 'rgba(255,165,2,0.3)', rarity: 'legendary' },
];

export interface BattleRecord {
  battleId: string;
  seasonId: string;
  attackerPlayerId: string;
  attackerName: string;
  defenderPlayerId: string;
  defenderName: string;
  defenderLoadoutId: string;
  battleCode: string;
  result: 'attacker_win' | 'defender_win' | 'draw' | 'timeout';
  attackerHpRemaining: number;
  defenderHpRemaining: number;
  totalTurns: number;
  durationMs: number;
  startedAt: number;
  endedAt: number;
  attackerPointsChange: number;
  defenderPointsChange: number;
  isRated: boolean;
  isP2P: boolean;
  replayData: BattleReplayData | null;
  timeoutSide?: 'attacker' | 'defender';
}

export interface ReplayAction {
  turn: number;
  side: 'attacker' | 'defender';
  actionType: 'match_runes' | 'cast_spell' | 'cast_combo_spell' | 'end_turn';
  timestamp: number;
  payload: any;
  hpAfter: { attacker: number; defender: number };
  energyAfter: EnergyPool;
  description: string;
}

export interface BattleReplayData {
  battleId: string;
  defenderLoadoutSnapshot: DefenderLoadout;
  attackerSpells: string[];
  initialState: {
    attackerHp: number;
    defenderHp: number;
    attackerMaxHp: number;
    defenderMaxHp: number;
  };
  actions: ReplayAction[];
  finalState: {
    attackerHp: number;
    defenderHp: number;
    result: BattleRecord['result'];
  };
  recordedAt: number;
  isP2P: boolean;
  hostPlayerId?: string;
  clientPlayerId?: string;
}

export interface PVPBattleState {
  battleId: string;
  battleCode: string;
  mode: 'offense' | 'defense';
  isStarted: boolean;
  isFinished: boolean;
  turn: number;
  isPlayerTurn: boolean;
  playerHp: number;
  playerMaxHp: number;
  enemyHp: number;
  enemyMaxHp: number;
  playerEnergy: EnergyPool;
  enemyEnergy: EnergyPool;
  maxEnergy: number;
  gridSize: number;
  runeGrid: Rune[][];
  selectedRunes: Rune[];
  playerSpells: Spell[];
  enemySpells: Spell[];
  comboSpellCooldowns: Record<string, number>;
  enemyComboSpellCooldowns: Record<string, number>;
  statusEffects: {
    player: StatusEffect[];
    enemy: StatusEffect[];
  };
  battleStatus: BattleStatus;
  isAnimating: boolean;
  floatingTexts: FloatingText[];
  screenShake: boolean;
  spellEffect: ElementType | ComboElementType | null;
  comboCount: number;
  lastActionTime: number;
  timeoutMs: number;
  defenderAIStyle: DefenderAIStyle;
  isRecordingReplay: boolean;
  replayActions: ReplayAction[];
  battleStartTime: number;
}

export interface LeaderboardEntry {
  playerId: string;
  playerName: string;
  avatar: string;
  avatarFrame: string | null;
  rank: number;
  tier: RankTier;
  rankPoints: number;
  wins: number;
  losses: number;
  winRate: number;
  winStreak: number;
}

export interface SeasonResult {
  seasonId: string;
  playerId: string;
  finalRank: RankTier;
  finalPoints: number;
  finalPosition: number;
  rewards: {
    avatarFrames: string[];
    gold: number;
  };
  rankDecayApplied: number;
  nextSeasonStartingPoints: number;
}

export interface ScheduledTask {
  taskId: string;
  taskType: 'season_end' | 'season_start' | 'point_decay' | 'reward_distribution';
  executeAt: number;
  isCompleted: boolean;
  payload: any;
  createdAt: number;
  completedAt?: number;
}

export type BattleCodeVersion = 'v1';

export interface BattleCodePayload {
  version: BattleCodeVersion;
  playerId: string;
  playerName: string;
  loadoutId: string;
  loadout: DefenderLoadout;
  rankPoints: number;
  currentRank: RankTier;
  timestamp: number;
  signature: string;
}

export const BATTLE_TIMEOUT_MS = 120000;
export const TURN_TIMEOUT_MS = 30000;
export const POINT_DECAY_RATE_PER_WEEK = 50;
export const WIN_POINTS_BASE = 25;
export const LOSS_POINTS_BASE = 15;
export const DRAW_POINTS_BASE = 8;
export const WIN_STREAK_BONUS_PER_WIN = 3;
export const MAX_WIN_STREAK_BONUS = 15;

export interface ArenaStoreState {
  currentProfile: ArenaPlayerProfile | null;
  currentSeason: SeasonInfo | null;
  currentLoadout: DefenderLoadout | null;
  battleHistory: BattleRecord[];
  leaderboard: LeaderboardEntry[];
  pendingTasks: ScheduledTask[];
  seasonResults: SeasonResult[];
  isLoading: boolean;
  error: string | null;
  currentBattle: PVPBattleState | null;
  activeReplay: BattleReplayData | null;
  isP2PBattle: boolean;
  p2pIsHost: boolean;
  p2pBattleController: any | null;
}

export interface ArenaStoreActions {
  initializeArena: () => void;
  createOrUpdateProfile: (name: string) => void;
  createLoadout: (name: string) => DefenderLoadout;
  updateLoadout: (loadoutId: string, updates: Partial<DefenderLoadout>) => void;
  deleteLoadout: (loadoutId: string) => void;
  setActiveLoadout: (loadoutId: string) => void;
  generateBattleCode: (loadoutId: string) => string;
  parseBattleCode: (code: string) => BattleCodePayload | null;
  startOffensiveBattle: (battleCode: string) => boolean;
  startPracticeBattle: () => void;
  finishPVPBattle: (result: BattleRecord['result'], replayData?: BattleReplayData) => void;
  updateRankPoints: (pointsChange: number) => RankStars;
  checkRankPromotion: () => { promoted: boolean; newTier?: RankTier };
  checkRankDemotion: () => { demoted: boolean; newTier?: RankTier };
  getLeaderboard: (limit?: number) => LeaderboardEntry[];
  getBattleHistory: (limit?: number) => BattleRecord[];
  startReplay: (battleId: string) => BattleReplayData | null;
  checkSeasonTransition: () => { seasonChanged: boolean; result?: SeasonResult };
  executeScheduledTasks: () => void;
  forceEndCurrentSeason: () => void;
  getAvatarFrameById: (frameId: string) => AvatarFrameReward | undefined;
  equipAvatarFrame: (frameId: string | null) => void;
  cleanupOldBattles: (daysToKeep?: number) => void;
  calculatePointsChange: (opponentPoints: number, result: BattleRecord['result']) => number;
  saveArenaData: () => void;
  loadArenaData: () => void;
  resetCurrentBattle: () => void;
  startP2PBattle: (controller: any, isHost: boolean) => void;
  finishP2PBattle: (result: BattleRecord['result'], replayData?: BattleReplayData, peerProfile?: ArenaPlayerProfile) => void;
}

export type ArenaStore = ArenaStoreState & ArenaStoreActions;

export interface AIDecision {
  type: 'match_runes' | 'cast_spell' | 'cast_combo_spell' | 'end_turn';
  runes?: Rune[];
  spell?: Spell;
  comboSpell?: ComboSpell;
  targetElement?: ElementType;
  priority: number;
  expectedValue: number;
  reasoning: string;
}

export interface BattleConnectionState {
  isConnected: boolean;
  lastPingTime: number;
  consecutiveTimeouts: number;
  maxConsecutiveTimeouts: number;
}

export type ConnectionStatus = 'connected' | 'warning' | 'disconnected' | 'timeout';

export interface NetworkMonitorState {
  status: ConnectionStatus;
  latency: number;
  packetLoss: number;
  lastSyncTime: number;
}

// ============== 点对点联机系统类型定义 ==============

export type P2PConnectionState = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'reconnecting' | 'error';

export type P2PRole = 'host' | 'client' | 'referee';

export type P2PMessageType = 
  | 'ping'
  | 'pong'
  | 'handshake_request'
  | 'handshake_response'
  | 'loadout_sync'
  | 'battle_init'
  | 'turn_action'
  | 'turn_ack'
  | 'state_hash'
  | 'disconnect'
  | 'reconnect_request'
  | 'reconnect_response'
  | 'timeout_warning'
  | 'battle_result'
  | 'chat_message';

export interface P2PMessage<T = any> {
  type: P2PMessageType;
  messageId: string;
  senderId: string;
  receiverId: string;
  roomCode: string;
  timestamp: number;
  payload: T;
  signature?: string;
}

export interface HandshakeRequestPayload {
  playerId: string;
  playerName: string;
  avatar: string;
  rankPoints: number;
  currentRank: RankTier;
  loadout: DefenderLoadout;
  isReferee: boolean;
  protocolVersion: string;
}

export interface HandshakeResponsePayload {
  accepted: boolean;
  playerId: string;
  playerName: string;
  avatar: string;
  rankPoints: number;
  currentRank: RankTier;
  loadout: DefenderLoadout;
  isReferee: boolean;
  refereeSeed?: number;
  error?: string;
}

export interface BattleInitPayload {
  battleId: string;
  refereeSeed: number;
  hostPlayerId: string;
  hostLoadout: DefenderLoadout;
  clientPlayerId: string;
  clientLoadout: DefenderLoadout;
  initialGridSeed: number;
  startTime: number;
  hostGoesFirst: boolean;
  isRated: boolean;
}

export interface TurnActionPayload {
  turn: number;
  actionType: 'match_runes' | 'cast_spell' | 'cast_combo_spell' | 'end_turn';
  actionData: any;
  stateAfter: {
    playerHp: number;
    enemyHp: number;
    playerEnergy: EnergyPool;
    enemyEnergy: EnergyPool;
    gridHash: string;
  };
  replayAction: ReplayAction;
}

export interface TurnAckPayload {
  turn: number;
  accepted: boolean;
  stateHash: string;
  error?: string;
}

export interface StateHashPayload {
  turn: number;
  stateHash: string;
  fullState?: Partial<PVPBattleState>;
}

export interface ReconnectRequestPayload {
  playerId: string;
  lastAcknowledgedTurn: number;
  lastActionHash: string;
}

export interface ReconnectResponsePayload {
  accepted: boolean;
  currentTurn: number;
  missingActions: TurnActionPayload[];
  currentState: Partial<PVPBattleState>;
  error?: string;
}

export interface DisconnectPayload {
  reason: 'timeout' | 'manual' | 'error';
  message?: string;
}

export interface BattleResultPayload {
  result: BattleRecord['result'];
  winnerId: string;
  reason: string;
  finalStateHash: string;
  timeoutSide?: 'host' | 'client';
}

export type P2PSessionPhase = 'waiting' | 'handshake' | 'loadout_sync' | 'battle_ready' | 'battle_started' | 'finished';

export interface P2PSession {
  roomCode: string;
  sessionId: string;
  myRole: P2PRole;
  myPlayerId: string;
  peerPlayerId: string | null;
  connectionState: P2PConnectionState;
  isHost: boolean;
  isReferee: boolean;
  phase: P2PSessionPhase;
  peerConnected: boolean;
  peerProfile?: ArenaPlayerProfile;
  peerLoadout?: DefenderLoadout;
  battleInit?: BattleInitPayload;
  connectionStats?: P2PNetworkStats;
  connectedAt: number;
  lastMessageAt: number;
  consecutivePingMs: number;
}

export interface P2PTransportConfig {
  transportType: 'local' | 'webrtc' | 'websocket';
  signalServer?: string;
  timeoutMs: number;
  reconnectAttempts: number;
}

export interface P2PNetworkStats {
  latency: number;
  packetLoss: number;
  messagesSent: number;
  messagesReceived: number;
  bytesSent: number;
  bytesReceived: number;
}

export const P2P_PROTOCOL_VERSION = '1.0.0';
export const P2P_DISCONNECT_TIMEOUT_MS = 30000;
export const P2P_RECONNECT_WINDOW_MS = 60000;
export const P2P_PING_INTERVAL_MS = 3000;
export const P2P_MAX_RECONNECT_ATTEMPTS = 5;

// ============== 成就系统类型定义 ==============

export type AchievementTier = 'bronze' | 'silver' | 'gold';

export type AchievementCategory = 'rune' | 'spell' | 'combat' | 'collection';

export type RewardType = 'avatar_frame' | 'board_skin' | 'rune_effect';

export interface AchievementTierConfig {
  tier: AchievementTier;
  threshold: number;
  name: string;
  icon: string;
  color: string;
}

export interface AchievementDefinition {
  id: string;
  name: string;
  description: string;
  category: AchievementCategory;
  statKey: string;
  tiers: AchievementTierConfig[];
  icon: string;
}

export interface AchievementProgress {
  achievementId: string;
  currentCount: number;
  completedTiers: AchievementTier[];
  claimedTiers: AchievementTier[];
}

export interface CosmeticReward {
  id: string;
  name: string;
  type: RewardType;
  description: string;
  icon: string;
  costTiers: Record<AchievementTier, number>;
  preview?: string;
}

export interface AchievementStats {
  runesEliminated: Record<ElementType, number>;
  spellsCast: Record<string, number>;
  comboSpellsCast: Record<string, number>;
  enemiesKilled: Record<string, number>;
  equipmentAcquired: Record<EquipmentQuality, number>;
  equipmentRecast: Record<EquipmentQuality, number>;
  totalBattlesWon: number;
  totalTowerFloorsCleared: number;
  totalPVPWins: number;
}

export interface AchievementSaveData {
  stats: AchievementStats;
  progress: Record<string, AchievementProgress>;
  unlockedRewards: string[];
  equippedAvatarFrame: string | null;
  equippedBoardSkin: string | null;
  equippedRuneEffect: string | null;
  medalBalance: Record<AchievementTier, number>;
  unlockedTitles: string[];
  equippedTitle: string | null;
}

export const ACHIEVEMENT_TIER_META: Record<AchievementTier, { name: string; icon: string; color: string }> = {
  bronze: { name: '铜', icon: '🥉', color: '#cd7f32' },
  silver: { name: '银', icon: '🥈', color: '#c0c0c0' },
  gold: { name: '金', icon: '🥇', color: '#ffd700' },
};

export const ACHIEVEMENT_CATEGORY_META: Record<AchievementCategory, { name: string; icon: string; color: string }> = {
  rune: { name: '符文精通', icon: '🔮', color: '#a855f7' },
  spell: { name: '法术精通', icon: '📖', color: '#3b82f6' },
  combat: { name: '战斗荣耀', icon: '⚔️', color: '#ef4444' },
  collection: { name: '收藏达人', icon: '💎', color: '#f59e0b' },
};

export const ACHIEVEMENT_DEFINITIONS: AchievementDefinition[] = [
  {
    id: 'fire_rune_master',
    name: '火之掌控者',
    description: '累计消除火系符文',
    category: 'rune',
    statKey: 'runesEliminated.fire',
    icon: '🔥',
    tiers: [
      { tier: 'bronze', threshold: 500, name: '火之掌控者·铜', icon: '🥉', color: '#cd7f32' },
      { tier: 'silver', threshold: 2000, name: '火之掌控者·银', icon: '🥈', color: '#c0c0c0' },
      { tier: 'gold', threshold: 5000, name: '火之掌控者·金', icon: '🥇', color: '#ffd700' },
    ],
  },
  {
    id: 'water_rune_master',
    name: '水之掌控者',
    description: '累计消除水系符文',
    category: 'rune',
    statKey: 'runesEliminated.water',
    icon: '💧',
    tiers: [
      { tier: 'bronze', threshold: 500, name: '水之掌控者·铜', icon: '🥉', color: '#cd7f32' },
      { tier: 'silver', threshold: 2000, name: '水之掌控者·银', icon: '🥈', color: '#c0c0c0' },
      { tier: 'gold', threshold: 5000, name: '水之掌控者·金', icon: '🥇', color: '#ffd700' },
    ],
  },
  {
    id: 'grass_rune_master',
    name: '草之掌控者',
    description: '累计消除草系符文',
    category: 'rune',
    statKey: 'runesEliminated.grass',
    icon: '🌿',
    tiers: [
      { tier: 'bronze', threshold: 500, name: '草之掌控者·铜', icon: '🥉', color: '#cd7f32' },
      { tier: 'silver', threshold: 2000, name: '草之掌控者·银', icon: '🥈', color: '#c0c0c0' },
      { tier: 'gold', threshold: 5000, name: '草之掌控者·金', icon: '🥇', color: '#ffd700' },
    ],
  },
  {
    id: 'thunder_rune_master',
    name: '雷之掌控者',
    description: '累计消除雷系符文',
    category: 'rune',
    statKey: 'runesEliminated.thunder',
    icon: '⚡',
    tiers: [
      { tier: 'bronze', threshold: 500, name: '雷之掌控者·铜', icon: '🥉', color: '#cd7f32' },
      { tier: 'silver', threshold: 2000, name: '雷之掌控者·银', icon: '🥈', color: '#c0c0c0' },
      { tier: 'gold', threshold: 5000, name: '雷之掌控者·金', icon: '🥇', color: '#ffd700' },
    ],
  },
  {
    id: 'fireball_master',
    name: '火球术大师',
    description: '累计释放火球术',
    category: 'spell',
    statKey: 'spellsCast.fireball',
    icon: '🔥',
    tiers: [
      { tier: 'bronze', threshold: 100, name: '火球术大师·铜', icon: '🥉', color: '#cd7f32' },
      { tier: 'silver', threshold: 500, name: '火球术大师·银', icon: '🥈', color: '#c0c0c0' },
      { tier: 'gold', threshold: 1500, name: '火球术大师·金', icon: '🥇', color: '#ffd700' },
    ],
  },
  {
    id: 'heal_master',
    name: '治愈之泉大师',
    description: '累计释放治愈之泉',
    category: 'spell',
    statKey: 'spellsCast.water-heal',
    icon: '💧',
    tiers: [
      { tier: 'bronze', threshold: 100, name: '治愈之泉大师·铜', icon: '🥉', color: '#cd7f32' },
      { tier: 'silver', threshold: 500, name: '治愈之泉大师·银', icon: '🥈', color: '#c0c0c0' },
      { tier: 'gold', threshold: 1500, name: '治愈之泉大师·金', icon: '🥇', color: '#ffd700' },
    ],
  },
  {
    id: 'vine_whip_master',
    name: '藤蔓抽击大师',
    description: '累计释放藤蔓抽击',
    category: 'spell',
    statKey: 'spellsCast.vine-whip',
    icon: '🌿',
    tiers: [
      { tier: 'bronze', threshold: 100, name: '藤蔓抽击大师·铜', icon: '🥉', color: '#cd7f32' },
      { tier: 'silver', threshold: 500, name: '藤蔓抽击大师·银', icon: '🥈', color: '#c0c0c0' },
      { tier: 'gold', threshold: 1500, name: '藤蔓抽击大师·金', icon: '🥇', color: '#ffd700' },
    ],
  },
  {
    id: 'thunder_strike_master',
    name: '雷霆一击大师',
    description: '累计释放雷霆一击',
    category: 'spell',
    statKey: 'spellsCast.thunder-strike',
    icon: '⚡',
    tiers: [
      { tier: 'bronze', threshold: 100, name: '雷霆一击大师·铜', icon: '🥉', color: '#cd7f32' },
      { tier: 'silver', threshold: 500, name: '雷霆一击大师·银', icon: '🥈', color: '#c0c0c0' },
      { tier: 'gold', threshold: 1500, name: '雷霆一击大师·金', icon: '🥇', color: '#ffd700' },
    ],
  },
  {
    id: 'combo_spell_master',
    name: '融合法术师',
    description: '累计释放融合法术',
    category: 'spell',
    statKey: 'comboSpellsCast._total',
    icon: '✨',
    tiers: [
      { tier: 'bronze', threshold: 50, name: '融合法术师·铜', icon: '🥉', color: '#cd7f32' },
      { tier: 'silver', threshold: 200, name: '融合法术师·银', icon: '🥈', color: '#c0c0c0' },
      { tier: 'gold', threshold: 500, name: '融合法术师·金', icon: '🥇', color: '#ffd700' },
    ],
  },
  {
    id: 'slime_slayer',
    name: '史莱姆猎人',
    description: '累计击杀史莱姆类敌人',
    category: 'combat',
    statKey: 'enemiesKilled.slime',
    icon: '🟢',
    tiers: [
      { tier: 'bronze', threshold: 10, name: '史莱姆猎人·铜', icon: '🥉', color: '#cd7f32' },
      { tier: 'silver', threshold: 50, name: '史莱姆猎人·银', icon: '🥈', color: '#c0c0c0' },
      { tier: 'gold', threshold: 100, name: '史莱姆猎人·金', icon: '🥇', color: '#ffd700' },
    ],
  },
  {
    id: 'dragon_slayer',
    name: '屠龙勇士',
    description: '累计击杀龙类敌人',
    category: 'combat',
    statKey: 'enemiesKilled.dragon',
    icon: '🐉',
    tiers: [
      { tier: 'bronze', threshold: 10, name: '屠龙勇士·铜', icon: '🥉', color: '#cd7f32' },
      { tier: 'silver', threshold: 50, name: '屠龙勇士·银', icon: '🥈', color: '#c0c0c0' },
      { tier: 'gold', threshold: 100, name: '屠龙勇士·金', icon: '🥇', color: '#ffd700' },
    ],
  },
  {
    id: 'demon_hunter',
    name: '恶魔猎人',
    description: '累计击杀恶魔类敌人',
    category: 'combat',
    statKey: 'enemiesKilled.demon',
    icon: '👹',
    tiers: [
      { tier: 'bronze', threshold: 10, name: '恶魔猎人·铜', icon: '🥉', color: '#cd7f32' },
      { tier: 'silver', threshold: 50, name: '恶魔猎人·银', icon: '🥈', color: '#c0c0c0' },
      { tier: 'gold', threshold: 100, name: '恶魔猎人·金', icon: '🥇', color: '#ffd700' },
    ],
  },
  {
    id: 'elemental_slayer',
    name: '元素征服者',
    description: '累计击杀元素类敌人',
    category: 'combat',
    statKey: 'enemiesKilled.elemental',
    icon: '🌀',
    tiers: [
      { tier: 'bronze', threshold: 10, name: '元素征服者·铜', icon: '🥉', color: '#cd7f32' },
      { tier: 'silver', threshold: 50, name: '元素征服者·银', icon: '🥈', color: '#c0c0c0' },
      { tier: 'gold', threshold: 100, name: '元素征服者·金', icon: '🥇', color: '#ffd700' },
    ],
  },
  {
    id: 'undead_slayer',
    name: '亡灵克星',
    description: '累计击杀亡灵类敌人',
    category: 'combat',
    statKey: 'enemiesKilled.undead',
    icon: '💀',
    tiers: [
      { tier: 'bronze', threshold: 10, name: '亡灵克星·铜', icon: '🥉', color: '#cd7f32' },
      { tier: 'silver', threshold: 50, name: '亡灵克星·银', icon: '🥈', color: '#c0c0c0' },
      { tier: 'gold', threshold: 100, name: '亡灵克星·金', icon: '🥇', color: '#ffd700' },
    ],
  },
  {
    id: 'beast_slayer',
    name: '野兽驯服者',
    description: '累计击杀野兽类敌人',
    category: 'combat',
    statKey: 'enemiesKilled.beast',
    icon: '🐺',
    tiers: [
      { tier: 'bronze', threshold: 10, name: '野兽驯服者·铜', icon: '🥉', color: '#cd7f32' },
      { tier: 'silver', threshold: 50, name: '野兽驯服者·银', icon: '🥈', color: '#c0c0c0' },
      { tier: 'gold', threshold: 100, name: '野兽驯服者·金', icon: '🥇', color: '#ffd700' },
    ],
  },
  {
    id: 'battle_veteran',
    name: '百战老兵',
    description: '累计赢得战斗胜利',
    category: 'combat',
    statKey: 'totalBattlesWon',
    icon: '🏆',
    tiers: [
      { tier: 'bronze', threshold: 10, name: '百战老兵·铜', icon: '🥉', color: '#cd7f32' },
      { tier: 'silver', threshold: 50, name: '百战老兵·银', icon: '🥈', color: '#c0c0c0' },
      { tier: 'gold', threshold: 200, name: '百战老兵·金', icon: '🥇', color: '#ffd700' },
    ],
  },
  {
    id: 'tower_explorer',
    name: '秘境探索者',
    description: '累计通关大秘境层数',
    category: 'combat',
    statKey: 'totalTowerFloorsCleared',
    icon: '🏔️',
    tiers: [
      { tier: 'bronze', threshold: 20, name: '秘境探索者·铜', icon: '🥉', color: '#cd7f32' },
      { tier: 'silver', threshold: 100, name: '秘境探索者·银', icon: '🥈', color: '#c0c0c0' },
      { tier: 'gold', threshold: 300, name: '秘境探索者·金', icon: '🥇', color: '#ffd700' },
    ],
  },
  {
    id: 'pvp_champion',
    name: '竞技场冠军',
    description: '累计赢得PVP对战',
    category: 'combat',
    statKey: 'totalPVPWins',
    icon: '⚔️',
    tiers: [
      { tier: 'bronze', threshold: 10, name: '竞技场冠军·铜', icon: '🥉', color: '#cd7f32' },
      { tier: 'silver', threshold: 50, name: '竞技场冠军·银', icon: '🥈', color: '#c0c0c0' },
      { tier: 'gold', threshold: 150, name: '竞技场冠军·金', icon: '🥇', color: '#ffd700' },
    ],
  },
  {
    id: 'common_collector',
    name: '初入收藏',
    description: '累计获得普通品质装备',
    category: 'collection',
    statKey: 'equipmentAcquired.common',
    icon: '📦',
    tiers: [
      { tier: 'bronze', threshold: 20, name: '初入收藏·铜', icon: '🥉', color: '#cd7f32' },
      { tier: 'silver', threshold: 100, name: '初入收藏·银', icon: '🥈', color: '#c0c0c0' },
      { tier: 'gold', threshold: 300, name: '初入收藏·金', icon: '🥇', color: '#ffd700' },
    ],
  },
  {
    id: 'rare_collector',
    name: '稀有猎手',
    description: '累计获得稀有品质装备',
    category: 'collection',
    statKey: 'equipmentAcquired.rare',
    icon: '💎',
    tiers: [
      { tier: 'bronze', threshold: 10, name: '稀有猎手·铜', icon: '🥉', color: '#cd7f32' },
      { tier: 'silver', threshold: 50, name: '稀有猎手·银', icon: '🥈', color: '#c0c0c0' },
      { tier: 'gold', threshold: 150, name: '稀有猎手·金', icon: '🥇', color: '#ffd700' },
    ],
  },
  {
    id: 'epic_collector',
    name: '史诗鉴赏家',
    description: '累计获得史诗品质装备',
    category: 'collection',
    statKey: 'equipmentAcquired.epic',
    icon: '💜',
    tiers: [
      { tier: 'bronze', threshold: 5, name: '史诗鉴赏家·铜', icon: '🥉', color: '#cd7f32' },
      { tier: 'silver', threshold: 25, name: '史诗鉴赏家·银', icon: '🥈', color: '#c0c0c0' },
      { tier: 'gold', threshold: 80, name: '史诗鉴赏家·金', icon: '🥇', color: '#ffd700' },
    ],
  },
  {
    id: 'legendary_collector',
    name: '传说追寻者',
    description: '累计获得传说品质装备',
    category: 'collection',
    statKey: 'equipmentAcquired.legendary',
    icon: '👑',
    tiers: [
      { tier: 'bronze', threshold: 2, name: '传说追寻者·铜', icon: '🥉', color: '#cd7f32' },
      { tier: 'silver', threshold: 10, name: '传说追寻者·银', icon: '🥈', color: '#c0c0c0' },
      { tier: 'gold', threshold: 30, name: '传说追寻者·金', icon: '🥇', color: '#ffd700' },
    ],
  },
];

export const ENEMY_TYPE_MAPPING: Record<string, string> = {
  slime: 'slime',
  'green_slime': 'slime',
  'tower_slime': 'slime',
  '秘境史莱姆': 'slime',
  'fire_sprite': 'elemental',
  '火焰精灵': 'elemental',
  'frost_mage': 'elemental',
  '冰霜法师': 'elemental',
  'dark_knight': 'undead',
  '暗影骑士': 'undead',
  'ancient_dragon': 'dragon',
  '远古巨龙': 'dragon',
  'shadow_demon': 'demon',
  '暗影恶魔': 'demon',
  'forest_guardian': 'beast',
  '森林守卫': 'beast',
  'tower_bat': 'beast',
  '暗影蝙蝠': 'beast',
  'tower_golem': 'elemental',
  '岩石魔像': 'elemental',
  'tower_wraith': 'undead',
  '幽影亡灵': 'undead',
  'tower_spider': 'beast',
  '毒蛛女皇': 'beast',
  'tower_vampire': 'undead',
  '血族伯爵': 'undead',
  'tower_dragon': 'dragon',
  '深渊之龙': 'dragon',
  'tower_demon': 'demon',
  '炼狱领主': 'demon',
  'tower_lich': 'undead',
  '巫妖王': 'undead',
};

export const COSMETIC_REWARDS: CosmeticReward[] = [
  {
    id: 'frame_achiever_bronze',
    name: '成就者铜框',
    type: 'avatar_frame',
    description: '铜质成就头像框，象征初心的坚持',
    icon: '🖼️',
    costTiers: { bronze: 3, silver: 0, gold: 0 },
  },
  {
    id: 'frame_achiever_silver',
    name: '成就者银框',
    type: 'avatar_frame',
    description: '银质成就头像框，象征不懈的努力',
    icon: '🖼️',
    costTiers: { bronze: 0, silver: 3, gold: 0 },
  },
  {
    id: 'frame_achiever_gold',
    name: '成就者金框',
    type: 'avatar_frame',
    description: '金质成就头像框，象征巅峰的荣耀',
    icon: '🖼️',
    costTiers: { bronze: 0, silver: 0, gold: 3 },
  },
  {
    id: 'frame_elemental_master',
    name: '元素大师头像框',
    type: 'avatar_frame',
    description: '四元素环绕的华丽头像框',
    icon: '🌈',
    costTiers: { bronze: 5, silver: 3, gold: 1 },
  },
  {
    id: 'skin_azure_board',
    name: '蔚蓝棋盘',
    type: 'board_skin',
    description: '海洋主题的蓝色棋盘皮肤',
    icon: '🌊',
    costTiers: { bronze: 3, silver: 2, gold: 0 },
  },
  {
    id: 'skin_inferno_board',
    name: '烈焰棋盘',
    type: 'board_skin',
    description: '火焰主题的炽热棋盘皮肤',
    icon: '🔥',
    costTiers: { bronze: 2, silver: 3, gold: 0 },
  },
  {
    id: 'skin_cosmic_board',
    name: '星空棋盘',
    type: 'board_skin',
    description: '宇宙主题的璀璨棋盘皮肤',
    icon: '🌌',
    costTiers: { bronze: 0, silver: 5, gold: 2 },
  },
  {
    id: 'effect_fire_trail',
    name: '烈焰拖尾',
    type: 'rune_effect',
    description: '火系符文消除时绽放火焰粒子特效',
    icon: '🔥✨',
    costTiers: { bronze: 4, silver: 0, gold: 0 },
  },
  {
    id: 'effect_ice_shatter',
    name: '冰霜碎裂',
    type: 'rune_effect',
    description: '水系符文消除时展现冰晶碎裂特效',
    icon: '💎❄️',
    costTiers: { bronze: 4, silver: 0, gold: 0 },
  },
  {
    id: 'effect_nature_bloom',
    name: '自然绽放',
    type: 'rune_effect',
    description: '草系符文消除时展现花朵绽放特效',
    icon: '🌸',
    costTiers: { bronze: 0, silver: 4, gold: 0 },
  },
  {
    id: 'effect_thunder_pulse',
    name: '雷霆脉冲',
    type: 'rune_effect',
    description: '雷系符文消除时展现电弧脉冲特效',
    icon: '⚡💫',
    costTiers: { bronze: 0, silver: 0, gold: 2 },
  },
  {
    id: 'effect_rainbow_aura',
    name: '彩虹光环',
    type: 'rune_effect',
    description: '所有符文消除时展现彩虹光环特效',
    icon: '🌈✨',
    costTiers: { bronze: 5, silver: 5, gold: 3 },
  },
];

// ============== 战斗回放与记录系统类型定义 ==============

export enum BattleEventType {
  MATCH_RUNES = 'match_runes',
  CHAIN_COMBO = 'chain_combo',
  CAST_SPELL = 'cast_spell',
  CAST_COMBO_SPELL = 'cast_combo_spell',
  ENEMY_BEHAVIOR = 'enemy_behavior',
  PLAYER_HP_CHANGE = 'player_hp_change',
  ENEMY_HP_CHANGE = 'enemy_hp_change',
  ENERGY_CHANGE = 'energy_change',
  TURN_START = 'turn_start',
  TURN_END = 'turn_end',
  STATUS_EFFECT = 'status_effect',
  BATTLE_START = 'battle_start',
  BATTLE_END = 'battle_end',
  MINION_SUMMONED = 'minion_summoned',
  MINION_KILLED = 'minion_killed',
  TERRAIN_EFFECT = 'terrain_effect',
}

export type HighlightType = 
  | 'mega_combo'
  | 'crit_kill_boss'
  | 'low_hp_comeback'
  | 'perfect_chain'
  | 'spell_burst'
  | 'boss_slayer';

export interface RuneCoord {
  row: number;
  col: number;
}

export interface MatchRunesPayload {
  element: ElementType;
  path: RuneCoord[];
  matchCount: number;
  energyGained: Partial<EnergyPool>;
  damageDealt?: number;
  isDoubleEnergy: boolean;
}

export interface ChainComboPayload {
  comboLevel: number;
  totalChainCount: number;
  matchedElements: Record<ElementType, number>;
  totalEnergyGained: Partial<EnergyPool>;
  matchPaths: RuneCoord[][];
}

export interface CastSpellPayload {
  spellId: string;
  spellName: string;
  element: ElementType;
  targetUnitId: string | null;
  targetUnitName: string | null;
  damageDealt: number;
  healAmount: number;
  isEffective: boolean;
  isWeak: boolean;
  isCritical?: boolean;
  targetKilled: boolean;
}

export interface CastComboSpellPayload {
  spellId: string;
  spellName: string;
  elements: ComboElementType;
  targetUnitId: string | null;
  targetUnitName: string | null;
  damageDealt: number;
  effectApplied: StatusEffectType;
  effectValue: number;
  effectDuration: number;
  targetKilled: boolean;
}

export interface EnemyBehaviorPayload {
  turn: number;
  behaviorType: EnemyBehaviorType;
  behaviorDescription: string;
  damageToPlayer: number;
  isBerserk: boolean;
  isDefending: boolean;
  chargeSkillName?: string;
  chargeDamage?: number;
  summonedMinionName?: string;
}

export interface HpChangePayload {
  unitType: 'player' | 'enemy' | 'minion';
  unitId: string | null;
  unitName: string | null;
  oldHp: number;
  newHp: number;
  maxHp: number;
  delta: number;
  reason: string;
}

export interface EnergyChangePayload {
  oldEnergy: EnergyPool;
  newEnergy: EnergyPool;
  delta: Partial<EnergyPool>;
  reason: string;
}

export interface StatusEffectPayload {
  targetType: 'player' | 'enemy';
  effectType: StatusEffectType;
  effectName: string;
  duration: number;
  value: number;
  damagePerTurn?: number;
}

export interface MinionEventPayload {
  minionId: string;
  minionName: string;
  minionSprite: string;
  maxHp: number;
  attack?: number;
  explosionDamage?: number;
}

export interface TerrainEffectPayload {
  terrainType: TerrainType;
  effectDescription: string;
  affectedRuneCount?: number;
  damageToPlayer?: number;
}

export interface BattleEndPayload {
  result: 'victory' | 'defeat';
  totalTurns: number;
  totalDamageDealt: number;
  totalDamageTaken: number;
  totalRunesMatched: number;
  totalSpellsCast: number;
  maxComboReached: number;
}

export type BattleEventPayload =
  | MatchRunesPayload
  | ChainComboPayload
  | CastSpellPayload
  | CastComboSpellPayload
  | EnemyBehaviorPayload
  | HpChangePayload
  | EnergyChangePayload
  | StatusEffectPayload
  | MinionEventPayload
  | TerrainEffectPayload
  | BattleEndPayload
  | Record<string, unknown>;

export interface BattleEvent {
  id: string;
  type: BattleEventType;
  timestamp: number;
  turn: number;
  isPlayerSide: boolean;
  payload: BattleEventPayload;
  eventIndex: number;
}

export interface HighlightMoment {
  id: string;
  type: HighlightType;
  title: string;
  description: string;
  startEventIndex: number;
  endEventIndex: number;
  startTimestamp: number;
  endTimestamp: number;
  data: Record<string, unknown>;
  icon: string;
}

export interface ShareCardData {
  highlightId: string;
  highlightType: HighlightType;
  title: string;
  subtitle: string;
  highlightName: string;
  battleId: string;
  levelId: number;
  levelName: string;
  enemyName: string;
  result: 'victory' | 'defeat';
  totalTurns: number;
  turnNumber: number;
  stats: {
    maxCombo?: number;
    totalDamage?: number;
    critDamage?: number;
    remainingHp?: number;
    remainingHpPercent?: number;
  };
  runeEffects: ElementType[];
  backgroundColor: string;
  accentColor: string;
  primaryColor: string;
  generatedAt: number;
}

export interface ReplayStateSnapshot {
  snapshotIndex: number;
  eventIndex: number;
  turn: number;
  playerHp: number;
  playerMaxHp: number;
  enemyHp: number;
  enemyMaxHp: number;
  energy: EnergyPool;
  gridSize: number;
}

export type QuestType = 'daily' | 'weekly';
export type QuestStatus = 'in_progress' | 'completed' | 'claimed';

export interface QuestDefinition {
  id: string;
  name: string;
  description: string;
  type: QuestType;
  statKey: string;
  target: number;
  expReward: number;
  icon: string;
}

export interface QuestProgress {
  questId: string;
  current: number;
  target: number;
  status: QuestStatus;
  startSnapshot: number;
}

export interface BattlePassSeason {
  seasonId: string;
  seasonNumber: number;
  name: string;
  startDate: number;
  endDate: number;
  isActive: boolean;
  maxLevel: number;
  expPerLevel: number;
  description: string;
}

export interface BattlePassLevelReward {
  level: number;
  type: 'cosmetic' | 'gold' | 'medal' | 'title';
  id: string;
  name: string;
  icon: string;
  isPremium: boolean;
}

export interface BattlePassSaveData {
  currentSeasonId: string | null;
  level: number;
  currentExp: number;
  totalExpEarned: number;
  premiumUnlocked: boolean;
  claimedLevels: number[];
  dailyQuests: QuestProgress[];
  weeklyQuests: QuestProgress[];
  lastDailyRefresh: number;
  lastWeeklyRefresh: number;
  seasonStartStats: AchievementStats | null;
}

export const BATTLE_PASS_SEASON_DAYS = 28;
export const DAILY_QUEST_COUNT = 3;
export const WEEKLY_QUEST_COUNT = 2;
export const BATTLE_PASS_MAX_LEVEL = 50;
export const BATTLE_PASS_EXP_PER_LEVEL = 100;

export const DAILY_QUEST_POOL: QuestDefinition[] = [
  {
    id: 'daily_cast_fireball',
    name: '烈焰法师',
    description: '释放 5 次火球术',
    type: 'daily',
    statKey: 'spellsCast.fireball',
    target: 5,
    expReward: 30,
    icon: '🔥',
  },
  {
    id: 'daily_cast_heal',
    name: '生命之泉',
    description: '释放 3 次治愈之泉',
    type: 'daily',
    statKey: 'spellsCast.water-heal',
    target: 3,
    expReward: 30,
    icon: '💧',
  },
  {
    id: 'daily_cast_thunder',
    name: '雷霆使者',
    description: '释放 3 次雷霆一击',
    type: 'daily',
    statKey: 'spellsCast.thunder-strike',
    target: 3,
    expReward: 30,
    icon: '⚡',
  },
  {
    id: 'daily_cast_vine',
    name: '自然之力',
    description: '释放 4 次藤蔓抽击',
    type: 'daily',
    statKey: 'spellsCast.vine-whip',
    target: 4,
    expReward: 30,
    icon: '🌿',
  },
  {
    id: 'daily_fire_runes',
    name: '火焰符文师',
    description: '消除 30 个火属性符文',
    type: 'daily',
    statKey: 'runesEliminated.fire',
    target: 30,
    expReward: 25,
    icon: '🔴',
  },
  {
    id: 'daily_water_runes',
    name: '流水符文师',
    description: '消除 30 个水属性符文',
    type: 'daily',
    statKey: 'runesEliminated.water',
    target: 30,
    expReward: 25,
    icon: '🔵',
  },
  {
    id: 'daily_grass_runes',
    name: '自然符文师',
    description: '消除 30 个草属性符文',
    type: 'daily',
    statKey: 'runesEliminated.grass',
    target: 30,
    expReward: 25,
    icon: '🟢',
  },
  {
    id: 'daily_thunder_runes',
    name: '雷霆符文师',
    description: '消除 30 个雷属性符文',
    type: 'daily',
    statKey: 'runesEliminated.thunder',
    target: 30,
    expReward: 25,
    icon: '🟡',
  },
  {
    id: 'daily_tower_floors',
    name: '秘境探索者',
    description: '在大秘境中爬过 3 层',
    type: 'daily',
    statKey: 'totalTowerFloorsCleared',
    target: 3,
    expReward: 40,
    icon: '🏰',
  },
  {
    id: 'daily_battles_won',
    name: '初战告捷',
    description: '赢得 2 场战斗',
    type: 'daily',
    statKey: 'totalBattlesWon',
    target: 2,
    expReward: 35,
    icon: '⚔️',
  },
  {
    id: 'daily_rare_equipment',
    name: '宝藏猎人',
    description: '获得一件稀有品质以上装备',
    type: 'daily',
    statKey: 'equipmentAcquired.rare+',
    target: 1,
    expReward: 50,
    icon: '💎',
  },
  {
    id: 'daily_combo_spells',
    name: '融合学徒',
    description: '释放 2 次融合法术',
    type: 'daily',
    statKey: 'comboSpellsCast._total',
    target: 2,
    expReward: 45,
    icon: '✨',
  },
  {
    id: 'daily_pvp_win',
    name: '竞技新星',
    description: '在 PVP 中赢得 1 场胜利',
    type: 'daily',
    statKey: 'totalPVPWins',
    target: 1,
    expReward: 60,
    icon: '🏆',
  },
  {
    id: 'daily_enemies_killed',
    name: '怪物猎人',
    description: '击杀 5 个敌人',
    type: 'daily',
    statKey: 'enemiesKilled._total',
    target: 5,
    expReward: 30,
    icon: '👹',
  },
  {
    id: 'daily_total_runes',
    name: '符文消除者',
    description: '累计消除 100 个符文',
    type: 'daily',
    statKey: 'runesEliminated._total',
    target: 100,
    expReward: 35,
    icon: '🔮',
  },
];

export const WEEKLY_QUEST_POOL: QuestDefinition[] = [
  {
    id: 'weekly_fire_runes',
    name: '烈焰大师',
    description: '本周累计消除 500 个火属性符文',
    type: 'weekly',
    statKey: 'runesEliminated.fire',
    target: 500,
    expReward: 200,
    icon: '🔥',
  },
  {
    id: 'weekly_water_runes',
    name: '流水大师',
    description: '本周累计消除 500 个水属性符文',
    type: 'weekly',
    statKey: 'runesEliminated.water',
    target: 500,
    expReward: 200,
    icon: '💧',
  },
  {
    id: 'weekly_grass_runes',
    name: '自然大师',
    description: '本周累计消除 500 个草属性符文',
    type: 'weekly',
    statKey: 'runesEliminated.grass',
    target: 500,
    expReward: 200,
    icon: '🌿',
  },
  {
    id: 'weekly_thunder_runes',
    name: '雷霆大师',
    description: '本周累计消除 500 个雷属性符文',
    type: 'weekly',
    statKey: 'runesEliminated.thunder',
    target: 500,
    expReward: 200,
    icon: '⚡',
  },
  {
    id: 'weekly_pvp_wins',
    name: '竞技达人',
    description: '在 PVP 中赢得 5 场胜利',
    type: 'weekly',
    statKey: 'totalPVPWins',
    target: 5,
    expReward: 250,
    icon: '🏆',
  },
  {
    id: 'weekly_tower_floors',
    name: '秘境征服者',
    description: '在大秘境中爬过 15 层',
    type: 'weekly',
    statKey: 'totalTowerFloorsCleared',
    target: 15,
    expReward: 220,
    icon: '🏰',
  },
  {
    id: 'weekly_combo_spells',
    name: '融合大师',
    description: '累计释放 20 次融合法术',
    type: 'weekly',
    statKey: 'comboSpellsCast._total',
    target: 20,
    expReward: 180,
    icon: '✨',
  },
  {
    id: 'weekly_battles_won',
    name: '常胜将军',
    description: '赢得 15 场战斗',
    type: 'weekly',
    statKey: 'totalBattlesWon',
    target: 15,
    expReward: 180,
    icon: '⚔️',
  },
  {
    id: 'weekly_enemies_killed',
    name: '屠戮者',
    description: '击杀 30 个敌人',
    type: 'weekly',
    statKey: 'enemiesKilled._total',
    target: 30,
    expReward: 160,
    icon: '💀',
  },
  {
    id: 'weekly_epic_equipment',
    name: '史诗收藏家',
    description: '获得 3 件史诗品质以上装备',
    type: 'weekly',
    statKey: 'equipmentAcquired.epic+',
    target: 3,
    expReward: 280,
    icon: '💜',
  },
  {
    id: 'weekly_total_runes',
    name: '符文大师',
    description: '累计消除 1500 个符文',
    type: 'weekly',
    statKey: 'runesEliminated._total',
    target: 1500,
    expReward: 200,
    icon: '🔮',
  },
  {
    id: 'weekly_spells_cast',
    name: '法术狂潮',
    description: '累计释放 100 次法术',
    type: 'weekly',
    statKey: 'spellsCast._total',
    target: 100,
    expReward: 180,
    icon: '📖',
  },
];

export interface PlayerTitle {
  id: string;
  name: string;
  icon: string;
  description: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
}

export const PLAYER_TITLES: PlayerTitle[] = [
  { id: 'title_beginner', name: '初级冒险者', icon: '🎖️', description: '踏上冒险之路的新人', rarity: 'common' },
  { id: 'title_veteran', name: '资深冒险者', icon: '🏅', description: '经验丰富的冒险家', rarity: 'rare' },
  { id: 'title_master', name: '大师级冒险者', icon: '👑', description: '技艺精湛的大师', rarity: 'epic' },
  { id: 'title_legend', name: '传奇冒险者', icon: '🌟', description: '传说中的英雄', rarity: 'legendary' },
  { id: 'title_grandmaster', name: '宗师级冒险者', icon: '🏆', description: '站在巅峰的宗师', rarity: 'legendary' },
  { id: 'title_season_winner', name: '赛季冠军', icon: '🥇', description: '赛季排名第一', rarity: 'legendary' },
];

export const BATTLE_PASS_REWARDS: BattlePassLevelReward[] = [
  { level: 1, type: 'gold', id: 'gold_100', name: '100 金币', icon: '🪙', isPremium: false },
  { level: 2, type: 'medal', id: 'bronze_1', name: '铜质勋章 x1', icon: '🥉', isPremium: false },
  { level: 3, type: 'gold', id: 'gold_150', name: '150 金币', icon: '🪙', isPremium: true },
  { level: 4, type: 'cosmetic', id: 'skin_azure_board', name: '蔚蓝棋盘皮肤', icon: '🌊', isPremium: false },
  { level: 5, type: 'medal', id: 'silver_1', name: '银质勋章 x1', icon: '🥈', isPremium: false },
  { level: 6, type: 'gold', id: 'gold_200', name: '200 金币', icon: '🪙', isPremium: true },
  { level: 7, type: 'cosmetic', id: 'effect_fire_trail', name: '烈焰拖尾特效', icon: '🔥✨', isPremium: false },
  { level: 8, type: 'medal', id: 'bronze_2', name: '铜质勋章 x2', icon: '🥉', isPremium: true },
  { level: 9, type: 'gold', id: 'gold_250', name: '250 金币', icon: '🪙', isPremium: false },
  { level: 10, type: 'title', id: 'title_beginner', name: '初级冒险者', icon: '🎖️', isPremium: false },
  { level: 11, type: 'gold', id: 'gold_300', name: '300 金币', icon: '🪙', isPremium: true },
  { level: 12, type: 'medal', id: 'silver_2', name: '银质勋章 x2', icon: '🥈', isPremium: false },
  { level: 13, type: 'cosmetic', id: 'frame_achiever_silver', name: '成就者银框', icon: '🖼️', isPremium: true },
  { level: 14, type: 'gold', id: 'gold_350', name: '350 金币', icon: '🪙', isPremium: false },
  { level: 15, type: 'medal', id: 'gold_1', name: '金质勋章 x1', icon: '🥇', isPremium: false },
  { level: 16, type: 'cosmetic', id: 'frame_achiever_bronze', name: '成就者铜框', icon: '🖼️', isPremium: true },
  { level: 17, type: 'gold', id: 'gold_400', name: '400 金币', icon: '🪙', isPremium: false },
  { level: 18, type: 'medal', id: 'silver_3', name: '银质勋章 x3', icon: '🥈', isPremium: true },
  { level: 19, type: 'gold', id: 'gold_450', name: '450 金币', icon: '🪙', isPremium: false },
  { level: 20, type: 'title', id: 'title_veteran', name: '资深冒险者', icon: '🏅', isPremium: false },
  { level: 21, type: 'cosmetic', id: 'effect_nature_bloom', name: '自然绽放特效', icon: '🌸', isPremium: true },
  { level: 22, type: 'gold', id: 'gold_500', name: '500 金币', icon: '🪙', isPremium: false },
  { level: 23, type: 'medal', id: 'gold_2', name: '金质勋章 x2', icon: '🥇', isPremium: true },
  { level: 24, type: 'cosmetic', id: 'skin_inferno_board', name: '烈焰棋盘皮肤', icon: '🔥', isPremium: false },
  { level: 25, type: 'gold', id: 'gold_600', name: '600 金币', icon: '🪙', isPremium: true },
  { level: 26, type: 'medal', id: 'silver_4', name: '银质勋章 x4', icon: '🥈', isPremium: false },
  { level: 27, type: 'cosmetic', id: 'frame_elemental_master', name: '元素大师头像框', icon: '🌈', isPremium: true },
  { level: 28, type: 'gold', id: 'gold_700', name: '700 金币', icon: '🪙', isPremium: false },
  { level: 29, type: 'medal', id: 'gold_3', name: '金质勋章 x3', icon: '🥇', isPremium: true },
  { level: 30, type: 'title', id: 'title_master', name: '大师级冒险者', icon: '👑', isPremium: false },
  { level: 31, type: 'gold', id: 'gold_800', name: '800 金币', icon: '🪙', isPremium: false },
  { level: 32, type: 'cosmetic', id: 'effect_thunder_pulse', name: '雷霆脉冲特效', icon: '⚡💫', isPremium: true },
  { level: 33, type: 'medal', id: 'gold_4', name: '金质勋章 x4', icon: '🥇', isPremium: false },
  { level: 34, type: 'gold', id: 'gold_900', name: '900 金币', icon: '🪙', isPremium: true },
  { level: 35, type: 'cosmetic', id: 'skin_cosmic_board', name: '星空棋盘皮肤', icon: '🌌', isPremium: false },
  { level: 36, type: 'medal', id: 'gold_5', name: '金质勋章 x5', icon: '🥇', isPremium: true },
  { level: 37, type: 'gold', id: 'gold_1000', name: '1000 金币', icon: '🪙', isPremium: false },
  { level: 38, type: 'cosmetic', id: 'frame_achiever_gold', name: '成就者金框', icon: '🖼️', isPremium: true },
  { level: 39, type: 'gold', id: 'gold_1200', name: '1200 金币', icon: '🪙', isPremium: false },
  { level: 40, type: 'title', id: 'title_legend', name: '传奇冒险者', icon: '🌟', isPremium: false },
  { level: 41, type: 'medal', id: 'gold_6', name: '金质勋章 x6', icon: '🥇', isPremium: true },
  { level: 42, type: 'gold', id: 'gold_1500', name: '1500 金币', icon: '🪙', isPremium: false },
  { level: 43, type: 'cosmetic', id: 'effect_rainbow_aura', name: '彩虹光环特效', icon: '🌈✨', isPremium: true },
  { level: 44, type: 'gold', id: 'gold_1800', name: '1800 金币', icon: '🪙', isPremium: false },
  { level: 45, type: 'cosmetic', id: 'skin_cosmic_board', name: '星空棋盘皮肤', icon: '🌠', isPremium: true },
  { level: 46, type: 'medal', id: 'gold_8', name: '金质勋章 x8', icon: '🥇', isPremium: false },
  { level: 47, type: 'gold', id: 'gold_2000', name: '2000 金币', icon: '🪙', isPremium: true },
  { level: 48, type: 'cosmetic', id: 'effect_rainbow_aura', name: '彩虹光环特效', icon: '🌈', isPremium: false },
  { level: 49, type: 'gold', id: 'gold_2500', name: '2500 金币', icon: '🪙', isPremium: true },
  { level: 50, type: 'title', id: 'title_grandmaster', name: '宗师级冒险者', icon: '🏆', isPremium: false },
];

export interface BattleReplayV2 {
  replayVersion: 'v2';
  battleId: string;
  levelId: number;
  levelName: string;
  enemyName: string;
  enemySprite: string;
  startedAt: number;
  endedAt: number;
  durationMs: number;
  result: 'victory' | 'defeat';
  totalTurns: number;
  initialState: {
    playerHp: number;
    playerMaxHp: number;
    enemyHp: number;
    enemyMaxHp: number;
    energy: EnergyPool;
    gridSize: number;
  };
  events: BattleEvent[];
  snapshots: ReplayStateSnapshot[];
  highlights: HighlightMoment[];
  hpTimeline: {
    player: number[];
    enemy: number[];
    turnMarkers: number[];
  };
  stats: {
    totalDamageDealt: number;
    totalDamageTaken: number;
    totalRunesMatched: number;
    totalSpellsCast: number;
    totalComboSpellsCast: number;
    maxComboReached: number;
    totalChainCombos: number;
    criticalHits: number;
  };
}

export interface CompressedEventHeader {
  t: number;
  i: number;
  e: number;
  p: boolean;
}

export interface CompressedReplayData {
  version: 'v2';
  meta: {
    id: string;
    lid: number;
    ln: string;
    en: string;
    es: string;
    sa: number;
    ea: number;
    dr: number;
    rs: 'victory' | 'defeat';
    tt: number;
  };
  init: {
    php: number;
    pmh: number;
    ehp: number;
    emh: number;
    en: EnergyPool;
    gs: number;
  };
  evts: string;
  snaps: string;
  hls: string;
  htl: {
    p: number[];
    e: number[];
    m: number[];
  };
  sts: {
    tdd: number;
    tdt: number;
    trm: number;
    tsc: number;
    tcsc: number;
    mcr: number;
    tcc: number;
    ch: number;
  };
}

export interface ReplayListEntry {
  battleId: string;
  levelId: number;
  levelName: string;
  enemyName: string;
  result: 'victory' | 'defeat';
  totalTurns: number;
  durationMs: number;
  recordedAt: number;
  fileSize: number;
  hasHighlights: boolean;
  highlightCount: number;
}

export interface ReplayStorageStats {
  totalReplays: number;
  totalSizeBytes: number;
  totalSizeMB: string;
  oldestReplayDate: number | null;
  newestReplayDate: number | null;
}

export interface ReplayPlaybackState {
  currentEventIndex: number;
  currentTurn: number;
  isPlaying: boolean;
  playbackSpeed: 1 | 2 | 4;
  isPaused: boolean;
  playerHp: number;
  enemyHp: number;
  energy: EnergyPool;
  highlightedCells: RuneCoord[];
  currentHighlight: HighlightMoment | null;
  visibleEvents: BattleEvent[];
}

export type ReplayNavigationTarget = 
  | { type: 'event'; eventIndex: number }
  | { type: 'turn'; turn: number }
  | { type: 'highlight'; highlightId: string }
  | { type: 'start' }
  | { type: 'end' }
  | { type: 'next_turn' }
  | { type: 'prev_turn' }
  | { type: 'next_highlight' }
  | { type: 'prev_highlight' };

export const HIGHLIGHT_TYPE_META: Record<HighlightType, { name: string; icon: string; color: string }> = {
  mega_combo: { name: '超级连消', icon: '🔥🔥🔥', color: '#f97316' },
  crit_kill_boss: { name: '暴击秒杀', icon: '💥⚔️', color: '#ef4444' },
  low_hp_comeback: { name: '丝血反杀', icon: '❤️‍🔥', color: '#ec4899' },
  perfect_chain: { name: '完美连锁', icon: '✨🔗', color: '#8b5cf6' },
  spell_burst: { name: '法术爆发', icon: '✨💫', color: '#3b82f6' },
  boss_slayer: { name: 'BOSS终结者', icon: '🏆👑', color: '#f59e0b' },
};

