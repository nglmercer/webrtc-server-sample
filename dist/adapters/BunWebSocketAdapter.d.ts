import { EventEmitter } from 'events';
import { type ISocket } from '../types';
import { ParsedUrlQuery } from 'querystring';
/**
 * Adaptador para WebSocket nativo de Bun
 * Implementa la interfaz ISocket para compatibilidad con el servidor de señalización
 */
export declare class BunWebSocketAdapter extends EventEmitter implements ISocket {
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
    constructor(ws: any);
    /**
     * Maneja mensajes entrantes del WebSocket
     */
    handleMessage(message: string | ArrayBuffer | Uint8Array): void;
    /**
     * Maneja el cierre de la conexión
     */
    handleClose(code: number, reason: string): void;
    /**
     * Maneja errores de la conexión
     */
    handleError(error: Error): void;
    /**
     * Envía un mensaje al cliente
     */
    emit(event: string, ...args: any[]): boolean;
    /**
     * Cierra la conexión
     */
    disconnect(close?: boolean): this;
    /**
     * Envía un ping
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
     * Propiedad nsp para compatibilidad
     */
    get nsp(): any;
    /**
     * Suscribirse a un topic (usando pub/sub nativo de Bun)
     */
    subscribe(topic: string): void;
    /**
     * Desuscribirse de un topic
     */
    unsubscribe(topic: string): void;
    /**
     * Publicar a un topic
     */
    publish(topic: string, message: string): void;
}
//# sourceMappingURL=BunWebSocketAdapter.d.ts.map