import type {
  P2PMessage,
  P2PMessageType,
  P2PTransportConfig,
  P2PNetworkStats,
} from '../types';

const generateMessageId = (): string => {
  return `msg_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 9)}`;
};

export type MessageHandler = (message: P2PMessage) => void;
export type ConnectionStateHandler = (state: 'connected' | 'disconnected' | 'error') => void;

export interface P2PTransport {
  connect(roomCode: string, playerId: string): Promise<boolean>;
  disconnect(): void;
  send(message: Omit<P2PMessage, 'messageId' | 'timestamp' | 'senderId'>): Promise<boolean>;
  onMessage(handler: MessageHandler): () => void;
  onConnectionState(handler: ConnectionStateHandler): () => void;
  getStats(): P2PNetworkStats;
  isConnected(): boolean;
  destroy(): void;
}

abstract class BaseP2PTransport implements P2PTransport {
  protected config: P2PTransportConfig;
  protected roomCode: string = '';
  protected playerId: string = '';
  protected connected: boolean = false;
  protected messageHandlers: MessageHandler[] = [];
  protected connectionHandlers: ConnectionStateHandler[] = [];
  protected stats: P2PNetworkStats = {
    latency: 0,
    packetLoss: 0,
    messagesSent: 0,
    messagesReceived: 0,
    bytesSent: 0,
    bytesReceived: 0,
  };
  private pendingMessages: Map<string, { timer: number; retries: number }> = new Map();

  constructor(config: P2PTransportConfig) {
    this.config = config;
  }

  abstract connect(roomCode: string, playerId: string): Promise<boolean>;
  abstract disconnect(): void;
  protected abstract sendRaw(message: P2PMessage): boolean;

  protected emitMessage(message: P2PMessage): void {
    this.stats.messagesReceived++;
    this.stats.bytesReceived += JSON.stringify(message).length;
    this.messageHandlers.forEach((handler) => {
      try {
        handler(message);
      } catch (e) {
        console.error('Error in message handler:', e);
      }
    });
  }

  protected emitConnectionState(state: 'connected' | 'disconnected' | 'error'): void {
    this.connected = state === 'connected';
    this.connectionHandlers.forEach((handler) => {
      try {
        handler(state);
      } catch (e) {
        console.error('Error in connection handler:', e);
      }
    });
  }

  async send(
    message: Omit<P2PMessage, 'messageId' | 'timestamp' | 'senderId'>
  ): Promise<boolean> {
    if (!this.connected && message.type !== 'disconnect') {
      return false;
    }

    const fullMessage: P2PMessage = {
      ...message,
      messageId: generateMessageId(),
      timestamp: Date.now(),
      senderId: this.playerId,
    };

    const success = this.sendRaw(fullMessage);
    if (success) {
      this.stats.messagesSent++;
      this.stats.bytesSent += JSON.stringify(fullMessage).length;

      if (message.type === 'ping') {
        const timer = window.setTimeout(() => {
          this.stats.packetLoss = Math.min(100, this.stats.packetLoss + 5);
          this.pendingMessages.delete(fullMessage.messageId);
        }, 5000);
        this.pendingMessages.set(fullMessage.messageId, { timer, retries: 0 });
      }
    }

    return success;
  }

  protected handlePong(pingId: string): void {
    const pending = this.pendingMessages.get(pingId);
    if (pending) {
      clearTimeout(pending.timer);
      this.stats.latency = Date.now() - parseInt(pingId.split('_')[1], 36);
      this.stats.packetLoss = Math.max(0, this.stats.packetLoss - 2);
      this.pendingMessages.delete(pingId);
    }
  }

  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.push(handler);
    return () => {
      this.messageHandlers = this.messageHandlers.filter((h) => h !== handler);
    };
  }

  onConnectionState(handler: ConnectionStateHandler): () => void {
    this.connectionHandlers.push(handler);
    return () => {
      this.connectionHandlers = this.connectionHandlers.filter((h) => h !== handler);
    };
  }

  getStats(): P2PNetworkStats {
    return { ...this.stats };
  }

  isConnected(): boolean {
    return this.connected;
  }

  destroy(): void {
    this.pendingMessages.forEach((p) => clearTimeout(p.timer));
    this.pendingMessages.clear();
    this.messageHandlers = [];
    this.connectionHandlers = [];
    this.disconnect();
  }
}

const LOCAL_TRANSPORT_STORAGE_KEY = 'p2p_local_transport';

interface LocalTransportMessage {
  message: P2PMessage;
  receivedAt: number;
}

export class LocalP2PTransport extends BaseP2PTransport {
  private pollInterval: number | null = null;
  private lastProcessedIndex: number = 0;

