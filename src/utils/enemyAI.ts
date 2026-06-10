import type { Enemy, EnemyBehaviorType, Minion, EnemyBehaviorLog, CombatUnit } from '../types';
import { ENEMY_BEHAVIOR_NAMES, DEFAULT_BEHAVIOR_STATE } from '../types';
import { generateId } from './gameLogic';

interface BehaviorScore {
  type: EnemyBehaviorType;
  score: number;
  reason: string;
}

interface BehaviorDecision {
  type: EnemyBehaviorType;
  reason: string;
  skillName?: string;
  chargedDamage?: number;
}

const deepCloneBehaviorState = (state: Enemy['behaviorState']): Enemy['behaviorState'] => {
  return JSON.parse(JSON.stringify(state));
};

const getHpPercentage = (enemy: Enemy): number => {
  return enemy.currentHp / enemy.maxHp;
};

const isBerserkActive = (enemy: Enemy): boolean => {
  return getHpPercentage(enemy) <= enemy.aiConfig.berserkThreshold;
};

const calculateBehaviorScores = (enemy: Enemy, playerHp: number, playerMaxHp: number): BehaviorScore[] => {
  const scores: BehaviorScore[] = [];
  const hpPercent = getHpPercentage(enemy);
  const playerHpPercent = playerHp / playerMaxHp;
  const { priority, enabledBehaviors } = enemy.aiConfig;
  const { chargeState, defenseState, summonedMinions, summonCooldownRemaining, consecutiveNormalAttacks } = enemy.behaviorState;

  if (!enabledBehaviors.includes('normal')) {
    enabledBehaviors.push('normal');
  }

  if (chargeState.isCharging) {
    return [{ type: 'charge', score: 1000, reason: '正在蓄力中，必须释放!' }];
  }

  if (isBerserkActive(enemy)) {
    scores.push({ type: 'berserk', score: 900, reason: '血量低于30%，进入狂暴状态!' });
  }

  if (enabledBehaviors.includes('charge') && !chargeState.isCharging) {
    let score = 30;
    if (priority === 'aggressive') score += 25;
    if (priority === 'tactical') score += 15;
    if (playerHpPercent < 0.3) score += 30;
    if (consecutiveNormalAttacks >= 2) score += 20;
    if (hpPercent < 0.5) score -= 10;
    scores.push({ type: 'charge', score, reason: `蓄力准备大伤害 (${score}分)` });
  }

  if (enabledBehaviors.includes('defend') && !defenseState.isDefending) {
    let score = 25;
    if (priority === 'defensive') score += 30;
    if (hpPercent < 0.5) score += 25;
    if (hpPercent < 0.3) score += 35;
    if (playerHpPercent > 0.7) score -= 15;
    if (consecutiveNormalAttacks >= 3) score += 15;
    scores.push({ type: 'defend', score, reason: `进入防御姿态减伤 (${score}分)` });
  }

  if (enabledBehaviors.includes('summon') && summonCooldownRemaining <= 0 && summonedMinions.length < 2) {
    let score = 35;
    if (priority === 'tactical') score += 30;
    if (hpPercent < 0.6) score += 20;
    if (summonedMinions.length === 0) score += 15;
    if (playerHpPercent > 0.5) score -= 10;
    scores.push({ type: 'summon', score, reason: `召唤小怪助战 (${score}分)` });
  }

  let normalScore = 40;
  if (priority === 'aggressive') normalScore += 15;
  if (consecutiveNormalAttacks === 0) normalScore += 10;
  if (consecutiveNormalAttacks >= 4) normalScore -= 20;
  scores.push({ type: 'normal', score: normalScore, reason: `普通攻击 (${normalScore}分)` });

  return scores.sort((a, b) => b.score - a.score);
};

const getRandomSkillName = (): string => {
  const skillNames = [
    '烈焰冲击',
    '雷霆一击',
    '暗影突袭',
    '毁灭光束',
    '地裂斩',
    '风暴之怒',
  ];
  return skillNames[Math.floor(Math.random() * skillNames.length)];
};

