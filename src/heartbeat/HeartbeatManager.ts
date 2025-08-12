import { EventEmitter } from 'events';
import { CustomSocket } from '../types';
import { logger } from '../logger/index.js';

/**
 * Configuración del sistema de heartbeat
 */
export interface HeartbeatConfig {
  enableHeartbeat: boolean;
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
  currentPingId?: string; // ID único para cada ping
  pendingPings: Set<string>; // Set de pings pendientes
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
  private cleanupInterval?: NodeJS.Timeout;

  constructor(config: Partial<HeartbeatConfig> = {}) {
    super();
    logger.debug("HeartbeatManager constructor",config);

    // Configuración por defecto
    this.config = {
      pingInterval: 60000, // 60 segundos
      pongTimeout: 10000,  // 10 segundos
      maxFailedPings: 3,   // 3 intentos fallidos
      enableLogging: false,
      enableHeartbeat: true,
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
  public start(config: Partial<HeartbeatConfig> = {}): void {
      this.config = {
        ...this.config,
        ...config
      }
    if (!config || !config.enableHeartbeat) {
      return;
    }
    if (this.isRunning) {
      logger.warn('HeartbeatManager ya está ejecutándose',{
        data:  this.isRunning
      });
      return;
    }

    this.isRunning = true;
    
    // Iniciar limpieza periódica automática
    this.startPeriodicCleanup();
    
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
    
    // Detener limpieza periódica
    this.stopPeriodicCleanup();
    
    // Limpiar todos los timers activos
    for (const [socketId, info] of this.sockets) {
      this.clearSocketTimers(info);
      info.pendingPings.clear();
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
      isAlive: true,
      pendingPings: new Set()
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
    
    // Limpiar pings pendientes
    socketInfo.pendingPings.clear();
    
    this.sockets.delete(socketId);

    if (this.config.enableLogging) {
      logger.debug(`Socket ${socketId} removido del heartbeat manager`,{
        data: {
          socketId,
          totalSockets: this.sockets.size
        }
      });
    }
  }

  /**
   * Limpia sockets desconectados automáticamente
   */
  public cleanupDisconnectedSockets(): number {
    let cleanedCount = 0;
    const socketsToRemove: string[] = [];
    
    for (const [socketId, socketInfo] of this.sockets) {
      if (!socketInfo.socket.id) {
        socketsToRemove.push(socketId);
      }
    }
    
    for (const socketId of socketsToRemove) {
      this.removeSocket(socketId);
      cleanedCount++;
    }
    
    if (this.config.enableLogging) {
      logger.info(`Limpieza automática: ${cleanedCount} sockets desconectados removidos`,{
        data: {
          cleanedCount,
          totalSockets: this.sockets.size
        }
      });
    }
    
    return cleanedCount;
  }

  /**
   * Obtiene estadísticas del heartbeat
   */
  public getStats(): {
    totalSockets: number;
    aliveSockets: number;
    deadSockets: number;
    socketsWithFailedPings: number;
    totalPendingPings: number;
    connectedSockets: number;
  } {
    let aliveSockets = 0;
    let deadSockets = 0;
    let socketsWithFailedPings = 0;
    let totalPendingPings = 0;
    let connectedSockets = 0;

    for (const [, info] of this.sockets) {
      if (info.isAlive) {
        aliveSockets++;
      } else {
        deadSockets++;
      }
      
      if (info.failedPings > 0) {
        socketsWithFailedPings++;
      }
      
      if (info.socket.id) {
        connectedSockets++;
      }
      
      totalPendingPings += info.pendingPings.size;
    }

    return {
      totalSockets: this.sockets.size,
      aliveSockets,
      deadSockets,
      socketsWithFailedPings,
      totalPendingPings,
      connectedSockets
    };
  }

  /**
   * Inicia limpieza periódica de sockets desconectados
   */
  public startPeriodicCleanup(intervalMs: number = 60000): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    this.cleanupInterval = setInterval(() => {
      this.cleanupDisconnectedSockets();
    }, intervalMs);
    
    if (this.config.enableLogging) {
      logger.info(`Limpieza periódica iniciada cada ${intervalMs}ms`,{});
    }
  }

  /**
   * Detiene la limpieza periódica
   */
  public stopPeriodicCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
      
      if (this.config.enableLogging) {
        logger.info('Limpieza periódica detenida',{});
      }
    }
  }

