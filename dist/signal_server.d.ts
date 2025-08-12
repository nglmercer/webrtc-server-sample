import type { User, Room, ISocket } from "./types.js";
import { SocketIOLikeSocket } from "./adapters/SocketIOLikeAdapter.js";
import { HeartbeatConfig } from "./heartbeat/index.js";
/**
 * SignalingServer maneja toda la lógica, el estado y las conexiones
 * para un servidor de señalización WebRTC.
 */
export interface SignalConfig {
    heartbeat?: HeartbeatConfig;
    maxParticipantsAllowed?: number;
    [key: string]: any;
}
export declare class SignalingServer {
    private listOfRooms;
    private listOfUsers;
    private config;
    /**
     * Construye una nueva instancia del servidor de señalización.
     * @param {any} config - Opciones de configuración para el servidor.
     */
    constructor(config?: SignalConfig);
    /**
     * Maneja una nueva conexión de socket. Este es el punto de entrada para cada cliente.
     * @param {ISocket | WebSocketAdapter} socket - El socket del cliente que se conecta.
     * @returns {ISocket} El socket procesado.
     */
    handleConnection(socket: ISocket | SocketIOLikeSocket): ISocket;
    /**
     * Configura el gestor de heartbeat
     */
    private setupHeartbeatManager;
    /**
     * Obtiene una copia de la lista de todas las salas activas.
     * @returns {{ [key: string]: Room }} Un objeto con todas las salas.
     */
    getRooms(): {
        [key: string]: Room;
    };
    /**
     * Obtiene una copia de la lista de todos los usuarios conectados.
     * @returns {{ [key: string]: User }} Un objeto con todos los usuarios.
     */
    getUsers(): {
        [key: string]: User;
    };
    /**
     * Obtiene los detalles de una sala específica por su ID.
     * @param {string} roomId - El ID de la sala a buscar.
     * @returns {Room | undefined} El objeto de la sala o undefined si no se encuentra.
     */
    getRoomById(roomId: string): Room | undefined;
    /**
     * Obtiene los detalles de un usuario específico por su ID.
     * @param {string} userId - El ID del usuario a buscar.
     * @returns {User | undefined} El objeto del usuario o undefined si no se encuentra.
     */
    getUserById(userId: string): User | undefined;
    /**
     * Expulsa a un usuario del servidor, cerrando su conexión.
     * @param {string} userId - El ID del usuario a expulsar.
     * @returns {boolean} True si el usuario fue encontrado y se le envió la orden de desconexión, false en caso contrario.
     */
    kickUser(userId: string): boolean;
    /**
     * Cierra forzosamente una sala y desconecta a todos sus participantes.
     * @param {string} roomId - El ID de la sala a cerrar.
     * @returns {boolean} True si la sala fue encontrada y cerrada, false en caso contrario.
     */
    closeRoom(roomId: string): boolean;
    /**
     * Obtiene estadísticas de conexión de todos los sockets conectados.
     * @returns {Object} Estadísticas de conexión.
     */
    getConnectionStats(): any;
    /**
     * Obtiene el estado del HeartbeatManager.
     * @returns {Object} Estado del heartbeat manager.
     */
    getHeartbeatStatus(): any;
    /**
     * Detiene el HeartbeatManager.
     */
    stopHeartbeat(): void;
    /**
     * Reinicia el HeartbeatManager.
     */
    restartHeartbeat(): void;
}
declare const signalingServer: SignalingServer;
export default signalingServer;
//# sourceMappingURL=signal_server.d.ts.map