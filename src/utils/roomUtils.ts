import { Room, User } from "../types";
import pushLogs from "../pushLogs";

export function appendToRoom(
  roomid: string,
  userid: string,
  maxParticipants: number,
  listOfRooms: { [key: string]: Room }
) {
  if (!listOfRooms[roomid]) {
    listOfRooms[roomid] = {
      maxParticipantsAllowed: maxParticipants,
      owner: userid,
      participants: [userid],
      extra: {},
      socketMessageEvent: "",
      socketCustomEvent: "",
      identifier: "",
      session: {
        audio: true,
        video: true,
      },
    };
  }

  if (listOfRooms[roomid].participants.indexOf(userid) === -1) {
    listOfRooms[roomid].participants.push(userid);
  }
}

export function closeOrShiftRoom(
  socket: any,
  listOfRooms: { [key: string]: Room },
  listOfUsers: { [key: string]: User },
  autoCloseEntireSession: boolean,
  config: any
) {
  try {
    if (!socket.admininfo) {
      return;
    }

    const roomid = socket.admininfo.sessionid;

    if (roomid && listOfRooms[roomid]) {
      if (socket.userid === listOfRooms[roomid].owner) {
        if (
          !autoCloseEntireSession &&
          listOfRooms[roomid].participants.length > 1
        ) {
          const newOwner = listOfRooms[roomid].participants.find(
            (pid) => pid !== socket.userid && listOfUsers[pid]
          );

          if (newOwner && listOfUsers[newOwner]) {
            listOfRooms[roomid].owner = newOwner;
            listOfUsers[newOwner].socket.emit("set-isInitiator-true", roomid);
          } else {
            delete listOfRooms[roomid];
          }
        } else {
          delete listOfRooms[roomid];
        }
      }

      const newParticipantsList = listOfRooms[roomid].participants.filter(
        (pid) => pid !== socket.userid
      );
      listOfRooms[roomid].participants = newParticipantsList;
      if (listOfRooms[roomid].participants.length === 0) {
        delete listOfRooms[roomid];
      }
    }
  } catch (e) {
    pushLogs(config, "closeOrShiftRoom", e);
  }
}