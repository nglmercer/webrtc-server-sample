import { EventEmitter } from 'events';
import { WebSocket } from 'ws';
import { type ISocket } from '../types';
import { ParsedUrlQuery } from 'querystring';
export declare class WebSocketAdapter extends EventEmitter implements ISocket {
    id: string;
    handshake: {
        query: ParsedUrlQuery;
    };
    private ws;
    private isConnected;
    private lastActivity;
    private connectionStartTime;
    broadcast: {
        emit: (event: string, ...args: any[]) => void;
    };
    constructor(ws: WebSocket, request: any);
    emit(event: string, ...args: any[]): boolean;
    disconnect(close?: boolean): this;
    /**
     * Envía un ping nativo de WebSocket
     */
    ping(data?: Buffer): void;
    /**
     * Obtiene información de estado de la conexión
     */
    getConnectionInfo(): {
        id: string;
        isConnected: boolean;
        readyState: number;
        lastActivity: number;
        connectionDuration: number;
    };
    /**
     * Verifica si la conexión está activa
     */
    isAlive(): boolean;
    get nsp(): any;
}
//# sourceMappingURL=WebSocketAdapter.d.ts.map