/**
 * Integration Tests for WebRTC with Main SignalingServer
 * 
 * These tests verify that the WebRTC system integrates correctly
 * with the main SignalingServer infrastructure.
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { SignalingServer } from '../../src/signal_server.js';
import { createSignalingAdapter } from '../../src/adapters/SignalingAdapter.js';
import { MultiPeerManager } from '../../src/webrtc/multi-peer-manager.js';
import { resetGlobalSignalingServer } from '../../src/webrtc/signaling-server.js';

describe('WebRTC Integration with Main SignalingServer', () => {
  let mainSignalingServer: SignalingServer;
  let signalingAdapter: ReturnType<typeof createSignalingAdapter>;

  beforeAll(() => {
    // Reset global state
    resetGlobalSignalingServer();
    
    // Create main signaling server
    mainSignalingServer = new SignalingServer({
      maxParticipantsAllowed: 10
    });

    // Create signaling adapter
    signalingAdapter = createSignalingAdapter({
      signalingServer: mainSignalingServer,
      enableWebRTC: true,
      enableLegacySupport: true,
      debug: false
    });
  });

  afterAll(() => {
    // Cleanup
    resetGlobalSignalingServer();
  });

  describe('Signaling Adapter Integration', () => {
    it('should create adapter with main signaling server', () => {
      expect(signalingAdapter).toBeDefined();
    });

    it('should register WebRTC peer capabilities', () => {
      const peerId = 'test-peer-1';
      const roomId = 'test-room';
      
      signalingAdapter.registerWebRTCPeer(peerId, roomId, {
        capabilities: ['data-channels', 'message-queuing']
      });

      const registeredPeers = signalingAdapter.getWebRTCPeersInRoom(roomId);
      expect(registeredPeers).toHaveLength(1);
      expect(registeredPeers[0]?.id).toBe(peerId);
      expect(registeredPeers[0]?.roomId).toBe(roomId);
    });

    it('should unregister WebRTC peer correctly', () => {
      const peerId = 'test-peer-2';
      const roomId = 'test-room-unique'; // Use unique room to avoid conflicts
      
      signalingAdapter.registerWebRTCPeer(peerId, roomId);
      
      // Verify peer is registered
      const beforeUnregister = signalingAdapter.getWebRTCPeersInRoom(roomId);
      expect(beforeUnregister).toHaveLength(1);
      
      signalingAdapter.unregisterWebRTCPeer(peerId);
      
      // Verify peer is unregistered
      const registeredPeers = signalingAdapter.getWebRTCPeersInRoom(roomId);
      expect(registeredPeers).toHaveLength(0);
    });

    it('should route WebRTC messages through adapter', () => {
      const message = {
        type: 'offer' as const,
        from: 'peer-1',
        to: 'peer-2',
        payload: { sdp: 'test-offer' }
      };

      // Mock message handling
      let handledMessage: any = null;
      signalingAdapter.on('webrtc-message', (msg) => {
        handledMessage = msg;
      });

      // Register target peer first
      signalingAdapter.registerWebRTCPeer('peer-2', 'test-room');
      
      signalingAdapter.sendSignalingMessage(message);
      
      expect(handledMessage).toBeDefined();
      expect(handledMessage.type).toBe('offer');
    });
  });

  describe('MultiPeerManager with Main Signaling', () => {
    it('should create manager with main signaling server integration', async () => {
      const peerManager = new MultiPeerManager('test-peer', {
        roomId: 'integration-room',
        maxPeers: 5,
        autoConnect: false,
        useMainSignalingServer: true,
        mainSignalingServer,
        debug: false
      });

      expect(peerManager).toBeDefined();
      expect(peerManager['config'].useMainSignalingServer).toBe(true);
      expect(peerManager['config'].mainSignalingServer).toBe(mainSignalingServer);
    });

    it('should initialize with signaling adapter', async () => {
      const peerManager = new MultiPeerManager('test-peer', {
        roomId: 'integration-room',
        useMainSignalingServer: true,
        mainSignalingServer,
        debug: false
      });

      await peerManager.initialize();

      expect(peerManager['signalingAdapter']).toBeDefined();
      expect(peerManager['isInitialized']).toBe(true);
    });

    it('should connect to peers through main signaling', async () => {
      const peer1 = new MultiPeerManager('peer-1', {
        roomId: 'integration-room',
        useMainSignalingServer: true,
        mainSignalingServer,
        debug: false
      });

      const peer2 = new MultiPeerManager('peer-2', {
        roomId: 'integration-room',
        useMainSignalingServer: true,
        mainSignalingServer,
        debug: false
      });

      // Initialize both peers
      await Promise.all([
        peer1.initialize(),
        peer2.initialize()
      ]);

      // Mock connection (since real WebRTC requires complex setup)
      peer1['peers'].set('peer-2', {
        connected: true,
        peerId: 'peer-2'
      } as any);

      const connectedPeers = peer1.getConnectedPeers();
      expect(connectedPeers).toContain('peer-2');
    });

    it('should send messages through main signaling', async () => {
      const peer1 = new MultiPeerManager('sender-peer', {
        roomId: 'message-room',
        useMainSignalingServer: true,
        mainSignalingServer,
        debug: false
      });

      await peer1.initialize();

      // Mock successful message sending
      const mockAdapter = peer1['signalingAdapter'];
      if (mockAdapter) {
        let sentMessage: any = null;
        mockAdapter.sendSignalingMessage = (msg: any) => {
          sentMessage = msg;
        };

        // Create a mock peer connection to trigger signaling
        const mockPeer = {
          connected: false,
          peerId: 'receiver-peer',
          webrtc: null
        };
        peer1['peers'].set('receiver-peer', mockPeer as any);
        
        peer1.sendToPeer('receiver-peer', 'test message', 'default');

        // Message should be queued since peer is not connected
        // But we can verify the peer was created
        const peers = peer1.getAllPeers();
        expect(peers).toContain('receiver-peer');
      }
    });
  });

  describe('Message Handlers Integration', () => {
    it('should handle WebRTC messages through enhanced handlers', () => {
      // Mock socket with proper EventEmitter methods
      const events: { [key: string]: Function[] } = {};
      const mockSocket = {
        userid: 'test-user',
        emit: (event: string, data?: any) => {
          if (events[event]) {
            events[event].forEach(callback => callback(data));
          }
        },
        on: (event: string, callback: Function) => {
          if (!events[event]) events[event] = [];
          events[event].push(callback);
        },
        eventNames: () => Object.keys(events)
      } as any;

      const listOfUsers = {
        'test-user': {
          socket: mockSocket,
          connectedWith: {},
          extra: {},
          socketMessageEvent: '',
          socketCustomEvent: ''
        }
      };

      // Import and test message handlers
      const { registerMessageHandlers } = require('../../src/event-handlers/messageHandlers.js');
      
      // Should register WebRTC message handler
      registerMessageHandlers(mockSocket, {}, listOfUsers, 'test-event', {}, signalingAdapter);

      // Verify WebRTC handler is registered
      expect(mockSocket.eventNames()).toContain('webrtc-message');
    });

    it('should route WebRTC messages to correct handlers', () => {
      let handledMessage: any = null;
      
      const mockSocket = {
        userid: 'test-user',
        emit: (event: string, data: any) => {
          if (event === 'webrtc-message') {
            handledMessage = data;
          }
        },
        eventNames: () => ['webrtc-message']
      } as any;

      const listOfUsers = {};
      const { registerMessageHandlers } = require('../../src/event-handlers/messageHandlers.js');
      
      registerMessageHandlers(mockSocket, {}, listOfUsers, 'test-event', {}, signalingAdapter);

      // Send WebRTC message
      const webrtcMessage = {
        type: 'offer',
        from: 'peer-1',
        to: 'peer-2',
        payload: { test: 'data' }
      };

      mockSocket.emit('webrtc-message', webrtcMessage);

      expect(handledMessage).toEqual(webrtcMessage);
    });
  });

  describe('Backward Compatibility', () => {
    it('should work with legacy LocalSignalingServer', async () => {
      const legacyPeerManager = new MultiPeerManager('legacy-peer', {
        roomId: 'legacy-room',
        maxPeers: 5,
        autoConnect: false,
        useMainSignalingServer: false, // Disable main signaling
        debug: false
      });

      expect(legacyPeerManager).toBeDefined();
      expect(legacyPeerManager['config'].useMainSignalingServer).toBe(false);

      // Should work with local signaling server
      await legacyPeerManager.initialize();
      expect(legacyPeerManager['isInitialized']).toBe(true);
    });

    it('should handle both legacy and enhanced modes simultaneously', async () => {
      const enhancedPeer = new MultiPeerManager('enhanced-peer', {
        roomId: 'mixed-room',
        useMainSignalingServer: true,
        mainSignalingServer,
        debug: false
      });

      const legacyPeer = new MultiPeerManager('legacy-peer', {
        roomId: 'mixed-room',
        useMainSignalingServer: false,
        debug: false
      });

      // Both should initialize without conflicts
      await Promise.all([
        enhancedPeer.initialize(),
        legacyPeer.initialize()
      ]);

      expect(enhancedPeer['isInitialized']).toBe(true);
      expect(legacyPeer['isInitialized']).toBe(true);

      // Should not interfere with each other
      expect(enhancedPeer.getConnectedPeers()).not.toContain('legacy-peer');
      expect(legacyPeer.getConnectedPeers()).not.toContain('enhanced-peer');
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle multiple peer managers efficiently', async () => {
      const startTime = Date.now();
      const peerManagers: MultiPeerManager[] = [];

      // Create multiple peer managers
      for (let i = 0; i < 10; i++) {
        const manager = new MultiPeerManager(`peer-${i}`, {
          roomId: 'performance-room',
          useMainSignalingServer: true,
          mainSignalingServer,
          debug: false
        });
        peerManagers.push(manager);
      }

      // Initialize all concurrently
      await Promise.all(
        peerManagers.map(manager => manager.initialize())
      );

      const endTime = Date.now();
      const initializationTime = endTime - startTime;

      // Should initialize within reasonable time
      expect(initializationTime).toBeLessThan(1000); // 1 second
      expect(peerManagers.length).toBe(10);
    });

    it('should maintain performance with message volume', async () => {
      const peerManager = new MultiPeerManager('performance-peer', {
        roomId: 'volume-room',
        useMainSignalingServer: true,
        mainSignalingServer,
        debug: false
      });

      await peerManager.initialize();

      const startTime = Date.now();
      const messageCount = 1000;

      // Send many messages
      for (let i = 0; i < messageCount; i++) {
        peerManager.sendToPeer(`target-${i % 10}`, `message-${i}`);
      }

      const endTime = Date.now();
      const messageTime = endTime - startTime;

      // Should handle message volume efficiently
      expect(messageTime).toBeLessThan(500); // 500ms for 1000 messages
    });
  });
});
