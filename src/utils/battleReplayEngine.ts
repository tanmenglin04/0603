import type {
  BattleReplayV2,
  BattleEvent,
  ReplayStateSnapshot,
  ReplayPlaybackState,
  ReplayNavigationTarget,
  RuneCoord,
  EnergyPool,
  BattleEventType,
  MatchRunesPayload,
  ChainComboPayload,
  CastSpellPayload,
  CastComboSpellPayload,
  EnemyBehaviorPayload,
  HpChangePayload,
  EnergyChangePayload,
  HighlightMoment,
} from '../types';
import { BattleEventType as EventType } from '../types';

interface ReplayEngineState {
  playerHp: number;
  playerMaxHp: number;
  enemyHp: number;
  enemyMaxHp: number;
  energy: EnergyPool;
  currentTurn: number;
  eventIndex: number;
  currentEvent: BattleEvent | null;
  highlightedCells: RuneCoord[];
  currentHighlight: HighlightMoment | null;
  visibleEvents: BattleEvent[];
}

type StateChangeListener = (state: ReplayPlaybackState) => void;
type HighlightListener = (highlight: HighlightMoment | null) => void;
type EventProcessedListener = (event: BattleEvent, state: ReplayEngineState) => void;

export class BattleReplayEngine {
  private replay: BattleReplayV2;
  private state: ReplayEngineState;
  private initialState: ReplayEngineState;
  private playbackSpeed: 1 | 2 | 4 = 1;
  private isPlaying = false;
  private playIntervalId: number | null = null;
  private baseEventIntervalMs = 1200;

  private stateChangeListeners: StateChangeListener[] = [];
  private highlightListeners: HighlightListener[] = [];
  private eventProcessedListeners: EventProcessedListener[] = [];

  constructor(replay: BattleReplayV2) {
    this.replay = replay;
    this.initialState = this.buildInitialState();
    this.state = { ...this.initialState, visibleEvents: [] };
    this.jumpToStart();
  }

  private buildInitialState(): ReplayEngineState {
    return {
      playerHp: this.replay.initialState.playerHp,
      playerMaxHp: this.replay.initialState.playerMaxHp,
      enemyHp: this.replay.initialState.enemyHp,
      enemyMaxHp: this.replay.initialState.enemyMaxHp,
      energy: { ...this.replay.initialState.energy },
      currentTurn: 1,
      eventIndex: -1,
      currentEvent: null,
      highlightedCells: [],
      currentHighlight: null,
      visibleEvents: [],
    };
  }

  private getSnapshotForEventIndex(targetIndex: number): ReplayStateSnapshot | null {
    let best: ReplayStateSnapshot | null = null;
    for (const snap of this.replay.snapshots) {
      if (snap.eventIndex <= targetIndex) {
        best = snap;
      } else {
        break;
      }
    }
    return best;
  }

  private applySnapshot(snapshot: ReplayStateSnapshot): void {
    this.state.playerHp = snapshot.playerHp;
    this.state.playerMaxHp = snapshot.playerMaxHp;
    this.state.enemyHp = snapshot.enemyHp;
    this.state.enemyMaxHp = snapshot.enemyMaxHp;
    this.state.energy = { ...snapshot.energy };
    this.state.currentTurn = snapshot.turn;
    this.state.eventIndex = snapshot.eventIndex;
  }

