import type {
  P2PSession,
  P2PMessage,
  HandshakeRequestPayload,
  HandshakeResponsePayload,
  BattleInitPayload,
  TurnActionPayload,
  TurnAckPayload,
  ReconnectRequestPayload,
  ReconnectResponsePayload,
  BattleResultPayload,
  DisconnectPayload,
  StateHashPayload,
  DefenderLoadout,
  ArenaPlayerProfile,
  PVPBattleState,
  P2PConnectionState,
  P2P_PROTOCOL_VERSION,
  P2P_DISCONNECT_TIMEOUT_MS,
  P2P_PING_INTERVAL_MS,
  P2P_MAX_RECONNECT_ATTEMPTS,
} from '../types';
import {
  P2P_PROTOCOL_VERSION as PROTOCOL_VERSION,
  P2P_DISCONNECT_TIMEOUT_MS as DISCONNECT_TIMEOUT,
  P2P_PING_INTERVAL_MS as PING_INTERVAL,
  P2P_MAX_RECONNECT_ATTEMPTS as MAX_RECONNECT,
} from '../types';
import type { P2PTransport } from './p2pTransport';
import { createP2PTransport } from './p2pTransport';
import { generateId } from './battleCode';

const generateSessionId = (): string => {
  return `sess_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 9)}`;
};

const generateRefereeSeed = (): number => {
  return Math.floor(Math.random() * 0xffffffff);
};

const seededRandom = (seed: number): (() => number) => {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
};

export const calculateStateHash = (state: Partial<PVPBattleState>): string => {
  const relevantState = {
    turn: state.turn,
    playerHp: state.playerHp,
    enemyHp: state.enemyHp,
    playerEnergy: state.playerEnergy,
    enemyEnergy: state.enemyEnergy,
    comboCount: state.comboCount,
    comboSpellCooldowns: state.comboSpellCooldowns,
    enemyComboSpellCooldowns: state.enemyComboSpellCooldowns,
    isPlayerTurn: state.isPlayerTurn,
  };
  const str = JSON.stringify(relevantState);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36).toUpperCase();
};

export type SessionStateHandler = (session: P2PSession) => void;
export type BattleInitHandler = (init: BattleInitPayload) => void;
export type TurnActionHandler = (action: TurnActionPayload, senderId: string) => void;
export type BattleResultHandler = (result: BattleResultPayload) => void;
export type SyncErrorHandler = (error: string, expectedHash?: string, actualHash?: string) => void;

export interface P2PConnectionManagerConfig {
  transportType?: 'local' | 'websocket' | 'webrtc';
  transportConfig?: any;
  playerProfile: ArenaPlayerProfile;
  playerLoadout: DefenderLoadout;
}

export class P2PConnectionManager {
  private config: P2PConnectionManagerConfig;
  private transport: P2PTransport;
  private session: P2PSession | null = null;
  private actionHistory: TurnActionPayload[] = [];
  private lastAcknowledgedTurn: number = 0;
  private pendingActions: Map<number, { timeout: number }> = new Map();
  private pingInterval: number | null = null;
  private disconnectTimer: number | null = null;
  private reconnectAttempts: number = 0;
  private lastStateHash: string = '';

  private sessionHandlers: SessionStateHandler[] = [];
  private battleInitHandlers: BattleInitHandler[] = [];
  private turnActionHandlers: TurnActionHandler[] = [];
  private battleResultHandlers: BattleResultHandler[] = [];
  private syncErrorHandlers: SyncErrorHandler[] = [];

  constructor(config: P2PConnectionManagerConfig) {
    this.config = config;
    this.transport = createP2PTransport(config.transportType || 'local', config.transportConfig);
    this.setupTransportHandlers();
  }

  private setupTransportHandlers(): void {
    this.transport.onMessage((message) => this.handleMessage(message));
    this.transport.onConnectionState((state) => {
      if (state === 'connected') {
        this.startPingLoop();
      } else if (state === 'disconnected' || state === 'error') {
        this.stopPingLoop();
        this.handleDisconnect(state);
      }
      this.notifySessionUpdate();
    });
  }

  private notifySessionUpdate(): void {
    if (this.session) {
      this.sessionHandlers.forEach((handler) => handler({ ...this.session! }));
    }
  }

  async createRoom(roomCode: string): Promise<boolean> {
    const success = await this.transport.connect(roomCode, this.config.playerProfile.playerId);
    if (!success) return false;

    this.session = {
      roomCode,
      sessionId: generateSessionId(),
      myRole: 'host',
      myPlayerId: this.config.playerProfile.playerId,
      peerPlayerId: null,
      connectionState: 'connecting',
      isHost: true,
      isReferee: true,
      phase: 'waiting',
      peerConnected: false,
      connectedAt: Date.now(),
      lastMessageAt: Date.now(),
      consecutivePingMs: 0,
    };

    this.notifySessionUpdate();
    return true;
  }

