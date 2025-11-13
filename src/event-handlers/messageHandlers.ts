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
function relayMessage(socket: CustomSocket, message:any, listOfUsers: { [key: string]: User }) {
    const remoteUserId = message.remoteUserId;
    const remoteUser = listOfUsers[remoteUserId];

    // 1. Verificación de seguridad: ¿Existe el destinatario?
    if (!remoteUser) {
        console.warn(`[Server] Intento de enviar mensaje a un usuario no encontrado: ${remoteUserId}`);
        socket.emit("user-not-found", remoteUserId); // Notificar al remitente si se desea
        return;
    }

    // 2. Adjuntar información extra del remitente si es necesario.
    // El frontend no lo usa para señales WebRTC, pero es una buena práctica mantenerlo.
    if (listOfUsers[socket.userid]) {
        message.extra = listOfUsers[socket.userid].extra;
    }
    
    // 3. ¡La entrega! Reenviar el mensaje completo al socket del destinatario.
    // El destinatario recibirá exactamente el mismo objeto 'message' que envió el remitente.
    console.log(`[Server] Retransmitiendo mensaje de ${socket.userid} a ${remoteUserId}`);
    remoteUser.socket.emit(listOfUsers[remoteUserId].socketMessageEvent, message);
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
      if (message.remoteUserId === socket.userid) return;
      message.sender = socket.userid;
      if (message.remoteUserId && message.remoteUserId !== "system") {
          relayMessage(socket, message, listOfUsers);
      }
      if (message.remoteUserId && message.remoteUserId !== "system" && message.message.newParticipationRequest) {
        if (rooms[message.remoteUserId]) {
          joinARoom(socket, message, rooms, listOfUsers, socketMessageEvent);
          return;
        }
      }

      if (message.remoteUserId === "system" && message.message.detectPresence) {
        if (message.message.userid === socket.userid) return callback(false, socket.userid);
        return callback(!!listOfUsers[message.message.userid], message.message.userid);
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
