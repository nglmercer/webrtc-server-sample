import { Room, User } from "../types";
export declare function appendToRoom(roomid: string, userid: string, maxParticipants: number, listOfRooms: {
    [key: string]: Room;
}): void;
export declare function closeOrShiftRoom(socket: any, listOfRooms: {
    [key: string]: Room;
}, listOfUsers: {
    [key: string]: User;
}, autoCloseEntireSession: boolean, config: any): void;
