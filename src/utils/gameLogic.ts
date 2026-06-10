import type { Rune, ElementType, Enemy, Spell, EnergyPool, SpecialTileConfig, ComboSpell, StatusEffect, StatusEffectType, TerrainCell, TerrainConfig, TerrainType } from '../types';
import { ELEMENT_COLORS, GRID_SIZE } from '../types';

const ELEMENTS: ElementType[] = ['fire', 'water', 'grass', 'thunder'];

export const generateId = (): string => {
  return Math.random().toString(36).substring(2, 11);
};

export const getRandomElement = (): ElementType => {
  return ELEMENTS[Math.floor(Math.random() * ELEMENTS.length)];
};

export const createRune = (row: number, col: number, isNew = false, tileType: Rune['tileType'] = 'normal', frozenHitCount = 0, doubleEnergyTurnsLeft = 0, burnMarked = false, terrainFrozenTurns = 0): Rune => ({
  id: generateId(),
  element: getRandomElement(),
  row,
  col,
  isSelected: false,
  isMatched: false,
  isNew,
  tileType,
  frozenHitCount,
  doubleEnergyTurnsLeft,
  burnMarked,
  terrainFrozenTurns,
});

function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export const createRuneGrid = (specialConfig?: SpecialTileConfig, gridSize: number = GRID_SIZE): Rune[][] => {
  const grid: Rune[][] = [];
  const specialMap: Map<string, Rune['tileType']> = new Map();

  if (specialConfig) {
    const allPositions: { row: number; col: number }[] = [];
    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col < gridSize; col++) {
        allPositions.push({ row, col });
      }
    }
    const shuffled = shuffleArray(allPositions);
    let idx = 0;

    for (let i = 0; i < specialConfig.obstacle && idx < shuffled.length; i++, idx++) {
      specialMap.set(`${shuffled[idx].row},${shuffled[idx].col}`, 'obstacle');
    }
    for (let i = 0; i < specialConfig.frozen && idx < shuffled.length; i++, idx++) {
      specialMap.set(`${shuffled[idx].row},${shuffled[idx].col}`, 'frozen');
    }
    for (let i = 0; i < specialConfig.doubleEnergy && idx < shuffled.length; i++, idx++) {
      specialMap.set(`${shuffled[idx].row},${shuffled[idx].col}`, 'double_energy');
    }
  }

  for (let row = 0; row < gridSize; row++) {
    grid[row] = [];
    for (let col = 0; col < gridSize; col++) {
      const key = `${row},${col}`;
      const tileType = specialMap.get(key) || 'normal';
      const frozenHitCount = 0;
      const doubleEnergyTurnsLeft = tileType === 'double_energy' ? (specialConfig?.doubleEnergyDuration ?? 3) : 0;
      grid[row][col] = createRune(row, col, false, tileType, frozenHitCount, doubleEnergyTurnsLeft);
    }
  }
  return removeInitialMatches(grid, gridSize);
};

const removeInitialMatches = (grid: Rune[][], gridSize: number = GRID_SIZE): Rune[][] => {
  let hasMatches = true;
  while (hasMatches) {
    hasMatches = false;
    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col < gridSize; col++) {
        const tileType = grid[row][col].tileType;
        if (tileType === 'obstacle' || tileType === 'frozen') continue;

        if (col < gridSize - 2) {
          const t1 = grid[row][col].tileType;
          const t2 = grid[row][col + 1].tileType;
          const t3 = grid[row][col + 2].tileType;
          if (
            t1 !== 'obstacle' && t1 !== 'frozen' &&
            t2 !== 'obstacle' && t2 !== 'frozen' &&
            t3 !== 'obstacle' && t3 !== 'frozen' &&
            grid[row][col].element === grid[row][col + 1].element &&
            grid[row][col].element === grid[row][col + 2].element
          ) {
            grid[row][col] = createRune(row, col, false, grid[row][col].tileType, grid[row][col].frozenHitCount, grid[row][col].doubleEnergyTurnsLeft);
            hasMatches = true;
          }
        }
        if (row < gridSize - 2) {
          const t1 = grid[row][col].tileType;
          const t2 = grid[row + 1][col].tileType;
          const t3 = grid[row + 2][col].tileType;
          if (
            t1 !== 'obstacle' && t1 !== 'frozen' &&
            t2 !== 'obstacle' && t2 !== 'frozen' &&
            t3 !== 'obstacle' && t3 !== 'frozen' &&
            grid[row][col].element === grid[row + 1][col].element &&
            grid[row][col].element === grid[row + 2][col].element
          ) {
            grid[row][col] = createRune(row, col, false, grid[row][col].tileType, grid[row][col].frozenHitCount, grid[row][col].doubleEnergyTurnsLeft);
            hasMatches = true;
          }
        }
      }
    }
  }
  return grid;
};

