import { EventEmitter } from 'events';
import { CustomSocket } from '../types';
import { logger } from '../logger';

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
export class HeartbeatManager extends EventEmitter {
  public config: HeartbeatConfig;
  public sockets: Map<string, SocketHeartbeatInfo> = new Map();
  public isRunning: boolean = false;

  constructor(config: Partial<HeartbeatConfig> = {}) {
    super();
    
    // Configuración por defecto
    this.config = {
      pingInterval: 30000, // 30 segundos
      pongTimeout: 10000,  // 10 segundos
      maxFailedPings: 3,   // 3 intentos fallidos
      enableLogging: false,
      ...config
    };

    if (this.config.enableLogging) {
      logger.info('HeartbeatManager inicializado', {
        data:  this.isRunning
      });
    }
  }

  /**
   * Inicia el sistema de heartbeat
   */
  public start(): void {
    if (this.isRunning) {
      logger.warn('HeartbeatManager ya está ejecutándose',{
        data:  this.isRunning
      });
      return;
    }

    this.isRunning = true;
    if (this.config.enableLogging) {
      logger.info('HeartbeatManager iniciado',{
        data:  this.isRunning
      });
    }
  }

  /**
   * Detiene el sistema de heartbeat
   */
  public stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    
    // Limpiar todos los timers activos
    for (const [socketId, info] of this.sockets) {
      this.clearSocketTimers(info);
    }
    
    this.sockets.clear();
    
