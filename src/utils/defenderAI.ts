import type {
  AIDecision,
  DefenderAIStyle,
  Rune,
  Spell,
  ComboSpell,
  EnergyPool,
  PVPBattleState,
  ElementType,
} from '../types';
import { COMBO_SPELLS as COMBO_SPELLS_CONST, GRID_SIZE } from '../types';

const isAdjacent = (r1: Rune, r2: Rune): boolean => {
  const rowDiff = Math.abs(r1.row - r2.row);
  const colDiff = Math.abs(r1.col - r2.col);
  return rowDiff <= 1 && colDiff <= 1 && !(rowDiff === 0 && colDiff === 0);
};

const findAllMatchesFromPosition = (
  grid: Rune[][],
  startRow: number,
  startCol: number,
  visited: Set<string> = new Set()
): Rune[] => {
  const startRune = grid[startRow]?.[startCol];
  if (!startRune || startRune.tileType === 'obstacle' || startRune.tileType === 'frozen') return [];

  const element = startRune.element;
  const matches: Rune[] = [];
  const stack: Rune[] = [startRune];

  while (stack.length > 0) {
    const current = stack.pop()!;
    const key = `${current.row},${current.col}`;
    if (visited.has(key)) continue;
    visited.add(key);

    if (current.element !== element) continue;
    if (current.tileType === 'obstacle' || current.tileType === 'frozen') continue;

    matches.push(current);

    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = current.row + dr;
        const nc = current.col + dc;
        const neighbor = grid[nr]?.[nc];
        if (neighbor && !visited.has(`${nr},${nc}`)) {
          stack.push(neighbor);
        }
      }
    }
  }

  return matches;
};

const findAllPossibleMatches = (grid: Rune[][]): Rune[][] => {
  const allMatches: Rune[][] = [];
  const globalVisited = new Set<string>();

  for (let row = 0; row < grid.length; row++) {
    for (let col = 0; col < grid[row].length; col++) {
      const key = `${row},${col}`;
      if (globalVisited.has(key)) continue;

      const matches = findAllMatchesFromPosition(grid, row, col, new Set());
      if (matches.length >= 3) {
        allMatches.push(matches);
        matches.forEach((m) => globalVisited.add(`${m.row},${m.col}`));
      } else {
        globalVisited.add(key);
      }
    }
  }

  return allMatches;
};