export const decideEnemyBehavior = (enemy: Enemy, playerHp: number, playerMaxHp: number): BehaviorDecision => {
  const { chargeState } = enemy.behaviorState;

  if (chargeState.isCharging) {
    return {
      type: 'charge',
      reason: '正在蓄力中，必须释放!',
      skillName: chargeState.skillName,
      chargedDamage: chargeState.chargedDamage,
    };
  }

  const scores = calculateBehaviorScores(enemy, playerHp, playerMaxHp);
  
  const topScore = scores[0];
  
  if (topScore.type === 'charge') {
    const baseDamage = enemy.attackPattern[enemy.currentAttackIndex];
    const chargedDamage = Math.floor(baseDamage * enemy.aiConfig.chargeDamageMultiplier);
    return {
      type: 'charge',
      reason: topScore.reason,
      skillName: getRandomSkillName(),
      chargedDamage,
    };
  }
  
  return {
    type: topScore.type,
    reason: topScore.reason,
  };
};

export const createSummonedMinion = (enemy: Enemy): Minion => {
  const minionNames = ['毒液小怪', '火焰小鬼', '暗影幽灵', '自爆蝙蝠'];
  const minionSprites = ['🦠', '🔥', '👻', '🦇'];
  const index = Math.floor(Math.random() * minionNames.length);
  
  return {
    id: generateId(),
    type: 'minion',
    name: minionNames[index],
    maxHp: enemy.aiConfig.minionBaseHp,
    currentHp: enemy.aiConfig.minionBaseHp,
    attack: enemy.aiConfig.minionBaseAttack,
    resistance: {},
    sprite: minionSprites[index],
    statusEffects: [],
    isTargetable: true,
    isSelected: false,
    turnsUntilExplosion: 2,
    explosionDamage: enemy.aiConfig.minionExplosionDamage,
    masterEnemyId: enemy.id,
  };
};

export const processMinionsTurn = (
  minions: Minion[]
): { updatedMinions: Minion[]; totalDamage: number; explosions: string[] } => {
  let totalDamage = 0;
  const explosions: string[] = [];
  const updatedMinions = minions
    .map(minion => {
      if (minion.currentHp <= 0) return null;
      
      const newTurns = minion.turnsUntilExplosion - 1;
      
      if (newTurns <= 0) {
        totalDamage += minion.explosionDamage;
        explosions.push(`${minion.name} 自爆造成 ${minion.explosionDamage} 点伤害!`);
        return null;
      }
      
      totalDamage += minion.attack;
      
      return {
        ...minion,
        turnsUntilExplosion: newTurns,
      };
    })
    .filter((m): m is Minion => m !== null);
  
  return { updatedMinions, totalDamage, explosions };
};

