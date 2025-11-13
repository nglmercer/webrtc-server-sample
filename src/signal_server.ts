import pushLogs from "./logger/pushLogs.js";
import { CONST_STRINGS } from "./constants.js";
import type { User, Room, CustomSocket, ISocket } from "./types.js";
import { appendUser } from "./utils/userUtils.js";
import {
  handleDisconnect,
  setupHeartbeat,
  getSocketStats,
  isSocketConnected,
} from "./utils/socketUtils.js";
import { registerRoomHandlers } from "./event-handlers/roomHandlers.js";
import { registerUserHandlers } from "./event-handlers/userHandlers.js";
import { registerMessageHandlers } from "./event-handlers/messageHandlers.js";
import { SocketIOLikeSocket } from "./adapters/SocketIOLikeAdapter.js";
import { nanoid } from "nanoid";
import {
  defaultHeartbeatManager,
  HeartbeatConfig,
  getHeartbeatConfig,
} from "./heartbeat/index.js";
import { defaultLogger as logger } from "./logger/index.js";

/**
 * SignalingServer maneja toda la lógica, el estado y las conexiones
 * para un servidor de señalización WebRTC.
 */
export interface SignalConfig {
  heartbeat?: HeartbeatConfig;
  maxParticipantsAllowed?: number;
  [key: string]: any;
}
export class SignalingServer {
  private listOfRooms: { [key: string]: Room } = {};
  private listOfUsers: { [key: string]: User } = {};
  private config: SignalConfig;

  /**
   * Construye una nueva instancia del servidor de señalización.
   * @param {any} config - Opciones de configuración para el servidor.
   */
  constructor(config: SignalConfig = {}) {
    this.config = config;

    // Configurar heartbeat si está habilitado
    if (this.config.heartbeat) {
      this.setupHeartbeatManager(config.heartbeat);
    }

    logger.info("SignalingServer instance created", {
      data: this.config.heartbeat,
    });
  }

  /**
   * Maneja una nueva conexión de socket. Este es el punto de entrada para cada cliente.
   * @param {ISocket | WebSocketAdapter} socket - El socket del cliente que se conecta.
   * @returns {ISocket} El socket procesado.
   */
  public handleConnection(socket: ISocket | SocketIOLikeSocket): ISocket {
    const customSocket = socket as CustomSocket;
    let params = customSocket.handshake.query as any;

    // ✅ VALIDACIÓN INICIAL DEL SOCKET
    if (!customSocket.handshake) {
      console.error(`[Server] Socket sin handshake válido`);
      socket.disconnect();
      return customSocket;
    }

    const generateUniqueUserId = (): string => {
      let newId: string;
      let attempts = 0;
      const maxAttempts = 100;
      
      do {
        newId = nanoid();
        attempts++;
      } while (this.listOfUsers[newId] && attempts < maxAttempts);
      
      if (attempts >= maxAttempts) {
        throw new Error('No se pudo generar un ID único después de múltiples intentos');
      }
      
      return newId;
    };

    // INICIALIZACIÓN Y VALIDACIÓN MEJORADA DE PARÁMETROS
    console.log(`[Server] Nueva conexión:`, { 
      socketId: customSocket.id, 
      query: params,
      userAgent: (customSocket.handshake as any)?.headers?.['user-agent']
    });

    if (!params.userid || typeof params.userid !== 'string' || params.userid.trim().length === 0) {
      const oldUserId = params.userid;
      params.userid = generateUniqueUserId();
      console.log(`[Server] userid inválido "${oldUserId}", generado nuevo: ${params.userid}`);
    }

    if (!params.sessionid || typeof params.sessionid !== 'string') {
      params.sessionid = nanoid();
      console.log(`[Server] sessionid inválido, generado nuevo: ${params.sessionid}`);
    }

    // VALIDACIÓN DE EXTRA
    if (params.extra) {
      try {
        if (typeof params.extra === 'string') {
          params.extra = JSON.parse(params.extra);
        } else if (typeof params.extra !== 'object') {
          params.extra = {};
        }
      } catch (e) {
        console.warn(`[Server] Error parseando extra:`, e);
        params.extra = {};
      }
    } else {
      params.extra = {};
    }

    // ✅ VERIFICACIÓN DE USUARIO EXISTENTE MEJORADA
    if (!!this.listOfUsers[params.userid]) {
      const useridAlreadyTaken = params.userid;
      const existingUser = this.listOfUsers[params.userid];
      
      console.warn(`[Server] userid "${useridAlreadyTaken}" ya tomado por socket ${existingUser.socket?.id}`);
      
      params.userid = generateUniqueUserId();
      
      customSocket.emit("userid-already-taken", {
        oldUserId: useridAlreadyTaken,
        newUserId: params.userid,
        reason: "userid_already_exists"
      });
    }

    // ✅ CONFIGURACIÓN DEL SOCKET
    const socketMessageEvent = (params.msgEvent as string) || "RTCMultiConnection-Message";
    (params as any).socketMessageEvent = socketMessageEvent;
    const autoCloseEntireSession = params.autoCloseEntireSession === "true";

    // --- Configuración del usuario y registro de eventos ---
    customSocket.userid = params.userid;
    appendUser(customSocket, params, this.listOfUsers, this.config);

    // Clear existing event handlers before registering new ones
    if ((customSocket as any).clearEventHandlers) {
      (customSocket as any).clearEventHandlers();
    }

    // Registrar todos los manejadores de eventos, pasando el estado de la instancia
    registerRoomHandlers(
      customSocket,
      this.listOfRooms,
      this.listOfUsers,
      this.config,
      params,
    );
    registerUserHandlers(
      customSocket,
      this.listOfRooms,
      this.listOfUsers,
      this.config,
      params,
    );
    registerMessageHandlers(
      customSocket,
      this.listOfRooms,
      this.listOfUsers,
      socketMessageEvent,
      this.config,
    );

    // Configurar heartbeat si está habilitado
    if (this.config.heartbeat) {
      setupHeartbeat(customSocket, this.config);
    }

    // Manejar la desconexión
    customSocket.on(
      "disconnect",
      handleDisconnect(
        customSocket,
        this.listOfRooms,
        this.listOfUsers,
        autoCloseEntireSession,
        this.config,
      ),
    );

    logger.info(`User connected: ${customSocket.userid}`, {
      socketId: customSocket.id,
    });

    return customSocket;
  }

