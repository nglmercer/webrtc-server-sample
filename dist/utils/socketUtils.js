"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleDisconnect = handleDisconnect;
const roomUtils_1 = require("./roomUtils");
const pushLogs_1 = __importDefault(require("../pushLogs"));
function handleDisconnect(socket, listOfRooms, listOfUsers, autoCloseEntireSession, config) {
    return () => {
        try {
            if (socket && socket.nsp && socket.nsp.sockets) {
                delete socket.nsp.sockets[socket.id];
            }
        }
        catch (e) {
            (0, pushLogs_1.default)(config, "disconnect.cleanup", e);
        }
        try {
            if (listOfUsers[socket.userid]) {
                for (const s in listOfUsers[socket.userid].connectedWith) {
                    listOfUsers[socket.userid].connectedWith[s].emit("user-disconnected", socket.userid);
                    if (listOfUsers[s] && listOfUsers[s].connectedWith[socket.userid]) {
                        delete listOfUsers[s].connectedWith[socket.userid];
                    }
                }
            }
        }
        catch (e) {
            (0, pushLogs_1.default)(config, "disconnect.notify", e);
        }
        (0, roomUtils_1.closeOrShiftRoom)(socket, listOfRooms, listOfUsers, autoCloseEntireSession, config);
        delete listOfUsers[socket.userid];
        if (socket.ondisconnect) {
            try {
                socket.ondisconnect();
            }
            catch (e) {
                (0, pushLogs_1.default)(config, "socket.ondisconnect", e);
            }
        }
    };
}
