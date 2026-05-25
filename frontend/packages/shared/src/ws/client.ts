import { ClientMessage, ServerMessage, MSG_PING } from '../types/ws';
import { timeSync } from './time-sync';

type MessageHandler = (msg: ServerMessage) => void;
type StatusHandler = (status: ConnectionStatus) => void;

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';

export class WsClient {
  private ws: WebSocket | null = null;
  private url: string;
  private token: string;
  private seq = 0;
  private handlers = new Map<string, Set<MessageHandler>>();
  private statusHandlers = new Set<StatusHandler>();
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private status: ConnectionStatus = 'disconnected';

  constructor(url: string, token: string) {
    this.url = url;
    this.token = token;
  }

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    this.setStatus('connecting');
    this.ws = new WebSocket(`${this.url}?token=${this.token}`);

    this.ws.onopen = () => {
      this.setStatus('connected');
      this.reconnectAttempts = 0;
      this.startHeartbeat();
    };

    this.ws.onmessage = (event) => {
      try {
        const msg: ServerMessage = JSON.parse(event.data);

        if (msg.type === 'pong' || msg.type === 'time_sync') {
          const now = Date.now();
          const rtt = now - (this.lastPingTime || now);
          timeSync.calibrate(msg.ts, rtt);
        }

        const handlers = this.handlers.get(msg.type);
        if (handlers) {
          handlers.forEach((h) => h(msg));
        }
        const allHandlers = this.handlers.get('*');
        if (allHandlers) {
          allHandlers.forEach((h) => h(msg));
        }
      } catch {
        // ignore parse errors
      }
    };

    this.ws.onclose = () => {
      this.stopHeartbeat();
      if (this.status !== 'disconnected') {
        this.setStatus('reconnecting');
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  disconnect(): void {
    this.setStatus('disconnected');
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
  }

  send(msg: Omit<ClientMessage, 'seq'>): number {
    const seqNum = ++this.seq;
    const fullMsg: ClientMessage = { ...msg, seq: seqNum };
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(fullMsg));
    }
    return seqNum;
  }

  on(type: string, handler: MessageHandler): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler);
    return () => this.handlers.get(type)?.delete(handler);
  }

  onStatus(handler: StatusHandler): () => void {
    this.statusHandlers.add(handler);
    return () => this.statusHandlers.delete(handler);
  }

  private lastPingTime = 0;

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      this.lastPingTime = Date.now();
      this.send({ type: MSG_PING, payload: {} });
    }, 15_000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.setStatus('disconnected');
      return;
    }
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }

  private setStatus(status: ConnectionStatus): void {
    this.status = status;
    this.statusHandlers.forEach((h) => h(status));
  }

  getStatus(): ConnectionStatus {
    return this.status;
  }
}
