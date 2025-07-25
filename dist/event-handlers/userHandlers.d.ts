import { User, Room, CustomSocket } from "../types";
export declare function registerUserHandlers(socket: CustomSocket, listOfRooms: {
    [key: string]: Room;
}, listOfUsers: {
    [key: string]: User;
}, config: any, params: any): void;
