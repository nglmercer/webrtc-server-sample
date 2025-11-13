import { User, Room, CustomSocket } from "../types.js";
import type {SignalConfig} from "../signal_server.js";
import pushLogs from "../logger/pushLogs.js";
import { SignalingAdapter } from "../adapters/SignalingAdapter.js";

function onMessageCallback(
  socket: CustomSocket,
  message: any,
  listOfUsers: { [key: string]: User },
  socketMessageEvent: string,
  config: SignalConfig
) {
  try {
    if (!listOfUsers[message.sender]) {
      socket.emit("user-not-found", message.sender);
      return;
    }

    const remoteUser = listOfUsers[message.remoteUserId];
    const sender = listOfUsers[message.sender];

    if (!message.message.userLeft && !sender.connectedWith[message.remoteUserId] && remoteUser) {
      sender.connectedWith[message.remoteUserId] = remoteUser.socket;
      sender.socket.emit("user-connected", message.remoteUserId);

      remoteUser.connectedWith[message.sender] = socket;
      remoteUser.socket.emit("user-connected", message.sender);
    }

    if (sender.connectedWith[message.remoteUserId]) {
      message.extra = listOfUsers[socket.userid].extra;
      sender.connectedWith[message.remoteUserId].emit(socketMessageEvent, message);
    }
  } catch (e) {
    pushLogs(config, "onMessageCallback", e);
  }
}

function joinARoom(
  socket: CustomSocket,
  message: any,
  listOfRooms: { [key: string]: Room },
  listOfUsers: { [key: string]: User },
  socketMessageEvent: string
) {
  const roomid = socket.admininfo!.sessionid;
  const room = listOfRooms[roomid];
  if (!room) return;
  if (room.participants.length >= room.maxParticipantsAllowed) return;

  const newUser = listOfUsers[socket.userid];
  if (!newUser) return;

  room.participants.forEach((pid) => {
    if (pid === socket.userid) return; // No conectarse consigo mismo

    const existingUser = listOfUsers[pid];
    if (existingUser) {
      // 1. Establecer la conexión bidireccional en el servidor
      newUser.connectedWith[pid] = existingUser.socket;
      existingUser.connectedWith[socket.userid] = newUser.socket;

      // 2. Notificar a ambos usuarios que la conexión se ha establecido
      newUser.socket.emit("user-connected", pid);
      existingUser.socket.emit("user-connected", socket.userid);
      
      console.log(`[Server] Linked ${socket.userid} and ${pid} in room ${roomid}`);
    }
  });
  // también se reenvíe, especialmente si se están negociando streams.
  if (room.session?.oneway || room.session?.broadcast) {
    if (listOfUsers[room.owner]) {
      message.remoteUserId = room.owner;
      listOfUsers[room.owner].socket.emit(socketMessageEvent, message);
    }
  } else {
    // Reenviar la solicitud de participación original a los demás
    room.participants.forEach((pid) => {
      if (pid !== socket.userid && listOfUsers[pid]) {
        message.remoteUserId = pid;
        listOfUsers[pid].socket.emit(socketMessageEvent, message);
      }
    });
  }
}
function relayMessage(socket: CustomSocket, message: any, listOfUsers: { [key: string]: User }) {
    const remoteUserId = message.remoteUserId;
    
    // ✅ VALIDACIÓN MEJORADA DE remoteUserId
    if (!remoteUserId || typeof remoteUserId !== 'string') {
        console.warn(`[Server] remoteUserId inválido:`, { remoteUserId, message });
        socket.emit("error", { type: "invalid-remote-userid", message: "remoteUserId inválido" });
        return;
    }
    
    // ✅ EVITAR AUTO-ENVÍO
    if (remoteUserId === socket.userid) {
        console.warn(`[Server] Intento de auto-envío bloqueado para usuario: ${socket.userid}`);
        return;
    }

    const remoteUser = listOfUsers[remoteUserId];
    
    // ✅ VERIFICACIÓN DE SEGURIDAD MEJORADA
    if (!remoteUser) {
        console.warn(`[Server] Usuario ${remoteUserId} no encontrado. Usuarios disponibles:`, Object.keys(listOfUsers));
        socket.emit("user-not-found", { 
            userId: remoteUserId, 
            availableUsers: Object.keys(listOfUsers),
            timestamp: Date.now()
        });
        return;
    }

    // ✅ VERIFICAR ESTADO DE CONEXIÓN DEL DESTINATARIO
    if (!remoteUser.socket) {
        console.warn(`[Server] Usuario ${remoteUserId} no tiene socket válido`);
        socket.emit("user-disconnected", remoteUserId);
        return;
    }

    // ✅ ADJUNTAR INFORMACIÓN DEL REMITENTE
    if (listOfUsers[socket.userid]) {
        message.senderInfo = {
            userid: socket.userid,
            extra: listOfUsers[socket.userid].extra,
            timestamp: Date.now()
        };
    }
    
    // ✅ ENTREGA DEL MENSAJE CON MEJOR LOGGING
    const messageEvent = remoteUser.socketMessageEvent || "RTCMultiConnection-Message";
    console.log(`[Server] Retransmitiendo mensaje de ${socket.userid} a ${remoteUserId} [evento: ${messageEvent}]`);
    
    try {
        remoteUser.socket.emit(messageEvent, message);
    } catch (error) {
        console.error(`[Server] Error al enviar mensaje a ${remoteUserId}:`, error);
        socket.emit("error", { type: "message-delivery-failed", target: remoteUserId });
    }
}

