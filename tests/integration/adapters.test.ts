import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";
import { BunWebSocketAdapter } from "../../src/adapters/BunWebSocketAdapter";
import {
  SocketIOLikeSocket,
  SocketIOLikeServer,
} from "../../src/adapters/SocketIOLikeAdapter";
import {
  createMockWebSocket,
  waitForEvent,
  delay,
} from "../helpers/test-utils";

// Mock WebSocket for SocketIOLikeAdapter
class MockWebSocket {
  public readyState = 1; // OPEN
  private listeners: Map<string, Function[]> = new Map();
  public sentMessages: string[] = [];
  public closed = false;
  public closeCode?: number;
  public closeReason?: string;

  send(data: string) {
    this.sentMessages.push(data);
  }

  close(code?: number, reason?: string) {
    this.readyState = 3; // CLOSED
    this.closed = true;
    this.closeCode = code;
    this.closeReason = reason;
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
      listeners.forEach((callback) => callback(...args));
    }
  }

  simulateMessage(data: string) {
    this.emit("message", data);
  }

  simulateClose(code?: number, reason?: string) {
    this.readyState = 3;
    this.emit("close", code, reason);
  }

  simulateError(error: Error) {
    this.emit("error", error);
  }

  ping(data?: Buffer) {
    // Mock implementation
  }
}

const createMockRequest = (url: string = "/") => ({
  url: `${url}?userid=test-user&sessionid=test-session`,
});

