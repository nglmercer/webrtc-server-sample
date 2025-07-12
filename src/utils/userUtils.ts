import { User, CustomSocket } from "../types";
import pushLogs from "../pushLogs";

export function appendUser(
  socket: CustomSocket,
  params: any,
  listOfUsers: { [key: string]: User },
  config: any
) {
  try {
    let extra = params.extra;

    if (params.extra) {
      try {
        if (typeof params.extra === "string") {
          params.extra = JSON.parse(params.extra);
        }
        extra = params.extra;
      } catch (e) {
        extra = params.extra;
      }
    }

    listOfUsers[socket.userid] = {
      socket: socket,
      connectedWith: {},
      extra: extra || {},
      socketMessageEvent: params.socketMessageEvent || "",
      socketCustomEvent: params.socketCustomEvent || "",
    };
  } catch (e) {
    pushLogs(config, "appendUser", e);
  }
}