function handleWebRTCMessage(socket: CustomSocket, message: any, listOfUsers: { [key: string]: User }, signalingAdapter?: SignalingAdapter) {
    const { type, to, payload, from } = message;
    
    console.log(`[WebRTC] Handling ${type} message from ${from} to ${to}`);
    
    // Validate WebRTC message structure
    if (!type || !from) {
        console.warn('[WebRTC] Invalid WebRTC message structure:', message);
        return;
    }
    
    // Route through signaling adapter if available
    if (signalingAdapter) {
        signalingAdapter.sendSignalingMessage(message);
        return;
    }
    
    // Fallback to direct user routing
    if (to && to !== "system") {
        const targetUser = listOfUsers[to];
        if (targetUser) {
            // Send WebRTC message directly to target
            targetUser.socket.emit('webrtc-message', message);
            console.log(`[WebRTC] Routed ${type} from ${from} to ${to}`);
        } else {
            console.warn(`[WebRTC] Target user ${to} not found for ${type} message`);
            socket.emit('webrtc-error', { type: 'user-not-found', target: to });
        }
    } else if (to === "system") {
        // Handle system-level WebRTC messages
        handleWebRTCSystemMessage(socket, message, listOfUsers);
    }
}

function handleWebRTCSystemMessage(socket: CustomSocket, message: any, listOfUsers: { [key: string]: User }) {
    const { type, payload } = message;
    
    switch (type) {
        case 'detect-peers':
            // Respond with list of available peers for WebRTC connections
            const availablePeers = Object.keys(listOfUsers).filter(userId => userId !== socket.userid);
            socket.emit('webrtc-peers-list', { peers: availablePeers });
            console.log(`[WebRTC] Sent peers list to ${socket.userid}:`, availablePeers);
            break;
            
        case 'register-capabilities':
            // Register peer capabilities for WebRTC
            const capabilities = payload?.capabilities || [];
            console.log(`[WebRTC] Peer ${socket.userid} registered capabilities:`, capabilities);
            socket.emit('webrtc-capabilities-registered', { success: true });
            break;
            
        default:
            console.warn(`[WebRTC] Unknown system message type: ${type}`);
    }
}
// ✅ FUNCIÓN DE LIMPIEZA DE RECURSOS
function cleanupDisconnectedUsers(listOfUsers: { [key: string]: User }) {
    const disconnectedUsers: string[] = [];
    
    Object.entries(listOfUsers).forEach(([userId, user]) => {
        if (!user.socket) {
            disconnectedUsers.push(userId);
        }
    });
    
    disconnectedUsers.forEach(userId => {
        console.log(`[Server] Limpiando usuario desconectado: ${userId}`);
        delete listOfUsers[userId];
    });
    
    return disconnectedUsers.length;
}

// ✅ FUNCIÓN DE ESTADÍSTICAS DEL SERVIDOR
function getServerStats(rooms: { [key: string]: Room }, listOfUsers: { [key: string]: User }) {
    return {
        timestamp: Date.now(),
        rooms: {
            total: Object.keys(rooms).length,
            list: Object.keys(rooms).map(roomId => ({
                id: roomId,
                participants: rooms[roomId]?.participants?.length || 0,
                owner: rooms[roomId]?.owner
            }))
        },
        users: {
            total: Object.keys(listOfUsers).length,
            connected: Object.values(listOfUsers).filter(u => u.socket).length
        }
    };
}

