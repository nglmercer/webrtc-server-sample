import { EventEmitter } from 'events';
import { CustomSocket } from '../types';
/**
 * Configuración del sistema de heartbeat
 */
export interface HeartbeatConfig {
    /** Intervalo entre pings en milisegundos (default: 30000 = 30s) */
    pingInterval: number;
    /** Tiempo máximo de espera para pong en milisegundos (default: 10000 = 10s) */
    pongTimeout: number;
    /** Número máximo de pings fallidos antes de considerar la conexión muerta (default: 3) */
    maxFailedPings: number;
    /** Habilitar logging detallado (default: false) */
    enableLogging: boolean;
}
/**
 * Información de estado de heartbeat para cada socket
 */
interface SocketHeartbeatInfo {
    socket: CustomSocket;
    pingTimer?: NodeJS.Timeout;
    pongTimer?: NodeJS.Timeout;
    failedPings: number;
    lastPingTime?: number;
    lastPongTime?: number;
    isAlive: boolean;
}
/**
 * Eventos emitidos por el HeartbeatManager
 */
export interface HeartbeatEvents {
    'connection-lost': (socketId: string, socket: CustomSocket) => void;
    'connection-restored': (socketId: string, socket: CustomSocket) => void;
    'ping-sent': (socketId: string, timestamp: number) => void;
    'pong-received': (socketId: string, timestamp: number, latency: number) => void;
    'ping-timeout': (socketId: string, failedCount: number) => void;
}
/**
 * Gestor de heartbeat para detectar conexiones perdidas y mantener conexiones activas
 */
export declare class HeartbeatManager extends EventEmitter {
    config: HeartbeatConfig;
    sockets: Map<string, SocketHeartbeatInfo>;
    isRunning: boolean;
    constructor(config?: Partial<HeartbeatConfig>);
    /**
     * Inicia el sistema de heartbeat
     */
    start(config?: Partial<HeartbeatConfig>): void;
    /**
     * Detiene el sistema de heartbeat
     */
    stop(): void;
    /**
     * Registra un socket para monitoreo de heartbeat
     */
    addSocket(socket: CustomSocket): void;
    /**
     * Remueve un socket del monitoreo de heartbeat
     */
    removeSocket(socketId: string): void;
    /**
     * Obtiene estadísticas del heartbeat
     */
    getStats(): {
        totalSockets: number;
        aliveSockets: number;
        deadSockets: number;
        socketsWithFailedPings: number;
    };
    /**
     * Configura los manejadores de eventos para un socket
     */
    private setupSocketHandlers;
    /**
     * Programa el próximo ping para un socket
     */
    private schedulePing;
    /**
     * Envía un ping a un socket
     */
    private sendPing;
    /**
     * Maneja la recepción de un pong
     */
    private handlePong;
    /**
     * Maneja el timeout de pong (no se recibió respuesta)
     */
    private handlePongTimeout;
    /**
     * Limpia los timers de un socket
     */
    private clearSocketTimers;
}
export declare const defaultHeartbeatManager: HeartbeatManager;
export {};
//# sourceMappingURL=HeartbeatManager.d.ts.map