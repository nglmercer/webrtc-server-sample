import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { SignalingServer } from "../../src/signal_server";
import {
  createMockSocket,
  createTestRoom,
  waitForEvent,
  expectEvent,
  expectNoEvent,
  cleanupServer,
} from "../helpers/test-utils";

describe("User Handlers", () => {
  let server: SignalingServer;
  let userSocket: any;
  let targetSocket: any;

  beforeEach(() => {
    server = new SignalingServer({
      maxParticipantsAllowed: 3,
      enableHeartbeat: false,
    });

    userSocket = createMockSocket("user-socket", "user1");
    targetSocket = createMockSocket("target-socket", "user2");

    server.handleConnection(userSocket);
    server.handleConnection(targetSocket);
  });

  afterEach(() => {
    cleanupServer(server);
  });

  describe("extra-data-updated", () => {
    it("should update user extra data successfully", async () => {
      const newExtraData = {
        avatar: "👨‍💻",
        nickname: "John Doe",
        status: "online",
      };

      const eventPromise = waitForEvent(userSocket, "extra-data-updated", 500);
      userSocket.simulateEvent("extra-data-updated", newExtraData);
      await eventPromise;

      const user = server.getUser("user1");
      expect(user!.extra).toEqual(newExtraData);
    });

    it("should broadcast extra data update to room participants", async () => {
      const roomData = {
        sessionid: "test-room",
        session: { audio: true, video: true },
      };

      const openEventPromise = waitForEvent(userSocket, "room-opened", 500);
      userSocket.simulateEvent("open-room", roomData);
      await openEventPromise;

      const joinEventPromise = waitForEvent(targetSocket, "room-joined", 500);
      targetSocket.simulateEvent("join-room", { sessionid: "test-room" });
      await joinEventPromise;

      const newExtraData = { avatar: "🎯" };
      const extraDataEventPromise = waitForEvent(
        targetSocket,
        "user-extra-data-updated",
        500,
      );
      userSocket.simulateEvent("extra-data-updated", newExtraData);
      await extraDataEventPromise;

      const lastEvent = targetSocket.getLastEmittedEvent(
        "user-extra-data-updated",
      );
      expect(lastEvent.args[0]).toBe("user1");
      expect(lastEvent.args[1]).toEqual(newExtraData);
    });

    it("should handle empty extra data", async () => {
      const eventPromise = waitForEvent(userSocket, "extra-data-updated", 500);
      userSocket.simulateEvent("extra-data-updated", {});
      await eventPromise;

      const user = server.getUser("user1");
      expect(user!.extra).toEqual({});
    });

    it("should handle null extra data", async () => {
      const eventPromise = waitForEvent(userSocket, "extra-data-updated", 500);
      userSocket.simulateEvent("extra-data-updated", null);
      await eventPromise;

      const user = server.getUser("user1");
      expect(user!.extra).toEqual({});
    });
  });

  describe("get-remote-user-extra-data", () => {
    it("should return extra data for existing user", async () => {
      const targetExtraData = { avatar: "👩‍💻", role: "admin" };
      const targetUser = server.getUser("user2");
      targetUser!.extra = targetExtraData;

      const eventPromise = waitForEvent(
        userSocket,
        "remote-user-extra-data-response",
        500,
      );
      userSocket.simulateEvent("get-remote-user-extra-data", "user2");

      await eventPromise;

      const lastEvent = userSocket.getLastEmittedEvent(
        "remote-user-extra-data-response",
      );
      expect(lastEvent.args[0]).toEqual(targetExtraData);
    });

    it("should handle non-existent user", async () => {
      const eventPromise = waitForEvent(
        userSocket,
        "remote-user-extra-data-response",
        500,
      );
      userSocket.simulateEvent(
        "get-remote-user-extra-data",
        "non-existent-user",
      );

      await eventPromise;

      const lastEvent = userSocket.getLastEmittedEvent(
        "remote-user-extra-data-response",
      );
      expect(lastEvent.args[0]).toBeNull();
      expect(lastEvent.args[1]).toBeDefined();
    });

    it("should return empty extra data when user has none", async () => {
      const eventPromise = waitForEvent(
        userSocket,
        "remote-user-extra-data-response",
        500,
      );
      userSocket.simulateEvent("get-remote-user-extra-data", "user2");

      await eventPromise;

      const lastEvent = userSocket.getLastEmittedEvent(
        "remote-user-extra-data-response",
      );
      expect(lastEvent.args[0]).toEqual({});
    });
  });

  describe("changed-uuid", () => {
    it("should change user ID successfully", async () => {
      const eventPromise = waitForEvent(userSocket, "uuid-changed", 500);
      userSocket.simulateEvent("changed-uuid", "new-user-id");
      await eventPromise;

      expect(server.userExists("new-user-id")).toBeTrue();
      expect(server.userExists("user1")).toBeFalse();
      expectEvent(userSocket, "uuid-changed");
    });

    it("should reject duplicate user ID", async () => {
      const eventPromise = waitForEvent(userSocket, "uuid-change-error", 500);
      userSocket.simulateEvent("changed-uuid", "user2"); // user2 already exists
      await eventPromise;

      expect(server.userExists("user1")).toBeTrue();
      expect(server.userExists("user2")).toBeTrue();
      expect(userSocket.userid).toBe("user1");
      expectEvent(userSocket, "uuid-change-error");
    });

    it("should reject empty user ID", async () => {
      const eventPromise = waitForEvent(userSocket, "uuid-change-error", 500);
      userSocket.simulateEvent("changed-uuid", "", () => {});
      await eventPromise;

      expect(server.userExists("user1")).toBeTrue();
      expect(userSocket.userid).toBe("user1");
      expectEvent(userSocket, "uuid-change-error");
    });

    it("should handle UUID change when user is in room", async () => {
      const ownerSocket = createMockSocket("owner-socket", "owner");
      server.handleConnection(ownerSocket);

      const roomData = {
        sessionid: "test-room",
        session: { audio: true, video: true },
      };

      const openEventPromise = waitForEvent(ownerSocket, "room-opened", 500);
      ownerSocket.simulateEvent("open-room", roomData);
      await openEventPromise;

      // User joins the room first
      const joinEventPromise = waitForEvent(userSocket, "room-joined", 500);
      userSocket.simulateEvent("join-room", { sessionid: "test-room" });
      await joinEventPromise;

      const eventPromise = waitForEvent(userSocket, "uuid-changed", 500);
      userSocket.simulateEvent("changed-uuid", "new-user-id");
      await eventPromise;

      const room = server.getRoom("test-room");
      expect(room!.participants).toContain("new-user-id");
      expect(room!.participants).not.toContain("user1");
    });

    it("should handle UUID change when user is participant", async () => {
      const roomData = {
        sessionid: "test-room",
        session: { audio: true, video: true },
      };

      const openEventPromise = waitForEvent(targetSocket, "room-opened", 500);
      targetSocket.simulateEvent("open-room", roomData);
      await openEventPromise;

      const joinEventPromise = waitForEvent(userSocket, "room-joined", 500);
      userSocket.simulateEvent("join-room", { sessionid: "test-room" });
      await joinEventPromise;

      const uuidEventPromise = waitForEvent(userSocket, "uuid-changed", 500);
      userSocket.simulateEvent("changed-uuid", "new-participant-id");
      await uuidEventPromise;

      const room = server.getRoom("test-room");
      expect(room!.participants).toContain("new-participant-id");
      expect(room!.participants).not.toContain("user1");
    });
  });

  describe("disconnect-with", () => {
    beforeEach(async () => {
      const roomData = {
        sessionid: "test-room",
        session: { audio: true, video: true },
      };

      const openEventPromise = waitForEvent(targetSocket, "room-opened", 500);
      targetSocket.simulateEvent("open-room", roomData);
      await openEventPromise;

      const joinEventPromise = waitForEvent(userSocket, "room-joined", 500);
      userSocket.simulateEvent("join-room", { sessionid: "test-room" });
      await joinEventPromise;
    });

    it("should disconnect from specific user", async () => {
      // Simulate connection establishment
      const user1 = server.getUser("user1");
      const user2 = server.getUser("user2");
      user1!.connectedWith["user2"] = user2!.socket;
      user2!.connectedWith["user1"] = user1!.socket;

      const eventPromise = waitForEvent(userSocket, "disconnected-with", 500);
      userSocket.simulateEvent("disconnect-with", "user2");
      await eventPromise;

      expect(user1!.connectedWith["user2"]).toBeUndefined();
      expect(user2!.connectedWith["user1"]).toBeUndefined();
      expectEvent(userSocket, "disconnected-with");
    });

    it("should handle disconnect from non-existent user", async () => {
      const eventPromise = waitForEvent(userSocket, "disconnect-error", 500);
      userSocket.simulateEvent("disconnect-with", "non-existent-user");
      await eventPromise;

      expectEvent(userSocket, "disconnect-error");
    });

    it("should handle disconnect from user not connected with", async () => {
      const eventPromise = waitForEvent(userSocket, "disconnect-error", 500);
      userSocket.simulateEvent("disconnect-with", "user2");
      await eventPromise;

      expectEvent(userSocket, "disconnect-error");
    });

    it("should notify other user about disconnection", async () => {
      // Simulate connection establishment
      const user1 = server.getUser("user1");
      const user2 = server.getUser("user2");
      user1!.connectedWith["user2"] = user2!.socket;
      user2!.connectedWith["user1"] = user1!.socket;

      const eventPromise = waitForEvent(targetSocket, "user-disconnected", 500);
      userSocket.simulateEvent("disconnect-with", "user2");
      await eventPromise;

      expectEvent(targetSocket, "user-disconnected");
      const lastEvent = targetSocket.getLastEmittedEvent("user-disconnected");
      expect(lastEvent.args[0]).toBe("user1");
    });
  });

  describe("set-custom-socket-event-listener", () => {
    it("should register custom event listener", async () => {
      const eventName = "custom-game-event";

      const eventPromise = waitForEvent(
        userSocket,
        "custom-event-listener-set",
        500,
      );
      userSocket.simulateEvent("set-custom-socket-event-listener", eventName);
      await eventPromise;

      expectEvent(userSocket, "custom-event-listener-set");
      const lastEvent = userSocket.getLastEmittedEvent(
        "custom-event-listener-set",
      );
      expect(lastEvent.args[0]).toBe(eventName);
    });

    it("should handle empty event name", async () => {
      const eventPromise = waitForEvent(
        userSocket,
        "custom-event-listener-error",
        500,
      );
      userSocket.simulateEvent("set-custom-socket-event-listener", "");
      await eventPromise;

      expectEvent(userSocket, "custom-event-listener-error");
    });

    it("should broadcast custom event to room participants", async () => {
      const roomData = {
        sessionid: "test-room",
        session: { audio: true, video: true },
      };

      const openEventPromise = waitForEvent(userSocket, "room-opened", 500);
      userSocket.simulateEvent("open-room", roomData);
      await openEventPromise;

      const joinEventPromise = waitForEvent(targetSocket, "room-joined", 500);
      targetSocket.simulateEvent("join-room", { sessionid: "test-room" });
      await joinEventPromise;

      const customEventName = "custom-game-event";
      const setEventPromise = waitForEvent(
        userSocket,
        "custom-event-listener-set",
        500,
      );
      userSocket.simulateEvent(
        "set-custom-socket-event-listener",
        customEventName,
      );
      await setEventPromise;

      // Simulate custom event
      const customEventPromise = waitForEvent(
        targetSocket,
        customEventName,
        500,
      );
      userSocket.simulateEvent(customEventName, {
        game: "start",
        players: 2,
      });
      await customEventPromise;

      const lastEvent = targetSocket.getLastEmittedEvent(customEventName);
      expect(lastEvent.args[0]).toEqual({
        game: "start",
        players: 2,
      });
      expect(lastEvent.args[1]).toBe("user1");
    });

    it("should not broadcast custom event to sender", async () => {
      const roomData = {
        sessionid: "test-room",
        session: { audio: true, video: true },
      };

      const openEventPromise = waitForEvent(userSocket, "room-opened", 500);
      userSocket.simulateEvent("open-room", roomData);
      await openEventPromise;

      const customEventName = "custom-game-event";
      const setEventPromise = waitForEvent(
        userSocket,
        "custom-event-listener-set",
        500,
      );
      userSocket.simulateEvent(
        "set-custom-socket-event-listener",
        customEventName,
      );
      await setEventPromise;

      // Simulate custom event - should not broadcast to self
      userSocket.simulateEvent(customEventName, { test: "data" });

      // Give a small delay to ensure no self-broadcast happens
      await new Promise((resolve) => setTimeout(resolve, 50));

      const lastEvent = userSocket.getLastEmittedEvent(customEventName);
      expect(lastEvent).toBeUndefined();
      expectNoEvent(userSocket, customEventName);
    });
  });

  describe("User Connection Lifecycle", () => {
    it("should handle user connection with custom userid", () => {
      const customSocket = createMockSocket("custom-socket", "custom-user-id");
      server.handleConnection(customSocket);

      expect(server.userExists("custom-user-id")).toBeTrue();
      expect(customSocket.userid).toBe("custom-user-id");
    });

    it("should auto-generate userid if not provided", () => {
      const socketWithoutId = createMockSocket("no-id-socket", "");
      socketWithoutId.handshake.query.userid = undefined;

      server.handleConnection(socketWithoutId);

      expect(socketWithoutId.userid).toBeDefined();
      expect(socketWithoutId.userid).not.toBe("");
      expect(server.userExists(socketWithoutId.userid)).toBeTrue();
    });

    it("should handle user disconnection gracefully", async () => {
      const roomData = {
        sessionid: "test-room",
        session: { audio: true, video: true },
      };

      const openEventPromise = waitForEvent(userSocket, "room-opened", 500);
      userSocket.simulateEvent("open-room", roomData);
      await openEventPromise;

      const joinEventPromise = waitForEvent(targetSocket, "room-joined", 500);
      targetSocket.simulateEvent("join-room", { sessionid: "test-room" });
      await joinEventPromise;

      // Simulate disconnection
      targetSocket.disconnect();

      expect(server.userExists("user2")).toBeFalse();

      const room = server.getRoom("test-room");
      expect(room!.participants).not.toContain("user2");
      expect(room!.participants).toHaveLength(1);
    });

    it("should transfer ownership when owner disconnects", async () => {
      const roomData = {
        sessionid: "test-room",
        session: { audio: true, video: true },
      };

      const openEventPromise = waitForEvent(targetSocket, "room-opened", 500);
      targetSocket.simulateEvent("open-room", roomData);
      await openEventPromise;

      const joinEventPromise = waitForEvent(userSocket, "room-joined", 500);
      userSocket.simulateEvent("join-room", { sessionid: "test-room" });
      await joinEventPromise;

      // Owner disconnects
      targetSocket.disconnect();

      const room = server.getRoom("test-room");
      expect(room!.owner).toBe("user1");
      expect(room!.participants).toContain("user1");
    });

    it("should close room when last user disconnects", async () => {
      const roomData = {
        sessionid: "test-room",
        session: { audio: true, video: true },
      };

      const openEventPromise = waitForEvent(userSocket, "room-opened", 500);
      userSocket.simulateEvent("open-room", roomData);
      await openEventPromise;

      userSocket.disconnect();

      expect(server.roomExists("test-room")).toBeFalse();
    });
  });
});
