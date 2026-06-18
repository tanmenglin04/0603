import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTowerStore } from '../store/useTowerStore';
import { BattleProvider } from '../contexts/BattleContext';
import { EnergyPool } from '../components/EnergyPool';
import { SpellButtons } from '../components/SpellButtons';
import { EnemyCard } from '../components/EnemyCard';
import { TurnInfo } from '../components/TurnInfo';
import { FloatingTexts } from '../components/FloatingTexts';
import { SpellEffect } from '../components/SpellEffect';
import { ConnectionCanvas } from '../components/ConnectionCanvas';
import { create } from 'zustand';
import type { 
  Rune, 
  Spell, 
  EnergyPool as EnergyPoolType, 
  ComboSpell, 
  Minion, 
  CombatUnit, 
  Enemy, 
  ElementType, 
  ComboElementType,
  SpecialTileConfig,
  TowerDebuff,
  TowerDebuffType
} from '../types';
import { 
  DEFAULT_BEHAVIOR_STATE, 
  SPELLS, 
  ELEMENT_ICONS,
  TOWER_DEBUFFS
} from '../types';
import {
  canAddToSelection,
  markMatchedRunes,
  processMatchesAndDrop,
  findAllMatches,
  calculateEnergyGain,
  generateId,
  processFrozenHits,
  saveDoubleEnergyCells,
  decrementDoubleEnergyTurns,
  canCastComboSpell,
  createStatusEffect,
  applyStatusEffectToEnemy,
  processStatusEffects,
  getEffectiveAttackDamage,
  calculateDamageWithResistanceEffect,
  calculateComboDamageWithResistanceEffect,
} from '../utils/gameLogic';
import {
  decideEnemyBehavior,
  executeEnemyBehavior,
  processMinionsTurn,
  processBerserkSelfDamage,
  calculateDamageToEnemy,
} from '../utils/enemyAI';
import { getEquippedItems } from '../utils/localStorage';
import { getEquipmentBonuses } from '../utils/runeEquipment';
import { AudioPanel } from '../components/AudioPanel';
import { useSceneAudio, useBattleHpAudio, useAudio } from '../audio/AudioContext';
import { audioManager, type SpellType } from '../audio/AudioManager';

interface TowerBattleState {
  energy: EnergyPoolType;
  runeGrid: Rune[][];
  selectedRunes: Rune[];
  enemy: Enemy | null;
  enemyUnits: CombatUnit[];
  selectedTargetId: string | null;
  turn: number;
  isPlayerTurn: boolean;
  battleStatus: 'idle' | 'playing' | 'victory' | 'defeat';
  comboCount: number;
  floatingTexts: Array<{ id: string; text: string; x: number; y: number; color: string; createdAt: number }>;
  isAnimating: boolean;
  screenShake: boolean;
  spellEffect: ElementType | ComboElementType | null;
  comboSpellCooldowns: Record<string, number>;
  gridSize: number;
  maxEnergy: number;
  healMultiplier: number;
  hasExtraTurn: boolean;
  extraTurnUsed: boolean;
  playerHpRef: { current: number };
  playerMaxHpRef: { current: number };
  towerBlessings: string[];
  excludedElements: string[];
  towerDebuffs: TowerDebuff[];
  towerDebuffTypes: TowerDebuffType[];
  branchCritChance: number;
  branchRegenPerTurn: number;
  branchDamageMultiplier: number;
  branchShieldPerTurn: number;
  branchStartShield: number;
  playerShieldRef: { current: number };
  canComboSpell: boolean;
  firstTurnSpellLocked: boolean;
}

interface TowerBattleActions {
  initBattle: (
    enemy: Enemy, 
    gridSize: number, 
    maxEnergy: number, 
    specialTiles: Partial<SpecialTileConfig> & { excludedElements?: string[] }, 
    healMultiplier: number, 
    playerHp: number, 
    playerMaxHp: number, 
    blessings: string[],
    debuffs: TowerDebuff[],
    branchCritChance: number,
    branchRegenPerTurn: number,
    branchDamageMultiplier: number,
    branchShieldPerTurn: number,
    branchStartShield: number
  ) => void;
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
  setScreenShake: (shake: boolean) => void;
  setSpellEffect: (element: ElementType | ComboElementType | null) => void;
  notifyVictory: () => void;
  decrementCooldowns: () => void;
  applyStatusEffects: () => void;
  selectTarget: (unitId: string) => void;
  damageUnit: (unitId: string, damage: number) => void;
  addMinion: (minion: Minion) => void;
  removeMinion: (minionId: string) => void;
  updateMinion: (minionId: string, updates: Partial<Minion>) => void;
  setPlayerHp: (hp: number) => void;
  getPlayerHp: () => number;
}

type TowerBattleStore = TowerBattleState & TowerBattleActions;

const initialEnergy: EnergyPoolType = {
  fire: 0,
  water: 0,
  grass: 0,
  thunder: 0,
};

const createRuneGridWithExclusions = (size: number, specialConfig?: Partial<SpecialTileConfig> & { excludedElements?: string[] }): Rune[][] => {
  const excludedElements = specialConfig?.excludedElements || [];
  const elements: ElementType[] = ['fire', 'water', 'grass', 'thunder'].filter(e => !excludedElements.includes(e)) as ElementType[];
  
  const getRandomElement = (): ElementType => {
    return elements[Math.floor(Math.random() * elements.length)];
  };
  
  const createRune = (row: number, col: number, isNew = false, tileType: Rune['tileType'] = 'normal', frozenHitCount = 0, doubleEnergyTurnsLeft = 0): Rune => ({
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
  });

  function shuffleArray<T>(array: T[]): T[] {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  const grid: Rune[][] = [];
  const specialMap: Map<string, Rune['tileType']> = new Map();

  if (specialConfig) {
    const allPositions: { row: number; col: number }[] = [];
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        allPositions.push({ row, col });
      }
    }
    const shuffled = shuffleArray(allPositions);
    let idx = 0;

    for (let i = 0; i < (specialConfig.obstacle || 0) && idx < shuffled.length; i++, idx++) {
      specialMap.set(`${shuffled[idx].row},${shuffled[idx].col}`, 'obstacle');
    }
    for (let i = 0; i < (specialConfig.frozen || 0) && idx < shuffled.length; i++, idx++) {
      specialMap.set(`${shuffled[idx].row},${shuffled[idx].col}`, 'frozen');
    }
    for (let i = 0; i < (specialConfig.doubleEnergy || 0) && idx < shuffled.length; i++, idx++) {
      specialMap.set(`${shuffled[idx].row},${shuffled[idx].col}`, 'double_energy');
    }
  }

  for (let row = 0; row < size; row++) {
    grid[row] = [];
    for (let col = 0; col < size; col++) {
      const key = `${row},${col}`;
      const tileType = specialMap.get(key) || 'normal';
      const frozenHitCount = 0;
      const doubleEnergyTurnsLeft = tileType === 'double_energy' ? 3 : 0;
      grid[row][col] = createRune(row, col, false, tileType, frozenHitCount, doubleEnergyTurnsLeft);
    }
  }

  const removeInitialMatches = (g: Rune[][]): Rune[][] => {
    let hasMatches = true;
    while (hasMatches) {
      hasMatches = false;
      for (let row = 0; row < size; row++) {
        for (let col = 0; col < size; col++) {
          const tileType = g[row][col].tileType;
          if (tileType === 'obstacle' || tileType === 'frozen') continue;

          if (col < size - 2) {
            const t1 = g[row][col].tileType;
            const t2 = g[row][col + 1].tileType;
            const t3 = g[row][col + 2].tileType;
            if (
              t1 !== 'obstacle' && t1 !== 'frozen' &&
              t2 !== 'obstacle' && t2 !== 'frozen' &&
              t3 !== 'obstacle' && t3 !== 'frozen' &&
              g[row][col].element === g[row][col + 1].element &&
              g[row][col].element === g[row][col + 2].element
            ) {
              g[row][col] = createRune(row, col, false, g[row][col].tileType, g[row][col].frozenHitCount, g[row][col].doubleEnergyTurnsLeft);
              hasMatches = true;
            }
          }
          if (row < size - 2) {
            const t1 = g[row][col].tileType;
            const t2 = g[row + 1][col].tileType;
            const t3 = g[row + 2][col].tileType;
            if (
              t1 !== 'obstacle' && t1 !== 'frozen' &&
              t2 !== 'obstacle' && t2 !== 'frozen' &&
              t3 !== 'obstacle' && t3 !== 'frozen' &&
              g[row][col].element === g[row + 1][col].element &&
              g[row][col].element === g[row + 2][col].element
            ) {
              g[row][col] = createRune(row, col, false, g[row][col].tileType, g[row][col].frozenHitCount, g[row][col].doubleEnergyTurnsLeft);
              hasMatches = true;
            }
          }
        }
      }
    }
    return g;
  };

  return removeInitialMatches(grid);
};

const getAdjustedSpellCost = (spell, excludedElements: string[]): number => {
  if (excludedElements.includes(spell.element)) {
    return Math.max(1, spell.cost - 1);
  }
  return spell.cost;
};

const getAdjustedComboCost = (spell: ComboSpell, excludedElements: string[]): Partial<Record<ElementType, number>> => {
  const adjustedCost: Partial<Record<ElementType, number>> = {};
  Object.entries(spell.cost).forEach(([element, cost]) => {
    const el = element as ElementType;
    if (excludedElements.includes(el)) {
      adjustedCost[el] = Math.max(1, (cost || 0) - 1);
    } else {
      adjustedCost[el] = cost;
    }
  });
  return adjustedCost;
};

