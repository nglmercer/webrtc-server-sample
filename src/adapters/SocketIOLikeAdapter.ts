import { EventEmitter } from 'events';
import { RawData, WebSocket, WebSocketServer } from 'ws';
import { type ISocket, CustomSocket } from '../types';
import { ParsedUrlQuery } from 'querystring';
import * as url from 'url';
import { nanoid } from 'nanoid';
import { logger } from '../logger/index.js';
import { Emitter } from '../Emmiter.js';

// Interfaz para el usuario conectado
interface ConnectedUser {
  id: string;
  socket: SocketIOLikeSocket;
  joinedAt: number;
  rooms: Set<string>;
  data?: any;
}

// Clase principal que emula Socket.IO usando WebSocket nativo
export class SocketIOLikeSocket extends EventEmitter implements ISocket {
  id: string;
  handshake: {
    query: ParsedUrlQuery;
  };
  private ws: WebSocket;
  private isConnected: boolean = true;
  private lastActivity: number = Date.now();
  private connectionStartTime: number = Date.now();
  private emitter: Emitter;
  private rooms: Set<string> = new Set();
  private server: SocketIOLikeServer;
  
  broadcast: { 
    emit: (event: string, ...args: any[]) => void;
    to: (room: string) => { emit: (event: string, ...args: any[]) => void };
  };

  constructor(ws: WebSocket, request: any, server: SocketIOLikeServer) {
    super();
    this.ws = ws;
    this.id = nanoid();
    this.server = server;
    this.emitter = new Emitter();
    
    // Extraer query params
    const parsedUrl = url.parse(request.url || '', true);
    this.handshake = {
      query: parsedUrl.query,
    };

    // Configurar broadcast
    this.broadcast = {
      emit: (event: string, ...args: any[]) => {
        this.server.broadcastToAll(event, args, this.id);
      },
      to: (room: string) => ({
        emit: (event: string, ...args: any[]) => {
          this.server.broadcastToRoom(room, event, args, this.id);
        }
      })
    };

    this.setupWebSocketListeners();
    
    // Registrar usuario en el servidor
    this.server.registerUser(this);
  }

  private setupWebSocketListeners(): void {
    // Manejar mensajes entrantes
    this.ws.on('message', (message: RawData) => {
      try {
        const data = JSON.parse(message.toString());
        if (data.event && Array.isArray(data.payload)) {
          this.lastActivity = Date.now();
          // Emitir usando el emitter interno
          this.emitter.emit(data.event, ...data.payload);
          // También emitir usando EventEmitter nativo para compatibilidad
          super.emit(data.event, ...data.payload);
        }
      } catch (error) {
        logger.error('Error al parsear mensaje de WS:', error);
      }
    });

    // Manejar desconexión
    this.ws.on('close', (code: number, reason: Buffer) => {
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
      this.emitter.emit('disconnect', {code, reasonString});
      super.emit('disconnect', {code, reasonString});
    });

    this.ws.on('error', (err: Error) => {
      this.isConnected = false;
      logger.error(`Error en WebSocket ${this.id}:`, err);
      this.server.unregisterUser(this.id);
      this.emitter.emit('disconnect');
      super.emit('disconnect');
    });

    // Manejar ping/pong
    this.ws.on('ping', (data: Buffer) => {
      this.lastActivity = Date.now();
      if (this.isConnected) {
        this.ws.pong(data);
      }
    });

    this.ws.on('pong', (data: Buffer) => {
      this.lastActivity = Date.now();
      this.emitter.emit('pong', data);
      super.emit('pong', data);
    });
  }

  // Método on usando el emitter personalizado
  on(event: string, callback: (data: any) => void): this {
    this.emitter.on(event, callback);
    return this;
  }

  // Método once usando el emitter personalizado
  once(event: string, callback: (data: any) => void): this {
    this.emitter.once(event, callback);
    return this;
  }

  // Método off usando el emitter personalizado
  off(event: string, callback?: (data: any) => void): this {
    if (callback) {
      this.emitter.off(event, callback);
    } else {
      this.emitter.removeAllListeners(event);
    }
    return this;
  }

  // Método emit para enviar datos al cliente
  emit(event: string, ...args: any[]): boolean {
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
    } catch (error) {
      logger.error(`Error al enviar mensaje por WS ${this.id}:`, error);
      this.isConnected = false;
      return false;
    }
  }

  // Unirse a una sala
  join(room: string): this {
    this.rooms.add(room);
    this.server.addToRoom(room, this.id);
    logger.info(`Socket ${this.id} se unió a la sala ${room}`,{});
    return this;
  }

  // Salir de una sala
  leave(room: string): this {
    this.rooms.delete(room);
    this.server.removeFromRoom(room, this.id);
    logger.info(`Socket ${this.id} salió de la sala ${room}`,{});
    return this;
  }

  // Obtener salas del socket
  getRooms(): string[] {
    return Array.from(this.rooms);
  }

  // Emitir a una sala específica
  to(room: string): { emit: (event: string, ...args: any[]) => void } {
    return {
      emit: (event: string, ...args: any[]) => {
        this.server.broadcastToRoom(room, event, args, this.id);
      }
    };
  }

  // Método disconnect
  disconnect(close?: boolean): this {
    if (this.isConnected) {
      this.isConnected = false;
      try {
        this.ws.close(1000, 'Normal closure');
      } catch (error) {
        logger.error(`Error cerrando WebSocket ${this.id}:`, error);
      }
    }
    return this;
  }

  // Ping nativo
  ping(data?: Buffer): void {
    if (this.isConnected && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.ping(data);
        this.lastActivity = Date.now();
      } catch (error) {
        logger.error(`Error enviando ping a WebSocket ${this.id}:`, error);
      }
    }
  }

  // Información de conexión
  getConnectionInfo(): {
    id: string;
    isConnected: boolean;
    readyState: number;
    lastActivity: number;
    connectionDuration: number;
    rooms: string[];
  } {
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
  isAlive(): boolean {
    return this.isConnected && this.ws.readyState === WebSocket.OPEN;
  }

  // Compatibilidad con socket.io
  get nsp(): any {
    return undefined;
  }
}

