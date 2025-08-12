import { User, Room, CustomSocket } from "../types.js";
import { CONST_STRINGS } from "../constants.js";
import pushLogs from "../logger/pushLogs.js";
import { appendUser } from "../utils/userUtils.js";
import type {SignalConfig} from "../signal_server.js";

export function registerUserHandlers(
  socket: CustomSocket,
  listOfRooms: { [key: string]: Room },
  listOfUsers: { [key: string]: User },
  config: SignalConfig,
  params: any
) {
  socket.on("extra-data-updated", (extra: any) => {
    try {
      if (!listOfUsers[socket.userid]) return;
      listOfUsers[socket.userid].extra = extra;

      Object.values(listOfUsers[socket.userid].connectedWith).forEach(
        (userSocket) => {
          userSocket.emit("extra-data-updated", socket.userid, extra);
        }
      );

      if (socket.admininfo?.sessionid) {
        const room = listOfRooms[socket.admininfo.sessionid];
        if (room) {
          if (socket.userid === room.owner) {
            room.extra = extra;
          }
          room.participants.forEach((pid) => {
            if (listOfUsers[pid]) {
              listOfUsers[pid].socket.emit(
                "extra-data-updated",
                socket.userid,
                extra
              );
            }
          });
        }
      }
    } catch (e) {
      pushLogs(config, "extra-data-updated", e);
    }
  });

  socket.on(
    "get-remote-user-extra-data",
    (remoteUserId: string, callback: (extra: any) => void) => {
      callback = callback || function () {};
      if (!remoteUserId || !listOfUsers[remoteUserId]) {
        return callback(CONST_STRINGS.USERID_NOT_AVAILABLE);
      }
      callback(listOfUsers[remoteUserId].extra);
    }
  );

  socket.on("changed-uuid", (newUserId: string, callback: () => void) => {
    callback = callback || function () {};
    if (listOfUsers[socket.userid]) {
      if (newUserId === socket.userid) return;
      const oldUserId = socket.userid;
      listOfUsers[newUserId] = listOfUsers[oldUserId];
      listOfUsers[newUserId].socket.userid = socket.userid = newUserId;
      delete listOfUsers[oldUserId];
      callback();
    } else {
      socket.userid = newUserId;
      appendUser(socket, params, listOfUsers, config);
      callback();
    }
  });

  socket.on("disconnect-with", (remoteUserId: string, callback: () => void) => {
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
    } catch (e) {
      pushLogs(config, "disconnect-with", e);
    }
  });
}