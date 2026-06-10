export type ElementType = 'fire' | 'water' | 'grass' | 'thunder';

export type ComboElementType = 'fire+grass' | 'water+thunder' | 'fire+water';

export type StatusEffectType = 'burn' | 'paralyze' | 'resistance_down';

export type TileType = 'normal' | 'obstacle' | 'frozen' | 'double_energy';

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
  energy: EnergyPool;
  maxEnergy: number;
  gridSize: number;
  runeGrid: Rune[][];
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
}

export interface GameActions {
  initLevel: (levelId: number) => void;
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
};

export const STATUS_EFFECT_ICONS: Record<StatusEffectType, string> = {
  burn: '🔥',
  paralyze: '⚡',
  resistance_down: '💨',
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
  | 'enrage_enemy';

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
  | 'thorns';

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

export interface TowerFloor {
  floor: number;
  enemy: Enemy;
  debuffs: TowerDebuff[];
  blessings: TowerBlessing[];
  isBoss: boolean;
  isCamp: boolean;
  goldReward: number;
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
];

export const BLESSING_RARITY_WEIGHTS: Record<string, [number, number, number]> = {
  shop: [50, 35, 15],
  floor: [60, 30, 10],
};

export const TOWER_TOTAL_FLOORS = 50;
export const TOWER_CAMP_INTERVAL = 3;
export const TOWER_BOSS_INTERVAL = 10;
