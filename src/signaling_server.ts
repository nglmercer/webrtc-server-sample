import pushLogs from "./pushLogs";
import { CONST_STRINGS } from "./constants";
import { User, Room, CustomSocket, ISocket } from "./types";
import { appendUser } from "./utils/userUtils";
import { handleDisconnect } from "./utils/socketUtils";
import { registerRoomHandlers } from "./event-handlers/roomHandlers";
import { registerUserHandlers } from "./event-handlers/userHandlers";
import { registerMessageHandlers } from "./event-handlers/messageHandlers";

let listOfRooms: { [key: string]: Room } = {};
let listOfUsers: { [key: string]: User } = {};

export default function signaling_server(socket: ISocket, config: any = {}) {
  const customSocket = socket as CustomSocket;

  function onConnection(socket: CustomSocket) {
    let params = socket.handshake.query as any;

    if (!params.userid) {
      params.userid = (Math.random() * 100).toString().replace(".", "");
    }
    if (!params.sessionid) {
      params.sessionid = (Math.random() * 100).toString().replace(".", "");
    }
    if (params.extra) {
      try {
        params.extra = JSON.parse(params.extra as string);
      } catch (e) {
        params.extra = {};
      }
    } else {
      params.extra = {};
    }

    const socketMessageEvent =
      (params.msgEvent as string) || "RTCMultiConnection-Message";
    (params as any).socketMessageEvent = socketMessageEvent;
    console.log("socketMessageEvent", socketMessageEvent);
    const autoCloseEntireSession = params.autoCloseEntireSession === "true";

    if (!!listOfUsers[params.userid]) {
      const useridAlreadyTaken = params.userid;
      params.userid = (Math.random() * 1000).toString().replace(".", "");
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
    socket.on(
      "disconnect",
      handleDisconnect(
        socket,
        listOfRooms,
        listOfUsers,
        autoCloseEntireSession,
        config
      )
    );
  }

  onConnection(customSocket);
}