const canCastSpellWithAdjustment = (spell: Spell, energy: EnergyPoolType, excludedElements: string[]): boolean => {
  const adjustedCost = getAdjustedSpellCost(spell, excludedElements);
  return energy[spell.element] >= adjustedCost;
};

const canCastComboSpellWithAdjustment = (spell: ComboSpell, energy: EnergyPoolType, excludedElements: string[]): boolean => {
  const adjustedCost = getAdjustedComboCost(spell, excludedElements);
  return Object.entries(adjustedCost).every(([element, cost]) => {
    return energy[element as ElementType] >= (cost || 0);
  });
};

export const useTowerBattleStore = create<TowerBattleStore>((set, get) => ({
  energy: { ...initialEnergy },
  runeGrid: [],
  selectedRunes: [],
  enemy: null,
  enemyUnits: [],
  selectedTargetId: null,
  turn: 1,
  isPlayerTurn: true,
  battleStatus: 'idle',
  comboCount: 0,
  floatingTexts: [],
  isAnimating: false,
  screenShake: false,
  spellEffect: null,
  comboSpellCooldowns: {},
  gridSize: 6,
  maxEnergy: 10,
  healMultiplier: 1,
  hasExtraTurn: false,
  extraTurnUsed: false,
  playerHpRef: { current: 100 },
  playerMaxHpRef: { current: 100 },
  towerBlessings: [],
  excludedElements: [],
  towerDebuffs: [],
  towerDebuffTypes: [],
  branchCritChance: 0,
  branchRegenPerTurn: 0,
  branchDamageMultiplier: 0,
  branchShieldPerTurn: 0,
  branchStartShield: 0,
  playerShieldRef: { current: 0 },
  canComboSpell: true,
  firstTurnSpellLocked: false,

  initBattle: (
    enemy, 
    gridSize, 
    maxEnergy, 
    specialTiles, 
    healMultiplier, 
    playerHp, 
    playerMaxHp, 
    blessings,
    debuffs,
    branchCritChance,
    branchRegenPerTurn,
    branchDamageMultiplier,
    branchShieldPerTurn,
    branchStartShield
  ) => {
    const enemyUnits: CombatUnit[] = [enemy];
    const excludedElements = specialTiles.excludedElements || [];
    const debuffTypes = debuffs.map(d => d.type);
    
    let energy = { ...initialEnergy };
    const equippedItems = getEquippedItems();
    const bonuses = getEquipmentBonuses(equippedItems);
    for (const [el, val] of Object.entries(bonuses.initialEnergy)) {
      if (val) {
        const k = el as keyof EnergyPoolType;
        energy[k] = Math.min(maxEnergy, energy[k] + val);
      }
    }

    if (debuffTypes.includes('mana_drain')) {
      Object.keys(energy).forEach(key => {
        const k = key as keyof EnergyPoolType;
        energy[k] = Math.max(0, energy[k] - 2);
      });
    }

    if (blessings.includes('double_first_energy')) {
      Object.keys(energy).forEach(key => {
        const k = key as keyof EnergyPoolType;
        energy[k] = Math.min(maxEnergy, energy[k] * 2);
      });
    }

    const canComboSpell = !debuffTypes.includes('spell_seal');
    const firstTurnSpellLocked = debuffTypes.includes('dragon_fear');

    const initialShield = branchStartShield 
      + (blessings.includes('start_with_shield') ? 15 : 0)
      + (blessings.includes('damage_shield') ? 20 : 0);

    set({
      energy,
      runeGrid: createRuneGridWithExclusions(gridSize, specialTiles),
      selectedRunes: [],
      enemy,
      enemyUnits,
      selectedTargetId: enemy.id,
      excludedElements,
      turn: 1,
      isPlayerTurn: true,
      battleStatus: 'playing',
      comboCount: 0,
      floatingTexts: [],
      isAnimating: false,
      screenShake: false,
      spellEffect: null,
      comboSpellCooldowns: {},
      gridSize,
      maxEnergy,
      healMultiplier,
      hasExtraTurn: false,
      extraTurnUsed: false,
      playerHpRef: { current: playerHp },
      playerMaxHpRef: { current: playerMaxHp },
      towerBlessings: blessings,
      towerDebuffs: debuffs,
      towerDebuffTypes: debuffTypes,
      branchCritChance,
      branchRegenPerTurn,
      branchDamageMultiplier,
      branchShieldPerTurn,
      branchStartShield,
      playerShieldRef: { current: initialShield },
      canComboSpell,
      firstTurnSpellLocked,
    });
  },

  setPlayerHp: (hp) => {
    set(state => ({ playerHpRef: { ...state.playerHpRef, current: hp } }));
  },

  getPlayerHp: () => get().playerHpRef.current,

  getPlayerShield: () => get().playerShieldRef.current,

  applyDamageWithShield: (rawDamage: number): number => {
    const { towerDebuffTypes, playerShieldRef, playerMaxHpRef } = get();
    let damage = rawDamage;
    if (towerDebuffTypes.includes('curse')) {
      damage = Math.floor(damage * 1.25);
    }
    let shieldAbsorbed = 0;
    if (playerShieldRef.current > 0) {
      let shieldEfficiency = 1;
      if (towerDebuffTypes.includes('despair')) {
        shieldEfficiency = 0.5;
      }
      const effectiveShield = Math.floor(playerShieldRef.current * shieldEfficiency);
      shieldAbsorbed = Math.min(effectiveShield, damage);
      const actualShieldDeduction = shieldEfficiency === 1 
        ? shieldAbsorbed 
        : Math.ceil(shieldAbsorbed / shieldEfficiency);
      set(state => ({
        playerShieldRef: { ...state.playerShieldRef, current: Math.max(0, state.playerShieldRef.current - actualShieldDeduction) }
      }));
      damage -= shieldAbsorbed;
    }
    return Math.max(0, damage);
  },

  addPlayerShield: (amount: number) => {
    set(state => ({
      playerShieldRef: { ...state.playerShieldRef, current: state.playerShieldRef.current + amount }
    }));
  },

  selectRune: (rune: Rune) => {
    const { isPlayerTurn, battleStatus, isAnimating } = get();
    if (!isPlayerTurn || battleStatus !== 'playing' || isAnimating) return;

    if (rune.tileType === 'obstacle' || rune.tileType === 'frozen') return;

    const newGrid = get().runeGrid.map(row =>
      row.map(r => ({ ...r, isSelected: r.id === rune.id }))
    );

    set({
      runeGrid: newGrid,
      selectedRunes: [rune],
    });
  },

  addSelectedRune: (rune: Rune) => {
    const { isPlayerTurn, battleStatus, isAnimating, selectedRunes, runeGrid } = get();
    if (!isPlayerTurn || battleStatus !== 'playing' || isAnimating) return;

    if (!canAddToSelection(selectedRunes, rune, runeGrid)) return;

    const newSelectedRunes = [...selectedRunes, rune];
    const newGrid = get().runeGrid.map(row =>
      row.map(r => ({
        ...r,
        isSelected: newSelectedRunes.some(sr => sr.id === r.id),
      }))
    );

    set({
      runeGrid: newGrid,
      selectedRunes: newSelectedRunes,
    });
  },

  clearSelectedRunes: () => {
    const newGrid = get().runeGrid.map(row =>
      row.map(r => ({ ...r, isSelected: false }))
    );
    set({
      runeGrid: newGrid,
      selectedRunes: [],
    });
  },

  selectTarget: (unitId: string) => {
    const { enemyUnits } = get();
    const target = enemyUnits.find(u => u.id === unitId);
    if (!target || !target.isTargetable) return;

    const updatedUnits = enemyUnits.map(u => ({
      ...u,
      isSelected: u.id === unitId,
    }));

    set({
      enemyUnits: updatedUnits,
      selectedTargetId: unitId,
      enemy: updatedUnits.find(u => u.type === 'enemy') as Enemy || null,
    });
  },

  damageUnit: (unitId: string, damage: number) => {
    const { enemyUnits, selectedTargetId } = get();
    
    const calculateAndApplyDamage = (
      units: CombatUnit[],
      targetId: string,
      baseDamage: number
    ): { updatedUnits: CombatUnit[]; killedUnit?: CombatUnit; finalDamage: number } => {
      let killedUnit: CombatUnit | undefined;
      let finalDamage = baseDamage;

      const updatedUnits = units.map(unit => {
        if (unit.id !== targetId) return unit;

        let damage = baseDamage;
        if (unit.type === 'enemy') {
          damage = calculateDamageToEnemy(unit as Enemy, baseDamage);
        }

        finalDamage = damage;
        const newHp = Math.max(0, unit.currentHp - damage);
        if (newHp <= 0) {
          killedUnit = unit;
        }
        return { ...unit, currentHp: newHp };
      }).filter(u => u.currentHp > 0);

      return { updatedUnits, killedUnit, finalDamage };
    };
    
    const { updatedUnits, killedUnit } = calculateAndApplyDamage(enemyUnits, unitId, damage);
    const mainEnemy = updatedUnits.find(u => u.type === 'enemy') as Enemy | undefined;

    let newSelectedTargetId = selectedTargetId;
    if (killedUnit && killedUnit.id === selectedTargetId) {
      newSelectedTargetId = mainEnemy?.id || null;
      if (updatedUnits.length > 0 && !newSelectedTargetId) {
        newSelectedTargetId = updatedUnits[0].id;
      }
    }

    set({
      enemyUnits: updatedUnits,
      enemy: mainEnemy || null,
      selectedTargetId: newSelectedTargetId,
    });
  },

  addMinion: (minion: Minion) => {
    const { enemyUnits, selectedTargetId } = get();
    const newUnits = [...enemyUnits, minion];
    set({
      enemyUnits: newUnits,
      selectedTargetId: selectedTargetId || minion.id,
    });
  },

  removeMinion: (minionId: string) => {
    const { enemyUnits, selectedTargetId, enemy } = get();
    const updatedUnits = enemyUnits.filter(u => u.id !== minionId);
    const newSelectedTargetId = selectedTargetId === minionId 
      ? (enemy?.id || updatedUnits[0]?.id || null)
      : selectedTargetId;
    
    set({
      enemyUnits: updatedUnits,
      selectedTargetId: newSelectedTargetId,
    });
  },

  updateMinion: (minionId: string, updates: Partial<Minion>) => {
    const { enemyUnits } = get();
    const updatedUnits = enemyUnits.map(unit => 
      unit.id === minionId ? { ...unit, ...updates } : unit
    );
    set({ enemyUnits: updatedUnits });
  },

  confirmMatch: () => {
    const { selectedRunes, comboCount, isPlayerTurn, battleStatus, isAnimating, towerBlessings, towerDebuffTypes } = get();
    if (!isPlayerTurn || battleStatus !== 'playing' || isAnimating) return;

    if (selectedRunes.length < 3) {
      get().clearSelectedRunes();
      return;
    }

    set({ isAnimating: true });

    const element = selectedRunes[0].element;
    const matchCount = selectedRunes.length;
    const doubleEnergyInSelection = selectedRunes.filter(r => r.tileType === 'double_energy').length;
    const currentGridSize = get().gridSize;

    audioManager.playRuneMatch(matchCount, comboCount + 1);

    if (matchCount >= 5 && towerBlessings.includes('extra_turn_big_match')) {
      set({ hasExtraTurn: true });
    }

    let grid = markMatchedRunes(get().runeGrid, selectedRunes);
    grid = processFrozenHits(grid, selectedRunes, currentGridSize);
    set({ runeGrid: grid, selectedRunes: [] });

    const energyGain = calculateEnergyGain(matchCount, comboCount, element, doubleEnergyInSelection);
    const currentEnergy = get().energy;
    const newEnergy = { ...currentEnergy };
    const equippedItems = getEquippedItems();
    const bonuses = getEquipmentBonuses(equippedItems);
    const hasCorruption = towerDebuffTypes.includes('corruption');
    Object.entries(energyGain).forEach(([key, value]) => {
      const k = key as keyof EnergyPoolType;
      let gain = value || 0;
      const boost = bonuses.energyBoost[k] || 0;
      if (boost > 0) {
        gain = Math.floor(gain + boost);
      }
      if (towerBlessings.includes('double_combo') && comboCount > 0) {
        gain *= 2;
      }
      if (hasCorruption) {
        gain = Math.floor(gain * 0.7);
      }
      newEnergy[k] = Math.min(get().maxEnergy, currentEnergy[k] + gain);
      if (gain > 0) {
        get().addFloatingText(`+${gain}${boost > 0 ? ` (+${boost})` : ''}`, 300, 200, element);
      }
    });
    if (doubleEnergyInSelection > 0) {
      get().addFloatingText('双倍能量!', 300, 160, 'thunder');
    }

    const deCells = saveDoubleEnergyCells(grid, currentGridSize);

    setTimeout(() => {
      const { newGrid } = processMatchesAndDrop(grid, deCells, currentGridSize);
      grid = newGrid;
      
      let currentCombo = comboCount;
      let totalCombo = 1;

      const processChain = () => {
        const chainMatches = findAllMatches(grid, currentGridSize);
        if (chainMatches.length > 0) {
          currentCombo++;
          totalCombo++;

          audioManager.playComboChain(currentCombo);
          audioManager.playRuneMatch(chainMatches.length, currentCombo);

          const chainDeBefore = saveDoubleEnergyCells(grid, currentGridSize);
          grid = processFrozenHits(grid, chainMatches, currentGridSize);
          grid = markMatchedRunes(grid, chainMatches);
          set({ runeGrid: grid, comboCount: currentCombo });

          setTimeout(() => {
            const result = processMatchesAndDrop(grid, chainDeBefore, currentGridSize);
            grid = result.newGrid;
            
            Object.entries(result.matchedElements).forEach(([el, count]) => {
              if (count > 0) {
                const gain = calculateEnergyGain(count, currentCombo, el as keyof EnergyPoolType, result.doubleEnergyCount);
                Object.entries(gain).forEach(([key, value]) => {
                  const k = key as keyof EnergyPoolType;
                  let amount = value || 0;
                  const boost = bonuses.energyBoost[k] || 0;
                  if (boost > 0) {
                    amount = Math.floor(amount + boost);
                  }
                  if (towerBlessings.includes('double_combo')) {
                    amount *= 2;
                  }
                  if (hasCorruption) {
                    amount = Math.floor(amount * 0.7);
                  }
                  newEnergy[k] = Math.min(get().maxEnergy, newEnergy[k] + amount);
                });
              }
            });

            set({ runeGrid: grid });
            processChain();
          }, 300);
        } else {
          set({
            runeGrid: grid,
            energy: newEnergy,
            comboCount: 0,
            isAnimating: false,
          });
          
          get().endTurn();
        }
      };

      set({ runeGrid: grid, energy: newEnergy });
      processChain();
    }, 300);
  },

  castSpell: (spell: Spell) => {
    const { isPlayerTurn, battleStatus, isAnimating, energy, enemyUnits, selectedTargetId, healMultiplier, towerBlessings, excludedElements, towerDebuffTypes, branchCritChance, branchDamageMultiplier, firstTurnSpellLocked, turn } = get();
    if (!isPlayerTurn || battleStatus !== 'playing' || isAnimating) return;

    if (firstTurnSpellLocked && turn === 1) {
      get().addFloatingText('龙威震慑!', 300, 250, 'red');
      return;
    }

    const adjustedCost = getAdjustedSpellCost(spell, excludedElements);
    if (energy[spell.element] < adjustedCost) return;

    const getSelectedUnit = (units: CombatUnit[], selectedId: string | null): CombatUnit | null => {
      if (!selectedId) return null;
      return units.find(u => u.id === selectedId) || null;
    };

    const target = getSelectedUnit(enemyUnits, selectedTargetId);
    if (!target) return;

    set({ isAnimating: true, spellEffect: spell.element });

    const currentCombo = get().comboCount;
    let spellType: SpellType = 'fireball';
    switch (spell.id) {
      case 'fireball':
        spellType = 'fireball';
        break;
      case 'thunder-strike':
        spellType = 'thunder_strike';
        break;
      case 'water-heal':
        spellType = 'heal';
        break;
      case 'vine-whip':
        spellType = 'vine_whip';
        break;
      default:
        spellType = 'fireball';
    }
    audioManager.playSpell(spellType, currentCombo + 1);

    const newEnergy = { ...energy };
    newEnergy[spell.element] -= adjustedCost;

    const calculateAndApplyDamage = (
      units: CombatUnit[],
      targetId: string,
      baseDamage: number
    ): { updatedUnits: CombatUnit[]; killedUnit?: CombatUnit; finalDamage: number } => {
      let killedUnit: CombatUnit | undefined;
      let finalDamage = baseDamage;

      const updatedUnits = units.map(unit => {
        if (unit.id !== targetId) return unit;

        let damage = baseDamage;
        if (unit.type === 'enemy') {
          damage = calculateDamageToEnemy(unit as Enemy, baseDamage);
        }

        finalDamage = damage;
        const newHp = Math.max(0, unit.currentHp - damage);
        if (newHp <= 0) {
          killedUnit = unit;
        }
        return { ...unit, currentHp: newHp };
      }).filter(u => u.currentHp > 0);

      return { updatedUnits, killedUnit, finalDamage };
    };

    let damage = 0;
    let isEffective = false;
    let isWeak = false;

    if (target.type === 'enemy') {
      const result = calculateDamageWithResistanceEffect(spell, target as Enemy);
      damage = result.damage;
      isEffective = result.isEffective;
      isWeak = result.isWeak;
    } else {
      damage = spell.damage;
    }

    const eqItems = getEquippedItems();
    const eqBonuses = getEquipmentBonuses(eqItems);
    const spellDmgBonus = eqBonuses.spellDamage[spell.element] || 0;
    if (spellDmgBonus > 0) {
      damage = Math.floor(damage * (1 + spellDmgBonus / 100));
    }

    if (branchDamageMultiplier !== 0) {
      damage = Math.floor(damage * (1 + branchDamageMultiplier));
    }

    const baseCritChance = towerBlessings.includes('critical_hit') ? 0.2 : 0;
    const totalCritChance = baseCritChance + branchCritChance;
    if (totalCritChance > 0 && Math.random() < totalCritChance) {
      damage = Math.floor(damage * 1.5);
      get().addFloatingText('暴击!', 400, 120, 'yellow');
    }

    let finalDamage = damage;
    let currentUnits = [...enemyUnits];
    
    if (towerBlessings.includes('spell_splash')) {
      const splashDamage = Math.floor(damage * 0.5);
      currentUnits = currentUnits.map(unit => {
        if (unit.id === target.id) return unit;
        const unitDamage = unit.type === 'enemy' 
          ? calculateDamageToEnemy(unit as Enemy, splashDamage)
          : splashDamage;
        return { ...unit, currentHp: Math.max(0, unit.currentHp - unitDamage) };
      }).filter(u => u.currentHp > 0);
    }

    const { updatedUnits, killedUnit, finalDamage: targetDamage } = calculateAndApplyDamage(currentUnits, target.id, damage);
    finalDamage = targetDamage;
    
    let newSelectedTargetId = selectedTargetId;
    if (killedUnit && killedUnit.id === selectedTargetId) {
      const mainEnemy = updatedUnits.find(u => u.type === 'enemy');
      newSelectedTargetId = mainEnemy?.id || (updatedUnits[0]?.id || null);
    }
    
    const mainEnemy = updatedUnits.find(u => u.type === 'enemy') as Enemy | undefined;
    
    set({
      enemyUnits: updatedUnits,
      enemy: mainEnemy || null,
      selectedTargetId: newSelectedTargetId,
    });
    
    let healAmount = spell.heal;
    if (healAmount > 0) {
      healAmount = Math.floor(healAmount * healMultiplier);
    }
    let currentHp = get().playerHpRef.current;
    if (healAmount > 0) {
      if (towerDebuffTypes.includes('void_touch')) {
        const voidDamage = healAmount;
        currentHp = Math.max(0, currentHp - voidDamage);
        get().addFloatingText(`虚空之触! -${voidDamage}`, 200, 400, 'purple');
      } else {
        currentHp = Math.min(get().playerMaxHpRef.current, currentHp + healAmount);
      }
    }
    set(state => ({ playerHpRef: { ...state.playerHpRef, current: currentHp } }));

    if (towerBlessings.includes('life_steal') && finalDamage > 0) {
      const lifeSteal = Math.floor(finalDamage * 0.1);
      let newHpAfterSteal = get().playerHpRef.current;
      if (towerDebuffTypes.includes('void_touch')) {
        newHpAfterSteal = Math.max(0, newHpAfterSteal - lifeSteal);
      } else {
        newHpAfterSteal = Math.min(get().playerMaxHpRef.current, newHpAfterSteal + lifeSteal);
      }
      set(state => ({ playerHpRef: { ...state.playerHpRef, current: newHpAfterSteal } }));
      if (!towerDebuffTypes.includes('void_touch')) {
        get().addFloatingText(`汲取 +${lifeSteal}`, 200, 420, 'green');
      }
    }

    setTimeout(() => {
      get().setScreenShake(true);
      setTimeout(() => get().setScreenShake(false), 300);

      if (finalDamage > 0) {
        let damageText = `-${finalDamage}`;
        if (isEffective) damageText += ' 效果拔群！';
        if (isWeak) damageText += ' 效果不佳...';
        get().addFloatingText(damageText, 400, 150, spell.element);
        audioManager.playEnemyHit(finalDamage, isEffective || finalDamage >= 30);
      }
      if (spell.heal > 0) {
        get().addFloatingText(`+${healAmount}`, 200, 400, 'grass');
      }

      if (killedUnit) {
        get().addFloatingText(`${killedUnit.name} 被击败!`, 400, 200, 'yellow');
      }

      const { enemyUnits: latestUnits } = get();
      const currentMainEnemy = latestUnits.find(u => u.type === 'enemy') as Enemy | undefined;

      set({
        energy: newEnergy,
        spellEffect: null,
        isAnimating: false,
      });

      if (!currentMainEnemy || currentMainEnemy.currentHp <= 0) {
        set({ battleStatus: 'victory' });
        get().notifyVictory();
      }
    }, 500);
  },

  castComboSpell: (spell: ComboSpell) => {
    const { isPlayerTurn, battleStatus, isAnimating, energy, enemyUnits, selectedTargetId, comboSpellCooldowns, towerBlessings, excludedElements, towerDebuffTypes, branchCritChance, branchDamageMultiplier, canComboSpell, firstTurnSpellLocked, turn } = get();
    if (!isPlayerTurn || battleStatus !== 'playing' || isAnimating) return;

    if (!canComboSpell) {
      get().addFloatingText('法术封印!', 300, 250, 'purple');
      return;
    }

    if (firstTurnSpellLocked && turn === 1) {
      get().addFloatingText('龙威震慑!', 300, 250, 'red');
      return;
    }

    if (!canCastComboSpellWithAdjustment(spell, energy, excludedElements)) return;
    if (comboSpellCooldowns[spell.id] > 0) return;

    const getSelectedUnit = (units: CombatUnit[], selectedId: string | null): CombatUnit | null => {
      if (!selectedId) return null;
      return units.find(u => u.id === selectedId) || null;
    };

    const target = getSelectedUnit(enemyUnits, selectedTargetId);
    if (!target) return;

    set({ isAnimating: true, spellEffect: spell.elements });

    const currentCombo = get().comboCount;
    audioManager.playSpell('combo', currentCombo + 1);

    const adjustedCost = getAdjustedComboCost(spell, excludedElements);
    const newEnergy = { ...energy };
    Object.entries(adjustedCost).forEach(([element, cost]) => {
      newEnergy[element as keyof EnergyPoolType] -= cost || 0;
    });

    const calculateAndApplyDamage = (
      units: CombatUnit[],
      targetId: string,
      baseDamage: number
    ): { updatedUnits: CombatUnit[]; killedUnit?: CombatUnit; finalDamage: number } => {
      let killedUnit: CombatUnit | undefined;
      let finalDamage = baseDamage;

      const updatedUnits = units.map(unit => {
        if (unit.id !== targetId) return unit;

        let damage = baseDamage;
        if (unit.type === 'enemy') {
          damage = calculateDamageToEnemy(unit as Enemy, baseDamage);
        }

        finalDamage = damage;
        const newHp = Math.max(0, unit.currentHp - damage);
        if (newHp <= 0) {
          killedUnit = unit;
        }
        return { ...unit, currentHp: newHp };
      }).filter(u => u.currentHp > 0);

      return { updatedUnits, killedUnit, finalDamage };
    };

    let damage = 0;
    let isEffective = false;
    let isWeak = false;

    if (target.type === 'enemy') {
      const result = calculateComboDamageWithResistanceEffect(spell, target as Enemy);
      damage = result.damage;
      isEffective = result.isEffective;
      isWeak = result.isWeak;
    } else {
      damage = spell.damage;
    }

    const comboElements = spell.elements.split('+') as ElementType[];
    const eqItems = getEquippedItems();
    const eqBonuses = getEquipmentBonuses(eqItems);
    const avgDmgBonus = comboElements.reduce((sum, el) => sum + (eqBonuses.spellDamage[el] || 0), 0) / comboElements.length;
    if (avgDmgBonus > 0) {
      damage = Math.floor(damage * (1 + avgDmgBonus / 100));
    }

    if (branchDamageMultiplier !== 0) {
      damage = Math.floor(damage * (1 + branchDamageMultiplier));
    }

    const baseCritChance = towerBlessings.includes('critical_hit') ? 0.2 : 0;
    const totalCritChance = baseCritChance + branchCritChance;
    if (totalCritChance > 0 && Math.random() < totalCritChance) {
      damage = Math.floor(damage * 1.5);
      get().addFloatingText('暴击!', 400, 120, 'yellow');
    }

    const { updatedUnits, killedUnit, finalDamage } = calculateAndApplyDamage(enemyUnits, target.id, damage);
    
    let newSelectedTargetId = selectedTargetId;
    if (killedUnit && killedUnit.id === selectedTargetId) {
      const mainEnemy = updatedUnits.find(u => u.type === 'enemy');
      newSelectedTargetId = mainEnemy?.id || (updatedUnits[0]?.id || null);
    }
    
    let finalUnits = updatedUnits;
    let mainEnemy = finalUnits.find(u => u.type === 'enemy') as Enemy | undefined;

    const statusEffect = createStatusEffect(spell.effect, spell.effectDuration, spell.effectValue, spell.id);
    
    if (mainEnemy && target.type === 'enemy') {
      mainEnemy = applyStatusEffectToEnemy(mainEnemy, statusEffect);
      finalUnits = finalUnits.map(u => u.type === 'enemy' ? mainEnemy : u);
    }
    
    set({
      enemyUnits: finalUnits,
      enemy: mainEnemy || null,
      selectedTargetId: newSelectedTargetId,
    });

    if (towerBlessings.includes('life_steal') && finalDamage > 0) {
      const lifeSteal = Math.floor(finalDamage * 0.1);
      let newHp = get().playerHpRef.current;
      if (towerDebuffTypes.includes('void_touch')) {
        newHp = Math.max(0, newHp - lifeSteal);
      } else {
        newHp = Math.min(get().playerMaxHpRef.current, newHp + lifeSteal);
      }
      set(state => ({ playerHpRef: { ...state.playerHpRef, current: newHp } }));
      if (!towerDebuffTypes.includes('void_touch')) {
        get().addFloatingText(`汲取 +${lifeSteal}`, 200, 420, 'green');
      }
    }

    const newCooldowns = { ...comboSpellCooldowns };
    newCooldowns[spell.id] = spell.cooldown;

    setTimeout(() => {
      get().setScreenShake(true);
      setTimeout(() => get().setScreenShake(false), 300);

      if (finalDamage > 0) {
        let damageText = `-${finalDamage}`;
        if (isEffective) damageText += ' 效果拔群！';
        if (isWeak) damageText += ' 效果不佳...';
        get().addFloatingText(damageText, 400, 150, spell.elements);
        audioManager.playEnemyHit(finalDamage, isEffective || finalDamage >= 30);
      }

      get().addFloatingText(`附加${spell.effect === 'burn' ? '灼烧' : spell.effect === 'paralyze' ? '麻痹' : '抗性降低'}!`, 400, 190, spell.elements);

      if (killedUnit) {
        get().addFloatingText(`${killedUnit.name} 被击败!`, 400, 200, 'yellow');
      }

      const { enemyUnits: finalUnits } = get();
      const mainEnemy = finalUnits.find(u => u.type === 'enemy') as Enemy | undefined;

      set({
        energy: newEnergy,
        spellEffect: null,
        isAnimating: false,
        comboSpellCooldowns: newCooldowns,
      });

      if (!mainEnemy || mainEnemy.currentHp <= 0) {
        set({ battleStatus: 'victory' });
        get().notifyVictory();
      }
    }, 600);
  },

  endTurn: () => {
    const { battleStatus, enemy, hasExtraTurn, extraTurnUsed, towerBlessings, towerDebuffTypes, branchRegenPerTurn, branchShieldPerTurn, turn, playerShieldRef, playerHpRef, playerMaxHpRef } = get();
    if (battleStatus !== 'playing' || !enemy) return;

    if (hasExtraTurn && !extraTurnUsed) {
      set({ isPlayerTurn: true, extraTurnUsed: true, hasExtraTurn: false });
      get().addFloatingText('额外回合!', 300, 300, 'green');
      return;
    }

    if (towerBlessings.includes('energy_convert')) {
      const elements: ElementType[] = ['fire', 'water', 'grass', 'thunder'];
      const energy = get().energy;
      const fromEl = elements.find(el => energy[el] > 0);
      if (fromEl) {
        const toEl = elements.filter(el => el !== fromEl)[Math.floor(Math.random() * 3)];
        const newEnergy = { ...energy };
        newEnergy[fromEl] -= 1;
        newEnergy[toEl] = Math.min(get().maxEnergy, newEnergy[toEl] + 1);
        set({ energy: newEnergy });
        get().addFloatingText(`能量转换: ${fromEl}→${toEl}`, 300, 350, 'purple');
      }
    }

    let totalDotDamage = 0;
    const dotParts: string[] = [];
    if (towerDebuffTypes.includes('poison_aura')) {
      totalDotDamage += 5;
      dotParts.push('毒雾 -5');
    }
    if (towerDebuffTypes.includes('lava_burn') || towerDebuffTypes.includes('burn')) {
      totalDotDamage += 3;
      dotParts.push('灼烧 -3');
    }
    if (towerDebuffTypes.includes('poison')) {
      totalDotDamage += 2;
      dotParts.push('毒素 -2');
    }

    let totalRegen = branchRegenPerTurn;
    if (towerBlessings.includes('holy_shield')) totalRegen += 5;
    if (towerBlessings.includes('nature_ward')) totalRegen += 2;
    if (towerBlessings.includes('angel_blessing')) totalRegen += 4;
    if (towerBlessings.includes('dragon_lullaby')) totalRegen += 3;
    if (towerBlessings.includes('empathy_resonance')) totalRegen += 3;
    if (towerBlessings.includes('light_vessel')) totalRegen += 4;

    if (towerBlessings.includes('damage_shield') && turn % 3 === 0) {
      set(state => ({
        playerShieldRef: { ...state.playerShieldRef, current: state.playerShieldRef.current + 20 }
      }));
      get().addFloatingText('护盾 +20', 200, 430, 'blue');
    }
    if (branchShieldPerTurn > 0) {
      set(state => ({
        playerShieldRef: { ...state.playerShieldRef, current: state.playerShieldRef.current + branchShieldPerTurn }
      }));
      get().addFloatingText(`护盾 +${branchShieldPerTurn}`, 200, 450, 'blue');
    }

    if (totalDotDamage > 0 || totalRegen > 0) {
      let hp = playerHpRef.current;
      if (totalDotDamage > 0) {
        const actualDamage = get().applyDamageWithShield(totalDotDamage);
        hp = Math.max(0, hp - actualDamage);
        dotParts.forEach(p => get().addFloatingText(p, 200, 380, 'red'));
      }
      if (totalRegen > 0) {
        if (towerDebuffTypes.includes('void_touch')) {
          hp = Math.max(0, hp - totalRegen);
          get().addFloatingText(`虚空之触! -${totalRegen}`, 200, 400, 'purple');
        } else {
          hp = Math.min(playerMaxHpRef.current, hp + totalRegen);
          get().addFloatingText(`回复 +${totalRegen}`, 200, 400, 'green');
        }
      }
      set(state => ({ playerHpRef: { ...state.playerHpRef, current: hp } }));
      if (hp <= 0) {
        set({ battleStatus: 'defeat' });
        return;
      }
    }

    set({ isPlayerTurn: false, hasExtraTurn: false, extraTurnUsed: false });

    setTimeout(() => {
      get().applyStatusEffects();
    }, 500);
  },

  applyStatusEffects: () => {
    const { enemy, battleStatus } = get();
    if (!enemy || battleStatus !== 'playing') return;

    const { updatedEnemy, damageDealt } = processStatusEffects(enemy);
    
    if (damageDealt > 0) {
      get().addFloatingText(`灼烧 -${damageDealt}`, 400, 150, 'fire');
    }

    const newEnemyHp = Math.max(0, updatedEnemy.currentHp - damageDealt);
    const finalEnemy = { ...updatedEnemy, currentHp: newEnemyHp };

    const { enemyUnits } = get();
    const updatedUnits = enemyUnits.map(u => 
      u.type === 'enemy' ? finalEnemy : u
    );

    set({ enemy: finalEnemy, enemyUnits: updatedUnits });

    if (newEnemyHp <= 0) {
      set({ battleStatus: 'victory' });
      get().notifyVictory();
      return;
    }

    setTimeout(() => {
      get().enemyAttack();
    }, 500);
  },

  enemyAttack: () => {
    const { enemy, enemyUnits, turn, runeGrid, towerBlessings, towerDebuffTypes } = get();
    if (!enemy) return;

    let updatedEnemy = { ...enemy };
    let currentUnits = [...enemyUnits];

    const { updatedEnemy: enemyAfterBerserk, selfDamage } = processBerserkSelfDamage(updatedEnemy);
    updatedEnemy = enemyAfterBerserk;

    if (selfDamage > 0) {
      get().addFloatingText(`狂暴反噬 -${selfDamage}`, 400, 200, 'red');
    }

    if (updatedEnemy.currentHp <= 0) {
      const newAttackIndex = (updatedEnemy.currentAttackIndex + 1) % updatedEnemy.attackPattern.length;
      updatedEnemy.currentAttackIndex = newAttackIndex;
      const updatedGrid = decrementDoubleEnergyTurns(runeGrid);
      get().decrementCooldowns();

      currentUnits = currentUnits.map(u => 
        u.type === 'enemy' ? updatedEnemy : u
      );

      set({
        enemy: updatedEnemy,
        enemyUnits: currentUnits,
        turn: turn + 1,
        isPlayerTurn: true,
        runeGrid: updatedGrid,
        battleStatus: 'victory',
      });

      get().notifyVictory();
      return;
    }

    currentUnits = currentUnits.map(u => 
      u.type === 'enemy' ? updatedEnemy : u
    );
    const minions = currentUnits.filter(u => u.type === 'minion') as Minion[];
    const { updatedMinions, totalDamage: minionDamage, explosions } = processMinionsTurn(minions);
    
    currentUnits = [
      ...currentUnits.filter(u => u.type === 'enemy'),
      ...updatedMinions,
    ];
    updatedEnemy = currentUnits.find(u => u.type === 'enemy') as Enemy;

    updatedEnemy.behaviorState = {
      ...updatedEnemy.behaviorState,
      summonedMinions: updatedMinions,
    };

    let playerHp = get().playerHpRef.current;
    if (minionDamage > 0) {
      const actualMinionDamage = get().applyDamageWithShield(minionDamage);
      playerHp = Math.max(0, playerHp - actualMinionDamage);
      get().setScreenShake(true);
      setTimeout(() => get().setScreenShake(false), 300);
      get().addFloatingText(`小怪伤害 -${actualMinionDamage}`, 200, 380, 'purple');
      audioManager.playPlayerHit(actualMinionDamage);
    }

    explosions.forEach(explosion => {
      get().addFloatingText(explosion, 200, 420, 'orange');
    });

    if (playerHp <= 0) {
      const newAttackIndex = (updatedEnemy.currentAttackIndex + 1) % updatedEnemy.attackPattern.length;
      updatedEnemy.currentAttackIndex = newAttackIndex;
      const updatedGrid = decrementDoubleEnergyTurns(runeGrid);
      get().decrementCooldowns();

      set(state => ({ playerHpRef: { ...state.playerHpRef, current: 0 } }));
      set({
        enemy: updatedEnemy,
        enemyUnits: currentUnits,
        turn: turn + 1,
        isPlayerTurn: true,
        runeGrid: updatedGrid,
        battleStatus: 'defeat',
      });
      return;
    }

    if (towerDebuffTypes.includes('fear') && Math.random() < 0.25) {
      get().addFloatingText('恐惧! 敌人被震慑', 400, 250, 'purple');
      const newAttackIndex = (updatedEnemy.currentAttackIndex + 1) % updatedEnemy.attackPattern.length;
      updatedEnemy.currentAttackIndex = newAttackIndex;
      currentUnits = currentUnits.map(u => 
        u.type === 'enemy' ? updatedEnemy : u
      );
      const updatedGrid = decrementDoubleEnergyTurns(runeGrid);
      get().decrementCooldowns();
      set(state => ({ playerHpRef: { ...state.playerHpRef, current: playerHp } }));
      set({
        enemy: updatedEnemy,
        enemyUnits: currentUnits,
        turn: turn + 1,
        isPlayerTurn: true,
        runeGrid: updatedGrid,
      });
      return;
    }

    const baseDamage = updatedEnemy.attackPattern[updatedEnemy.currentAttackIndex];
    const effectiveBaseDamage = getEffectiveAttackDamage(baseDamage, updatedEnemy);
    const behavior = decideEnemyBehavior(updatedEnemy, playerHp, get().playerMaxHpRef.current);

    const {
      updatedEnemy: enemyAfterAction,
      damageToPlayer,
      log,
      newMinion,
    } = executeEnemyBehavior(updatedEnemy, behavior, effectiveBaseDamage, turn);

    updatedEnemy = enemyAfterAction;

    if (newMinion) {
      currentUnits = [...currentUnits, newMinion];
      get().addFloatingText(`召唤了 ${newMinion.name}!`, 400, 300, 'purple');
    }

    let actualDamage = damageToPlayer;
    if (towerBlessings.includes('thorns') && damageToPlayer > 0) {
      const thornDamage = Math.floor(damageToPlayer * 0.15);
      updatedEnemy.currentHp = Math.max(0, updatedEnemy.currentHp - thornDamage);
      get().addFloatingText(`荆棘反弹 -${thornDamage}`, 400, 280, 'green');
    }

    if (towerDebuffTypes.includes('mind_control') && Math.random() < 0.2 && actualDamage > 0) {
      const selfInflicted = Math.floor(actualDamage * 0.5);
      playerHp = Math.max(0, playerHp - selfInflicted);
      get().addFloatingText(`精神控制! 自残 -${selfInflicted}`, 200, 370, 'purple');
      actualDamage = Math.floor(actualDamage * 0.5);
    }

    if (actualDamage > 0) {
      const shieldedDamage = get().applyDamageWithShield(actualDamage);
      playerHp = Math.max(0, playerHp - shieldedDamage);
      get().setScreenShake(true);
      setTimeout(() => get().setScreenShake(false), 300);
      audioManager.playPlayerHit(shieldedDamage);

      let damageText = `-${shieldedDamage}`;
      if (updatedEnemy.behaviorState.isBerserk) {
        damageText += ' (狂暴)';
      }
      if (updatedEnemy.behaviorState.defenseState.isDefending) {
        damageText += ' (防御中)';
      }
      if (effectiveBaseDamage < baseDamage) {
        damageText += ' (麻痹)';
      }
      get().addFloatingText(damageText, 200, 400, 'fire');
    }

    get().addFloatingText(log.message, 400, 250, 'yellow');

    const newAttackIndex = (updatedEnemy.currentAttackIndex + 1) % updatedEnemy.attackPattern.length;
    updatedEnemy.currentAttackIndex = newAttackIndex;

    currentUnits = currentUnits.map(u => 
      u.type === 'enemy' ? updatedEnemy : u
    );

    const updatedGrid = decrementDoubleEnergyTurns(runeGrid);
    get().decrementCooldowns();

    set(state => ({ playerHpRef: { ...state.playerHpRef, current: playerHp } }));
    set({
      enemy: updatedEnemy,
      enemyUnits: currentUnits,
      turn: turn + 1,
      isPlayerTurn: true,
      runeGrid: updatedGrid,
    });

    if (playerHp <= 0) {
      set({ battleStatus: 'defeat' });
    }
  },

  decrementCooldowns: () => {
    const { comboSpellCooldowns } = get();
    const newCooldowns: Record<string, number> = {};
    
    Object.entries(comboSpellCooldowns).forEach(([id, turns]) => {
      if (turns > 1) {
        newCooldowns[id] = turns - 1;
      }
    });
    
    set({ comboSpellCooldowns: newCooldowns });
  },

  addFloatingText: (text: string, x: number, y: number, color: string) => {
    const id = generateId();
    const newText = {
      id,
      text,
      x,
      y,
      color,
      createdAt: Date.now(),
    };
    set(state => ({
      floatingTexts: [...state.floatingTexts, newText],
    }));

    setTimeout(() => {
      get().removeFloatingText(id);
    }, 1000);
  },

  removeFloatingText: (id: string) => {
    set(state => ({
      floatingTexts: state.floatingTexts.filter(t => t.id !== id),
    }));
  },

  setScreenShake: (shake: boolean) => {
    set({ screenShake: shake });
  },

  setSpellEffect: (element: ElementType | ComboElementType | null) => {
    set({ spellEffect: element });
  },

  notifyVictory: () => {
    set({ battleStatus: 'victory' });
  },

  canCastSpell: (spell: Spell) => {
    const { isPlayerTurn, battleStatus, isAnimating, energy, excludedElements } = get();
    const adjustedCost = getAdjustedSpellCost(spell, excludedElements);
    return (
      isPlayerTurn &&
      battleStatus === 'playing' &&
      !isAnimating &&
      energy[spell.element] >= adjustedCost
    );
  },

  canCastComboSpell: (spell: ComboSpell) => {
    const { isPlayerTurn, battleStatus, isAnimating, energy, comboSpellCooldowns, excludedElements } = get();
    return (
      isPlayerTurn &&
      battleStatus === 'playing' &&
      !isAnimating &&
      canCastComboSpellWithAdjustment(spell, energy, excludedElements) &&
      !(comboSpellCooldowns[spell.id] > 0)
    );
  },
}));

