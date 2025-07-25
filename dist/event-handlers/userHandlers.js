"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerUserHandlers = registerUserHandlers;
const constants_1 = require("../constants");
const pushLogs_1 = __importDefault(require("../pushLogs"));
const userUtils_1 = require("../utils/userUtils");
function registerUserHandlers(socket, listOfRooms, listOfUsers, config, params) {
    socket.on("extra-data-updated", (extra) => {
        try {
            if (!listOfUsers[socket.userid])
                return;
            listOfUsers[socket.userid].extra = extra;
            Object.values(listOfUsers[socket.userid].connectedWith).forEach((userSocket) => {
                userSocket.emit("extra-data-updated", socket.userid, extra);
            });
            if (socket.admininfo?.sessionid) {
                const room = listOfRooms[socket.admininfo.sessionid];
                if (room) {
                    if (socket.userid === room.owner) {
                        room.extra = extra;
                    }
                    room.participants.forEach((pid) => {
                        if (listOfUsers[pid]) {
                            listOfUsers[pid].socket.emit("extra-data-updated", socket.userid, extra);
                        }
                    });
                }
            }
        }
        catch (e) {
            (0, pushLogs_1.default)(config, "extra-data-updated", e);
        }
    });
    socket.on("get-remote-user-extra-data", (remoteUserId, callback) => {
        callback = callback || function () { };
        if (!remoteUserId || !listOfUsers[remoteUserId]) {
            return callback(constants_1.CONST_STRINGS.USERID_NOT_AVAILABLE);
        }
        callback(listOfUsers[remoteUserId].extra);
    });
    socket.on("changed-uuid", (newUserId, callback) => {
        callback = callback || function () { };
        if (listOfUsers[socket.userid]) {
            if (newUserId === socket.userid)
                return;
            const oldUserId = socket.userid;
            listOfUsers[newUserId] = listOfUsers[oldUserId];
            listOfUsers[newUserId].socket.userid = socket.userid = newUserId;
            delete listOfUsers[oldUserId];
            callback();
        }
        else {
            socket.userid = newUserId;
            (0, userUtils_1.appendUser)(socket, params, listOfUsers, config);
            callback();
        }
    });
    socket.on("disconnect-with", (remoteUserId, callback) => {
        try {
            if (listOfUsers[socket.userid]?.connectedWith[remoteUserId]) {
                delete listOfUsers[socket.userid].connectedWith[remoteUserId];
                socket.emit("user-disconnected", remoteUserId);
            }
            if (listOfUsers[remoteUserId]?.connectedWith[socket.userid]) {
                delete listOfUsers[remoteUserId].connectedWith[socket.userid];
                listOfUsers[remoteUserId].socket.emit("user-disconnected", socket.userid);
            }
            callback();
        }
        catch (e) {
            (0, pushLogs_1.default)(config, "disconnect-with", e);
        }
    });
}