// Servidor principal que maneja múltiples conexiones
export class SocketIOLikeServer extends EventEmitter {
  private users: Map<string, ConnectedUser> = new Map();
  private rooms: Map<string, Set<string>> = new Map();
  private emitter: Emitter;
  private wss?: WebSocketServer;

  constructor() {
    super();
    this.emitter = new Emitter();
  }

  // Inicializar servidor WebSocket con puerto específico
  listen(port: number, callback?: () => void): void {
    this.wss = new WebSocketServer({ port });
    this.setupWebSocketServer();

    if (callback) {
      callback();
    }
    
    logger.info(`Servidor SocketIO-like escuchando en puerto ${port}`,{});
  }

  // Inicializar servidor WebSocket usando un servidor HTTP existente
  attach(server: any, callback?: () => void): void {
    this.wss = new WebSocketServer({ server });
    this.setupWebSocketServer();

    if (callback) {
      callback();
    }
    
    logger.info('Servidor SocketIO-like adjuntado al servidor HTTP existente',{});
  }

  // Configurar eventos del servidor WebSocket (método privado compartido)
  private setupWebSocketServer(): void {
    if (!this.wss) return;
    
    this.wss.on('connection', (ws: WebSocket, request: any) => {
      const socket = new SocketIOLikeSocket(ws, request, this);
      logger.info(`Nueva conexión WebSocket: ${socket.id}`,{});
      
      // Emitir evento de conexión
      this.emitter.emit('connection', socket);
      super.emit('connection', socket);
    });
  }

  // Registrar usuario
  registerUser(socket: SocketIOLikeSocket): void {
    const user: ConnectedUser = {
      id: socket.id,
      socket,
      joinedAt: Date.now(),
      rooms: new Set()
    };
    
    this.users.set(socket.id, user);
    logger.info(`Usuario registrado: ${socket.id}. Total usuarios: ${this.users.size}`,{});
  }

  // Desregistrar usuario
  unregisterUser(socketId: string): void {
    const user = this.users.get(socketId);
    if (user) {
      // Remover de todas las salas
      user.rooms.forEach(room => {
        this.removeFromRoom(room, socketId);
      });
      
      this.users.delete(socketId);
      logger.info(`Usuario desregistrado: ${socketId}. Total usuarios: ${this.users.size}`,{});
    }
  }

  // Añadir a sala
  addToRoom(room: string, socketId: string): void {
    if (!this.rooms.has(room)) {
      this.rooms.set(room, new Set());
    }
    
    this.rooms.get(room)!.add(socketId);
    
    const user = this.users.get(socketId);
    if (user) {
      user.rooms.add(room);
    }
  }

  // Remover de sala
  removeFromRoom(room: string, socketId: string): void {
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
  broadcastToAll(event: string, args: any[], excludeId?: string): void {
    this.users.forEach((user, id) => {
      if (id !== excludeId && user.socket.isAlive()) {
        user.socket.emit(event, ...args);
      }
    });
  }

  // Broadcast a una sala específica
  broadcastToRoom(room: string, event: string, args: any[], excludeId?: string): void {
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
  on(event: string, callback: (data: any) => void): this {
    this.emitter.on(event, callback);
    return this;
  }

  once(event: string, callback: (data: any) => void): this {
    this.emitter.once(event, callback);
    return this;
  }

  off(event: string, callback?: (data: any) => void): this {
    if (callback) {
      this.emitter.off(event, callback);
    } else {
      this.emitter.removeAllListeners(event);
    }
    return this;
  }

  // Emitir a todos los usuarios conectados
  emit(event: string, ...args: any[]): boolean {
    this.broadcastToAll(event, args);
    return true;
  }

  // Obtener estadísticas del servidor
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
  } {
    const users = Array.from(this.users.values()).map(user => ({
      id: user.id,
      joinedAt: user.joinedAt,
      rooms: Array.from(user.rooms),
      isAlive: user.socket.isAlive()
    }));

    const rooms: Record<string, number> = {};
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
  getUser(socketId: string): ConnectedUser | undefined {
    return this.users.get(socketId);
  }

  // Obtener usuarios en una sala
  getUsersInRoom(room: string): ConnectedUser[] {
    const roomUsers = this.rooms.get(room);
    if (!roomUsers) return [];
    
    return Array.from(roomUsers)
      .map(id => this.users.get(id))
      .filter(user => user !== undefined) as ConnectedUser[];
  }

  // Cerrar servidor
  close(callback?: () => void): void {
    if (this.wss) {
      this.wss.close(callback);
    }
    
    // Desconectar todos los usuarios
    this.users.forEach(user => {
      user.socket.disconnect();
    });
    
    this.users.clear();
    this.rooms.clear();
    
    logger.info('Servidor SocketIO-like cerrado',{});
  }
}

// Instancia global del servidor
export const wsio = new SocketIOLikeServer();

// Exportar tipos
export type { ConnectedUser };