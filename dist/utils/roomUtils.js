"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.appendToRoom = appendToRoom;
exports.closeOrShiftRoom = closeOrShiftRoom;
const pushLogs_1 = __importDefault(require("../pushLogs"));
function appendToRoom(roomid, userid, maxParticipants, listOfRooms) {
    if (!listOfRooms[roomid]) {
        listOfRooms[roomid] = {
            maxParticipantsAllowed: maxParticipants,
            owner: userid,
            participants: [userid],
            extra: {},
            socketMessageEvent: "",
            socketCustomEvent: "",
            identifier: "",
            session: {
                audio: true,
                video: true,
            },
        };
    }
    if (listOfRooms[roomid].participants.indexOf(userid) === -1) {
        listOfRooms[roomid].participants.push(userid);
    }
}
function closeOrShiftRoom(socket, listOfRooms, listOfUsers, autoCloseEntireSession, config) {
    try {
        if (!socket.admininfo) {
            return;
        }
        const roomid = socket.admininfo.sessionid;
        if (!roomid || !listOfRooms[roomid]) {
            return; // Si no hay roomid o el room no existe, salir temprano
        }
        const room = listOfRooms[roomid];
        // Si el socket es el owner del room
        if (socket.userid === room.owner) {
            if (!autoCloseEntireSession && room.participants.length > 1) {
                // Buscar un nuevo owner
                const newOwner = room.participants.find((pid) => pid !== socket.userid && listOfUsers[pid]);
                if (newOwner && listOfUsers[newOwner]) {
                    room.owner = newOwner;
                    listOfUsers[newOwner].socket.emit("set-isInitiator-true", roomid);
                }
                else {
                    // Si no hay nuevo owner válido, eliminar el room
                    delete listOfRooms[roomid];
                    return; // Salir ya que el room fue eliminado
                }
            }
            else {
                // Auto-cerrar toda la sesión o solo hay un participante
                delete listOfRooms[roomid];
                return; // Salir ya que el room fue eliminado
            }
        }
        // Verificar nuevamente si el room todavía existe antes de modificar participantes
        if (listOfRooms[roomid]) {
            const newParticipantsList = listOfRooms[roomid].participants.filter((pid) => pid !== socket.userid);
            listOfRooms[roomid].participants = newParticipantsList;
            // Si no quedan participantes, eliminar el room
            if (listOfRooms[roomid].participants.length === 0) {
                delete listOfRooms[roomid];
            }
        }
    }
    catch (e) {
        (0, pushLogs_1.default)(config, "closeOrShiftRoom", e);
    }
}