  // --- API PÚBLICA PARA GESTIONAR SALAS Y USUARIOS ---

  /**
   * Configura el gestor de heartbeat
   */
  private setupHeartbeatManager(
    heartbeatConfig?: Partial<HeartbeatConfig>,
  ): void {
    try {
      // Usar configuración del entorno si está disponible
      const envConfig = process.env.NODE_ENV
        ? getHeartbeatConfig(process.env.NODE_ENV as any)
        : getHeartbeatConfig("production");

      const finalConfig = {
        ...envConfig,
        ...heartbeatConfig,
      };

      // Configurar eventos del heartbeat manager
      defaultHeartbeatManager.on("connection-lost", (socketId, socket) => {
        logger.warn(`Conexión perdida detectada para socket ${socketId}`, {
          socketId,
        });
        // El socket ya será desconectado automáticamente por el HeartbeatManager
      });

      defaultHeartbeatManager.on("connection-restored", (socketId, socket) => {
        logger.info(`Conexión restaurada para socket ${socketId}`, {
          socketId,
        });
      });

      defaultHeartbeatManager.on("ping-timeout", (socketId, failedCount) => {
        logger.debug(
          `Ping timeout para socket ${socketId}, intentos fallidos: ${failedCount}`,
          { data: finalConfig },
        );
      });
      defaultHeartbeatManager.config = finalConfig;
      // Iniciar el heartbeat manager
      defaultHeartbeatManager.start();

      logger.info("HeartbeatManager configurado y iniciado", {
        config: finalConfig,
      });
    } catch (error) {
      logger.error("Error configurando HeartbeatManager:", error);
    }
  }

  /**
   * Obtiene una copia de la lista de todas las salas activas.
   * @returns {{ [key: string]: Room }} Un objeto con todas las salas.
   */
  public getRooms(): { [key: string]: Room } {
    return { ...this.listOfRooms };
  }

  /**
   * Obtiene los detalles de una sala específica por su ID.
   * @param {string} roomId - El ID de la sala a buscar.
   * @returns {Room | undefined} El objeto de la sala o undefined si no se encuentra.
   */
  public getRoom(roomId: string): Room | undefined {
    return this.listOfRooms[roomId];
  }

  /**
   * Verifica si existe una sala específica.
   * @param {string} roomId - El ID de la sala a verificar.
   * @returns {boolean} True si la sala existe, false en caso contrario.
   */
  public roomExists(roomId: string): boolean {
    return roomId in this.listOfRooms;
  }

  /**
   * Verifica si existe un usuario específico.
   * @param {string} userId - El ID del usuario a verificar.
   * @returns {boolean} True si el usuario existe, false en caso contrario.
   */
  public userExists(userId: string): boolean {
    return userId in this.listOfUsers;
  }

  /**
   * Obtiene una copia de la lista de todos los usuarios conectados.
   * @returns {{ [key: string]: User }} Un objeto con todos los usuarios.
   */
  public getUsers(): { [key: string]: User } {
    return { ...this.listOfUsers };
  }