export const TowerBattlePage: React.FC = () => {
  const navigate = useNavigate();
  const { floor } = useParams<{ floor: string }>();
  const {
    currentFloorData,
    playerHp,
    playerMaxHp,
    playerShield,
    completeFloor,
    handleDefeat,
    getGridSize,
    getMaxEnergy,
    getSpecialTiles,
    getHealMultiplier,
    hasBlessing,
    addShield,
    currentBlessings,
    getCritChance,
    getRegenPerTurn,
    getDamageMultiplier,
    getShieldPerTurn,
    getStartShield,
  } = useTowerStore();

  const store = useTowerBattleStore();
  const {
    battleStatus,
    screenShake,
    initBattle,
    getPlayerHp,
    setPlayerHp,
  } = store;
  const { playUIButton, resumeAudio, transitionToScene } = useAudio();

  useSceneAudio(battleStatus === 'victory' ? 'victory' : battleStatus === 'defeat' ? 'defeat' : 'battle_loop', [battleStatus]);
  useBattleHpAudio(getPlayerHp(), store.playerMaxHpRef.current);

  useEffect(() => {
    if (battleStatus === 'victory') {
      transitionToScene('victory');
    } else if (battleStatus === 'defeat') {
      transitionToScene('defeat');
    }
  }, [battleStatus, transitionToScene]);

  const battleStore = useMemo(() => ({
    energy: store.energy,
    maxEnergy: store.maxEnergy,
    enemy: store.enemy,
    enemyUnits: store.enemyUnits,
    selectedTargetId: store.selectedTargetId,
    isPlayerTurn: store.isPlayerTurn,
    battleStatus: store.battleStatus,
    isAnimating: store.isAnimating,
    floatingTexts: store.floatingTexts,
    spellEffect: store.spellEffect,
    comboSpellCooldowns: store.comboSpellCooldowns,
    screenShake: store.screenShake,
    playerHp: store.playerHpRef.current,
    playerMaxHp: store.playerMaxHpRef.current,
    playerShield: store.playerShieldRef.current,
    towerDebuffTypes: store.towerDebuffTypes,
    castSpell: store.castSpell,
    castComboSpell: store.castComboSpell,
    selectTarget: store.selectTarget,
    canCastSpell: store.canCastSpell,
    canCastComboSpell: store.canCastComboSpell,
  }), [store]);

  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (currentFloorData && currentFloorData.enemy && !initialized) {
      const gridSize = getGridSize();
      const maxEnergy = getMaxEnergy();
      const specialTiles = getSpecialTiles();
      const healMult = getHealMultiplier();
      const critChance = getCritChance();
      const regenPerTurn = getRegenPerTurn();
      const damageMultiplier = getDamageMultiplier();
      const shieldPerTurn = getShieldPerTurn();
      const startShield = getStartShield();
      const towerDebuffs = currentFloorData.debuffs || [];
      
      initBattle(
        currentFloorData.enemy,
        gridSize,
        maxEnergy,
        specialTiles,
        healMult,
        playerHp,
        playerMaxHp,
        currentBlessings,
        towerDebuffs,
        critChance,
        regenPerTurn,
        damageMultiplier,
        shieldPerTurn,
        startShield
      );
      setInitialized(true);
    }
  }, [currentFloorData, initialized, initBattle, getGridSize, getMaxEnergy, getSpecialTiles, getHealMultiplier, playerHp, playerMaxHp, currentBlessings, getCritChance, getRegenPerTurn, getDamageMultiplier, getShieldPerTurn, getStartShield]);

  useEffect(() => {
    const currentBattleHp = getPlayerHp();
    if (battleStatus === 'playing' && currentBattleHp !== playerHp) {
      if (currentBattleHp < playerHp) {
        const damage = playerHp - currentBattleHp;
        let remaining = damage;
        if (playerShield > 0) {
          const absorbed = Math.min(playerShield, damage);
          addShield(-absorbed);
          remaining = damage - absorbed;
        }
      }
    }
  }, [battleStatus, getPlayerHp, playerHp, playerShield, addShield]);

  const handleVictory = () => {
    playUIButton();
    const finalHp = getPlayerHp();
    if (hasBlessing('life_steal')) {
      const healAmount = Math.floor(playerMaxHp * 0.1);
      setPlayerHp(Math.min(playerMaxHp, finalHp + healAmount));
    }
    completeFloor();
    navigate('/tower');
  };

  const handleRetry = () => {
    playUIButton();
    handleDefeat();
    navigate('/tower');
  };

  if (!currentFloorData || battleStatus === 'idle') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-2xl text-game-gold animate-pulse">加载中...</div>
      </div>
    );
  }

  return (
    <BattleProvider store={battleStore}>
      <div className={`min-h-screen w-full p-4 md:p-6 ${screenShake ? 'shake' : ''}`}>
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <TowerTurnInfo />
            <AudioPanel />
          </div>
          
          <div className="mt-6 grid lg:grid-cols-3 gap-6">
            <div className="space-y-6">
              <EnemyCard />
            </div>
            
            <div className="flex flex-col items-center">
              <TowerRuneGrid />
            </div>
            
            <div className="space-y-6">
              <TowerPlayerStatus />
              <EnergyPool />
              <SpellButtons />
            </div>
          </div>
        </div>
        
        <FloatingTexts />
        <SpellEffect />
        <TowerBattleResult 
          onVictory={handleVictory}
          onDefeat={handleRetry}
        />
      </div>
    </BattleProvider>
  );
};

