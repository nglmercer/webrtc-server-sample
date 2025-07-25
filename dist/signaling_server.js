"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = signaling_server;
const userUtils_1 = require("./utils/userUtils");
const socketUtils_1 = require("./utils/socketUtils");
const roomHandlers_1 = require("./event-handlers/roomHandlers");
const userHandlers_1 = require("./event-handlers/userHandlers");
const messageHandlers_1 = require("./event-handlers/messageHandlers");
let listOfRooms = {};
let listOfUsers = {};
function signaling_server(socket, config = {}) {
    const customSocket = socket;
    function onConnection(socket) {
        let params = socket.handshake.query;
        if (!params.userid) {
            params.userid = (Math.random() * 100).toString().replace(".", "");
        }
        if (!params.sessionid) {
            params.sessionid = (Math.random() * 100).toString().replace(".", "");
        }
        if (params.extra) {
            try {
                params.extra = JSON.parse(params.extra);
            }
            catch (e) {
                params.extra = {};
            }
        }
        else {
            params.extra = {};
        }
        const socketMessageEvent = params.msgEvent || "RTCMultiConnection-Message";
        params.socketMessageEvent = socketMessageEvent;
        console.log("socketMessageEvent", socketMessageEvent);
        const autoCloseEntireSession = params.autoCloseEntireSession === "true";
        if (!!listOfUsers[params.userid]) {
            const useridAlreadyTaken = params.userid;
            params.userid = (Math.random() * 1000).toString().replace(".", "");
            socket.emit("userid-already-taken", useridAlreadyTaken, params.userid);
            return;
        }
        socket.userid = params.userid;
        (0, userUtils_1.appendUser)(socket, params, listOfUsers, config);
        // Registrar todos los manejadores de eventos
        (0, roomHandlers_1.registerRoomHandlers)(socket, listOfRooms, listOfUsers, config, params);
        (0, userHandlers_1.registerUserHandlers)(socket, listOfRooms, listOfUsers, config, params);
        (0, messageHandlers_1.registerMessageHandlers)(socket, listOfRooms, listOfUsers, socketMessageEvent, config);
        // Manejar la desconexión
        socket.on("disconnect", (0, socketUtils_1.handleDisconnect)(socket, listOfRooms, listOfUsers, autoCloseEntireSession, config));
    }
    onConnection(customSocket);
}
