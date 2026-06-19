import { create } from 'zustand';
import type { GameStore, Rune, Spell, Level, EnergyPool, ComboSpell, Minion, CombatUnit, Enemy, ElementType, ComboElementType, BattleReplayV2, ShareCardData } from '../types';
import { DEFAULT_BEHAVIOR_STATE, GRID_SIZE, HIGHLIGHT_TYPE_META } from '../types';
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
import { useAchievementStore } from './useAchievementStore';
import { BattleRecorder } from '../utils/battleRecorder';
import { saveReplay, loadReplay } from '../utils/replayStorage';
import { detectHighlights, generateAllShareCards } from '../utils/highlightDetector';
import { audioManager, type SpellType } from '../audio/AudioManager';

const levels: Level[] = levelsData as Level[];

const trackVictory = (enemyId: string | undefined, enemyName: string | undefined) => {
  try {
    const ach = useAchievementStore.getState();
    if (enemyId) ach.recordEnemyKilled(enemyId);
    if (enemyName) ach.recordEnemyKilled(enemyName);
    ach.recordBattleWon();
  } catch {}
};

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
  battleRecorder: null,
  lastReplayData: null,
  lastReplayShareCards: [],

  saveCurrentReplay: (): boolean => {
    const replay = get().lastReplayData;
    if (!replay) return false;
    return saveReplay(replay);
  },

  getLastReplay: (): BattleReplayV2 | null => {
    return get().lastReplayData;
  },

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
      if (bonuses.resonance.initialEnergyBonus) {
        for (const k of Object.keys(energy) as (keyof EnergyPool)[]) {
          energy[k] = Math.min(level.maxEnergy, energy[k] + bonuses.resonance.initialEnergyBonus!);
        }
      }
    }

    const newRuneGrid = createRuneGrid(level.specialTiles, GRID_SIZE);
    const newTerrainGrid = createTerrainGrid(level.terrain, newRuneGrid, GRID_SIZE);

    const battleRecorder = new BattleRecorder(level, enemy);
    battleRecorder.start();
    battleRecorder.setTurn(turn);
    battleRecorder.setPlayerHp(playerHp, 'init');
    battleRecorder.setEnergy(energy, 'init');
    if (!savedBattle || savedBattle.levelId !== levelId) {
      battleRecorder.recordTurnStart(turn);
    }

    set({
      currentLevelId: levelId,
      playerHp,
      playerMaxHp,
      energy,
      maxEnergy: level.maxEnergy,
      gridSize: GRID_SIZE,
      runeGrid: newRuneGrid,
      terrainGrid: newTerrainGrid,
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
      battleRecorder,
      lastReplayData: null,
      lastReplayShareCards: [],
    });
  },

  initWorkshopLevel: (config) => {
    const enemy: Enemy = {
      ...config.enemy,
      type: 'enemy',
      currentHp: config.enemy.maxHp,
      currentAttackIndex: 0,
      statusEffects: [],
      behaviorState: JSON.parse(JSON.stringify(DEFAULT_BEHAVIOR_STATE)),
      behaviorLogs: [],
      isTargetable: true,
      isSelected: false,
    };

    const energy = { ...initialEnergy };
    const newRuneGrid = createRuneGrid(config.specialTiles, config.gridSize);
    const newTerrainGrid = createTerrainGrid(config.terrain || {}, newRuneGrid, config.gridSize);

    const fakeLevel: Level = {
      id: -1,
      name: config.name,
      description: '',
      enemy: config.enemy,
      playerMaxHp: config.playerMaxHp,
      maxEnergy: config.maxEnergy,
      stars: [],
      background: '',
      specialTiles: config.specialTiles,
      terrain: config.terrain,
    };
    const battleRecorder = new BattleRecorder(fakeLevel, enemy);
    battleRecorder.start();
    battleRecorder.setTurn(1);
    battleRecorder.setPlayerHp(config.playerMaxHp, 'init');
    battleRecorder.setEnergy(energy, 'init');
    battleRecorder.recordTurnStart(1);

    set({
      currentLevelId: -1,
      playerHp: config.playerMaxHp,
      playerMaxHp: config.playerMaxHp,
      energy,
      maxEnergy: config.maxEnergy,
      gridSize: config.gridSize,
      runeGrid: newRuneGrid,
      terrainGrid: newTerrainGrid,
      selectedRunes: [],
      enemy,
      enemyUnits: [enemy],
      selectedTargetId: enemy.id,
      turn: 1,
      isPlayerTurn: true,
      battleStatus: 'playing',
      unlockedLevels: getUnlockedLevels(),
      highestLevel: getHighestLevel(),
      comboCount: 0,
      floatingTexts: [],
      isAnimating: false,
      screenShake: false,
      spellEffect: null,
      comboSpellCooldowns: {},
      battleRecorder,
      lastReplayData: null,
      lastReplayShareCards: [],
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
    const { selectedRunes, comboCount, isPlayerTurn, battleStatus, isAnimating, terrainGrid, playerHp, playerMaxHp, battleRecorder } = get();
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

    try {
      useAchievementStore.getState().recordRunesEliminated(element, matchCount);
    } catch { /* achievement tracking is non-critical */ }

    const thornsDamage = calculateThornsDamage(selectedRunes, terrainGrid, 5);
    let currentPlayerHp = playerHp;
    if (thornsDamage > 0) {
      currentPlayerHp = Math.max(0, currentPlayerHp - thornsDamage);
      get().addFloatingText(`荆棘反伤 -${thornsDamage}`, 200, 380, 'thorns');
      get().setScreenShake(true);
      setTimeout(() => get().setScreenShake(false), 200);
      if (battleRecorder) {
        battleRecorder.setPlayerHp(currentPlayerHp, 'thorns');
        battleRecorder.recordTerrainEffect('thorns', `荆棘反伤 -${thornsDamage}`, selectedRunes.length, thornsDamage);
      }
    }

    if (battleRecorder) {
      battleRecorder.recordMatchRunes(selectedRunes, {}, 0);
      battleRecorder.setPlayerHp(currentPlayerHp, 'match');
    }

    let grid = markMatchedRunes(get().runeGrid, selectedRunes);
    grid = processFrozenHits(grid, selectedRunes, currentGridSize);
    set({ runeGrid: grid, selectedRunes: [], playerHp: currentPlayerHp });

    if (currentPlayerHp <= 0) {
      const { currentLevelId, runeGrid, enemy, battleRecorder: recorder } = get();
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
      if (recorder && enemy) {
        try {
          recorder.setPlayerHp(0, 'defeat');
          recorder.recordTurnEnd(get().turn - 1);
          const replay = recorder.stop('defeat');
          replay.highlights = detectHighlights(replay);
          const cards = generateAllShareCards(replay, replay.highlights);
          set({ lastReplayData: replay, lastReplayShareCards: cards });
        } catch {}
      }
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
      if (bonuses.resonance.energyBoostBonus) {
        gain = Math.floor(gain + bonuses.resonance.energyBoostBonus);
      }
      newEnergy[k] = Math.min(get().maxEnergy, currentEnergy[k] + gain);
      if (gain > 0) {
        get().addFloatingText(`+${gain}${boost > 0 ? ` (+${boost})` : ''}`, 300, 200, element);
      }
    });
    if (doubleEnergyInSelection > 0) {
      get().addFloatingText('双倍能量!', 300, 160, 'thunder');
    }
    if (battleRecorder) {
      battleRecorder.setEnergy(newEnergy, 'match');
    }

    const deCells = saveDoubleEnergyCells(grid, currentGridSize);

    setTimeout(() => {
      const { newGrid } = processMatchesAndDrop(grid, deCells, currentGridSize);
      grid = newGrid;
      
      let currentCombo = comboCount;
      let totalCombo = 1;
      const allChainPaths: any[][] = [];

      const processChain = () => {
        const chainMatches = findAllMatches(grid, currentGridSize);
        if (chainMatches.length > 0) {
          currentCombo++;
          totalCombo++;

          audioManager.playComboChain(currentCombo);
          audioManager.playRuneMatch(chainMatches.length, currentCombo);

          const chainPathCoords = chainMatches.map(r => ({ row: r.row, col: r.col, element: r.element }));
          allChainPaths.push(chainPathCoords);

          const chainThornsDamage = calculateThornsDamage(chainMatches, terrainGrid, 5);
          if (chainThornsDamage > 0) {
            const hpState = get().playerHp;
            const newHp = Math.max(0, hpState - chainThornsDamage);
            get().addFloatingText(`荆棘反伤 -${chainThornsDamage}`, 200, 380, 'thorns');
            get().setScreenShake(true);
            setTimeout(() => get().setScreenShake(false), 200);
            set({ playerHp: newHp });
            if (battleRecorder) {
              battleRecorder.setPlayerHp(newHp, 'thorns');
              battleRecorder.recordTerrainEffect('thorns', `荆棘反伤 -${chainThornsDamage}`, chainMatches.length, chainThornsDamage);
            }

            if (newHp <= 0) {
              const { currentLevelId, runeGrid, enemy, battleRecorder: recorder } = get();
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
              if (recorder && enemy) {
                try {
                  recorder.setPlayerHp(0, 'defeat');
                  recorder.recordTurnEnd(get().turn - 1);
                  const replay = recorder.stop('defeat');
                  replay.highlights = detectHighlights(replay);
                  const cards = generateAllShareCards(replay, replay.highlights);
                  set({ lastReplayData: replay, lastReplayShareCards: cards });
                } catch {}
              }
              showDefeatNotification(levels.find(l => l.id === currentLevelId)?.name || '');
              return;
            }
          }

          const matchedElements: Record<string, number> = {};
          chainMatches.forEach(r => {
            matchedElements[r.element] = (matchedElements[r.element] || 0) + 1;
          });

          if (battleRecorder) {
            battleRecorder.recordChainCombo(currentCombo, totalCombo, matchedElements, {}, allChainPaths);
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
                try {
                  useAchievementStore.getState().recordRunesEliminated(el as ElementType, count);
                } catch { /* non-critical */ }
                const gain = calculateEnergyGain(count, currentCombo, el as keyof EnergyPool, result.doubleEnergyCount);
                Object.entries(gain).forEach(([key, value]) => {
                  const k = key as keyof EnergyPool;
                  let amount = value || 0;
                  const boost = bonuses.energyBoost[k] || 0;
                  if (boost > 0) {
                    amount = Math.floor(amount + boost);
                  }
                  if (bonuses.resonance.energyBoostBonus) {
                    amount = Math.floor(amount + bonuses.resonance.energyBoostBonus);
                  }
                  newEnergy[k] = Math.min(get().maxEnergy, newEnergy[k] + amount);
                });
              }
            });

            if (battleRecorder) {
              battleRecorder.setEnergy({ ...newEnergy }, 'chain');
            }

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
    const { isPlayerTurn, battleStatus, isAnimating, energy, enemyUnits, selectedTargetId, battleRecorder, enemy, turn } = get();
    if (!isPlayerTurn || battleStatus !== 'playing' || isAnimating) return;

    if (energy[spell.element] < spell.cost) return;

    const target = getSelectedUnit(enemyUnits, selectedTargetId);
    if (!target) return;

    try {
      useAchievementStore.getState().recordSpellCast(spell.id);
    } catch { /* non-critical */ }

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
    let spellDmgBonus = eqBonuses.spellDamage[spell.element] || 0;
    if (eqBonuses.resonance.spellDamageBonus) {
      spellDmgBonus += eqBonuses.resonance.spellDamageBonus;
    }
    if (spellDmgBonus > 0) {
      damage = Math.floor(damage * (1 + spellDmgBonus / 100));
    }
    if (eqBonuses.resonance.damageMultiplier) {
      damage = Math.floor(damage * (1 + eqBonuses.resonance.damageMultiplier));
    }
    if (eqBonuses.resonance.critChance && Math.random() < eqBonuses.resonance.critChance) {
      damage = Math.floor(damage * 1.5);
      get().addFloatingText('暴击!', 350, 120, 'thunder');
    }

    const { enemyUnits: currentUnits } = get();
    const { updatedUnits, killedUnit, finalDamage } = calculateAndApplyDamage(currentUnits, target.id, damage);
    
    let newSelectedTargetId = selectedTargetId;
    if (killedUnit && killedUnit.id === selectedTargetId) {
      const mainEnemy = updatedUnits.find(u => u.type === 'enemy');
      newSelectedTargetId = mainEnemy?.id || (updatedUnits[0]?.id || null);
    }
    
    const mainEnemy = updatedUnits.find(u => u.type === 'enemy') as Enemy | undefined;

    if (battleRecorder) {
      if (mainEnemy) battleRecorder.setEnemyHp(mainEnemy.currentHp, mainEnemy, 'spell');
      battleRecorder.setEnergy(newEnergy, 'spell');
      const isCritical = isEffective || (killedUnit && finalDamage >= (target.maxHp || 100) * 0.5);
      battleRecorder.recordCastSpell(spell, target, finalDamage, spell.heal || 0, isEffective, isWeak, !!killedUnit, isCritical);
    }
    
    set({
      enemyUnits: updatedUnits,
      enemy: mainEnemy || null,
      selectedTargetId: newSelectedTargetId,
    });
    
    const newPlayerHp = Math.min(get().playerMaxHp, get().playerHp + spell.heal);
    if (battleRecorder && spell.heal > 0) {
      battleRecorder.setPlayerHp(newPlayerHp, 'heal');
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
        get().addFloatingText(`+${spell.heal}`, 200, 400, 'grass');
      }

      if (killedUnit) {
        get().addFloatingText(`${killedUnit.name} 被击败!`, 400, 200, 'yellow');
      }

      const { enemyUnits: latestUnits, battleRecorder: recorder } = get();
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
        trackVictory(enemy?.id, enemy?.name);
        if (recorder && enemy) {
          try {
            recorder.setEnemyHp(0, enemy, 'victory');
            recorder.recordTurnEnd(turn);
            const replay = recorder.stop('victory');
            replay.highlights = detectHighlights(replay);
            const cards = generateAllShareCards(replay, replay.highlights);
            set({ lastReplayData: replay, lastReplayShareCards: cards });
          } catch {}
        }
        get().notifyVictory(levels.find(l => l.id === get().currentLevelId)?.name || '');
      } else {
        get().saveProgress();
      }
    }, 500);
  },

  castComboSpell: (spell: ComboSpell) => {
    const { isPlayerTurn, battleStatus, isAnimating, energy, enemyUnits, selectedTargetId, comboSpellCooldowns, battleRecorder, enemy, turn } = get();
    if (!isPlayerTurn || battleStatus !== 'playing' || isAnimating) return;

    if (!canCastComboSpell(energy, spell)) return;
    if (comboSpellCooldowns[spell.id] > 0) return;

    const target = getSelectedUnit(enemyUnits, selectedTargetId);
    if (!target) return;

    try {
      useAchievementStore.getState().recordComboSpellCast(spell.id);
    } catch { /* non-critical */ }

    set({ isAnimating: true, spellEffect: spell.elements });

    const currentCombo = get().comboCount;
    audioManager.playSpell('combo', currentCombo + 1);

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
    let avgDmgBonus = comboElements.reduce((sum, el) => sum + (eqBonuses.spellDamage[el] || 0), 0) / comboElements.length;
    if (eqBonuses.resonance.spellDamageBonus) {
      avgDmgBonus += eqBonuses.resonance.spellDamageBonus;
    }
    if (avgDmgBonus > 0) {
      damage = Math.floor(damage * (1 + avgDmgBonus / 100));
    }
    if (eqBonuses.resonance.damageMultiplier) {
      damage = Math.floor(damage * (1 + eqBonuses.resonance.damageMultiplier));
    }
    if (eqBonuses.resonance.critChance && Math.random() < eqBonuses.resonance.critChance) {
      damage = Math.floor(damage * 1.5);
      get().addFloatingText('暴击!', 350, 120, 'thunder');
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

    if (battleRecorder) {
      if (mainEnemy) battleRecorder.setEnemyHp(mainEnemy.currentHp, mainEnemy, 'combo_spell');
      battleRecorder.setEnergy(newEnergy, 'combo_spell');
      battleRecorder.recordCastComboSpell(spell, target, finalDamage, !!killedUnit);
      battleRecorder.recordStatusEffect('enemy', spell.effect, spell.effect, spell.effectDuration, spell.effectValue || 0);
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
        audioManager.playEnemyHit(finalDamage, isEffective || finalDamage >= 30);
      }

      get().addFloatingText(`附加${spell.effect === 'burn' ? '灼烧' : spell.effect === 'paralyze' ? '麻痹' : '抗性降低'}!`, 400, 190, spell.elements);

      if (killedUnit) {
        get().addFloatingText(`${killedUnit.name} 被击败!`, 400, 200, 'yellow');
      }

      const { enemyUnits: finalUnitsFinal, battleRecorder: recorder } = get();
      const finalMainEnemy = finalUnitsFinal.find(u => u.type === 'enemy') as Enemy | undefined;

      set({
        energy: newEnergy,
        spellEffect: null,
        isAnimating: false,
        comboSpellCooldowns: newCooldowns,
      });

      if (!finalMainEnemy || finalMainEnemy.currentHp <= 0) {
        set({ battleStatus: 'victory' });
        if (get().currentLevelId) {
          unlockLevel(get().currentLevelId! + 1);
          set({
            unlockedLevels: getUnlockedLevels(),
            highestLevel: getHighestLevel(),
          });
        }
        clearBattleProgress();
        trackVictory(enemy?.id, enemy?.name);
        if (recorder && enemy) {
          try {
            recorder.setEnemyHp(0, enemy, 'victory');
            recorder.recordTurnEnd(turn);
            const replay = recorder.stop('victory');
            replay.highlights = detectHighlights(replay);
            const cards = generateAllShareCards(replay, replay.highlights);
            set({ lastReplayData: replay, lastReplayShareCards: cards });
          } catch {}
        }
        get().notifyVictory(levels.find(l => l.id === get().currentLevelId)?.name || '');
      } else {
        get().saveProgress();
      }
    }, 600);
  },

  endTurn: () => {
    const { battleStatus, enemy, battleRecorder, turn } = get();
    if (battleStatus !== 'playing' || !enemy) return;

    if (battleRecorder) {
      battleRecorder.recordTurnEnd(turn);
    }
    set({ isPlayerTurn: false });

    setTimeout(() => {
      get().applyStatusEffects();
    }, 500);
  },

  applyStatusEffects: () => {
    const { enemy, battleStatus, battleRecorder } = get();
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

    if (battleRecorder) {
      battleRecorder.setEnemyHp(newEnemyHp, finalEnemy, 'burn');
      if (damageDealt > 0) {
        battleRecorder.recordStatusEffect('enemy', 'burn', '灼烧', 0, 0, damageDealt);
      }
    }

    set({ enemy: finalEnemy, enemyUnits: updatedUnits });

    const eqItemsForRegen = getEquippedItems();
    const regenBonuses = getEquipmentBonuses(eqItemsForRegen);
    if (regenBonuses.resonance.hpRegenPerTurn && regenBonuses.resonance.hpRegenPerTurn > 0) {
      const regenAmount = regenBonuses.resonance.hpRegenPerTurn;
      const newHp = Math.min(get().playerMaxHp, get().playerHp + regenAmount);
      set({ playerHp: newHp });
      get().addFloatingText(`+${regenAmount}`, 300, 300, 'grass');
    }

    if (newEnemyHp <= 0) {
      const { currentLevelId, turn: currentTurn, battleRecorder: recorder, enemy: curEnemy } = get();
      set({ battleStatus: 'victory' });
      if (currentLevelId) {
        unlockLevel(currentLevelId + 1);
        set({
          unlockedLevels: getUnlockedLevels(),
          highestLevel: getHighestLevel(),
        });
      }
      clearBattleProgress();
      trackVictory(curEnemy?.id, curEnemy?.name);
      if (recorder && curEnemy) {
        try {
          recorder.setEnemyHp(0, curEnemy, 'victory');
          recorder.recordTurnEnd(currentTurn);
          const replay = recorder.stop('victory');
          replay.highlights = detectHighlights(replay);
          const cards = generateAllShareCards(replay, replay.highlights);
          set({ lastReplayData: replay, lastReplayShareCards: cards });
        } catch {}
      }
      get().notifyVictory(levels.find(l => l.id === currentLevelId)?.name || '');
      return;
    }

    setTimeout(() => {
      get().enemyAttack();
    }, 500);
  },

  enemyAttack: () => {
    const { enemy, enemyUnits, playerHp, playerMaxHp, turn, currentLevelId, runeGrid, battleRecorder } = get();
    if (!enemy) return;

    let updatedEnemy = { ...enemy };
    let currentPlayerHp = playerHp;
    let currentUnits = [...enemyUnits];

    const { updatedEnemy: enemyAfterBerserk, selfDamage } = processBerserkSelfDamage(updatedEnemy);
    updatedEnemy = enemyAfterBerserk;

    if (selfDamage > 0) {
      get().addFloatingText(`狂暴反噬 -${selfDamage}`, 400, 200, 'red');
      if (battleRecorder) {
        battleRecorder.setEnemyHp(updatedEnemy.currentHp, updatedEnemy, 'berserk');
      }
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
      trackVictory(updatedEnemy.id, updatedEnemy.name);
      if (battleRecorder) {
        try {
          battleRecorder.setEnemyHp(0, updatedEnemy, 'victory');
          battleRecorder.recordTurnEnd(turn);
          const replay = battleRecorder.stop('victory');
          replay.highlights = detectHighlights(replay);
          const cards = generateAllShareCards(replay, replay.highlights);
          set({ lastReplayData: replay, lastReplayShareCards: cards });
        } catch {}
      }
      get().notifyVictory(levels.find(l => l.id === currentLevelId)?.name || '');
      return;
    }

    currentUnits = currentUnits.map(u => 
      u.type === 'enemy' ? updatedEnemy : u
    );
    const minions = currentUnits.filter(u => u.type === 'minion') as Minion[];
    const { updatedMinions, totalDamage: minionDamage, explosions, killedMinions } = processMinionsTurn(minions) as any;
    
    currentUnits = [
      ...currentUnits.filter(u => u.type === 'enemy'),
      ...updatedMinions,
    ];
    updatedEnemy = currentUnits.find(u => u.type === 'enemy') as Enemy;

    updatedEnemy.behaviorState = {
      ...updatedEnemy.behaviorState,
      summonedMinions: updatedMinions,
    };

    if (battleRecorder) {
      killedMinions?.forEach((m: Minion) => {
        battleRecorder.recordMinionKilled(m);
      });
    }

    if (minionDamage > 0) {
      currentPlayerHp = Math.max(0, currentPlayerHp - minionDamage);
      get().setScreenShake(true);
      setTimeout(() => get().setScreenShake(false), 300);
      get().addFloatingText(`小怪伤害 -${minionDamage}`, 200, 380, 'purple');
      audioManager.playPlayerHit(minionDamage);
      if (battleRecorder) {
        battleRecorder.setPlayerHp(currentPlayerHp, 'minion');
      }
    }

    explosions.forEach((explosion: string) => {
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
      if (battleRecorder) {
        try {
          battleRecorder.setPlayerHp(0, 'defeat');
          battleRecorder.recordTurnEnd(turn);
          const replay = battleRecorder.stop('defeat');
          replay.highlights = detectHighlights(replay);
          const cards = generateAllShareCards(replay, replay.highlights);
          set({ lastReplayData: replay, lastReplayShareCards: cards });
        } catch {}
      }
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
      if (battleRecorder) {
        battleRecorder.recordMinionSummoned(newMinion);
      }
    }

    if (damageToPlayer > 0) {
      currentPlayerHp = Math.max(0, currentPlayerHp - damageToPlayer);
      get().setScreenShake(true);
      setTimeout(() => get().setScreenShake(false), 300);
      audioManager.playPlayerHit(damageToPlayer);

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

    if (battleRecorder) {
      battleRecorder.recordEnemyBehavior(
        turn,
        behavior.type,
        log.message,
        damageToPlayer,
        updatedEnemy.behaviorState.isBerserk,
        updatedEnemy.behaviorState.defenseState.isDefending,
        updatedEnemy.behaviorState.chargeState.skillName,
        updatedEnemy.behaviorState.chargeState.chargedDamage,
        newMinion?.name
      );
      battleRecorder.setPlayerHp(currentPlayerHp, 'enemy_attack');
      battleRecorder.setEnemyHp(updatedEnemy.currentHp, updatedEnemy, 'enemy_turn');
    }

    get().addFloatingText(log.message, 400, 250, 'yellow');

    const newAttackIndex = (updatedEnemy.currentAttackIndex + 1) % updatedEnemy.attackPattern.length;
    updatedEnemy.currentAttackIndex = newAttackIndex;

    currentUnits = currentUnits.map(u => 
      u.type === 'enemy' ? updatedEnemy : u
    );

    const updatedGrid = decrementDoubleEnergyTurns(runeGrid);
    get().decrementCooldowns();

    const nextTurn = turn + 1;
    if (battleRecorder) {
      battleRecorder.setTurn(nextTurn);
      battleRecorder.recordTurnStart(nextTurn);
    }

    set({
      playerHp: currentPlayerHp,
      enemy: updatedEnemy,
      enemyUnits: currentUnits,
      turn: nextTurn,
      isPlayerTurn: true,
      runeGrid: updatedGrid,
    });

    if (currentPlayerHp <= 0) {
      set({ battleStatus: 'defeat' });
      clearBattleProgress();
      if (battleRecorder) {
        try {
          battleRecorder.setPlayerHp(0, 'defeat');
          const replay = battleRecorder.stop('defeat');
          replay.highlights = detectHighlights(replay);
          const cards = generateAllShareCards(replay, replay.highlights);
          set({ lastReplayData: replay, lastReplayShareCards: cards });
        } catch {}
      }
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
    const enemy = get().enemy;
    trackVictory(enemy?.id, enemy?.name);
    showVictoryNotification(levelName);
  },

  processTerrainEffects: () => {
    const { runeGrid, terrainGrid, currentLevelId, gridSize, battleStatus, battleRecorder, playerHp, enemy } = get();
    if (battleStatus !== 'playing') return;

    const level = levels.find(l => l.id === currentLevelId);
    const spreadChance = level?.terrain?.magmaSpreadChance ?? 0.5;

    let newTerrain = terrainGrid;
    let newGrid = runeGrid;
    let totalMagmaBurnDamage = 0;
    let frostFrozenCount = 0;
    let stormChangedCount = 0;

    const { newGrid: burnedGrid, burnedCount, burnDamage } = applyBurnedRunes(newGrid, gridSize) as any;
    newGrid = burnedGrid;
    totalMagmaBurnDamage = burnDamage || 0;
    if (burnedCount > 0) {
      get().addFloatingText(`岩浆灼烧 ${burnedCount}个符文!`, 300, 280, 'magma');
      if (battleRecorder) {
        battleRecorder.recordTerrainEffect('magma', `岩浆灼烧 ${burnedCount}个符文`, burnedCount, 0);
      }
    }

    const { newGrid: frostGrid, frozenCount } = applyFrostTerrainEffect(newGrid, newTerrain, gridSize) as any;
    newGrid = frostGrid;
    frostFrozenCount = frozenCount || 0;

    newGrid = decrementTerrainFrozen(newGrid, gridSize);
    newTerrain = spreadMagma(newTerrain, newGrid, spreadChance, gridSize);
    newGrid = markMagmaBurn(newGrid, newTerrain, gridSize);
    
    if (frostFrozenCount > 0 && battleRecorder) {
      battleRecorder.recordTerrainEffect('frost', `冰霜冻结 ${frostFrozenCount}个符文`, frostFrozenCount, 0);
    }

    const { newGrid: stormGrid, changedCount, stormDamage } = applyStormTerrainEffect(newGrid, newTerrain, gridSize) as any;
    newGrid = stormGrid;
    stormChangedCount = changedCount || 0;
    if (changedCount > 0) {
      get().addFloatingText(`雷暴扭曲 ${changedCount}个符文!`, 300, 300, 'storm');
      if (battleRecorder) {
        battleRecorder.recordTerrainEffect('storm', `雷暴扭曲 ${changedCount}个符文`, changedCount, 0);
      }
    }

    const totalDamage = totalMagmaBurnDamage + (stormDamage || 0);
    if (totalDamage > 0 && battleRecorder) {
      const newHp = Math.max(0, playerHp - totalDamage);
      battleRecorder.setPlayerHp(newHp, 'terrain');
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