const TowerTurnInfo: React.FC = () => {
  const { turn, isPlayerTurn, enemy, towerDebuffTypes } = useTowerBattleStore();
  const { currentFloorData } = useTowerStore();

  const getNextAttackDamage = () => {
    if (!enemy) return 0;
    return enemy.attackPattern[enemy.currentAttackIndex];
  };

  const isBlind = towerDebuffTypes.includes('blind');

  return (
    <div className="game-card p-4 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className="text-2xl font-bold text-game-gold">
          第 {currentFloorData?.floor} 层
        </div>
        <div className="text-lg text-gray-400">
          回合 {turn}
        </div>
      </div>
      <div className="flex items-center gap-4">
        {isPlayerTurn ? (
          <div className="px-4 py-2 bg-green-500/20 border border-green-500/50 rounded-lg text-green-400 font-bold">
            你的回合
          </div>
        ) : (
          <div className="px-4 py-2 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 font-bold animate-pulse">
            敌人行动中...
          </div>
        )}
        {enemy && (
          <div className="text-gray-400">
            下次攻击: {isBlind ? (
              <span className="text-red-400 font-bold">???</span>
            ) : (
              <span className="text-red-400 font-bold">{getNextAttackDamage()}</span>
            )} 伤害
          </div>
        )}
      </div>
    </div>
  );
};