// ✅ FUNCIÓN MEJORADA PARA MANEJO DE ROOMS VS USERS
function handleRoomVsUserRouting(socket: CustomSocket, message: any, rooms: { [key: string]: Room }, listOfUsers: { [key: string]: User }, socketMessageEvent: string) {
    if (message.remoteUserId && message.remoteUserId !== "system") {
        // Verificar si es un roomId o userId
        const isRoomId = rooms[message.remoteUserId] !== undefined;
        
        if (isRoomId) {
            console.log(`[Server] Mensaje dirigido a room ${message.remoteUserId}, reenviando a participantes`);
            const room = rooms[message.remoteUserId];
            
            room.participants.forEach(participantId => {
                if (participantId !== socket.userid && listOfUsers[participantId]) {
                    const participantMessage = { ...message, remoteUserId: participantId };
                    relayMessage(socket, participantMessage, listOfUsers);
                }
            });
        } else {
            // Es un userId directo
            relayMessage(socket, message, listOfUsers);
        }
    }
}

export function registerMessageHandlers(
  socket: CustomSocket,
  rooms: { [key: string]: Room },
  listOfUsers: { [key: string]: User },
  socketMessageEvent: string,
  config: any,
  signalingAdapter?: SignalingAdapter
) {
  // Check if socket has on method (for testing compatibility)
  if (typeof socket.on !== 'function') {
    console.warn('Socket does not have on method, skipping message handler registration');
    return;
  }

  socket.on(socketMessageEvent, (message: any, callback: (isPresent: boolean, userid: string) => void) => {
    try {
      // ✅ VALIDACIONES INICIALES
      if (!message) {
        console.warn(`[Server] Mensaje vacío recibido de ${socket.userid}`);
        return;
      }
      
      if (message.remoteUserId === socket.userid) {
        console.warn(`[Server] Intento de auto-envío bloqueado para ${socket.userid}`);
        return;
      }
      
      // ✅ ASIGNAR SENDER SIEMPRE
      message.sender = socket.userid;
      message.senderTimestamp = Date.now();
      
      // ✅ MANEJO DE PARTICIPATION REQUEST (ROOMS)
      if (message.remoteUserId && message.remoteUserId !== "system" && message.message?.newParticipationRequest) {
        const targetRoomId = message.remoteUserId;
        
        if (rooms[targetRoomId]) {
          console.log(`[Server] Procesando participation request para room ${targetRoomId}`);
          joinARoom(socket, message, rooms, listOfUsers, socketMessageEvent);
          return;
        } else {
          console.warn(`[Server] Room ${targetRoomId} no encontrada para participation request`);
          socket.emit("room-not-found", { roomId: targetRoomId });
          return;
        }
      }
      
      // ✅ MANEJO DE MENSAJES DIRECTOS (USUARIOS)
      handleRoomVsUserRouting(socket, message, rooms, listOfUsers, socketMessageEvent);

      // ✅ MANEJO DE MENSAJES DE SISTEMA
      if (message.remoteUserId === "system") {
        if (message.message?.detectPresence) {
          const targetUserId = message.message.userid;
          if (message.message.userid === socket.userid) {
            if (callback) callback(false, socket.userid);
            return;
          }
          const userExists = !!listOfUsers[targetUserId];
          if (callback) callback(userExists, targetUserId);
        }
      }

      if (!listOfUsers[message.sender]) {
        listOfUsers[message.sender] = { 
            socket, 
            connectedWith: {}, 
            extra: {}, 
            socketMessageEvent: "", 
            socketCustomEvent: "",
            userid: message.sender 
        };
      }

      onMessageCallback(socket, message, listOfUsers, socketMessageEvent, config);
    } catch (e) {
      console.error(`[Server] Error en socketMessageEvent:`, e);
      pushLogs(config, "on-socketMessageEvent", e);
    }
  });

  // WebRTC message handler for native WebRTC signaling
  socket.on('webrtc-message', (message: any) => {
    try {
      handleWebRTCMessage(socket, message, listOfUsers, signalingAdapter);
    } catch (e) {
      pushLogs(config, "on-webrtc-message", e);
    }
  });

  const dontDuplicateListeners: { [key: string]: string } = {};
  socket.on("set-custom-socket-event-listener", (customEvent: string) => {
    if (dontDuplicateListeners[customEvent]) return;
    dontDuplicateListeners[customEvent] = customEvent;

    socket.on(customEvent, (message: any) => {
        socket.broadcast.emit(customEvent, message);
    });
  });
}

// ✅ EXPORTAR PARA USO EXTERNO
export {
    relayMessage,
    joinARoom,
    handleWebRTCMessage,
    handleWebRTCSystemMessage,
    cleanupDisconnectedUsers,
    getServerStats,
    handleRoomVsUserRouting
};