  async joinRoom(roomCode: string): Promise<boolean> {
    const success = await this.transport.connect(roomCode, this.config.playerProfile.playerId);
    if (!success) return false;

    this.session = {
      roomCode,
      sessionId: generateSessionId(),
      myRole: 'client',
      myPlayerId: this.config.playerProfile.playerId,
      peerPlayerId: null,
      connectionState: 'connecting',
      isHost: false,
      isReferee: false,
      phase: 'handshake',
      peerConnected: false,
      connectedAt: Date.now(),
      lastMessageAt: Date.now(),
      consecutivePingMs: 0,
    };

    this.sendHandshakeRequest('*');
    this.notifySessionUpdate();
    return true;
  }

  private sendHandshakeRequest(receiverId: string): void {
    const payload: HandshakeRequestPayload = {
      playerId: this.config.playerProfile.playerId,
      playerName: this.config.playerProfile.playerName,
      avatar: this.config.playerProfile.avatar,
      rankPoints: this.config.playerProfile.rankPoints,
      currentRank: this.config.playerProfile.currentRank,
      loadout: this.config.playerLoadout,
      isReferee: this.session?.isReferee || false,
      protocolVersion: PROTOCOL_VERSION,
    };

    this.transport.send({
      type: 'handshake_request',
      receiverId,
      roomCode: this.session!.roomCode,
      payload,
    });
  }

  private sendHandshakeResponse(receiverId: string, accepted: boolean, error?: string): void {
    const payload: HandshakeResponsePayload = {
      accepted,
      playerId: this.config.playerProfile.playerId,
      playerName: this.config.playerProfile.playerName,
      avatar: this.config.playerProfile.avatar,
      rankPoints: this.config.playerProfile.rankPoints,
      currentRank: this.config.playerProfile.currentRank,
      loadout: this.config.playerLoadout,
      isReferee: this.session?.isReferee || false,
      refereeSeed: accepted && this.session?.isReferee ? generateRefereeSeed() : undefined,
      error,
    };

    this.transport.send({
      type: 'handshake_response',
      receiverId,
      roomCode: this.session!.roomCode,
      payload,
    });
  }

  sendBattleInit(hostGoesFirst: boolean = true): void {
    if (!this.session?.peerProfile) return;

    const refereeSeed = generateRefereeSeed();
    const payload: BattleInitPayload = {
      battleId: generateId(),
      refereeSeed,
      hostPlayerId: this.config.playerProfile.playerId,
      hostLoadout: this.config.playerLoadout,
      clientPlayerId: this.session.peerProfile.playerId,
      clientLoadout: this.session.peerProfile.loadout,
      initialGridSeed: refereeSeed,
      startTime: Date.now() + 3000,
      hostGoesFirst,
      isRated: true,
    };

    this.session.battleInit = payload;
    this.actionHistory = [];
    this.lastAcknowledgedTurn = 0;

    this.transport.send({
      type: 'battle_init',
      receiverId: this.session.peerProfile.playerId,
      roomCode: this.session.roomCode,
      payload,
    });

    this.battleInitHandlers.forEach((handler) => handler(payload));
    this.notifySessionUpdate();
  }

  sendTurnAction(action: Omit<TurnActionPayload, 'turn'>): void {
    if (!this.session) return;

    const turn = this.actionHistory.length + 1;
    const fullAction: TurnActionPayload = {
      ...action,
      turn,
    };

    this.actionHistory.push(fullAction);
    this.lastStateHash = action.stateAfter.gridHash;

    this.transport.send({
      type: 'turn_action',
      receiverId: this.session.peerPlayerId || '*',
      roomCode: this.session.roomCode,
      payload: fullAction,
    });

    const timeout = window.setTimeout(() => {
      this.pendingActions.delete(turn);
      this.syncErrorHandlers.forEach((handler) =>
        handler(`Turn ${turn} acknowledgement timeout`)
      );
    }, 10000);
    this.pendingActions.set(turn, { timeout });

    if (this.session.isReferee) {
      this.turnActionHandlers.forEach((handler) =>
        handler(fullAction, this.config.playerProfile.playerId)
      );
    }
  }

