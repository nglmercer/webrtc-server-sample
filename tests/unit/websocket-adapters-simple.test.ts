import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";
import { BunWebSocketAdapter } from "../../src/adapters/BunWebSocketAdapter";
import { SocketIOLikeSocket, SocketIOLikeServer } from "../../src/adapters/SocketIOLikeAdapter";

// Simple mock WebSocket for testing
class MockWebSocket {
  public readyState = 1; // OPEN
  public sentMessages: string[] = [];
  public closed = false;
  private listeners: Map<string, Function[]> = new Map();

  send(data: string) {
    this.sentMessages.push(data);
  }

  close(code?: number, reason?: string) {
    this.readyState = 3; // CLOSED
    this.closed = true;
    this.emit("close", code, reason);
  }

  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  emit(event: string, ...args: any[]) {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.forEach(callback => callback(...args));
    }
  }

  simulateMessage(data: string) {
    this.emit("message", data);
  }
}

describe("BunWebSocketAdapter - Simple Tests", () => {
  let mockWs: MockWebSocket;
  let adapter: BunWebSocketAdapter;

  beforeEach(() => {
    mockWs = new MockWebSocket();
    adapter = new BunWebSocketAdapter(mockWs as any);
  });

  afterEach(() => {
    adapter.disconnect();
  });

  it("should create adapter with unique ID", () => {
    expect(adapter.id).toBeDefined();
    expect(typeof adapter.id).toBe("string");
  });

  it("should send messages via WebSocket", () => {
    const result = adapter.emit("test-event", "hello", "world");

    expect(result).toBe(true);
    expect(mockWs.sentMessages.length).toBe(1);

    const sentMessage = JSON.parse(mockWs.sentMessages[0]);
    expect(sentMessage.event).toBe("test-event");
    expect(sentMessage.args).toEqual(["hello", "world"]);
  });

  it("should receive and handle messages", () => {
    let receivedEvent = "";
    let receivedArgs: any[] = [];

    adapter.on("test-event", (...args: any[]) => {
      receivedEvent = "test-event";
      receivedArgs = args;
    });

    const message = JSON.stringify({
      event: "test-event",
      args: ["arg1", "arg2"]
    });

    mockWs.simulateMessage(message);

    expect(receivedEvent).toBe("test-event");
    expect(receivedArgs).toEqual(["arg1", "arg2"]);
  });

  it("should handle disconnect", () => {
    adapter.disconnect();

    expect(adapter.isAlive()).toBe(false);
    expect(mockWs.closed).toBe(true);
  });
});

describe("SocketIOLikeSocket - Simple Tests", () => {
  let mockWs: MockWebSocket;
  let mockServer: SocketIOLikeServer;
  let socket: SocketIOLikeSocket;

  beforeEach(() => {
    mockWs = new MockWebSocket();
    mockServer = new SocketIOLikeServer();
    const mockRequest = { url: "/?userid=test-user" };
    socket = new SocketIOLikeSocket(mockWs as any, mockRequest, mockServer);
  });

  afterEach(() => {
    socket.disconnect();
    mockServer.close();
  });

  it("should create socket with unique ID", () => {
    expect(socket.id).toBeDefined();
    expect(typeof socket.id).toBe("string");
  });

  it("should send messages via WebSocket", () => {
    const result = socket.emit("test-event", "hello", "world");

    expect(result).toBe(true);
    expect(mockWs.sentMessages.length).toBe(1);

    const sentMessage = JSON.parse(mockWs.sentMessages[0]);
    expect(sentMessage.event).toBe("test-event");
    expect(sentMessage.payload).toEqual(["hello", "world"]);
  });

  it("should receive and handle messages", () => {
    let receivedEvent = "";
    let receivedArgs: any[] = [];

    socket.on("test-event", (...args: any[]) => {
      receivedEvent = "test-event";
      receivedArgs = args;
    });

    const message = JSON.stringify({
      event: "test-event",
      payload: ["arg1", "arg2"]
    });

    mockWs.simulateMessage(message);

    expect(receivedEvent).toBe("test-event");
    expect(receivedArgs).toEqual(["arg1", "arg2"]);
  });

  it("should handle room management", () => {
    socket.join("room1");
    socket.join("room2");

    const rooms = socket.getRooms();
    expect(rooms).toContain("room1");
    expect(rooms).toContain("room2");

    socket.leave("room1");
    expect(socket.getRooms()).not.toContain("room1");
    expect(socket.getRooms()).toContain("room2");
  });
});

describe("SocketIOLikeServer - Simple Tests", () => {
  let server: SocketIOLikeServer;

  beforeEach(() => {
    server = new SocketIOLikeServer();
  });

  afterEach(() => {
    server.close();
  });

  it("should register and manage users", () => {
    const mockWs = new MockWebSocket();
    const mockRequest = { url: "/?userid=test-user" };
    const socket = new SocketIOLikeSocket(mockWs as any, mockRequest, server);

    expect(server.getStats().totalUsers).toBe(1);

    socket.disconnect();

    expect(server.getStats().totalUsers).toBe(0);
  });

  it("should handle room broadcasting", () => {
    const mockWs1 = new MockWebSocket();
    const mockWs2 = new MockWebSocket();
    const mockRequest = { url: "/?userid=test-user" };

    const socket1 = new SocketIOLikeSocket(mockWs1 as any, mockRequest, server);
    const socket2 = new SocketIOLikeSocket(mockWs2 as any, mockRequest, server);

    socket1.join("room1");
    socket2.join("room2");

    // Mock emit methods to track broadcasts
    const emit1 = mock(() => true);
    const emit2 = mock(() => true);
    socket1.emit = emit1;
    socket2.emit = emit2;

    server.broadcastToRoom("room1", "room-message", ["data"]);

    expect(emit1).toHaveBeenCalledWith("room-message", "data");
    expect(emit2).not.toHaveBeenCalled();
  });

  it("should provide server statistics", () => {
    const mockWs = new MockWebSocket();
    const mockRequest = { url: "/?userid=test-user" };
    const socket = new SocketIOLikeSocket(mockWs as any, mockRequest, server);

    socket.join("test-room");

    const stats = server.getStats();

    expect(stats.totalUsers).toBe(1);
    expect(stats.totalRooms).toBe(1);
    expect(stats.rooms["test-room"]).toBe(1);
  });
});

describe("WebSocket Adapters Integration", () => {
  it("should handle basic message exchange patterns", () => {
    // Test Bun adapter
    const mockWs1 = new MockWebSocket();
    const bunAdapter = new BunWebSocketAdapter(mockWs1 as any);

    // Test SocketIO adapter
    const mockWs2 = new MockWebSocket();
    const server = new SocketIOLikeServer();
    const socketioAdapter = new SocketIOLikeSocket(mockWs2 as any, { url: "/" }, server);

    // Both should handle basic operations
    expect(bunAdapter.emit("test", "data")).toBe(true);
    expect(socketioAdapter.emit("test", "data")).toBe(true);

    // Clean up
    bunAdapter.disconnect();
    socketioAdapter.disconnect();
    server.close();
  });

  it("should handle connection lifecycle", () => {
    const mockWs = new MockWebSocket();
    const adapter = new BunWebSocketAdapter(mockWs as any);

    expect(adapter.isAlive()).toBe(true);

    adapter.disconnect();

    expect(adapter.isAlive()).toBe(false);
    expect(mockWs.closed).toBe(true);
  });
});