const calculateMatchValue = (
  match: Rune[],
  energy: EnergyPool,
  maxEnergy: number,
  spells: Spell[],
  aiStyle: DefenderAIStyle,
  ownHp: number,
  ownMaxHp: number,
  enemyHp: number,
  enemyMaxHp: number
): number => {
  if (match.length < 3) return -1;

  const element = match[0].element;
  const length = match.length;

  let baseScore = length * 10;
  if (length >= 5) baseScore += 30;
  if (length >= 6) baseScore += 50;

  const doubleEnergyCount = match.filter((r) => r.tileType === 'double_energy').length;
  baseScore += doubleEnergyCount * 25;

  const frozenInMatch = match.filter(
    (r) => r.tileType === 'frozen' || (r.frozenHitCount || 0) > 0
  ).length;
  baseScore += frozenInMatch * 15;

  const currentEnergy = energy[element] || 0;
  const projectedEnergy = currentEnergy + Math.floor(length / 3) + (length >= 5 ? 2 : 0);

  const healSpell = spells.find((s) => s.element === 'water' && s.heal > 0);
  const damageSpells = spells.filter((s) => s.damage > 0);

  switch (aiStyle) {
    case 'aggressive': {
      const totalDamagePotential = damageSpells.reduce((sum, s) => {
        if (s.element === element) {
          const casts = Math.floor(projectedEnergy / s.cost);
          return sum + casts * s.damage;
        }
        return sum;
      }, 0);
      baseScore += totalDamagePotential * 0.8;

      if (enemyHp < enemyMaxHp * 0.3) {
        baseScore *= 1.5;
      }
      break;
    }

    case 'defensive': {
      if (element === 'water' && healSpell) {
        const casts = Math.floor(projectedEnergy / healSpell.cost);
        baseScore += casts * healSpell.heal * 0.6;
      }
      if (ownHp < ownMaxHp * 0.4) {
        baseScore *= 1.4;
        if (element === 'water') baseScore *= 1.3;
      }
      break;
    }

    case 'tactical': {
      for (const combo of COMBO_SPELLS_CONST) {
        const elements = combo.elements.split('+') as ElementType[];
        if (elements.includes(element)) {
          let canCombo = true;
          for (const el of elements) {
            const required = combo.cost[el] || 0;
            const available = (el === element ? projectedEnergy : energy[el]) || 0;
            if (available < required) {
              canCombo = false;
              break;
            }
          }
          if (canCombo) {
            baseScore += combo.damage * 1.2 + 50;
          }
        }
      }
      break;
    }

    case 'balanced':
    default: {
      const damagePotential = damageSpells.reduce((sum, s) => {
        if (s.element === element) {
          const casts = Math.floor(projectedEnergy / s.cost);
          return sum + casts * s.damage * 0.5;
        }
        return sum;
      }, 0);
      baseScore += damagePotential;

      if (healSpell && element === 'water') {
        const casts = Math.floor(projectedEnergy / healSpell.cost);
        baseScore += casts * healSpell.heal * 0.3;
      }

      if (ownHp < ownMaxHp * 0.35) baseScore *= 1.2;
      if (enemyHp < enemyMaxHp * 0.35) baseScore *= 1.15;
      break;
    }
  }

  if (projectedEnergy > maxEnergy) {
    baseScore -= (projectedEnergy - maxEnergy) * 5;
  }

  return baseScore;
};

const evaluateSpellCast = (
  spell: Spell,
  energy: EnergyPool,
  ownHp: number,
  ownMaxHp: number,
  enemyHp: number,
  enemyMaxHp: number,
  aiStyle: DefenderAIStyle
): { score: number; reasoning: string } => {
  if (energy[spell.element] < spell.cost) {
    return { score: -1, reasoning: '能量不足' };
  }

  let score = 0;
  let reasoning = '';

  if (spell.damage > 0) {
    score += spell.damage * 1.2;

    const hpRatio = enemyHp / enemyMaxHp;
    if (hpRatio < 0.2) {
      score *= 1.8;
      reasoning = '敌人低血量，追求击杀';
    } else if (hpRatio < 0.4) {
      score *= 1.3;
      reasoning = '敌人血量较低，发动攻击';
    } else {
      reasoning = '对敌人造成伤害';
    }

    if (aiStyle === 'aggressive') score *= 1.4;
    if (aiStyle === 'defensive') score *= 0.7;
  }

  if (spell.heal > 0) {
    const healAmount = Math.min(spell.heal, ownMaxHp - ownHp);
    if (healAmount <= 0) {
      return { score: -1, reasoning: '血量已满，无需治疗' };
    }

    score += healAmount * 1.5;

    const hpRatio = ownHp / ownMaxHp;
    if (hpRatio < 0.25) {
      score *= 2.0;
      reasoning = '自身危急，必须治疗！';
    } else if (hpRatio < 0.5) {
      score *= 1.4;
      reasoning = '血量偏低，需要恢复';
    } else {
      reasoning = '补充血量';
    }

    if (aiStyle === 'defensive') score *= 1.5;
    if (aiStyle === 'aggressive') score *= 0.6;
  }

  const energyLeftAfter = energy[spell.element] - spell.cost;
  score -= energyLeftAfter * 0.5;

  return { score, reasoning };
};

