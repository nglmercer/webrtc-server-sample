import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";
import {
  SocketIOLikeSocket,
  SocketIOLikeServer,
  wsio,
} from "../../src/adapters/SocketIOLikeAdapter";
import { WebSocket } from "ws";
import { delay } from "../helpers/test-utils";

// Mock WebSocket implementation for testing
class MockWebSocket extends WebSocket {
  public readyState: 0 | 1 | 2 | 3 = WebSocket.OPEN as 0 | 1 | 2 | 3;
  private eventListeners: Map<string, Function[]> = new Map(); // Renombrado
  public sentMessages: string[] = [];
  public closed = false;
  public closeCode?: number;
  public closeReason?: string;

  constructor() {
    super("ws://localhost:8080");
  }

  send(data: string) {
    this.sentMessages.push(data);
  }

  close(code?: number, reason?: string) {
    this.readyState = WebSocket.CLOSED;
    this.closed = true;
    this.closeCode = code;
    this.closeReason = reason;
    this.emit("close", code, reason);
  }

  override on(event: string, callback: Function): this {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
    return this; // ⭐ IMPORTANTE: retorna this
  }

  // 6. emit() DEBE retornar boolean (no void)
  override emit(event: string, ...args: any[]): boolean {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach((callback) => callback(...args));
      return true; // ⭐ IMPORTANTE: retorna boolean
    }
    return false;
  }

  simulateMessage(data: string) {
    this.emit("message", data);
  }

  simulateClose(code?: number, reason?: string) {
    this.readyState = WebSocket.CLOSED;
    this.emit("close", code, reason);
  }

  simulateError(error: Error) {
    this.emit("error", error);
  }
}

// Mock request object
const createMockRequest = (url: string = "/") => ({
  url: `${url}?userid=test-user&sessionid=test-session`,
});

