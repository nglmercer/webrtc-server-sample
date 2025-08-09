import { EventEmitter } from 'events';
import { logger } from '../logger/index.js';
/**
 * Gestor de heartbeat para detectar conexiones perdidas y mantener conexiones activas
 */
export class HeartbeatManager extends EventEmitter {
    constructor(config = {}) {
        super();
        this.sockets = new Map();
        this.isRunning = false;
        // Configuración por defecto
        this.config = {
            pingInterval: 60000, // 60 segundos
            pongTimeout: 10000, // 10 segundos
            maxFailedPings: 3, // 3 intentos fallidos
            enableLogging: false,
            ...config
        };
        if (this.config.enableLogging) {
            logger.info('HeartbeatManager inicializado', {
                data: this.isRunning
            });
        }
    }
    /**
     * Inicia el sistema de heartbeat
     */
    start(config = {}) {
        this.config = {
            ...this.config,
            ...config
        };
        if (this.isRunning) {
            logger.warn('HeartbeatManager ya está ejecutándose', {
                data: this.isRunning
            });
            return;
        }
        this.isRunning = true;
        if (this.config.enableLogging) {
            logger.info('HeartbeatManager iniciado', {
                data: this.isRunning
            });
        }
    }
    /**
     * Detiene el sistema de heartbeat
     */
    stop() {
        if (!this.isRunning) {
            return;
        }
        this.isRunning = false;
        // Limpiar todos los timers activos
        for (const [socketId, info] of this.sockets) {
            this.clearSocketTimers(info);
        }
        this.sockets.clear();
        if (this.config.enableLogging) {
            logger.info('HeartbeatManager detenido', {
                data: this.sockets.size
            });
        }
    }
    /**
     * Registra un socket para monitoreo de heartbeat
     */
    addSocket(socket) {
        if (!this.isRunning) {
            logger.warn('HeartbeatManager no está ejecutándose. Iniciando automáticamente.', {
                data: this.isRunning
            });
            this.start();
        }
        const socketInfo = {
            socket,
            failedPings: 0,
            isAlive: true
        };
        this.sockets.set(socket.id, socketInfo);
        // Configurar manejadores de eventos del socket
        this.setupSocketHandlers(socketInfo);
        // Iniciar el primer ping
        this.schedulePing(socketInfo);
        if (this.config.enableLogging) {
            logger.debug(`Socket ${socket.id} agregado al heartbeat manager`, {
                data: socket.id
            });
        }
    }
    /**
     * Remueve un socket del monitoreo de heartbeat
     */
    removeSocket(socketId) {
        const socketInfo = this.sockets.get(socketId);
        if (!socketInfo) {
            return;
        }
        this.clearSocketTimers(socketInfo);
        this.sockets.delete(socketId);
        if (this.config.enableLogging) {
            logger.debug(`Socket ${socketId} removido del heartbeat manager`, {
                data: socketId
            });
        }
    }
    /**
     * Obtiene estadísticas del heartbeat
     */
    getStats() {
        let aliveSockets = 0;
        let deadSockets = 0;
        let socketsWithFailedPings = 0;
        for (const [, info] of this.sockets) {
            if (info.isAlive) {
                aliveSockets++;
            }
            else {
                deadSockets++;
            }
            if (info.failedPings > 0) {
                socketsWithFailedPings++;
            }
        }
        return {
            totalSockets: this.sockets.size,
            aliveSockets,
            deadSockets,
            socketsWithFailedPings
        };
    }
    /**
     * Configura los manejadores de eventos para un socket
     */
    setupSocketHandlers(socketInfo) {
        const { socket } = socketInfo;
        // Escuchar respuestas pong
        socket.on('pong', () => {
            this.handlePong(socketInfo);
        });
        // Escuchar desconexiones
        socket.on('disconnect', () => {
            this.removeSocket(socket.id);
        });
    }
    /**
     * Programa el próximo ping para un socket
     */
    schedulePing(socketInfo) {
        if (!this.isRunning) {
            return;
        }
        if (!this.config.pongTimeout)
            return;
        socketInfo.pingTimer = setTimeout(() => {
            this.sendPing(socketInfo);
        }, this.config.pingInterval);
    }
    /**
     * Envía un ping a un socket
     */
    sendPing(socketInfo) {
        const { socket } = socketInfo;
        const timestamp = Date.now();
        socketInfo.lastPingTime = timestamp;
        try {
            // Enviar ping
            socket.emit('ping', timestamp);
            this.emit('ping-sent', socket.id, timestamp);
            if (this.config.enableLogging) {
                logger.debug(`Ping enviado a socket ${socket.id}`, {
                    data: socket.id
                });
            }
            // Configurar timeout para pong
            socketInfo.pongTimer = setTimeout(() => {
                this.handlePongTimeout(socketInfo);
            }, this.config.pongTimeout);
        }
        catch (error) {
            logger.error(`Error enviando ping a socket ${socket.id}:`, error);
            this.handlePongTimeout(socketInfo);
        }
    }
    /**
     * Maneja la recepción de un pong
     */
    handlePong(socketInfo) {
        const { socket } = socketInfo;
        const timestamp = Date.now();
        socketInfo.lastPongTime = timestamp;
        socketInfo.failedPings = 0;
        // Limpiar timeout de pong
        if (socketInfo.pongTimer) {
            clearTimeout(socketInfo.pongTimer);
            socketInfo.pongTimer = undefined;
        }
        // Calcular latencia
        const latency = socketInfo.lastPingTime ? timestamp - socketInfo.lastPingTime : 0;
        // Si la conexión estaba marcada como muerta, restaurarla
        if (!socketInfo.isAlive) {
            socketInfo.isAlive = true;
            this.emit('connection-restored', socket.id, socket);
            if (this.config.enableLogging) {
                logger.info(`Conexión restaurada para socket ${socket.id}`, {
                    latency
                });
            }
        }
        this.emit('pong-received', socket.id, timestamp, latency);
        if (this.config.enableLogging) {
            logger.debug(`Pong recibido de socket ${socket.id}, latencia: ${latency}ms`, {
                latency
            });
        }
        // Programar el siguiente ping
        this.schedulePing(socketInfo);
    }
    /**
     * Maneja el timeout de pong (no se recibió respuesta)
     */
    handlePongTimeout(socketInfo) {
        const { socket } = socketInfo;
        socketInfo.failedPings++;
        this.emit('ping-timeout', socket.id, socketInfo.failedPings);
        if (this.config.enableLogging) {
            logger.warn(`Timeout de pong para socket ${socket.id}, intentos fallidos: ${socketInfo.failedPings}`, {
                data: socket.id
            });
        }
        if (socketInfo.failedPings >= this.config.maxFailedPings) {
            // Marcar conexión como perdida
            socketInfo.isAlive = false;
            this.emit('connection-lost', socket.id, socket);
            if (this.config.enableLogging) {
                logger.error(`Conexión perdida para socket ${socket.id} después de ${socketInfo.failedPings} intentos fallidos`, socket.id);
            }
            // Forzar desconexión
            try {
                socket.disconnect(true);
            }
            catch (error) {
                logger.error(`Error desconectando socket ${socket.id}:`, error);
            }
            // Remover del manager
            this.removeSocket(socket.id);
        }
        else {
            // Reintentar después de un intervalo más corto
            socketInfo.pingTimer = setTimeout(() => {
                this.sendPing(socketInfo);
            }, Math.min(this.config.pingInterval / 2, 5000)); // Máximo 5 segundos
        }
    }
    /**
     * Limpia los timers de un socket
     */
    clearSocketTimers(socketInfo) {
        if (socketInfo.pingTimer) {
            clearTimeout(socketInfo.pingTimer);
            socketInfo.pingTimer = undefined;
        }
        if (socketInfo.pongTimer) {
            clearTimeout(socketInfo.pongTimer);
            socketInfo.pongTimer = undefined;
        }
    }
}
// Instancia por defecto
export const defaultHeartbeatManager = new HeartbeatManager();
//# sourceMappingURL=HeartbeatManager.js.map