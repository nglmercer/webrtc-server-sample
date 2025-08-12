import { EventEmitter } from 'events';
import { CustomSocket } from '../types';
import { defaultLogger as logger } from '../logger/index.js';

// La configuración y los eventos permanecen igual
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
export class HeartbeatManager extends EventEmitter {
  public config: HeartbeatConfig;
  public sockets: Map<string, SocketHeartbeatInfo> = new Map();
  public isRunning: boolean = false;

  constructor(config: Partial<HeartbeatConfig> = {}) {
    super();

    this.config = {
      enableHeartbeat: true,
      pingInterval: 30000,
      pongTimeout: 10000,
      maxFailedPings: 3,
      enableLogging: false,
      ...config,
    };
  }

  public start(): void {
    if (this.isRunning || !this.config.enableHeartbeat) {
      return;
    }
    this.isRunning = true;
    if (this.config.enableLogging) {
      logger.info('HeartbeatManager iniciado.');
    }
  }

  public stop(): void {
    if (!this.isRunning) {
      return;
    }
    this.isRunning = false;
    for (const info of this.sockets.values()) {
      this.clearSocketTimers(info);
    }
    this.sockets.clear();
    if (this.config.enableLogging) {
      logger.info('HeartbeatManager detenido.');
    }
  }

  public addSocket(socket: CustomSocket): void {
    if (!this.isRunning) {
      this.start();
    }

    if (this.sockets.has(socket.id)) {
      return; // Evitar duplicados
    }

    const socketInfo: SocketHeartbeatInfo = {
      socket,
      failedPings: 0,
    };

    this.sockets.set(socket.id, socketInfo);
    this.setupSocketHandlers(socketInfo);
    this.schedulePing(socketInfo); // Iniciar el ciclo

    if (this.config.enableLogging) {
      logger.debug(`Socket ${socket.id} agregado al heartbeat manager.`);
    }
  }

  public removeSocket(socketId: string): void {
    const socketInfo = this.sockets.get(socketId);
    if (!socketInfo) {
      return;
    }

    this.clearSocketTimers(socketInfo);
    this.sockets.delete(socketId);

    if (this.config.enableLogging) {
      logger.debug(`Socket ${socketId} removido del heartbeat manager.`);
    }
  }

  private setupSocketHandlers(socketInfo: SocketHeartbeatInfo): void {
    const { socket } = socketInfo;

    // Escuchar un 'pong' genérico, sin ID.
    const pongListener = () => this.handlePong(socketInfo);
    socket.on('pong', pongListener);

    // Guardamos la referencia para poder limpiarla después.
    const cleanup = () => {
      socket.off('pong', pongListener);
      socket.off('disconnect', cleanup);
      socket.off('error', errorCleanup);
      this.removeSocket(socket.id);
    };

    const errorCleanup = (error: Error) => {
        if (this.config.enableLogging) {
            logger.error(`Error en socket ${socket.id}, removiendo:`, error);
        }
        cleanup();
    }

    socket.on('disconnect', cleanup);
    socket.on('error', errorCleanup);
  }

  private schedulePing(socketInfo: SocketHeartbeatInfo): void {
    // Limpiar timer anterior para evitar duplicados
    if (socketInfo.pingTimer) clearTimeout(socketInfo.pingTimer);
    
    socketInfo.pingTimer = setTimeout(() => {
      this.sendPing(socketInfo);
    }, this.config.pingInterval);
  }

  private sendPing(socketInfo: SocketHeartbeatInfo): void {
    if (!socketInfo.socket.connected) {
      return this.removeSocket(socketInfo.socket.id);
    }

    socketInfo.lastPingTime = Date.now();
    socketInfo.socket.emit('ping');
    this.emit('ping-sent', socketInfo.socket.id, socketInfo.lastPingTime);

    if (this.config.enableLogging) {
      logger.debug(`Ping enviado a socket ${socketInfo.socket.id}.`);
    }

    // Limpiar timer de pong anterior y establecer uno nuevo
    if(socketInfo.pongTimer) clearTimeout(socketInfo.pongTimer);
    socketInfo.pongTimer = setTimeout(() => {
      this.handlePongTimeout(socketInfo);
    }, this.config.pongTimeout);
  }

  private handlePong(socketInfo: SocketHeartbeatInfo): void {
    // Si no estábamos esperando un pong (ej. ya hubo timeout), ignorar.
    if (!socketInfo.pongTimer) return;

    clearTimeout(socketInfo.pongTimer);
    socketInfo.pongTimer = undefined;

    const timestamp = Date.now();
    const latency = socketInfo.lastPingTime ? timestamp - socketInfo.lastPingTime : 0;

    // Si había fallado antes, consideramos la conexión restaurada.
    if (socketInfo.failedPings > 0) {
      this.emit('connection-restored', socketInfo.socket.id, socketInfo.socket);
      if (this.config.enableLogging) {
        logger.info(`Conexión restaurada para socket ${socketInfo.socket.id}.`);
      }
    }
    
    socketInfo.failedPings = 0;
    
    this.emit('pong-received', socketInfo.socket.id, timestamp, latency);

    if (this.config.enableLogging) {
        logger.debug(`Pong recibido de ${socketInfo.socket.id}. Latencia: ${latency}ms.`);
    }
    
    // Programar el siguiente ping
    this.schedulePing(socketInfo);
  }

  private handlePongTimeout(socketInfo: SocketHeartbeatInfo): void {
    socketInfo.pongTimer = undefined; // El timer ya se disparó
    socketInfo.failedPings++;

    this.emit('ping-timeout', socketInfo.socket.id, socketInfo.failedPings);

    if (this.config.enableLogging) {
      logger.warn(`Timeout de pong para socket ${socketInfo.socket.id}. Fallos: ${socketInfo.failedPings}`);
    }

    if (socketInfo.failedPings >= this.config.maxFailedPings) {
      if (this.config.enableLogging) {
        logger.error(`Conexión perdida para socket ${socketInfo.socket.id}.`);
      }
      this.emit('connection-lost', socketInfo.socket.id, socketInfo.socket);
      socketInfo.socket.disconnect(true); // El evento 'disconnect' se encargará de la limpieza.
    } else {
      // Reintentar inmediatamente para comprobar si la conexión vuelve.
      this.sendPing(socketInfo);
    }
  }

  private clearSocketTimers(socketInfo: SocketHeartbeatInfo): void {
    if (socketInfo.pingTimer) clearTimeout(socketInfo.pingTimer);
    if (socketInfo.pongTimer) clearTimeout(socketInfo.pongTimer);
    socketInfo.pingTimer = undefined;
    socketInfo.pongTimer = undefined;
  }
}

export const defaultHeartbeatManager = new HeartbeatManager();