const TowerRuneGrid: React.FC = () => {
  const gridRef = useRef<HTMLDivElement>(null);
  const { gridSize, runeGrid, isPlayerTurn, battleStatus, isAnimating, comboCount, selectRune, addSelectedRune, clearSelectedRunes, confirmMatch } = useTowerBattleStore();
  const { handleMouseDown, handleMouseMove, handleMouseUp, canvasRef } = useTowerRuneConnection({
    gridRef,
    cellSize: 64,
    gap: 8,
    selectRune,
    addSelectedRune,
    clearSelectedRunes,
    confirmMatch,
    gridSize,
    runeGrid,
  });

  const CELL_SIZE = 64;
  const GAP = 8;

  const gridStyle = useMemo(() => ({
    display: 'grid',
    gridTemplateColumns: `repeat(${gridSize}, ${CELL_SIZE}px)`,
    gridTemplateRows: `repeat(${gridSize}, ${CELL_SIZE}px)`,
    gap: `${GAP}px`,
    width: gridSize * (CELL_SIZE + GAP) - GAP,
    height: gridSize * (CELL_SIZE + GAP) - GAP,
  }), [gridSize]);

  const getRuneClassName = (rune: Rune) => {
    if (rune.tileType === 'obstacle') {
      return 'rune rune-obstacle';
    }
    if (rune.tileType === 'frozen') {
      let cls = `rune rune-${rune.element} rune-frozen`;
      if (rune.frozenHitCount === 1) cls += ' rune-frozen-crack1';
      if (rune.isSelected) cls += ' rune-selected';
      return cls;
    }
    if (rune.tileType === 'double_energy') {
      let cls = `rune rune-${rune.element} rune-double-energy`;
      if (rune.isSelected) cls += ' rune-selected';
      if (rune.isMatched) cls += ' rune-matched';
      if (rune.isNew) cls += ' animate-pop-in';
      return cls;
    }

    let className = `rune rune-${rune.element}`;
    if (rune.isSelected) className += ' rune-selected';
    if (rune.isMatched) className += ' rune-matched';
    if (rune.isNew) className += ' animate-pop-in';
    return className;
  };

  const renderRuneContent = (rune: Rune) => {
    if (rune.tileType === 'obstacle') {
      return <span className="text-3xl">🪨</span>;
    }
    if (rune.tileType === 'frozen') {
      return (
        <div className="relative flex items-center justify-center w-full h-full">
          <span className="text-3xl">{ELEMENT_ICONS[rune.element]}</span>
          <span className="absolute top-0.5 right-0.5 text-xs">❄️</span>
          {rune.frozenHitCount === 1 && (
            <span className="absolute bottom-0.5 left-0.5 text-xs text-yellow-300">1/2</span>
          )}
        </div>
      );
    }
    if (rune.tileType === 'double_energy') {
      return (
        <div className="relative flex items-center justify-center w-full h-full">
          <span className="text-3xl">{ELEMENT_ICONS[rune.element]}</span>
          <span className="absolute top-0.5 right-0.5 text-xs">⚡2x</span>
          <span className="absolute bottom-0.5 left-0.5 text-xs text-yellow-200">
            {rune.doubleEnergyTurnsLeft}回合
          </span>
        </div>
      );
    }
    return <span className="text-3xl">{ELEMENT_ICONS[rune.element]}</span>;
  };

  const isInteractive = isPlayerTurn && battleStatus === 'playing' && !isAnimating;

  return (
    <div className="relative">
      {comboCount > 0 && (
        <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 text-2xl font-bold text-game-gold animate-pulse">
          {comboCount}x 连击！
        </div>
      )}
      
      <div
        ref={gridRef}
        style={gridStyle}
        className={`relative p-4 bg-game-card rounded-2xl border-2 border-game-gold/30 shadow-2xl ${
          isInteractive ? 'cursor-crosshair' : 'cursor-not-allowed opacity-75'
        }`}
        onMouseDown={isInteractive ? handleMouseDown : undefined}
        onMouseMove={isInteractive ? handleMouseMove : undefined}
        onMouseUp={isInteractive ? handleMouseUp : undefined}
        onMouseLeave={isInteractive ? handleMouseUp : undefined}
        onTouchStart={isInteractive ? handleMouseDown : undefined}
        onTouchMove={isInteractive ? handleMouseMove : undefined}
        onTouchEnd={isInteractive ? handleMouseUp : undefined}
      >
        <ConnectionCanvas ref={canvasRef} />
        
        {runeGrid.map((row) =>
          row.map((rune) => (
            <div
              key={rune.id}
              className={getRuneClassName(rune)}
              style={{
                width: CELL_SIZE,
                height: CELL_SIZE,
              }}
            >
              {renderRuneContent(rune)}
            </div>
          ))
        )}
      </div>
      
      <div className="mt-4 text-center text-sm text-gray-400">
        滑动连接3个以上同色符文消除并获得能量 | 🪨障碍 ❄️冰冻 ⚡双倍
      </div>
    </div>
  );
};