const evaluateComboSpellCast = (
  spell: ComboSpell,
  energy: EnergyPool,
  cooldowns: Record<string, number>,
  ownHp: number,
  ownMaxHp: number,
  enemyHp: number,
  enemyMaxHp: number,
  aiStyle: DefenderAIStyle
): { score: number; reasoning: string } => {
  if (cooldowns[spell.id] > 0) {
    return { score: -1, reasoning: `冷却中 (${cooldowns[spell.id]}回合)` };
  }

  for (const [el, cost] of Object.entries(spell.cost)) {
    if ((energy[el as ElementType] || 0) < (cost || 0)) {
      return { score: -1, reasoning: `${el}元素能量不足` };
    }
  }

  let score = spell.damage * 1.5;
  score += spell.effectValue * spell.effectDuration * 0.5;

  if (enemyHp < enemyMaxHp * 0.3) score *= 1.6;
  if (ownHp < ownMaxHp * 0.4 && spell.effect === 'paralyze') score *= 1.4;
  if (aiStyle === 'tactical') score *= 1.4;
  if (aiStyle === 'defensive' && spell.effect !== 'paralyze' && spell.effect !== 'resistance_down') score *= 0.7;

  const reasoning = `释放Combo法术 ${spell.name}`;
  return { score, reasoning };
};

export const makeAIDecision = (
  state: PVPBattleState,
  isDefenderTurn: boolean = true
): AIDecision => {
  const aiStyle = state.defenderAIStyle;

  const ownHp = isDefenderTurn ? state.enemyHp : state.playerHp;
  const ownMaxHp = isDefenderTurn ? state.enemyMaxHp : state.playerMaxHp;
  const enemyHp = isDefenderTurn ? state.playerHp : state.enemyHp;
  const enemyMaxHp = isDefenderTurn ? state.playerMaxHp : state.enemyMaxHp;
  const energy = isDefenderTurn ? state.enemyEnergy : state.playerEnergy;
  const spells = isDefenderTurn ? state.enemySpells : state.playerSpells;
  const comboCooldowns = isDefenderTurn ? state.enemyComboSpellCooldowns : state.comboSpellCooldowns;
  const grid = state.runeGrid;

  const decisions: AIDecision[] = [];

  const allMatches = findAllPossibleMatches(grid);
  for (const match of allMatches) {
    const value = calculateMatchValue(
      match,
      energy,
      state.maxEnergy,
      spells,
      aiStyle,
      ownHp,
      ownMaxHp,
      enemyHp,
      enemyMaxHp
    );
    if (value > 0) {
      decisions.push({
        type: 'match_runes',
        runes: match,
        targetElement: match[0].element,
        priority: value,
        expectedValue: value,
        reasoning: `选择${match.length}个${match[0].element}符文消除，预期得分${Math.round(value)}`,
      });
    }
  }

  for (const spell of spells) {
    const evalResult = evaluateSpellCast(
      spell,
      energy,
      ownHp,
      ownMaxHp,
      enemyHp,
      enemyMaxHp,
      aiStyle
    );
    if (evalResult.score > 0) {
      decisions.push({
        type: 'cast_spell',
        spell,
        priority: evalResult.score + 5,
        expectedValue: evalResult.score,
        reasoning: evalResult.reasoning,
      });
    }
  }

  for (const comboSpell of COMBO_SPELLS_CONST) {
    const evalResult = evaluateComboSpellCast(
      comboSpell,
      energy,
      comboCooldowns,
      ownHp,
      ownMaxHp,
      enemyHp,
      enemyMaxHp,
      aiStyle
    );
    if (evalResult.score > 0) {
      decisions.push({
        type: 'cast_combo_spell',
        comboSpell,
        priority: evalResult.score + 10,
        expectedValue: evalResult.score,
        reasoning: evalResult.reasoning,
      });
    }
  }

  if (aiStyle === 'random' && decisions.length > 1) {
    const idx = Math.floor(Math.random() * decisions.length);
    decisions[idx].priority += Math.random() * 20;
  }

  if (aiStyle === 'defensive' && ownHp < ownMaxHp * 0.25) {
    const matchDecisions = decisions.filter((d) => d.type === 'match_runes');
    const bestMatch = matchDecisions.reduce((best, d) => (d.priority > best.priority ? d : best), matchDecisions[0]);
    if (bestMatch) {
      bestMatch.priority += 100;
    }
  }

  if (aiStyle === 'aggressive' && enemyHp < enemyMaxHp * 0.3) {
    const spellDecisions = decisions.filter((d) => d.type === 'cast_spell' && (d.spell?.damage || 0) > 0);
    const bestSpell = spellDecisions.reduce((best, d) => (d.priority > best.priority ? d : best), spellDecisions[0]);
    if (bestSpell) {
      bestSpell.priority += 100;
    }
  }

  decisions.sort((a, b) => b.priority - a.priority);

  if (decisions.length > 0 && decisions[0].priority > 5) {
    return decisions[0];
  }

  if (allMatches.length > 0) {
    const biggestMatch = allMatches.reduce((biggest, m) => (m.length > biggest.length ? m : biggest), allMatches[0]);
    return {
      type: 'match_runes',
      runes: biggestMatch,
      targetElement: biggestMatch[0].element,
      priority: 20,
      expectedValue: biggestMatch.length * 8,
      reasoning: `选择最大匹配(${biggestMatch.length}个${biggestMatch[0].element})`,
    };
  }

  return {
    type: 'end_turn',
    priority: 0,
    expectedValue: 0,
    reasoning: '无有效操作，结束回合',
  };
};

