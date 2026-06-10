import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useArenaStore } from '../store/useArenaStore';
import { makeAIDecision } from '../utils/defenderAI';
import { BattleTimeoutHandler, formatTimeRemaining } from '../utils/networkTimeout';
import {
  SPELLS,
  COMBO_SPELLS,
  GRID_SIZE,
  ELEMENT_COLORS,
  ELEMENT_ICONS,
  COMBO_ELEMENT_COLORS,
  DEFENDER_AI_STYLE_NAMES,
} from '../types';
import type {
  Rune,
  Spell,
  ComboSpell,
  ElementType,
  ComboElementType,
  FloatingText,
  ReplayAction,
  EnergyPool,
  AIDecision,
} from '../types';
import {
  Heart,
  Swords,
  Clock,
  Wifi,
  ArrowLeft,
  RotateCcw,
  Home,
  Trophy,
  Skull,
  Brain,
  Zap,
  Save,
  ChevronRight,
} from 'lucide-react';

const CELL_SIZE = 56;
const GAP = 6;

const elements: ElementType[] = ['fire', 'water', 'grass', 'thunder'];

const generateId = (): string =>
  `${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 9)}`;

const isAdjacent = (r1: Rune, r2: Rune): boolean => {
  const rowDiff = Math.abs(r1.row - r2.row);
  const colDiff = Math.abs(r1.col - r2.col);
  return rowDiff <= 1 && colDiff <= 1 && !(rowDiff === 0 && colDiff === 0);
};

const canAddToSelection = (selected: Rune[], rune: Rune): boolean => {
  if (rune.tileType === 'obstacle') return false;
  if (selected.length === 0) return true;
  if (selected.some((r) => r.id === rune.id)) return true;
  if (selected[0].element !== rune.element) return false;
  const last = selected[selected.length - 1];
  if (!isAdjacent(last, rune)) return false;
  return true;
};

const createRuneGrid = (gridSize: number): Rune[][] => {
  const grid: Rune[][] = [];
  for (let row = 0; row < gridSize; row++) {
    grid[row] = [];
    for (let col = 0; col < gridSize; col++) {
      grid[row][col] = {
        id: `rune_${row}_${col}_${generateId()}`,
        element: elements[Math.floor(Math.random() * elements.length)],
        row,
        col,
        isSelected: false,
        isMatched: false,
        isNew: false,
        tileType: 'normal',
        frozenHitCount: 0,
        doubleEnergyTurnsLeft: 0,
      };
    }
  }
  return grid;
};

const cloneGrid = (grid: Rune[][]): Rune[][] =>
  grid.map((row) => row.map((r) => ({ ...r })));