describe("SocketIOLikeSocket", () => {
  let mockWs: MockWebSocket;
  let mockServer: SocketIOLikeServer;
  let socket: SocketIOLikeSocket;

  beforeEach(() => {
    mockWs = new MockWebSocket();
    mockServer = new SocketIOLikeServer();
    const mockRequest = createMockRequest();
    socket = new SocketIOLikeSocket(mockWs as any, mockRequest, mockServer);
  });

  afterEach(() => {
    // Cleanup socket first
    if (socket && socket.isAlive()) {
      socket.disconnect();
    }

    // Clear server without waiting for callback
    // (no real WebSocket server is created in these tests)
    if (mockServer) {
      mockServer.close();
    }
  });

  describe("Constructor", () => {
    it("should create socket with unique ID", () => {
      expect(socket.id).toBeDefined();
      expect(typeof socket.id).toBe("string");
      expect(socket.id.length).toBeGreaterThan(0);
    });

    it("should extract query parameters from request", () => {
      expect(socket.handshake.query).toBeDefined();
      expect(socket.handshake.query.userid).toBe("test-user");
      expect(socket.handshake.query.sessionid).toBe("test-session");
    });

    it("should initialize with connected state", () => {
      expect(socket.isAlive()).toBe(true);
    });

    it("should register with server on creation", () => {
      const stats = mockServer.getStats();
      expect(stats.totalUsers).toBe(1);
      expect(stats.users[0].id).toBe(socket.id);
    });
  });

  describe("Event Handling", () => {
    it("should handle incoming messages", async () => {
      let receivedEvent = "";
      let receivedArgs: any[] = [];

      socket.on("test-event", (...args: any[]) => {
        receivedEvent = "test-event";
        receivedArgs = args;
      });

      const message = JSON.stringify({
        event: "test-event",
        payload: ["arg1", "arg2", { nested: "object" }],
      });

      mockWs.simulateMessage(message);
      await delay(10);

      expect(receivedEvent).toBe("test-event");
      expect(receivedArgs).toEqual(["arg1", "arg2", { nested: "object" }]);
    });

    it("should handle messages with callbacks", async () => {
      let callbackExecuted = false;
      //@ts-ignore
      socket.on("test-with-callback", (data: any, callback: Function) => {
        callbackExecuted = true;
        if (callback) {
          callback("response-data");
        }
      });

      const message = JSON.stringify({
        event: "test-with-callback",
        payload: ["test-data"],
        callbackId: "test-callback-123",
      });

      mockWs.simulateMessage(message);
      await delay(10);

      expect(callbackExecuted).toBe(true);
      expect(mockWs.sentMessages.length).toBeGreaterThan(0);

      const callbackResponse = JSON.parse(mockWs.sentMessages[0]);
      expect(callbackResponse.event).toBe("callback-response");
      expect(callbackResponse.callbackId).toBe("test-callback-123");
      expect(callbackResponse.payload).toEqual(["response-data"]);
    });

    it("should ignore callback-response events to prevent loops", async () => {
      let handlerCalled = false;

      socket.on("callback-response", () => {
        handlerCalled = true;
      });

      const message = JSON.stringify({
        event: "callback-response",
        callbackId: "test-callback",
        payload: ["test"],
      });

      mockWs.simulateMessage(message);
      await delay(10);

      expect(handlerCalled).toBe(false);
    });

    it("should handle malformed JSON messages gracefully", () => {
      expect(() => {
        mockWs.simulateMessage("invalid-json{");
      }).not.toThrow();
    });

    it("should handle messages without event field", () => {
      expect(() => {
        mockWs.simulateMessage(JSON.stringify({ data: "test" }));
      }).not.toThrow();
    });
  });

  describe("Message Sending", () => {
    it("should send messages to WebSocket", () => {
      const result = socket.emit("test-event", "arg1", "arg2");

      expect(result).toBe(true);
      expect(mockWs.sentMessages.length).toBe(1);

      const sentMessage = JSON.parse(mockWs.sentMessages[0]);
      expect(sentMessage.event).toBe("test-event");
      expect(sentMessage.payload).toEqual(["arg1", "arg2"]);
    });

    it("should not send messages when disconnected", () => {
      socket.disconnect();

      const result = socket.emit("test-event", "data");

      expect(result).toBe(false);
      expect(mockWs.sentMessages.length).toBe(0);
    });

    it("should handle WebSocket send errors gracefully", () => {
      const originalSend = mockWs.send;
      mockWs.send = () => {
        throw new Error("Send failed");
      };

      const result = socket.emit("test-event", "data");

      expect(result).toBe(false);
      expect(socket.isAlive()).toBe(false);

      mockWs.send = originalSend;
    });
  });

  describe("Room Management", () => {
    it("should join and leave rooms", () => {
      socket.join("room1");
      socket.join("room2");

      expect(socket.getRooms()).toContain("room1");
      expect(socket.getRooms()).toContain("room2");

      socket.leave("room1");
      expect(socket.getRooms()).not.toContain("room1");
      expect(socket.getRooms()).toContain("room2");
    });

    it("should emit to specific rooms", () => {
      socket.join("test-room");

      const mockBroadcast = mock(() => {});
      mockServer.broadcastToRoom = mockBroadcast;

      socket.to("test-room").emit("room-event", "data");

      expect(mockBroadcast).toHaveBeenCalledWith(
        "test-room",
        "room-event",
        ["data"],
        socket.id,
      );
    });
  });

  describe("Broadcast Functionality", () => {
    it("should broadcast to all users", () => {
      const mockBroadcast = mock(() => {});
      mockServer.broadcastToAll = mockBroadcast;

      socket.broadcast.emit("broadcast-event", "data");

      expect(mockBroadcast).toHaveBeenCalledWith(
        "broadcast-event",
        ["data"],
        socket.id,
      );
    });

    it("should broadcast to specific rooms", () => {
      const mockBroadcast = mock(() => {});
      mockServer.broadcastToRoom = mockBroadcast;

      socket.broadcast.to("room1").emit("room-event", "data");

      expect(mockBroadcast).toHaveBeenCalledWith(
        "room1",
        "room-event",
        ["data"],
        socket.id,
      );
    });
  });

  describe("Connection Management", () => {
    it("should handle WebSocket close events", async () => {
      let disconnectCalled = false;
      let disconnectData: any;

      socket.on("disconnect", (data: any) => {
        disconnectCalled = true;
        disconnectData = data;
      });

      mockWs.simulateClose(1000, "Normal closure");
      await delay(10);

      expect(disconnectCalled).toBe(true);
      expect(disconnectData).toEqual({
        code: 1000,
        reasonString: "Normal closure",
      });
      expect(socket.isAlive()).toBe(false);
      expect(mockServer.getStats().totalUsers).toBe(0);
    });

    it("should handle WebSocket error events", async () => {
      let disconnectCalled = false;

      socket.on("disconnect", () => {
        disconnectCalled = true;
      });

      mockWs.simulateError(new Error("Test error"));
      await delay(10);

      expect(disconnectCalled).toBe(true);
      expect(socket.isAlive()).toBe(false);
      expect(mockServer.getStats().totalUsers).toBe(0);
    });

    it("should handle manual disconnect", () => {
      socket.disconnect();

      expect(socket.isAlive()).toBe(false);
      expect(mockWs.closed).toBe(true);
      expect(mockWs.closeCode).toBe(1000);
      expect(mockWs.closeReason).toBe("Normal closure");
    });

    it("should handle ping/pong events", () => {
      let pongHandlerCalled = false;
      let pongData: Buffer | undefined;

      socket.on("pong", (data: Buffer) => {
        pongHandlerCalled = true;
        pongData = data;
      });

      const testData = Buffer.from("test");
      mockWs.emit("pong", testData);

      expect(pongHandlerCalled).toBe(true);
      expect(pongData).toBe(testData);
    });
  });

  describe("Connection Information", () => {
    it("should provide connection info", () => {
      const info = socket.getConnectionInfo();

      expect(info.id).toBe(socket.id);
      expect(info.isConnected).toBe(true);
      expect(info.readyState).toBe(WebSocket.OPEN);
      expect(info.lastActivity).toBeGreaterThan(0);
      expect(info.connectionDuration).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(info.rooms)).toBe(true);
    });

    it("should update last activity on message send", () => {
      const initialActivity = socket.getConnectionInfo().lastActivity;
      Bun.sleepSync(1);

      socket.emit("test-event", "data");
      const newActivity = socket.getConnectionInfo().lastActivity;

      expect(newActivity).toBeGreaterThan(initialActivity);
    });

    it("should update last activity on message receive", async () => {
      const initialActivity = socket.getConnectionInfo().lastActivity;
      Bun.sleepSync(1);

      const message = JSON.stringify({
        event: "test-event",
        payload: ["data"],
      });
      mockWs.simulateMessage(message);
      await delay(10);

      const newActivity = socket.getConnectionInfo().lastActivity;
      expect(newActivity).toBeGreaterThan(initialActivity);
    });
  });

  describe("Event Listener Management", () => {
    it("should handle on/off event listeners", () => {
      let handler1Called = false;
      let handler2Called = false;

      const handler1 = () => {
        handler1Called = true;
      };
      const handler2 = () => {
        handler2Called = true;
      };

      socket.on("test-event", handler1);
      socket.on("test-event", handler2);
      socket.off("test-event", handler1);

      mockWs.simulateMessage(
        JSON.stringify({
          event: "test-event",
          payload: [],
        }),
      );

      expect(handler1Called).toBe(false);
      expect(handler2Called).toBe(true);
    });

    it("should handle once event listeners", () => {
      let callCount = 0;

      const handler = () => {
        callCount++;
      };

      socket.once("test-event", handler);

      mockWs.simulateMessage(
        JSON.stringify({
          event: "test-event",
          payload: [],
        }),
      );
      mockWs.simulateMessage(
        JSON.stringify({
          event: "test-event",
          payload: [],
        }),
      );

      expect(callCount).toBe(1);
    });

    it("should remove all listeners for event", () => {
      let handler1Called = false;
      let handler2Called = false;

      const handler1 = () => {
        handler1Called = true;
      };
      const handler2 = () => {
        handler2Called = true;
      };

      socket.on("test-event", handler1);
      socket.on("test-event", handler2);
      socket.off("test-event");

      mockWs.simulateMessage(
        JSON.stringify({
          event: "test-event",
          payload: [],
        }),
      );

      expect(handler1Called).toBe(false);
      expect(handler2Called).toBe(false);
    });
  });

  describe("Compatibility", () => {
    it("should implement ISocket interface", () => {
      expect(socket.id).toBeDefined();
      expect(typeof socket.on).toBe("function");
      expect(typeof socket.off).toBe("function");
      expect(typeof socket.emit).toBe("function");
      expect(typeof socket.disconnect).toBe("function");
      expect(socket.broadcast).toBeDefined();
      expect(typeof socket.broadcast.emit).toBe("function");
      expect(typeof socket.broadcast.to).toBe("function");
    });

    it("should provide nsp property for compatibility", () => {
      expect(socket.nsp).toBeUndefined();
    });

    it("should provide conn.transport property", () => {
      expect(socket.conn).toBeDefined();
      expect(socket.conn.transport).toBeDefined();
      expect(socket.conn.transport.name).toBe("websocket");
    });
  });
});

