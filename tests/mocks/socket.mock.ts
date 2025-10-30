// Socket mock implementations for testing WebRTC signaling server (Bun-compatible)

import type { CustomSocket, ISocket } from "../../src/types";
import type { MockLogger } from "./logger.mock";

// Mock WebSocket implementation
export class MockWebSocket {
  public readyState: number = 1; // OPEN
  public data: any = {};
  public closed: boolean = false;

  private eventListeners: Map<string, Function[]> = new Map();
  private sentMessages: any[] = [];
  private mockLogger?: MockLogger;

  constructor(logger?: MockLogger) {
    this.mockLogger = logger;
    this.data = {
      clientIP: "127.0.0.1",
      userAgent: "Test-Agent-Mock",
      timestamp: Date.now(),
    };
  }

  send(data: string | Buffer): void {
    this.sentMessages.push(data);

    if (this.mockLogger) {
      this.mockLogger.debug("MockWebSocket.send", {
        dataType: typeof data,
        dataSize: typeof data === "string" ? data.length : data.byteLength,
      });
    }
  }

  close(code?: number, reason?: string): void {
    this.readyState = 3; // CLOSED
    this.closed = true;

    if (this.mockLogger) {
      this.mockLogger.debug("MockWebSocket.close", { code, reason });
    }

    this.emit("close", {
      code: code || 1000,
      reason: reason || "Normal closure",
    });
  }

  on(event: string, callback: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  off(event: string, callback?: Function): void {
    if (callback) {
      const listeners = this.eventListeners.get(event);
      if (listeners) {
        const index = listeners.indexOf(callback);
        if (index > -1) {
          listeners.splice(index, 1);
        }
      }
    } else {
      this.eventListeners.delete(event);
    }
  }

  once(event: string, callback: Function): void {
    const onceWrapper = (...args: any[]) => {
      this.off(event, onceWrapper);
      callback(...args);
    };
    this.on(event, onceWrapper);
  }

  emit(event: string, ...args: any[]): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach((callback) => {
        try {
          callback(...args);
        } catch (error) {
          if (this.mockLogger) {
            this.mockLogger.error("MockWebSocket.event.error", {
              event,
              error,
            });
          }
        }
      });
    }
  }

  // Helper methods for testing
  simulateMessage(data: string | Buffer): void {
    if (this.mockLogger) {
      this.mockLogger.debug("MockWebSocket.simulateMessage", {
        dataType: typeof data,
        dataSize: typeof data === "string" ? data.length : data.byteLength,
      });
    }
    this.emit("message", data);
  }

  simulateError(error: Error): void {
    if (this.mockLogger) {
      this.mockLogger.debug("MockWebSocket.simulateError", {
        error: error.message,
      });
    }
    this.emit("error", error);
  }

  simulateConnectionLost(): void {
    this.simulateError(new Error("Connection lost"));
    this.close(1006, "Connection lost");
  }

  getSentMessages(): any[] {
    return [...this.sentMessages];
  }

  getLastSentMessage(): any {
    return this.sentMessages[this.sentMessages.length - 1];
  }

  clearSentMessages(): void {
    this.sentMessages = [];
  }

  reset(): void {
    this.readyState = 1;
    this.closed = false;
    this.clearSentMessages();
    this.eventListeners.clear();
  }
}

// Mock Socket.IO socket implementation
export class MockSocket implements CustomSocket {
  public id: string;
  public userid: string;
  public handshake: { query: any };
  public connected: boolean = true;
  public admininfo?: any;
  public emittedEvents: Array<{
    event: string;
    args: any[];
    timestamp: number;
  }> = [];
  public receivedEvents: Array<{
    event: string;
    args: any[];
    timestamp: number;
  }> = [];
  public disconnectedWith: Set<string> = new Set();

  private eventHandlers: Map<string, Function[]> = new Map();
  private mockLogger?: MockLogger;

  constructor(id?: string, userid?: string, logger?: MockLogger) {
    this.mockLogger = logger;
    this.id = id || `socket-${this.generateId()}`;
    this.userid = userid || `user-${this.generateId()}`;
    this.handshake = {
      query: {
        userid: this.userid,
        sessionid: `session-${this.generateId()}`,
        timestamp: Date.now(),
      },
    };
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  on(event: string, callback: Function): this {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(callback);

    if (this.mockLogger) {
      this.mockLogger.debug("MockSocket.on", { socketId: this.id, event });
    }

    return this;
  }

  off(event: string, callback: Function): this {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(callback);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }

    if (this.mockLogger) {
      this.mockLogger.debug("MockSocket.off", { socketId: this.id, event });
    }

    return this;
  }