  private processEvent(event: BattleEvent): void {
    const { type, payload } = event;

    this.state.currentEvent = event;
    this.state.currentTurn = event.turn;

    switch (type) {
      case EventType.MATCH_RUNES: {
        const p = payload as MatchRunesPayload;
        this.state.highlightedCells = p.path;
        if (p.energyGained) {
          (Object.keys(p.energyGained) as Array<keyof EnergyPool>).forEach((k) => {
            this.state.energy[k] = Math.min(
              this.replay.initialState.gridSize * 2,
              this.state.energy[k] + (p.energyGained[k] || 0)
            );
          });
        }
        break;
      }
      case EventType.CHAIN_COMBO: {
        const p = payload as ChainComboPayload;
        const allCells: RuneCoord[] = [];
        p.matchPaths.forEach((path) => allCells.push(...path));
        this.state.highlightedCells = allCells;
        if (p.totalEnergyGained) {
          (Object.keys(p.totalEnergyGained) as Array<keyof EnergyPool>).forEach((k) => {
            this.state.energy[k] = Math.min(
              this.replay.initialState.gridSize * 2,
              this.state.energy[k] + (p.totalEnergyGained[k] || 0)
            );
          });
        }
        break;
      }
      case EventType.CAST_SPELL: {
        const p = payload as CastSpellPayload;
        this.state.highlightedCells = [];
        if (p.targetKilled && p.damageDealt > 0) {
          this.state.enemyHp = 0;
        } else if (p.damageDealt > 0) {
          this.state.enemyHp = Math.max(0, this.state.enemyHp - p.damageDealt);
        }
        if (p.healAmount > 0) {
          this.state.playerHp = Math.min(
            this.state.playerMaxHp,
            this.state.playerHp + p.healAmount
          );
        }
        break;
      }
      case EventType.CAST_COMBO_SPELL: {
        const p = payload as CastComboSpellPayload;
        this.state.highlightedCells = [];
        if (p.targetKilled && p.damageDealt > 0) {
          this.state.enemyHp = 0;
        } else if (p.damageDealt > 0) {
          this.state.enemyHp = Math.max(0, this.state.enemyHp - p.damageDealt);
        }
        break;
      }
      case EventType.ENEMY_BEHAVIOR: {
        const p = payload as EnemyBehaviorPayload;
        if (p.damageToPlayer > 0) {
          this.state.playerHp = Math.max(0, this.state.playerHp - p.damageToPlayer);
        }
        break;
      }
      case EventType.PLAYER_HP_CHANGE: {
        const p = payload as HpChangePayload;
        this.state.playerHp = p.newHp;
        break;
      }
      case EventType.ENEMY_HP_CHANGE: {
        const p = payload as HpChangePayload;
        this.state.enemyHp = p.newHp;
        break;
      }
      case EventType.ENERGY_CHANGE: {
        const p = payload as EnergyChangePayload;
        this.state.energy = { ...p.newEnergy };
        break;
      }
      case EventType.TURN_START: {
        break;
      }
      default:
        break;
    }

    this.updateCurrentHighlight();
    this.eventProcessedListeners.forEach((fn) => fn(event, { ...this.state }));
  }

  private updateCurrentHighlight(): void {
    const idx = this.state.eventIndex;
    const highlight = this.replay.highlights.find(
      (h) => idx >= h.startEventIndex && idx <= h.endEventIndex
    );
    if (highlight !== this.state.currentHighlight) {
      this.state.currentHighlight = highlight || null;
      this.highlightListeners.forEach((fn) => fn(highlight || null));
    }
  }

  private rebuildStateToIndex(targetIndex: number): void {
    if (targetIndex < 0) {
      Object.assign(this.state, this.buildInitialState());
      this.state.eventIndex = -1;
      this.state.currentEvent = null;
      this.state.highlightedCells = [];
      this.state.currentHighlight = null;
      this.state.visibleEvents = [];
      return;
    }

    const maxIdx = this.replay.events.length - 1;
    const clamped = Math.max(0, Math.min(targetIndex, maxIdx));

    const snapshot = this.getSnapshotForEventIndex(clamped);
    Object.assign(this.state, this.buildInitialState());

    if (snapshot) {
      this.applySnapshot(snapshot);
    }

    const startFrom = snapshot ? snapshot.eventIndex + 1 : 0;
    const visible: BattleEvent[] = [];

    for (let i = startFrom; i <= clamped; i++) {
      const evt = this.replay.events[i];
      this.state.eventIndex = i;
      this.processEvent(evt);
      if (
        i === clamped ||
        [
          EventType.MATCH_RUNES,
          EventType.CAST_SPELL,
          EventType.CAST_COMBO_SPELL,
          EventType.ENEMY_BEHAVIOR,
          EventType.CHAIN_COMBO,
          EventType.TURN_START,
        ].includes(evt.type)
      ) {
        visible.push(evt);
      }
    }

    this.state.visibleEvents = visible.slice(-20);
  }

