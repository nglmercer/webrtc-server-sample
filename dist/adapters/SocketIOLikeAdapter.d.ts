import { EventEmitter } from 'events';
import { WebSocket } from 'ws';
import { type ISocket } from '../types';
import { ParsedUrlQuery } from 'querystring';
interface ConnectedUser {
    id: string;
    socket: SocketIOLikeSocket;
    joinedAt: number;
    rooms: Set<string>;
    data?: any;
}
export declare class SocketIOLikeSocket extends EventEmitter implements ISocket {
    id: string;
    handshake: {
        query: ParsedUrlQuery;
    };
    conn: {
        transport: {
            name: string;
        };
    };
    private ws;
    private isConnected;
    private lastActivity;
    private connectionStartTime;
    private emitter;
    private rooms;
    private server;
    broadcast: {
        emit: (event: string, ...args: any[]) => void;
        to: (room: string) => {
            emit: (event: string, ...args: any[]) => void;
        };
    };
    constructor(ws: WebSocket, request: any, server: SocketIOLikeServer);
    private setupWebSocketListeners;
    on(event: string, callback: (data: any) => void): this;
    once(event: string, callback: (data: any) => void): this;
    off(event: string, callback?: (data: any) => void): this;
    emit(event: string, ...args: any[]): boolean;
    join(room: string): this;
    leave(room: string): this;
    getRooms(): string[];
    to(room: string): {
        emit: (event: string, ...args: any[]) => void;
    };
    disconnect(close?: boolean): this;
    ping(data?: Buffer): void;
    getConnectionInfo(): {
        id: string;
        isConnected: boolean;
        readyState: number;
        lastActivity: number;
        connectionDuration: number;
        rooms: string[];
    };
    isAlive(): boolean;
    get nsp(): any;
}
export declare class SocketIOLikeServer extends EventEmitter {
    private users;
    private rooms;
    private emitter;
    private wss?;
    constructor();
    listen(port: number, callback?: () => void): void;
    attach(server: any, callback?: () => void): void;
    private setupWebSocketServer;
    registerUser(socket: SocketIOLikeSocket): void;
    unregisterUser(socketId: string): void;
    addToRoom(room: string, socketId: string): void;
    removeFromRoom(room: string, socketId: string): void;
    broadcastToAll(event: string, args: any[], excludeId?: string): void;
    broadcastToRoom(room: string, event: string, args: any[], excludeId?: string): void;
    on(event: string, callback: (data: any) => void): this;
    once(event: string, callback: (data: any) => void): this;
    off(event: string, callback?: (data: any) => void): this;
    emit(event: string, ...args: any[]): boolean;
    getStats(): {
        totalUsers: number;
        totalRooms: number;
        users: Array<{
            id: string;
            joinedAt: number;
            rooms: string[];
            isAlive: boolean;
        }>;
        rooms: Record<string, number>;
    };
    getUser(socketId: string): ConnectedUser | undefined;
    getUsersInRoom(room: string): ConnectedUser[];
    close(callback?: () => void): void;
}
export declare const wsio: SocketIOLikeServer;
export type { ConnectedUser };
//# sourceMappingURL=SocketIOLikeAdapter.d.ts.map