interface UseTowerRuneConnectionOptions {
  gridRef: React.RefObject<HTMLDivElement>;
  cellSize: number;
  gap: number;
  selectRune: (rune: Rune) => void;
  addSelectedRune: (rune: Rune) => void;
  clearSelectedRunes: () => void;
  confirmMatch: () => void;
  gridSize: number;
  runeGrid: Rune[][];
}

const useTowerRuneConnection = ({
  gridRef,
  cellSize,
  gap,
  selectRune,
  addSelectedRune,
  clearSelectedRunes,
  confirmMatch,
  gridSize,
  runeGrid,
}: UseTowerRuneConnectionOptions) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDragging = useRef(false);
  const selectedRunesLocal = useRef<Rune[]>([]);

  const getRuneFromPoint = useCallback((x: number, y: number): Rune | null => {
    if (!gridRef.current) return null;
    
    const runeElements = gridRef.current.querySelectorAll('.rune');
    for (let i = 0; i < runeElements.length; i++) {
      const el = runeElements[i] as HTMLElement;
      const rect = el.getBoundingClientRect();
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        const row = Math.floor(i / gridSize);
        const col = i % gridSize;
        if (runeGrid[row] && runeGrid[row][col]) {
          return runeGrid[row][col];
        }
      }
    }
    return null;
  }, [gridRef, gridSize, runeGrid]);

  const drawConnection = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const runes = selectedRunesLocal.current;
    if (runes.length < 2) return;

    const ELEMENT_COLORS: Record<ElementType, string> = {
      fire: '#ff4d4d',
      water: '#4da6ff',
      grass: '#4dff88',
      thunder: '#ffcc00',
    };

    const element = runes[0].element;
    const color = ELEMENT_COLORS[element];
    
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    
    ctx.beginPath();
    
    for (let i = 0; i < runes.length; i++) {
      const rune = runes[i];
      const x = rune.col * (cellSize + gap) + cellSize / 2 + 16;
      const y = rune.row * (cellSize + gap) + cellSize / 2 + 16;
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    
    ctx.stroke();
    
    ctx.shadowBlur = 0;
  }, [cellSize, gap]);

  const handleMouseDown = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    isDragging.current = true;
    selectedRunesLocal.current = [];
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    const rune = getRuneFromPoint(clientX, clientY);
    if (rune && rune.tileType !== 'obstacle' && rune.tileType !== 'frozen') {
      selectRune(rune);
      selectedRunesLocal.current = [rune];
      drawConnection();
    }
  }, [getRuneFromPoint, selectRune, drawConnection]);

  const handleMouseMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging.current) return;
    e.preventDefault();
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    const rune = getRuneFromPoint(clientX, clientY);
    if (rune && rune.tileType !== 'obstacle' && rune.tileType !== 'frozen') {
      const existingIndex = selectedRunesLocal.current.findIndex(r => r.id === rune.id);
      
      if (existingIndex === -1) {
        const lastRune = selectedRunesLocal.current[selectedRunesLocal.current.length - 1];
        if (lastRune && lastRune.element === rune.element) {
          const rowDiff = Math.abs(lastRune.row - rune.row);
          const colDiff = Math.abs(lastRune.col - rune.col);
          if (rowDiff <= 1 && colDiff <= 1 && (rowDiff + colDiff > 0)) {
            addSelectedRune(rune);
            selectedRunesLocal.current = [...selectedRunesLocal.current, rune];
            drawConnection();
          }
        }
      } else if (existingIndex === selectedRunesLocal.current.length - 2) {
        selectedRunesLocal.current = selectedRunesLocal.current.slice(0, -1);
        clearSelectedRunes();
        selectedRunesLocal.current.forEach((r, i) => {
          if (i === 0) selectRune(r);
          else addSelectedRune(r);
        });
        drawConnection();
      }
    }
  }, [getRuneFromPoint, addSelectedRune, clearSelectedRunes, selectRune, drawConnection]);

  const handleMouseUp = useCallback(() => {
    if (isDragging.current) {
      isDragging.current = false;
      
      if (selectedRunesLocal.current.length >= 3) {
        confirmMatch();
      } else {
        clearSelectedRunes();
      }
      
      selectedRunesLocal.current = [];
      
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      }
    }
  }, [confirmMatch, clearSelectedRunes]);

  return {
    canvasRef,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
  };
};

