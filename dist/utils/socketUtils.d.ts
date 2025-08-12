import { User, Room, CustomSocket } from "../types";
export declare function handleDisconnect(socket: CustomSocket, listOfRooms: {
    [key: string]: Room;
}, listOfUsers: {
    [key: string]: User;
}, autoCloseEntireSession: boolean, config: any): (code?: number, reason?: string) => void;
/**
 * Configura el heartbeat para un socket
 */
export declare function setupHeartbeat(socket: CustomSocket, config: any): void;
/**
 * Obtiene estadísticas de conexión para un socket
 */
export declare function getSocketStats(socket: CustomSocket): {
    id: string;
    userid: string;
    isConnected: boolean;
    connectionInfo?: any;
};
/**
 * Verifica si un socket está realmente conectado
 */
export declare function isSocketConnected(socket: CustomSocket): boolean;
//# sourceMappingURL=socketUtils.d.ts.map