  /**
   * Obtiene los detalles de una sala específica por su ID.
   * @param {string} roomId - El ID de la sala a buscar.
   * @returns {Room | undefined} El objeto de la sala o undefined si no se encuentra.
   */
  public getRoomById(roomId: string): Room | undefined {
    return this.listOfRooms[roomId];
  }

  /**
   * Obtiene los detalles de un usuario específico por su ID.
   * @param {string} userId - El ID del usuario a buscar.
   * @returns {User | undefined} El objeto del usuario o undefined si no se encuentra.
   */
  public getUserById(userId: string): User | undefined {
    return this.listOfUsers[userId];
  }

  /**
   * Obtiene los detalles de un usuario específico por su ID (alias de getUserById).
   * @param {string} userId - El ID del usuario a buscar.
   * @returns {User | undefined} El objeto del usuario o undefined si no se encuentra.
   */
  public getUser(userId: string): User | undefined {
    return this.listOfUsers[userId];
  }

  /**
   * Expulsa a un usuario del servidor, cerrando su conexión.
   * @param {string} userId - El ID del usuario a expulsar.
   * @returns {boolean} True si el usuario fue encontrado y se le envió la orden de desconexión, false en caso contrario.
   */
  public kickUser(userId: string): boolean {
    const user = this.listOfUsers[userId];
    if (user) {
      console.log(`Kicking user: ${userId}`);
      user.socket.emit(
        "kicked-by-admin",
        "Has sido desconectado por un administrador.",
      );
      user.socket.disconnect(true); // El evento 'disconnect' se encargará de la limpieza.
      return true;
    }
    console.warn(`Attempted to kick non-existent user: ${userId}`);
    return false;
  }

  /**
   * Cierra forzosamente una sala y desconecta a todos sus participantes.
   * @param {string} roomId - El ID de la sala a cerrar.
   * @returns {boolean} True si la sala fue encontrada y cerrada, false en caso contrario.
   */
  public closeRoom(roomId: string): boolean {
    const room = this.listOfRooms[roomId];
    if (room) {
      console.log(`Closing room by admin: ${roomId}`);
      // Notificar y desconectar a cada participante
      room.participants.forEach((userId) => {
        const user = this.listOfUsers[userId];
        if (user) {
          user.socket.emit(
            "room-closed-by-admin",
            roomId,
            "La sala ha sido cerrada por un administrador.",
          );
          user.socket.disconnect(true);
        }
      });
      // El evento 'disconnect' de cada socket limpiará a los usuarios.
      // Finalmente, eliminamos la sala.
      delete this.listOfRooms[roomId];
      return true;
    }
    console.warn(`Attempted to close non-existent room: ${roomId}`);
    return false;
  }

  /**
   * Obtiene estadísticas de conexión de todos los sockets conectados.
   * @returns {Object} Estadísticas de conexión.
   */
  public getConnectionStats(): any {
    const stats = {
      totalUsers: Object.keys(this.listOfUsers).length,
      totalRooms: Object.keys(this.listOfRooms).length,
      heartbeatEnabled: this.config.heartbeat,
      connections: [] as any[],
    };

    // Obtener estadísticas de cada usuario conectado
    Object.values(this.listOfUsers).forEach((user) => {
      if (user.socket) {
        const socketStats = getSocketStats(user.socket);
        stats.connections.push({
          userId: user.userid,
          socketId: user.socket.id,
          ...socketStats,
        });
      }
    });

    return stats;
  }

  /**
   * Obtiene el estado del HeartbeatManager.
   * @returns {Object} Estado del heartbeat manager.
   */
  public getHeartbeatStatus(): any {
    if (!this.config.heartbeat) {
      return { enabled: false, message: "Heartbeat disabled" };
    }

    return {
      enabled: true,
      isRunning: defaultHeartbeatManager.isRunning,
      activeSockets: defaultHeartbeatManager.sockets.size,
      config: defaultHeartbeatManager.config,
    };
  }

  /**
   * Detiene el HeartbeatManager.
   */
  public stopHeartbeat(): void {
    if (this.config.heartbeat) {
      defaultHeartbeatManager.stop();
      logger.info("HeartbeatManager detenido", {});
    }
  }

  /**
   * Reinicia el HeartbeatManager.
   */
  public restartHeartbeat(): void {
    if (this.config.heartbeat) {
      defaultHeartbeatManager.stop();
      defaultHeartbeatManager.start();
      logger.info("HeartbeatManager reiniciado", {});
    }
  }
}

// ==================================================================
// EXPORTACIÓN POR DEFECTO
// ==================================================================
// Se crea y exporta una instancia única (patrón Singleton) para un uso sencillo y rápido.
// Esto permite que toda tu aplicación comparta el mismo estado del servidor.

const signalingServer = new SignalingServer();
export default signalingServer;
