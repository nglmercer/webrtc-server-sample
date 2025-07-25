"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerMessageHandlers = registerMessageHandlers;
const pushLogs_1 = __importDefault(require("../pushLogs"));
function onMessageCallback(socket, message, listOfUsers, socketMessageEvent, config) {
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
    }
    catch (e) {
        (0, pushLogs_1.default)(config, "onMessageCallback", e);
    }
}
function joinARoom(socket, message, listOfRooms, listOfUsers, socketMessageEvent) {
    const roomid = socket.admininfo.sessionid;
    const room = listOfRooms[roomid];
    if (!room)
        return;
    if (room.participants.length >= room.maxParticipantsAllowed)
        return;
    const newUser = listOfUsers[socket.userid];
    if (!newUser)
        return;
    room.participants.forEach((pid) => {
        if (pid === socket.userid)
            return; // No conectarse consigo mismo
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
    }
    else {
        // Reenviar la solicitud de participación original a los demás
        room.participants.forEach((pid) => {
            if (pid !== socket.userid && listOfUsers[pid]) {
                message.remoteUserId = pid;
                listOfUsers[pid].socket.emit(socketMessageEvent, message);
            }
        });
    }
}
function relayMessage(socket, message, listOfUsers) {
    const remoteUserId = message.remoteUserId;
    const remoteUser = listOfUsers[remoteUserId];
    // 1. Verificación de seguridad: ¿Existe el destinatario?
    if (!remoteUser) {
        console.warn(`[Server] Intento de enviar mensaje a un usuario no encontrado: ${remoteUserId}`, remoteUser, message);
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
function registerMessageHandlers(socket, listOfRooms, listOfUsers, socketMessageEvent, config) {
    socket.on(socketMessageEvent, (message, callback) => {
        try {
            if (message.remoteUserId === socket.userid)
                return;
            message.sender = socket.userid;
            if (message.remoteUserId && message.remoteUserId !== "system") {
                relayMessage(socket, message, listOfUsers);
            }
            if (message.remoteUserId && message.remoteUserId !== "system" && message.message.newParticipationRequest) {
                if (listOfRooms[message.remoteUserId]) {
                    joinARoom(socket, message, listOfRooms, listOfUsers, socketMessageEvent);
                    return;
                }
            }
            if (message.remoteUserId === "system" && message.message.detectPresence) {
                if (message.message.userid === socket.userid)
                    return callback(false, socket.userid);
                return callback(!!listOfUsers[message.message.userid], message.message.userid);
            }
            if (!listOfUsers[message.sender]) {
                listOfUsers[message.sender] = { socket, connectedWith: {}, extra: {}, socketMessageEvent: "", socketCustomEvent: "" };
            }
            onMessageCallback(socket, message, listOfUsers, socketMessageEvent, config);
        }
        catch (e) {
            (0, pushLogs_1.default)(config, "on-socketMessageEvent", e);
        }
    });
    const dontDuplicateListeners = {};
    socket.on("set-custom-socket-event-listener", (customEvent) => {
        if (dontDuplicateListeners[customEvent])
            return;
        dontDuplicateListeners[customEvent] = customEvent;
        socket.on(customEvent, (message) => {
            socket.broadcast.emit(customEvent, message);
        });
    });
}