  private sendTurnAck(turn: number, accepted: boolean, stateHash: string, error?: string): void {
    if (!this.session?.peerPlayerId) return;

    const payload: TurnAckPayload = {
      turn,
      accepted,
      stateHash,
      error,
    };

    this.transport.send({
      type: 'turn_ack',
      receiverId: this.session.peerPlayerId,
      roomCode: this.session.roomCode,
      payload,
    });
  }

  sendStateHash(turn: number, stateHash: string, fullState?: Partial<PVPBattleState>): void {
    if (!this.session?.peerPlayerId) return;

    const payload: StateHashPayload = {
      turn,
      stateHash,
      fullState,
    };

    this.transport.send({
      type: 'state_hash',
      receiverId: this.session.peerPlayerId,
      roomCode: this.session.roomCode,
      payload,
    });
  }

  sendBattleResult(result: BattleResultPayload): void {
    if (!this.session?.peerPlayerId) return;

    this.transport.send({
      type: 'battle_result',
      receiverId: this.session.peerPlayerId,
      roomCode: this.session.roomCode,
      payload: result,
    });

    this.battleResultHandlers.forEach((handler) => handler(result));
  }

  sendDisconnect(reason: 'timeout' | 'manual' | 'error', message?: string): void {
    if (!this.session) return;

    const payload: DisconnectPayload = {
      reason,
      message,
    };

    this.transport.send({
      type: 'disconnect',
      receiverId: this.session.peerPlayerId || '*',
      roomCode: this.session.roomCode,
      payload,
    });

    this.destroy();
  }

  private handleMessage(message: P2PMessage): void {
    if (!this.session) return;

    this.session.lastMessageAt = Date.now();
    this.resetDisconnectTimer();

    switch (message.type) {
      case 'ping':
        this.handlePing(message);
        break;
      case 'pong':
        this.handlePong(message);
        break;
      case 'handshake_request':
        this.handleHandshakeRequest(message.payload as HandshakeRequestPayload, message.senderId);
        break;
      case 'handshake_response':
        this.handleHandshakeResponse(message.payload as HandshakeResponsePayload, message.senderId);
        break;
      case 'battle_init':
        this.handleBattleInit(message.payload as BattleInitPayload);
        break;
      case 'turn_action':
        this.handleTurnAction(message.payload as TurnActionPayload, message.senderId);
        break;
      case 'turn_ack':
        this.handleTurnAck(message.payload as TurnAckPayload);
        break;
      case 'state_hash':
        this.handleStateHash(message.payload as StateHashPayload, message.senderId);
        break;
      case 'disconnect':
        this.handleDisconnectMessage(message.payload as DisconnectPayload);
        break;
      case 'reconnect_request':
        this.handleReconnectRequest(message.payload as ReconnectRequestPayload, message.senderId);
        break;
      case 'reconnect_response':
        this.handleReconnectResponse(message.payload as ReconnectResponsePayload);
        break;
      case 'battle_result':
        this.handleBattleResultMessage(message.payload as BattleResultPayload);
        break;
    }
  }

  private handlePing(message: P2PMessage): void {
    this.transport.send({
      type: 'pong',
      receiverId: message.senderId,
      roomCode: this.session!.roomCode,
      payload: { pingId: message.messageId },
    });
  }

  private handlePong(message: P2PMessage): void {
    const stats = this.transport.getStats();
    if (this.session) {
      this.session.consecutivePingMs = stats.latency;
    }
  }

  private handleHandshakeRequest(payload: HandshakeRequestPayload, senderId: string): void {
    if (!this.session?.isHost) return;
    if (this.session.peerPlayerId) return;

    if (payload.protocolVersion !== PROTOCOL_VERSION) {
      this.sendHandshakeResponse(senderId, false, '协议版本不兼容');
      return;
    }

    this.session.peerPlayerId = senderId;
    this.session.peerProfile = {
      playerId: payload.playerId,
      playerName: payload.playerName,
      avatar: payload.avatar,
      rankPoints: payload.rankPoints,
      currentRank: payload.currentRank,
    } as any;
    this.session.peerLoadout = payload.loadout;
    this.session.peerConnected = true;
    this.session.connectionState = 'connected';
    this.session.phase = 'battle_ready';

    this.sendHandshakeResponse(senderId, true);
    this.notifySessionUpdate();
  }

  private handleHandshakeResponse(payload: HandshakeResponsePayload, senderId: string): void {
    if (!this.session || this.session.connectionState === 'connected') return;

    if (!payload.accepted) {
      this.session.connectionState = 'error';
      this.notifySessionUpdate();
      return;
    }

    this.session.peerPlayerId = senderId;
    this.session.peerProfile = {
      playerId: payload.playerId,
      playerName: payload.playerName,
      avatar: payload.avatar,
      rankPoints: payload.rankPoints,
      currentRank: payload.currentRank,
    } as any;
    this.session.peerLoadout = payload.loadout;
    this.session.peerConnected = true;
    this.session.connectionState = 'connected';
    this.session.phase = 'battle_ready';

    if (payload.isReferee && payload.refereeSeed) {
      this.session.isReferee = false;
    }

    this.notifySessionUpdate();
  }