  constructor(config: Partial<P2PTransportConfig> = {}) {
    super({
      transportType: 'local',
      timeoutMs: 30000,
      reconnectAttempts: 5,
      ...config,
    });
  }

  async connect(roomCode: string, playerId: string): Promise<boolean> {
    this.roomCode = roomCode;
    this.playerId = playerId;
    this.lastProcessedIndex = this.getMessages().length;

    this.pollInterval = window.setInterval(() => this.pollMessages(), 100);

    setTimeout(() => {
      this.emitConnectionState('connected');
    }, 100);

    return true;
  }

  disconnect(): void {
    if (this.pollInterval !== null) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    this.emitConnectionState('disconnected');
  }

  protected sendRaw(message: P2PMessage): boolean {
    try {
      const messages = this.getMessages();
      messages.push({ message, receivedAt: Date.now() });
      localStorage.setItem(this.getStorageKey(), JSON.stringify(messages));
      return true;
    } catch (e) {
      console.error('Failed to send local message:', e);
      return false;
    }
  }

  private getStorageKey(): string {
    return `${LOCAL_TRANSPORT_STORAGE_KEY}_${this.roomCode}`;
  }

  private getMessages(): LocalTransportMessage[] {
    try {
      const data = localStorage.getItem(this.getStorageKey());
      if (data) {
        return JSON.parse(data);
      }
    } catch (e) {
      console.error('Failed to read local transport messages:', e);
    }
    return [];
  }

  private pollMessages(): void {
    if (!this.connected) return;

    const allMessages = this.getMessages();
    const newMessages = allMessages.slice(this.lastProcessedIndex);

    for (const { message } of newMessages) {
      if (message.receiverId === this.playerId || message.receiverId === '*') {
        if (message.type === 'pong') {
          this.handlePong(message.payload.pingId);
        }
        this.emitMessage(message);
      }
    }

    this.lastProcessedIndex = allMessages.length;

    const now = Date.now();
    const cutoff = now - 60000;
    if (allMessages.length > 0 && allMessages[0].receivedAt < cutoff) {
      const filtered = allMessages.filter((m) => m.receivedAt >= cutoff);
      localStorage.setItem(this.getStorageKey(), JSON.stringify(filtered));
      this.lastProcessedIndex = filtered.length;
    }
  }
}

export class WebSocketP2PTransport extends BaseP2PTransport {
  private ws: WebSocket | null = null;
  private reconnectAttempts: number = 0;
  private reconnectTimer: number | null = null;
  private manualDisconnect: boolean = false;

  constructor(config: Partial<P2PTransportConfig> = {}) {
    super({
      transportType: 'websocket',
      signalServer: 'ws://localhost:8080',
      timeoutMs: 30000,
      reconnectAttempts: 5,
      ...config,
    });
  }

  async connect(roomCode: string, playerId: string): Promise<boolean> {
    this.roomCode = roomCode;
    this.playerId = playerId;
    this.manualDisconnect = false;

    return this.attemptConnect();
  }

  private attemptConnect(): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        const wsUrl = `${this.config.signalServer}?room=${this.roomCode}&player=${this.playerId}`;
        this.ws = new WebSocket(wsUrl);

        const timeout = setTimeout(() => {
          if (this.ws?.readyState !== WebSocket.OPEN) {
            this.handleConnectionError();
            resolve(false);
          }
        }, 5000);

        this.ws.onopen = () => {
          clearTimeout(timeout);
          this.reconnectAttempts = 0;
          this.emitConnectionState('connected');
          resolve(true);
        };

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data) as P2PMessage;
            if (message.type === 'pong') {
              this.handlePong(message.payload.pingId);
            }
            this.emitMessage(message);
          } catch (e) {
            console.error('Failed to parse WebSocket message:', e);
          }
        };

        this.ws.onerror = () => {
          clearTimeout(timeout);
          this.handleConnectionError();
          resolve(false);
        };

        this.ws.onclose = () => {
          clearTimeout(timeout);
          if (!this.manualDisconnect) {
            this.handleConnectionError();
          } else {
            this.emitConnectionState('disconnected');
          }
          resolve(false);
        };
      } catch (e) {
        console.error('Failed to create WebSocket:', e);
        resolve(false);
      }
    });
  }

  private handleConnectionError(): void {
    this.emitConnectionState('error');

    if (
      !this.manualDisconnect &&
      this.reconnectAttempts < this.config.reconnectAttempts
    ) {
      this.reconnectAttempts++;
      this.reconnectTimer = window.setTimeout(() => {
        this.attemptConnect();
      }, 1000 * this.reconnectAttempts);
    } else {
      this.emitConnectionState('disconnected');
    }
  }

  disconnect(): void {
    this.manualDisconnect = true;
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.emitConnectionState('disconnected');
  }

  protected sendRaw(message: P2PMessage): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      this.ws.send(JSON.stringify(message));
      return true;
    } catch (e) {
      console.error('Failed to send WebSocket message:', e);
      return false;
    }
  }
}

