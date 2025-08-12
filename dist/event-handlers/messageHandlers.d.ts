import { User, Room, CustomSocket } from "../types.js";
export declare function registerMessageHandlers(socket: CustomSocket, listOfRooms: {
    [key: string]: Room;
}, listOfUsers: {
    [key: string]: User;
}, socketMessageEvent: string, config: any): void;
//# sourceMappingURL=messageHandlers.d.ts.map