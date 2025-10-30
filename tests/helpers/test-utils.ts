import { SignalingServer } from "../../src/signal_server";
import { BunWebSocketAdapter } from "../../src/adapters/BunWebSocketAdapter";
import type { CustomSocket, User, Room } from "../../src/types";
import { describe, it, expect, beforeEach, afterEach } from "bun:test";

// Mock implementations for testing
export class MockWebSocket {
  public readyState = 1; // OPEN
  public data: any = {};
  private eventListeners: Map<string, Function[]> = new Map();

  constructor() {
    this.data = {
      clientIP: "127.0.0.1",
      userAgent: "Test-Agent",
    };
  }

  send(data: string) {
    // Mock implementation
  }

  close(code?: number, reason?: string) {
    this.readyState = 3; // CLOSED
    this.emit("close", code, reason);
  }

  on(event: string, callback: Function) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  emit(event: string, ...args: any[]) {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach((callback) => callback(...args));
    }
  }

  // Simular mensaje entrante
  simulateMessage(data: string) {
    this.emit("message", data);
  }

  // Add ping method for completeness
  ping(data?: Buffer) {
    // Mock implementation
  }
}

export class MockSocket implements CustomSocket {
  public id: string;
  public userid: string;
  public handshake: { query: any };
  public connected = true;
  public admininfo?: any;
  public emittedEvents: Array<{ event: string; args: any[] }> = [];
  private eventHandlers: Map<string, Function[]> = new Map();

  constructor(id?: string, userid?: string) {
    this.id = id || `socket-${Math.random().toString(36).substr(2, 9)}`;
    this.userid = userid || `user-${Math.random().toString(36).substr(2, 9)}`;
    this.handshake = {
      query: {
        userid: this.userid,
        sessionid: `test-session-${Math.random().toString(36).substr(2, 9)}`,
      },
    };
  }

  on(event: string, callback: Function) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(callback);
    return this;
  }

  off(event: string, callback: Function) {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(callback);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
    return this;
  }

  emit(event: string, ...args: any[]) {
    this.emittedEvents.push({ event, args });

    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach((handler) => handler(...args));
    }
    return true;
  }

  disconnect(close?: boolean, reason?: string) {
    this.connected = false;
    this.emit("disconnect", reason || (close ? "server" : "client"));
    return this;
  }

  public broadcast = {
    emit: (event: string, ...args: any[]) => {
      // Mock broadcast
    },
  };

  // Métodos de ayuda para tests
  getLastEmittedEvent(event?: string) {
    if (event) {
      return this.emittedEvents.filter((e) => e.event === event).pop();
    }
    return this.emittedEvents.pop();
  }

  clearEmittedEvents() {
    this.emittedEvents = [];
  }

  simulateEvent(event: string, ...args: any[]) {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach((handler) => handler(...args));
    }
  }

  clearEventHandlers() {
    this.eventHandlers.clear();
  }
}

// Factory functions
export function createMockSocket(id?: string, userid?: string): MockSocket {
  return new MockSocket(id, userid);
}

export function createMockWebSocket(): MockWebSocket {
  return new MockWebSocket();
}

export function createSignalingServer(options?: any): SignalingServer {
  const defaultOptions = {
    maxParticipantsAllowed: 10,
    enableHeartbeat: false, // Deshabilitar heartbeat en tests
    ...options,
  };
  return new SignalingServer(defaultOptions);
}

export function createBunAdapter(ws?: MockWebSocket): BunWebSocketAdapter {
  const mockWs = ws || createMockWebSocket();
  const adapter = new BunWebSocketAdapter(mockWs as any);
  return adapter;
}

// Data factories
export function createTestRoom(overrides?: Partial<Room>): Room {
  const defaultRoom: Room = {
    maxParticipantsAllowed: 10,
    owner: "test-owner",
    participants: ["test-owner"],
    extra: {},
    socketMessageEvent: "RTCMultiConnection-Message",
    socketCustomEvent: "custom-event",
    identifier: "test-identifier",
    session: {
      audio: true,
      video: true,
      oneway: false,
      broadcast: false,
      scalable: false,
    },
    password: undefined,
    createdAt: new Date(),
    maxUsers: 10,
  };

  return { ...defaultRoom, ...overrides };
}

export function createTestUser(overrides?: Partial<User>): User {
  const defaultUser: User = {
    userid: `user-${Math.random().toString(36).substr(2, 9)}`,
    socket: createMockSocket(),
    connectedWith: {},
    extra: {},
    socketMessageEvent: "RTCMultiConnection-Message",
    socketCustomEvent: "custom-event",
    roomid: undefined,
    connectedAt: new Date(),
  };

  return { ...defaultUser, ...overrides };
}

// Async utilities
export function waitForEvent(
  socket: MockSocket,
  event: string,
  timeout = 1000,
): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`Timeout waiting for event: ${event}`));
    }, timeout);

    const handler = (...args: any[]) => {
      clearTimeout(timer);
      socket.off(event, handler);
      resolve(args);
    };

    socket.on(event, handler);
  });
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Test assertion helpers
export function expectEvent(
  socket: MockSocket,
  event: string,
  expectedArgs?: any[],
) {
  const emittedEvent = socket.getLastEmittedEvent(event);
  if (!emittedEvent) {
    throw new Error(`Expected event '${event}' was not emitted`);
  }

  if (expectedArgs) {
    expect(emittedEvent.args).toEqual(expectedArgs);
  }

  return emittedEvent;
}

export function expectNoEvent(socket: MockSocket, event: string) {
  const emittedEvents = socket.emittedEvents.filter((e) => e.event === event);
  if (emittedEvents.length > 0) {
    throw new Error(
      `Expected no '${event}' events, but ${emittedEvents.length} were emitted`,
    );
  }
}

export function expectRoomState(
  server: SignalingServer,
  roomId: string,
  expectedState: Partial<Room>,
) {
  const room = server.getRoom(roomId);
  if (!room) {
    throw new Error(`Room ${roomId} not found`);
  }

  Object.entries(expectedState).forEach(([key, value]) => {
    expect(room[key as keyof Room]).toEqual(value);
  });
}

// Cleanup utilities
export function cleanupServer(server: SignalingServer) {
  // Limpiar todas las salas y usuarios
  const rooms = server.getRooms();
  Object.values(rooms).forEach((room) => {
    if (room.roomid) server.closeRoom(room.roomid);
  });

  // Detener heartbeat si está habilitado
  if ((server as any).config?.heartbeat) {
    server.stopHeartbeat();
  }
}
