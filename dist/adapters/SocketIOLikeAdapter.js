import { EventEmitter } from 'events';
import { WebSocket, WebSocketServer } from 'ws';
import * as url from 'url';
import { nanoid } from 'nanoid';
import { defaultLogger as logger } from '../logger/index.js';
import { Emitter } from '../Emitter.js';
// Clase principal que emula Socket.IO usando WebSocket nativo
export class SocketIOLikeSocket extends EventEmitter {
    constructor(ws, request, server) {
        super();
        this.isConnected = true;
        this.lastActivity = Date.now();
        this.connectionStartTime = Date.now();
        this.rooms = new Set();
        this.ws = ws;
        this.id = nanoid();
        this.server = server;
        this.emitter = new Emitter();
        // Extraer query params
        const parsedUrl = url.parse(request.url || '', true);
        this.handshake = {
            query: parsedUrl.query,
        };
        // Simular conn.transport para compatibilidad con Socket.IO
        this.conn = {
            transport: {
                name: 'websocket'
            }
        };
        // Configurar broadcast
        this.broadcast = {
            emit: (event, ...args) => {
                this.server.broadcastToAll(event, args, this.id);
            },
            to: (room) => ({
                emit: (event, ...args) => {
                    this.server.broadcastToRoom(room, event, args, this.id);
                }
            })
        };
        this.setupWebSocketListeners();
        // Registrar usuario en el servidor
        this.server.registerUser(this);
    }
    setupWebSocketListeners() {
        // Manejar mensajes entrantes
        this.ws.on('message', (message) => {
            try {
                const data = JSON.parse(message.toString());
                //logger.debug("data",data)
                if (data.event && Array.isArray(data.payload)) {
                    this.lastActivity = Date.now();
                    //logger.debug("Mensaje entrante:", data.event,data.payload);
                    // Ignorar eventos de callback-response para evitar bucles
                    if (data.event === 'callback-response') {
                        return;
                    }
                    // Crear función de callback si hay callbackId
                    let callback;
                    if (data.callbackId) {
                        callback = (...args) => {
                            // Enviar respuesta del callback directamente al cliente
                            const callbackResponse = {
                                event: 'callback-response',
                                callbackId: data.callbackId,
                                payload: args
                            };
                            if (this.isConnected && this.ws.readyState === WebSocket.OPEN) {
                                this.ws.send(JSON.stringify(callbackResponse));
                            }
                        };
                    }
                    // Preparar argumentos incluyendo callback si existe
                    const args = callback ? [...data.payload, callback] : data.payload;
                    // Emitir usando el emitter interno
                    this.emitter.emit(data.event, ...args);
                    // También emitir usando EventEmitter nativo para compatibilidad
                    super.emit(data.event, ...args);
                }
            }
            catch (error) {
                logger.error('Error al parsear mensaje de WS:', error);
            }
        });
        // Manejar desconexión
        this.ws.on('close', (code, reason) => {
            this.isConnected = false;
            const reasonString = reason.toString();
            logger.info(`WebSocket ${this.id} cerrado`, {
                code,
                reason: reasonString,
                duration: Date.now() - this.connectionStartTime
            });
            // Limpiar del servidor
            this.server.unregisterUser(this.id);
            // Emitir evento de desconexión
            this.emitter.emit('disconnect', { code, reasonString });
            super.emit('disconnect', { code, reasonString });
        });
        this.ws.on('error', (err) => {
            this.isConnected = false;
            logger.error(`Error en WebSocket ${this.id}:`, err);
            this.server.unregisterUser(this.id);
            this.emitter.emit('disconnect');
            super.emit('disconnect');
        });
        // Manejar ping/pong
        this.ws.on('ping', (data) => {
            this.lastActivity = Date.now();
            if (this.isConnected) {
                this.ws.pong(data);
            }
        });
        this.ws.on('pong', (data) => {
            this.lastActivity = Date.now();
            this.emitter.emit('pong', data);
            super.emit('pong', data);
        });
    }
    // Método on usando el emitter personalizado
    on(event, callback) {
        this.emitter.on(event, callback);
        return this;
    }
    // Método once usando el emitter personalizado
    once(event, callback) {
        this.emitter.once(event, callback);
        return this;
    }
    // Método off usando el emitter personalizado
    off(event, callback) {
        if (callback) {
            this.emitter.off(event, callback);
        }
        else {
            this.emitter.removeAllListeners(event);
        }
        return this;
    }
    // Método emit para enviar datos al cliente
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
    // Unirse a una sala
    join(room) {
        this.rooms.add(room);
        this.server.addToRoom(room, this.id);
        logger.info(`Socket ${this.id} se unió a la sala ${room}`, {});
        return this;
    }
    // Salir de una sala
    leave(room) {
        this.rooms.delete(room);
        this.server.removeFromRoom(room, this.id);
        logger.info(`Socket ${this.id} salió de la sala ${room}`, {});
        return this;
    }
    // Obtener salas del socket
    getRooms() {
        return Array.from(this.rooms);
    }
    // Emitir a una sala específica
    to(room) {
        return {
            emit: (event, ...args) => {
                this.server.broadcastToRoom(room, event, args, this.id);
            }
        };
    }
    // Método disconnect
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
    // Ping nativo
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
    // Información de conexión
    getConnectionInfo() {
        return {
            id: this.id,
            isConnected: this.isConnected,
            readyState: this.ws.readyState,
            lastActivity: this.lastActivity,
            connectionDuration: Date.now() - this.connectionStartTime,
            rooms: this.getRooms()
        };
    }
    // Verificar si está vivo
    isAlive() {
        return this.isConnected && this.ws.readyState === WebSocket.OPEN;
    }
    // Compatibilidad con socket.io
    get nsp() {
        return undefined;
    }
}
// Servidor principal que maneja múltiples conexiones
export class SocketIOLikeServer extends EventEmitter {
    constructor() {
        super();
        this.users = new Map();
        this.rooms = new Map();
        this.emitter = new Emitter();
    }
    // Inicializar servidor WebSocket con puerto específico
    listen(port, callback) {
        this.wss = new WebSocketServer({ port });
        this.setupWebSocketServer();
        if (callback) {
            callback();
        }
        logger.info(`Servidor SocketIO-like escuchando en puerto ${port}`, {});
    }
    // Inicializar servidor WebSocket usando un servidor HTTP existente
    attach(server, callback) {
        this.wss = new WebSocketServer({ server });
        this.setupWebSocketServer();
        if (callback) {
            callback();
        }
        logger.info('Servidor SocketIO-like adjuntado al servidor HTTP existente', {});
    }
    // Configurar eventos del servidor WebSocket (método privado compartido)
    setupWebSocketServer() {
        if (!this.wss)
            return;
        this.wss.on('connection', (ws, request) => {
            const socket = new SocketIOLikeSocket(ws, request, this);
            logger.info(`Nueva conexión WebSocket: ${socket.id}`, {});
            // Emitir evento de conexión
            this.emitter.emit('connection', socket);
            super.emit('connection', socket);
        });
    }
    // Registrar usuario
    registerUser(socket) {
        const user = {
            id: socket.id,
            socket,
            joinedAt: Date.now(),
            rooms: new Set()
        };
        this.users.set(socket.id, user);
        logger.info(`Usuario registrado: ${socket.id}. Total usuarios: ${this.users.size}`, {});
    }
    // Desregistrar usuario
    unregisterUser(socketId) {
        const user = this.users.get(socketId);
        if (user) {
            // Remover de todas las salas
            user.rooms.forEach(room => {
                this.removeFromRoom(room, socketId);
            });
            this.users.delete(socketId);
            logger.info(`Usuario desregistrado: ${socketId}. Total usuarios: ${this.users.size}`, {});
        }
    }
    // Añadir a sala
    addToRoom(room, socketId) {
        if (!this.rooms.has(room)) {
            this.rooms.set(room, new Set());
        }
        this.rooms.get(room).add(socketId);
        const user = this.users.get(socketId);
        if (user) {
            user.rooms.add(room);
        }
    }
    // Remover de sala
    removeFromRoom(room, socketId) {
        const roomUsers = this.rooms.get(room);
        if (roomUsers) {
            roomUsers.delete(socketId);
            // Si la sala está vacía, eliminarla
            if (roomUsers.size === 0) {
                this.rooms.delete(room);
            }
        }
        const user = this.users.get(socketId);
        if (user) {
            user.rooms.delete(room);
        }
    }
    // Broadcast a todos los usuarios
    broadcastToAll(event, args, excludeId) {
        this.users.forEach((user, id) => {
            if (id !== excludeId && user.socket.isAlive()) {
                user.socket.emit(event, ...args);
            }
        });
    }
    // Broadcast a una sala específica
    broadcastToRoom(room, event, args, excludeId) {
        const roomUsers = this.rooms.get(room);
        if (roomUsers) {
            roomUsers.forEach(userId => {
                if (userId !== excludeId) {
                    const user = this.users.get(userId);
                    if (user && user.socket.isAlive()) {
                        user.socket.emit(event, ...args);
                    }
                }
            });
        }
    }
    // Métodos de eventos usando emitter personalizado
    on(event, callback) {
        this.emitter.on(event, callback);
        return this;
    }
    once(event, callback) {
        this.emitter.once(event, callback);
        return this;
    }
    off(event, callback) {
        if (callback) {
            this.emitter.off(event, callback);
        }
        else {
            this.emitter.removeAllListeners(event);
        }
        return this;
    }
    // Emitir a todos los usuarios conectados
    emit(event, ...args) {
        this.broadcastToAll(event, args);
        return true;
    }
    // Obtener estadísticas del servidor
    getStats() {
        const users = Array.from(this.users.values()).map(user => ({
            id: user.id,
            joinedAt: user.joinedAt,
            rooms: Array.from(user.rooms),
            isAlive: user.socket.isAlive()
        }));
        const rooms = {};
        this.rooms.forEach((users, room) => {
            rooms[room] = users.size;
        });
        return {
            totalUsers: this.users.size,
            totalRooms: this.rooms.size,
            users,
            rooms
        };
    }
    // Obtener usuario por ID
    getUser(socketId) {
        return this.users.get(socketId);
    }
    // Obtener usuarios en una sala
    getUsersInRoom(room) {
        const roomUsers = this.rooms.get(room);
        if (!roomUsers)
            return [];
        return Array.from(roomUsers)
            .map(id => this.users.get(id))
            .filter(user => user !== undefined);
    }
    // Cerrar servidor
    close(callback) {
        if (this.wss) {
            this.wss.close(callback);
        }
        // Desconectar todos los usuarios
        this.users.forEach(user => {
            user.socket.disconnect();
        });
        this.users.clear();
        this.rooms.clear();
        logger.info('Servidor SocketIO-like cerrado', {});
    }
}
// Instancia global del servidor
export const wsio = new SocketIOLikeServer();
//# sourceMappingURL=SocketIOLikeAdapter.js.map