    if (this.config.enableLogging) {
      logger.info('HeartbeatManager detenido',{
        data: this.sockets.size
      });
    }
  }

  /**
   * Registra un socket para monitoreo de heartbeat
   */
  public addSocket(socket: CustomSocket): void {
    if (!this.isRunning) {
      logger.warn('HeartbeatManager no está ejecutándose. Iniciando automáticamente.',{
        data:  this.isRunning
      });
      this.start();
    }

    const socketInfo: SocketHeartbeatInfo = {
      socket,
      failedPings: 0,
      isAlive: true
    };

    this.sockets.set(socket.id, socketInfo);
    
    // Configurar manejadores de eventos del socket
    this.setupSocketHandlers(socketInfo);
    
    // Iniciar el primer ping
    this.schedulePing(socketInfo);

    if (this.config.enableLogging) {
      logger.debug(`Socket ${socket.id} agregado al heartbeat manager`,{
        data: socket.id
      });
    }
  }

  /**
   * Remueve un socket del monitoreo de heartbeat
   */
  public removeSocket(socketId: string): void {
    const socketInfo = this.sockets.get(socketId);
    if (!socketInfo) {
      return;
    }

    this.clearSocketTimers(socketInfo);
    this.sockets.delete(socketId);

    if (this.config.enableLogging) {
      logger.debug(`Socket ${socketId} removido del heartbeat manager`,{
        data: socketId
      });
    }
  }

  /**
   * Obtiene estadísticas del heartbeat
   */
  public getStats(): {
    totalSockets: number;
    aliveSockets: number;
    deadSockets: number;
    socketsWithFailedPings: number;
  } {
    let aliveSockets = 0;
    let deadSockets = 0;
    let socketsWithFailedPings = 0;

    for (const [, info] of this.sockets) {
      if (info.isAlive) {
        aliveSockets++;
      } else {
        deadSockets++;
      }
      
      if (info.failedPings > 0) {
        socketsWithFailedPings++;
      }
    }

    return {
      totalSockets: this.sockets.size,
      aliveSockets,
      deadSockets,
      socketsWithFailedPings
    };
  }

  /**
   * Configura los manejadores de eventos para un socket
   */
  private setupSocketHandlers(socketInfo: SocketHeartbeatInfo): void {
    const { socket } = socketInfo;

    // Escuchar respuestas pong
    socket.on('pong', () => {
      this.handlePong(socketInfo);
    });

    // Escuchar desconexiones
    socket.on('disconnect', () => {
      this.removeSocket(socket.id);
    });
  }

  /**
   * Programa el próximo ping para un socket
   */
  private schedulePing(socketInfo: SocketHeartbeatInfo): void {
    if (!this.isRunning) {
      return;
    }

    socketInfo.pingTimer = setTimeout(() => {
      this.sendPing(socketInfo);
    }, this.config.pingInterval);
  }

  /**
   * Envía un ping a un socket
   */
  private sendPing(socketInfo: SocketHeartbeatInfo): void {
    const { socket } = socketInfo;
    const timestamp = Date.now();
    
    socketInfo.lastPingTime = timestamp;
    
    try {
      // Enviar ping
      socket.emit('ping', timestamp);
      
      this.emit('ping-sent', socket.id, timestamp);
      
      if (this.config.enableLogging) {
        logger.debug(`Ping enviado a socket ${socket.id}`,{
          data: socket.id
        });
      }
      
      // Configurar timeout para pong
      socketInfo.pongTimer = setTimeout(() => {
        this.handlePongTimeout(socketInfo);
      }, this.config.pongTimeout);
      
    } catch (error) {
      logger.error(`Error enviando ping a socket ${socket.id}:`, error);
      this.handlePongTimeout(socketInfo);
    }
  }

  /**
   * Maneja la recepción de un pong
   */
  private handlePong(socketInfo: SocketHeartbeatInfo): void {
    const { socket } = socketInfo;
    const timestamp = Date.now();
    
    socketInfo.lastPongTime = timestamp;
    socketInfo.failedPings = 0;
    
    // Limpiar timeout de pong
    if (socketInfo.pongTimer) {
      clearTimeout(socketInfo.pongTimer);
      socketInfo.pongTimer = undefined;
    }
    
    // Calcular latencia
    const latency = socketInfo.lastPingTime ? timestamp - socketInfo.lastPingTime : 0;
    
    // Si la conexión estaba marcada como muerta, restaurarla
    if (!socketInfo.isAlive) {
      socketInfo.isAlive = true;
      this.emit('connection-restored', socket.id, socket);
      
      if (this.config.enableLogging) {
        logger.info(`Conexión restaurada para socket ${socket.id}`,{
          latency
        });
      }
    }
    
    this.emit('pong-received', socket.id, timestamp, latency);
    
    if (this.config.enableLogging) {
      logger.debug(`Pong recibido de socket ${socket.id}, latencia: ${latency}ms`,{
        latency
      });
    }
    
    // Programar el siguiente ping
    this.schedulePing(socketInfo);
  }

  /**
   * Maneja el timeout de pong (no se recibió respuesta)
   */
  private handlePongTimeout(socketInfo: SocketHeartbeatInfo): void {
    const { socket } = socketInfo;
    
    socketInfo.failedPings++;
    
    this.emit('ping-timeout', socket.id, socketInfo.failedPings);
    
    if (this.config.enableLogging) {
      logger.warn(`Timeout de pong para socket ${socket.id}, intentos fallidos: ${socketInfo.failedPings}`,{
        data:socket.id
      });
    }
    
    if (socketInfo.failedPings >= this.config.maxFailedPings) {
      // Marcar conexión como perdida
      socketInfo.isAlive = false;
      this.emit('connection-lost', socket.id, socket);
      
      if (this.config.enableLogging) {
        logger.error(`Conexión perdida para socket ${socket.id} después de ${socketInfo.failedPings} intentos fallidos`,socket.id);
      }
      
      // Forzar desconexión
      try {
        socket.disconnect(true);
      } catch (error) {
        logger.error(`Error desconectando socket ${socket.id}:`, error);
      }
      
      // Remover del manager
      this.removeSocket(socket.id);
    } else {
      // Reintentar después de un intervalo más corto
      socketInfo.pingTimer = setTimeout(() => {
        this.sendPing(socketInfo);
      }, Math.min(this.config.pingInterval / 2, 5000)); // Máximo 5 segundos
    }
  }

  /**
   * Limpia los timers de un socket
   */
  private clearSocketTimers(socketInfo: SocketHeartbeatInfo): void {
    if (socketInfo.pingTimer) {
      clearTimeout(socketInfo.pingTimer);
      socketInfo.pingTimer = undefined;
    }
    
    if (socketInfo.pongTimer) {
      clearTimeout(socketInfo.pongTimer);
      socketInfo.pongTimer = undefined;
    }
  }
}

// Instancia por defecto
export const defaultHeartbeatManager = new HeartbeatManager();