"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.appendUser = appendUser;
const pushLogs_1 = __importDefault(require("../pushLogs"));
function appendUser(socket, params, listOfUsers, config) {
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
            socket: socket,
            connectedWith: {},
            extra: extra || {},
            socketMessageEvent: params.socketMessageEvent || "",
            socketCustomEvent: params.socketCustomEvent || "",
        };
    }
    catch (e) {
        (0, pushLogs_1.default)(config, "appendUser", e);
    }
}
