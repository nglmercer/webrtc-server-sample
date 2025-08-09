import { appendUser } from "./utils/userUtils.js";
import { handleDisconnect } from "./utils/socketUtils.js";
import { registerRoomHandlers } from "./event-handlers/roomHandlers.js";
import { registerUserHandlers } from "./event-handlers/userHandlers.js";
import { registerMessageHandlers } from "./event-handlers/messageHandlers.js";
import { nanoid } from 'nanoid';
let listOfRooms = {};
let listOfUsers = {};
export default function signaling_server(socket, config = {}) {
    const customSocket = socket;
    function onConnection(socket) {
        let params = socket.handshake.query;
        if (!params.userid) {
            params.userid = nanoid();
        }
        if (!params.sessionid) {
            params.sessionid = nanoid();
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
            params.userid = nanoid;
            socket.emit("userid-already-taken", useridAlreadyTaken, params.userid);
            return;
        }
        socket.userid = params.userid;
        appendUser(socket, params, listOfUsers, config);
        // Registrar todos los manejadores de eventos
        registerRoomHandlers(socket, listOfRooms, listOfUsers, config, params);
        registerUserHandlers(socket, listOfRooms, listOfUsers, config, params);
        registerMessageHandlers(socket, listOfRooms, listOfUsers, socketMessageEvent, config);
        // Manejar la desconexión
        socket.on("disconnect", handleDisconnect(socket, listOfRooms, listOfUsers, autoCloseEntireSession, config));
    }
    onConnection(customSocket);
    return socket;
}
//# sourceMappingURL=default_server.js.map