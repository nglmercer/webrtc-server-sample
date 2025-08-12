import { ParsedUrlQuery } from 'querystring';
interface ISocket {
    id: string;
    handshake: {
        query: ParsedUrlQuery;
    };
    off(event: string, callback: (...args: any[]) => void): this;
    on(event: string, callback: (...args: any[]) => void): this;
    emit(event: string, ...args: any[]): boolean;
    broadcast: {
        emit(event: string, ...args: any[]): void;
    };
    disconnect(close?: boolean): this;
    nsp?: any;
}
interface User {
    userid: string;
    socket: CustomSocket;
    connectedWith: {
        [key: string]: CustomSocket;
    };
    extra: any;
    socketMessageEvent: string;
    socketCustomEvent: string;
    roomid?: string;
    connectedAt?: Date;
}
interface Room {
    maxParticipantsAllowed: number;
    owner: string;
    participants: string[];
    extra: any;
    socketMessageEvent: string;
    socketCustomEvent: string;
    identifier: string;
    session: {
        audio: boolean;
        video: boolean;
        oneway?: boolean;
        broadcast?: boolean;
        scalable?: boolean;
    };
    password?: string;
    createdAt?: Date;
    maxUsers?: number;
    users?: User[];
}
interface CustomSocket extends ISocket {
    userid: string;
    admininfo?: {
        sessionid: string;
        session: any;
        mediaConstraints: any;
        sdpConstraints: any;
        streams: any;
        extra: any;
    };
    connected?: boolean;
    ondisconnect?: () => void;
}
export type { User, Room, CustomSocket, ISocket, };
//# sourceMappingURL=types.d.ts.map