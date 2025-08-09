import { EventEmitter } from 'events';
import { WebSocket } from 'ws';
import * as url from 'url';
import { nanoid } from 'nanoid';
import { logger } from '../logger/index.js';
// Hacemos que nuestro adaptador implemente la interfaz ISocket y EventEmitter para manejar eventos
export class WebSocketAdapter extends EventEmitter {
    constructor(ws, request) {
        super();
        this.isConnected = true;
        this.lastActivity = Date.now();
        this.connectionStartTime = Date.now();
        this.ws = ws;
        this.id = nanoid(); // ws no tiene un ID por defecto, le asignamos uno.
        // Extraemos los query params de la URL de la petición de conexión.
        const parsedUrl = url.parse(request.url || '', true);
        this.handshake = {
            query: parsedUrl.query,
        };
        this.broadcast = {
            emit: (event, ...args) => {
                // El broadcast real debe ser manejado por la lógica del servidor
                // (iterando sobre una lista de clientes), ya que un socket individual no conoce a los demás.
                // Tu código actual ya hace esto, así que no necesitamos nada aquí.
                console.warn(`Broadcast.emit llamado en WebSocketAdapter. Esta función debe ser manejada a nivel de aplicación.`);
            }
        };
        // Escuchamos los mensajes entrantes del socket nativo
        this.ws.on('message', (message) => {
            try {
                const data = JSON.parse(message.toString());
                if (data.event && Array.isArray(data.payload)) {
                    // Usamos el EventEmitter interno para notificar a los listeners (`.on()`)
                    // de este evento específico.
                    super.emit(data.event, ...data.payload);
                }
            }
            catch (error) {
                console.error('Error al parsear mensaje de WS:', error);
            }
        });
        // Mapeamos el evento 'close' de ws al evento 'disconnect' que tu lógica espera
        this.ws.on('close', (code, reason) => {
            this.isConnected = false;
            const reasonString = reason.toString();
            logger.info(`WebSocket ${this.id} cerrado`, {
                code,
                reason: reasonString,
                duration: Date.now() - this.connectionStartTime
            });
            super.emit('disconnect', code, reasonString);
        });
        this.ws.on('error', (err) => {
            this.isConnected = false;
            logger.error(`Error en WebSocket ${this.id}:`, err);
            super.emit('disconnect'); // Un error a menudo resulta en una desconexión
        });
        // Manejar eventos de ping/pong nativos de WebSocket
        this.ws.on('ping', (data) => {
            this.lastActivity = Date.now();
            // Responder automáticamente al ping
            if (this.isConnected) {
                this.ws.pong(data);
            }
        });
        this.ws.on('pong', (data) => {
            this.lastActivity = Date.now();
            super.emit('pong', data);
        });
    }
    // Este es el método que tu lógica usará para enviar datos al cliente.
    emit(event, ...args) {
        if (!this.isConnected || this.ws.readyState !== WebSocket.OPEN) {
            logger.warn(`Intento de envío a WebSocket ${this.id} desconectado`, { data: event });
            return false;
        }
        try {
            const message = JSON.stringify({
                event: event,
                payload: args
            });
            this.ws.send(message);
            this.lastActivity = Date.now();
            return true;
        }
        catch (error) {
            logger.error(`Error al enviar mensaje por WS ${this.id}:`, error);
            this.isConnected = false;
            return false;
        }
    }
    // Este método cierra la conexión nativa
    disconnect(close) {
        if (this.isConnected) {
            this.isConnected = false;
            try {
                this.ws.close(1000, 'Normal closure');
            }
            catch (error) {
                logger.error(`Error cerrando WebSocket ${this.id}:`, error);
            }
        }
        return this;
    }
    /**
     * Envía un ping nativo de WebSocket
     */
    ping(data) {
        if (this.isConnected && this.ws.readyState === WebSocket.OPEN) {
            try {
                this.ws.ping(data);
                this.lastActivity = Date.now();
            }
            catch (error) {
                logger.error(`Error enviando ping a WebSocket ${this.id}:`, error);
            }
        }
    }
    /**
     * Obtiene información de estado de la conexión
     */
    getConnectionInfo() {
        return {
            id: this.id,
            isConnected: this.isConnected,
            readyState: this.ws.readyState,
            lastActivity: this.lastActivity,
            connectionDuration: Date.now() - this.connectionStartTime
        };
    }
    /**
     * Verifica si la conexión está activa
     */
    isAlive() {
        return this.isConnected && this.ws.readyState === WebSocket.OPEN;
    }
    // Propiedad nsp no es nativa de ws, la agregamos por compatibilidad con tu código de desconexión
    // aunque probablemente no la necesitemos si adaptamos ligeramente esa parte.
    get nsp() {
        return undefined; // No existe un concepto de namespace en 'ws'
    }
}
//# sourceMappingURL=WebSocketAdapter.js.map