const TowerPlayerStatus: React.FC = () => {
  const { playerHp: storePlayerHp, playerMaxHp } = useTowerStore();
  const { getPlayerHp, playerShieldRef } = useTowerBattleStore();
  
  const battleHp = getPlayerHp();
  const displayHp = battleHp > 0 ? battleHp : storePlayerHp;
  const battleShield = playerShieldRef?.current ?? 0;

  const hpPercent = (displayHp / playerMaxHp) * 100;
  const hpColor = hpPercent > 50 ? 'bg-green-500' : hpPercent > 25 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div className="game-card p-4">
      <h3 className="text-game-gold font-bold mb-3 flex items-center gap-2">
        <span>🧙</span>
        <span>玩家</span>
      </h3>
      <div className="space-y-2">
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-400">生命值</span>
            <span className="text-white">{displayHp} / {playerMaxHp}</span>
          </div>
          <div className="h-3 bg-game-bg-dark rounded-full overflow-hidden">
            <div
              className={`h-full ${hpColor} transition-all duration-300`}
              style={{ width: `${hpPercent}%` }}
            />
          </div>
        </div>
        {battleShield > 0 && (
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-400">护盾</span>
              <span className="text-blue-400">{battleShield}</span>
            </div>
            <div className="h-2 bg-game-bg-dark rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all duration-300"
                style={{ width: `${Math.min(100, (battleShield / 50) * 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const TowerSpellButtons: React.FC = () => {
  const { energy, isPlayerTurn, battleStatus, isAnimating, castSpell, castComboSpell, comboSpellCooldowns, excludedElements } = useTowerBattleStore();

  const canCast = (spell: Spell) => {
    return canCastSpellWithAdjustment(spell, energy, excludedElements) &&
      isPlayerTurn &&
      battleStatus === 'playing' &&
      !isAnimating;
  };

  const canCastCombo = (spell: ComboSpell) => {
    return canCastComboSpellWithAdjustment(spell, energy, excludedElements) &&
      isPlayerTurn &&
      battleStatus === 'playing' &&
      !isAnimating &&
      !(comboSpellCooldowns[spell.id] > 0);
  };

  const getButtonClassName = (spell: Spell, enabled: boolean) => {
    const baseClass = 'game-button flex flex-col items-center justify-center p-4 min-h-[120px] relative';
    const elementClass = `game-button-${spell.element}`;
    const disabledClass = enabled ? '' : 'opacity-50 cursor-not-allowed grayscale';
    return `${baseClass} ${elementClass} ${disabledClass}`;
  };

  const getComboButtonClassName = (spell: ComboSpell, enabled: boolean) => {
    const baseClass = 'game-button flex flex-col items-center justify-center p-4 min-h-[120px] relative';
    const disabledClass = enabled ? '' : 'opacity-50 cursor-not-allowed grayscale';
    return `${baseClass} ${disabledClass}`;
  };

  const formatCost = (spell: ComboSpell) => {
    const adjustedCost = getAdjustedComboCost(spell, excludedElements);
    return Object.entries(adjustedCost)
      .map(([element, cost]) => {
        const originalCost = spell.cost[element as ElementType] || 0;
        const adjusted = cost || 0;
        const icon = ELEMENT_ICONS[element as keyof typeof ELEMENT_ICONS];
        if (adjusted !== originalCost) {
          return `${icon}<span className="line-through opacity-50 text-xs">${originalCost}</span> ${adjusted}`;
        }
        return `${icon}${adjusted}`;
      })
      .join(' ');
  };

  const getComboButtonStyle = (spell: ComboSpell) => {
    const colors = spell.elements.split('+');
    const color1 = ELEMENT_COLORS[colors[0] as keyof typeof ELEMENT_COLORS];
    const color2 = ELEMENT_COLORS[colors[1] as keyof typeof ELEMENT_COLORS];
    return {
      background: `linear-gradient(135deg, ${color1}40, ${color2}40)`,
      borderColor: COMBO_ELEMENT_COLORS[spell.elements],
      borderWidth: '2px',
    };
  };

  const hasElementDebuff = excludedElements.length > 0;

  return (
    <div className="game-card p-6">
      <h3 className="text-lg font-bold text-game-gold mb-4 text-center font-display">
        法术技能
      </h3>
      {hasElementDebuff && (
        <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-xs text-yellow-400 text-center">
          ⚠️ 元素封印生效中，被封印元素的法术消耗降低 1 点
        </div>
      )}
      <div className="grid grid-cols-2 gap-4">
        {SPELLS.map((spell) => {
          const enabled = canCast(spell);
          const color = ELEMENT_COLORS[spell.element];
          const originalCost = spell.cost;
          const adjustedCost = getAdjustedSpellCost(spell, excludedElements);
          const isAdjusted = originalCost !== adjustedCost;
          
          return (
            <button
              key={spell.id}
              onClick={() => enabled && castSpell(spell)}
              disabled={!enabled}
              className={getButtonClassName(spell, enabled)}
            >
              {isAdjusted && (
                <div className="absolute top-1 right-1 text-xs bg-yellow-500/80 px-1.5 py-0.5 rounded text-white">
                  -1消耗
                </div>
              )}
              <div className="text-3xl mb-2">{spell.icon}</div>
              <div className="font-bold text-sm">{spell.name}</div>
              <div className="text-xs opacity-80 mt-1">
                消耗: {isAdjusted && <span className="line-through opacity-50 text-xs">{originalCost}</span>} {adjustedCost} 能量
              </div>
              {spell.damage > 0 && (
                <div className="text-xs mt-1" style={{ color }}>
                  伤害: {spell.damage}
                </div>
              )}
              {spell.heal > 0 && (
                <div className="text-xs mt-1 text-green-400">
                  治疗: {spell.heal}
                </div>
              )}
            </button>
          );
        })}
      </div>

      <h3 className="text-lg font-bold text-purple-400 mb-4 mt-6 text-center font-display">
        元素连携
      </h3>
      <div className="grid grid-cols-1 gap-4">
        {COMBO_SPELLS.map((spell) => {
          const enabled = canCastCombo(spell);
          const cooldown = comboSpellCooldowns[spell.id] || 0;
          
          return (
            <button
              key={spell.id}
              onClick={() => enabled && castComboSpell(spell)}
              disabled={!enabled}
              className={getComboButtonClassName(spell, enabled)}
              style={getComboButtonStyle(spell)}
            >
              {cooldown > 0 && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center rounded-lg">
                  <span className="text-2xl font-bold text-white">
                    冷却: {cooldown} 回合
                  </span>
                </div>
              )}
              <div className="text-3xl mb-2">{spell.icon}</div>
              <div className="font-bold text-sm">{spell.name}</div>
              <div className="text-xs opacity-80 mt-1" dangerouslySetInnerHTML={{ __html: `消耗: ${formatCost(spell)}` }} />
              <div className="text-xs mt-1 text-yellow-400">
                伤害: {spell.damage}
              </div>
              <div className="text-xs mt-1 text-purple-300">
                效果: {spell.effect === 'burn' ? '持续灼烧' : spell.effect === 'paralyze' ? '麻痹' : '降低抗性'}
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-4 text-xs text-gray-400 text-center">
        提示：连接消除符文获取能量，然后释放法术攻击敌人
      </div>
    </div>
  );
};

const TowerBattleResult: React.FC<{
  onVictory: () => void;
  onDefeat: () => void;
}> = ({ onVictory, onDefeat }) => {
  const { battleStatus } = useTowerBattleStore();
  const { currentFloorData } = useTowerStore();

  if (battleStatus !== 'victory' && battleStatus !== 'defeat') return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="game-card p-8 text-center max-w-md w-full">
        {battleStatus === 'victory' ? (
          <>
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-4xl font-bold text-game-gold mb-4 font-display">胜利！</h2>
            <p className="text-gray-400 mb-6">
              成功通过第 {currentFloorData?.floor} 层
            </p>
            {currentFloorData?.goldReward && (
              <div className="bg-game-bg-dark rounded-lg p-4 mb-6">
                <div className="flex items-center justify-center gap-2 text-game-gold">
                  <span>获得金币</span>
                  <span className="text-2xl font-bold">+{currentFloorData.goldReward}</span>
                  <span>🪙</span>
                </div>
              </div>
            )}
            <button
              onClick={onVictory}
              className="w-full game-button-primary"
            >
              继续前进
            </button>
          </>
        ) : (
          <>
            <div className="text-6xl mb-4">💀</div>
            <h2 className="text-4xl font-bold text-red-500 mb-4 font-display">失败</h2>
            <p className="text-gray-400 mb-6">
              在第 {currentFloorData?.floor} 层倒下了...
            </p>
            <button
              onClick={onDefeat}
              className="w-full game-button-primary"
            >
              返回大秘境
            </button>
          </>
        )}
      </div>
    </div>
  );
};