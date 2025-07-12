import { User, Room, CustomSocket } from "../types";
import { closeOrShiftRoom } from "./roomUtils";
import pushLogs from "../pushLogs";

export function handleDisconnect(
  socket: CustomSocket,
  listOfRooms: { [key: string]: Room },
  listOfUsers: { [key: string]: User },
  autoCloseEntireSession: boolean,
  config: any
) {
  return () => {
    try {
      if (socket && socket.nsp && socket.nsp.sockets) {
        delete (socket.nsp.sockets as any)[socket.id];
      }
    } catch (e) {
      pushLogs(config, "disconnect.cleanup", e);
    }

    try {
      if (listOfUsers[socket.userid]) {
        for (const s in listOfUsers[socket.userid].connectedWith) {
          listOfUsers[socket.userid].connectedWith[s].emit(
            "user-disconnected",
            socket.userid
          );

          if (listOfUsers[s] && listOfUsers[s].connectedWith[socket.userid]) {
            delete listOfUsers[s].connectedWith[socket.userid];
          }
        }
      }
    } catch (e) {
      pushLogs(config, "disconnect.notify", e);
    }

    closeOrShiftRoom(
      socket,
      listOfRooms,
      listOfUsers,
      autoCloseEntireSession,
      config
    );

    delete listOfUsers[socket.userid];

    if ((socket as any).ondisconnect) {
      try {
        (socket as any).ondisconnect();
      } catch (e) {
        pushLogs(config, "socket.ondisconnect", e);
      }
    }
  };
}