import pushLogs from "../logger/pushLogs.js";
export function appendUser(socket, params, listOfUsers, config) {
    try {
        let extra = params.extra;
        if (params.extra) {
            try {
                if (typeof params.extra === "string") {
                    params.extra = JSON.parse(params.extra);
                }
                extra = params.extra;
            }
            catch (e) {
                extra = params.extra;
            }
        }
        listOfUsers[socket.userid] = {
            userid: socket.userid,
            socket: socket,
            connectedWith: {},
            extra: extra || {},
            socketMessageEvent: params.socketMessageEvent || "",
            socketCustomEvent: params.socketCustomEvent || "",
            connectedAt: new Date(),
            roomid: params.sessionid || undefined
        };
    }
    catch (e) {
        pushLogs(config, "appendUser", e);
    }
}
//# sourceMappingURL=userUtils.js.map