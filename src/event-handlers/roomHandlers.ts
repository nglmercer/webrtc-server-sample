import { User, Room, CustomSocket } from "../types";
import { CONST_STRINGS } from "../constants";
import pushLogs from "../pushLogs";
import { appendToRoom, closeOrShiftRoom } from "../utils/roomUtils";

export function registerRoomHandlers(
  socket: CustomSocket,
  listOfRooms: { [key: string]: Room },
  listOfUsers: { [key: string]: User },
  config: any,
  params: any
) {
  let autoCloseEntireSession = params.autoCloseEntireSession === "true";

  socket.on("open-room", (arg: any, callback: (success: boolean, error?: string) => void) => {
      callback = callback || function () {};
      closeOrShiftRoom(socket, listOfRooms, listOfUsers, autoCloseEntireSession, config);

      if (listOfRooms[arg.sessionid]?.participants.length) {
        return callback(false, CONST_STRINGS.ROOM_NOT_AVAILABLE);
      }

      listOfUsers[socket.userid].extra = arg.extra;
      autoCloseEntireSession = arg.session?.oneway || arg.session?.broadcast;

      const maxParticipants = parseInt(params.maxParticipantsAllowed || "1000") || 1000;
      appendToRoom(arg.sessionid, socket.userid, maxParticipants, listOfRooms);

      const room = listOfRooms[arg.sessionid];
      room.owner = socket.userid;
      room.session = arg.session;
      room.extra = arg.extra || {};
      room.socketMessageEvent = listOfUsers[socket.userid].socketMessageEvent;
      room.socketCustomEvent = listOfUsers[socket.userid].socketCustomEvent;
      if (arg.identifier) room.identifier = arg.identifier;
      if (arg.password) room.password = arg.password;

      socket.admininfo = { sessionid: arg.sessionid, ...arg };
      callback(true);
    }
  );

  socket.on("join-room", (arg: any, callback: (success: boolean, error?: string) => void) => {
      callback = callback || function () {};
      closeOrShiftRoom(socket, listOfRooms, listOfUsers, autoCloseEntireSession, config);
      listOfUsers[socket.userid].extra = arg.extra;

      const room = listOfRooms[arg.sessionid];
      if (!room) return callback(false, CONST_STRINGS.ROOM_NOT_AVAILABLE);
      if (room.password && room.password !== arg.password) {
        return callback(false, CONST_STRINGS.INVALID_PASSWORD);
      }
      if (room.participants.length >= room.maxParticipantsAllowed) {
        return callback(false, CONST_STRINGS.ROOM_FULL);
      }
      
      const maxParticipants = parseInt(params.maxParticipantsAllowed || "1000") || 1000;
      appendToRoom(arg.sessionid, socket.userid, maxParticipants, listOfRooms);
      socket.admininfo = { sessionid: arg.sessionid, ...arg };
      callback(true);
    }
  );
  
  socket.on("check-presence", (roomid: string, callback: (isPresent: boolean, roomid: string, extra: any) => void) => {
      const room = listOfRooms[roomid];
      if (!room || !room.participants.length) {
          return callback(false, roomid, { _room: { isFull: false, isPasswordProtected: false } });
      }
      const extra = room.extra || {};
      extra._room = {
        isFull: room.participants.length >= room.maxParticipantsAllowed,
        isPasswordProtected: !!room.password,
      };
      callback(true, roomid, extra);
    }
  );

  socket.on("get-public-rooms", (identifier: string, callback: (rooms: any[] | null, error?: string) => void) => {
      if (!identifier) return callback(null, CONST_STRINGS.PUBLIC_IDENTIFIER_MISSING);
      
      const rooms = Object.entries(listOfRooms)
        .filter(([, room]) => room.identifier === identifier)
        .map(([key, room]) => ({
          ...room,
          sessionid: key,
          isRoomFull: room.participants.length >= room.maxParticipantsAllowed,
          isPasswordProtected: !!room.password,
        }));
      callback(rooms);
    }
  );
    
  socket.on("set-password", (password: string, callback: (success: boolean, roomid: string | null, error: string | null) => void) => {
      callback = callback || function() {};
      const roomid = socket.admininfo?.sessionid;
      if (!roomid) return callback(false, null, CONST_STRINGS.DID_NOT_JOIN_ANY_ROOM);

      const room = listOfRooms[roomid];
      if(room && room.owner === socket.userid) {
          room.password = password;
          callback(true, roomid, null);
      } else {
          callback(false, roomid, CONST_STRINGS.ROOM_PERMISSION_DENIED);
      }
  });

  socket.on("is-valid-password", (password: string, roomid: string, callback: (isValid: boolean, roomid: string, error: string) => void) => {
      callback = callback || function() {};
      const room = listOfRooms[roomid];
      if (!room) return callback(false, roomid, CONST_STRINGS.ROOM_NOT_AVAILABLE);
      if (!room.password) return callback(false, roomid, "This room does not have a password.");
      
      callback(room.password === password, roomid, room.password === password ? "" : CONST_STRINGS.INVALID_PASSWORD);
  });
  
  socket.on("close-entire-session", (callback: (success: boolean, error?: string) => void) => {
      callback = callback || function() {};
      const roomid = socket.admininfo?.sessionid;
      if (!roomid) return callback(false, CONST_STRINGS.ROOM_NOT_AVAILABLE);

      const room = listOfRooms[roomid];
      if (!room || room.owner !== socket.userid) {
        return callback(false, CONST_STRINGS.ROOM_PERMISSION_DENIED);
      }

      autoCloseEntireSession = true;
      closeOrShiftRoom(socket, listOfRooms, listOfUsers, autoCloseEntireSession, config);
      callback(true);
  });
}