  emit(event: string, ...args: any[]): boolean {
    if (!this.connected) {
      if (this.mockLogger) {
        this.mockLogger.warn("MockSocket.emit.disconnected", {
          socketId: this.id,
          event,
        });
      }
      return false;
    }

    const eventData = {
      event,
      args,
      timestamp: Date.now(),
    };

    this.emittedEvents.push(eventData);

    // Also log as received event for testing purposes
    this.receivedEvents.push({ ...eventData });

    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(...args);
        } catch (error) {
          if (this.mockLogger) {
            this.mockLogger.error("MockSocket.handler.error", {
              socketId: this.id,
              event,
              error,
            });
          }
        }
      });
    }

    if (this.mockLogger) {
      this.mockLogger.debug("MockSocket.emit", {
        socketId: this.id,
        event,
        argCount: args.length,
      });
    }

    return true;
  }

  disconnect(close?: boolean): this {
    this.connected = false;
    this.emit("disconnect", close ? "server" : "client");

    if (this.mockLogger) {
      this.mockLogger.debug("MockSocket.disconnect", {
        socketId: this.id,
        close,
      });
    }

    return this;
  }

  public broadcast = {
    emit: (event: string, ...args: any[]) => {
      // Mock broadcast implementation
      if (this.mockLogger) {
        this.mockLogger.debug("MockSocket.broadcast.emit", {
          socketId: this.id,
          event,
          argCount: args.length,
        });
      }
    },
  };

  // Helper methods for testing
  simulateEvent(event: string, ...args: any[]): void {
    if (this.mockLogger) {
      this.mockLogger.debug("MockSocket.simulateEvent", {
        socketId: this.id,
        event,
      });
    }

    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(...args);
        } catch (error) {
          if (this.mockLogger) {
            this.mockLogger.error("MockSocket.simulateEvent.error", {
              socketId: this.id,
              event,
              error,
            });
          }
        }
      });
    }
  }

  getLastEmittedEvent(event?: string): any {
    const events = event
      ? this.emittedEvents.filter((e) => e.event === event)
      : this.emittedEvents;

    return events.length > 0 ? events[events.length - 1] : undefined;
  }

  getLastReceivedEvent(event?: string): any {
    const events = event
      ? this.receivedEvents.filter((e) => e.event === event)
      : this.receivedEvents;

    return events.length > 0 ? events[events.length - 1] : undefined;
  }

  getEmittedEvents(event?: string): any[] {
    return event
      ? this.emittedEvents.filter((e) => e.event === event)
      : [...this.emittedEvents];
  }

  getReceivedEvents(event?: string): any[] {
    return event
      ? this.receivedEvents.filter((e) => e.event === event)
      : [...this.receivedEvents];
  }

  clearEmittedEvents(): void {
    this.emittedEvents = [];
  }

  clearReceivedEvents(): void {
    this.receivedEvents = [];
  }

  reset(): void {
    this.connected = true;
    this.clearEmittedEvents();
    this.clearReceivedEvents();
    this.disconnectedWith.clear();
    this.eventHandlers.clear();
  }

  // Connection tracking
  markDisconnectedWith(userid: string): void {
    this.disconnectedWith.add(userid);
  }

  isDisconnectedWith(userid: string): boolean {
    return this.disconnectedWith.has(userid);
  }

  clearDisconnectedWith(): void {
    this.disconnectedWith.clear();
  }

  // Utility methods
  waitForEvent(event: string, timeout: number = 5000): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.off(event, handler);
        reject(new Error(`Timeout waiting for event: ${event}`));
      }, timeout);

      const handler = (...args: any[]) => {
        clearTimeout(timer);
        this.off(event, handler);
        resolve(args);
      };

      this.on(event, handler);
    });
  }

  expectEvent(event: string, timeout: number = 1000): Promise<any[]> {
    return this.waitForEvent(event, timeout);
  }

  expectNoEvent(event: string, delay: number = 100): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(() => {
        const events = this.getReceivedEvents(event);
        if (events.length === 0) {
          resolve();
        } else {
          throw new Error(
            `Expected no '${event}' events, but ${events.length} were received`,
          );
        }
      }, delay);
    });
  }
}

// Mock factory functions
export const createMockWebSocket = (logger?: MockLogger): MockWebSocket => {
  return new MockWebSocket(logger);
};

