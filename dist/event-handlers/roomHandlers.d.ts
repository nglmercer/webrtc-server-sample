import { User, Room, CustomSocket } from "../types.js";
import type { SignalConfig } from "../signal_server.js";
export declare function registerRoomHandlers(socket: CustomSocket, listOfRooms: {
    [key: string]: Room;
}, listOfUsers: {
    [key: string]: User;
}, config: SignalConfig, params: any): void;
//# sourceMappingURL=roomHandlers.d.ts.map