  private findTurnEventIndex(turn: number): number {
    const idx = this.replay.events.findIndex(
      (e) => e.type === EventType.TURN_START && e.turn >= turn
    );
    if (idx >= 0) return idx - 1;
    return this.replay.events.length - 1;
  }

  private findHighlightEventIndex(highlightId: string): number {
    const h = this.replay.highlights.find((x) => x.id === highlightId);
    return h ? h.startEventIndex : 0;
  }

  navigate(target: ReplayNavigationTarget): void {
    let targetIdx = this.state.eventIndex;

    switch (target.type) {
      case 'event':
        targetIdx = target.eventIndex;
        break;
      case 'turn':
        targetIdx = this.findTurnEventIndex(target.turn);
        break;
      case 'highlight':
        targetIdx = this.findHighlightEventIndex(target.highlightId);
        break;
      case 'start':
        targetIdx = -1;
        break;
      case 'end':
        targetIdx = this.replay.events.length - 1;
        break;
      case 'next_turn': {
        const currentTurn = this.state.currentTurn;
        const nextTurnIdx = this.replay.events.findIndex(
          (e) => e.type === EventType.TURN_START && e.turn > currentTurn
        );
        targetIdx = nextTurnIdx >= 0 ? nextTurnIdx - 1 : this.replay.events.length - 1;
        break;
      }
      case 'prev_turn': {
        const currentTurn = Math.max(1, this.state.currentTurn - 1);
        targetIdx = this.findTurnEventIndex(currentTurn);
        break;
      }
      case 'next_highlight': {
        const idx = this.replay.highlights.findIndex(
          (h) => h.startEventIndex > this.state.eventIndex
        );
        targetIdx = idx >= 0 ? this.replay.highlights[idx].startEventIndex : this.state.eventIndex;
        break;
      }
      case 'prev_highlight': {
        const candidates = this.replay.highlights.filter(
          (h) => h.endEventIndex < this.state.eventIndex
        );
        if (candidates.length > 0) {
          targetIdx = candidates[candidates.length - 1].startEventIndex;
        }
        break;
      }
    }

    this.rebuildStateToIndex(targetIdx);
    this.emitStateChange();
  }

  stepForward(): void {
    if (this.state.eventIndex >= this.replay.events.length - 1) {
      this.pause();
      return;
    }
    this.rebuildStateToIndex(this.state.eventIndex + 1);
    this.emitStateChange();
  }

  stepBackward(): void {
    if (this.state.eventIndex <= 0) {
      this.rebuildStateToIndex(-1);
      this.emitStateChange();
      return;
    }
    this.rebuildStateToIndex(this.state.eventIndex - 1);
    this.emitStateChange();
  }

  play(): void {
    if (this.isPlaying) return;
    if (this.state.eventIndex >= this.replay.events.length - 1) {
      this.jumpToStart();
    }
    this.isPlaying = true;
    this.scheduleNextTick();
    this.emitStateChange();
  }

  pause(): void {
    this.isPlaying = false;
    this.clearTick();
    this.emitStateChange();
  }

  togglePlay(): void {
    if (this.isPlaying) this.pause();
    else this.play();
  }

  setSpeed(speed: 1 | 2 | 4): void {
    this.playbackSpeed = speed;
    if (this.isPlaying) {
      this.clearTick();
      this.scheduleNextTick();
    }
    this.emitStateChange();
  }

  getSpeed(): 1 | 2 | 4 {
    return this.playbackSpeed;
  }