export const areAdjacent = (rune1: Rune, rune2: Rune): boolean => {
  const rowDiff = Math.abs(rune1.row - rune2.row);
  const colDiff = Math.abs(rune1.col - rune2.col);
  return rowDiff <= 1 && colDiff <= 1 && !(rowDiff === 0 && colDiff === 0);
};

export const isDiagonalPathBlocked = (grid: Rune[][], rune1: Rune, rune2: Rune): boolean => {
  const rowDiff = Math.abs(rune1.row - rune2.row);
  const colDiff = Math.abs(rune1.col - rune2.col);
  
  if (rowDiff !== 1 || colDiff !== 1) return false;
  
  const corner1Row = rune1.row;
  const corner1Col = rune2.col;
  const corner2Row = rune2.row;
  const corner2Col = rune1.col;
  
  if (grid[corner1Row]?.[corner1Col]?.tileType === 'obstacle') return true;
  if (grid[corner2Row]?.[corner2Col]?.tileType === 'obstacle') return true;
  
  return false;
};

export const canAddToSelection = (selectedRunes: Rune[], rune: Rune, grid: Rune[][]): boolean => {
  if (rune.tileType === 'obstacle' || rune.tileType === 'frozen') return false;
  if (rune.terrainFrozenTurns && rune.terrainFrozenTurns > 0) return false;

  if (selectedRunes.length === 0) return true;
  
  const lastRune = selectedRunes[selectedRunes.length - 1];
  
  if (rune.element !== lastRune.element) return false;
  
  if (selectedRunes.some(r => r.id === rune.id)) return false;
  
  if (!areAdjacent(lastRune, rune)) return false;
  
  if (isDiagonalPathBlocked(grid, lastRune, rune)) return false;
  
  return true;
};

export const calculateEnergyGain = (
  matchCount: number,
  comboCount: number,
  element: ElementType,
  doubleEnergyCount: number = 0
): Partial<EnergyPool> => {
  const baseEnergy = matchCount >= 3 ? matchCount - 2 : 0;
  const comboMultiplier = 1 + (comboCount * 0.5);
  let energy = Math.floor(baseEnergy * comboMultiplier);
  energy += doubleEnergyCount * Math.floor(baseEnergy * comboMultiplier);
  return { [element]: energy } as Partial<EnergyPool>;
};

export const calculateDamage = (
  spell: Spell,
  enemy: Enemy
): { damage: number; isEffective: boolean; isWeak: boolean } => {
  const baseDamage = spell.damage;
  const resistance = enemy.resistance[spell.element] || 0;
  
  let multiplier = 1 - resistance;
  let isEffective = false;
  let isWeak = false;
  
  if (resistance < 0) {
    isEffective = true;
    multiplier = 1 - resistance;
  } else if (resistance > 0.3) {
    isWeak = true;
  }
  
  const damage = Math.floor(baseDamage * multiplier);
  
  return { damage: Math.max(1, damage), isEffective, isWeak };
};

