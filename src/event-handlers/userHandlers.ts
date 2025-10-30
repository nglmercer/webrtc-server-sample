import { User, Room, CustomSocket } from "../types.js";
import { CONST_STRINGS } from "../constants.js";
import pushLogs from "../logger/pushLogs.js";
import { appendUser } from "../utils/userUtils.js";
import type { SignalConfig } from "../signal_server.js";

export function registerUserHandlers(
  socket: CustomSocket,
  listOfRooms: { [key: string]: Room },
  listOfUsers: { [key: string]: User },
  config: SignalConfig,
  params: any,
) {
  socket.on("extra-data-updated", (extra: any) => {
    try {
      if (!listOfUsers[socket.userid]) return;

      // Handle null or undefined extra data
      const sanitizedExtra = extra === null || extra === undefined ? {} : extra;
      listOfUsers[socket.userid].extra = sanitizedExtra;

      Object.values(listOfUsers[socket.userid].connectedWith).forEach(
        (userSocket) => {
          userSocket.emit("user-extra-data-updated", socket.userid, extra);
        },
      );

      if (socket.admininfo?.sessionid) {
        const room = listOfRooms[socket.admininfo.sessionid];
        if (room) {
          if (socket.userid === room.owner) {
            room.extra = extra;
          }

          room.participants.forEach((pid) => {
            if (listOfUsers[pid] && pid !== socket.userid) {
              listOfUsers[pid].socket.emit(
                "user-extra-data-updated",
                socket.userid,
                extra,
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
        socket.emit(
          "remote-user-extra-data-response",
          null,
          CONST_STRINGS.USERID_NOT_AVAILABLE,
        );
        return callback(CONST_STRINGS.USERID_NOT_AVAILABLE);
      }
      const extraData = listOfUsers[remoteUserId].extra || {};
      socket.emit("remote-user-extra-data-response", extraData);
      callback(extraData);
    },
  );

  socket.on(
    "changed-uuid",
    (
      newUserId: string,
      callback: (success: boolean, error?: string) => void,
    ) => {
      callback = callback || function () {};

      if (!newUserId || newUserId.trim() === "") {
        socket.emit("uuid-change-error", "User ID cannot be empty");
        return callback(false, "User ID cannot be empty");
      }

      if (listOfUsers[newUserId]) {
        socket.emit("uuid-change-error", "User ID already taken");
        return callback(false, "User ID already taken");
      }

      if (listOfUsers[socket.userid]) {
        if (newUserId === socket.userid) {
          socket.emit("uuid-changed", newUserId);
          return callback(true);
        }
        const oldUserId = socket.userid;
        listOfUsers[newUserId] = listOfUsers[oldUserId];
        listOfUsers[newUserId].socket.userid = socket.userid = newUserId;
        delete listOfUsers[oldUserId];

        // Update room ownership if user is owner
        Object.values(listOfRooms).forEach((room) => {
          if (room.owner === oldUserId) {
            room.owner = newUserId;
          }
          const participantIndex = room.participants.indexOf(oldUserId);
          if (participantIndex > -1) {
            room.participants[participantIndex] = newUserId;
          }
        });

        socket.emit("uuid-changed", newUserId);
        callback(true);
      } else {
        socket.userid = newUserId;
        appendUser(socket, params, listOfUsers, config);
        socket.emit("uuid-changed", newUserId);
        callback(true);
      }
    },
  );

  socket.on(
    "disconnect-with",
    (
      remoteUserId: string,
      callback: (success: boolean, error?: string) => void,
    ) => {
      callback = callback || function () {};

      if (!remoteUserId) {
        socket.emit("disconnect-error", "Remote user ID is required");
        return callback(false, "Remote user ID is required");
      }

      if (!listOfUsers[remoteUserId]) {
        socket.emit("disconnect-error", "Remote user not found");
        return callback(false, "Remote user not found");
      }

      try {
        let wasConnected = false;

        if (listOfUsers[socket.userid]?.connectedWith[remoteUserId]) {
          delete listOfUsers[socket.userid].connectedWith[remoteUserId];
          socket.emit("user-disconnected", remoteUserId);
          wasConnected = true;
        }

        if (listOfUsers[remoteUserId]?.connectedWith[socket.userid]) {
          delete listOfUsers[remoteUserId].connectedWith[socket.userid];
          listOfUsers[remoteUserId].socket.emit(
            "user-disconnected",
            socket.userid,
          );
          wasConnected = true;
        }

        if (wasConnected) {
          socket.emit("disconnected-with", remoteUserId);
          callback(true);
        } else {
          socket.emit("disconnect-error", "Not connected with this user");
          callback(false, "Not connected with this user");
        }
      } catch (e) {
        pushLogs(config, "disconnect-with", e);
        socket.emit("disconnect-error", "Internal error");
        callback(false, "Internal error");
      }
    },
  );

  socket.on(
    "set-custom-socket-event-listener",
    (
      eventName: string,
      callback: (success: boolean, error?: string) => void,
    ) => {
      callback = callback || function () {};

      if (!eventName || eventName.trim() === "") {
        socket.emit(
          "custom-event-listener-error",
          "Event name cannot be empty",
        );
        return callback(false, "Event name cannot be empty");
      }

      // Store the custom event listener for future use
      if (!socket.customEvents) {
        socket.customEvents = new Set();
      }
      socket.customEvents.add(eventName);

      socket.on(eventName, (data: any) => {
        if (socket.admininfo?.sessionid) {
          const room = listOfRooms[socket.admininfo.sessionid];
          if (room) {
            room.participants.forEach((pid) => {
              if (pid !== socket.userid && listOfUsers[pid]) {
                listOfUsers[pid].socket.emit(eventName, data, socket.userid);
              }
            });
          }
        }
      });

      socket.emit("custom-event-listener-set", eventName);
      callback(true);
    },
  );
}
