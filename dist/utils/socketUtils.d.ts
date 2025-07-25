import { User, Room, CustomSocket } from "../types";
export declare function handleDisconnect(socket: CustomSocket, listOfRooms: {
    [key: string]: Room;
}, listOfUsers: {
    [key: string]: User;
}, autoCloseEntireSession: boolean, config: any): () => void;