export const getElementalAdvantage = (
  attackElement: ElementType,
  defenseElement: ElementType
): number => {
  const advantages: Record<ElementType, ElementType> = {
    fire: 'grass',
    grass: 'water',
    water: 'fire',
    thunder: 'water',
  };
  
  if (advantages[attackElement] === defenseElement) {
    return 1.5;
  }
  if (advantages[defenseElement] === attackElement) {
    return 0.7;
  }
  return 1;
};

export const markMatchedRunes = (grid: Rune[][], matchedRunes: Rune[]): Rune[][] => {
  const newGrid = grid.map(row => row.map(rune => ({ ...rune })));
  matchedRunes.forEach(matched => {
    newGrid[matched.row][matched.col].isMatched = true;
  });
  return newGrid;
};

export const processFrozenHits = (grid: Rune[][], matchedRunes: Rune[], gridSize: number = GRID_SIZE): Rune[][] => {
  const newGrid = grid.map(row => row.map(rune => ({ ...rune })));
  const matchedPositions = new Set(matchedRunes.map(r => `${r.row},${r.col}`));

  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      if (newGrid[row][col].tileType !== 'frozen') continue;

      let isAdjacentToMatch = false;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = row + dr;
          const nc = col + dc;
          if (nr >= 0 && nr < gridSize && nc >= 0 && nc < gridSize) {
            if (matchedPositions.has(`${nr},${nc}`)) {
              isAdjacentToMatch = true;
            }
          }
        }
      }

      if (isAdjacentToMatch) {
        newGrid[row][col] = {
          ...newGrid[row][col],
          frozenHitCount: newGrid[row][col].frozenHitCount + 1,
        };
        if (newGrid[row][col].frozenHitCount >= 2) {
          newGrid[row][col] = {
            ...newGrid[row][col],
            tileType: 'normal',
            frozenHitCount: 0,
          };
        }
      }
    }
  }
  return newGrid;
};

export const saveDoubleEnergyCells = (grid: Rune[][], gridSize: number = GRID_SIZE): Map<string, number> => {
  const map = new Map<string, number>();
  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      if (grid[row][col].tileType === 'double_energy' && grid[row][col].doubleEnergyTurnsLeft > 0) {
        map.set(`${row},${col}`, grid[row][col].doubleEnergyTurnsLeft);
      }
    }
  }
  return map;
};

const restoreDoubleEnergyCells = (grid: Rune[][], deCells: Map<string, number>, gridSize: number = GRID_SIZE): Rune[][] => {
  const newGrid = grid.map(row => row.map(rune => ({ ...rune })));
  deCells.forEach((turnsLeft, key) => {
    const [row, col] = key.split(',').map(Number);
    if (row >= 0 && row < gridSize && col >= 0 && col < gridSize) {
      const rune = newGrid[row][col];
      if (rune.tileType !== 'obstacle' && rune.tileType !== 'frozen') {
        newGrid[row][col] = {
          ...rune,
          tileType: 'double_energy',
          doubleEnergyTurnsLeft: turnsLeft,
        };
      }
    }
  });
  return newGrid;
};