export const createMockSocket = (
  id?: string,
  userid?: string,
  logger?: MockLogger,
): MockSocket => {
  return new MockSocket(id, userid, logger);
};

// Mock socket collections for testing
export class MockSocketCollection {
  private sockets: Map<string, MockSocket> = new Map();
  private mockLogger?: MockLogger;

  constructor(logger?: MockLogger) {
    this.mockLogger = logger;
  }

  add(socket: MockSocket): void {
    this.sockets.set(socket.id, socket);

    if (this.mockLogger) {
      this.mockLogger.debug("MockSocketCollection.add", {
        socketId: socket.id,
      });
    }
  }

  remove(socketId: string): void {
    this.sockets.delete(socketId);

    if (this.mockLogger) {
      this.mockLogger.debug("MockSocketCollection.remove", { socketId });
    }
  }

  get(socketId: string): MockSocket | undefined {
    return this.sockets.get(socketId);
  }

  getByUserId(userid: string): MockSocket | undefined {
    for (const socket of this.sockets.values()) {
      if (socket.userid === userid) {
        return socket;
      }
    }
    return undefined;
  }

  getAll(): MockSocket[] {
    return Array.from(this.sockets.values());
  }

  getAllConnected(): MockSocket[] {
    return this.getAll().filter((socket) => socket.connected);
  }

  size(): number {
    return this.sockets.size;
  }

  connectedCount(): number {
    return this.getAllConnected().length;
  }

  disconnectAll(): void {
    this.sockets.forEach((socket) => socket.disconnect());

    if (this.mockLogger) {
      this.mockLogger.debug("MockSocketCollection.disconnectAll", {
        count: this.sockets.size,
      });
    }
  }

  reset(): void {
    this.sockets.forEach((socket) => socket.reset());
    this.sockets.clear();

    if (this.mockLogger) {
      this.mockLogger.debug("MockSocketCollection.reset");
    }
  }

  // Broadcasting utilities
  broadcastToAll(event: string, ...args: any[]): void {
    this.getAllConnected().forEach((socket) => {
      socket.emit(event, ...args);
    });
  }

  broadcastToAllExcept(excludeId: string, event: string, ...args: any[]): void {
    this.getAllConnected()
      .filter((socket) => socket.id !== excludeId)
      .forEach((socket) => {
        socket.emit(event, ...args);
      });
  }

  broadcastToUserIds(userIds: string[], event: string, ...args: any[]): void {
    userIds.forEach((userid) => {
      const socket = this.getByUserId(userid);
      if (socket && socket.connected) {
        socket.emit(event, ...args);
      }
    });
  }

  // Testing utilities
  waitForAllEvents(
    event: string,
    timeout: number = 5000,
  ): Promise<Map<string, any[]>> {
    const promises = this.getAllConnected().map((socket) =>
      socket
        .waitForEvent(event, timeout)
        .then((args) => [socket.id, args] as [string, any[]]),
    );

    return Promise.all(promises).then((results) => new Map(results));
  }

  expectAllToReceive(event: string, timeout: number = 1000): Promise<void> {
    const promises = this.getAllConnected().map((socket) =>
      socket.expectEvent(event, timeout),
    );

    return Promise.all(promises).then(() => {});
  }

  expectNoOneToReceive(event: string, delay: number = 100): Promise<void> {
    const promises = this.getAllConnected().map((socket) =>
      socket.expectNoEvent(event, delay),
    );

    return Promise.all(promises).then(() => {});
  }
}

// Mock socket factory with collection
export const createMockSocketCollection = (
  logger?: MockLogger,
): MockSocketCollection => {
  return new MockSocketCollection(logger);
};

// Utility functions for creating multiple sockets
export const createMockSockets = (
  count: number,
  prefix: string = "socket",
  logger?: MockLogger,
): MockSocket[] => {
  const sockets: MockSocket[] = [];
  for (let i = 0; i < count; i++) {
    sockets.push(
      createMockSocket(`${prefix}-${i}`, `${prefix}-user-${i}`, logger),
    );
  }
  return sockets;
};

export const createMockSocketCollectionWithSockets = (
  count: number,
  prefix: string = "socket",
  logger?: MockLogger,
): MockSocketCollection => {
  const collection = new MockSocketCollection(logger);
  const sockets = createMockSockets(count, prefix, logger);

  sockets.forEach((socket) => collection.add(socket));

  return collection;
};