export const executeEnemyBehavior = (
  enemy: Enemy,
  behavior: BehaviorDecision,
  baseDamage: number,
  turn: number
): {
  updatedEnemy: Enemy;
  damageToPlayer: number;
  log: EnemyBehaviorLog;
  newMinion?: Minion;
} => {
  let damageToPlayer = 0;
  let logMessage = '';
  const newBehaviorState = deepCloneBehaviorState(enemy.behaviorState);
  const newLogs = [...enemy.behaviorLogs];
  let newMinion: Minion | undefined;

  const effectiveAttack = (damage: number): number => {
    let finalDamage = damage;
    
    if (newBehaviorState.defenseState.isDefending) {
      finalDamage = Math.floor(finalDamage * (1 - newBehaviorState.defenseState.attackPenalty));
    }
    
    if (newBehaviorState.isBerserk) {
      finalDamage = Math.floor(finalDamage * enemy.aiConfig.berserkAttackMultiplier);
    }
    
    return finalDamage;
  };

  if (behavior.type !== 'defend' && newBehaviorState.defenseState.isDefending) {
    newBehaviorState.defenseState.isDefending = false;
    newBehaviorState.defenseState.damageReduction = 0;
    newBehaviorState.defenseState.attackPenalty = 0;
  }

  switch (behavior.type) {
    case 'charge':
      if (newBehaviorState.chargeState.isCharging) {
        newBehaviorState.chargeState.chargeTurnsRemaining--;
        if (newBehaviorState.chargeState.chargeTurnsRemaining <= 0) {
          damageToPlayer = effectiveAttack(newBehaviorState.chargeState.chargedDamage);
          logMessage = `💥 ${newBehaviorState.chargeState.skillName} 蓄力完成! 造成 ${damageToPlayer} 点伤害!`;
          newBehaviorState.chargeState.isCharging = false;
          newBehaviorState.chargeState.chargedDamage = 0;
          newBehaviorState.chargeState.skillName = '';
          newBehaviorState.consecutiveNormalAttacks = 0;
        } else {
          logMessage = `⚡ 正在蓄力 ${newBehaviorState.chargeState.skillName}... 还需 ${newBehaviorState.chargeState.chargeTurnsRemaining} 回合 (预计伤害: ${newBehaviorState.chargeState.chargedDamage})`;
        }
      } else {
        newBehaviorState.chargeState.isCharging = true;
        newBehaviorState.chargeState.chargeTurnsRemaining = 1;
        newBehaviorState.chargeState.chargedDamage = behavior.chargedDamage || baseDamage * 2;
        newBehaviorState.chargeState.skillName = behavior.skillName || '蓄力攻击';
        logMessage = `⚡ 开始蓄力 ${newBehaviorState.chargeState.skillName}! 下回合将造成 ${newBehaviorState.chargeState.chargedDamage} 点伤害!`;
        newBehaviorState.consecutiveNormalAttacks = 0;
      }
      break;

    case 'defend':
      newBehaviorState.defenseState.isDefending = true;
      newBehaviorState.defenseState.damageReduction = enemy.aiConfig.defendDamageReduction;
      newBehaviorState.defenseState.attackPenalty = enemy.aiConfig.defendAttackPenalty;
      damageToPlayer = effectiveAttack(Math.floor(baseDamage * (1 - enemy.aiConfig.defendAttackPenalty)));
      logMessage = `🛡️ 进入防御姿态! 受到伤害降低 ${Math.floor(enemy.aiConfig.defendDamageReduction * 100)}%, 攻击力降低 ${Math.floor(enemy.aiConfig.defendAttackPenalty * 100)}%。攻击造成 ${damageToPlayer} 点伤害。`;
      newBehaviorState.consecutiveNormalAttacks = 0;
      break;

    case 'summon':
      newMinion = createSummonedMinion(enemy);
      newBehaviorState.summonedMinions.push(newMinion);
      newBehaviorState.summonCooldownRemaining = enemy.aiConfig.summonCooldown;
      damageToPlayer = effectiveAttack(Math.floor(baseDamage * 0.5));
      logMessage = `👻 召唤了 ${newMinion.name}! ${newMinion.name} 将在 ${newMinion.turnsUntilExplosion} 回合后自爆造成 ${newMinion.explosionDamage} 点伤害! 本体攻击造成 ${damageToPlayer} 点伤害。`;
      newBehaviorState.consecutiveNormalAttacks = 0;
      break;

    case 'berserk':
      if (!newBehaviorState.isBerserk) {
        newBehaviorState.isBerserk = true;
        logMessage = `🔥 进入狂暴模式! 攻击力翻倍, 但每回合受到 ${enemy.aiConfig.berserkSelfDamagePerTurn} 点反噬伤害!`;
      }
      damageToPlayer = effectiveAttack(baseDamage);
      logMessage += ` 狂暴攻击造成 ${damageToPlayer} 点伤害!`;
      newBehaviorState.consecutiveNormalAttacks++;
      break;

    case 'normal':
    default:
      damageToPlayer = effectiveAttack(baseDamage);
      logMessage = `⚔️ 普通攻击造成 ${damageToPlayer} 点伤害。`;
      newBehaviorState.consecutiveNormalAttacks++;
      break;
  }

  if (newBehaviorState.summonCooldownRemaining > 0 && behavior.type !== 'summon') {
    newBehaviorState.summonCooldownRemaining--;
  }

  newBehaviorState.currentBehavior = behavior.type;

  const log: EnemyBehaviorLog = {
    type: behavior.type,
    message: logMessage,
    turn,
  };
  newLogs.push(log);

  if (newLogs.length > 10) {
    newLogs.shift();
  }

  return {
    updatedEnemy: {
      ...enemy,
      behaviorState: newBehaviorState,
      behaviorLogs: newLogs,
    },
    damageToPlayer,
    log,
    newMinion,
  };
};

