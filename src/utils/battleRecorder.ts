import type {
  BattleEvent,
  BattleEventType,
  BattleEventPayload,
  MatchRunesPayload,
  CastSpellPayload,
  CastComboSpellPayload,
  EnemyBehaviorPayload,
  HpChangePayload,
  EnergyChangePayload,
  ChainComboPayload,
  StatusEffectPayload,
  MinionEventPayload,
  TerrainEffectPayload,
  BattleEndPayload,
  RuneCoord,
  Rune,
  EnergyPool,
  Enemy,
  Spell,
  ComboSpell,
  EnemyBehaviorType,
  StatusEffectType,
  TerrainType,
  BattleReplayV2,
  ReplayStateSnapshot,
  Minion,
  Level,
} from '../types';
import { generateId } from './gameLogic';

const SNAPSHOT_INTERVAL = 15;

export class BattleRecorder {
  private events: BattleEvent[] = [];
  private eventIndex = 0;
  private snapshots: ReplayStateSnapshot[] = [];
  private hpTimeline: { player: number[]; enemy: number[]; turnMarkers: number[] } = {
    player: [],
    enemy: [],
    turnMarkers: [],
  };
  private battleId: string;
  private levelId: number;
  private levelName: string;
  private enemyName: string;
  private enemySprite: string;
  private startedAt: number;
  private currentTurn = 1;
  private playerHp = 0;
  private playerMaxHp = 0;
  private enemyHp = 0;
  private enemyMaxHp = 0;
  private energy: EnergyPool = { fire: 0, water: 0, grass: 0, thunder: 0 };
  private gridSize = 6;
  private lastPlayerHp: number | null = null;
  private lastEnemyHp: number | null = null;
  private isRecording = false;

  private stats = {
    totalDamageDealt: 0,
    totalDamageTaken: 0,
    totalRunesMatched: 0,
    totalSpellsCast: 0,
    totalComboSpellsCast: 0,
    maxComboReached: 0,
    totalChainCombos: 0,
    criticalHits: 0,
  };

  constructor(level: Level, enemy: Enemy) {
    this.battleId = `battle_${Date.now()}_${generateId()}`;
    this.levelId = level.id;
    this.levelName = level.name;
    this.enemyName = enemy.name;
    this.enemySprite = enemy.sprite;
    this.startedAt = Date.now();
    this.playerHp = level.playerMaxHp;
    this.playerMaxHp = level.playerMaxHp;
    this.enemyHp = enemy.maxHp;
    this.enemyMaxHp = enemy.maxHp;
    this.gridSize = this.gridSize;
    this.lastPlayerHp = level.playerMaxHp;
    this.lastEnemyHp = enemy.maxHp;
  }

  start(): void {
    this.isRecording = true;
    this.takeSnapshot(0);
    this.recordEvent(BattleEventType.BATTLE_START, true, {
      message: '战斗开始!',
    });
    this.hpTimeline.player.push(this.playerHp);
    this.hpTimeline.enemy.push(this.enemyHp);
    this.hpTimeline.turnMarkers.push(this.events.length - 1);
  }

  stop(result: 'victory' | 'defeat'): BattleReplayV2 {
    this.isRecording = false;
    const endedAt = Date.now();
    const durationMs = endedAt - this.startedAt;

    this.recordEvent(BattleEventType.BATTLE_END, true, {
      result,
      totalTurns: this.currentTurn,
      totalDamageDealt: this.stats.totalDamageDealt,
      totalDamageTaken: this.stats.totalDamageTaken,
      totalRunesMatched: this.stats.totalRunesMatched,
      totalSpellsCast: this.stats.totalSpellsCast,
      maxComboReached: this.stats.maxComboReached,
    } as BattleEndPayload);

    return {
      replayVersion: 'v2',
      battleId: this.battleId,
      levelId: this.levelId,
      levelName: this.levelName,
      enemyName: this.enemyName,
      enemySprite: this.enemySprite,
      startedAt: this.startedAt,
      endedAt,
      durationMs,
      result,
      totalTurns: this.currentTurn,
      initialState: {
        playerHp: this.playerMaxHp,
        playerMaxHp: this.playerMaxHp,
        enemyHp: this.enemyMaxHp,
        enemyMaxHp: this.enemyMaxHp,
        energy: { fire: 0, water: 0, grass: 0, thunder: 0 },
        gridSize: this.gridSize,
      },
      events: this.events,
      snapshots: this.snapshots,
      highlights: [],
      hpTimeline: this.hpTimeline,
      stats: { ...this.stats },
    };
  }

  setTurn(turn: number): void {
    this.currentTurn = turn;
  }

  setPlayerHp(hp: number, reason = ''): void {
    const oldHp = this.playerHp;
    const delta = hp - oldHp;
    this.playerHp = Math.max(0, Math.min(this.playerMaxHp, hp));

    if (delta !== 0) {
      if (delta < 0) {
        this.stats.totalDamageTaken += Math.abs(delta);
      }
      this.recordEvent(BattleEventType.PLAYER_HP_CHANGE, true, {
        unitType: 'player',
        unitId: null,
        unitName: '玩家',
        oldHp,
        newHp: this.playerHp,
        maxHp: this.playerMaxHp,
        delta,
        reason,
      } as HpChangePayload);
    }

    this.hpTimeline.player.push(this.playerHp);
    this.lastPlayerHp = this.playerHp;
    this.maybeTakeSnapshot();
  }