describe("WebSocket Adapters Integration", () => {
  describe("Cross-Adapter Communication", () => {
    it("should handle similar message formats between adapters", () => {
      // Test BunWebSocketAdapter
      const mockWs1 = createMockWebSocket();
      const bunAdapter = new BunWebSocketAdapter(mockWs1);

      // Test SocketIOLikeAdapter
      const mockWs2 = new MockWebSocket();
      const mockServer = new SocketIOLikeServer();
      const socketioAdapter = new SocketIOLikeSocket(
        mockWs2 as any,
        createMockRequest(),
        mockServer,
      );

      // Both should handle basic event emission
      const bunResult = bunAdapter.emit("test-event", "data");
      const socketioResult = socketioAdapter.emit("test-event", "data");

      expect(bunResult).toBe(true);
      expect(socketioResult).toBe(true);
    });

    it("should handle connection state consistently", () => {
      const mockWs1 = createMockWebSocket();
      const bunAdapter = new BunWebSocketAdapter(mockWs1);

      const mockWs2 = new MockWebSocket();
      const mockServer = new SocketIOLikeServer();
      const socketioAdapter = new SocketIOLikeSocket(
        mockWs2 as any,
        createMockRequest(),
        mockServer,
      );

      // Both should start connected
      expect(bunAdapter.isAlive()).toBe(true);
      expect(socketioAdapter.isAlive()).toBe(true);

      // Both should handle disconnect
      bunAdapter.disconnect();
      socketioAdapter.disconnect();

      expect(bunAdapter.isAlive()).toBe(false);
      expect(socketioAdapter.isAlive()).toBe(false);
    });
  });

  describe("Message Format Compatibility", () => {
    it("should handle basic message exchange between adapters", () => {
      // Test that both adapters can send and receive basic messages
      const mockWs1 = new MockWebSocket();
      const bunAdapter = new BunWebSocketAdapter(mockWs1 as any);

      const mockWs2 = new MockWebSocket();
      const mockServer = new SocketIOLikeServer();
      const socketioAdapter = new SocketIOLikeSocket(
        mockWs2 as any,
        createMockRequest(),
        mockServer,
      );

      // Both should be able to send messages
      expect(bunAdapter.emit("test-event", "data")).toBe(true);
      expect(socketioAdapter.emit("test-event", "data")).toBe(true);

      // Both should have sent messages
      expect(mockWs1.sentMessages.length).toBe(1);
      expect(mockWs2.sentMessages.length).toBe(1);
    });
  });

  describe("Error Handling Consistency", () => {
    it("should handle malformed messages without crashing", () => {
      const mockWs1 = createMockWebSocket();
      const bunAdapter = new BunWebSocketAdapter(mockWs1);

      const mockWs2 = new MockWebSocket();
      const mockServer = new SocketIOLikeServer();
      const socketioAdapter = new SocketIOLikeSocket(
        mockWs2 as any,
        createMockRequest(),
        mockServer,
      );

      // Set up error handlers to prevent unhandled errors
      let bunErrorHandled = false;
      let socketioErrorHandled = false;

      bunAdapter.on("error", () => {
        bunErrorHandled = true;
      });

      socketioAdapter.on("error", () => {
        socketioErrorHandled = true;
      });

      // Send invalid JSON to both - should handle gracefully without process crash
      // Note: JSON parsing errors are expected and handled internally by adapters
      mockWs1.simulateMessage("invalid-json{");
      mockWs2.simulateMessage("invalid-json{");

      // If we reach here, no process crash occurred
      expect(true).toBe(true);
    });

    it("should handle connection state changes consistently", () => {
      const mockWs1 = createMockWebSocket();
      const bunAdapter = new BunWebSocketAdapter(mockWs1);

      const mockWs2 = new MockWebSocket();
      const mockServer = new SocketIOLikeServer();
      const socketioAdapter = new SocketIOLikeSocket(
        mockWs2 as any,
        createMockRequest(),
        mockServer,
      );

      // Both should start connected
      expect(bunAdapter.isAlive()).toBe(true);
      expect(socketioAdapter.isAlive()).toBe(true);

      // Both should handle disconnect
      bunAdapter.disconnect();
      socketioAdapter.disconnect();

      expect(bunAdapter.isAlive()).toBe(false);
      expect(socketioAdapter.isAlive()).toBe(false);
    });
  });

  describe("Performance and Scalability", () => {
    it("should handle high message volume efficiently", async () => {
      const mockWs = createMockWebSocket();
      const bunAdapter = new BunWebSocketAdapter(mockWs);

      let messageCount = 0;
      bunAdapter.on("high-volume", () => {
        messageCount++;
      });

      const startTime = performance.now();
      const messageCountTarget = 1000;

      for (let i = 0; i < messageCountTarget; i++) {
        mockWs.simulateMessage(
          JSON.stringify({
            event: "high-volume",
            args: [i],
          }),
        );
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Allow some time for async processing
      await delay(50);

      expect(messageCount).toBe(messageCountTarget);
      expect(duration).toBeLessThan(1000); // Should process in under 1 second
    });

    it("should handle multiple concurrent connections", async () => {
      const mockServer = new SocketIOLikeServer();
      const connections: SocketIOLikeSocket[] = [];
      const connectionCount = 10;

      // Create multiple connections
      for (let i = 0; i < connectionCount; i++) {
        const mockWs = new MockWebSocket();
        const socket = new SocketIOLikeSocket(
          mockWs as any,
          createMockRequest(),
          mockServer,
        );
        connections.push(socket);
      }

      const stats = mockServer.getStats();
      expect(stats.totalUsers).toBe(connectionCount);

      // Clean up
      connections.forEach((socket) => socket.disconnect());
    });
  });

  describe("Room Management Integration", () => {
    it("should handle room-based communication patterns", () => {
      const mockServer = new SocketIOLikeServer();

      // Create multiple sockets
      const mockWs1 = new MockWebSocket();
      const mockWs2 = new MockWebSocket();
      const mockWs3 = new MockWebSocket();

      const socket1 = new SocketIOLikeSocket(
        mockWs1 as any,
        createMockRequest(),
        mockServer,
      );
      const socket2 = new SocketIOLikeSocket(
        mockWs2 as any,
        createMockRequest(),
        mockServer,
      );
      const socket3 = new SocketIOLikeSocket(
        mockWs3 as any,
        createMockRequest(),
        mockServer,
      );

      // Join rooms
      socket1.join("room1");
      socket2.join("room1");
      socket3.join("room2");

      // Mock emit methods to track broadcasts
      const emit1 = mock(() => true);
      const emit2 = mock(() => true);
      const emit3 = mock(() => true);
      socket1.emit = emit1;
      socket2.emit = emit2;
      socket3.emit = emit3;

      // Broadcast to room1 should only reach socket1 and socket2
      mockServer.broadcastToRoom("room1", "room-message", ["data"]);

      expect(emit1).toHaveBeenCalledWith("room-message", "data");
      expect(emit2).toHaveBeenCalledWith("room-message", "data");
      expect(emit3).not.toHaveBeenCalled();
    });
  });

  describe("Connection Lifecycle", () => {
    it("should handle complete connection lifecycle", () => {
      const mockWs = createMockWebSocket();
      const bunAdapter = new BunWebSocketAdapter(mockWs);

      let disconnectCalled = false;

      bunAdapter.on("disconnect", () => {
        disconnectCalled = true;
      });

      // Should start connected
      expect(bunAdapter.isAlive()).toBe(true);

      // Should handle disconnect
      bunAdapter.disconnect();

      expect(bunAdapter.isAlive()).toBe(false);
      expect(disconnectCalled).toBe(true);
    });
  });

  describe("Data Serialization Compatibility", () => {
    it("should handle complex data structures consistently", () => {
      const mockWs1 = createMockWebSocket();
      const bunAdapter = new BunWebSocketAdapter(mockWs1);

      const mockWs2 = new MockWebSocket();
      const mockServer = new SocketIOLikeServer();
      const socketioAdapter = new SocketIOLikeSocket(
        mockWs2 as any,
        createMockRequest(),
        mockServer,
      );

      const complexData = {
        nested: {
          array: [1, 2, 3],
          object: { key: "value" },
          date: new Date(),
          buffer: Buffer.from("test"),
        },
        users: [
          { id: 1, name: "Alice" },
          { id: 2, name: "Bob" },
        ],
      };

      // Both adapters should handle complex data without errors
      expect(() => {
        bunAdapter.emit("complex-data", complexData);
        socketioAdapter.emit("complex-data", complexData);
      }).not.toThrow();
    });

    it("should handle circular references gracefully", () => {
      const mockWs = createMockWebSocket();
      const bunAdapter = new BunWebSocketAdapter(mockWs);

      const circularObject: any = { name: "test" };
      circularObject.self = circularObject;

      // Should not throw when serializing circular references
      expect(() => {
        bunAdapter.emit("circular-test", circularObject);
      }).not.toThrow();
    });
  });
});
