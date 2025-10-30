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

describe("Room Handlers", () => {
  let server: SignalingServer;
  let ownerSocket: any;
  let participantSocket: any;

  beforeEach(() => {
    server = new SignalingServer({
      maxParticipantsAllowed: 3,
      enableHeartbeat: false,
    });

    ownerSocket = createMockSocket("owner-socket", "owner");
    participantSocket = createMockSocket("participant-socket", "participant");

    server.handleConnection(ownerSocket);
    server.handleConnection(participantSocket);
  });

  afterEach(() => {
    cleanupServer(server);
  });

  describe("open-room", () => {
    it("should create room with valid parameters", async () => {
      const roomData = {
        sessionid: "test-room-123",
        session: { audio: true, video: true },
        identifier: "public-chat",
        password: "secret123",
      };

      const eventPromise = waitForEvent(ownerSocket, "room-opened", 100);
      ownerSocket.simulateEvent("open-room", roomData, () => {});
      await eventPromise;

      const room = server.getRoom("test-room-123");
      expect(room).toBeDefined();
      expect(room!.owner).toBe("owner");
      expect(room!.password).toBe("secret123");
      expect(room!.identifier).toBe("public-chat");
      expect(room!.participants).toContain("owner");

      expectEvent(ownerSocket, "room-opened");
    });

    it("should create room without optional parameters", async () => {
      const roomData = {
        sessionid: "simple-room",
        session: { audio: false, video: true },
      };

      const eventPromise = waitForEvent(ownerSocket, "room-opened", 100);
      ownerSocket.simulateEvent("open-room", roomData, () => {});
      await eventPromise;

      const room = server.getRoom("simple-room");
      expect(room).toBeDefined();
      expect(room!.identifier).toBe("");
      expect(room!.password).toBeUndefined();
    });

    it("should reject room creation when user already in room", async () => {
      const roomData1 = {
        sessionid: "room1",
        session: { audio: true, video: true },
      };
      const roomData2 = {
        sessionid: "room2",
        session: { audio: true, video: true },
      };

      const eventPromise1 = waitForEvent(ownerSocket, "room-opened", 100);
      ownerSocket.simulateEvent("open-room", roomData1, () => {});
      await eventPromise1;

      const eventPromise2 = waitForEvent(ownerSocket, "room-opened-error", 100);
      ownerSocket.simulateEvent("open-room", roomData2, () => {});
      await eventPromise2;

      expectEvent(ownerSocket, "room-opened-error");
      expect(server.userExists("owner")).toBeTrue();
      expect(server.getRoom("room2")).toBeUndefined();
    });

    it("should handle room creation with extra data", async () => {
      const roomData = {
        sessionid: "room-with-extra",
        session: { audio: true, video: true },
        extra: { avatar: "👨‍💻", nickname: "John" },
      };

      const eventPromise = waitForEvent(ownerSocket, "room-opened", 100);
      ownerSocket.simulateEvent("open-room", roomData, () => {});
      await eventPromise;

      ownerSocket.simulateEvent(
        "is-valid-password",
        "wrong-password",
        "test-room",
        () => {},
      );
      const room = server.getRoom("room-with-extra");
      expect(room).toBeDefined();
      expect(room!.extra).toEqual({ avatar: "👨‍💻", nickname: "John" });
    });
  });

  describe("join-room", () => {
    it("should join existing room successfully", async () => {
      const roomData = {
        sessionid: "test-room-join-success",
        session: { audio: true, video: true },
        identifier: "public-chat",
      };
      const openEventPromise = waitForEvent(ownerSocket, "room-opened", 500);
      ownerSocket.simulateEvent("open-room", roomData);
      await openEventPromise;

      const joinData = {
        sessionid: "test-room-join-success",
        session: { audio: true, video: true },
        identifier: "public-chat",
      };
      const eventPromise = waitForEvent(participantSocket, "room-joined", 500);
      participantSocket.simulateEvent("join-room", joinData);
      await eventPromise;

      const room = server.getRoom("test-room-join-success");
      expect(room!.participants).toContain(participantSocket.userid);
      expect(room!.participants).toHaveLength(2);

      expectEvent(participantSocket, "room-joined");
    });

    it("should reject joining non-existent room", async () => {
      const joinData = { sessionid: "non-existent-room" };

      const eventPromise = waitForEvent(
        participantSocket,
        "room-joined-error",
        100,
      );
      participantSocket.simulateEvent("join-room", joinData);

      await eventPromise;

      expectEvent(participantSocket, "room-joined-error");
    });

    it("should require password for protected room", async () => {
      const freshOwnerSocket = createMockSocket("fresh-owner", "fresh-owner");
      const freshParticipantSocket = createMockSocket(
        "fresh-participant",
        "fresh-participant",
      );
      server.handleConnection(freshOwnerSocket);
      server.handleConnection(freshParticipantSocket);

      const protectedRoomData = {
        sessionid: "protected-room-password-required",
        session: { audio: true, video: true },
        password: "secret123",
      };
      const eventPromise1 = waitForEvent(freshOwnerSocket, "room-opened", 500);
      freshOwnerSocket.simulateEvent("open-room", protectedRoomData);
      await eventPromise1;

      const joinData = { sessionid: "protected-room-password-required" };
      const eventPromise2 = waitForEvent(
        freshParticipantSocket,
        "room-joined-error",
        500,
      );
      freshParticipantSocket.simulateEvent("join-room", joinData);
      await eventPromise2;

      expectEvent(freshParticipantSocket, "room-joined-error");
    });

    it("should accept correct password", async () => {
      const freshOwnerSocket = createMockSocket("fresh-owner2", "fresh-owner2");
      const freshParticipantSocket = createMockSocket(
        "fresh-participant2",
        "fresh-participant2",
      );
      server.handleConnection(freshOwnerSocket);
      server.handleConnection(freshParticipantSocket);

      const protectedRoomData = {
        sessionid: "protected-room-correct-password",
        session: { audio: true, video: true },
        password: "secret123",
      };
      const eventPromise1 = waitForEvent(freshOwnerSocket, "room-opened", 500);
      freshOwnerSocket.simulateEvent("open-room", protectedRoomData);
      await eventPromise1;

      const joinData = {
        sessionid: "protected-room-correct-password",
        password: "secret123",
      };
      const eventPromise2 = waitForEvent(
        freshParticipantSocket,
        "room-joined",
        500,
      );
      freshParticipantSocket.simulateEvent("join-room", joinData);
      await eventPromise2;

      const room = server.getRoom("protected-room-correct-password");
      expect(room!.participants).toContain("fresh-participant2");
    });

    it("should reject incorrect password", async () => {
      const protectedRoomData = {
        sessionid: "protected-room-password-test",
        session: { audio: true, video: true },
        password: "secret123",
      };
      const openEventPromise = waitForEvent(ownerSocket, "room-opened", 500);
      ownerSocket.simulateEvent("open-room", protectedRoomData);
      await openEventPromise;

      const joinData = {
        sessionid: "protected-room-password-test",
        password: "wrong",
      };
      const wrongParticipantSocket = createMockSocket(
        "wrong-participant",
        "wrong-participant",
      );
      server.handleConnection(wrongParticipantSocket);

      const eventPromise = waitForEvent(
        wrongParticipantSocket,
        "room-joined-error",
        500,
      );
      wrongParticipantSocket.simulateEvent("join-room", joinData);
      await eventPromise;

      expectEvent(wrongParticipantSocket, "room-joined-error");
      const room = server.getRoom("protected-room-password-test");
      expect(room!.participants).not.toContain("wrong-participant");
    });

    it("should reject joining when room is full", async () => {
      // Create fresh sockets for this test to avoid conflicts
      const testOwnerSocket = createMockSocket("test-owner", "test-owner");
      const testParticipantSocket = createMockSocket(
        "test-participant",
        "test-participant",
      );

      const fullRoomData = {
        sessionid: "full-room-capacity-test",
        session: { audio: true, video: true },
      };

      // Create server with 2 participant limit
      server = new SignalingServer({
        maxParticipantsAllowed: 2,
        enableHeartbeat: false,
      });
      server.handleConnection(testOwnerSocket);
      server.handleConnection(testParticipantSocket);

      const openEventPromise = waitForEvent(
        testOwnerSocket,
        "room-opened",
        500,
      );
      testOwnerSocket.simulateEvent("open-room", fullRoomData);
      await openEventPromise;

      // Have participant join the room first to reach capacity
      const joinEventPromise = waitForEvent(
        testParticipantSocket,
        "room-joined",
        500,
      );
      testParticipantSocket.simulateEvent("join-room", {
        sessionid: "full-room-capacity-test",
      });
      await joinEventPromise;

      const thirdSocket = createMockSocket("third-socket", "third-user");
      server.handleConnection(thirdSocket);

      const eventPromise = waitForEvent(thirdSocket, "room-joined-error", 500);
      thirdSocket.simulateEvent("join-room", {
        sessionid: "full-room-capacity-test",
      });
      await eventPromise;

      expectEvent(thirdSocket, "room-joined-error");
    });
  });

  describe("check-presence", () => {
    it("should return true for existing room", async () => {
      const roomData = {
        sessionid: "existing-room",
        session: { audio: true, video: true },
      };

      const eventPromise1 = waitForEvent(ownerSocket, "room-opened", 100);
      ownerSocket.simulateEvent("open-room", roomData, () => {});
      await eventPromise1;

      const eventPromise2 = waitForEvent(ownerSocket, "presence-checked", 100);
      ownerSocket.simulateEvent(
        "check-presence",
        "existing-room",
        (isPresent: boolean, roomid: string, extra: any) => {},
      );
      await eventPromise2;

      const lastEvent = ownerSocket.getLastEmittedEvent("presence-checked");
      expect(lastEvent.args[0]).toBeTrue();
    });

    it("should return false for non-existing room", async () => {
      const eventPromise = waitForEvent(ownerSocket, "presence-checked", 100);
      ownerSocket.simulateEvent(
        "check-presence",
        "non-existing-room",
        (isPresent: boolean, roomid: string, extra: any) => {},
      );
      await eventPromise;

      const lastEvent = ownerSocket.getLastEmittedEvent("presence-checked");
      expect(lastEvent.args[0]).toBeFalse();
    });
  });

  describe("get-public-rooms", () => {
    beforeEach(async () => {
      // Create multiple rooms with different identifiers
      const rooms = [
        {
          sessionid: "public1",
          session: { audio: true, video: true },
          identifier: "public-chat",
        },
        {
          sessionid: "public2",
          session: { audio: true, video: true },
          identifier: "public-chat",
        },
        {
          sessionid: "private1",
          session: { audio: true, video: true },
          identifier: "private-room",
        },
        {
          sessionid: "public3",
          session: { audio: true, video: true },
          identifier: "public-chat",
        },
      ];

      const eventPromises: Promise<any>[] = [];
      rooms.forEach((roomData, index) => {
        const socket =
          index === 0
            ? ownerSocket
            : createMockSocket(`socket-${index}`, `user-${index}`);
        server.handleConnection(socket);
        eventPromises.push(waitForEvent(socket, "room-opened", 100));
        socket.simulateEvent("open-room", roomData, () => {});
      });
      await Promise.all(eventPromises);
    });

    it("should return rooms with matching identifier", async () => {
      const publicRoomsPromise = waitForEvent(
        ownerSocket,
        "public-rooms-list",
        100,
      );
      ownerSocket.simulateEvent(
        "get-public-rooms",
        "public-chat",
        (rooms: any[]) => {},
      );
      await publicRoomsPromise;

      const lastEvent = ownerSocket.getLastEmittedEvent("public-rooms-list");
      const rooms = lastEvent.args[0];
      expect(rooms).toHaveLength(3);
      expect(rooms.map((r: any) => r.sessionid)).toEqual([
        "public1",
        "public2",
        "public3",
      ]);
    });

    it("should return empty array for non-matching identifier", async () => {
      const publicRoomsPromise = waitForEvent(
        ownerSocket,
        "public-rooms-list",
        100,
      );
      ownerSocket.simulateEvent(
        "get-public-rooms",
        "non-existent",
        (rooms: any[]) => {},
      );
      await publicRoomsPromise;

      const lastEvent = ownerSocket.getLastEmittedEvent("public-rooms-list");
      const rooms = lastEvent.args[0];
      expect(rooms).toHaveLength(0);
    });
  });

  describe("set-password", () => {
    beforeEach(async () => {
      const roomData = {
        sessionid: "test-room",
        session: { audio: true, video: true },
      };
      const eventPromise = waitForEvent(ownerSocket, "room-opened", 100);
      ownerSocket.simulateEvent("open-room", roomData, () => {});
      await eventPromise;
    });

    it("should allow owner to set password", async () => {
      const eventPromise = waitForEvent(ownerSocket, "password-updated", 100);
      ownerSocket.simulateEvent("set-password", "newpassword123", () => {});
      await eventPromise;

      const room = server.getRoom("test-room");
      expect(room!.password).toBe("newpassword123");
      expectEvent(ownerSocket, "password-updated");
    });

    it("should allow owner to remove password", async () => {
      // First set a password
      const eventPromise1 = waitForEvent(ownerSocket, "password-updated", 100);
      ownerSocket.simulateEvent("set-password", "temppass", () => {});
      await eventPromise1;

      // Then remove it
      const eventPromise2 = waitForEvent(ownerSocket, "password-updated", 100);
      ownerSocket.simulateEvent("set-password", "", () => {});
      await eventPromise2;

      const room = server.getRoom("test-room");
      expect(room!.password).toBe("");
      expectEvent(ownerSocket, "password-updated");
    });

    it("should reject non-owner setting password", async () => {
      const eventPromise1 = waitForEvent(participantSocket, "room-joined", 100);
      participantSocket.simulateEvent(
        "join-room",
        { sessionid: "test-room" },
        () => {},
      );
      await eventPromise1;

      const eventPromise2 = waitForEvent(
        participantSocket,
        "password-updated-error",
        100,
      );
      participantSocket.simulateEvent("set-password", "hackerpass", () => {});
      await eventPromise2;

      expectEvent(participantSocket, "password-updated-error");
      const room = server.getRoom("test-room");
      expect(room!.password).toBeUndefined();
    });
  });

  describe("is-valid-password", () => {
    beforeEach(() => {
      const roomData = {
        sessionid: "protected-room",
        session: { audio: true, video: true },
        password: "correctpass",
      };
      ownerSocket.simulateEvent("open-room", roomData, () => {});
    });

    it("should validate correct password", async () => {
      const eventPromise = waitForEvent(
        ownerSocket,
        "is-valid-password-response",
        100,
      );
      ownerSocket.simulateEvent(
        "is-valid-password",
        "correctpass",
        "protected-room",
        () => {},
      );
      await eventPromise;
      const lastEvent = ownerSocket.getLastEmittedEvent(
        "is-valid-password-response",
      );
      expect(lastEvent.args[0]).toBeTrue();
    });

    it("should reject incorrect password", async () => {
      const eventPromise = waitForEvent(
        ownerSocket,
        "is-valid-password-response",
        100,
      );
      ownerSocket.simulateEvent(
        "is-valid-password",
        "wrongpass",
        "protected-room",
        () => {},
      );
      await eventPromise;
      const lastEvent = ownerSocket.getLastEmittedEvent(
        "is-valid-password-response",
      );
      expect(lastEvent.args[0]).toBeFalse();
    });

    it("should handle non-existent room", async () => {
      const eventPromise = waitForEvent(
        ownerSocket,
        "is-valid-password-response",
        100,
      );
      ownerSocket.simulateEvent(
        "is-valid-password",
        "anypass",
        "non-existent",
        () => {},
      );
      await eventPromise;
      const lastEvent = ownerSocket.getLastEmittedEvent(
        "is-valid-password-response",
      );
      expect(lastEvent.args[0]).toBeFalse();
    });
  });

  describe("close-entire-session", () => {
    beforeEach(async () => {
      const roomData = {
        sessionid: "test-room-close-session",
        session: { audio: true, video: true },
      };
      const eventPromise = waitForEvent(ownerSocket, "room-opened", 500);
      ownerSocket.simulateEvent("open-room", roomData, () => {});
      await eventPromise;
    });

    it("should allow owner to close room", async () => {
      const joinEventPromise = waitForEvent(
        participantSocket,
        "room-joined",
        500,
      );
      participantSocket.simulateEvent(
        "join-room",
        { sessionid: "test-room-close-session" },
        () => {},
      );
      await joinEventPromise;

      const closeEventPromise = waitForEvent(
        ownerSocket,
        "session-closed",
        2000,
      );

      ownerSocket.simulateEvent("close-entire-session", () => {});

      await closeEventPromise;

      expect(server.roomExists("test-room-close-session")).toBeFalse();
      expectEvent(ownerSocket, "session-closed");
    });

    it("should reject non-owner closing room", async () => {
      const eventPromise1 = waitForEvent(participantSocket, "room-joined", 100);
      participantSocket.simulateEvent(
        "join-room",
        { sessionid: "test-room-close-session" },
        () => {},
      );
      await eventPromise1;

      const eventPromise2 = waitForEvent(
        participantSocket,
        "session-closed-error",
        100,
      );
      participantSocket.simulateEvent("close-entire-session", () => {});
      await eventPromise2;

      expect(server.roomExists("test-room-close-session")).toBeTrue();
      expectEvent(participantSocket, "session-closed-error");
    });
  });
});