export const PVPArenaPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    currentBattle,
    currentProfile,
    startPracticeBattle,
    finishPVPBattle,
    resetCurrentBattle,
  } = useArenaStore();

  const [battleState, setBattleState] = useState(currentBattle);
  const [selectedRunes, setSelectedRunes] = useState<Rune[]>([]);
  const [networkStatus, setNetworkStatus] = useState<{
    status: 'connected' | 'warning' | 'disconnected' | 'timeout';
    latency: number;
  }>({ status: 'connected', latency: 42 });
  const [turnRemaining, setTurnRemaining] = useState(30000);
  const [totalRemaining, setTotalRemaining] = useState(120000);
  const [isAIThinking, setIsAIThinking] = useState(false);
  const [aiThinkingStep, setAiThinkingStep] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const gridRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDragging = useRef(false);
  const timeoutHandlerRef = useRef<BattleTimeoutHandler | null>(null);
  const aiTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!currentBattle) {
      startPracticeBattle();
    }
  }, [currentBattle, startPracticeBattle]);

  useEffect(() => {
    setBattleState(currentBattle);
  }, [currentBattle]);

  const updateBattle = useCallback(
    (updates: Partial<typeof battleState>) => {
      setBattleState((prev) => {
        if (!prev) return prev;
        const next = { ...prev, ...updates };
        useArenaStore.setState({ currentBattle: next });
        return next;
      });
    },
    []
  );

  const addFloatingText = useCallback(
    (text: string, x: number, y: number, color: string) => {
      if (!battleState) return;
      const newText: FloatingText = {
        id: generateId(),
        text,
        x,
        y,
        color,
        createdAt: Date.now(),
      };
      updateBattle({
        floatingTexts: [...battleState.floatingTexts, newText],
      });
      setTimeout(() => {
        setBattleState((prev) => {
          if (!prev) return prev;
          const next = {
            ...prev,
            floatingTexts: prev.floatingTexts.filter((t) => t.id !== newText.id),
          };
          useArenaStore.setState({ currentBattle: next });
          return next;
        });
      }, 1200);
    },
    [battleState, updateBattle]
  );

  const addReplayAction = useCallback(
    (action: Omit<ReplayAction, 'timestamp'>) => {
      if (!battleState || !battleState.isRecordingReplay) return;
      const fullAction: ReplayAction = {
        ...action,
        timestamp: Date.now(),
      };
      updateBattle({
        replayActions: [...battleState.replayActions, fullAction],
      });
    },
    [battleState, updateBattle]
  );

  useEffect(() => {
    if (!battleState || battleState.isFinished) return;

    const handler = new BattleTimeoutHandler();
    handler.setBattleState(battleState);
    handler.setCallbacks({
      onTick: (remaining) => {
        setTurnRemaining(remaining.turn);
        setTotalRemaining(remaining.total);
      },
      onTurnTimeout: () => {
        handleTurnTimeout();
      },
      onBattleTimeout: () => {
        handleBattleTimeout();
      },
    });
    handler.start();
    timeoutHandlerRef.current = handler;

    const simulateNetwork = setInterval(() => {
      const latency = 30 + Math.floor(Math.random() * 80);
      const status = latency < 80 ? 'connected' : latency < 150 ? 'warning' : 'disconnected';
      setNetworkStatus({ status, latency });
    }, 3000);

    return () => {
      handler.stop();
      clearInterval(simulateNetwork);
    };
  }, [battleState?.battleId, battleState?.isFinished]);

  useEffect(() => {
    if (timeoutHandlerRef.current && battleState) {
      timeoutHandlerRef.current.setBattleState(battleState);
    }
  }, [battleState]);

  const handleTurnTimeout = useCallback(() => {
    if (!battleState || battleState.isFinished) return;
    if (battleState.isPlayerTurn) {
      finishPVPBattle('timeout');
      setShowResult(true);
    } else {
      endAITurn();
    }
  }, [battleState, finishPVPBattle]);

  const handleBattleTimeout = useCallback(() => {
    if (!battleState || battleState.isFinished) return;
    finishPVPBattle('timeout');
    setShowResult(true);
  }, [battleState, finishPVPBattle]);

  const getRuneAtPosition = useCallback(
    (clientX: number, clientY: number): Rune | null => {
      if (!gridRef.current || !battleState) return null;
      const rect = gridRef.current.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      const col = Math.floor(x / (CELL_SIZE + GAP));
      const row = Math.floor(y / (CELL_SIZE + GAP));
      if (row >= 0 && row < battleState.gridSize && col >= 0 && col < battleState.gridSize) {
        return battleState.runeGrid[row]?.[col] || null;
      }
      return null;
    },
    [battleState]
  );

  const drawConnection = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || selectedRunes.length < 2) {
      if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx?.clearRect(0, 0, canvas.width, canvas.height);
      }
      return;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const element = selectedRunes[0].element;
    const color = ELEMENT_COLORS[element];
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
    const offset = (CELL_SIZE + GAP) / 2;
    selectedRunes.forEach((rune, index) => {
      const x = rune.col * (CELL_SIZE + GAP) + offset;
      const y = rune.row * (CELL_SIZE + GAP) + offset;
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    selectedRunes.forEach((rune) => {
      const x = rune.col * (CELL_SIZE + GAP) + offset;
      const y = rune.row * (CELL_SIZE + GAP) + offset;
      ctx.beginPath();
      ctx.arc(x, y, 10, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 16;
      ctx.fill();
    });
  }, [selectedRunes]);

  useEffect(() => {
    drawConnection();
  }, [drawConnection]);

  useEffect(() => {
    const resizeCanvas = () => {
      const canvas = canvasRef.current;
      if (!canvas || !gridRef.current) return;
      const rect = gridRef.current.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      drawConnection();
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, [drawConnection]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (!battleState || !battleState.isPlayerTurn || battleState.isFinished || battleState.isAnimating) return;
      e.preventDefault();
      isDragging.current = true;
      let clientX: number, clientY: number;
      if ('touches' in e) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else {
        clientX = e.clientX;
        clientY = e.clientY;
      }
      const rune = getRuneAtPosition(clientX, clientY);
      if (rune && canAddToSelection([], rune)) {
        const newGrid = cloneGrid(battleState.runeGrid);
        newGrid[rune.row][rune.col].isSelected = true;
        setSelectedRunes([rune]);
        updateBattle({ runeGrid: newGrid });
      }
    },
    [battleState, getRuneAtPosition, updateBattle]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (!isDragging.current || !battleState) return;
      e.preventDefault();
      let clientX: number, clientY: number;
      if ('touches' in e) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else {
        clientX = e.clientX;
        clientY = e.clientY;
      }
      const rune = getRuneAtPosition(clientX, clientY);
      if (!rune) return;
      if (selectedRunes.length >= 2 && selectedRunes[selectedRunes.length - 2]?.id === rune.id) {
        const removed = selectedRunes[selectedRunes.length - 1];
        const newRunes = selectedRunes.slice(0, -1);
        const newGrid = cloneGrid(battleState.runeGrid);
        if (removed) newGrid[removed.row][removed.col].isSelected = false;
        setSelectedRunes(newRunes);
        updateBattle({ runeGrid: newGrid });
        return;
      }
      if (canAddToSelection(selectedRunes, rune) && !selectedRunes.some((r) => r.id === rune.id)) {
        const newGrid = cloneGrid(battleState.runeGrid);
        newGrid[rune.row][rune.col].isSelected = true;
        setSelectedRunes([...selectedRunes, rune]);
        updateBattle({ runeGrid: newGrid });
      }
    },
    [battleState, selectedRunes, getRuneAtPosition, updateBattle]
  );

  const handleMouseUp = useCallback(() => {
    if (!isDragging.current || !battleState) return;
    isDragging.current = false;
    if (selectedRunes.length >= 3) {
      confirmMatch();
    } else {
      clearSelection();
    }
  }, [battleState, selectedRunes.length]);

  const clearSelection = useCallback(() => {
    if (!battleState) return;
    const newGrid = cloneGrid(battleState.runeGrid);
    newGrid.forEach((row) => row.forEach((r) => (r.isSelected = false)));
    setSelectedRunes([]);
    updateBattle({ runeGrid: newGrid });
  }, [battleState, updateBattle]);

  const calculateDamage = (matchLength: number, element: ElementType): number => {
    let base = matchLength * 5;
    if (matchLength >= 5) base += 15;
    if (matchLength >= 6) base += 25;
    return base;
  };

  const calculateEnergyGain = (matchLength: number): number => {
    let gain = Math.floor(matchLength / 3);
    if (matchLength >= 5) gain += 2;
    if (matchLength >= 6) gain += 3;
    return gain;
  };

  const refillGrid = (grid: Rune[][]): Rune[][] => {
    const size = grid.length;
    const newGrid = cloneGrid(grid);
    for (let col = 0; col < size; col++) {
      let writeRow = size - 1;
      for (let readRow = size - 1; readRow >= 0; readRow--) {
        if (!newGrid[readRow][col].isMatched) {
          if (writeRow !== readRow) {
            newGrid[writeRow][col] = {
              ...newGrid[readRow][col],
              row: writeRow,
            };
          }
          writeRow--;
        }
      }
      for (let row = writeRow; row >= 0; row--) {
        newGrid[row][col] = {
          id: `rune_${row}_${col}_${generateId()}`,
          element: elements[Math.floor(Math.random() * elements.length)],
          row,
          col,
          isSelected: false,
          isMatched: false,
          isNew: true,
          tileType: 'normal',
          frozenHitCount: 0,
          doubleEnergyTurnsLeft: 0,
        };
      }
    }
    return newGrid;
  };

  const confirmMatch = useCallback(() => {
    if (!battleState || selectedRunes.length < 3) return;
    const element = selectedRunes[0].element;
    const matchLength = selectedRunes.length;
    const damage = calculateDamage(matchLength, element);
    const energyGain = calculateEnergyGain(matchLength);

    const newGrid = cloneGrid(battleState.runeGrid);
    selectedRunes.forEach((r) => {
      newGrid[r.row][r.col].isMatched = true;
      newGrid[r.row][r.col].isSelected = false;
    });

    const newEnemyHp = Math.max(0, battleState.enemyHp - damage);
    const newPlayerEnergy = { ...battleState.playerEnergy };
    newPlayerEnergy[element] = Math.min(
      battleState.maxEnergy,
      newPlayerEnergy[element] + energyGain
    );
    const newComboCount = battleState.comboCount + 1;

    updateBattle({
      runeGrid: newGrid,
      enemyHp: newEnemyHp,
      playerEnergy: newPlayerEnergy,
      comboCount: newComboCount,
      screenShake: true,
      lastActionTime: Date.now(),
    });
    timeoutHandlerRef.current?.updateActionTime();

    const rect = gridRef.current?.getBoundingClientRect();
    if (rect) {
      addFloatingText(
        `-${damage}`,
        rect.right - 80 + Math.random() * 40,
        rect.top + rect.height / 2 + Math.random() * 40 - 20,
        ELEMENT_COLORS[element]
      );
      addFloatingText(
        `+${energyGain}${ELEMENT_ICONS[element]}`,
        rect.left + 80 + Math.random() * 40,
        rect.top + rect.height / 2 + Math.random() * 40 - 20,
        ELEMENT_COLORS[element]
      );
    }

    addReplayAction({
      turn: battleState.turn,
      side: 'attacker',
      actionType: 'match_runes',
      payload: { element, matchLength, damage, energyGain },
      hpAfter: { attacker: battleState.playerHp, defender: newEnemyHp },
      energyAfter: { ...newPlayerEnergy },
      description: `消除${matchLength}个${element}符文，造成${damage}伤害，获得${energyGain}${element}能量`,
    });

    setTimeout(() => {
      setBattleState((prev) => {
        if (!prev) return prev;
        const refilled = refillGrid(prev.runeGrid);
        const next = {
          ...prev,
          runeGrid: refilled,
          comboCount: 0,
          screenShake: false,
        };
        useArenaStore.setState({ currentBattle: next });
        return next;
      });
    }, 350);

    setSelectedRunes([]);

    if (newEnemyHp <= 0) {
      setTimeout(() => {
        finishPVPBattle('attacker_win');
        setShowResult(true);
      }, 500);
    }
  }, [battleState, selectedRunes, updateBattle, addFloatingText, addReplayAction, finishPVPBattle]);

  const canCastSpell = useCallback(
    (spell: Spell): boolean => {
      if (!battleState || !battleState.isPlayerTurn || battleState.isFinished || battleState.isAnimating) return false;
      return battleState.playerEnergy[spell.element] >= spell.cost;
    },
    [battleState]
  );

  const canCastComboSpell = useCallback(
    (spell: ComboSpell): boolean => {
      if (!battleState || !battleState.isPlayerTurn || battleState.isFinished || battleState.isAnimating) return false;
      if ((battleState.comboSpellCooldowns[spell.id] || 0) > 0) return false;
      for (const [el, cost] of Object.entries(spell.cost)) {
        if ((battleState.playerEnergy[el as ElementType] || 0) < (cost || 0)) return false;
      }
      return true;
    },
    [battleState]
  );

  const castSpell = useCallback(
    (spell: Spell) => {
      if (!battleState || !canCastSpell(spell)) return;

      const newPlayerEnergy = { ...battleState.playerEnergy };
      newPlayerEnergy[spell.element] -= spell.cost;

      let newEnemyHp = battleState.enemyHp;
      let newPlayerHp = battleState.playerHp;

      if (spell.damage > 0) {
        newEnemyHp = Math.max(0, newEnemyHp - spell.damage);
      }
      if (spell.heal > 0) {
        newPlayerHp = Math.min(battleState.playerMaxHp, newPlayerHp + spell.heal);
      }

      updateBattle({
        playerEnergy: newPlayerEnergy,
        enemyHp: newEnemyHp,
        playerHp: newPlayerHp,
        spellEffect: spell.element,
        screenShake: true,
        lastActionTime: Date.now(),
      });
      timeoutHandlerRef.current?.updateActionTime();

      const rect = gridRef.current?.getBoundingClientRect();
      if (rect) {
        if (spell.damage > 0) {
          addFloatingText(
            `-${spell.damage}`,
            rect.right - 60,
            rect.top + rect.height / 2,
            ELEMENT_COLORS[spell.element]
          );
        }
        if (spell.heal > 0) {
          addFloatingText(
            `+${spell.heal}`,
            rect.left + 60,
            rect.top + rect.height / 2,
            '#22c55e'
          );
        }
      }

      addReplayAction({
        turn: battleState.turn,
        side: 'attacker',
        actionType: 'cast_spell',
        payload: { spellId: spell.id, spellName: spell.name, damage: spell.damage, heal: spell.heal },
        hpAfter: { attacker: newPlayerHp, defender: newEnemyHp },
        energyAfter: { ...newPlayerEnergy },
        description: `释放${spell.name}，造成${spell.damage}伤害，恢复${spell.heal}生命`,
      });

      setTimeout(() => {
        updateBattle({ spellEffect: null, screenShake: false });
      }, 600);

      if (newEnemyHp <= 0) {
        setTimeout(() => {
          finishPVPBattle('attacker_win');
          setShowResult(true);
        }, 700);
      }
    },
    [battleState, canCastSpell, updateBattle, addFloatingText, addReplayAction, finishPVPBattle]
  );

  const castComboSpell = useCallback(
    (spell: ComboSpell) => {
      if (!battleState || !canCastComboSpell(spell)) return;

      const newPlayerEnergy = { ...battleState.playerEnergy };
      for (const [el, cost] of Object.entries(spell.cost)) {
        newPlayerEnergy[el as ElementType] -= cost || 0;
      }

      const newEnemyHp = Math.max(0, battleState.enemyHp - spell.damage);
      const newCooldowns = { ...battleState.comboSpellCooldowns };
      newCooldowns[spell.id] = spell.cooldown;

      updateBattle({
        playerEnergy: newPlayerEnergy,
        enemyHp: newEnemyHp,
        comboSpellCooldowns: newCooldowns,
        spellEffect: spell.elements,
        screenShake: true,
        lastActionTime: Date.now(),
      });
      timeoutHandlerRef.current?.updateActionTime();

      const rect = gridRef.current?.getBoundingClientRect();
      if (rect) {
        addFloatingText(
          `-${spell.damage}`,
          rect.right - 60,
          rect.top + rect.height / 2,
          COMBO_ELEMENT_COLORS[spell.elements]
        );
      }

      addReplayAction({
        turn: battleState.turn,
        side: 'attacker',
        actionType: 'cast_combo_spell',
        payload: { spellId: spell.id, spellName: spell.name, damage: spell.damage, effect: spell.effect },
        hpAfter: { attacker: battleState.playerHp, defender: newEnemyHp },
        energyAfter: { ...newPlayerEnergy },
        description: `释放连携技${spell.name}，造成${spell.damage}伤害并附加${spell.effect}效果`,
      });

      setTimeout(() => {
        updateBattle({ spellEffect: null, screenShake: false });
      }, 800);

      if (newEnemyHp <= 0) {
        setTimeout(() => {
          finishPVPBattle('attacker_win');
          setShowResult(true);
        }, 900);
      }
    },
    [battleState, canCastComboSpell, updateBattle, addFloatingText, addReplayAction, finishPVPBattle]
  );

  const endPlayerTurn = useCallback(() => {
    if (!battleState || !battleState.isPlayerTurn || battleState.isFinished) return;
    clearSelection();
    const newCooldowns: Record<string, number> = {};
    Object.entries(battleState.comboSpellCooldowns).forEach(([id, cd]) => {
      if (cd > 0) newCooldowns[id] = cd - 1;
    });

    addReplayAction({
      turn: battleState.turn,
      side: 'attacker',
      actionType: 'end_turn',
      payload: { type: 'player_end' },
      hpAfter: { attacker: battleState.playerHp, defender: battleState.enemyHp },
      energyAfter: { ...battleState.playerEnergy },
      description: '玩家回合结束',
    });

    updateBattle({
      isPlayerTurn: false,
      comboSpellCooldowns: newCooldowns,
      lastActionTime: Date.now(),
    });
    timeoutHandlerRef.current?.updateActionTime();
    setIsAIThinking(true);
    setAiThinkingStep(0);
  }, [battleState, clearSelection, updateBattle, addReplayAction]);

  const applyAIDecision = useCallback(
    (decision: AIDecision) => {
      if (!battleState) return;

      if (decision.type === 'match_runes' && decision.runes && decision.runes.length >= 3) {
        const element = decision.runes[0].element;
        const matchLength = decision.runes.length;
        const damage = calculateDamage(matchLength, element);
        const energyGain = calculateEnergyGain(matchLength);

        const newGrid = cloneGrid(battleState.runeGrid);
        decision.runes.forEach((r) => {
          const target = newGrid[r.row]?.[r.col];
          if (target) target.isMatched = true;
        });

        const newPlayerHp = Math.max(0, battleState.playerHp - damage);
        const newEnemyEnergy = { ...battleState.enemyEnergy };
        newEnemyEnergy[element] = Math.min(battleState.maxEnergy, newEnemyEnergy[element] + energyGain);

        updateBattle({
          runeGrid: newGrid,
          playerHp: newPlayerHp,
          enemyEnergy: newEnemyEnergy,
          screenShake: true,
          lastActionTime: Date.now(),
        });
        timeoutHandlerRef.current?.updateActionTime();

        const rect = gridRef.current?.getBoundingClientRect();
        if (rect) {
          addFloatingText(
            `-${damage}`,
            rect.left + 80 + Math.random() * 40,
            rect.top + rect.height / 2 + Math.random() * 40 - 20,
            ELEMENT_COLORS[element]
          );
        }

        addReplayAction({
          turn: battleState.turn,
          side: 'defender',
          actionType: 'match_runes',
          payload: { element, matchLength, damage, energyGain, reasoning: decision.reasoning },
          hpAfter: { attacker: newPlayerHp, defender: battleState.enemyHp },
          energyAfter: { ...newEnemyEnergy },
          description: `AI消除${matchLength}个${element}符文，造成${damage}伤害`,
        });

        setTimeout(() => {
          setBattleState((prev) => {
            if (!prev) return prev;
            const refilled = refillGrid(prev.runeGrid);
            const next = { ...prev, runeGrid: refilled, screenShake: false };
            useArenaStore.setState({ currentBattle: next });
            return next;
          });
        }, 400);

        if (newPlayerHp <= 0) {
          setTimeout(() => {
            finishPVPBattle('defender_win');
            setShowResult(true);
          }, 600);
          return false;
        }
      } else if (decision.type === 'cast_spell' && decision.spell) {
        const spell = decision.spell;
        const newEnemyEnergy = { ...battleState.enemyEnergy };
        newEnemyEnergy[spell.element] -= spell.cost;

        let newPlayerHp = battleState.playerHp;
        let newEnemyHp = battleState.enemyHp;

        if (spell.damage > 0) {
          newPlayerHp = Math.max(0, newPlayerHp - spell.damage);
        }
        if (spell.heal > 0) {
          newEnemyHp = Math.min(battleState.enemyMaxHp, newEnemyHp + spell.heal);
        }

        updateBattle({
          enemyEnergy: newEnemyEnergy,
          playerHp: newPlayerHp,
          enemyHp: newEnemyHp,
          spellEffect: spell.element,
          screenShake: true,
          lastActionTime: Date.now(),
        });
        timeoutHandlerRef.current?.updateActionTime();

        const rect = gridRef.current?.getBoundingClientRect();
        if (rect) {
          if (spell.damage > 0) {
            addFloatingText(
              `-${spell.damage}`,
              rect.left + 60,
              rect.top + rect.height / 2,
              ELEMENT_COLORS[spell.element]
            );
          }
          if (spell.heal > 0) {
            addFloatingText(
              `+${spell.heal}`,
              rect.right - 60,
              rect.top + rect.height / 2,
              '#22c55e'
            );
          }
        }

        addReplayAction({
          turn: battleState.turn,
          side: 'defender',
          actionType: 'cast_spell',
          payload: { spellId: spell.id, spellName: spell.name, damage: spell.damage, heal: spell.heal, reasoning: decision.reasoning },
          hpAfter: { attacker: newPlayerHp, defender: newEnemyHp },
          energyAfter: { ...newEnemyEnergy },
          description: `AI释放${spell.name}`,
        });

        setTimeout(() => {
          updateBattle({ spellEffect: null, screenShake: false });
        }, 600);

        if (newPlayerHp <= 0) {
          setTimeout(() => {
            finishPVPBattle('defender_win');
            setShowResult(true);
          }, 700);
          return false;
        }
      } else if (decision.type === 'cast_combo_spell' && decision.comboSpell) {
        const spell = decision.comboSpell;
        const newEnemyEnergy = { ...battleState.enemyEnergy };
        for (const [el, cost] of Object.entries(spell.cost)) {
          newEnemyEnergy[el as ElementType] -= cost || 0;
        }
        const newPlayerHp = Math.max(0, battleState.playerHp - spell.damage);
        const newCooldowns = { ...battleState.enemyComboSpellCooldowns };
        newCooldowns[spell.id] = spell.cooldown;

        updateBattle({
          enemyEnergy: newEnemyEnergy,
          playerHp: newPlayerHp,
          enemyComboSpellCooldowns: newCooldowns,
          spellEffect: spell.elements,
          screenShake: true,
          lastActionTime: Date.now(),
        });
        timeoutHandlerRef.current?.updateActionTime();

        const rect = gridRef.current?.getBoundingClientRect();
        if (rect) {
          addFloatingText(
            `-${spell.damage}`,
            rect.left + 60,
            rect.top + rect.height / 2,
            COMBO_ELEMENT_COLORS[spell.elements]
          );
        }

        addReplayAction({
          turn: battleState.turn,
          side: 'defender',
          actionType: 'cast_combo_spell',
          payload: { spellId: spell.id, spellName: spell.name, damage: spell.damage, reasoning: decision.reasoning },
          hpAfter: { attacker: newPlayerHp, defender: battleState.enemyHp },
          energyAfter: { ...newEnemyEnergy },
          description: `AI释放连携技${spell.name}`,
        });

        setTimeout(() => {
          updateBattle({ spellEffect: null, screenShake: false });
        }, 800);

        if (newPlayerHp <= 0) {
          setTimeout(() => {
            finishPVPBattle('defender_win');
            setShowResult(true);
          }, 900);
          return false;
        }
      }
      return true;
    },
    [battleState, updateBattle, addFloatingText, addReplayAction, finishPVPBattle]
  );

  const endAITurn = useCallback(() => {
    if (!battleState) return;
    const newCooldowns: Record<string, number> = {};
    Object.entries(battleState.enemyComboSpellCooldowns).forEach(([id, cd]) => {
      if (cd > 0) newCooldowns[id] = cd - 1;
    });

    addReplayAction({
      turn: battleState.turn,
      side: 'defender',
      actionType: 'end_turn',
      payload: { type: 'ai_end' },
      hpAfter: { attacker: battleState.playerHp, defender: battleState.enemyHp },
      energyAfter: { ...battleState.enemyEnergy },
      description: 'AI回合结束',
    });

    updateBattle({
      isPlayerTurn: true,
      turn: battleState.turn + 1,
      enemyComboSpellCooldowns: newCooldowns,
      lastActionTime: Date.now(),
    });
    timeoutHandlerRef.current?.updateActionTime();
    setIsAIThinking(false);
    setAiThinkingStep(0);
  }, [battleState, updateBattle, addReplayAction]);

  useEffect(() => {
    if (!battleState || battleState.isFinished) return;
    if (battleState.isPlayerTurn) return;
    if (isAIThinking && aiTimerRef.current === null) {
      const steps = [
        () => setAiThinkingStep(1),
        () => setAiThinkingStep(2),
        () => {
          if (!battleState) return;
          const decision = makeAIDecision(battleState, true);
          setAiThinkingStep(3);
          setTimeout(() => {
            const shouldContinue = applyAIDecision(decision);
            if (shouldContinue) {
              setTimeout(() => {
                endAITurn();
              }, 800);
            }
            setIsAIThinking(false);
          }, 400);
        },
      ];

      let idx = 0;
      const runStep = () => {
        if (idx < steps.length) {
          steps[idx]();
          idx++;
          aiTimerRef.current = window.setTimeout(runStep, 500 + Math.random() * 300);
        }
      };
      aiTimerRef.current = window.setTimeout(runStep, 300);
    }
    return () => {
      if (aiTimerRef.current !== null) {
        clearTimeout(aiTimerRef.current);
        aiTimerRef.current = null;
      }
    };
  }, [battleState?.isPlayerTurn, battleState?.isFinished]);

  const handleReturnHome = () => {
    resetCurrentBattle();
    navigate('/arena');
  };

  const handleRetry = () => {
    resetCurrentBattle();
    setShowResult(false);
    setSaveSuccess(false);
    startPracticeBattle();
  };

  const handleSaveReplay = () => {
    if (!battleState?.replayActions) return;
    try {
      const replayKey = `replay_${battleState.battleId}_${Date.now()}`;
      const savedReplays = JSON.parse(localStorage.getItem('pvp_saved_replays') || '[]');
      savedReplays.push({
        key: replayKey,
        battleId: battleState.battleId,
        savedAt: Date.now(),
        actionsCount: battleState.replayActions.length,
      });
      localStorage.setItem(replayKey, JSON.stringify(battleState.replayActions));
      localStorage.setItem('pvp_saved_replays', JSON.stringify(savedReplays));
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (e) {
      console.error('Save replay failed:', e);
    }
  };

  if (!battleState) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-game-bg">
        <div className="text-2xl text-game-gold animate-pulse">加载对战中...</div>
      </div>
    );
  }

  const playerHpPct = (battleState.playerHp / battleState.playerMaxHp) * 100;
  const enemyHpPct = (battleState.enemyHp / battleState.enemyMaxHp) * 100;

  const getHpBarColor = (pct: number) => {
    if (pct > 60) return 'bg-green-500';
    if (pct > 30) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const gridStyle = useMemo(
    () => ({
      display: 'grid',
      gridTemplateColumns: `repeat(${battleState.gridSize}, ${CELL_SIZE}px)`,
      gridTemplateRows: `repeat(${battleState.gridSize}, ${CELL_SIZE}px)`,
      gap: `${GAP}px`,
      width: battleState.gridSize * (CELL_SIZE + GAP) - GAP,
      height: battleState.gridSize * (CELL_SIZE + GAP) - GAP,
    }),
    [battleState.gridSize]
  );

  const isVictory = battleState.battleStatus === 'victory';
  const isDefeat = battleState.battleStatus === 'defeat';
  const isTimeout = battleState.battleStatus !== 'victory' && battleState.battleStatus !== 'defeat' && showResult;

  const netColor = {
    connected: '#22c55e',
    warning: '#eab308',
    disconnected: '#f97316',
    timeout: '#ef4444',
  }[networkStatus.status];

  return (
    <div className={`min-h-screen w-full p-3 md:p-6 bg-game-bg ${battleState.screenShake ? 'shake' : ''}`}>
      <div className="max-w-7xl mx-auto">
        {/* 顶部信息栏 */}
        <div className="game-card p-3 md:p-4 mb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              onClick={handleReturnHome}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-game-card-hover hover:bg-game-card transition-colors text-sm"
            >
              <ArrowLeft size={18} />
              <span className="hidden sm:inline">返回竞技场</span>
              <span className="sm:hidden">返回</span>
            </button>

            <div className="flex items-center gap-4 md:gap-6 text-sm">
              <div className="flex items-center gap-2">
                <Clock size={18} className="text-game-gold" />
                <span className="font-bold">回合 {battleState.turn}</span>
              </div>
              <div className="flex items-center gap-2">
                <Swords
                  size={18}
                  className={battleState.isPlayerTurn ? 'text-green-400' : 'text-red-400'}
                />
                <span className={battleState.isPlayerTurn ? 'text-green-400 font-bold' : 'text-red-400 font-bold'}>
                  {battleState.isPlayerTurn ? '你的回合' : 'AI回合'}
                </span>
              </div>
              <div className="hidden md:flex items-center gap-2">
                <Wifi size={18} style={{ color: netColor }} />
                <span style={{ color: netColor }} className="font-mono text-xs">
                  {networkStatus.latency}ms
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs md:text-sm">
              <div className="flex items-center gap-1">
                <Zap size={14} className={turnRemaining < 10000 ? 'text-red-400 animate-pulse' : 'text-yellow-400'} />
                <span className={turnRemaining < 10000 ? 'text-red-400 font-bold' : 'text-gray-300'}>
                  {formatTimeRemaining(turnRemaining)}
                </span>
              </div>
              <div className="hidden sm:flex items-center gap-1 text-gray-400">
                <span>总计</span>
                <span className="font-mono">{formatTimeRemaining(totalRemaining)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* 主战斗区域 */}
        <div className="grid lg:grid-cols-12 gap-4">
          {/* 左侧：玩家状态 */}
          <div className="lg:col-span-3 space-y-4">
            <div className={`game-card p-4 ${battleState.screenShake && battleState.isPlayerTurn ? 'shake' : ''}`}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-3xl shadow-lg shadow-blue-500/30 border-2 border-blue-400/50">
                  {currentProfile?.avatar || '🧙'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-white text-sm md:text-base truncate">
                      {currentProfile?.playerName || '玩家'}
                    </h3>
                    <span className="px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 text-[10px] border border-green-500/40 shrink-0">
                      进攻方
                    </span>
                  </div>
                  {battleState.isPlayerTurn && (
                    <div className="px-2 py-0.5 rounded-full bg-green-500 text-white text-[10px] inline-flex items-center gap-1 animate-pulse">
                      <span className="w-1.5 h-1.5 rounded-full bg-white" />
                      行动中
                    </div>
                  )}
                </div>
              </div>

              {/* 血量条 */}
              <div className="mb-3">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="flex items-center gap-1 text-gray-300">
                    <Heart size={12} className="text-red-400" />
                    HP
                  </span>
                  <span className="font-bold text-white">
                    {battleState.playerHp}/{battleState.playerMaxHp}
                  </span>
                </div>
                <div className="health-bar h-4">
                  <div
                    className={`health-bar-fill ${getHpBarColor(playerHpPct)} transition-all duration-500`}
                    style={{ width: `${playerHpPct}%` }}
                  />
                </div>
              </div>

              {/* 玩家能量 */}
              <div>
                <div className="text-xs text-gray-400 mb-2 flex items-center gap-1">
                  <Zap size={12} /> 元素能量
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {elements.map((el) => {
                    const current = battleState.playerEnergy[el];
                    const pct = (current / battleState.maxEnergy) * 100;
                    return (
                      <div key={el} className="flex flex-col items-center">
                        <div className="relative w-10 h-10 md:w-12 md:h-12">
                          <svg className="w-full h-full transform -rotate-90">
                            <circle cx="20" cy="20" r="17" fill="none" stroke="#1a0b2e" strokeWidth="4" />
                            <circle
                              cx="20"
                              cy="20"
                              r="17"
                              fill="none"
                              stroke={ELEMENT_COLORS[el]}
                              strokeWidth="4"
                              strokeDasharray={`${pct * 1.07} 107`}
                              strokeLinecap="round"
                              className="transition-all duration-500"
                              style={{ filter: `drop-shadow(0 0 4px ${ELEMENT_COLORS[el]})` }}
                            />
                          </svg>
                          <div className="absolute inset-0 flex items-center justify-center text-lg md:text-xl">
                            {ELEMENT_ICONS[el]}
                          </div>
                        </div>
                        <div
                          className="text-[10px] md:text-xs font-bold mt-1"
                          style={{ color: ELEMENT_COLORS[el] }}
                        >
                          {current}/{battleState.maxEnergy}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* 结束回合按钮 */}
            <button
              onClick={endPlayerTurn}
              disabled={!battleState.isPlayerTurn || battleState.isFinished || battleState.isAnimating}
              className={`w-full game-button-primary py-3 flex items-center justify-center gap-2 font-bold ${
                !battleState.isPlayerTurn || battleState.isFinished
                  ? 'opacity-50 cursor-not-allowed grayscale'
                  : ''
              }`}
            >
              <ChevronRight size={20} />
              结束回合
            </button>
          </div>

          {/* 中间：棋盘 */}
          <div className="lg:col-span-6 flex flex-col items-center">
            {/* VS 显示 */}
            <div className="flex items-center justify-center gap-4 md:gap-8 mb-4 w-full">
              <div className="flex-1 h-0.5 bg-gradient-to-r from-transparent via-blue-500/50 to-blue-500" />
              <div className="relative">
                <span className="text-2xl md:text-3xl font-black text-game-gold font-display">
                  VS
                </span>
                {isAIThinking && (
                  <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap flex items-center gap-1.5 px-2 py-1 rounded-full bg-red-500/20 border border-red-500/40">
                    <Brain size={14} className="text-red-400 animate-pulse" />
                    <span className="text-red-400 text-xs font-bold">
                      AI思考{'.'.repeat(aiThinkingStep)}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex-1 h-0.5 bg-gradient-to-l from-transparent via-red-500/50 to-red-500" />
            </div>

            <div className="relative">
              {battleState.comboCount > 1 && (
                <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 text-xl md:text-2xl font-bold text-game-gold animate-pulse whitespace-nowrap z-10">
                  {battleState.comboCount}x 连击！
                </div>
              )}

              <div
                ref={gridRef}
                style={gridStyle}
                className={`relative p-3 md:p-4 bg-game-card rounded-2xl border-2 border-game-gold/30 shadow-2xl ${
                  battleState.isPlayerTurn && !battleState.isFinished && !battleState.isAnimating
                    ? 'cursor-crosshair'
                    : 'cursor-not-allowed opacity-85'
                }`}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onTouchStart={handleMouseDown}
                onTouchMove={handleMouseMove}
                onTouchEnd={handleMouseUp}
              >
                <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none z-10" />

                {battleState.runeGrid.map((row) =>
                  row.map((rune) => {
                    let cls = `rune rune-${rune.element}`;
                    if (rune.isSelected) cls += ' rune-selected';
                    if (rune.isMatched) cls += ' rune-matched';
                    if (rune.isNew) cls += ' animate-pop-in';
                    if (rune.tileType === 'double_energy') cls += ' rune-double-energy';
                    if (rune.tileType === 'frozen') cls += ' rune-frozen';
                    if (rune.tileType === 'obstacle') cls = 'rune rune-obstacle';

                    return (
                      <div
                        key={rune.id}
                        className={cls}
                        style={{ width: CELL_SIZE, height: CELL_SIZE }}
                      >
                        <span className="text-2xl md:text-3xl">{ELEMENT_ICONS[rune.element]}</span>
                      </div>
                    );
                  })
                )}
              </div>

              {isAIThinking && (
                <div className="absolute inset-0 bg-black/30 rounded-2xl flex items-center justify-center pointer-events-none">
                  <div className="bg-game-card/95 px-6 py-4 rounded-xl border border-red-500/40 backdrop-blur-sm">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <Brain size={32} className="text-red-400 animate-bounce" />
                        <div className="absolute inset-0 bg-red-400/30 rounded-full animate-ping" />
                      </div>
                      <div>
                        <div className="text-red-400 font-bold">AI决策中...</div>
                        <div className="text-xs text-gray-400 mt-0.5">
                          {aiThinkingStep === 0 && '分析棋盘局势'}
                          {aiThinkingStep === 1 && '评估符文匹配'}
                          {aiThinkingStep === 2 && '计算法术收益'}
                          {aiThinkingStep === 3 && `执行: ${'选择最佳策略'}`}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4 text-center text-xs text-gray-500 max-w-md">
              滑动连接3个以上同色符文消除并获得能量 | 能量充足时可释放法术
            </div>
          </div>

          {/* 右侧：AI状态 */}
          <div className="lg:col-span-3 space-y-4">
            <div className={`game-card p-4 ${battleState.screenShake && !battleState.isPlayerTurn ? 'shake' : ''}`}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center text-3xl shadow-lg shadow-red-500/30 border-2 border-red-400/50">
                  🤖
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-white text-sm md:text-base truncate">
                      AI防守者
                    </h3>
                    <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-[10px] border border-red-500/40 shrink-0">
                      防守方
                    </span>
                  </div>
                  <div className="text-[10px] text-purple-400">
                    风格: {DEFENDER_AI_STYLE_NAMES[battleState.defenderAIStyle] || '均衡型'}
                  </div>
                </div>
              </div>

              {/* 血量条 */}
              <div className="mb-3">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="flex items-center gap-1 text-gray-300">
                    <Heart size={12} className="text-red-400" />
                    HP
                  </span>
                  <span className="font-bold text-white">
                    {battleState.enemyHp}/{battleState.enemyMaxHp}
                  </span>
                </div>
                <div className="health-bar h-4">
                  <div
                    className={`health-bar-fill ${getHpBarColor(enemyHpPct)} transition-all duration-500`}
                    style={{ width: `${enemyHpPct}%` }}
                  />
                </div>
              </div>

              {/* AI能量 */}
              <div>
                <div className="text-xs text-gray-400 mb-2 flex items-center gap-1">
                  <Zap size={12} /> AI能量
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {elements.map((el) => {
                    const current = battleState.enemyEnergy[el];
                    const pct = (current / battleState.maxEnergy) * 100;
                    return (
                      <div key={el} className="flex flex-col items-center">
                        <div className="relative w-10 h-10 md:w-12 md:h-12">
                          <svg className="w-full h-full transform -rotate-90">
                            <circle cx="20" cy="20" r="17" fill="none" stroke="#1a0b2e" strokeWidth="4" />
                            <circle
                              cx="20"
                              cy="20"
                              r="17"
                              fill="none"
                              stroke={ELEMENT_COLORS[el]}
                              strokeWidth="4"
                              strokeDasharray={`${pct * 1.07} 107`}
                              strokeLinecap="round"
                              className="transition-all duration-500 opacity-70"
                            />
                          </svg>
                          <div className="absolute inset-0 flex items-center justify-center text-lg md:text-xl opacity-70">
                            {ELEMENT_ICONS[el]}
                          </div>
                        </div>
                        <div
                          className="text-[10px] md:text-xs font-bold mt-1 opacity-70"
                          style={{ color: ELEMENT_COLORS[el] }}
                        >
                          {current}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* 对战码信息 */}
            <div className="game-card p-3">
              <div className="text-[10px] text-gray-500 mb-1">对战模式</div>
              <div className="text-sm font-bold text-game-gold">
                {battleState.battleCode === 'PRACTICE' ? '🎯 练习模式' : '⚔️ 竞技对战'}
              </div>
              {battleState.battleCode !== 'PRACTICE' && (
                <div className="mt-2 text-[10px] text-gray-500 truncate font-mono">
                  码: {battleState.battleCode.slice(0, 20)}...
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 下方法术区 */}
        <div className="mt-6 game-card p-4 md:p-6">
          <div className="grid lg:grid-cols-2 gap-6">
            {/* 普通法术 */}
            <div>
              <h3 className="text-base md:text-lg font-bold text-game-gold mb-3 md:mb-4 text-center font-display flex items-center justify-center gap-2">
                <Zap size={18} /> 法术技能
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {battleState.playerSpells.map((spell) => {
                  const enabled = canCastSpell(spell);
                  const color = ELEMENT_COLORS[spell.element];
                  return (
                    <button
                      key={spell.id}
                      onClick={() => castSpell(spell)}
                      disabled={!enabled}
                      className={`game-button game-button-${spell.element} flex flex-col items-center justify-center p-2 md:p-3 min-h-[100px] md:min-h-[115px] ${
                        !enabled ? 'opacity-50 cursor-not-allowed grayscale' : ''
                      }`}
                    >
                      <div className="text-2xl md:text-3xl mb-1 md:mb-2">{spell.icon}</div>
                      <div className="font-bold text-xs md:text-sm">{spell.name}</div>
                      <div className="text-[10px] md:text-xs opacity-80 mt-1">
                        消耗 {spell.cost} {ELEMENT_ICONS[spell.element]}
                      </div>
                      {spell.damage > 0 && (
                        <div className="text-[10px] md:text-xs mt-0.5" style={{ color }}>
                          伤害 {spell.damage}
                        </div>
                      )}
                      {spell.heal > 0 && (
                        <div className="text-[10px] md:text-xs mt-0.5 text-green-400">
                          治疗 {spell.heal}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Combo法术 */}
            <div>
              <h3 className="text-base md:text-lg font-bold text-purple-400 mb-3 md:mb-4 text-center font-display flex items-center justify-center gap-2">
                <Swords size={18} /> 元素连携
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {COMBO_SPELLS.map((spell) => {
                  const enabled = canCastComboSpell(spell);
                  const cooldown = battleState.comboSpellCooldowns[spell.id] || 0;
                  const colors = spell.elements.split('+') as ElementType[];
                  return (
                    <button
                      key={spell.id}
                      onClick={() => castComboSpell(spell)}
                      disabled={!enabled}
                      className={`game-button flex flex-col items-center justify-center p-2 md:p-3 min-h-[100px] md:min-h-[115px] relative ${
                        !enabled ? 'opacity-50 cursor-not-allowed grayscale' : ''
                      }`}
                      style={{
                        background: `linear-gradient(135deg, ${ELEMENT_COLORS[colors[0]]}30, ${ELEMENT_COLORS[colors[1]]}30)`,
                        borderColor: COMBO_ELEMENT_COLORS[spell.elements],
                        borderWidth: '2px',
                      }}
                    >
                      {cooldown > 0 && (
                        <div className="absolute inset-0 bg-black/70 flex items-center justify-center rounded-lg z-10">
                          <span className="text-xl md:text-2xl font-bold text-white">
                            CD: {cooldown}
                          </span>
                        </div>
                      )}
                      <div className="text-2xl md:text-3xl mb-1 md:mb-2">{spell.icon}</div>
                      <div className="font-bold text-xs md:text-sm">{spell.name}</div>
                      <div className="text-[10px] md:text-xs opacity-80 mt-1">
                        {Object.entries(spell.cost)
                          .map(([el, c]) => `${ELEMENT_ICONS[el as ElementType]}${c}`)
                          .join(' ')}
                      </div>
                      <div className="text-[10px] md:text-xs mt-0.5 text-yellow-400">
                        伤害 {spell.damage}
                      </div>
                      <div className="text-[10px] md:text-xs mt-0.5 text-purple-300">
                        {spell.effect === 'burn'
                          ? '灼烧'
                          : spell.effect === 'paralyze'
                          ? '麻痹'
                          : '降抗'}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 飘字效果 */}
      {battleState.floatingTexts.map((text) => (
        <div
          key={text.id}
          className="floating-text text-xl md:text-2xl font-bold z-50"
          style={{
            left: text.x,
            top: text.y,
            color:
              text.color in ELEMENT_COLORS
                ? ELEMENT_COLORS[text.color as ElementType]
                : text.color,
            textShadow: '0 2px 8px rgba(0,0,0,0.8)',
          }}
        >
          {text.text}
        </div>
      ))}

      {/* 法术全屏特效 */}
      {battleState.spellEffect && (
        <div className="fixed inset-0 pointer-events-none z-40">
          <div
            className="absolute inset-0 animate-ping"
            style={{
              background: `radial-gradient(circle, ${
                battleState.spellEffect.includes('+')
                  ? COMBO_ELEMENT_COLORS[battleState.spellEffect as ComboElementType]
                  : ELEMENT_COLORS[battleState.spellEffect as ElementType]
              }40 0%, transparent 70%)`,
            }}
          />
          {[...Array(16)].map((_, i) => (
            <div
              key={i}
              className="absolute rounded-full animate-ping"
              style={{
                width: Math.random() * 30 + 10,
                height: Math.random() * 30 + 10,
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                backgroundColor: battleState.spellEffect.includes('+')
                  ? COMBO_ELEMENT_COLORS[battleState.spellEffect as ComboElementType]
                  : ELEMENT_COLORS[battleState.spellEffect as ElementType],
                opacity: 0.6,
                animationDelay: `${Math.random() * 0.5}s`,
                animationDuration: `${Math.random() * 0.5 + 0.3}s`,
              }}
            />
          ))}
        </div>
      )}

      {/* 战斗结果弹窗 */}
      {showResult && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-50 animate-fade-in p-4">
          <div className="game-card p-6 md:p-8 max-w-md w-full mx-4 animate-pop-in max-h-[90vh] overflow-y-auto">
            <div className="text-center">
              <div
                className={`text-7xl md:text-8xl mb-4 ${
                  isVictory ? 'animate-bounce' : 'animate-pulse'
                }`}
              >
                {isVictory ? '🏆' : isTimeout ? '⏱️' : '💀'}
              </div>

              <h2
                className={`text-3xl md:text-4xl font-bold mb-2 font-display ${
                  isVictory
                    ? 'text-game-gold'
                    : isTimeout
                    ? 'text-orange-500'
                    : 'text-red-500'
                }`}
              >
                {isVictory ? '胜利！' : isTimeout ? '战斗超时' : '战败...'}
              </h2>

              <p className="text-gray-400 mb-6 text-sm md:text-base">
                {isVictory
                  ? '恭喜击败AI防守者！'
                  : isTimeout
                  ? battleState.isPlayerTurn
                    ? '回合超时，判负'
                    : '对战超时'
                  : '被AI击败了，再接再厉！'}
              </p>

              {/* 战斗数据 */}
              <div className="mb-6 game-card p-4 bg-game-bg-dark/60 space-y-3">
                <h3 className="text-game-gold font-bold text-sm flex items-center gap-2">
                  <Trophy size={16} /> 战斗统计
                </h3>

                <div className="grid grid-cols-2 gap-3 text-xs md:text-sm">
                  <div className="flex justify-between bg-game-bg-dark/40 rounded-lg px-3 py-2">
                    <span className="text-gray-400">回合数</span>
                    <span className="font-bold text-white">{battleState.turn}</span>
                  </div>
                  <div className="flex justify-between bg-game-bg-dark/40 rounded-lg px-3 py-2">
                    <span className="text-gray-400">操作数</span>
                    <span className="font-bold text-white">{battleState.replayActions?.length || 0}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="flex items-center gap-1 text-blue-400">
                        <span>🧙</span> 玩家(你)
                      </span>
                      <span className="text-green-400 font-bold">
                        {battleState.playerHp} / {battleState.playerMaxHp}
                      </span>
                    </div>
                    <div className="h-3 bg-game-bg-dark rounded-full overflow-hidden">
                      <div
                        className={`h-full ${getHpBarColor(playerHpPct)} transition-all`}
                        style={{ width: `${playerHpPct}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="flex items-center gap-1 text-red-400">
                        <span>🤖</span> AI防守者
                      </span>
                      <span className="text-red-400 font-bold">
                        {battleState.enemyHp} / {battleState.enemyMaxHp}
                      </span>
                    </div>
                    <div className="h-3 bg-game-bg-dark rounded-full overflow-hidden">
                      <div
                        className={`h-full ${getHpBarColor(enemyHpPct)} transition-all`}
                        style={{ width: `${enemyHpPct}%` }}
                      />
                    </div>
                  </div>
                </div>

                {battleState.battleCode !== 'PRACTICE' && (
                  <div className="pt-2 border-t border-game-gold/20">
                    <div className="text-center">
                      <span className="text-xs text-gray-500">积分变化</span>
                      <div className={`text-xl font-bold mt-1 ${
                        isVictory ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {isVictory ? '+' : ''}
                        {isVictory
                          ? currentProfile
                            ? `预计 +${25 + Math.floor(currentProfile.winStreak * 3)}`
                            : '+25'
                          : '-15'}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 保存录像按钮 */}
              {battleState.isRecordingReplay && (
                <button
                  onClick={handleSaveReplay}
                  disabled={saveSuccess}
                  className={`w-full mb-4 px-4 py-3 rounded-lg flex items-center justify-center gap-2 font-bold transition-all ${
                    saveSuccess
                      ? 'bg-green-500/20 text-green-400 border border-green-500/40'
                      : 'bg-game-card hover:bg-game-card-hover text-purple-400 border border-purple-500/30 hover:border-purple-500/60'
                  }`}
                >
                  <Save size={18} />
                  <span>{saveSuccess ? '✓ 录像已保存' : '保存战斗录像'}</span>
                </button>
              )}

              {/* 操作按钮 */}
              <div className="space-y-3">
                <button
                  onClick={handleRetry}
                  className="w-full game-button-primary flex items-center justify-center gap-2 py-3 font-bold"
                >
                  <RotateCcw size={20} />
                  <span>重新挑战</span>
                </button>

                <button
                  onClick={handleReturnHome}
                  className="w-full game-button bg-game-card hover:bg-game-card-hover text-white flex items-center justify-center gap-2 py-3"
                >
                  <Home size={20} />
                  <span>返回竞技场主页</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
