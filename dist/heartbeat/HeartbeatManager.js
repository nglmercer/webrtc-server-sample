import { EventEmitter } from 'events';
import { defaultLogger as logger } from '../logger/index.js';
/**
 * Gestor de heartbeat simplificado.
 */
export class HeartbeatManager extends EventEmitter {
    constructor(config = {}) {
        super();
        this.sockets = new Map();
        this.isRunning = false;
        this.config = {
            enableHeartbeat: true,
            pingInterval: 30000,
            pongTimeout: 10000,
            maxFailedPings: 3,
            enableLogging: false,
            ...config,
        };
    }
    start() {
        if (this.isRunning || !this.config.enableHeartbeat) {
            return;
        }
        this.isRunning = true;
        if (this.config.enableLogging) {
            logger.info('HeartbeatManager iniciado.');
        }
    }
    stop() {
        if (!this.isRunning) {
            return;
        }
        this.isRunning = false;
        for (const info of this.sockets.values()) {
            this.clearSocketTimers(info);
        }
        this.sockets.clear();
        if (this.config.enableLogging) {
            logger.info('HeartbeatManager detenido.');
        }
    }
    addSocket(socket) {
        if (!this.isRunning) {
            this.start();
        }
        if (this.sockets.has(socket.id)) {
            return; // Evitar duplicados
        }
        const socketInfo = {
            socket,
            failedPings: 0,
        };
        this.sockets.set(socket.id, socketInfo);
        this.setupSocketHandlers(socketInfo);
        this.schedulePing(socketInfo); // Iniciar el ciclo
        if (this.config.enableLogging) {
            logger.debug(`Socket ${socket.id} agregado al heartbeat manager.`);
        }
    }
    removeSocket(socketId) {
        const socketInfo = this.sockets.get(socketId);
        if (!socketInfo) {
            return;
        }
        this.clearSocketTimers(socketInfo);
        this.sockets.delete(socketId);
        if (this.config.enableLogging) {
            logger.debug(`Socket ${socketId} removido del heartbeat manager.`);
        }
    }
    setupSocketHandlers(socketInfo) {
        const { socket } = socketInfo;
        // Escuchar un 'pong' genérico, sin ID.
        const pongListener = () => this.handlePong(socketInfo);
        socket.on('pong', pongListener);
        // Guardamos la referencia para poder limpiarla después.
        const cleanup = () => {
            socket.off('pong', pongListener);
            socket.off('disconnect', cleanup);
            socket.off('error', errorCleanup);
            this.removeSocket(socket.id);
        };
        const errorCleanup = (error) => {
            if (this.config.enableLogging) {
                logger.error(`Error en socket ${socket.id}, removiendo:`, error);
            }
            cleanup();
        };
        socket.on('disconnect', cleanup);
        socket.on('error', errorCleanup);
    }
    schedulePing(socketInfo) {
        // Limpiar timer anterior para evitar duplicados
        if (socketInfo.pingTimer)
            clearTimeout(socketInfo.pingTimer);
        socketInfo.pingTimer = setTimeout(() => {
            this.sendPing(socketInfo);
        }, this.config.pingInterval);
    }
    sendPing(socketInfo) {
        if (!socketInfo.socket.connected) {
            return this.removeSocket(socketInfo.socket.id);
        }
        socketInfo.lastPingTime = Date.now();
        socketInfo.socket.emit('ping');
        this.emit('ping-sent', socketInfo.socket.id, socketInfo.lastPingTime);
        if (this.config.enableLogging) {
            logger.debug(`Ping enviado a socket ${socketInfo.socket.id}.`);
        }
        // Limpiar timer de pong anterior y establecer uno nuevo
        if (socketInfo.pongTimer)
            clearTimeout(socketInfo.pongTimer);
        socketInfo.pongTimer = setTimeout(() => {
            this.handlePongTimeout(socketInfo);
        }, this.config.pongTimeout);
    }
    handlePong(socketInfo) {
        // Si no estábamos esperando un pong (ej. ya hubo timeout), ignorar.
        if (!socketInfo.pongTimer)
            return;
        clearTimeout(socketInfo.pongTimer);
        socketInfo.pongTimer = undefined;
        const timestamp = Date.now();
        const latency = socketInfo.lastPingTime ? timestamp - socketInfo.lastPingTime : 0;
        // Si había fallado antes, consideramos la conexión restaurada.
        if (socketInfo.failedPings > 0) {
            this.emit('connection-restored', socketInfo.socket.id, socketInfo.socket);
            if (this.config.enableLogging) {
                logger.info(`Conexión restaurada para socket ${socketInfo.socket.id}.`);
            }
        }
        socketInfo.failedPings = 0;
        this.emit('pong-received', socketInfo.socket.id, timestamp, latency);
        if (this.config.enableLogging) {
            logger.debug(`Pong recibido de ${socketInfo.socket.id}. Latencia: ${latency}ms.`);
        }
        // Programar el siguiente ping
        this.schedulePing(socketInfo);
    }
    handlePongTimeout(socketInfo) {
        socketInfo.pongTimer = undefined; // El timer ya se disparó
        socketInfo.failedPings++;
        this.emit('ping-timeout', socketInfo.socket.id, socketInfo.failedPings);
        if (this.config.enableLogging) {
            logger.warn(`Timeout de pong para socket ${socketInfo.socket.id}. Fallos: ${socketInfo.failedPings}`);
        }
        if (socketInfo.failedPings >= this.config.maxFailedPings) {
            if (this.config.enableLogging) {
                logger.error(`Conexión perdida para socket ${socketInfo.socket.id}.`);
            }
            this.emit('connection-lost', socketInfo.socket.id, socketInfo.socket);
            socketInfo.socket.disconnect(true); // El evento 'disconnect' se encargará de la limpieza.
        }
        else {
            // Reintentar inmediatamente para comprobar si la conexión vuelve.
            this.sendPing(socketInfo);
        }
    }
    clearSocketTimers(socketInfo) {
        if (socketInfo.pingTimer)
            clearTimeout(socketInfo.pingTimer);
        if (socketInfo.pongTimer)
            clearTimeout(socketInfo.pongTimer);
        socketInfo.pingTimer = undefined;
        socketInfo.pongTimer = undefined;
    }
}
export const defaultHeartbeatManager = new HeartbeatManager();
//# sourceMappingURL=HeartbeatManager.js.map