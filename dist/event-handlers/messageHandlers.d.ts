import { User, Room, CustomSocket } from "../types";
export declare function registerMessageHandlers(socket: CustomSocket, listOfRooms: {
    [key: string]: Room;
}, listOfUsers: {
    [key: string]: User;
}, socketMessageEvent: string, config: any): void;