export const processMatchesAndDrop = (grid: Rune[][], deCells?: Map<string, number>, gridSize: number = GRID_SIZE): {
  newGrid: Rune[][];
  totalMatches: number;
  matchedElements: Record<ElementType, number>;
  doubleEnergyCount: number;
} => {
  const newGrid = grid.map(row => row.map(rune => ({ ...rune, isNew: false })));
  const matchedElements: Record<ElementType, number> = {
    fire: 0,
    water: 0,
    grass: 0,
    thunder: 0,
  };
  let totalMatches = 0;
  let doubleEnergyCount = 0;

  for (let col = 0; col < gridSize; col++) {
    const obstacleRows: Set<number> = new Set();
    for (let row = 0; row < gridSize; row++) {
      if (newGrid[row][col].tileType === 'obstacle') {
        obstacleRows.add(row);
      }
    }

    const segments: { start: number; end: number }[] = [];
    let segStart = 0;
    for (let row = 0; row <= gridSize; row++) {
      if (row === gridSize || obstacleRows.has(row)) {
        if (row > segStart) {
          segments.push({ start: segStart, end: row - 1 });
        }
        segStart = row + 1;
      }
    }

    for (const seg of segments) {
      const column: (Rune | null)[] = [];

      for (let row = seg.end; row >= seg.start; row--) {
        if (newGrid[row][col].isMatched) {
          matchedElements[newGrid[row][col].element]++;
          totalMatches++;
          if (newGrid[row][col].tileType === 'double_energy') {
            doubleEnergyCount++;
          }
        } else {
          column.push(newGrid[row][col]);
        }
      }

      const segSize = seg.end - seg.start + 1;
      while (column.length < segSize) {
        column.push(null);
      }

      for (let row = seg.end; row >= seg.start; row--) {
        const rune = column.shift();
        if (rune) {
          newGrid[row][col] = { ...rune, row, col, isSelected: false, isMatched: false };
        } else {
          newGrid[row][col] = createRune(row, col, true);
        }
      }
    }
  }

  let resultGrid = newGrid;
  if (deCells && deCells.size > 0) {
    resultGrid = restoreDoubleEnergyCells(newGrid, deCells, gridSize);
  }

  return { newGrid: resultGrid, totalMatches, matchedElements, doubleEnergyCount };
};

export const findAllMatches = (grid: Rune[][], gridSize: number = GRID_SIZE): Rune[] => {
  const matches: Set<string> = new Set();
  
  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize - 2; col++) {
      const t1 = grid[row][col].tileType;
      const t2 = grid[row][col + 1].tileType;
      const t3 = grid[row][col + 2].tileType;
      if (t1 === 'obstacle' || t1 === 'frozen' || t2 === 'obstacle' || t2 === 'frozen' || t3 === 'obstacle' || t3 === 'frozen') continue;

      if (
        grid[row][col].element === grid[row][col + 1].element &&
        grid[row][col].element === grid[row][col + 2].element
      ) {
        matches.add(grid[row][col].id);
        matches.add(grid[row][col + 1].id);
        matches.add(grid[row][col + 2].id);
        
        let k = col + 3;
        while (k < gridSize && grid[row][k].tileType !== 'obstacle' && grid[row][k].tileType !== 'frozen' && grid[row][k].element === grid[row][col].element) {
          matches.add(grid[row][k].id);
          k++;
        }
      }
    }
  }
  
  for (let col = 0; col < gridSize; col++) {
    for (let row = 0; row < gridSize - 2; row++) {
      const t1 = grid[row][col].tileType;
      const t2 = grid[row + 1][col].tileType;
      const t3 = grid[row + 2][col].tileType;
      if (t1 === 'obstacle' || t1 === 'frozen' || t2 === 'obstacle' || t2 === 'frozen' || t3 === 'obstacle' || t3 === 'frozen') continue;

      if (
        grid[row][col].element === grid[row + 1][col].element &&
        grid[row][col].element === grid[row + 2][col].element
      ) {
        matches.add(grid[row][col].id);
        matches.add(grid[row + 1][col].id);
        matches.add(grid[row + 2][col].id);
        
        let k = row + 3;
        while (k < gridSize && grid[k][col].tileType !== 'obstacle' && grid[k][col].tileType !== 'frozen' && grid[k][col].element === grid[row][col].element) {
          matches.add(grid[k][col].id);
          k++;
        }
      }
    }
  }
  
  return grid.flat().filter(rune => matches.has(rune.id));
};

export const decrementDoubleEnergyTurns = (grid: Rune[][]): Rune[][] => {
  const newGrid = grid.map(row => row.map(rune => {
    if (rune.tileType === 'double_energy') {
      const newTurns = rune.doubleEnergyTurnsLeft - 1;
      if (newTurns <= 0) {
        return { ...rune, tileType: 'normal' as const, doubleEnergyTurnsLeft: 0 };
      }
      return { ...rune, doubleEnergyTurnsLeft: newTurns };
    }
    return { ...rune };
  }));
  return newGrid;
};

export const getElementColor = (element: ElementType): string => {
  return ELEMENT_COLORS[element];
};