  /**
   * Configura los manejadores de eventos para un socket
   */
  private setupSocketHandlers(socketInfo: SocketHeartbeatInfo): void {
    const { socket } = socketInfo;

    // Escuchar respuestas pong con ID único
    socket.on('pong', (pingId: string) => {
      if (this.config.enableLogging) {
        logger.log("Pong recibido con ID:", pingId);
      }
      this.handlePong(socketInfo, pingId);
    });

    // Escuchar desconexiones
    socket.on('disconnect', () => {
      if (this.config.enableLogging) {
        logger.debug(`Socket ${socket.id} desconectado, removiendo del heartbeat manager`,{});
      }
      this.removeSocket(socket.id);
    });

    // Escuchar errores del socket
    socket.on('error', (error: any) => {
      logger.error(`Error en socket ${socket.id}:`, error);
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

    if (!this.config.pongTimeout)return;
    socketInfo.pingTimer = setTimeout(() => {
      this.sendPing(socketInfo);
    }, this.config.pingInterval);
  }

  /**
   * Envía un ping a un socket
   */
  private sendPing(socketInfo: SocketHeartbeatInfo): void {
    const { socket } = socketInfo;
    
    // Verificar si el socket está conectado
    if (!socket.id) {
      if (this.config.enableLogging) {
        logger.warn(`Socket ${socket.id} no está conectado, removiendo del heartbeat manager`,{});
      }
      this.removeSocket(socket.id);
      return;
    }
    
    // Limpiar pings pendientes antiguos antes de enviar uno nuevo
    // Solo necesitamos verificar que está activo, no acumular múltiples pings
    if (socketInfo.pendingPings.size > 0) {
      if (this.config.enableLogging) {
        logger.debug(`Limpiando ${socketInfo.pendingPings.size} pings pendientes antiguos para socket ${socket.id}`,{
          data: { socketId: socket.id, pendingPings: socketInfo.pendingPings.size }
        });
      }
      socketInfo.pendingPings.clear();
    }
    
    // Limpiar timeout de pong anterior si existe
    if (socketInfo.pongTimer) {
      clearTimeout(socketInfo.pongTimer);
      socketInfo.pongTimer = undefined;
    }
    
    // Generar ID único para este ping
    const pingId = `${socket.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = Date.now();
    
    socketInfo.lastPingTime = timestamp;
    socketInfo.currentPingId = pingId;
    socketInfo.pendingPings.add(pingId);
    
    try {
      // Enviar ping con ID único
      socket.emit('ping', pingId);
      
      this.emit('ping-sent', socket.id, timestamp);
      
      if (this.config.enableLogging) {
        logger.debug(`Ping enviado a socket ${socket.id} con ID ${pingId}`,{
          data: { socketId: socket.id, pingId }
        });
      }
      
      // Configurar timeout para pong
      socketInfo.pongTimer = setTimeout(() => {
        this.handlePongTimeout(socketInfo, pingId);
      }, this.config.pongTimeout);
      
    } catch (error) {
      logger.error(`Error enviando ping a socket ${socket.id}:`, error);
      // Remover el ping del set de pendientes
      socketInfo.pendingPings.delete(pingId);
      this.handlePongTimeout(socketInfo, pingId);
    }
  }

  /**
   * Maneja la recepción de un pong
   */
  private handlePong(socketInfo: SocketHeartbeatInfo, pingId: string): void {
    const { socket } = socketInfo;
    const timestamp = Date.now();
    
    // Verificar que el pong corresponda a un ping pendiente
    if (!socketInfo.pendingPings.has(pingId)) {
      if (this.config.enableLogging) {
        logger.warn(`Pong recibido para ping no pendiente ${pingId} del socket ${socket.id}`,{});
      }
      return;
    }
    
    // Limpiar todos los pings pendientes ya que recibimos una respuesta válida
    // Solo necesitamos confirmar que la conexión está activa
    socketInfo.pendingPings.clear();
    
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
          latency,
          pingId
        });
      }
    }
    
    this.emit('pong-received', socket.id, timestamp, latency);
    
    if (this.config.enableLogging) {
      logger.debug(`Pong válido recibido de socket ${socket.id}, latencia: ${latency}ms, pingId: ${pingId}`,{
        latency,
        pingId,
        pendingPings: socketInfo.pendingPings.size
      });
    }
    
    // Programar el siguiente ping
    this.schedulePing(socketInfo);
  }

  /**
   * Maneja el timeout de pong (no se recibió respuesta)
   */
  private handlePongTimeout(socketInfo: SocketHeartbeatInfo, pingId?: string): void {
    const { socket } = socketInfo;
    
    // Si se proporciona un pingId, removerlo del set de pendientes
    if (pingId) {
      socketInfo.pendingPings.delete(pingId);
    }
    
    // Verificar si el socket aún está conectado
    if (!socket.id) {
      if (this.config.enableLogging) {
        logger.debug(`Socket ${socket.id} ya no está conectado durante timeout`,{});
      }
      this.removeSocket(socket.id);
      return;
    }
    
    socketInfo.failedPings++;
    
    this.emit('ping-timeout', socket.id, socketInfo.failedPings);
    
    if (this.config.enableLogging) {
      logger.warn(`Timeout de pong para socket ${socket.id}, intentos fallidos: ${socketInfo.failedPings}`,{
        data: {
          socketId: socket.id,
          failedPings: socketInfo.failedPings,
          pendingPings: socketInfo.pendingPings.size,
          pingId
        }
      });
    }
    
    if (socketInfo.failedPings >= this.config.maxFailedPings) {
      // Marcar conexión como perdida
      socketInfo.isAlive = false;
      this.emit('connection-lost', socket.id, socket);
      
      if (this.config.enableLogging) {
        logger.error(`Conexión perdida para socket ${socket.id} después de ${socketInfo.failedPings} intentos fallidos`, {
          socketId: socket.id,
          failedPings: socketInfo.failedPings
        });
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