export const calculateDamageToEnemy = (enemy: Enemy, incomingDamage: number): number => {
  let finalDamage = incomingDamage;
  
  if (enemy.behaviorState.defenseState.isDefending) {
    finalDamage = Math.floor(finalDamage * (1 - enemy.behaviorState.defenseState.damageReduction));
  }
  
  return finalDamage;
};

export const processBerserkSelfDamage = (enemy: Enemy): { updatedEnemy: Enemy; selfDamage: number } => {
  let selfDamage = 0;
  
  if (enemy.behaviorState.isBerserk) {
    selfDamage = enemy.aiConfig.berserkSelfDamagePerTurn;
  }
  
  return {
    updatedEnemy: {
      ...enemy,
      currentHp: Math.max(0, enemy.currentHp - selfDamage),
    },
    selfDamage,
  };
};

export const damageMinion = (
  minions: Minion[],
  minionId: string,
  damage: number
): { updatedMinions: Minion[]; killedMinion?: Minion } => {
  let killedMinion: Minion | undefined;
  
  const updatedMinions = minions.map(minion => {
    if (minion.id !== minionId) return minion;
    
    const newHp = Math.max(0, minion.currentHp - damage);
    if (newHp <= 0) {
      killedMinion = minion;
      return { ...minion, currentHp: 0 };
    }
    return { ...minion, currentHp: newHp };
  }).filter(m => m.currentHp > 0);
  
  return { updatedMinions, killedMinion };
};

export const getNextAttackPreview = (enemy: Enemy, playerHp: number, playerMaxHp: number): string => {
  const { chargeState, defenseState } = enemy.behaviorState;
  
  if (chargeState.isCharging) {
    return `💥 即将释放 ${chargeState.skillName}! 预计伤害: ${chargeState.chargedDamage}`;
  }
  
  if (defenseState.isDefending) {
    return `🛡️ 防御中 (减伤 ${Math.floor(defenseState.damageReduction * 100)}%)`;
  }
  
  if (isBerserkActive(enemy)) {
    const baseDamage = enemy.attackPattern[enemy.currentAttackIndex];
    const berserkDamage = Math.floor(baseDamage * enemy.aiConfig.berserkAttackMultiplier);
    return `🔥 狂暴攻击! 预计伤害: ${berserkDamage}`;
  }
  
  const decision = decideEnemyBehavior(enemy, playerHp, playerMaxHp);
  const baseDamage = enemy.attackPattern[enemy.currentAttackIndex];
  
  switch (decision.type) {
    case 'charge':
      return `⚡ 准备蓄力攻击 (下回合大伤害!)`;
    case 'defend':
      return `🛡️ 准备进入防御姿态`;
    case 'summon':
      return `👻 准备召唤小怪`;
    case 'berserk':
      return `🔥 狂暴攻击! 预计伤害: ${Math.floor(baseDamage * enemy.aiConfig.berserkAttackMultiplier)}`;
    default:
      return `⚔️ 预计攻击: ${baseDamage}`;
  }
};

export const initializeEnemyBehaviorState = (): typeof DEFAULT_BEHAVIOR_STATE => {
  return JSON.parse(JSON.stringify(DEFAULT_BEHAVIOR_STATE));
};

export const convertMinionToCombatUnit = (minion: Minion): CombatUnit => {
  return {
    ...minion,
  };
};

export { ENEMY_BEHAVIOR_NAMES };
