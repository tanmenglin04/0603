import type { WorkshopLevel, ValidationResult, EditorCell, WorkshopEnemy, WorkshopSpecialTiles, WorkshopTerrainConfig, TrialRecord } from '../types/workshop';
import { WORKSHOP_VERSION, DIFFICULTY_META } from '../types/workshop';
import type { TileType, TerrainType, EnemyAIPriority, EnemyBehaviorType, ElementType } from '../types';

const VALID_TILE_TYPES: TileType[] = ['normal', 'obstacle', 'frozen', 'double_energy'];
const VALID_TERRAIN_TYPES: TerrainType[] = ['magma', 'frost', 'thorns', 'storm'];
const VALID_AI_PRIORITIES: EnemyAIPriority[] = ['aggressive', 'defensive', 'balanced', 'tactical'];
const VALID_BEHAVIORS: EnemyBehaviorType[] = ['charge', 'defend', 'summon', 'berserk', 'normal'];
const VALID_ELEMENTS: ElementType[] = ['fire', 'water', 'grass', 'thunder'];
const VALID_DIFFICULTIES: string[] = ['easy', 'medium', 'hard', 'extreme'];

const MIN_GRID_SIZE = 4;
const MAX_GRID_SIZE = 8;
const MIN_PLAYER_HP = 50;
const MAX_PLAYER_HP = 500;
const MIN_ENERGY = 5;
const MAX_ENERGY = 30;
const MIN_ENEMY_HP = 30;
const MAX_ENEMY_HP = 1000;
const MIN_ENEMY_ATTACK = 5;
const MAX_ENEMY_ATTACK = 100;
const MAX_NAME_LENGTH = 50;
const MAX_DESC_LENGTH = 500;
const MAX_TRIAL_ACTIONS = 200;
const MAX_LEVEL_SIZE_BYTES = 50 * 1024;
const MIN_STARS = [1, 1, 1];
const MAX_STARS = [100, 100, 100];
const MAX_TAGS = 10;
const MAX_TAG_LENGTH = 20;
const MAX_AUTHOR_NAME_LENGTH = 30;