  setEnemyHp(hp: number, enemy: Enemy, reason = ''): void {
    const oldHp = this.enemyHp;
    const delta = hp - oldHp;
    this.enemyHp = Math.max(0, Math.min(this.enemyMaxHp, hp));

    if (delta !== 0) {
      if (delta < 0) {
        this.stats.totalDamageDealt += Math.abs(delta);
      }
      this.recordEvent(BattleEventType.ENEMY_HP_CHANGE, false, {
        unitType: 'enemy',
        unitId: enemy.id,
        unitName: enemy.name,
        oldHp,
        newHp: this.enemyHp,
        maxHp: this.enemyMaxHp,
        delta,
        reason,
      } as HpChangePayload);
    }

    this.hpTimeline.enemy.push(this.enemyHp);
    this.lastEnemyHp = this.enemyHp;
    this.maybeTakeSnapshot();
  }

  setEnergy(newEnergy: EnergyPool, reason = ''): void {
    const delta: Partial<EnergyPool> = {};
    (['fire', 'water', 'grass', 'thunder'] as const).forEach((el) => {
      const d = newEnergy[el] - this.energy[el];
      if (d !== 0) delta[el] = d;
    });

    if (Object.keys(delta).length > 0) {
      this.recordEvent(BattleEventType.ENERGY_CHANGE, true, {
        oldEnergy: { ...this.energy },
        newEnergy: { ...newEnergy },
        delta,
        reason,
      } as EnergyChangePayload);
    }

    this.energy = { ...newEnergy };
    this.maybeTakeSnapshot();
  }

  recordMatchRunes(selectedRunes: Rune[], energyGained: Partial<EnergyPool>, damageDealt?: number): void {
    if (!selectedRunes.length) return;

    const element = selectedRunes[0].element;
    const path: RuneCoord[] = selectedRunes.map((r) => ({ row: r.row, col: r.col }));
    const doubleEnergyInSelection = selectedRunes.some((r) => r.tileType === 'double_energy');

    this.stats.totalRunesMatched += selectedRunes.length;

    this.recordEvent(BattleEventType.MATCH_RUNES, true, {
      element,
      path,
      matchCount: selectedRunes.length,
      energyGained,
      damageDealt,
      isDoubleEnergy: doubleEnergyInSelection,
    } as MatchRunesPayload);

    this.maybeTakeSnapshot();
  }

  recordChainCombo(
    comboLevel: number,
    totalChainCount: number,
    matchedElements: Record<string, number>,
    totalEnergyGained: Partial<EnergyPool>,
    matchPaths: RuneCoord[][]
  ): void {
    this.stats.totalChainCombos += 1;
    if (comboLevel > this.stats.maxComboReached) {
      this.stats.maxComboReached = comboLevel;
    }

    const totalMatched = Object.values(matchedElements).reduce((a, b) => a + b, 0);
    this.stats.totalRunesMatched += totalMatched;

    this.recordEvent(BattleEventType.CHAIN_COMBO, true, {
      comboLevel,
      totalChainCount,
      matchedElements: matchedElements as Record<'fire' | 'water' | 'grass' | 'thunder', number>,
      totalEnergyGained,
      matchPaths,
    } as ChainComboPayload);

    this.maybeTakeSnapshot();
  }

  recordCastSpell(
    spell: Spell,
    target: { id: string | null; name: string | null },
    damageDealt: number,
    healAmount: number,
    isEffective: boolean,
    isWeak: boolean,
    targetKilled: boolean,
    isCritical = false
  ): void {
    this.stats.totalSpellsCast += 1;
    if (isCritical) this.stats.criticalHits += 1;

    this.recordEvent(BattleEventType.CAST_SPELL, true, {
      spellId: spell.id,
      spellName: spell.name,
      element: spell.element,
      targetUnitId: target.id,
      targetUnitName: target.name,
      damageDealt,
      healAmount,
      isEffective,
      isWeak,
      isCritical,
      targetKilled,
    } as CastSpellPayload);

    this.maybeTakeSnapshot();
  }

  recordCastComboSpell(
    spell: ComboSpell,
    target: { id: string | null; name: string | null },
    damageDealt: number,
    targetKilled: boolean
  ): void {
    this.stats.totalComboSpellsCast += 1;

    this.recordEvent(BattleEventType.CAST_COMBO_SPELL, true, {
      spellId: spell.id,
      spellName: spell.name,
      elements: spell.elements,
      targetUnitId: target.id,
      targetUnitName: target.name,
      damageDealt,
      effectApplied: spell.effect,
      effectValue: spell.effectValue,
      effectDuration: spell.effectDuration,
      targetKilled,
    } as CastComboSpellPayload);

    this.maybeTakeSnapshot();
  }