  private handleBattleInit(payload: BattleInitPayload): void {
    if (!this.session) return;

    this.session.battleInit = payload;
    this.actionHistory = [];
    this.lastAcknowledgedTurn = 0;

    this.battleInitHandlers.forEach((handler) => handler(payload));
    this.notifySessionUpdate();
  }

  private handleTurnAction(payload: TurnActionPayload, senderId: string): void {
    if (!this.session) return;

    const expectedTurn = this.actionHistory.length + 1;
    if (payload.turn !== expectedTurn) {
      this.sendTurnAck(payload.turn, false, this.lastStateHash, `Expected turn ${expectedTurn}`);
      this.requestReconnect();
      return;
    }

    if (this.session.isReferee) {
      const refereeHash = this.lastStateHash || payload.stateAfter.gridHash;
      if (payload.stateAfter.gridHash !== refereeHash) {
        this.sendTurnAck(payload.turn, false, refereeHash, 'State hash mismatch');
        this.syncErrorHandlers.forEach((handler) =>
          handler('State hash mismatch', refereeHash, payload.stateAfter.gridHash)
        );
        return;
      }
    }

    this.actionHistory.push(payload);
    this.lastStateHash = payload.stateAfter.gridHash;
    this.sendTurnAck(payload.turn, true, payload.stateAfter.gridHash);

    if (this.session.isReferee) {
      this.turnActionHandlers.forEach((handler) => handler(payload, senderId));
    }
  }

  private handleTurnAck(payload: TurnAckPayload): void {
    const pending = this.pendingActions.get(payload.turn);
    if (pending) {
      clearTimeout(pending.timeout);
      this.pendingActions.delete(payload.turn);
    }

    if (!payload.accepted) {
      this.syncErrorHandlers.forEach((handler) =>
        handler(payload.error || 'Action rejected', payload.stateHash)
      );
      if (payload.turn > this.lastAcknowledgedTurn + 1) {
        this.requestReconnect();
      }
    } else {
      this.lastAcknowledgedTurn = Math.max(this.lastAcknowledgedTurn, payload.turn);
    }
  }

  private handleStateHash(payload: StateHashPayload, senderId: string): void {
    if (!this.session?.isReferee) return;

    if (payload.stateHash !== this.lastStateHash) {
      this.syncErrorHandlers.forEach((handler) =>
        handler('State hash out of sync', this.lastStateHash, payload.stateHash)
      );
    }
  }

  private handleDisconnectMessage(payload: DisconnectPayload): void {
    if (!this.session) return;

    if (payload.reason === 'timeout') {
      const result: BattleResultPayload = {
        result: this.session.isHost ? 'attacker_win' : 'defender_win',
        winnerId: this.config.playerProfile.playerId,
        reason: '对手连接超时',
        finalStateHash: this.lastStateHash,
        timeoutSide: this.session.isHost ? 'client' : 'host',
      };
      this.battleResultHandlers.forEach((handler) => handler(result));
    }

    this.session.connectionState = 'disconnected';
    this.notifySessionUpdate();
  }

  private handleBattleResultMessage(payload: BattleResultPayload): void {
    this.battleResultHandlers.forEach((handler) => handler(payload));
  }

  private handleReconnectRequest(payload: ReconnectRequestPayload, senderId: string): void {
    if (!this.session?.isReferee) return;

    const missingActions = this.actionHistory.slice(payload.lastAcknowledgedTurn);

    const response: ReconnectResponsePayload = {
      accepted: true,
      currentTurn: this.actionHistory.length,
      missingActions,
      currentState: {},
    };

    this.transport.send({
      type: 'reconnect_response',
      receiverId: senderId,
      roomCode: this.session.roomCode,
      payload: response,
    });
  }

  private handleReconnectResponse(payload: ReconnectResponsePayload): void {
    if (!payload.accepted) {
      this.session!.connectionState = 'error';
      this.notifySessionUpdate();
      return;
    }

    this.reconnectAttempts = 0;

    for (const action of payload.missingActions) {
      this.actionHistory.push(action);
      this.turnActionHandlers.forEach((handler) =>
        handler(action, this.session!.peerPlayerId!)
      );
    }

    this.session!.connectionState = 'connected';
    this.notifySessionUpdate();
  }