const SANITIZE_PATTERNS = [
  /<script[^>]*>[\s\S]*?<\/script>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi,
  /<iframe[^>]*>[\s\S]*?<\/iframe>/gi,
  /<object[^>]*>[\s\S]*?<\/object>/gi,
  /<embed[^>]*>/gi,
  /<img[^>]*>/gi,
  /<svg[^>]*>[\s\S]*?<\/svg>/gi,
  /data:/i,
  /eval\(/gi,
  /function\s*\(/gi,
  /\)\s*=>/gi,
  /setTimeout|setInterval/gi,
  /document\.|window\.|globalThis\./gi,
];

export const sanitizeString = (input: string, maxLength: number): string => {
  let result = input || '';
  
  for (const pattern of SANITIZE_PATTERNS) {
    result = result.replace(pattern, '');
  }
  
  result = result.replace(/[<>]/g, '');
  
  if (result.length > maxLength) {
    result = result.substring(0, maxLength);
  }
  
  return result.trim();
};

export const validateNumber = (value: any, min: number, max: number): number | null => {
  const num = Number(value);
  if (isNaN(num) || !isFinite(num)) return null;
  if (num < min || num > max) return null;
  return Math.floor(num);
};

export const validateStringArray = (arr: any, maxItems: number, maxItemLength: number): string[] => {
  if (!Array.isArray(arr)) return [];
  return arr
    .slice(0, maxItems)
    .map(item => sanitizeString(String(item), maxItemLength))
    .filter(item => item.length > 0);
};

export const validateEditorCells = (cells: any, gridSize: number): EditorCell[] => {
  if (!Array.isArray(cells)) return [];
  
  const validCells: EditorCell[] = [];
  const cellSet = new Set<string>();
  
  const maxCells = gridSize * gridSize;
  
  for (let i = 0; i < Math.min(cells.length, maxCells); i++) {
    const cell = cells[i];
    if (!cell || typeof cell !== 'object') continue;
    
    const row = validateNumber(cell.row, 0, gridSize - 1);
    const col = validateNumber(cell.col, 0, gridSize - 1);
    
    if (row === null || col === null) continue;
    
    const key = `${row},${col}`;
    if (cellSet.has(key)) continue;
    cellSet.add(key);
    
    const tileType = VALID_TILE_TYPES.includes(cell.tileType as TileType) 
      ? cell.tileType as TileType 
      : 'normal';
    
    let terrainType: TerrainType | null = null;
    if (cell.terrainType && VALID_TERRAIN_TYPES.includes(cell.terrainType as TerrainType)) {
      terrainType = cell.terrainType as TerrainType;
    }
    
    validCells.push({ row, col, tileType, terrainType });
  }
  
  return validCells;
};

export const validateEnemy = (enemy: any): WorkshopEnemy | null => {
  if (!enemy || typeof enemy !== 'object') return null;
  
  const id = sanitizeString(enemy.id, 50);
  const name = sanitizeString(enemy.name, 50);
  const sprite = sanitizeString(enemy.sprite, 10);
  const description = sanitizeString(enemy.description, 200);
  
  if (!id || !name) return null;
  
  const maxHp = validateNumber(enemy.maxHp, MIN_ENEMY_HP, MAX_ENEMY_HP);
  const attack = validateNumber(enemy.attack, MIN_ENEMY_ATTACK, MAX_ENEMY_ATTACK);
  
  if (maxHp === null || attack === null) return null;
  
  const resistance: Partial<Record<ElementType, number>> = {};
  if (enemy.resistance && typeof enemy.resistance === 'object') {
    for (const el of VALID_ELEMENTS) {
      const val = validateNumber(enemy.resistance[el], -1, 1);
      if (val !== null) {
        resistance[el] = val / 100;
      }
    }
  }
  
  const attackPattern: number[] = [];
  if (Array.isArray(enemy.attackPattern)) {
    for (let i = 0; i < Math.min(enemy.attackPattern.length, 10); i++) {
      const val = validateNumber(enemy.attackPattern[i], 1, MAX_ENEMY_ATTACK * 2);
      if (val !== null) attackPattern.push(val);
    }
  }
  if (attackPattern.length === 0) {
    attackPattern.push(attack);
  }
  
  const aiConfig = validateAIConfig(enemy.aiConfig);
  if (!aiConfig) return null;
  
  return {
    id,
    name,
    maxHp,
    attack,
    resistance,
    attackPattern,
    sprite: sprite || '👾',
    description,
    aiConfig,
  };
};

export const validateAIConfig = (config: any): any => {
  if (!config || typeof config !== 'object') return null;
  
  const priority = VALID_AI_PRIORITIES.includes(config.priority) 
    ? config.priority 
    : 'balanced';
  
  const enabledBehaviors: EnemyBehaviorType[] = [];
  if (Array.isArray(config.enabledBehaviors)) {
    for (const b of config.enabledBehaviors) {
      if (VALID_BEHAVIORS.includes(b as EnemyBehaviorType) && !enabledBehaviors.includes(b as EnemyBehaviorType)) {
        enabledBehaviors.push(b as EnemyBehaviorType);
      }
    }
  }
  if (enabledBehaviors.length === 0) {
    enabledBehaviors.push('normal');
  }
  
  return {
    priority,
    enabledBehaviors,
    chargeDamageMultiplier: validateNumber(config.chargeDamageMultiplier * 100, 100, 500) / 100 || 2.5,
    defendDamageReduction: validateNumber(config.defendDamageReduction * 100, 0, 100) / 100 || 0.5,
    defendAttackPenalty: validateNumber(config.defendAttackPenalty * 100, 0, 100) / 100 || 0.3,
    summonCooldown: validateNumber(config.summonCooldown, 1, 10) || 4,
    minionBaseHp: validateNumber(config.minionBaseHp, 10, 100) || 30,
    minionBaseAttack: validateNumber(config.minionBaseAttack, 1, 30) || 8,
    minionExplosionDamage: validateNumber(config.minionExplosionDamage, 10, 100) || 25,
    berserkThreshold: validateNumber(config.berserkThreshold * 100, 10, 80) / 100 || 0.3,
    berserkAttackMultiplier: validateNumber(config.berserkAttackMultiplier * 100, 100, 400) / 100 || 2,
    berserkSelfDamagePerTurn: validateNumber(config.berserkSelfDamagePerTurn, 0, 50) || 5,
  };
};

export const validateSpecialTiles = (tiles: any): WorkshopSpecialTiles => {
  if (!tiles || typeof tiles !== 'object') {
    return { obstacle: 0, frozen: 0, doubleEnergy: 0, doubleEnergyDuration: 3 };
  }
  
  return {
    obstacle: validateNumber(tiles.obstacle, 0, 20) || 0,
    frozen: validateNumber(tiles.frozen, 0, 20) || 0,
    doubleEnergy: validateNumber(tiles.doubleEnergy, 0, 20) || 0,
    doubleEnergyDuration: validateNumber(tiles.doubleEnergyDuration, 1, 10) || 3,
  };
};

export const validateTerrainConfig = (terrain: any): WorkshopTerrainConfig => {
  if (!terrain || typeof terrain !== 'object') {
    return { magma: 0, frost: 0, thorns: 0, storm: 0 };
  }
  
  return {
    magma: validateNumber(terrain.magma, 0, 20) || 0,
    frost: validateNumber(terrain.frost, 0, 20) || 0,
    thorns: validateNumber(terrain.thorns, 0, 20) || 0,
    storm: validateNumber(terrain.storm, 0, 20) || 0,
    magmaSpreadChance: terrain.magmaSpreadChance !== undefined 
      ? (validateNumber(terrain.magmaSpreadChance * 100, 0, 100) || 50) / 100 
      : undefined,
  };
};

export const validateTrialRecord = (record: any): TrialRecord | null => {
  if (!record || typeof record !== 'object') return null;
  
  const completed = typeof record.completed === 'boolean' ? record.completed : false;
  const turnsTaken = validateNumber(record.turnsTaken, 1, 100) || 1;
  const playerHpRemaining = validateNumber(record.playerHpRemaining, 0, MAX_PLAYER_HP) || 0;
  const recordedAt = validateNumber(record.recordedAt, 0, Date.now() + 86400000) || Date.now();
  
  const actions: any[] = [];
  if (Array.isArray(record.actions)) {
    for (let i = 0; i < Math.min(record.actions.length, MAX_TRIAL_ACTIONS); i++) {
      const action = record.actions[i];
      if (!action || typeof action !== 'object') continue;
      
      const turn = validateNumber(action.turn, 1, 100);
      const timestamp = validateNumber(action.timestamp, 0, Date.now() + 86400000);
      
      if (turn === null || timestamp === null) continue;
      
      const validTypes = ['match', 'spell', 'combo_spell', 'end_turn'];
      const type = validTypes.includes(action.type) ? action.type : 'match';
      
      actions.push({
        turn,
        type,
        timestamp,
        data: sanitizeString(JSON.stringify(action.data || {}), 1000),
      });
    }
  }
  
  return { completed, turnsTaken, playerHpRemaining, recordedAt, actions };
};

export const validateWorkshopLevel = (data: any): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['无效的关卡数据'], warnings: [] };
  }
  
  const name = sanitizeString(data.name, MAX_NAME_LENGTH);
  if (!name) errors.push('关卡名称不能为空');
  
  const description = sanitizeString(data.description, MAX_DESC_LENGTH);
  if (!description) warnings.push('关卡描述为空');
  
  const gridSize = validateNumber(data.gridSize, MIN_GRID_SIZE, MAX_GRID_SIZE);
  if (gridSize === null) errors.push(`棋盘尺寸必须在 ${MIN_GRID_SIZE}-${MAX_GRID_SIZE} 之间`);
  
  const playerMaxHp = validateNumber(data.playerMaxHp, MIN_PLAYER_HP, MAX_PLAYER_HP);
  if (playerMaxHp === null) errors.push(`玩家生命值必须在 ${MIN_PLAYER_HP}-${MAX_PLAYER_HP} 之间`);
  
  const maxEnergy = validateNumber(data.maxEnergy, MIN_ENERGY, MAX_ENERGY);
  if (maxEnergy === null) errors.push(`能量上限必须在 ${MIN_ENERGY}-${MAX_ENERGY} 之间`);
  
  const enemy = validateEnemy(data.enemy);
  if (!enemy) errors.push('敌人配置无效');
  
  if (gridSize !== null) {
    const cells = validateEditorCells(data.tilePlacements, gridSize);
    const totalSpecial = cells.filter(c => c.tileType !== 'normal').length;
    const totalTerrain = cells.filter(c => c.terrainType !== null).length;
    
    if (totalSpecial > gridSize * gridSize * 0.6) {
      warnings.push('特殊方块数量较多，可能影响游戏体验');
    }
    if (totalTerrain > gridSize * gridSize * 0.5) {
      warnings.push('地形数量较多，可能使关卡过难');
    }
    
    const obstacleCount = cells.filter(c => c.tileType === 'obstacle').length;
    if (obstacleCount >= gridSize * gridSize - 3) {
      errors.push('障碍物过多，无法进行游戏');
    }
  }
  
  const stars: number[] = [];
  if (Array.isArray(data.stars)) {
    for (let i = 0; i < Math.min(data.stars.length, 3); i++) {
      const s = validateNumber(data.stars[i], 1, 100);
      if (s !== null) stars.push(s);
    }
  }
  if (stars.length < 3) {
    warnings.push('星级评价未完整设置');
  }
  
  if (!data.trialRecord || !data.trialRecord.completed) {
    warnings.push('关卡尚未通过试玩验证');
  }
  
  if (data.trialRecord) {
    const trial = validateTrialRecord(data.trialRecord);
    if (trial && trial.completed) {
      const reasonableTurns = Math.ceil((enemy?.maxHp || 100) / 15) + 5;
      if (trial.turnsTaken > reasonableTurns * 2) {
        warnings.push(`试玩回合数(${trial.turnsTaken})较多，关卡可能偏难`);
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
};

export const serializeLevel = (level: WorkshopLevel): string => {
  const cleanedLevel = {
    ...level,
    name: sanitizeString(level.name, MAX_NAME_LENGTH),
    description: sanitizeString(level.description, MAX_DESC_LENGTH),
    authorName: sanitizeString(level.authorName, 30),
    tags: validateStringArray(level.tags, 10, 20),
  };
  
  return JSON.stringify(cleanedLevel);
};

export const deserializeLevel = (json: string): WorkshopLevel | null => {
  try {
    const data = JSON.parse(json);
    const validation = validateWorkshopLevel(data);
    
    if (!validation.valid) {
      console.warn('关卡数据验证失败:', validation.errors);
      return null;
    }
    
    const gridSize = validateNumber(data.gridSize, MIN_GRID_SIZE, MAX_GRID_SIZE) || 6;
    
    const level: WorkshopLevel = {
      id: sanitizeString(data.id, 50) || generateId(),
      name: sanitizeString(data.name, MAX_NAME_LENGTH),
      description: sanitizeString(data.description, MAX_DESC_LENGTH),
      authorId: sanitizeString(data.authorId, 50) || 'anonymous',
      authorName: sanitizeString(data.authorName, 30) || '匿名玩家',
      background: sanitizeString(data.background, 20) || 'forest',
      enemy: validateEnemy(data.enemy)!,
      playerMaxHp: validateNumber(data.playerMaxHp, MIN_PLAYER_HP, MAX_PLAYER_HP) || 100,
      maxEnergy: validateNumber(data.maxEnergy, MIN_ENERGY, MAX_ENERGY) || 10,
      gridSize,
      stars: Array.isArray(data.stars) ? data.stars.map((s: number) => validateNumber(s, 1, 100) || 50).slice(0, 3) : [100, 70, 40],
      specialTiles: validateSpecialTiles(data.specialTiles),
      terrain: validateTerrainConfig(data.terrain),
      tilePlacements: validateEditorCells(data.tilePlacements, gridSize),
      createdAt: validateNumber(data.createdAt, 0, Date.now() + 86400000) || Date.now(),
      updatedAt: validateNumber(data.updatedAt, 0, Date.now() + 86400000) || Date.now(),
      plays: validateNumber(data.plays, 0, 1000000) || 0,
      clears: validateNumber(data.clears, 0, 1000000) || 0,
      likes: validateNumber(data.likes, 0, 1000000) || 0,
      dislikes: validateNumber(data.dislikes, 0, 1000000) || 0,
      averageRating: validateNumber(data.averageRating * 10, 0, 50) / 10 || 0,
      ratingCount: validateNumber(data.ratingCount, 0, 1000000) || 0,
      isOfficial: typeof data.isOfficial === 'boolean' ? data.isOfficial : false,
      isFeatured: typeof data.isFeatured === 'boolean' ? data.isFeatured : false,
      difficulty: ['easy', 'medium', 'hard', 'extreme'].includes(data.difficulty) ? data.difficulty : 'medium',
      tags: validateStringArray(data.tags, 10, 20),
      trialRecord: validateTrialRecord(data.trialRecord),
    };
    
    return level;
  } catch (e) {
    console.error('反序列化关卡失败:', e);
    return null;
  }
};

export const generateChecksum = (data: string): string => {
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
};

export const createLevelSerialization = (level: WorkshopLevel): { version: string; checksum: string; data: WorkshopLevel } => {
  const json = serializeLevel(level);
  const checksum = generateChecksum(json + WORKSHOP_VERSION);
  
  return {
    version: WORKSHOP_VERSION,
    checksum,
    data: level,
  };
};

export const verifyLevelSerialization = (serialized: any): boolean => {
  try {
    if (!serialized || typeof serialized !== 'object') return false;
    if (serialized.version !== WORKSHOP_VERSION) return false;
    
    const json = serializeLevel(serialized.data);
    const expectedChecksum = generateChecksum(json + WORKSHOP_VERSION);
    
    return serialized.checksum === expectedChecksum;
  } catch {
    return false;
  }
};

export const calculateDifficulty = (enemyHp: number): 'easy' | 'medium' | 'hard' | 'extreme' => {
  if (enemyHp <= DIFFICULTY_META.easy.maxHp) return 'easy';
  if (enemyHp <= DIFFICULTY_META.medium.maxHp) return 'medium';
  if (enemyHp <= DIFFICULTY_META.hard.maxHp) return 'hard';
  return 'extreme';
};

const generateId = (): string => {
  return 'lvl_' + Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
};

export const isLevelPlayable = (level: WorkshopLevel): boolean => {
  const validation = validateWorkshopLevel(level);
  if (!validation.valid) return false;
  
  const obstacleCount = level.tilePlacements.filter(c => c.tileType === 'obstacle').length;
  const totalCells = level.gridSize * level.gridSize;
  
  if (obstacleCount >= totalCells - 3) return false;
  
  return true;
};

const MAX_RECURSION_DEPTH = 10;
const checkObjectDepth = (obj: any, depth: number = 0): boolean => {
  if (depth > MAX_RECURSION_DEPTH) return false;
  if (obj === null || typeof obj !== 'object') return true;
  
  if (Array.isArray(obj)) {
    for (const item of obj) {
      if (!checkObjectDepth(item, depth + 1)) return false;
    }
  } else {
    for (const key of Object.keys(obj)) {
      if (!checkObjectDepth(obj[key], depth + 1)) return false;
    }
  }
  
  return true;
};

const countKeys = (obj: any, count: { keys: number; values: number } = { keys: 0, values: 0 }): { keys: number; values: number } => {
  if (obj === null || typeof obj !== 'object') {
    count.values++;
    return count;
  }
  
  if (Array.isArray(obj)) {
    for (const item of obj) {
      countKeys(item, count);
    }
  } else {
    for (const key of Object.keys(obj)) {
      count.keys++;
      countKeys(obj[key], count);
    }
  }
  
  return count;
};

export const deepValidateLevel = (data: any): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  try {
    const jsonStr = JSON.stringify(data);
    if (jsonStr.length > MAX_LEVEL_SIZE_BYTES) {
      errors.push(`关卡数据过大 (${jsonStr.length} bytes)，最大允许 ${MAX_LEVEL_SIZE_BYTES} bytes`);
    }
    
    if (!checkObjectDepth(data)) {
      errors.push('关卡数据嵌套过深，可能存在恶意构造');
    }
    
    const { keys, values } = countKeys(data);
    if (keys > 500) {
      errors.push(`关卡数据字段过多 (${keys})，可能存在恶意构造`);
    }
    
    if (values > 2000) {
      errors.push(`关卡数据值过多 (${values})，可能存在恶意构造`);
    }
    
    const basicValidation = validateWorkshopLevel(data);
    errors.push(...basicValidation.errors);
    warnings.push(...basicValidation.warnings);
    
    if (data.tilePlacements && Array.isArray(data.tilePlacements)) {
      const cellMap = new Map<string, number>();
      for (const cell of data.tilePlacements) {
        const key = `${cell.row},${cell.col}`;
        cellMap.set(key, (cellMap.get(key) || 0) + 1);
      }
      
      for (const [key, count] of cellMap) {
        if (count > 1) {
          errors.push(`格子 (${key}) 存在重复定义`);
        }
      }
    }
    
    if (data.enemy?.attackPattern && Array.isArray(data.enemy.attackPattern)) {
      if (data.enemy.attackPattern.length === 0) {
        errors.push('敌人攻击模式不能为空');
      }
      if (data.enemy.attackPattern.some((v: number) => v <= 0)) {
        errors.push('敌人攻击模式包含无效值');
      }
    }
    
    if (data.stars && Array.isArray(data.stars)) {
      for (let i = 1; i < data.stars.length; i++) {
        if (data.stars[i] >= data.stars[i - 1]) {
          warnings.push('星级阈值应递减，建议调整');
        }
      }
    }
    
    const hasPlayablePath = data.tilePlacements && Array.isArray(data.tilePlacements)
      ? data.tilePlacements.filter((c: any) => c.tileType !== 'obstacle').length > 0
      : true;
    if (!hasPlayablePath) {
      errors.push('棋盘上没有可操作的格子');
    }
    
    if (data.enemy?.maxHp && data.playerMaxHp) {
      const ratio = data.enemy.maxHp / data.playerMaxHp;
      if (ratio > 10) {
        warnings.push('敌人血量与玩家血量差距过大，可能难以通关');
      }
      if (ratio < 0.5) {
        warnings.push('敌人血量过低，可能过于简单');
      }
    }
    
    return { valid: errors.length === 0, errors, warnings };
  } catch (e) {
    return { valid: false, errors: ['关卡数据解析失败，可能存在格式错误'], warnings: [] };
  }
};

export const safeDeserializeLevel = (json: string): WorkshopLevel | null => {
  try {
    if (typeof json !== 'string') return null;
    if (json.length > MAX_LEVEL_SIZE_BYTES) {
      console.warn('关卡数据过大，拒绝加载');
      return null;
    }
    
    const data = JSON.parse(json);
    
    if (!checkObjectDepth(data)) {
      console.warn('关卡数据嵌套过深，拒绝加载');
      return null;
    }
    
    const validation = deepValidateLevel(data);
    if (!validation.valid) {
      console.warn('关卡深度验证失败:', validation.errors);
      return null;
    }
    
    return deserializeLevel(json);
  } catch (e) {
    console.error('安全反序列化关卡失败:', e);
    return null;
  }
};

export const createSecureLevelSerialization = (level: WorkshopLevel): { version: string; checksum: string; data: WorkshopLevel } | null => {
  const validation = deepValidateLevel(level);
  if (!validation.valid) {
    console.warn('关卡验证失败，无法序列化:', validation.errors);
    return null;
  }
  
  return createLevelSerialization(level);
};
