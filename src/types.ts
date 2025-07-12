import { ParsedUrlQuery } from 'querystring';

// Definimos una interfaz genérica para el socket
interface ISocket {
    id: string;
    handshake: {
        query: ParsedUrlQuery;
    };
    on(event: string, callback: (...args: any[]) => void): this;
    emit(event: string, ...args: any[]): boolean;
    broadcast: {
        emit(event: string, ...args: any[]): void;
    };
    disconnect(close?: boolean): this;
    nsp?: any;
}


interface User {
    socket: CustomSocket;
    connectedWith: { [key: string]: CustomSocket };
    extra: any;
    socketMessageEvent: string;
    socketCustomEvent: string;
    roomid?: string;
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
    ondisconnect?: () => void;
}
export {
    User,
    Room,
    CustomSocket,
    ISocket,
}