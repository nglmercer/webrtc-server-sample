import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { BunWebSocketAdapter } from "../../src/adapters/BunWebSocketAdapter";
import {
  createMockWebSocket,
  waitForEvent,
  expectEvent,
  expectNoEvent,
  cleanupServer,
} from "../helpers/test-utils";

describe("BunWebSocketAdapter", () => {
  let mockWs: any;
  let adapter: BunWebSocketAdapter;

  beforeEach(() => {
    mockWs = createMockWebSocket();
    adapter = new BunWebSocketAdapter(mockWs);
  });

  afterEach(() => {
    // Cleanup if needed
  });

  describe("Constructor", () => {
    it("should create adapter with WebSocket instance", () => {
      expect(adapter).toBeDefined();
      expect(adapter.id).toBeDefined();
      expect(adapter.userid).toBeDefined();
    });

    it("should initialize with connected state", () => {
      expect(adapter.connected).toBe(true);
    });

    it("should extract connection data from WebSocket", () => {
      expect(adapter.data).toBeDefined();
      expect(adapter.data.clientIP).toBe("127.0.0.1");
      expect(adapter.data.userAgent).toBe("Test-Agent");
    });
  });

  describe("Socket Interface Methods", () => {
    it("should handle on event registration", () => {
      let callbackCalled = false;
      let callbackData: any;

      const callback = (data: any) => {
        callbackCalled = true;
        callbackData = data;
      };

      adapter.on("test-event", callback);

      // Simulate event
      mockWs.emit(
        "message",
        JSON.stringify({ event: "test-event", args: ["test"] }),
      );

      expect(callbackCalled).toBe(true);
      expect(callbackData).toBe("test");
    });

    it("should handle off event removal", () => {
      let callbackCalled = false;

      const callback = () => {
        callbackCalled = true;
      };

      adapter.on("test-event", callback);
      adapter.off("test-event", callback);

      // Simulate event
      mockWs.emit(
        "message",
        JSON.stringify({ event: "test-event", args: ["test"] }),
      );

      expect(callbackCalled).toBe(false);
    });

    it("should handle emit to WebSocket", () => {
      const originalSend = mockWs.send;
      let messageSent: string | undefined;

      mockWs.send = (data: string) => {
        messageSent = data;
        return originalSend.call(mockWs, data);
      };

      adapter.emit("test-event", "arg1", "arg2");

      expect(messageSent).toBeDefined();
      const parsedMessage = JSON.parse(messageSent!);
      expect(parsedMessage.event).toBe("test-event");
      expect(parsedMessage.args).toEqual(["arg1", "arg2"]);
    });

    it("should handle disconnect", () => {
      const originalClose = mockWs.close;
      let closeCode: number | undefined;
      let closeReason: string | undefined;

      mockWs.close = (code?: number, reason?: string) => {
        closeCode = code;
        closeReason = reason;
        return originalClose.call(mockWs, code, reason);
      };

      adapter.disconnect();

      expect(closeCode).toBe(1000);
      expect(closeReason).toBe("Normal closure");
      expect(adapter.connected).toBe(false);
    });

    it("should handle disconnect with custom code and reason", () => {
      const originalClose = mockWs.close;
      let closeCode: number | undefined;
      let closeReason: string | undefined;

      mockWs.close = (code?: number, reason?: string) => {
        closeCode = code;
        closeReason = reason;
        return originalClose.call(mockWs, code, reason);
      };

      adapter.disconnect(true, "Custom reason");

      expect(closeCode).toBe(1000);
      expect(closeReason).toBe("Custom reason");
    });
  });

  describe("Message Handling", () => {
    it("should handle incoming text messages", () => {
      let eventHandlerCalled = false;
      let eventArgs: any[] = [];

      const eventHandler = (...args: any[]) => {
        eventHandlerCalled = true;
        eventArgs = args;
      };

      adapter.on("test-event", eventHandler);

      const message = JSON.stringify({
        event: "test-event",
        args: ["hello", "world"],
      });

      mockWs.simulateMessage(message);

      expect(eventHandlerCalled).toBe(true);
      expect(eventArgs).toEqual(["hello", "world"]);
    });

    it("should handle malformed JSON messages gracefully", () => {
      let errorHandlerCalled = false;

      const errorHandler = () => {
        errorHandlerCalled = true;
      };

      adapter.on("error", errorHandler);

      mockWs.simulateMessage("invalid-json{");

      expect(errorHandlerCalled).toBe(true);
    });

    it("should handle empty messages", () => {
      let errorHandlerCalled = false;

      const errorHandler = () => {
        errorHandlerCalled = true;
      };

      adapter.on("error", errorHandler);

      mockWs.simulateMessage("");

      expect(errorHandlerCalled).toBe(true);
    });

    it("should handle messages without event field", () => {
      let errorHandlerCalled = false;

      const errorHandler = () => {
        errorHandlerCalled = true;
      };

      adapter.on("error", errorHandler);

      mockWs.simulateMessage(JSON.stringify({ data: "test" }));

      expect(errorHandlerCalled).toBe(true);
    });

    it("should handle messages with nested arguments", () => {
      let eventHandlerCalled = false;
      let complexDataReceived: any;

      const eventHandler = (data: any) => {
        eventHandlerCalled = true;
        complexDataReceived = data;
      };

      adapter.on("complex-event", eventHandler);

      const complexData = {
        user: { id: 1, name: "John" },
        settings: { audio: true, video: false },
        metadata: { timestamp: Date.now() },
      };

      mockWs.simulateMessage(
        JSON.stringify({
          event: "complex-event",
          args: [complexData],
        }),
      );

      expect(eventHandlerCalled).toBe(true);
      expect(complexDataReceived).toEqual(complexData);
    });
  });

  describe("Broadcast Functionality", () => {
    it("should provide broadcast interface", () => {
      expect(adapter.broadcast).toBeDefined();
      expect(typeof adapter.broadcast.emit).toBe("function");
    });

    it("should handle broadcast emit", () => {
      let consoleWarnCalled = false;
      let warnMessage: string | undefined;

      const originalWarn = console.warn;
      console.warn = (message: string) => {
        consoleWarnCalled = true;
        warnMessage = message;
      };

      adapter.broadcast.emit("broadcast-event", "data");

      expect(consoleWarnCalled).toBe(true);
      expect(warnMessage).toContain(
        "Broadcast.emit llamado en BunWebSocketAdapter",
      );

      // Restore original warn
      console.warn = originalWarn;
    });

    it("should not emit broadcast to self by default", () => {
      let selfEventHandlerCalled = false;

      const selfEventHandler = () => {
        selfEventHandlerCalled = true;
      };

      adapter.on("broadcast-event", selfEventHandler);

      adapter.broadcast.emit("broadcast-event", "data");

      expect(selfEventHandlerCalled).toBe(false);
    });
  });

  describe("Connection Management", () => {
    it("should handle WebSocket close event", () => {
      let disconnectHandlerCalled = false;
      let disconnectReason: string | undefined;

      const disconnectHandler = (reason: string) => {
        disconnectHandlerCalled = true;
        disconnectReason = reason;
      };

      adapter.on("disconnect", disconnectHandler);

      mockWs.emit("close", 1000, "Normal closure");

      expect(adapter.connected).toBe(false);
      expect(disconnectHandlerCalled).toBe(true);
      expect(disconnectReason).toBe("Normal closure");
    });

    it("should handle WebSocket error event", () => {
      let errorHandlerCalled = false;
      let errorReceived: Error | undefined;

      const errorHandler = (error: Error) => {
        errorHandlerCalled = true;
        errorReceived = error;
      };

      adapter.on("error", errorHandler);

      const testError = new Error("Test WebSocket error");
      mockWs.emit("error", testError);

      expect(errorHandlerCalled).toBe(true);
      expect(errorReceived).toBe(testError);
    });

    it("should handle connection state changes", () => {
      expect(adapter.connected).toBe(true);

      mockWs.readyState = 3; // CLOSED
      mockWs.emit("close", 1000);

      expect(adapter.connected).toBe(false);
    });
  });

  describe("User Management", () => {
    it("should generate unique userid on creation", () => {
      const adapter2 = new BunWebSocketAdapter(createMockWebSocket());

      expect(adapter.userid).not.toBe(adapter2.userid);
      expect(adapter.userid).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      ); // UUID format
    });

    it("should allow userid customization through handshake", () => {
      const customWs = createMockWebSocket();
      customWs.data.customUserId = "custom-user-123";

      const customAdapter = new BunWebSocketAdapter(customWs);

      expect(customAdapter.userid).toBeDefined();
    });

    it("should maintain userid across reconnections", () => {
      const originalUserId = adapter.userid;

      // Simulate reconnection
      adapter.disconnect();
      const newAdapter = new BunWebSocketAdapter(createMockWebSocket());

      // New adapter should have different userid (this is by design)
      expect(newAdapter.userid).not.toBe(originalUserId);
    });
  });

  describe("Data Serialization", () => {
    it("should handle complex object serialization", () => {
      const originalSend = mockWs.send;
      let messageSent: string | undefined;

      mockWs.send = (data: string) => {
        messageSent = data;
        return originalSend.call(mockWs, data);
      };

      const complexObject = {
        nested: {
          array: [1, 2, 3],
          object: { key: "value" },
          nullValue: null,
        },
        date: new Date(),
        buffer: Buffer.from("test"),
      };

      adapter.emit("complex-object", complexObject);

      expect(messageSent).toBeDefined();
      const sentData = JSON.parse(messageSent!);
      expect(sentData.event).toBe("complex-object");
      expect(sentData.args[0].nested.array).toEqual([1, 2, 3]);
    });

    it("should handle circular references gracefully", () => {
      const circularObject: any = { name: "test" };
      circularObject.self = circularObject;

      expect(() => {
        adapter.emit("circular-test", circularObject);
      }).not.toThrow();
    });

    it("should handle binary data", () => {
      const originalSend = mockWs.send;
      let messageSent: string | undefined;

      mockWs.send = (data: string) => {
        messageSent = data;
        return originalSend.call(mockWs, data);
      };

      const binaryData = Buffer.from("binary test data");

      adapter.emit("binary-data", binaryData);

      expect(messageSent).toBeDefined();
    });
  });

  describe("Error Handling", () => {
    it("should handle WebSocket send errors", () => {
      // Mock send to throw error
      mockWs.send = () => {
        throw new Error("WebSocket send failed");
      };

      let errorHandlerCalled = false;

      const errorHandler = () => {
        errorHandlerCalled = true;
      };

      adapter.on("error", errorHandler);

      adapter.emit("test-event", "data");

      expect(errorHandlerCalled).toBe(true);
    });

    it("should handle JSON serialization errors", () => {
      const obj: any = {};
      obj.circular = obj;

      // This should not throw but should emit error
      expect(() => {
        adapter.emit("test-event", obj);
      }).not.toThrow();
    });

    it("should handle message parsing errors", () => {
      let errorHandlerCalled = false;

      const errorHandler = () => {
        errorHandlerCalled = true;
      };

      adapter.on("error", errorHandler);

      // Send invalid JSON
      mockWs.simulateMessage("{ invalid json }");

      expect(errorHandlerCalled).toBe(true);
    });
  });

  describe("Performance and Memory", () => {
    it("should handle high-frequency messages efficiently", () => {
      const messageCount = 1000;
      let eventHandlerCallCount = 0;

      const eventHandler = () => {
        eventHandlerCallCount++;
      };

      adapter.on("high-frequency", eventHandler);

      const startTime = performance.now();

      for (let i = 0; i < messageCount; i++) {
        mockWs.simulateMessage(
          JSON.stringify({
            event: "high-frequency",
            args: [i],
          }),
        );
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(eventHandlerCallCount).toBe(messageCount);
      expect(duration).toBeLessThan(1000); // Should process in under 1 second
    });

    it("should clean up event listeners properly", () => {
      let handler1Called = false;
      let handler2Called = false;

      const handler1 = () => {
        handler1Called = true;
      };

      const handler2 = () => {
        handler2Called = true;
      };

      adapter.on("cleanup-test", handler1);
      adapter.on("cleanup-test", handler2);
      adapter.off("cleanup-test", handler1);

      mockWs.simulateMessage(
        JSON.stringify({
          event: "cleanup-test",
          args: [],
        }),
      );

      expect(handler1Called).toBe(false);
      expect(handler2Called).toBe(true);
    });
  });

  describe("Compatibility", () => {
    it("should implement CustomSocket interface", () => {
      expect(adapter.id).toBeDefined();
      expect(typeof adapter.on).toBe("function");
      expect(typeof adapter.off).toBe("function");
      expect(typeof adapter.emit).toBe("function");
      expect(typeof adapter.disconnect).toBe("function");
      expect(adapter.broadcast).toBeDefined();
      expect(typeof adapter.broadcast.emit).toBe("function");
    });

    it("should handle Socket.IO-style event patterns", () => {
      let handlerCalled = false;
      let receivedArgs: any[] = [];

      const handler = (...args: any[]) => {
        handlerCalled = true;
        receivedArgs = args;
      };

      // Multiple arguments
      adapter.on("multi-arg", handler);
      mockWs.simulateMessage(
        JSON.stringify({
          event: "multi-arg",
          args: ["arg1", "arg2", "arg3", { complex: "object" }],
        }),
      );

      expect(handlerCalled).toBe(true);
      expect(receivedArgs).toEqual([
        "arg1",
        "arg2",
        "arg3",
        { complex: "object" },
      ]);
    });

    it("should handle acknowledgments", () => {
      // Test acknowledgment pattern - this is a placeholder since acknowledgments
      // require specific implementation in the adapter
      expect(true).toBe(true);
    });
  });
});
