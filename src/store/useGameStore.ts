import { create } from 'zustand';
import type { GameStore, Rune, Spell, Level, EnergyPool, ComboSpell, Minion, CombatUnit, Enemy, ElementType, ComboElementType, TerrainCell } from '../types';
import { DEFAULT_BEHAVIOR_STATE, GRID_SIZE } from '../types';
import levelsData from '../data/levels.json';
import {
  createRuneGrid,
  canAddToSelection,
  markMatchedRunes,
  processMatchesAndDrop,
  findAllMatches,
  calculateEnergyGain,
  generateId,
  processFrozenHits,
  saveDoubleEnergyCells,
  decrementDoubleEnergyTurns,
  canCastComboSpell as canCastComboSpellLogic,
  createStatusEffect,
  applyStatusEffectToEnemy,
  processStatusEffects,
  getEffectiveAttackDamage,
  calculateDamageWithResistanceEffect,
  calculateComboDamageWithResistanceEffect,
  createTerrainGrid,
  spreadMagma,
  markMagmaBurn,
  applyBurnedRunes,
  applyFrostTerrainEffect,
  decrementTerrainFrozen,
  calculateThornsDamage,
  applyStormTerrainEffect,
} from '../utils/gameLogic';
import {
  decideEnemyBehavior,
  executeEnemyBehavior,
  processMinionsTurn,
  processBerserkSelfDamage,
  calculateDamageToEnemy,
} from '../utils/enemyAI';
import {
  saveBattleProgress,
  clearBattleProgress,
  unlockLevel,
  getUnlockedLevels,
  getHighestLevel,
  getCurrentBattle,
} from '../utils/localStorage';
import { showVictoryNotification, showDefeatNotification } from '../utils/notifications';
import { getEquippedItems } from '../utils/localStorage';
import { getEquipmentBonuses } from '../utils/runeEquipment';

const levels: Level[] = levelsData as Level[];

const initialEnergy: EnergyPool = {
  fire: 0,
  water: 0,
  grass: 0,
  thunder: 0,
};

const createEnemyFromLevel = (level: Level): Enemy => {
  return {
    ...level.enemy,
    type: 'enemy',
    currentHp: level.enemy.maxHp,
    currentAttackIndex: 0,
    statusEffects: [],
    behaviorState: JSON.parse(JSON.stringify(DEFAULT_BEHAVIOR_STATE)),
    behaviorLogs: [],
    isTargetable: true,
    isSelected: false,
  };
};

const getSelectedUnit = (units: CombatUnit[], selectedId: string | null): CombatUnit | null => {
  if (!selectedId) return null;
  return units.find(u => u.id === selectedId) || null;
};

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