describe("SocketIOLikeServer", () => {
  let server: SocketIOLikeServer;

  beforeEach(() => {
    server = new SocketIOLikeServer();
  });

  afterEach(() => {
    // Simple cleanup without waiting
    if (server) {
      server.close();
    }
  });

  describe("Server Management", () => {
    it("should have required server methods", () => {
      expect(typeof server.listen).toBe("function");
      expect(typeof server.attach).toBe("function");
      expect(typeof server.close).toBe("function");
      expect(typeof server.getStats).toBe("function");
    });

    it("should handle server close without active server", () => {
      expect(() => {
        server.close();
      }).not.toThrow();
    });

    it("should provide empty stats without active server", () => {
      const stats = server.getStats();
      expect(stats.totalUsers).toBe(0);
      expect(stats.totalRooms).toBe(0);
      expect(Array.isArray(stats.users)).toBe(true);
      expect(stats.users.length).toBe(0);
      expect(typeof stats.rooms).toBe("object");
      expect(Object.keys(stats.rooms).length).toBe(0);
    });
  });

  describe("User Management", () => {
    it("should register and unregister users", () => {
      const mockWs = new MockWebSocket();
      const mockRequest = createMockRequest();
      const socket = new SocketIOLikeSocket(mockWs as any, mockRequest, server);

      expect(server.getStats().totalUsers).toBe(1);

      socket.disconnect();
      expect(server.getStats().totalUsers).toBe(0);
    });

    it("should get user by ID", () => {
      const mockWs = new MockWebSocket();
      const mockRequest = createMockRequest();
      const socket = new SocketIOLikeSocket(mockWs as any, mockRequest, server);

      const user = server.getUser(socket.id);

      expect(user).toBeDefined();
      expect(user?.id).toBe(socket.id);

      socket.disconnect();
    });

    it("should handle multiple users", () => {
      const mockWs1 = new MockWebSocket();
      const mockWs2 = new MockWebSocket();
      const mockRequest = createMockRequest();

      const socket1 = new SocketIOLikeSocket(
        mockWs1 as any,
        mockRequest,
        server,
      );
      const socket2 = new SocketIOLikeSocket(
        mockWs2 as any,
        mockRequest,
        server,
      );

      expect(server.getStats().totalUsers).toBe(2);

      socket1.disconnect();
      expect(server.getStats().totalUsers).toBe(1);

      socket2.disconnect();
      expect(server.getStats().totalUsers).toBe(0);
    });
  });

  describe("Room Management", () => {
    it("should add users to rooms", () => {
      const mockWs = new MockWebSocket();
      const mockRequest = createMockRequest();
      const socket = new SocketIOLikeSocket(mockWs as any, mockRequest, server);

      socket.join("room1");
      socket.join("room2");

      const stats = server.getStats();
      expect(stats.totalRooms).toBe(2);
      expect(stats.rooms.room1).toBe(1);
      expect(stats.rooms.room2).toBe(1);
      expect(stats.users[0].rooms).toContain("room1");
      expect(stats.users[0].rooms).toContain("room2");

      socket.disconnect();
    });

    it("should remove users from rooms", () => {
      const mockWs = new MockWebSocket();
      const mockRequest = createMockRequest();
      const socket = new SocketIOLikeSocket(mockWs as any, mockRequest, server);

      socket.join("room1");
      socket.join("room2");
      socket.leave("room1");

      const stats = server.getStats();
      expect(stats.totalRooms).toBe(1);
      expect(stats.rooms.room1).toBeUndefined();
      expect(stats.rooms.room2).toBe(1);

      socket.disconnect();
    });

    it("should get users in room", () => {
      const mockWs1 = new MockWebSocket();
      const mockWs2 = new MockWebSocket();
      const mockRequest = createMockRequest();

      const socket1 = new SocketIOLikeSocket(
        mockWs1 as any,
        mockRequest,
        server,
      );
      const socket2 = new SocketIOLikeSocket(
        mockWs2 as any,
        mockRequest,
        server,
      );

      socket1.join("test-room");
      socket2.join("test-room");

      const usersInRoom = server.getUsersInRoom("test-room");
      expect(usersInRoom.length).toBe(2);
      expect(usersInRoom.map((u) => u.id)).toContain(socket1.id);
      expect(usersInRoom.map((u) => u.id)).toContain(socket2.id);

      socket1.disconnect();
      socket2.disconnect();
    });

    it("should clean up empty rooms", () => {
      const mockWs = new MockWebSocket();
      const mockRequest = createMockRequest();
      const socket = new SocketIOLikeSocket(mockWs as any, mockRequest, server);

      socket.join("test-room");
      expect(server.getStats().totalRooms).toBe(1);

      socket.leave("test-room");
      expect(server.getStats().totalRooms).toBe(0);

      socket.disconnect();
    });
  });

  describe("Broadcasting", () => {
    it("should broadcast to all users", () => {
      const mockWs1 = new MockWebSocket();
      const mockWs2 = new MockWebSocket();
      const mockRequest = createMockRequest();

      const socket1 = new SocketIOLikeSocket(
        mockWs1 as any,
        mockRequest,
        server,
      );
      const socket2 = new SocketIOLikeSocket(
        mockWs2 as any,
        mockRequest,
        server,
      );

      const emit1 = mock(() => true);
      const emit2 = mock(() => true);
      socket1.emit = emit1;
      socket2.emit = emit2;

      server.broadcastToAll("test-event", ["data"]);

      expect(emit1).toHaveBeenCalledWith("test-event", "data");
      expect(emit2).toHaveBeenCalledWith("test-event", "data");

      socket1.disconnect();
      socket2.disconnect();
    });

    it("should exclude sender when broadcasting", () => {
      const mockWs1 = new MockWebSocket();
      const mockWs2 = new MockWebSocket();
      const mockRequest = createMockRequest();

      const socket1 = new SocketIOLikeSocket(
        mockWs1 as any,
        mockRequest,
        server,
      );
      const socket2 = new SocketIOLikeSocket(
        mockWs2 as any,
        mockRequest,
        server,
      );

      const emit1 = mock(() => true);
      const emit2 = mock(() => true);
      socket1.emit = emit1;
      socket2.emit = emit2;

      server.broadcastToAll("test-event", ["data"], socket1.id);

      expect(emit1).not.toHaveBeenCalled();
      expect(emit2).toHaveBeenCalledWith("test-event", "data");

      socket1.disconnect();
      socket2.disconnect();
    });

    it("should broadcast to specific room", () => {
      const mockWs1 = new MockWebSocket();
      const mockWs2 = new MockWebSocket();
      const mockRequest = createMockRequest();

      const socket1 = new SocketIOLikeSocket(
        mockWs1 as any,
        mockRequest,
        server,
      );
      const socket2 = new SocketIOLikeSocket(
        mockWs2 as any,
        mockRequest,
        server,
      );

      socket1.join("room1");
      socket2.join("room2");

      const emit1 = mock(() => true);
      const emit2 = mock(() => true);
      socket1.emit = emit1;
      socket2.emit = emit2;

      server.broadcastToRoom("room1", "test-event", ["data"]);

      expect(emit1).toHaveBeenCalledWith("test-event", "data");
      expect(emit2).not.toHaveBeenCalled();

      socket1.disconnect();
      socket2.disconnect();
    });

    it("should exclude sender when broadcasting to room", () => {
      const mockWs1 = new MockWebSocket();
      const mockWs2 = new MockWebSocket();
      const mockRequest = createMockRequest();

      const socket1 = new SocketIOLikeSocket(
        mockWs1 as any,
        mockRequest,
        server,
      );
      const socket2 = new SocketIOLikeSocket(
        mockWs2 as any,
        mockRequest,
        server,
      );

      socket1.join("room1");
      socket2.join("room1");

      const emit1 = mock(() => true);
      const emit2 = mock(() => true);
      socket1.emit = emit1;
      socket2.emit = emit2;

      server.broadcastToRoom("room1", "test-event", ["data"], socket1.id);

      expect(emit1).not.toHaveBeenCalled();
      expect(emit2).toHaveBeenCalledWith("test-event", "data");

      socket1.disconnect();
      socket2.disconnect();
    });
  });

  describe("Event Handling", () => {
    it("should emit connection events", async () => {
      let connectionReceived = false;
      let receivedSocket: SocketIOLikeSocket | null = null;

      // Register connection listener first using the custom emitter
      server.on("connection", (socket: SocketIOLikeSocket) => {
        connectionReceived = true;
        receivedSocket = socket;
      });

      const mockWs = new MockWebSocket();
      const mockRequest = createMockRequest();

      // Simulate the connection event that would be emitted by WebSocketServer
      // This mimics what happens in setupWebSocketServer when a real connection occurs
      const socket = new SocketIOLikeSocket(mockWs as any, mockRequest, server);

      // Manually trigger the connection event on the server's custom emitter
      // This simulates what happens when a real WebSocket connection is established
      (server as any).emitter.emit("connection", socket);

      // Small delay to allow event processing
      await delay(10);

      expect(connectionReceived).toBe(true);
      expect(receivedSocket).toBeDefined();
      if (!receivedSocket) return;
      expect((receivedSocket as SocketIOLikeSocket)?.id).toBe(socket.id);

      socket.disconnect();
    });

    it("should handle server emit", () => {
      const mockWs1 = new MockWebSocket();
      const mockWs2 = new MockWebSocket();
      const mockRequest = createMockRequest();

      const socket1 = new SocketIOLikeSocket(
        mockWs1 as any,
        mockRequest,
        server,
      );
      const socket2 = new SocketIOLikeSocket(
        mockWs2 as any,
        mockRequest,
        server,
      );

      const emit1 = mock(() => true);
      const emit2 = mock(() => true);
      socket1.emit = emit1;
      socket2.emit = emit2;

      server.emit("server-event", "data");

      expect(emit1).toHaveBeenCalledWith("server-event", "data");
      expect(emit2).toHaveBeenCalledWith("server-event", "data");

      socket1.disconnect();
      socket2.disconnect();
    });
  });

  describe("Statistics", () => {
    it("should provide server statistics", () => {
      const mockWs1 = new MockWebSocket();
      const mockWs2 = new MockWebSocket();
      const mockRequest = createMockRequest();

      const socket1 = new SocketIOLikeSocket(
        mockWs1 as any,
        mockRequest,
        server,
      );
      const socket2 = new SocketIOLikeSocket(
        mockWs2 as any,
        mockRequest,
        server,
      );

      socket1.join("room1");
      socket2.join("room2");

      const stats = server.getStats();

      expect(stats.totalUsers).toBe(2);
      expect(stats.totalRooms).toBe(2);
      expect(stats.users.length).toBe(2);
      expect(stats.rooms.room1).toBe(1);
      expect(stats.rooms.room2).toBe(1);

      socket1.disconnect();
      socket2.disconnect();
    });
  });
});

describe("Global wsio instance", () => {
  it("should export global wsio instance", () => {
    expect(wsio).toBeDefined();
    expect(wsio).toBeInstanceOf(SocketIOLikeServer);
  });

  it("should have working methods on global instance", () => {
    expect(typeof wsio.listen).toBe("function");
    expect(typeof wsio.attach).toBe("function");
    expect(typeof wsio.close).toBe("function");
    expect(typeof wsio.getStats).toBe("function");
  });
});
