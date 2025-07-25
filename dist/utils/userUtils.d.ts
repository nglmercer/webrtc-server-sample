import { User, CustomSocket } from "../types";
export declare function appendUser(socket: CustomSocket, params: any, listOfUsers: {
    [key: string]: User;
}, config: any): void;
