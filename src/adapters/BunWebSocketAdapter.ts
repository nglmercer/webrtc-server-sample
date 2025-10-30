import { EventEmitter } from "events";
import { type ISocket } from "../types";
import { ParsedUrlQuery } from "querystring";
import { nanoid } from "nanoid";
import { randomUUID } from "crypto";
import { defaultLogger as logger } from "../logger/index.js";

/**
 * Adaptador para WebSocket nativo de Bun
 * Implementa la interfaz ISocket para compatibilidad con el servidor de señalización
 */
export class BunWebSocketAdapter extends EventEmitter implements ISocket {
  id: string;
  userid: string;
  handshake: {
    query: ParsedUrlQuery;
  };
  connected: boolean = true;
  admininfo?: {
    sessionid: string;
    session: any;
    mediaConstraints: any;
    sdpConstraints: any;
    streams: any;
    extra: any;
  };
  ondisconnect?: () => void;

  private ws: any; // Bun's ServerWebSocket
  private isConnected: boolean = true;
  private lastActivity: number = Date.now();
  private connectionStartTime: number = Date.now();

  broadcast: { emit: (event: string, ...args: any[]) => void };

  // Getter for data property that tests expect
  get data(): any {
    return this.ws.data || {};
  }

  constructor(ws: any) {
    super();
    this.ws = ws;
    this.id = nanoid();
    this.userid = randomUUID(); // Generate proper UUID format

    // Extraer query params si están disponibles
    this.handshake = {
      query: {}, // Bun no proporciona query params directamente en el WebSocket
    };

    // Almacenar referencia del adapter en el WebSocket para uso posterior
    if (!this.ws.data) {
      this.ws.data = {};
    }
    this.ws.data.adapter = this;

    // Set up WebSocket event listeners
    if (this.ws.on) {
      this.ws.on("message", (message: string | ArrayBuffer | Uint8Array) => {
        this.handleMessage(message);
      });

      this.ws.on("close", (code: number, reason: string) => {
        this.handleClose(code, reason);
      });

      this.ws.on("error", (error: Error) => {
        this.handleError(error);
      });
    }

    this.broadcast = {
      emit: (event: string, ...args: any[]) => {
        console.warn(
          `Broadcast.emit llamado en BunWebSocketAdapter. Esta función debe ser manejada a nivel de aplicación.`,
        );
      },
    };
  }

  /**
   * Maneja mensajes entrantes del WebSocket
   */
  handleMessage(message: string | ArrayBuffer | Uint8Array): void {
    try {
      const messageStr =
        typeof message === "string"
          ? message
          : new TextDecoder().decode(message);

      // Handle empty messages
      if (!messageStr.trim()) {
        super.emit("error", new Error("Empty message received"));
        return;
      }

      const data = JSON.parse(messageStr);

      if (data.event && Array.isArray(data.args)) {
        this.lastActivity = Date.now();
        super.emit(data.event, ...data.args);
      } else {
        super.emit(
          "error",
          new Error("Invalid message format: missing event or args"),
        );
      }
    } catch (error) {
      logger.error("Error al parsear mensaje de WebSocket:", error, {
        socketId: this.id,
      });
      super.emit("error", error);
    }
  }

  /**
   * Maneja el cierre de la conexión
   */
  handleClose(code: number, reason: string): void {
    this.isConnected = false;
    this.connected = false;
    logger.info(`WebSocket ${this.id} cerrado`, {
      code,
      reason,
      duration: Date.now() - this.connectionStartTime,
    });
    super.emit("disconnect", reason);
  }

  /**
   * Maneja errores de la conexión
   */
  handleError(error: Error): void {
    this.isConnected = false;
    this.connected = false;
    logger.error(`Error en WebSocket ${this.id}:`, error);
    super.emit("error", error);
  }

  /**
   * Envía un mensaje al cliente
   */
  emit(event: string, ...args: any[]): boolean {
    if (!this.isConnected) {
      logger.warn(`Intento de envío a WebSocket ${this.id} desconectado`, {
        data: event,
      });
      return false;
    }

    try {
      // Handle circular references by using a custom replacer
      const getCircularReplacer = () => {
        const seen = new WeakSet();
        return (key: any, value: any) => {
          if (typeof value === "object" && value !== null) {
            if (seen.has(value)) {
              return "[Circular]";
            }
            seen.add(value);
          }
          return value;
        };
      };

      const message = JSON.stringify(
        {
          event: event,
          args: args,
        },
        getCircularReplacer(),
      );

      this.ws.send(message);
      this.lastActivity = Date.now();
      return true;
    } catch (error) {
      logger.error(`Error al enviar mensaje por WebSocket ${this.id}:`, error);
      this.isConnected = false;
      super.emit("error", error);
      return false;
    }
  }

  /**
   * Cierra la conexión
   */
  disconnect(close?: boolean, reason?: string): this {
    if (this.isConnected) {
      this.isConnected = false;
      this.connected = false;
      try {
        this.ws.close(1000, reason || "Normal closure");
      } catch (error) {
        logger.error(`Error cerrando WebSocket ${this.id}:`, error);
      }
    }
    return this;
  }

  /**
   * Envía un ping
   */
  ping(data?: Buffer): void {
    if (this.isConnected) {
      try {
        // Bun's WebSocket tiene ping nativo
        this.ws.ping(data);
        this.lastActivity = Date.now();
      } catch (error) {
        logger.error(`Error enviando ping a WebSocket ${this.id}:`, error);
      }
    }
  }

  /**
   * Obtiene información de estado de la conexión
   */
  getConnectionInfo(): {
    id: string;
    isConnected: boolean;
    readyState: number;
    lastActivity: number;
    connectionDuration: number;
  } {
    return {
      id: this.id,
      isConnected: this.isConnected,
      readyState: this.isConnected ? 1 : 3, // 1 = OPEN, 3 = CLOSED
      lastActivity: this.lastActivity,
      connectionDuration: Date.now() - this.connectionStartTime,
    };
  }

  // Add missing event methods that the tests expect
  off(event: string, callback: (...args: any[]) => void): this {
    super.off(event, callback);
    return this;
  }

  on(event: string, callback: (...args: any[]) => void): this {
    super.on(event, callback);
    return this;
  }

  /**
   * Verifica si la conexión está activa
   */
  isAlive(): boolean {
    return this.isConnected;
  }

  /**
   * Propiedad nsp para compatibilidad
   */
  get nsp(): any {
    return undefined;
  }

  /**
   * Suscribirse a un topic (usando pub/sub nativo de Bun)
   */
  subscribe(topic: string): void {
    if (this.isConnected && this.ws.subscribe) {
      this.ws.subscribe(topic);
    }
  }

  /**
   * Desuscribirse de un topic
   */
  unsubscribe(topic: string): void {
    if (this.isConnected && this.ws.unsubscribe) {
      this.ws.unsubscribe(topic);
    }
  }

  /**
   * Publicar a un topic
   */
  publish(topic: string, message: string): void {
    if (this.isConnected && this.ws.publish) {
      this.ws.publish(topic, message);
    }
  }
}
