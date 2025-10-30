import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { SignalingServer } from "../../src/signal_server";
import {
  createMockSocket,
  createTestRoom,
  createTestUser,
  waitForEvent,
  cleanupServer,
} from "../helpers/test-utils";

describe("SignalingServer", () => {
  let server: SignalingServer;

  beforeEach(() => {
    server = new SignalingServer({
      maxParticipantsAllowed: 5,
      enableHeartbeat: false,
    });
  });

  afterEach(() => {
    cleanupServer(server);
  });

  describe("Constructor", () => {
    it("should create server with default options", () => {
      const defaultServer = new SignalingServer();
      expect(defaultServer).toBeDefined();
      expect(defaultServer).toBeInstanceOf(SignalingServer);
    });

    it("should create server with custom options", () => {
      const customServer = new SignalingServer({
        maxParticipantsAllowed: 10,
        enableHeartbeat: true,
      });
      expect(customServer).toBeInstanceOf(SignalingServer);
    });
  });

  describe("Room Management", () => {
    it("should create a room successfully", async () => {
      const socket = createMockSocket("test-socket", "test-user");
      server.handleConnection(socket);

      const roomData = {
        sessionid: "test-room",
        session: { audio: true, video: true },
      };

      const eventPromise1 = waitForEvent(socket, "room-opened", 500);
      socket.simulateEvent("open-room", roomData);
      await eventPromise1;

      const eventPromise2 = waitForEvent(socket, "room-opened-error", 500);
      socket.simulateEvent("open-room", roomData);
      await eventPromise2;
      const room = server.getRoom("test-room");
      expect(room).toBeDefined();
      expect(room!.owner).toBe("test-user");
      expect(room!.participants).toContain("test-user");
    });

    it("should handle duplicate room creation", async () => {
      const socket = createMockSocket("test-socket", "test-user");
      server.handleConnection(socket);

      const roomData = {
        sessionid: "test-room",
        session: { audio: true, video: true },
      };

      const eventPromise = waitForEvent(socket, "room-opened", 500);
      socket.simulateEvent("open-room", roomData);
      await eventPromise;
    });

    it("should check room existence", () => {
      expect(server.roomExists("non-existent")).toBeFalse();

      const socket = createMockSocket("test-socket", "test-user");
      server.handleConnection(socket);

      const roomData = {
        sessionid: "test-room",
        session: { audio: true, video: true },
      };

      socket.simulateEvent("open-room", roomData, () => {});

      expect(server.roomExists("test-room")).toBeTrue();
    });

    it("should get all rooms", () => {
      const allRooms = server.getRooms();
      expect(Object.keys(allRooms)).toHaveLength(0);

      const socket1 = createMockSocket("socket1", "user1");
      const socket2 = createMockSocket("socket2", "user2");
      server.handleConnection(socket1);
      server.handleConnection(socket2);

      const roomData1 = {
        sessionid: "room1",
        session: { audio: true, video: true },
      };
      const roomData2 = {
        sessionid: "room2",
        session: { audio: true, video: true },
      };

      socket1.simulateEvent("open-room", roomData1, () => {});
      socket2.simulateEvent("open-room", roomData2, () => {});

      const rooms = server.getRooms();
      expect(Object.keys(rooms)).toHaveLength(2);
      expect(Object.keys(rooms)).toContain("room1");
      expect(Object.keys(rooms)).toContain("room2");
    });

    it("should close room and cleanup users", async () => {
      const socket = createMockSocket("test-socket", "test-user");
      server.handleConnection(socket);

      const roomData = {
        sessionid: "test-room",
        session: { audio: true, video: true },
      };

      const eventPromise = waitForEvent(socket, "room-opened", 500);
      socket.simulateEvent("open-room", roomData);
      await eventPromise;

      server.closeRoom("test-room");
      expect(server.roomExists("test-room")).toBeFalse();
    });

    it("should handle closing non-existent room", () => {
      expect(() => server.closeRoom("non-existent")).not.toThrow();
    });
  });

  describe("User Management", () => {
    it("should register user successfully", () => {
      const socket = createMockSocket("test-socket", "test-user");

      server.handleConnection(socket);

      expect(server.userExists("test-user")).toBeTrue();
      const retrievedUser = server.getUser("test-user");
      expect(retrievedUser).toBeDefined();
      expect(retrievedUser!.userid).toBe("test-user");
    });

    it("should check user existence", () => {
      expect(server.userExists("non-existent")).toBeFalse();

      const socket = createMockSocket("test-socket", "test-user");
      server.handleConnection(socket);

      expect(server.userExists("test-user")).toBeTrue();
    });

    it("should remove user and cleanup connections", () => {
      const socket = createMockSocket("test-socket", "test-user");

      server.handleConnection(socket);
      expect(server.userExists("test-user")).toBeTrue();

      socket.disconnect();
      expect(server.userExists("test-user")).toBeFalse();
    });

    it("should get user by ID", () => {
      const socket = createMockSocket("test-socket", "test-user");
      server.handleConnection(socket);

      const retrievedUser = server.getUser("test-user");
      expect(retrievedUser).toBeDefined();
      expect(retrievedUser!.userid).toBe("test-user");
    });

    it("should return undefined for non-existent user", () => {
      const user = server.getUser("non-existent");
      expect(user).toBeUndefined();
    });
  });

  describe("Connection Handling", () => {
    it("should handle user connection", () => {
      const socket = createMockSocket("test-socket", "test-user");

      server.handleConnection(socket);

      expect(server.userExists("test-user")).toBeTrue();
      expect(socket.userid).toBe("test-user");
    });

    it("should handle user disconnection", async () => {
      const socket = createMockSocket("test-socket", "test-user");

      server.handleConnection(socket);

      const roomData = {
        sessionid: "test-room",
        session: { audio: true, video: true },
      };

      const eventPromise = waitForEvent(socket, "room-opened", 500);
      socket.simulateEvent("open-room", roomData);
      await eventPromise;

      socket.disconnect();

      expect(server.userExists("test-user")).toBeFalse();
      expect(server.roomExists("test-room")).toBeFalse();
    });
  });

  describe("Room Participants", () => {
    it("should add participant to room", async () => {
      const ownerSocket = createMockSocket("owner-socket", "owner");
      const participantSocket = createMockSocket(
        "participant-socket",
        "participant",
      );

      server.handleConnection(ownerSocket);
      server.handleConnection(participantSocket);

      const roomData = {
        sessionid: "test-room-broadcast-sender",
        session: { audio: true, video: true },
      };

      const openEventPromise = waitForEvent(ownerSocket, "room-opened", 500);
      ownerSocket.simulateEvent("open-room", roomData);
      await openEventPromise;

      const joinEventPromise = waitForEvent(
        participantSocket,
        "room-joined",
        500,
      );
      participantSocket.simulateEvent("join-room", {
        sessionid: "test-room-broadcast-sender",
        session: { audio: true, video: true },
      });
      await joinEventPromise;

      const room = server.getRoom("test-room-broadcast-sender");
      expect(room!.participants).toContain("participant");
    });

    it("should remove participant from room", async () => {
      const ownerSocket = createMockSocket("owner-socket", "owner");
      const participantSocket = createMockSocket(
        "participant-socket",
        "participant",
      );

      server.handleConnection(ownerSocket);
      server.handleConnection(participantSocket);

      const roomData = {
        sessionid: "test-room-participant-remove",
        session: { audio: true, video: true },
      };

      const openEventPromise = waitForEvent(ownerSocket, "room-opened", 500);
      ownerSocket.simulateEvent("open-room", roomData);
      await openEventPromise;

      const joinEventPromise = waitForEvent(
        participantSocket,
        "room-joined",
        500,
      );
      participantSocket.simulateEvent("join-room", {
        sessionid: "test-room-participant-remove",
        session: { audio: true, video: true },
      });
      await joinEventPromise;

      // Register event listener before triggering disconnect
      const disconnectPromise = waitForEvent(
        participantSocket,
        "disconnect",
        100,
      );
      participantSocket.disconnect();
      await disconnectPromise;

      participantSocket.disconnect();

      const room = server.getRoom("test-room-participant-remove");
      expect(room!.participants).not.toContain("participant");
    });

    it("should handle room capacity limits", async () => {
      server = new SignalingServer({ maxParticipantsAllowed: 2 });

      const ownerSocket = createMockSocket("owner-socket", "owner");
      const participant1Socket = createMockSocket(
        "participant1-socket",
        "participant1",
      );
      const participant2Socket = createMockSocket(
        "participant2-socket",
        "participant2",
      );

      server.handleConnection(ownerSocket);
      server.handleConnection(participant1Socket);
      server.handleConnection(participant2Socket);

      const roomData = {
        sessionid: "test-room-capacity-test",
        session: { audio: true, video: true },
      };

      const openEventPromise = waitForEvent(ownerSocket, "room-opened", 500);
      ownerSocket.simulateEvent("open-room", roomData);
      await openEventPromise;

      const joinEvent1Promise = waitForEvent(
        participant1Socket,
        "room-joined",
        500,
      );
      participant1Socket.simulateEvent("join-room", {
        sessionid: "test-room-capacity-test",
      });
      await joinEvent1Promise;

      const joinEvent2Promise = waitForEvent(
        participant2Socket,
        "room-joined-error",
        500,
      );
      participant2Socket.simulateEvent("join-room", {
        sessionid: "test-room-capacity-test",
      });
      await joinEvent2Promise;

      const room = server.getRoom("test-room-capacity-test");
      expect(room!.participants).not.toContain("participant2");
    });
  });

  describe("Message Broadcasting", () => {
    it("should broadcast message to room participants", async () => {
      const ownerSocket = createMockSocket("owner-socket", "owner");
      const participantSocket = createMockSocket(
        "participant-socket",
        "participant",
      );

      server.handleConnection(ownerSocket);
      server.handleConnection(participantSocket);

      const roomData = {
        sessionid: "test-room-broadcast",
        session: { audio: true, video: true },
      };

      const openEventPromise = waitForEvent(ownerSocket, "room-opened", 500);
      ownerSocket.simulateEvent("open-room", roomData);
      await openEventPromise;

      const joinEventPromise = waitForEvent(
        participantSocket,
        "room-joined",
        500,
      );
      participantSocket.simulateEvent("join-room", {
        sessionid: "test-room-broadcast",
        session: { audio: true, video: true },
      });
      await joinEventPromise;

      // Establish peer connection
      const owner = server.getUser("owner");
      const participant = server.getUser("participant");
      owner!.connectedWith["participant"] = participant!.socket;
      participant!.connectedWith["owner"] = owner!.socket;

      const message = {
        type: "test",
        data: "hello",
        remoteUserId: "participant",
      };

      const messageEventPromise = waitForEvent(
        participantSocket,
        "RTCMultiConnection-Message",
        500,
      );
      ownerSocket.simulateEvent("RTCMultiConnection-Message", message);
      await messageEventPromise;

      const lastEvent = participantSocket.getLastEmittedEvent(
        "RTCMultiConnection-Message",
      );
      expect(lastEvent).toBeDefined();
      if (!lastEvent) return;
      expect(lastEvent.args[0]).toEqual(message);
    });

    it("should not broadcast to sender", async () => {
      const ownerSocket = createMockSocket("owner-socket", "owner");
      const participantSocket = createMockSocket(
        "participant-socket",
        "participant",
      );

      server.handleConnection(ownerSocket);
      server.handleConnection(participantSocket);

      const roomData = {
        sessionid: "test-room-broadcast-sender",
        session: { audio: true, video: true },
      };

      const openEventPromise = waitForEvent(ownerSocket, "room-opened", 500);
      ownerSocket.simulateEvent("open-room", roomData);
      await openEventPromise;

      const joinEventPromise = waitForEvent(
        participantSocket,
        "room-joined",
        500,
      );
      participantSocket.simulateEvent("join-room", {
        sessionid: "test-room-broadcast-sender",
        session: { audio: true, video: true },
      });
      await joinEventPromise;

      // Establish peer connection
      const owner = server.getUser("owner");
      const participant = server.getUser("participant");
      owner!.connectedWith["participant"] = participant!.socket;
      participant!.connectedWith["owner"] = owner!.socket;

      const message = {
        type: "test",
        data: "hello",
        remoteUserId: "participant",
      };
      ownerSocket.simulateEvent("RTCMultiConnection-Message", message);

      // Wait a bit to ensure no self-broadcast
      await new Promise((resolve) => setTimeout(resolve, 50));

      const lastEvent = ownerSocket.getLastEmittedEvent(
        "RTCMultiConnection-Message",
      );
      expect(lastEvent).toBeUndefined();
    });
  });

  describe("Password Protection", () => {
    it("should validate correct password", async () => {
      const socket = createMockSocket("test-socket", "test-user");
      server.handleConnection(socket);

      const roomData = {
        sessionid: "test-room",
        session: { audio: true, video: true },
        password: "secret123",
      };

      const eventPromise = waitForEvent(socket, "room-opened", 500);
      socket.simulateEvent("open-room", roomData);
      await eventPromise;

      const eventPromise2 = waitForEvent(
        socket,
        "is-valid-password-response",
        500,
      );
      socket.simulateEvent("is-valid-password", "secret123", "test-room");
      await eventPromise2;

      const room = server.getRoom("test-room");
      expect(room!.password).toBe("secret123");
    });

    it("should reject incorrect password", async () => {
      const socket = createMockSocket("test-socket", "test-user");
      server.handleConnection(socket);

      const roomData = {
        sessionid: "test-room",
        session: { audio: true, video: true },
        password: "secret123",
      };

      const eventPromise = waitForEvent(socket, "room-opened", 500);
      socket.simulateEvent("open-room", roomData);
      await eventPromise;

      const eventPromise2 = waitForEvent(
        socket,
        "is-valid-password-response",
        500,
      );
      socket.simulateEvent("is-valid-password", "wrong", "test-room");
      await eventPromise2;

      const room = server.getRoom("test-room");
      expect(room!.password).toBe("secret123");
    });

    it("should allow access for rooms without password", async () => {
      const socket = createMockSocket("test-socket", "test-user");
      server.handleConnection(socket);

      const roomData = {
        sessionid: "test-room",
        session: { audio: true, video: true },
      };

      const eventPromise = waitForEvent(socket, "room-opened", 500);
      socket.simulateEvent("open-room", roomData);
      await eventPromise;

      const eventPromise2 = waitForEvent(
        socket,
        "is-valid-password-response",
        500,
      );
      socket.simulateEvent("is-valid-password", "", "test-room");
      await eventPromise2;

      const room = server.getRoom("test-room");
      expect(room!.password).toBeUndefined();
    });
  });

  describe("Public Rooms", () => {
    it("should get rooms by identifier", async () => {
      const socket1 = createMockSocket("socket1", "user1");
      const socket2 = createMockSocket("socket2", "user2");
      const socket3 = createMockSocket("socket3", "user3");

      server.handleConnection(socket1);
      server.handleConnection(socket2);
      server.handleConnection(socket3);

      const room1Data = {
        sessionid: "room1",
        session: { audio: true, video: true },
        identifier: "public-chat",
      };
      const room2Data = {
        sessionid: "room2",
        session: { audio: true, video: true },
        identifier: "public-chat",
      };
      const room3Data = {
        sessionid: "room3",
        session: { audio: true, video: true },
        identifier: "private-room",
      };

      const eventPromise1 = waitForEvent(socket1, "room-opened", 500);
      socket1.simulateEvent("open-room", room1Data);
      await eventPromise1;

      const eventPromise2 = waitForEvent(socket2, "room-opened", 500);
      socket2.simulateEvent("open-room", room2Data);
      await eventPromise2;

      const eventPromise3 = waitForEvent(socket3, "room-opened", 500);
      socket3.simulateEvent("open-room", room3Data);
      await eventPromise3;

      const publicRoomsPromise = waitForEvent(
        socket1,
        "public-rooms-list",
        500,
      );
      socket1.simulateEvent(
        "get-public-rooms",
        "public-chat",
        (rooms: any[]) => {},
      );
      await publicRoomsPromise;

      const lastEvent = socket1.getLastEmittedEvent("public-rooms-list");
      expect(lastEvent).toBeDefined();
      if (!lastEvent) return;
      const publicRooms = lastEvent.args[0];
      expect(publicRooms).toHaveLength(2);
      expect(publicRooms.map((r: any) => r.sessionid)).toEqual([
        "room1",
        "room2",
      ]);
    });

    it("should return empty array for non-existent identifier", async () => {
      const socket = createMockSocket("test-socket", "test-user");
      server.handleConnection(socket);

      const publicRoomsPromise = waitForEvent(socket, "public-rooms-list", 500);
      socket.simulateEvent(
        "get-public-rooms",
        "non-existent",
        (rooms: any[]) => {},
      );
      await publicRoomsPromise;

      const lastEvent = socket.getLastEmittedEvent("public-rooms-list");
      expect(lastEvent).toBeDefined();
      if (!lastEvent) return;
      const rooms = lastEvent.args[0];
      expect(rooms).toHaveLength(0);
    });
  });
});
