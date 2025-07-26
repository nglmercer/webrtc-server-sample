import { EventEmitter } from 'events';
import { RawData, WebSocket } from 'ws';
import { ISocket, CustomSocket } from './types';
import { ParsedUrlQuery } from 'querystring';
import * as url from 'url';
import { nanoid } from 'nanoid';
// Hacemos que nuestro adaptador implemente la interfaz ISocket y EventEmitter para manejar eventos
export class WebSocketAdapter extends EventEmitter implements ISocket {
    id: string;
    handshake: {
        query: ParsedUrlQuery;
    };
    // Almacenamos el socket nativo
    private ws: WebSocket;

    // Extendemos EventEmitter, por lo que 'on' y 'emit' (para eventos internos) ya existen.
    // Solo necesitamos sobreescribir el 'emit' que envía datos por el cable.
    
    // El broadcast es un concepto de socket.io. Lo manejaremos a nivel de aplicación,
    // por lo que aquí puede ser una implementación vacía o lanzar un error si se llama.
    broadcast: { emit: (event: string, ...args: any[]) => void; };

    constructor(ws: WebSocket, request: any) {
        super();
        this.ws = ws;
        this.id = nanoid(); // ws no tiene un ID por defecto, le asignamos uno.
        
        // Extraemos los query params de la URL de la petición de conexión.
        const parsedUrl = url.parse(request.url || '', true);
        this.handshake = {
            query: parsedUrl.query,
        };

        this.broadcast = {
            emit: (event: string, ...args: any[]) => {
                // El broadcast real debe ser manejado por la lógica del servidor
                // (iterando sobre una lista de clientes), ya que un socket individual no conoce a los demás.
                // Tu código actual ya hace esto, así que no necesitamos nada aquí.
                console.warn(`Broadcast.emit llamado en WebSocketAdapter. Esta función debe ser manejada a nivel de aplicación.`);
            }
        };

        // Escuchamos los mensajes entrantes del socket nativo
        this.ws.on('message', (message: RawData) => {
            try {
                const data = JSON.parse(message.toString());
                if (data.event && Array.isArray(data.payload)) {
                    // Usamos el EventEmitter interno para notificar a los listeners (`.on()`)
                    // de este evento específico.
                    super.emit(data.event, ...data.payload);
                }
            } catch (error) {
                console.error('Error al parsear mensaje de WS:', error);
            }
        });

        // Mapeamos el evento 'close' de ws al evento 'disconnect' que tu lógica espera
        this.ws.on('close', () => {
            super.emit('disconnect');
        });

        this.ws.on('error', (err: Error) => {
            console.error(`Error en WebSocket ${this.id}:`, err);
            super.emit('disconnect'); // Un error a menudo resulta en una desconexión
        });
    }

    // Este es el método que tu lógica usará para enviar datos al cliente.
    emit(event: string, ...args: any[]): boolean {
        try {
            const message = JSON.stringify({
                event: event,
                payload: args
            });
            this.ws.send(message);
            return true;
        } catch (error) {
            console.error('Error al enviar mensaje por WS:', error);
            return false;
        }
    }

    // Este método cierra la conexión nativa
    disconnect(close?: boolean): this {
        this.ws.close();
        return this;
    }

    // Propiedad nsp no es nativa de ws, la agregamos por compatibilidad con tu código de desconexión
    // aunque probablemente no la necesitemos si adaptamos ligeramente esa parte.
    get nsp(): any {
        return undefined; // No existe un concepto de namespace en 'ws'
    }
}