import { User, Room, CustomSocket } from "../types.js";
import type { SignalConfig } from "../signal_server.js";
export declare function registerUserHandlers(socket: CustomSocket, listOfRooms: {
    [key: string]: Room;
}, listOfUsers: {
    [key: string]: User;
}, config: SignalConfig, params: any): void;
//# sourceMappingURL=userHandlers.d.ts.map