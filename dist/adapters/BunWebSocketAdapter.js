import { EventEmitter } from 'events';
import { nanoid } from 'nanoid';
import { defaultLogger as logger } from '../logger/index.js';
/**
 * Adaptador para WebSocket nativo de Bun
 * Implementa la interfaz ISocket para compatibilidad con el servidor de señalización
 */
export class BunWebSocketAdapter extends EventEmitter {
    constructor(ws) {
        super();
        this.isConnected = true;
        this.lastActivity = Date.now();
        this.connectionStartTime = Date.now();
        this.ws = ws;
        this.id = nanoid();
        // Extraer query params si están disponibles
        this.handshake = {
            query: {} // Bun no proporciona query params directamente en el WebSocket
        };
        // Almacenar referencia del adapter en el WebSocket para uso posterior
        this.ws.data.adapter = this;
        this.broadcast = {
            emit: (event, ...args) => {
                console.warn(`Broadcast.emit llamado en BunWebSocketAdapter. Esta función debe ser manejada a nivel de aplicación.`);
            }
        };
    }
    /**
     * Maneja mensajes entrantes del WebSocket
     */
    handleMessage(message) {
        try {
            const messageStr = typeof message === 'string' ? message : new TextDecoder().decode(message);
            const data = JSON.parse(messageStr);
            if (data.event && Array.isArray(data.payload)) {
                this.lastActivity = Date.now();
                super.emit(data.event, ...data.payload);
            }
        }
        catch (error) {
            logger.error('Error al parsear mensaje de WebSocket:', error, {
                socketId: this.id
            });
        }
    }
    /**
     * Maneja el cierre de la conexión
     */
    handleClose(code, reason) {
        this.isConnected = false;
        logger.info(`WebSocket ${this.id} cerrado`, {
            code,
            reason,
            duration: Date.now() - this.connectionStartTime
        });
        super.emit('disconnect', code, reason);
    }
    /**
     * Maneja errores de la conexión
     */
    handleError(error) {
        this.isConnected = false;
        logger.error(`Error en WebSocket ${this.id}:`, error);
        super.emit('disconnect');
    }
    /**
     * Envía un mensaje al cliente
     */
    emit(event, ...args) {
        if (!this.isConnected) {
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
            logger.error(`Error al enviar mensaje por WebSocket ${this.id}:`, error);
            this.isConnected = false;
            return false;
        }
    }
    /**
     * Cierra la conexión
     */
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
     * Envía un ping
     */
    ping(data) {
        if (this.isConnected) {
            try {
                // Bun's WebSocket tiene ping nativo
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
            readyState: this.isConnected ? 1 : 3, // 1 = OPEN, 3 = CLOSED
            lastActivity: this.lastActivity,
            connectionDuration: Date.now() - this.connectionStartTime
        };
    }
    /**
     * Verifica si la conexión está activa
     */
    isAlive() {
        return this.isConnected;
    }
    /**
     * Propiedad nsp para compatibilidad
     */
    get nsp() {
        return undefined;
    }
    /**
     * Suscribirse a un topic (usando pub/sub nativo de Bun)
     */
    subscribe(topic) {
        if (this.isConnected && this.ws.subscribe) {
            this.ws.subscribe(topic);
        }
    }
    /**
     * Desuscribirse de un topic
     */
    unsubscribe(topic) {
        if (this.isConnected && this.ws.unsubscribe) {
            this.ws.unsubscribe(topic);
        }
    }
    /**
     * Publicar a un topic
     */
    publish(topic, message) {
        if (this.isConnected && this.ws.publish) {
            this.ws.publish(topic, message);
        }
    }
}
//# sourceMappingURL=BunWebSocketAdapter.js.map