  private handleDisconnect(state: 'disconnected' | 'error'): void {
    if (!this.session) return;

    if (state === 'error' && this.reconnectAttempts < MAX_RECONNECT) {
      this.session.connectionState = 'reconnecting';
      this.notifySessionUpdate();
      this.attemptReconnect();
      return;
    }

    this.session.connectionState = state === 'error' ? 'error' : 'disconnected';
    this.notifySessionUpdate();
  }

  private requestReconnect(): void {
    if (!this.session || this.reconnectAttempts >= MAX_RECONNECT) return;

    const payload: ReconnectRequestPayload = {
      playerId: this.config.playerProfile.playerId,
      lastAcknowledgedTurn: this.lastAcknowledgedTurn,
      lastActionHash: this.lastStateHash,
    };

    this.transport.send({
      type: 'reconnect_request',
      receiverId: this.session.peerPlayerId || '*',
      roomCode: this.session.roomCode,
      payload,
    });

    this.reconnectAttempts++;
  }

  private async attemptReconnect(): Promise<void> {
    this.reconnectAttempts++;
    const delay = 1000 * this.reconnectAttempts;

    setTimeout(async () => {
      if (!this.session) return;

      const success = await this.transport.connect(
        this.session.roomCode,
        this.config.playerProfile.playerId
      );

      if (!success && this.reconnectAttempts < MAX_RECONNECT) {
        this.attemptReconnect();
      } else if (!success) {
        this.session!.connectionState = 'error';
        this.notifySessionUpdate();
      }
    }, delay);
  }

  private startPingLoop(): void {
    this.stopPingLoop();
    this.pingInterval = window.setInterval(() => {
      if (this.session?.peerPlayerId) {
        this.transport.send({
          type: 'ping',
          receiverId: this.session.peerPlayerId,
          roomCode: this.session.roomCode,
          payload: { timestamp: Date.now() },
        });
      }
    }, PING_INTERVAL);

    this.resetDisconnectTimer();
  }

  private stopPingLoop(): void {
    if (this.pingInterval !== null) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    if (this.disconnectTimer !== null) {
      clearTimeout(this.disconnectTimer);
      this.disconnectTimer = null;
    }
  }

  private resetDisconnectTimer(): void {
    if (this.disconnectTimer !== null) {
      clearTimeout(this.disconnectTimer);
    }
    this.disconnectTimer = window.setTimeout(() => {
      this.sendDisconnect('timeout', 'Connection timed out');
    }, DISCONNECT_TIMEOUT);
  }

  onSessionUpdate(handler: SessionStateHandler): () => void {
    this.sessionHandlers.push(handler);
    return () => {
      this.sessionHandlers = this.sessionHandlers.filter((h) => h !== handler);
    };
  }

  onBattleInit(handler: BattleInitHandler): () => void {
    this.battleInitHandlers.push(handler);
    return () => {
      this.battleInitHandlers = this.battleInitHandlers.filter((h) => h !== handler);
    };
  }

  onTurnAction(handler: TurnActionHandler): () => void {
    this.turnActionHandlers.push(handler);
    return () => {
      this.turnActionHandlers = this.turnActionHandlers.filter((h) => h !== handler);
    };
  }

  onBattleResult(handler: BattleResultHandler): () => void {
    this.battleResultHandlers.push(handler);
    return () => {
      this.battleResultHandlers = this.battleResultHandlers.filter((h) => h !== handler);
    };
  }

  onSyncError(handler: SyncErrorHandler): () => void {
    this.syncErrorHandlers.push(handler);
    return () => {
      this.syncErrorHandlers = this.syncErrorHandlers.filter((h) => h !== handler);
    };
  }

  getSession(): P2PSession | null {
    return this.session ? { ...this.session } : null;
  }

  getActionHistory(): TurnActionPayload[] {
    return [...this.actionHistory];
  }

  getTransport(): P2PTransport {
    return this.transport;
  }

  getSeededRandom(seed: number): (() => number) {
    return seededRandom(seed);
  }

  destroy(): void {
    this.stopPingLoop();
    this.pendingActions.forEach((p) => clearTimeout(p.timeout));
    this.pendingActions.clear();
    this.transport.destroy();
    this.sessionHandlers = [];
    this.battleInitHandlers = [];
    this.turnActionHandlers = [];
    this.battleResultHandlers = [];
    this.syncErrorHandlers = [];
    this.session = null;
  }
}

export const generateRoomCode = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

export const normalizeRoomCode = (code: string): string => {
  return code
    .toUpperCase()
    .replace(/[^A-Z2-9]/g, '')
    .slice(0, 6);
};
