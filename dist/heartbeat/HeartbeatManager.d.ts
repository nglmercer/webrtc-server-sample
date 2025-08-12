import { EventEmitter } from 'events';
import { CustomSocket } from '../types';
export interface HeartbeatConfig {
    enableHeartbeat: boolean;
    pingInterval: number;
    pongTimeout: number;
    maxFailedPings: number;
    enableLogging: boolean;
}
export interface HeartbeatEvents {
    'connection-lost': (socketId: string, socket: CustomSocket) => void;
    'connection-restored': (socketId: string, socket: CustomSocket) => void;
    'ping-sent': (socketId: string, timestamp: number) => void;
    'pong-received': (socketId: string, timestamp: number, latency: number) => void;
    'ping-timeout': (socketId: string, failedCount: number) => void;
}
/**
 * Información de estado simplificada para cada socket.
 * Eliminamos isAlive, currentPingId, y pendingPings.
 */
interface SocketHeartbeatInfo {
    socket: CustomSocket;
    pingTimer?: NodeJS.Timeout;
    pongTimer?: NodeJS.Timeout;
    failedPings: number;
    lastPingTime?: number;
}
/**
 * Gestor de heartbeat simplificado.
 */
export declare class HeartbeatManager extends EventEmitter {
    config: HeartbeatConfig;
    sockets: Map<string, SocketHeartbeatInfo>;
    isRunning: boolean;
    constructor(config?: Partial<HeartbeatConfig>);
    start(): void;
    stop(): void;
    addSocket(socket: CustomSocket): void;
    removeSocket(socketId: string): void;
    private setupSocketHandlers;
    private schedulePing;
    private sendPing;
    private handlePong;
    private handlePongTimeout;
    private clearSocketTimers;
}
export declare const defaultHeartbeatManager: HeartbeatManager;
export {};
//# sourceMappingURL=HeartbeatManager.d.ts.map