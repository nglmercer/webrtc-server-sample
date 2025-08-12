import { User, Room, CustomSocket } from "../types";
import { closeOrShiftRoom } from "./roomUtils.js";
import pushLogs from "../logger/pushLogs.js";
import { defaultLogger as logger } from "../logger/index.js";
import { defaultHeartbeatManager } from "../heartbeat/index.js";

export function handleDisconnect(
  socket: CustomSocket,
  listOfRooms: { [key: string]: Room },
  listOfUsers: { [key: string]: User },
  autoCloseEntireSession: boolean,
  config: any
) {
  return (code?: number, reason?: string) => {
    const startTime = Date.now();
    
    logger.info(`Iniciando proceso de desconexión para socket ${socket.id}`, {
      data: socket.userid,
      code,
      reason
    });

    // Remover del heartbeat manager
    try {
      defaultHeartbeatManager.removeSocket(socket.id);
    } catch (e) {
      logger.error("Error removiendo socket del heartbeat manager:", e);
    }

    // Limpiar referencias del socket en el namespace (Socket.IO)
    try {
      if (socket && socket.nsp && socket.nsp.sockets) {
        delete (socket.nsp.sockets as any)[socket.id];
      }
    } catch (e) {
      pushLogs(config, "disconnect.cleanup", e);
      logger.error("Error limpiando referencias del socket:", e);
    }

    // Notificar a usuarios conectados sobre la desconexión
    try {
      if (listOfUsers[socket.userid]) {
        const connectedUsers = Object.keys(listOfUsers[socket.userid].connectedWith);
        logger.debug(`Notificando desconexión a ${connectedUsers.length} usuarios conectados`,{});
        
        for (const s in listOfUsers[socket.userid].connectedWith) {
          try {
            listOfUsers[socket.userid].connectedWith[s].emit(
              "user-disconnected",
              socket.userid
            );

            if (listOfUsers[s] && listOfUsers[s].connectedWith[socket.userid]) {
              delete listOfUsers[s].connectedWith[socket.userid];
            }
          } catch (notifyError) {
            logger.error(`Error notificando desconexión al usuario ${s}:`, notifyError);
          }
        }
      }
    } catch (e) {
      pushLogs(config, "disconnect.notify", e);
      logger.error("Error notificando desconexión:", e);
    }

    // Manejar salas
    try {
      closeOrShiftRoom(
        socket,
        listOfRooms,
        listOfUsers,
        autoCloseEntireSession,
        config
      );
    } catch (e) {
      logger.error("Error manejando salas en desconexión:", e);
    }

    // Limpiar usuario de la lista
    try {
      delete listOfUsers[socket.userid];
    } catch (e) {
      logger.error("Error eliminando usuario de la lista:", e);
    }

    // Ejecutar callback de desconexión personalizado
    if ((socket as any).ondisconnect) {
      try {
        (socket as any).ondisconnect();
      } catch (e) {
        pushLogs(config, "disconnect.ondisconnect", e);
        logger.error("Error ejecutando callback de desconexión:", e);
      }
    }

    const duration = Date.now() - startTime;
    logger.info(`Proceso de desconexión completado para socket ${socket.id}`, {
      userid: socket.userid,
      duration: `${duration}ms`
    });
  };
}

/**
 * Configura el heartbeat para un socket
 */
export function setupHeartbeat(socket: CustomSocket, config: any): void {
  try {
    // Agregar al heartbeat manager
    defaultHeartbeatManager.addSocket(socket);
    
    logger.debug(`Heartbeat configurado para socket ${socket.id}`,config);
  } catch (error) {
    logger.error(`Error configurando heartbeat para socket ${socket.id}:`, error);
  }
}

/**
 * Obtiene estadísticas de conexión para un socket
 */
export function getSocketStats(socket: CustomSocket): {
  id: string;
  userid: string;
  isConnected: boolean;
  connectionInfo?: any;
} {
  const stats = {
    id: socket.id,
    userid: socket.userid,
    isConnected: true,
    connectionInfo: undefined as any
  };

  // Si es un WebSocketAdapter, obtener información adicional
  if (typeof (socket as any).getConnectionInfo === 'function') {
    try {
      stats.connectionInfo = (socket as any).getConnectionInfo();
      stats.isConnected = (socket as any).isAlive();
    } catch (error) {
      logger.error(`Error obteniendo información de conexión para socket ${socket.id}:`, error);
    }
  }

  return stats;
}

/**
 * Verifica si un socket está realmente conectado
 */
export function isSocketConnected(socket: CustomSocket): boolean {
  try {
    // Para WebSocketAdapter
    if (typeof (socket as any).isAlive === 'function') {
      return (socket as any).isAlive();
    }
    
    // Para Socket.IO
    if (socket.connected !== undefined) {
      return socket.connected;
    }
    
    // Fallback: asumir conectado si no hay información
    return true;
  } catch (error) {
    logger.error(`Error verificando estado de conexión para socket ${socket.id}:`, error);
    return false;
  }
}