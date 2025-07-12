import { ParsedUrlQuery } from 'querystring';

// Interfaz base para un socket genérico
export interface ISocket {
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

// Interfaz extendida para nuestro socket personalizado
export interface CustomSocket extends ISocket {
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

// Interfaz para un usuario en la lista
export interface User {
    socket: CustomSocket;
    connectedWith: { [key: string]: CustomSocket };
    extra: any;
    socketMessageEvent: string;
    socketCustomEvent: string;
    roomid?: string;
}

// Interfaz para una sala
export interface Room {
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