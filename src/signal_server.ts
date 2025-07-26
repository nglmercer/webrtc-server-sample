import pushLogs from "./pushLogs";
import { CONST_STRINGS } from "./constants";
import { User, Room, CustomSocket, ISocket } from "./types";
import { appendUser } from "./utils/userUtils";
import { handleDisconnect } from "./utils/socketUtils";
import { registerRoomHandlers } from "./event-handlers/roomHandlers";
import { registerUserHandlers } from "./event-handlers/userHandlers";
import { registerMessageHandlers } from "./event-handlers/messageHandlers";
import { WebSocketAdapter } from "./WebSocketAdapter";
import { nanoid } from 'nanoid';

/**
 * SignalingServer maneja toda la lógica, el estado y las conexiones
 * para un servidor de señalización WebRTC.
 */
export class SignalingServer {
  private listOfRooms: { [key: string]: Room } = {};
  private listOfUsers: { [key: string]: User } = {};
  private config: any;

  /**
   * Construye una nueva instancia del servidor de señalización.
   * @param {any} config - Opciones de configuración para el servidor.
   */
  constructor(config: any = {}) {
    this.config = config;
    console.log("SignalingServer instance created.");
  }

  /**
   * Maneja una nueva conexión de socket. Este es el punto de entrada para cada cliente.
   * @param {ISocket | WebSocketAdapter} socket - El socket del cliente que se conecta.
   * @returns {ISocket} El socket procesado.
   */
  public handleConnection(socket: ISocket | WebSocketAdapter): ISocket {
    const customSocket = socket as CustomSocket;

    let params = customSocket.handshake.query as any;

    // --- Inicialización y validación de parámetros ---
    if (!params.userid) {
      params.userid = nanoid();
    }
    if (!params.sessionid) {
      params.sessionid = nanoid();
    }
    if (params.extra) {
      try {
        params.extra = JSON.parse(params.extra as string);
      } catch (e) {
        params.extra = {};
      }
    } else {
      params.extra = {};
    }

    const socketMessageEvent = (params.msgEvent as string) || "RTCMultiConnection-Message";
    (params as any).socketMessageEvent = socketMessageEvent;
    
    const autoCloseEntireSession = params.autoCloseEntireSession === "true";

    // --- Verificación de usuario existente ---
    if (!!this.listOfUsers[params.userid]) {
      const useridAlreadyTaken = params.userid;
      params.userid = nanoid();
      customSocket.emit("userid-already-taken", useridAlreadyTaken, params.userid);
      // No continuamos la conexión con el ID antiguo. El cliente debe reintentar con el nuevo.
      return customSocket;
    }

    // --- Configuración del usuario y registro de eventos ---
    customSocket.userid = params.userid;
    appendUser(customSocket, params, this.listOfUsers, this.config);

    // Registrar todos los manejadores de eventos, pasando el estado de la instancia
    registerRoomHandlers(customSocket, this.listOfRooms, this.listOfUsers, this.config, params);
    registerUserHandlers(customSocket, this.listOfRooms, this.listOfUsers, this.config, params);
    registerMessageHandlers(customSocket, this.listOfRooms, this.listOfUsers, socketMessageEvent, this.config);

    // Manejar la desconexión
    customSocket.on(
      "disconnect",
      handleDisconnect(
        customSocket,
        this.listOfRooms,
        this.listOfUsers,
        autoCloseEntireSession,
        this.config
      )
    );
    
    console.log(`User connected: ${customSocket.userid}`);
    return customSocket;
  }

  // --- API PÚBLICA PARA GESTIONAR SALAS Y USUARIOS ---

  /**
   * Obtiene una copia de la lista de todas las salas activas.
   * @returns {{ [key: string]: Room }} Un objeto con todas las salas.
   */
  public getRooms(): { [key: string]: Room } {
    return { ...this.listOfRooms };
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
   * Expulsa a un usuario del servidor, cerrando su conexión.
   * @param {string} userId - El ID del usuario a expulsar.
   * @returns {boolean} True si el usuario fue encontrado y se le envió la orden de desconexión, false en caso contrario.
   */
  public kickUser(userId: string): boolean {
    const user = this.listOfUsers[userId];
    if (user) {
      console.log(`Kicking user: ${userId}`);
      user.socket.emit('kicked-by-admin', 'Has sido desconectado por un administrador.');
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
        room.participants.forEach(userId => {
            const user = this.listOfUsers[userId];
            if (user) {
                user.socket.emit('room-closed-by-admin', roomId, 'La sala ha sido cerrada por un administrador.');
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
}

// ==================================================================
// EXPORTACIÓN POR DEFECTO
// ==================================================================
// Se crea y exporta una instancia única (patrón Singleton) para un uso sencillo y rápido.
// Esto permite que toda tu aplicación comparta el mismo estado del servidor.

const signalingServer = new SignalingServer();
export default signalingServer;