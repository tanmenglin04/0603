import type {
  PVPBattleState,
  BattleInitPayload,
  TurnActionPayload,
  BattleResultPayload,
  DefenderLoadout,
  Spell,
  ComboSpell,
  Rune,
  EnergyPool,
  ReplayAction,
  BattleRecord,
  ArenaPlayerProfile,
  P2PSession,
} from '../types';
import {
  SPELLS,
  COMBO_SPELLS,
  GRID_SIZE,
  BATTLE_TIMEOUT_MS,
  TURN_TIMEOUT_MS,
  generateId,
} from '../types';
import { P2PConnectionManager, calculateStateHash } from './p2pConnectionManager';
import { BattleTimeoutHandler, checkBattleTurnTimeout } from './networkTimeout';

const emptyEnergy: EnergyPool = { fire: 0, water: 0, grass: 0, thunder: 0 };

const elements: ('fire' | 'water' | 'grass' | 'thunder')[] = ['fire', 'water', 'grass', 'thunder'];

const getSpellsByIds = (ids: string[]): Spell[] => {
  return ids.map((id) => SPELLS.find((s) => s.id === id)).filter((s): s is Spell => !!s);
};

const createSeededRuneGrid = (
  gridSize: number,
  seed: number,
  excludedElements?: string[]
): Rune[][] => {
  const random = (() => {
    let s = seed >>> 0;
    return () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 0x100000000;
    };
  })();

  const availableElements = excludedElements
    ? elements.filter((e) => !excludedElements.includes(e))
    : elements;

  const grid: Rune[][] = [];
  for (let row = 0; row < gridSize; row++) {
    grid[row] = [];
    for (let col = 0; col < gridSize; col++) {
      const element = availableElements[Math.floor(random() * availableElements.length)];
      grid[row][col] = {
        id: `rune_${row}_${col}_${seed}_${row * gridSize + col}`,
        element,
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

const refillGrid = (grid: Rune[][], seed: number, turn: number): Rune[][] => {
  const size = grid.length;
  const newGrid = cloneGrid(grid);

  const random = (() => {
    let s = (seed + turn * 1000) >>> 0;
    return () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 0x100000000;
    };
  })();

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
      const element = elements[Math.floor(random() * elements.length)];
      newGrid[row][col] = {
        id: `rune_${row}_${col}_${seed}_${turn}_${Math.floor(random() * 1000000)}`,
        element,
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

const calculateDamage = (matchLength: number, element: string): number => {
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

export type BattleStateChangeHandler = (state: PVPBattleState) => void;
export type BattleResultHandler = (result: BattleRecord['result'], replayData?: any) => void;

export interface P2PBattleControllerConfig {
  connectionManager: P2PConnectionManager;
  myProfile: ArenaPlayerProfile;
  myLoadout: DefenderLoadout;
  isHost: boolean;
}

export class P2PBattleController {
  private config: P2PBattleControllerConfig;
  private connectionManager: P2PConnectionManager;
  private battleState: PVPBattleState | null = null;
  private battleInit: BattleInitPayload | null = null;
  private timeoutHandler: BattleTimeoutHandler | null = null;
  private localReplayActions: ReplayAction[] = [];
  private isMyTurn: boolean = false;
  private myPlayerId: string = '';
  private peerPlayerId: string = '';
  private turnCount: number = 0;
  private battleSeed: number = 0;

  private stateChangeHandlers: BattleStateChangeHandler[] = [];
  private resultHandlers: BattleResultHandler[] = [];
  private cleanupHandlers: (() => void)[] = [];

  constructor(config: P2PBattleControllerConfig) {
    this.config = config;
    this.connectionManager = config.connectionManager;
    this.myPlayerId = config.myProfile.playerId;
    this.setupConnectionHandlers();
  }

  private setupConnectionHandlers(): void {
    const unsub1 = this.connectionManager.onBattleInit((init) =>
      this.handleBattleInit(init)
    );
    const unsub2 = this.connectionManager.onTurnAction((action, senderId) =>
      this.handleTurnAction(action, senderId)
    );
    const unsub3 = this.connectionManager.onBattleResult((result) =>
      this.handleBattleResult(result)
    );
    const unsub4 = this.connectionManager.onSyncError((error, expected, actual) =>
      this.handleSyncError(error, expected, actual)
    );

    this.cleanupHandlers.push(unsub1, unsub2, unsub3, unsub4);
  }

  private handleBattleInit(init: BattleInitPayload): void {
    this.battleInit = init;
    this.battleSeed = init.initialGridSeed;
    this.peerPlayerId = this.config.isHost ? init.clientPlayerId : init.hostPlayerId;
    this.isMyTurn = this.config.isHost ? init.hostGoesFirst : !init.hostGoesFirst;

    const myLoadout = this.config.isHost ? init.hostLoadout : init.clientLoadout;
    const peerLoadout = this.config.isHost ? init.clientLoadout : init.hostLoadout;

    const myMaxHp = myLoadout.playerMaxHp;
    const peerMaxHp = peerLoadout.playerMaxHp;

    this.battleState = {
      battleId: init.battleId,
      battleCode: init.battleId,
      mode: this.config.isHost ? 'offense' : 'defense',
      isStarted: true,
      isFinished: false,
      turn: 1,
      isPlayerTurn: this.isMyTurn,
      playerHp: myMaxHp,
      playerMaxHp: myMaxHp,
      enemyHp: peerMaxHp,
      enemyMaxHp: peerMaxHp,
      playerEnergy: { ...emptyEnergy },
      enemyEnergy: { ...emptyEnergy },
      maxEnergy: 12,
      gridSize: GRID_SIZE,
      runeGrid: createSeededRuneGrid(GRID_SIZE, this.battleSeed),
      selectedRunes: [],
      playerSpells: getSpellsByIds(myLoadout.selectedSpellIds),
      enemySpells: getSpellsByIds(peerLoadout.selectedSpellIds),
      comboSpellCooldowns: {},
      enemyComboSpellCooldowns: {},
      statusEffects: { player: [], enemy: [] },
      battleStatus: 'playing',
      isAnimating: false,
      floatingTexts: [],
      screenShake: false,
      spellEffect: null,
      comboCount: 0,
      lastActionTime: Date.now(),
      timeoutMs: BATTLE_TIMEOUT_MS,
      defenderAIStyle: peerLoadout.aiStyle,
      isRecordingReplay: true,
      replayActions: [],
      battleStartTime: Date.now(),
    };

    const initialAction: ReplayAction = {
      turn: 0,
      side: this.config.isHost ? 'attacker' : 'defender',
      actionType: 'end_turn',
      timestamp: Date.now(),
      payload: {
        type: 'battle_start',
        opponentName: this.config.isHost
          ? init.clientPlayerId
          : init.hostPlayerId,
      },
      hpAfter: { attacker: myMaxHp, defender: peerMaxHp },
      energyAfter: { ...emptyEnergy },
      description: `PVP对战开始！`,
    };
    this.localReplayActions = [initialAction];

    this.notifyStateChange();
    this.startTimeoutHandler();
  }

  private startTimeoutHandler(): void {
    if (!this.battleState) return;

    this.timeoutHandler = new BattleTimeoutHandler();
    this.timeoutHandler.setBattleState(this.battleState);
    this.timeoutHandler.setCallbacks({
      onTurnTimeout: () => this.handleTurnTimeout(),
      onBattleTimeout: () => this.handleBattleTimeout(),
    });
    this.timeoutHandler.start();
  }

  private handleTurnTimeout(): void {
    if (!this.battleState || this.battleState.isFinished) return;

    if (this.isMyTurn) {
      this.endBattle('timeout', this.peerPlayerId, '我方回合超时');
    } else {
      this.endBattle('timeout', this.myPlayerId, '对方回合超时');
    }
  }

  private handleBattleTimeout(): void {
    if (!this.battleState || this.battleState.isFinished) return;
    this.endBattle('timeout', this.peerPlayerId, '对战总时长超时');
  }

  private handleTurnAction(action: TurnActionPayload, senderId: string): void {
    if (!this.battleState || this.battleState.isFinished) return;

    const isMyAction = senderId === this.myPlayerId;
    const side = isMyAction ? 'attacker' : 'defender';

    this.applyTurnAction(action, side);
    this.localReplayActions.push(action.replayAction);

    this.turnCount = action.turn;
    this.isMyTurn = senderId === this.peerPlayerId;

    const newCooldowns: Record<string, number> = {};
    if (action.actionType === 'end_turn') {
      const cooldowns = isMyAction
        ? this.battleState.comboSpellCooldowns
        : this.battleState.enemyComboSpellCooldowns;
      Object.entries(cooldowns).forEach(([id, cd]) => {
        if (cd > 0) newCooldowns[id] = cd - 1;
      });
    }

    this.battleState = {
      ...this.battleState,
      ...action.stateAfter,
      isPlayerTurn: this.isMyTurn,
      turn: Math.ceil((action.turn + 1) / 2),
      lastActionTime: Date.now(),
      comboSpellCooldowns: isMyAction
        ? { ...this.battleState.comboSpellCooldowns, ...newCooldowns }
        : this.battleState.comboSpellCooldowns,
      enemyComboSpellCooldowns: !isMyAction
        ? { ...this.battleState.enemyComboSpellCooldowns, ...newCooldowns }
        : this.battleState.enemyComboSpellCooldowns,
      replayActions: [...this.localReplayActions],
    };

    this.timeoutHandler?.setBattleState(this.battleState);
    this.notifyStateChange();

    this.checkBattleEnd(action);
  }

  private applyTurnAction(action: TurnActionPayload, side: 'attacker' | 'defender'): void {
    if (!this.battleState) return;

    if (action.actionType === 'match_runes') {
      const { runes, element, matchLength } = action.actionData;
      const newGrid = cloneGrid(this.battleState.runeGrid);

      runes.forEach((r: { row: number; col: number }) => {
        const target = newGrid[r.row]?.[r.col];
        if (target) target.isMatched = true;
      });

      setTimeout(() => {
        if (this.battleState) {
          this.battleState = {
            ...this.battleState,
            runeGrid: refillGrid(newGrid, this.battleSeed, action.turn),
          };
          this.notifyStateChange();
        }
      }, 350);
    }
  }

  private checkBattleEnd(action: TurnActionPayload): void {
    if (!this.battleState) return;

    const { playerHp, enemyHp } = action.stateAfter;
    if (playerHp <= 0) {
      this.endBattle('defender_win', this.peerPlayerId, '我方生命值归零');
    } else if (enemyHp <= 0) {
      this.endBattle('attacker_win', this.myPlayerId, '对方生命值归零');
    }
  }

  private handleBattleResult(result: BattleResultPayload): void {
    if (!this.battleState || this.battleState.isFinished) return;

    this.battleState = {
      ...this.battleState,
      isFinished: true,
      battleStatus: result.winnerId === this.myPlayerId ? 'victory' : 'defeat',
    };

    this.timeoutHandler?.stop();
    this.notifyStateChange();

    const replayData = this.buildReplayData();
    this.resultHandlers.forEach((handler) => handler(result.result, replayData));
  }

  private handleSyncError(error: string, expectedHash?: string, actualHash?: string): void {
    console.error('Sync error:', error, expectedHash, actualHash);

    if (this.connectionManager.getSession()?.isReferee) {
      const currentState = this.buildTurnActionState();
      this.connectionManager.sendStateHash(
        this.turnCount,
        calculateStateHash(this.battleState || {}),
        this.battleState || undefined
      );
    }
  }

  submitPlayerAction(actionType: TurnActionPayload['actionType'], actionData: any): boolean {
    if (!this.battleState || !this.isMyTurn || this.battleState.isFinished) {
      return false;
    }

    const stateAfter = this.buildTurnActionState();

    const replayAction: ReplayAction = {
      turn: this.battleState.turn,
      side: 'attacker',
      actionType,
      timestamp: Date.now(),
      payload: actionData,
      hpAfter: {
        attacker: stateAfter.playerHp,
        defender: stateAfter.enemyHp,
      },
      energyAfter: { ...stateAfter.playerEnergy },
      description: this.buildActionDescription(actionType, actionData),
    };

    const turnAction: Omit<TurnActionPayload, 'turn'> = {
      actionType,
      actionData,
      stateAfter,
      replayAction,
    };

    this.connectionManager.sendTurnAction(turnAction);
    return true;
  }

  private buildTurnActionState(): TurnActionPayload['stateAfter'] {
    if (!this.battleState) {
      return {
        playerHp: 0,
        enemyHp: 0,
        playerEnergy: { ...emptyEnergy },
        enemyEnergy: { ...emptyEnergy },
        gridHash: '',
      };
    }

    return {
      playerHp: this.battleState.playerHp,
      enemyHp: this.battleState.enemyHp,
      playerEnergy: { ...this.battleState.playerEnergy },
      enemyEnergy: { ...this.battleState.enemyEnergy },
      gridHash: calculateStateHash(this.battleState),
    };
  }

  private buildActionDescription(
    actionType: TurnActionPayload['actionType'],
    actionData: any
  ): string {
    switch (actionType) {
      case 'match_runes':
        return `消除${actionData.matchLength}个${actionData.element}符文`;
      case 'cast_spell':
        return `释放${actionData.spellName}`;
      case 'cast_combo_spell':
        return `释放连携技${actionData.spellName}`;
      case 'end_turn':
        return '结束回合';
      default:
        return '未知操作';
    }
  }

  calculateLocalMatch(runes: Rune[]): {
    damage: number;
    energyGain: number;
    element: string;
    matchLength: number;
  } | null {
    if (runes.length < 3) return null;

    const element = runes[0].element;
    const matchLength = runes.length;
    const damage = calculateDamage(matchLength, element);
    const energyGain = calculateEnergyGain(matchLength);

    return { damage, energyGain, element, matchLength };
  }

  applyLocalMatchResult(result: {
    damage: number;
    energyGain: number;
    element: string;
  }): void {
    if (!this.battleState) return;

    const newEnemyHp = Math.max(0, this.battleState.enemyHp - result.damage);
    const newPlayerEnergy = { ...this.battleState.playerEnergy };
    newPlayerEnergy[result.element as keyof EnergyPool] = Math.min(
      this.battleState.maxEnergy,
      newPlayerEnergy[result.element as keyof EnergyPool] + result.energyGain
    );

    this.battleState = {
      ...this.battleState,
      enemyHp: newEnemyHp,
      playerEnergy: newPlayerEnergy,
      comboCount: this.battleState.comboCount + 1,
    };

    this.notifyStateChange();
  }

  applyLocalSpellCast(spell: Spell | ComboSpell, isCombo: boolean = false): void {
    if (!this.battleState) return;

    if (isCombo) {
      const comboSpell = spell as ComboSpell;
      const newPlayerEnergy = { ...this.battleState.playerEnergy };
      for (const [el, cost] of Object.entries(comboSpell.cost)) {
        newPlayerEnergy[el as keyof EnergyPool] -= cost || 0;
      }

      const newEnemyHp = Math.max(0, this.battleState.enemyHp - comboSpell.damage);
      const newCooldowns = { ...this.battleState.comboSpellCooldowns };
      newCooldowns[comboSpell.id] = comboSpell.cooldown;

      this.battleState = {
        ...this.battleState,
        playerEnergy: newPlayerEnergy,
        enemyHp: newEnemyHp,
        comboSpellCooldowns: newCooldowns,
        spellEffect: comboSpell.elements,
      };
    } else {
      const normalSpell = spell as Spell;
      const newPlayerEnergy = { ...this.battleState.playerEnergy };
      newPlayerEnergy[normalSpell.element] -= normalSpell.cost;

      let newEnemyHp = this.battleState.enemyHp;
      let newPlayerHp = this.battleState.playerHp;

      if (normalSpell.damage > 0) {
        newEnemyHp = Math.max(0, newEnemyHp - normalSpell.damage);
      }
      if (normalSpell.heal > 0) {
        newPlayerHp = Math.min(
          this.battleState.playerMaxHp,
          newPlayerHp + normalSpell.heal
        );
      }

      this.battleState = {
        ...this.battleState,
        playerEnergy: newPlayerEnergy,
        enemyHp: newEnemyHp,
        playerHp: newPlayerHp,
        spellEffect: normalSpell.element,
      };
    }

    setTimeout(() => {
      if (this.battleState) {
        this.battleState = { ...this.battleState, spellEffect: null };
        this.notifyStateChange();
      }
    }, 600);

    this.notifyStateChange();
  }

  endLocalTurn(): void {
    if (!this.battleState || !this.isMyTurn) return;

    const actionData = { type: 'player_end' };
    this.submitPlayerAction('end_turn', actionData);
  }

  private endBattle(
    result: BattleRecord['result'],
    winnerId: string,
    reason: string
  ): void {
    if (!this.battleState || this.battleState.isFinished) return;

    const battleResult: BattleResultPayload = {
      result,
      winnerId,
      reason,
      finalStateHash: calculateStateHash(this.battleState),
    };

    if (this.connectionManager.getSession()?.isReferee) {
      this.connectionManager.sendBattleResult(battleResult);
    }

    this.battleState = {
      ...this.battleState,
      isFinished: true,
      battleStatus: winnerId === this.myPlayerId ? 'victory' : 'defeat',
    };

    this.timeoutHandler?.stop();
    this.notifyStateChange();

    const replayData = this.buildReplayData();
    this.resultHandlers.forEach((handler) => handler(result, replayData));
  }

  private buildReplayData(): any {
    if (!this.battleState || !this.battleInit) return null;

    return {
      battleId: this.battleState.battleId,
      defenderLoadoutSnapshot: this.config.isHost
        ? this.battleInit.clientLoadout
        : this.battleInit.hostLoadout,
      attackerSpells: this.battleState.playerSpells.map((s) => s.id),
      initialState: {
        attackerHp: this.battleState.playerMaxHp,
        defenderHp: this.battleState.enemyMaxHp,
        attackerMaxHp: this.battleState.playerMaxHp,
        defenderMaxHp: this.battleState.enemyMaxHp,
      },
      actions: this.localReplayActions,
      finalState: {
        attackerHp: this.battleState.playerHp,
        defenderHp: this.battleState.enemyHp,
        result: this.battleState.battleStatus === 'victory' ? 'attacker_win' : 'defender_win',
      },
      recordedAt: Date.now(),
      isP2P: true,
      hostPlayerId: this.battleInit.hostPlayerId,
      clientPlayerId: this.battleInit.clientPlayerId,
    };
  }

  getBattleState(): PVPBattleState | null {
    return this.battleState ? { ...this.battleState } : null;
  }

  getSession(): P2PSession | null {
    return this.connectionManager.getSession();
  }

  isMyTurnToPlay(): boolean {
    return this.isMyTurn && !!this.battleState && !this.battleState.isFinished;
  }

  getPeerProfile(): any {
    return this.connectionManager.getSession()?.peerProfile;
  }

  onStateChange(handler: BattleStateChangeHandler): () => void {
    this.stateChangeHandlers.push(handler);
    return () => {
      this.stateChangeHandlers = this.stateChangeHandlers.filter((h) => h !== handler);
    };
  }

  onBattleResult(handler: BattleResultHandler): () => void {
    this.resultHandlers.push(handler);
    return () => {
      this.resultHandlers = this.resultHandlers.filter((h) => h !== handler);
    };
  }

  private notifyStateChange(): void {
    if (this.battleState) {
      this.stateChangeHandlers.forEach((handler) => handler({ ...this.battleState! }));
    }
  }

  destroy(): void {
    this.timeoutHandler?.stop();
    this.cleanupHandlers.forEach((fn) => fn());
    this.cleanupHandlers = [];
    this.stateChangeHandlers = [];
    this.resultHandlers = [];
    this.connectionManager.destroy();
    this.battleState = null;
  }
}