export const canCastComboSpell = (energy: EnergyPool, spell: ComboSpell): boolean => {
  return Object.entries(spell.cost).every(([element, cost]) => {
    return energy[element as ElementType] >= (cost || 0);
  });
};

export const calculateComboDamage = (
  spell: ComboSpell,
  enemy: Enemy
): { damage: number; isEffective: boolean; isWeak: boolean } => {
  const baseDamage = spell.damage;
  const elements = spell.elements.split('+') as ElementType[];
  
  const avgResistance = elements.reduce((sum, el) => {
    return sum + (enemy.resistance[el] || 0);
  }, 0) / elements.length;
  
  let multiplier = 1 - avgResistance;
  let isEffective = false;
  let isWeak = false;
  
  if (avgResistance < 0) {
    isEffective = true;
    multiplier = 1 - avgResistance;
  } else if (avgResistance > 0.3) {
    isWeak = true;
  }
  
  const damage = Math.floor(baseDamage * multiplier);
  
  return { damage: Math.max(1, damage), isEffective, isWeak };
};

export const createStatusEffect = (
  type: StatusEffectType, duration: number, value: number, source?: string): StatusEffect => {
  return { type, duration, value, source };
};

export const applyStatusEffectToEnemy = (
  enemy: Enemy, effect: StatusEffect): Enemy => {
  const existingIndex = enemy.statusEffects.findIndex(e => e.type === effect.type);
  
  let newEffects;
  
  if (existingIndex >= 0) {
    newEffects = enemy.statusEffects.map((e, i) => {
      if (i === existingIndex) {
        return {
          ...e,
          duration: Math.max(e.duration, effect.duration),
          value: Math.max(e.value, effect.value),
        };
      }
      return e;
    });
  } else {
    newEffects = [...enemy.statusEffects, effect];
  }
  
  return { ...enemy, statusEffects: newEffects };
};

export const processStatusEffects = (enemy: Enemy): {
  updatedEnemy: Enemy;
  damageDealt: number;
  effectsExpired: StatusEffect[];
} => {
  let damageDealt = 0;
  const effectsExpired: StatusEffect[] = [];
  
  const newEffects = enemy.statusEffects.map(effect => {
    if (effect.type === 'burn') {
      damageDealt += effect.value;
    }
    return { ...effect, duration: effect.duration - 1 };
  }).filter(effect => {
    if (effect.duration <= 0) {
      effectsExpired.push(effect);
      return false;
    }
    return true;
  });
  
  return {
    updatedEnemy: { ...enemy, statusEffects: newEffects },
    damageDealt,
    effectsExpired,
  };
};

export const getEffectiveAttackDamage = (baseDamage: number, enemy: Enemy): number => {
  const paralyzeEffect = enemy.statusEffects.find(e => e.type === 'paralyze');
  if (paralyzeEffect) {
    return Math.floor(baseDamage * (1 - paralyzeEffect.value / 100));
  }
  return baseDamage;
};

export const getEffectiveResistance = (enemy: Enemy, element: ElementType): number => {
  const baseResistance = enemy.resistance[element] || 0;
  const resistanceDownEffect = enemy.statusEffects.find(e => e.type === 'resistance_down');
  if (resistanceDownEffect) {
    return Math.max(-1, baseResistance - resistanceDownEffect.value / 100);
  }
  return baseResistance;
};

export const calculateDamageWithResistanceEffect = (
  spell: Spell,
  enemy: Enemy
): { damage: number; isEffective: boolean; isWeak: boolean } => {
  const baseDamage = spell.damage;
  const resistance = getEffectiveResistance(enemy, spell.element);
  
  let multiplier = 1 - resistance;
  let isEffective = false;
  let isWeak = false;
  
  if (resistance < 0) {
    isEffective = true;
    multiplier = 1 - resistance;
  } else if (resistance > 0.3) {
    isWeak = true;
  }
  
  let damage = Math.floor(baseDamage * multiplier);
  
  if (enemy.behaviorState?.defenseState?.isDefending) {
    damage = Math.floor(damage * (1 - enemy.behaviorState.defenseState.damageReduction));
  }
  
  return { damage: Math.max(1, damage), isEffective, isWeak };
};

