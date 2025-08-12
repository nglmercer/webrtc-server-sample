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
    private emitter;
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
    /**
     * Métodos del Emitter personalizado para compatibilidad con SocketIO-like
     */
    on(event: string, callback: (data: any) => void): this;
    once(event: string, callback: (data: any) => void): this;
    off(event: string, callback?: (data: any) => void): this;
    /**
     * Obtiene información de debug del emitter
     */
    getEmitterDebug(): any;
    /**
     * Verifica si hay listeners para un evento
     */
    hasListeners(event: string): boolean;
    /**
     * Obtiene el número de listeners para un evento
     */
    listenerCount(event: string): number;
    /**
     * Obtiene todos los nombres de eventos que tienen listeners
     */
    eventNames(): string[];
    /**
     * Limpia todos los listeners del emitter
     */
    removeAllListeners(event?: string): this;
    get nsp(): any;
}
//# sourceMappingURL=WebSocketAdapter.d.ts.map