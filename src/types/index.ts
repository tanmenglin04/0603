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