export const useGameStore = create<GameStore>((set, get) => ({
  currentLevelId: null,
  playerHp: 100,
  playerMaxHp: 100,
  energy: { ...initialEnergy },
  maxEnergy: 10,
  gridSize: GRID_SIZE,
  runeGrid: [],
  terrainGrid: [],
  selectedRunes: [],
  enemy: null,
  enemyUnits: [],
  selectedTargetId: null,
  turn: 1,
  isPlayerTurn: true,
  battleStatus: 'idle',
  unlockedLevels: [1],
  highestLevel: 1,
  comboCount: 0,
  floatingTexts: [],
  isAnimating: false,
  screenShake: false,
  spellEffect: null,
  comboSpellCooldowns: {},

  initLevel: (levelId: number) => {
    const level = levels.find(l => l.id === levelId);
    if (!level) return;

    const savedBattle = getCurrentBattle();
    let playerHp = level.playerMaxHp;
    let playerMaxHp = level.playerMaxHp;
    let energy = { ...initialEnergy };
    let enemy = createEnemyFromLevel(level);
    let enemyUnits: CombatUnit[] = [enemy];
    let selectedTargetId = enemy.id;
    let turn = 1;
    let comboSpellCooldowns = {};

    if (savedBattle && savedBattle.levelId === levelId) {
      playerHp = savedBattle.playerHp;
      playerMaxHp = savedBattle.playerMaxHp;
      energy = savedBattle.energy;
      enemy = savedBattle.enemy;
      enemyUnits = savedBattle.enemyUnits || [enemy];
      selectedTargetId = savedBattle.selectedTargetId || enemy.id;
      turn = savedBattle.turn;
      comboSpellCooldowns = savedBattle.comboSpellCooldowns || {};
    }

    if (!savedBattle || savedBattle.levelId !== levelId) {
      const equippedItems = getEquippedItems();
      const bonuses = getEquipmentBonuses(equippedItems);
      for (const [el, val] of Object.entries(bonuses.initialEnergy)) {
        if (val) {
          const k = el as keyof EnergyPool;
          energy[k] = Math.min(level.maxEnergy, energy[k] + val);
        }
      }
    }

    set({
      currentLevelId: levelId,
      playerHp,
      playerMaxHp,
      energy,
      maxEnergy: level.maxEnergy,
      gridSize: GRID_SIZE,
      runeGrid: createRuneGrid(level.specialTiles, GRID_SIZE),
      terrainGrid: createTerrainGrid(level.specialTiles, level.terrain, GRID_SIZE),
      selectedRunes: [],
      enemy,
      enemyUnits,
      selectedTargetId,
      turn,
      isPlayerTurn: true,
      battleStatus: 'playing',
      unlockedLevels: getUnlockedLevels(),
      highestLevel: getHighestLevel(),
      comboCount: 0,
      floatingTexts: [],
      isAnimating: false,
      screenShake: false,
      spellEffect: null,
      comboSpellCooldowns,
    });
  },

  selectRune: (rune: Rune) => {
    const { isPlayerTurn, battleStatus, isAnimating } = get();
    if (!isPlayerTurn || battleStatus !== 'playing' || isAnimating) return;

    if (rune.tileType === 'obstacle' || rune.tileType === 'frozen') return;
    if (rune.terrainFrozenTurns && rune.terrainFrozenTurns > 0) return;

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
    const { selectedRunes, comboCount, isPlayerTurn, battleStatus, isAnimating, terrainGrid, playerHp, playerMaxHp } = get();
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

    const thornsDamage = calculateThornsDamage(selectedRunes, terrainGrid, 5);
    let currentPlayerHp = playerHp;
    if (thornsDamage > 0) {
      currentPlayerHp = Math.max(0, currentPlayerHp - thornsDamage);
      get().addFloatingText(`荆棘反伤 -${thornsDamage}`, 200, 380, 'thorns');
      get().setScreenShake(true);
      setTimeout(() => get().setScreenShake(false), 200);
    }

    let grid = markMatchedRunes(get().runeGrid, selectedRunes);
    grid = processFrozenHits(grid, selectedRunes, currentGridSize);
    set({ runeGrid: grid, selectedRunes: [], playerHp: currentPlayerHp });

    if (currentPlayerHp <= 0) {
      const { currentLevelId, runeGrid } = get();
      const updatedGrid = decrementDoubleEnergyTurns(runeGrid);
      get().decrementCooldowns();
      set({
        playerHp: 0,
        turn: get().turn + 1,
        isPlayerTurn: true,
        runeGrid: updatedGrid,
        battleStatus: 'defeat',
        isAnimating: false,
      });
      clearBattleProgress();
      showDefeatNotification(levels.find(l => l.id === currentLevelId)?.name || '');
      return;
    }

    const energyGain = calculateEnergyGain(matchCount, comboCount, element, doubleEnergyInSelection);
    const currentEnergy = get().energy;
    const newEnergy = { ...currentEnergy };
    const equippedItems = getEquippedItems();
    const bonuses = getEquipmentBonuses(equippedItems);
    Object.entries(energyGain).forEach(([key, value]) => {
      const k = key as keyof EnergyPool;
      let gain = value || 0;
      const boost = bonuses.energyBoost[k] || 0;
      if (boost > 0) {
        gain = Math.floor(gain + boost);
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

          const chainThornsDamage = calculateThornsDamage(chainMatches, terrainGrid, 5);
          if (chainThornsDamage > 0) {
            const hpState = get().playerHp;
            const newHp = Math.max(0, hpState - chainThornsDamage);
            get().addFloatingText(`荆棘反伤 -${chainThornsDamage}`, 200, 380, 'thorns');
            get().setScreenShake(true);
            setTimeout(() => get().setScreenShake(false), 200);
            set({ playerHp: newHp });

            if (newHp <= 0) {
              const { currentLevelId, runeGrid } = get();
              const updatedGrid = decrementDoubleEnergyTurns(runeGrid);
              get().decrementCooldowns();
              set({
                turn: get().turn + 1,
                isPlayerTurn: true,
                runeGrid: updatedGrid,
                battleStatus: 'defeat',
                isAnimating: false,
              });
              clearBattleProgress();
              showDefeatNotification(levels.find(l => l.id === currentLevelId)?.name || '');
              return;
            }
          }

          const chainDeBefore = saveDoubleEnergyCells(grid, currentGridSize);
          grid = processFrozenHits(grid, chainMatches, currentGridSize);
          grid = markMatchedRunes(grid, chainMatches);
          set({ runeGrid: grid, comboCount: currentCombo });

          setTimeout(() => {
            const result = processMatchesAndDrop(grid, chainDeBefore, currentGridSize);
            grid = result.newGrid;
            
            Object.entries(result.matchedElements).forEach(([el, count]) => {
              if (count > 0) {
                const gain = calculateEnergyGain(count, currentCombo, el as keyof EnergyPool, result.doubleEnergyCount);
                Object.entries(gain).forEach(([key, value]) => {
                  const k = key as keyof EnergyPool;
                  let amount = value || 0;
                  const boost = bonuses.energyBoost[k] || 0;
                  if (boost > 0) {
                    amount = Math.floor(amount + boost);
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
    const { isPlayerTurn, battleStatus, isAnimating, energy, enemyUnits, selectedTargetId } = get();
    if (!isPlayerTurn || battleStatus !== 'playing' || isAnimating) return;

    if (energy[spell.element] < spell.cost) return;

    const target = getSelectedUnit(enemyUnits, selectedTargetId);
    if (!target) return;

    set({ isAnimating: true, spellEffect: spell.element });

    const newEnergy = { ...energy };
    newEnergy[spell.element] -= spell.cost;

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

    const { enemyUnits: currentUnits } = get();
    const { updatedUnits, killedUnit, finalDamage } = calculateAndApplyDamage(currentUnits, target.id, damage);
    
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
    
    const newPlayerHp = Math.min(get().playerMaxHp, get().playerHp + spell.heal);

    setTimeout(() => {
      get().setScreenShake(true);
      setTimeout(() => get().setScreenShake(false), 300);

      if (finalDamage > 0) {
        let damageText = `-${finalDamage}`;
        if (isEffective) damageText += ' 效果拔群！';
        if (isWeak) damageText += ' 效果不佳...';
        get().addFloatingText(damageText, 400, 150, spell.element);
      }
      if (spell.heal > 0) {
        get().addFloatingText(`+${spell.heal}`, 200, 400, 'grass');
      }

      if (killedUnit) {
        get().addFloatingText(`${killedUnit.name} 被击败!`, 400, 200, 'yellow');
      }

      const { enemyUnits: latestUnits } = get();
      const currentMainEnemy = latestUnits.find(u => u.type === 'enemy') as Enemy | undefined;

      set({
        energy: newEnergy,
        playerHp: newPlayerHp,
        spellEffect: null,
        isAnimating: false,
      });

      if (!currentMainEnemy || currentMainEnemy.currentHp <= 0) {
        set({ battleStatus: 'victory' });
        if (get().currentLevelId) {
          unlockLevel(get().currentLevelId! + 1);
          set({
            unlockedLevels: getUnlockedLevels(),
            highestLevel: getHighestLevel(),
          });
        }
        clearBattleProgress();
        get().notifyVictory(levels.find(l => l.id === get().currentLevelId)?.name || '');
      } else {
        get().saveProgress();
      }
    }, 500);
  },

  castComboSpell: (spell: ComboSpell) => {
    const { isPlayerTurn, battleStatus, isAnimating, energy, enemyUnits, selectedTargetId, comboSpellCooldowns } = get();
    if (!isPlayerTurn || battleStatus !== 'playing' || isAnimating) return;

    if (!canCastComboSpell(energy, spell)) return;
    if (comboSpellCooldowns[spell.id] > 0) return;

    const target = getSelectedUnit(enemyUnits, selectedTargetId);
    if (!target) return;

    set({ isAnimating: true, spellEffect: spell.elements });

    const newEnergy = { ...energy };
    Object.entries(spell.cost).forEach(([element, cost]) => {
      newEnergy[element as keyof EnergyPool] -= cost || 0;
    });

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

    const { enemyUnits: currentUnits } = get();
    const { updatedUnits, killedUnit, finalDamage } = calculateAndApplyDamage(currentUnits, target.id, damage);
    
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
        if (get().currentLevelId) {
          unlockLevel(get().currentLevelId! + 1);
          set({
            unlockedLevels: getUnlockedLevels(),
            highestLevel: getHighestLevel(),
          });
        }
        clearBattleProgress();
        get().notifyVictory(levels.find(l => l.id === get().currentLevelId)?.name || '');
      } else {
        get().saveProgress();
      }
    }, 600);
  },

  endTurn: () => {
    const { battleStatus, enemy } = get();
    if (battleStatus !== 'playing' || !enemy) return;

    set({ isPlayerTurn: false });

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
      if (get().currentLevelId) {
        unlockLevel(get().currentLevelId! + 1);
        set({
          unlockedLevels: getUnlockedLevels(),
          highestLevel: getHighestLevel(),
        });
      }
      clearBattleProgress();
      get().notifyVictory(levels.find(l => l.id === get().currentLevelId)?.name || '');
      return;
    }

    setTimeout(() => {
      get().enemyAttack();
    }, 500);
  },

  enemyAttack: () => {
    const { enemy, enemyUnits, playerHp, playerMaxHp, turn, currentLevelId, runeGrid } = get();
    if (!enemy) return;

    let updatedEnemy = { ...enemy };
    let currentPlayerHp = playerHp;
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

      if (currentLevelId) {
        unlockLevel(currentLevelId + 1);
        set({
          unlockedLevels: getUnlockedLevels(),
          highestLevel: getHighestLevel(),
        });
      }
      clearBattleProgress();
      get().notifyVictory(levels.find(l => l.id === currentLevelId)?.name || '');
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

    if (minionDamage > 0) {
      currentPlayerHp = Math.max(0, currentPlayerHp - minionDamage);
      get().setScreenShake(true);
      setTimeout(() => get().setScreenShake(false), 300);
      get().addFloatingText(`小怪伤害 -${minionDamage}`, 200, 380, 'purple');
    }

    explosions.forEach(explosion => {
      get().addFloatingText(explosion, 200, 420, 'orange');
    });

    if (currentPlayerHp <= 0) {
      const newAttackIndex = (updatedEnemy.currentAttackIndex + 1) % updatedEnemy.attackPattern.length;
      updatedEnemy.currentAttackIndex = newAttackIndex;
      const updatedGrid = decrementDoubleEnergyTurns(runeGrid);
      get().decrementCooldowns();

      set({
        playerHp: currentPlayerHp,
        enemy: updatedEnemy,
        enemyUnits: currentUnits,
        turn: turn + 1,
        isPlayerTurn: true,
        runeGrid: updatedGrid,
        battleStatus: 'defeat',
      });
      clearBattleProgress();
      showDefeatNotification(levels.find(l => l.id === currentLevelId)?.name || '');
      return;
    }

    const baseDamage = updatedEnemy.attackPattern[updatedEnemy.currentAttackIndex];
    const effectiveBaseDamage = getEffectiveAttackDamage(baseDamage, updatedEnemy);
    const behavior = decideEnemyBehavior(updatedEnemy, currentPlayerHp, playerMaxHp);

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

    if (damageToPlayer > 0) {
      currentPlayerHp = Math.max(0, currentPlayerHp - damageToPlayer);
      get().setScreenShake(true);
      setTimeout(() => get().setScreenShake(false), 300);

      let damageText = `-${damageToPlayer}`;
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

    set({
      playerHp: currentPlayerHp,
      enemy: updatedEnemy,
      enemyUnits: currentUnits,
      turn: turn + 1,
      isPlayerTurn: true,
      runeGrid: updatedGrid,
    });

    if (currentPlayerHp <= 0) {
      set({ battleStatus: 'defeat' });
      clearBattleProgress();
      showDefeatNotification(levels.find(l => l.id === currentLevelId)?.name || '');
    } else {
      setTimeout(() => {
        get().processTerrainEffects();
        get().saveProgress();
      }, 300);
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

  saveProgress: () => {
    saveBattleProgress(get());
  },

  loadProgress: () => {
    set({
      unlockedLevels: getUnlockedLevels(),
      highestLevel: getHighestLevel(),
    });
  },

  resetBattle: () => {
    const { currentLevelId } = get();
    if (currentLevelId) {
      clearBattleProgress();
      get().initLevel(currentLevelId);
    }
  },

  returnToMenu: () => {
    clearBattleProgress();
    set({
      battleStatus: 'idle',
      currentLevelId: null,
    });
  },

  setScreenShake: (shake: boolean) => {
    set({ screenShake: shake });
  },

  setSpellEffect: (element: ElementType | ComboElementType | null) => {
    set({ spellEffect: element });
  },

  notifyVictory: (levelName: string) => {
    showVictoryNotification(levelName);
  },

  processTerrainEffects: () => {
    const { runeGrid, terrainGrid, currentLevelId, gridSize, battleStatus } = get();
    if (battleStatus !== 'playing') return;

    const level = levels.find(l => l.id === currentLevelId);
    const spreadChance = level?.terrain?.magmaSpreadChance ?? 0.5;

    let newTerrain = terrainGrid;
    let newGrid = runeGrid;

    const { newGrid: burnedGrid, burnedCount } = applyBurnedRunes(newGrid, gridSize);
    newGrid = burnedGrid;
    if (burnedCount > 0) {
      get().addFloatingText(`岩浆灼烧 ${burnedCount}个符文!`, 300, 280, 'magma');
    }

    newGrid = decrementTerrainFrozen(newGrid, gridSize);
    newTerrain = spreadMagma(newTerrain, newGrid, spreadChance, gridSize);
    newGrid = markMagmaBurn(newGrid, newTerrain, gridSize);
    newGrid = applyFrostTerrainEffect(newGrid, newTerrain, gridSize);

    const { newGrid: stormGrid, changedCount } = applyStormTerrainEffect(newGrid, newTerrain, gridSize);
    newGrid = stormGrid;
    if (changedCount > 0) {
      get().addFloatingText(`雷暴扭曲 ${changedCount}个符文!`, 300, 300, 'storm');
    }

    set({
      runeGrid: newGrid,
      terrainGrid: newTerrain,
    });
  },

  canCastSpell: (spell: Spell) => {
    const { isPlayerTurn, battleStatus, isAnimating, energy } = get();
    return (
      isPlayerTurn &&
      battleStatus === 'playing' &&
      !isAnimating &&
      energy[spell.element] >= spell.cost
    );
  },

  canCastComboSpell: (spell: ComboSpell) => {
    const { isPlayerTurn, battleStatus, isAnimating, energy, comboSpellCooldowns } = get();
    return (
      isPlayerTurn &&
      battleStatus === 'playing' &&
      !isAnimating &&
      canCastComboSpellLogic(energy, spell) &&
      !(comboSpellCooldowns[spell.id] > 0)
    );
  },
}));
