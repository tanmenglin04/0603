import type {
  NetworkMonitorState,
  ConnectionStatus,
  BattleConnectionState,
  PVPBattleState,
} from '../types';
import { TURN_TIMEOUT_MS, BATTLE_TIMEOUT_MS } from '../types';

export const createInitialNetworkState = (): NetworkMonitorState => ({
  status: 'connected',
  latency: 0,
  packetLoss: 0,
  lastSyncTime: Date.now(),
});

export const createInitialConnectionState = (): BattleConnectionState => ({
  isConnected: true,
  lastPingTime: Date.now(),
  consecutiveTimeouts: 0,
  maxConsecutiveTimeouts: 3,
});

export const checkConnectionStatus = (
  state: NetworkMonitorState
): ConnectionStatus => {
  const now = Date.now();
  const timeSinceLastSync = now - state.lastSyncTime;

  if (timeSinceLastSync > BATTLE_TIMEOUT_MS || state.consecutiveTimeouts >= 3) {
    return 'timeout';
  }
  if (timeSinceLastSync > TURN_TIMEOUT_MS || state.packetLoss > 30) {
    return 'disconnected';
  }
  if (state.latency > 1000 || state.packetLoss > 10 || timeSinceLastSync > 10000) {
    return 'warning';
  }
  return 'connected';
};

export const updateNetworkLatency = (
  state: NetworkMonitorState,
  latencyMs: number
): NetworkMonitorState => {
  const smoothedLatency = state.latency * 0.7 + latencyMs * 0.3;
  return {
    ...state,
    latency: smoothedLatency,
    lastSyncTime: Date.now(),
    status: checkConnectionStatus({
      ...state,
      latency: smoothedLatency,
      lastSyncTime: Date.now(),
    }),
  };
};

export const simulatePing = async (): Promise<{ latency: number; success: boolean }> => {
  const startTime = Date.now();
  const shouldFail = Math.random() < 0.05;

  return new Promise((resolve) => {
    setTimeout(() => {
      const latency = Date.now() - startTime + Math.floor(Math.random() * 100);
      resolve({ latency, success: !shouldFail });
    }, 20 + Math.random() * 150);
  });
};

export const checkBattleTurnTimeout = (
  battleState: PVPBattleState,
  now: number = Date.now()
): { isTimeout: boolean; remainingTime: number } => {
  const elapsed = now - battleState.lastActionTime;
  const remaining = Math.max(0, TURN_TIMEOUT_MS - elapsed);

  return {
    isTimeout: elapsed > TURN_TIMEOUT_MS,
    remainingTime: remaining,
  };
};

export const checkBattleTotalTimeout = (
  battleState: PVPBattleState,
  now: number = Date.now()
): { isTimeout: boolean; remainingTime: number } => {
  const elapsed = now - battleState.battleStartTime;
  const remaining = Math.max(0, BATTLE_TIMEOUT_MS - elapsed);

  return {
    isTimeout: elapsed > BATTLE_TIMEOUT_MS,
    remainingTime: remaining,
  };
};

export const formatTimeRemaining = (ms: number): string => {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes > 0) {
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${seconds}秒`;
};

export const getConnectionStatusColor = (status: ConnectionStatus): string => {
  switch (status) {
    case 'connected':
      return '#22c55e';
    case 'warning':
      return '#eab308';
    case 'disconnected':
      return '#f97316';
    case 'timeout':
      return '#ef4444';
    default:
      return '#6b7280';
  }
};

export const getConnectionStatusText = (status: ConnectionStatus): string => {
  switch (status) {
    case 'connected':
      return '连接正常';
    case 'warning':
      return '连接不稳定';
    case 'disconnected':
      return '连接断开';
    case 'timeout':
      return '连接超时';
    default:
      return '未知状态';
  }
};

export const getConnectionStatusIcon = (status: ConnectionStatus): string => {
  switch (status) {
    case 'connected':
      return '✅';
    case 'warning':
      return '⚠️';
    case 'disconnected':
      return '❌';
    case 'timeout':
      return '⏱️';
    default:
      return '❓';
  }
};

export class BattleTimeoutHandler {
  private checkInterval: number | null = null;
  private onTurnTimeout: (() => void) | null = null;
  private onBattleTimeout: (() => void) | null = null;
  private onTick: ((remaining: { turn: number; total: number }) => void) | null = null;
  private battleState: PVPBattleState | null = null;

  setBattleState(state: PVPBattleState) {
    this.battleState = state;
  }

  updateActionTime() {
    if (this.battleState) {
      this.battleState.lastActionTime = Date.now();
    }
  }

  setCallbacks(callbacks: {
    onTurnTimeout?: () => void;
    onBattleTimeout?: () => void;
    onTick?: (remaining: { turn: number; total: number }) => void;
  }) {
    this.onTurnTimeout = callbacks.onTurnTimeout || null;
    this.onBattleTimeout = callbacks.onBattleTimeout || null;
    this.onTick = callbacks.onTick || null;
  }

  start() {
    this.stop();

    this.checkInterval = window.setInterval(() => {
      if (!this.battleState) return;
      if (this.battleState.isFinished) {
        this.stop();
        return;
      }

      const now = Date.now();
      const turnCheck = checkBattleTurnTimeout(this.battleState, now);
      const totalCheck = checkBattleTotalTimeout(this.battleState, now);

      if (this.onTick) {
        this.onTick({
          turn: turnCheck.remainingTime,
          total: totalCheck.remainingTime,
        });
      }

      if (turnCheck.isTimeout && this.onTurnTimeout) {
        this.onTurnTimeout();
      }

      if (totalCheck.isTimeout && this.onBattleTimeout) {
        this.onBattleTimeout();
        this.stop();
      }
    }, 1000);
  }

  stop() {
    if (this.checkInterval !== null) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }
}