export const calculateComboDamageWithResistanceEffect = (
  spell: ComboSpell,
  enemy: Enemy
): { damage: number; isEffective: boolean; isWeak: boolean } => {
  const baseDamage = spell.damage;
  const elements = spell.elements.split('+') as ElementType[];
  
  const avgResistance = elements.reduce((sum, el) => {
    return sum + getEffectiveResistance(enemy, el);
  }, 0) / elements.length;
  
  let multiplier = 1 - avgResistance;
  let isEffective = false;
  let isWeak = false;
  
  if (avgResistance < 0) {
    isEffective = true;
    multiplier = 1 - avgResistance;
  } else if (avgResistance > 0.3) {
    isWeak = true;
  }
  
  let damage = Math.floor(baseDamage * multiplier);
  
  if (enemy.behaviorState?.defenseState?.isDefending) {
    damage = Math.floor(damage * (1 - enemy.behaviorState.defenseState.damageReduction));
  }
  
  return { damage: Math.max(1, damage), isEffective, isWeak };
};

export const createTerrainGrid = (
  terrainConfig?: Partial<TerrainConfig>,
  runeGrid?: Rune[][],
  gridSize: number = GRID_SIZE
): TerrainCell[][] => {
  const terrainGrid: TerrainCell[][] = [];
  for (let row = 0; row < gridSize; row++) {
    terrainGrid[row] = [];
    for (let col = 0; col < gridSize; col++) {
      terrainGrid[row][col] = { type: null, age: 0 };
    }
  }

  if (!terrainConfig) return terrainGrid;

  const blockedSet = new Set<string>();
  if (runeGrid) {
    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col < gridSize; col++) {
        const tileType = runeGrid[row]?.[col]?.tileType;
        if (tileType === 'obstacle' || tileType === 'frozen') {
          blockedSet.add(`${row},${col}`);
        }
      }
    }
  }

  const allPositions: { row: number; col: number }[] = [];
  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      const key = `${row},${col}`;
      if (terrainGrid[row][col].type === null && !blockedSet.has(key)) {
        allPositions.push({ row, col });
      }
    }
  }
  const shuffled = shuffleArray(allPositions);

  let idx = 0;
  const tryPlaceTerrain = (count: number, type: TerrainType) => {
    let placed = 0;
    while (placed < count && idx < shuffled.length) {
      const pos = shuffled[idx];
      idx++;
      const key = `${pos.row},${pos.col}`;
      if (blockedSet.has(key)) continue;
      if (terrainGrid[pos.row][pos.col].type !== null) continue;
      terrainGrid[pos.row][pos.col] = { type, age: 0 };
      placed++;
    }
  };

  tryPlaceTerrain(terrainConfig.magma || 0, 'magma');
  tryPlaceTerrain(terrainConfig.frost || 0, 'frost');
  tryPlaceTerrain(terrainConfig.thorns || 0, 'thorns');
  tryPlaceTerrain(terrainConfig.storm || 0, 'storm');

  return terrainGrid;
};

export const spreadMagma = (
  terrainGrid: TerrainCell[][],
  runeGrid: Rune[][],
  spreadChance: number = 0.5,
  gridSize: number = GRID_SIZE
): TerrainCell[][] => {
  const newTerrain = terrainGrid.map(row => row.map(cell => ({ ...cell, hasSpreadThisTurn: false })));

  const magmaCells: { row: number; col: number }[] = [];
  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      if (newTerrain[row][col].type === 'magma') {
        magmaCells.push({ row, col });
      }
    }
  }

  for (const { row, col } of magmaCells) {
    if (newTerrain[row][col].age < 1) continue;

    const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (const [dr, dc] of directions) {
      const nr = row + dr;
      const nc = col + dc;
      if (nr < 0 || nr >= gridSize || nc < 0 || nc >= gridSize) continue;
      if (newTerrain[nr][nc].type !== null) continue;
      if (runeGrid[nr][nc].tileType === 'obstacle') continue;
      if (runeGrid[nr][nc].tileType === 'frozen') continue;
      if (Math.random() < spreadChance) {
        newTerrain[nr][nc] = { type: 'magma', age: 0, hasSpreadThisTurn: true };
      }
    }
  }

  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      if (newTerrain[row][col].type === 'magma') {
        newTerrain[row][col].age++;
      }
    }
  }

  return newTerrain;
};

