import { User, Room, CustomSocket } from "../types";
import pushLogs from "../pushLogs";

function onMessageCallback(
  socket: CustomSocket,
  message: any,
  listOfUsers: { [key: string]: User },
  socketMessageEvent: string,
  config: any
) {
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
  } catch (e) {
    pushLogs(config, "onMessageCallback", e);
  }
}

function joinARoom(
  socket: CustomSocket,
  message: any,
  listOfRooms: { [key: string]: Room },
  listOfUsers: { [key: string]: User },
  socketMessageEvent: string
) {
  const room = listOfRooms[socket.admininfo!.sessionid];
  if (!room) return;
  if (room.participants.length >= room.maxParticipantsAllowed) return;

  if (room.session?.oneway || room.session?.broadcast) {
    if (listOfUsers[room.owner]) {
      message.remoteUserId = room.owner;
      listOfUsers[room.owner].socket.emit(socketMessageEvent, message);
    }
  } else {
    room.participants.forEach((pid) => {
      if (pid !== socket.userid && listOfUsers[pid]) {
        message.remoteUserId = pid;
        listOfUsers[pid].socket.emit(socketMessageEvent, message);
      }
    });
  }
}

export function registerMessageHandlers(
  socket: CustomSocket,
  listOfRooms: { [key: string]: Room },
  listOfUsers: { [key: string]: User },
  socketMessageEvent: string,
  config: any
) {
  socket.on(socketMessageEvent, (message: any, callback: (isPresent: boolean, userid: string) => void) => {
    try {
      if (message.remoteUserId === socket.userid) return;

      if (message.remoteUserId && message.remoteUserId !== "system" && message.message.newParticipationRequest) {
        if (listOfRooms[message.remoteUserId]) {
          joinARoom(socket, message, listOfRooms, listOfUsers, socketMessageEvent);
          return;
        }
      }

      if (message.remoteUserId === "system" && message.message.detectPresence) {
        if (message.message.userid === socket.userid) return callback(false, socket.userid);
        return callback(!!listOfUsers[message.message.userid], message.message.userid);
      }

      if (!listOfUsers[message.sender]) {
        listOfUsers[message.sender] = { socket, connectedWith: {}, extra: {}, socketMessageEvent: "", socketCustomEvent: "" };
      }

      onMessageCallback(socket, message, listOfUsers, socketMessageEvent, config);
    } catch (e) {
      pushLogs(config, "on-socketMessageEvent", e);
    }
  });

  const dontDuplicateListeners: { [key: string]: string } = {};
  socket.on("set-custom-socket-event-listener", (customEvent: string) => {
    if (dontDuplicateListeners[customEvent]) return;
    dontDuplicateListeners[customEvent] = customEvent;

    socket.on(customEvent, (message: any) => {
        socket.broadcast.emit(customEvent, message);
    });
  });
}