  jumpToStart(): void {
    this.navigate({ type: 'start' });
  }

  jumpToEnd(): void {
    this.navigate({ type: 'end' });
  }

  jumpToNextTurn(): void {
    this.navigate({ type: 'next_turn' });
  }

  jumpToPrevTurn(): void {
    this.navigate({ type: 'prev_turn' });
  }

  jumpToNextHighlight(): void {
    this.navigate({ type: 'next_highlight' });
  }

  jumpToPrevHighlight(): void {
    this.navigate({ type: 'prev_highlight' });
  }

  setEventProgress(progress: number): void {
    const p = Math.max(0, Math.min(1, progress));
    const idx = Math.floor(p * (this.replay.events.length - 1));
    this.navigate({ type: 'event', eventIndex: idx });
  }

  getProgress(): number {
    if (this.replay.events.length <= 1) return 0;
    return this.state.eventIndex / (this.replay.events.length - 1);
  }

  getPlaybackState(): ReplayPlaybackState {
    return {
      currentEventIndex: this.state.eventIndex,
      currentTurn: this.state.currentTurn,
      isPlaying: this.isPlaying,
      playbackSpeed: this.playbackSpeed,
      isPaused: !this.isPlaying,
      playerHp: this.state.playerHp,
      enemyHp: this.state.enemyHp,
      energy: { ...this.state.energy },
      highlightedCells: [...this.state.highlightedCells],
      currentHighlight: this.state.currentHighlight,
      visibleEvents: [...this.state.visibleEvents],
    };
  }

  getReplay(): BattleReplayV2 {
    return this.replay;
  }

  getHighlights(): HighlightMoment[] {
    return this.replay.highlights;
  }

  getCurrentEvent(): BattleEvent | null {
    return this.state.currentEvent;
  }

  getTotalEvents(): number {
    return this.replay.events.length;
  }

  getTotalTurns(): number {
    return this.replay.totalTurns;
  }

  getTurnEventIndices(): Map<number, number> {
    const map = new Map<number, number>();
    this.replay.events.forEach((e, i) => {
      if (e.type === EventType.TURN_START && !map.has(e.turn)) {
        map.set(e.turn, i);
      }
    });
    return map;
  }

  onStateChange(listener: StateChangeListener): () => void {
    this.stateChangeListeners.push(listener);
    return () => {
      this.stateChangeListeners = this.stateChangeListeners.filter((l) => l !== listener);
    };
  }

  onHighlight(listener: HighlightListener): () => void {
    this.highlightListeners.push(listener);
    return () => {
      this.highlightListeners = this.highlightListeners.filter((l) => l !== listener);
    };
  }

  onEventProcessed(listener: EventProcessedListener): () => void {
    this.eventProcessedListeners.push(listener);
    return () => {
      this.eventProcessedListeners = this.eventProcessedListeners.filter((l) => l !== listener);
    };
  }

  dispose(): void {
    this.clearTick();
    this.stateChangeListeners = [];
    this.highlightListeners = [];
    this.eventProcessedListeners = [];
  }

  private clearTick(): void {
    if (this.playIntervalId !== null) {
      clearTimeout(this.playIntervalId);
      this.playIntervalId = null;
    }
  }

  private scheduleNextTick(): void {
    if (!this.isPlaying) return;
    const interval = this.baseEventIntervalMs / this.playbackSpeed;
    this.playIntervalId = window.setTimeout(() => {
      if (!this.isPlaying) return;
      if (this.state.eventIndex >= this.replay.events.length - 1) {
        this.pause();
        return;
      }
      this.stepForward();
      this.scheduleNextTick();
    }, interval);
  }

  private emitStateChange(): void {
    const state = this.getPlaybackState();
    this.stateChangeListeners.forEach((fn) => {
      try {
        fn(state);
      } catch {}
    });
  }
}

export const createReplayEngine = (replay: BattleReplayV2): BattleReplayEngine => {
  return new BattleReplayEngine(replay);
};