export const markMagmaBurn = (
  runeGrid: Rune[][],
  terrainGrid: TerrainCell[][],
  gridSize: number = GRID_SIZE
): Rune[][] => {
  const newGrid = runeGrid.map(row => row.map(rune => ({ ...rune })));
  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      if (terrainGrid[row][col].type === 'magma') {
        const rune = newGrid[row][col];
        if (rune.tileType !== 'obstacle' && rune.tileType !== 'frozen') {
          newGrid[row][col] = { ...rune, burnMarked: true };
        }
      }
    }
  }
  return newGrid;
};

export const applyBurnedRunes = (
  runeGrid: Rune[][],
  gridSize: number = GRID_SIZE
): { newGrid: Rune[][]; burnedCount: number } => {
  let burnedCount = 0;
  const newGrid = runeGrid.map(row => row.map(rune => {
    if (rune.burnMarked && rune.tileType !== 'obstacle' && rune.tileType !== 'frozen') {
      burnedCount++;
      return { ...rune, element: getRandomElement(), burnMarked: false };
    }
    return { ...rune, burnMarked: false };
  }));
  return { newGrid, burnedCount };
};

export const applyFrostTerrainEffect = (
  runeGrid: Rune[][],
  terrainGrid: TerrainCell[][],
  gridSize: number = GRID_SIZE
): Rune[][] => {
  const newGrid = runeGrid.map(row => row.map(rune => ({ ...rune })));
  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      if (terrainGrid[row][col].type === 'frost') {
        const rune = newGrid[row][col];
        if (rune.tileType !== 'obstacle' && rune.tileType !== 'frozen') {
          if (!rune.terrainFrozenTurns || rune.terrainFrozenTurns <= 0) {
            newGrid[row][col] = { ...rune, terrainFrozenTurns: 2 };
          }
        }
      }
    }
  }
  return newGrid;
};

export const decrementTerrainFrozen = (
  runeGrid: Rune[][],
  gridSize: number = GRID_SIZE
): Rune[][] => {
  return runeGrid.map(row => row.map(rune => {
    if (rune.terrainFrozenTurns && rune.terrainFrozenTurns > 0) {
      return { ...rune, terrainFrozenTurns: rune.terrainFrozenTurns - 1 };
    }
    return { ...rune, terrainFrozenTurns: 0 };
  }));
};

export const calculateThornsDamage = (
  matchedRunes: Rune[],
  terrainGrid: TerrainCell[][],
  damagePerThorn: number = 5
): number => {
  let totalDamage = 0;
  for (const rune of matchedRunes) {
    if (terrainGrid[rune.row]?.[rune.col]?.type === 'thorns') {
      totalDamage += damagePerThorn;
    }
  }
  return totalDamage;
};

export const applyStormTerrainEffect = (
  runeGrid: Rune[][],
  terrainGrid: TerrainCell[][],
  gridSize: number = GRID_SIZE
): { newGrid: Rune[][]; changedCount: number } => {
  let changedCount = 0;
  const newGrid = runeGrid.map(row => row.map(rune => ({ ...rune })));
  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      if (terrainGrid[row][col].type === 'storm') {
        const rune = newGrid[row][col];
        if (rune.tileType !== 'obstacle' && rune.tileType !== 'frozen') {
          if (Math.random() < 0.7) {
            changedCount++;
            newGrid[row][col] = { ...rune, element: getRandomElement() };
          }
        }
      }
    }
  }
  return { newGrid, changedCount };
};