  recordEnemyBehavior(
    turn: number,
    behaviorType: EnemyBehaviorType,
    behaviorDescription: string,
    damageToPlayer: number,
    isBerserk: boolean,
    isDefending: boolean,
    chargeSkillName?: string,
    chargeDamage?: number,
    summonedMinionName?: string
  ): void {
    this.recordEvent(BattleEventType.ENEMY_BEHAVIOR, false, {
      turn,
      behaviorType,
      behaviorDescription,
      damageToPlayer,
      isBerserk,
      isDefending,
      chargeSkillName,
      chargeDamage,
      summonedMinionName,
    } as EnemyBehaviorPayload);

    this.maybeTakeSnapshot();
  }

  recordTurnStart(turn: number): void {
    this.currentTurn = turn;
    this.recordEvent(BattleEventType.TURN_START, true, { turn });
    this.hpTimeline.turnMarkers.push(this.events.length - 1);
    this.maybeTakeSnapshot();
  }

  recordTurnEnd(turn: number): void {
    this.recordEvent(BattleEventType.TURN_END, true, { turn });
    this.maybeTakeSnapshot();
  }

  recordStatusEffect(
    targetType: 'player' | 'enemy',
    effectType: StatusEffectType,
    effectName: string,
    duration: number,
    value: number,
    damagePerTurn?: number
  ): void {
    this.recordEvent(BattleEventType.STATUS_EFFECT, targetType === 'player', {
      targetType,
      effectType,
      effectName,
      duration,
      value,
      damagePerTurn,
    } as StatusEffectPayload);

    this.maybeTakeSnapshot();
  }

  recordMinionSummoned(minion: Minion): void {
    this.recordEvent(BattleEventType.MINION_SUMMONED, false, {
      minionId: minion.id,
      minionName: minion.name,
      minionSprite: minion.sprite,
      maxHp: minion.maxHp,
      attack: minion.attack,
      explosionDamage: minion.explosionDamage,
    } as MinionEventPayload);

    this.maybeTakeSnapshot();
  }

  recordMinionKilled(minion: Minion): void {
    this.recordEvent(BattleEventType.MINION_KILLED, false, {
      minionId: minion.id,
      minionName: minion.name,
      minionSprite: minion.sprite,
      maxHp: minion.maxHp,
    } as MinionEventPayload);

    this.maybeTakeSnapshot();
  }

  recordTerrainEffect(
    terrainType: TerrainType,
    effectDescription: string,
    affectedRuneCount?: number,
    damageToPlayer?: number
  ): void {
    this.recordEvent(BattleEventType.TERRAIN_EFFECT, true, {
      terrainType,
      effectDescription,
      affectedRuneCount,
      damageToPlayer,
    } as TerrainEffectPayload);

    this.maybeTakeSnapshot();
  }

  getBattleId(): string {
    return this.battleId;
  }

  getCurrentTurn(): number {
    return this.currentTurn;
  }

  getPlayerHp(): number {
    return this.playerHp;
  }

  getEnemyHp(): number {
    return this.enemyHp;
  }

  getEnergy(): EnergyPool {
    return { ...this.energy };
  }

  isActive(): boolean {
    return this.isRecording;
  }

  private recordEvent(
    type: BattleEventType,
    isPlayerSide: boolean,
    payload: BattleEventPayload
  ): void {
    if (!this.isRecording) return;

    const event: BattleEvent = {
      id: generateId(),
      type,
      timestamp: Date.now(),
      turn: this.currentTurn,
      isPlayerSide,
      payload,
      eventIndex: this.eventIndex++,
    };

    this.events.push(event);
  }

  private maybeTakeSnapshot(): void {
    if (this.events.length % SNAPSHOT_INTERVAL === 0) {
      this.takeSnapshot(this.events.length - 1);
    }
  }

  private takeSnapshot(eventIndex: number): void {
    const snapshot: ReplayStateSnapshot = {
      snapshotIndex: this.snapshots.length,
      eventIndex: Math.max(0, eventIndex),
      turn: this.currentTurn,
      playerHp: this.playerHp,
      playerMaxHp: this.playerMaxHp,
      enemyHp: this.enemyHp,
      enemyMaxHp: this.enemyMaxHp,
      energy: { ...this.energy },
      gridSize: this.gridSize,
    };
    this.snapshots.push(snapshot);
  }
}

export const encodeCompressedReplay = (replay: BattleReplayV2): string => {
  try {
    return JSON.stringify(replay);
  } catch {
    return '';
  }
};

export const decodeCompressedReplay = (encoded: string): BattleReplayV2 | null => {
  try {
    const parsed = JSON.parse(encoded);
    if (parsed.replayVersion !== 'v2') return null;
    return parsed as BattleReplayV2;
  } catch {
    return null;
  }
};

export const estimateReplaySize = (replay: BattleReplayV2): number => {
  try {
    return new Blob([JSON.stringify(replay)]).size;
  } catch {
    return 0;
  }
};
