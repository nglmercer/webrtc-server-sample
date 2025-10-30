import { User, Room, CustomSocket } from "../types.js";
import { CONST_STRINGS } from "../constants.js";
import pushLogs from "../logger/pushLogs.js";
import { appendToRoom, closeOrShiftRoom } from "../utils/roomUtils.js";
import type { SignalConfig } from "../signal_server.js";

export function registerRoomHandlers(
  socket: CustomSocket,
  listOfRooms: { [key: string]: Room },
  listOfUsers: { [key: string]: User },
  config: SignalConfig,
  params: any,
) {
  let autoCloseEntireSession = params.autoCloseEntireSession === "true";

  socket.on(
    "open-room",
    (arg: any, callback: (success: boolean, error?: string) => void) => {
      callback = callback || function () {};

      // Check if user is already in a different room before creating a new one
      const userCurrentRoom = listOfUsers[socket.userid]?.roomid;
      if (userCurrentRoom && userCurrentRoom !== arg.sessionid) {
        // User is already in a different room, prevent creating new room
        socket.emit("room-opened-error", CONST_STRINGS.ROOM_NOT_AVAILABLE);
        return callback(false, CONST_STRINGS.ROOM_NOT_AVAILABLE);
      }

      // Only close existing room if user is already in a different room
      if (userCurrentRoom && userCurrentRoom !== arg.sessionid) {
        closeOrShiftRoom(
          socket,
          listOfRooms,
          listOfUsers,
          autoCloseEntireSession,
          config,
        );
      }
      console.log("open-room", arg);

      if (listOfRooms[arg.sessionid]?.participants.length) {
        socket.emit("room-opened-error", CONST_STRINGS.ROOM_NOT_AVAILABLE);
        return callback(false, CONST_STRINGS.ROOM_NOT_AVAILABLE);
      }

      listOfUsers[socket.userid].extra = arg.extra;
      autoCloseEntireSession = arg.session?.oneway || arg.session?.broadcast;

      const maxParticipants =
        parseInt(
          params.maxParticipantsAllowed || config.maxParticipantsAllowed,
        ) || 1000;
      const roomAdded = appendToRoom(
        arg.sessionid,
        socket.userid,
        maxParticipants,
        listOfRooms,
      );

      if (!roomAdded) {
        socket.emit("room-opened-error", CONST_STRINGS.ROOM_FULL);
        return callback(false, CONST_STRINGS.ROOM_FULL);
      }

      // Update user's roomid after successful room creation
      listOfUsers[socket.userid].roomid = arg.sessionid;

      const room = listOfRooms[arg.sessionid];
      room.owner = socket.userid;
      room.session = arg.session;
      room.extra = arg.extra || {};
      room.socketMessageEvent = listOfUsers[socket.userid].socketMessageEvent;
      room.socketCustomEvent = listOfUsers[socket.userid].socketCustomEvent;
      if (arg.identifier) room.identifier = arg.identifier;
      if (arg.password) room.password = arg.password;

      socket.admininfo = { sessionid: arg.sessionid, ...arg };
      socket.emit("room-opened", { sessionid: arg.sessionid, ...arg });
      callback(true);
    },
  );

  socket.on(
    "join-room",
    (arg: any, callback: (success: boolean, error?: string) => void) => {
      callback = callback || function () {};
      // Only close existing room if user is already in a different room
      const userCurrentRoom = listOfUsers[socket.userid]?.roomid;
      if (userCurrentRoom && userCurrentRoom !== arg.sessionid) {
        closeOrShiftRoom(
          socket,
          listOfRooms,
          listOfUsers,
          autoCloseEntireSession,
          config,
        );
      }
      listOfUsers[socket.userid].extra = arg.extra;

      const room = listOfRooms[arg.sessionid];
      if (!room) {
        socket.emit("room-joined-error", CONST_STRINGS.ROOM_NOT_AVAILABLE);
        return callback(false, CONST_STRINGS.ROOM_NOT_AVAILABLE);
      }
      if (room.password && room.password !== arg.password) {
        socket.emit("room-joined-error", CONST_STRINGS.INVALID_PASSWORD);
        return callback(false, CONST_STRINGS.INVALID_PASSWORD);
      }
      if (room.participants.length >= room.maxParticipantsAllowed) {
        socket.emit("room-joined-error", CONST_STRINGS.ROOM_FULL);
        return callback(false, CONST_STRINGS.ROOM_FULL);
      }

      const maxParticipants =
        parseInt(
          params.maxParticipantsAllowed || config.maxParticipantsAllowed,
        ) || 1000;
      const roomAdded = appendToRoom(
        arg.sessionid,
        socket.userid,
        maxParticipants,
        listOfRooms,
      );

      if (!roomAdded) {
        socket.emit("room-joined-error", CONST_STRINGS.ROOM_FULL);
        return callback(false, CONST_STRINGS.ROOM_FULL);
      }

      socket.admininfo = { sessionid: arg.sessionid, ...arg };
      // Update user's roomid after successful room join
      listOfUsers[socket.userid].roomid = arg.sessionid;
      socket.emit("room-joined", { sessionid: arg.sessionid, ...arg });
      callback(true);
    },
  );

  socket.on(
    "check-presence",
    (
      roomid: string,
      callback: (isPresent: boolean, roomid: string, extra: any) => void,
    ) => {
      const room = listOfRooms[roomid];
      console.log("check-presence", { roomid, room, listOfRooms });

      if (!room || !room.participants.length) {
        socket.emit("presence-checked", false, roomid, {
          _room: { isFull: false, isPasswordProtected: false },
        });
        return callback(false, roomid, {
          _room: { isFull: false, isPasswordProtected: false },
        });
      }
      const extra = room.extra || {};
      extra._room = {
        isFull: room.participants.length >= room.maxParticipantsAllowed,
        isPasswordProtected: !!room.password,
      };
      socket.emit("presence-checked", true, roomid, extra);
      callback(true, roomid, extra);
    },
  );

  socket.on(
    "get-public-rooms",
    (
      identifier: string,
      callback: (rooms: any[] | null, error?: string) => void,
    ) => {
      if (!identifier)
        return callback(null, CONST_STRINGS.PUBLIC_IDENTIFIER_MISSING);

      const rooms = Object.entries(listOfRooms)
        .filter(([, room]) => room.identifier === identifier)
        .map(([key, room]) => ({
          ...room,
          sessionid: key,
          isRoomFull: room.participants.length >= room.maxParticipantsAllowed,
          isPasswordProtected: !!room.password,
        }));
      socket.emit("public-rooms-list", rooms);
      callback(rooms);
    },
  );

  socket.on(
    "set-password",
    (
      password: string,
      callback: (
        success: boolean,
        roomid: string | null,
        error: string | null,
      ) => void,
    ) => {
      callback = callback || function () {};
      const roomid = socket.admininfo?.sessionid;
      if (!roomid) {
        socket.emit(
          "password-updated-error",
          CONST_STRINGS.DID_NOT_JOIN_ANY_ROOM,
        );
        return callback(false, null, CONST_STRINGS.DID_NOT_JOIN_ANY_ROOM);
      }

      const room = listOfRooms[roomid];
      if (room && room.owner === socket.userid) {
        room.password = password;
        socket.emit("password-updated", { roomid, password });
        callback(true, roomid, null);
      } else {
        socket.emit(
          "password-updated-error",
          CONST_STRINGS.ROOM_PERMISSION_DENIED,
        );
        callback(false, roomid, CONST_STRINGS.ROOM_PERMISSION_DENIED);
      }
    },
  );

  socket.on(
    "is-valid-password",
    (
      password: string,
      roomid: string,
      callback: (isValid: boolean, roomid: string, error: string) => void,
    ) => {
      callback = callback || function () {};
      const room = listOfRooms[roomid];
      if (!room) {
        socket.emit(
          "is-valid-password-response",
          false,
          roomid,
          CONST_STRINGS.ROOM_NOT_AVAILABLE,
        );
        return callback(false, roomid, CONST_STRINGS.ROOM_NOT_AVAILABLE);
      }
      if (!room.password) {
        socket.emit(
          "is-valid-password-response",
          false,
          roomid,
          "This room does not have a password.",
        );
        return callback(false, roomid, "This room does not have a password.");
      }

      const isValid = room.password === password;
      socket.emit(
        "is-valid-password-response",
        isValid,
        roomid,
        isValid ? "" : CONST_STRINGS.INVALID_PASSWORD,
      );
      callback(isValid, roomid, isValid ? "" : CONST_STRINGS.INVALID_PASSWORD);
    },
  );

  socket.on(
    "close-entire-session",
    (callback: (success: boolean, error?: string) => void) => {
      callback = callback || function () {};
      const roomid = socket.admininfo?.sessionid;

      if (!roomid) {
        socket.emit("session-closed-error", CONST_STRINGS.ROOM_NOT_AVAILABLE);
        return callback(false, CONST_STRINGS.ROOM_NOT_AVAILABLE);
      }

      const room = listOfRooms[roomid];

      if (!room || room.owner !== socket.userid) {
        socket.emit(
          "session-closed-error",
          CONST_STRINGS.ROOM_PERMISSION_DENIED,
        );
        return callback(false, CONST_STRINGS.ROOM_PERMISSION_DENIED);
      }

      autoCloseEntireSession = true;

      closeOrShiftRoom(
        socket,
        listOfRooms,
        listOfUsers,
        autoCloseEntireSession,
        config,
      );

      socket.emit("session-closed", { roomid });

      callback(true);
    },
  );
}