export const simulateAIMatchSelection = (
  grid: Rune[][],
  aiStyle: DefenderAIStyle
): Rune[] | null => {
  const allMatches = findAllPossibleMatches(grid);
  if (allMatches.length === 0) return null;

  const scoredMatches = allMatches.map((match) => {
    let score = match.length * 10;

    if (aiStyle === 'tactical') {
      if (match.length >= 5) score += 50;
      const hasDouble = match.some((r) => r.tileType === 'double_energy');
      if (hasDouble) score += 30;
    }

    if (aiStyle === 'aggressive') {
      if (match[0].element === 'fire' || match[0].element === 'thunder') {
        score += 20;
      }
    }

    if (aiStyle === 'defensive') {
      if (match[0].element === 'water' || match[0].element === 'grass') {
        score += 20;
      }
    }

    return { match, score };
  });

  scoredMatches.sort((a, b) => b.score - a.score);

  if (aiStyle === 'random' && scoredMatches.length > 1) {
    const topCount = Math.min(3, scoredMatches.length);
    return scoredMatches[Math.floor(Math.random() * topCount)].match;
  }

  return scoredMatches[0].match;
};

export const getAISpellPriorityList = (
  spells: Spell[],
  aiStyle: DefenderAIStyle
): Spell[] => {
  const sorted = [...spells];
  sorted.sort((a, b) => {
    let scoreA = 0;
    let scoreB = 0;

    switch (aiStyle) {
      case 'aggressive':
        scoreA = a.damage * 2 + a.cost * 0.5;
        scoreB = b.damage * 2 + b.cost * 0.5;
        break;
      case 'defensive':
        scoreA = a.heal * 2 + a.cost * 0.3;
        scoreB = b.heal * 2 + b.cost * 0.3;
        break;
      case 'balanced':
        scoreA = a.damage + a.heal * 1.5;
        scoreB = b.damage + b.heal * 1.5;
        break;
      case 'tactical':
        scoreA = a.damage * 1.2 + a.heal + a.cost * 0.8;
        scoreB = b.damage * 1.2 + b.heal + b.cost * 0.8;
        break;
      default:
        scoreA = a.damage + a.heal;
        scoreB = b.damage + b.heal;
    }

    return scoreB - scoreA;
  });

  return sorted;
};