export class WebRTCP2PTransport extends BaseP2PTransport {
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private iceServers: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ];
  private signalHandler: ((signal: any) => void) | null = null;
  private iceCandidates: RTCIceCandidate[] = [];
  private remoteDescriptionSet: boolean = false;

  constructor(config: Partial<P2PTransportConfig> = {}) {
    super({
      transportType: 'webrtc',
      timeoutMs: 30000,
      reconnectAttempts: 3,
      ...config,
    });
  }

  setSignalHandler(handler: (signal: any) => void): void {
    this.signalHandler = handler;
  }

  async handleSignal(signal: any): Promise<void> {
    if (!this.peerConnection) {
      this.createPeerConnection();
    }

    if (signal.type === 'offer') {
      await this.peerConnection!.setRemoteDescription(new RTCSessionDescription(signal));
      this.remoteDescriptionSet = true;
      await this.sendIceCandidates();
      const answer = await this.peerConnection!.createAnswer();
      await this.peerConnection!.setLocalDescription(answer);
      this.signalHandler?.({ type: 'answer', sdp: answer.sdp });
    } else if (signal.type === 'answer') {
      await this.peerConnection!.setRemoteDescription(new RTCSessionDescription(signal));
      this.remoteDescriptionSet = true;
      await this.sendIceCandidates();
    } else if (signal.type === 'ice-candidate') {
      const candidate = new RTCIceCandidate(signal.candidate);
      if (this.remoteDescriptionSet) {
        await this.peerConnection!.addIceCandidate(candidate);
      } else {
        this.iceCandidates.push(candidate);
      }
    }
  }

  private async sendIceCandidates(): Promise<void> {
    for (const candidate of this.iceCandidates) {
      await this.peerConnection!.addIceCandidate(candidate);
    }
    this.iceCandidates = [];
  }

  private createPeerConnection(): void {
    this.peerConnection = new RTCPeerConnection({ iceServers: this.iceServers });

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.signalHandler?.({
          type: 'ice-candidate',
          candidate: event.candidate,
        });
      }
    };

    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState;
      if (state === 'connected') {
        this.emitConnectionState('connected');
      } else if (state === 'disconnected' || state === 'failed' || state === 'closed') {
        this.emitConnectionState('disconnected');
      }
    };

    this.peerConnection.ondatachannel = (event) => {
      this.setupDataChannel(event.channel);
    };
  }

  private setupDataChannel(channel: RTCDataChannel): void {
    this.dataChannel = channel;

    channel.onopen = () => {
      this.emitConnectionState('connected');
    };

    channel.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as P2PMessage;
        if (message.type === 'pong') {
          this.handlePong(message.payload.pingId);
        }
        this.emitMessage(message);
      } catch (e) {
        console.error('Failed to parse data channel message:', e);
      }
    };

    channel.onclose = () => {
      this.emitConnectionState('disconnected');
    };

    channel.onerror = () => {
      this.emitConnectionState('error');
    };
  }

  async connect(roomCode: string, playerId: string): Promise<boolean> {
    this.roomCode = roomCode;
    this.playerId = playerId;

    if (!this.peerConnection) {
      this.createPeerConnection();
    }

    const dataChannel = this.peerConnection!.createDataChannel('battle-data');
    this.setupDataChannel(dataChannel);

    const offer = await this.peerConnection!.createOffer();
    await this.peerConnection!.setLocalDescription(offer);
    this.signalHandler?.({ type: 'offer', sdp: offer.sdp });

    return new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(false), 10000);
      const cleanup = this.onConnectionState((state) => {
        if (state === 'connected') {
          clearTimeout(timeout);
          cleanup();
          resolve(true);
        }
      });
    });
  }

  disconnect(): void {
    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    this.remoteDescriptionSet = false;
    this.iceCandidates = [];
    this.emitConnectionState('disconnected');
  }

  protected sendRaw(message: P2PMessage): boolean {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      return false;
    }

    try {
      this.dataChannel.send(JSON.stringify(message));
      return true;
    } catch (e) {
      console.error('Failed to send data channel message:', e);
      return false;
    }
  }
}

export const createP2PTransport = (
  type: 'local' | 'websocket' | 'webrtc',
  config?: Partial<P2PTransportConfig>
): P2PTransport => {
  switch (type) {
    case 'local':
      return new LocalP2PTransport(config);
    case 'websocket':
      return new WebSocketP2PTransport(config);
    case 'webrtc':
      return new WebRTCP2PTransport(config);
    default:
      return new LocalP2PTransport(config);
  }
};
