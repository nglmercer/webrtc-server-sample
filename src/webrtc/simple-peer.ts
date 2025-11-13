/**
 * Simple-Peer WebRTC Provider for Bun
 * 
 * This module provides a WebRTC provider implementation using the simple-peer library.
 * Note: simple-peer requires a wrtc option, which doesn't work with Bun.
 * This implementation provides fallback handling and error reporting.
 */

import { EventEmitter } from 'events';
import type {
  WebRTCProvider,
  WebRTCConfig,
  RTCConfiguration,
  RTCSessionDescriptionInit,
  RTCIceCandidateInit,
  RTCDataChannelInit,
  RTCDataChannel,
  RTCStatsReport,
  RTCOfferOptions,
  RTCAnswerOptions,
  MediaStream,
} from './types.js';
import {
  RTCSdpType,
  RTCDataChannelState,
} from './types.js';

// Try to import simple-peer
let SimplePeer: any;
let simplePeerAvailable = false;

try {
  SimplePeer = require('simple-peer');
  simplePeerAvailable = true;
} catch (error) {
  console.warn('simple-peer not available. Install it with: npm install simple-peer');
}

/**
 * Simple-Peer WebRTC Provider Implementation
 * 
 * Note: This implementation has limitations in Bun due to wrtc dependency issues.
 * It's provided for completeness but node-datachannel is recommended for Bun.
 */
export class SimplePeerWebRTC extends EventEmitter implements WebRTCProvider {
  private peer: any;
  private dataChannels: Map<string, RTCDataChannel> = new Map();
  private localStreams: MediaStream[] = [];
  private remoteStreams: MediaStream[] = [];
  private config: WebRTCConfig;
  private connected = false;
  private isInitiator = false;

  constructor(config: WebRTCConfig = {}) {
    super();
    this.config = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ],
      debug: false,
      autoConnect: false,
      ...config
    };

    if (this.config.debug) {
      console.log('SimplePeerWebRTC initialized with config:', this.config);
    }
  }

  async connect(config?: WebRTCConfig): Promise<void> {
    if (!simplePeerAvailable) {
      throw new Error('simple-peer is not available or wrtc dependency failed. Install with: npm install simple-peer');
    }

    if (this.connected) {
      throw new Error('Already connected');
    }

    // Merge configs
    const finalConfig = { ...this.config, ...config };
    this.isInitiator = finalConfig.providerSpecific?.initiator || false;

    try {
      // Try to create simple-peer instance
      // This will likely fail in Bun due to wrtc issues
      this.peer = new SimplePeer({
        initiator: this.isInitiator,
        trickle: true,
        config: {
          iceServers: finalConfig.iceServers || [],
        },
        // This will fail in Bun:
        wrtc: require('wrtc'), // This line causes failure in Bun
      });

      this.setupPeerEvents();
      this.config = finalConfig;

      if (finalConfig.debug) {
        console.log('SimplePeer instance created (may fail in Bun)');
      }

      this.emit('connected');
    } catch (error) {
      console.error('Failed to create SimplePeer instance (expected in Bun):', error);
      throw new Error(
        'SimplePeer requires wrtc which is not compatible with Bun. ' +
        'Use node-datachannel instead or run with Node.js.'
      );
    }
  }

  private setupPeerEvents(): void {
    if (!this.peer) return;

    // Connection events
    this.peer.on('connect', () => {
      this.connected = true;
      if (this.config.debug) {
        console.log('SimplePeer connected');
      }
      this.emit('connect');
    });

    this.peer.on('close', () => {
      this.connected = false;
      if (this.config.debug) {
        console.log('SimplePeer closed');
      }
      this.emit('disconnect');
    });

    this.peer.on('error', (error: Error) => {
      console.error('SimplePeer error:', error);
      this.emit('error', error);
    });

    // Signaling events
    this.peer.on('signal', (data: any) => {
      if (this.config.debug) {
        console.log('SimplePeer signal:', data);
      }

      if (data.type === 'offer') {
        this.emit('offer', {
          type: RTCSdpType.OFFER,
          sdp: data.sdp,
        });
      } else if (data.type === 'answer') {
        this.emit('answer', {
          type: RTCSdpType.ANSWER,
          sdp: data.sdp,
        });
      } else if (data.candidate) {
        this.emit('iceCandidate', {
          candidate: data.candidate,
        });
      }
    });

    // Data channel events
    this.peer.on('data', (data: any) => {
      this.emit('dataChannelMessage', null, data);
    });

    // Stream events
    this.peer.on('stream', (stream: MediaStream) => {
      this.remoteStreams.push(stream);
      this.emit('remoteStream', stream);
    });
  }

  disconnect(): void {
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }

    // Close all data channels
    this.dataChannels.forEach(channel => {
      try {
        channel.close();
      } catch (error) {
        // Ignore errors during cleanup
      }
    });
    this.dataChannels.clear();

    this.connected = false;
    this.emit('disconnect');
  }

  isConnected(): boolean {
    return this.connected && this.peer !== null;
  }

  async createOffer(options?: RTCOfferOptions): Promise<RTCSessionDescriptionInit> {
    if (!this.peer) {
      throw new Error('Peer not initialized. Call connect() first.');
    }

    if (!this.isInitiator) {
      throw new Error('Cannot create offer when not initiator');
    }

    // SimplePeer handles offer creation automatically when initiator is true
    // The offer will be emitted via the 'signal' event
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Offer creation timeout'));
      }, 10000);

      this.once('offer', (offer: RTCSessionDescriptionInit) => {
        clearTimeout(timeout);
        resolve(offer);
      });
    });
  }

  async createAnswer(offer: RTCSessionDescriptionInit, options?: RTCAnswerOptions): Promise<RTCSessionDescriptionInit> {
    if (!this.peer) {
      throw new Error('Peer not initialized. Call connect() first.');
    }

    if (this.isInitiator) {
      throw new Error('Cannot create answer when initiator');
    }

    // Signal the offer to peer
    this.peer.signal(offer);

    // Wait for the answer
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Answer creation timeout'));
      }, 10000);

      this.once('answer', (answer: RTCSessionDescriptionInit) => {
        clearTimeout(timeout);
        resolve(answer);
      });
    });
  }

  async setLocalDescription(description: RTCSessionDescriptionInit): Promise<void> {
    // SimplePeer handles this internally
    if (this.config.debug) {
      console.log('setLocalDescription called (handled internally by SimplePeer)');
    }
  }

  async setRemoteDescription(description: RTCSessionDescriptionInit): Promise<void> {
    if (!this.peer) {
      throw new Error('Peer not initialized');
    }

    // Signal the remote description to the peer
    this.peer.signal(description);

    if (this.config.debug) {
      console.log('Remote description set:', description.type);
    }
  }

  async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.peer) {
      throw new Error('Peer not initialized');
    }

    // Signal the ICE candidate to the peer
    this.peer.signal({ candidate: candidate.candidate });

    if (this.config.debug) {
      console.log('Remote ICE candidate added:', candidate);
    }
  }

  createDataChannel(label: string, options: RTCDataChannelInit = {}): RTCDataChannel {
    if (!this.peer) {
      throw new Error('Peer not initialized');
    }

    const self = this; // Capture reference to the class instance

    // SimplePeer doesn't have separate data channels - it uses built-in data channel
    // We'll create a wrapper that uses the peer's built-in data functionality
    const wrappedChannel: RTCDataChannel = {
      label,
      ordered: options.ordered !== false,
      maxPacketLifeTime: options.maxPacketLifeTime || null,
      maxRetransmits: options.maxRetransmits || null,
      protocol: options.protocol || '',
      negotiated: false,
      id: null,
      readyState: self.connected ? RTCDataChannelState.OPEN : RTCDataChannelState.CONNECTING,
      bufferedAmount: 0,
      bufferedAmountLowThreshold: 0,
      onopen: null,
      onmessage: null,
      onerror: null,
      onclose: null,

      send(data: string | ArrayBuffer | ArrayBufferView | Blob): void {
        if (!self.connected) {
          throw new Error('Data channel not connected');
        }

        try {
          // SimplePeer's send method handles all data types
          self.peer.send(data);
        } catch (error) {
          console.error('Failed to send data:', error);
          throw error;
        }
      },

      close(): void {
        // SimplePeer doesn't support closing individual data channels
        // The entire peer connection must be closed
        if (self.config.debug) {
          console.log('Data channel close called (will close entire connection)');
        }
        self.disconnect();
      }
    };

    // Set up event handlers
    if (self.connected) {
      wrappedChannel.readyState = RTCDataChannelState.OPEN;
      if (wrappedChannel.onopen) {
        wrappedChannel.onopen(new Event('open'));
      }
    } else {
      // Wait for connection
      self.once('connect', () => {
        wrappedChannel.readyState = RTCDataChannelState.OPEN;
        if (wrappedChannel.onopen) {
          wrappedChannel.onopen(new Event('open'));
        }
      });
    }

    self.peer.on('data', (data: any) => {
      let eventData: MessageEvent;
      
      if (data instanceof Buffer) {
        eventData = new MessageEvent('message', { data: data.buffer });
      } else {
        eventData = new MessageEvent('message', { data });
      }

      if (wrappedChannel.onmessage) {
        wrappedChannel.onmessage(eventData);
      }
    });

    self.dataChannels.set(label, wrappedChannel);

    if (self.config.debug) {
      console.log(`Data channel created: ${label}`);
    }

    return wrappedChannel;
  }

  getLocalStreams(): MediaStream[] {
    return [...this.localStreams];
  }

  getRemoteStreams(): MediaStream[] {
    return [...this.remoteStreams];
  }

  addStream(stream: MediaStream): void {
    if (!this.peer) {
      throw new Error('Peer not initialized');
    }

    this.peer.addStream(stream);
    this.localStreams.push(stream);

    if (this.config.debug) {
      console.log('Media stream added');
    }
  }

  removeStream(stream: MediaStream): void {
    if (!this.peer) {
      throw new Error('Peer not initialized');
    }

    this.peer.removeStream(stream);
    const index = this.localStreams.indexOf(stream);
    if (index > -1) {
      this.localStreams.splice(index, 1);
    }

    if (this.config.debug) {
      console.log('Media stream removed');
    }
  }

  async getStats(): Promise<RTCStatsReport> {
    // SimplePeer doesn't have a standard getStats implementation
    if (!this.peer) {
      throw new Error('Peer not initialized');
    }

    return {
      'connection': {
        timestamp: Date.now(),
        type: 'session' as any,
        id: 'connection',
      }
    };
  }

  getProviderType(): string {
    return 'simple-peer';
  }

  getConfiguration(): RTCConfiguration {
    return {
      iceServers: this.config.iceServers || [],
      iceCandidatePoolSize: this.config.iceCandidatePoolSize,
    };
  }

  /**
   * Check if SimplePeer is available in the current environment
   */
  static isAvailable(): boolean {
    return simplePeerAvailable;
  }

  /**
   * Get detailed information about SimplePeer availability
   */
  static getAvailabilityInfo(): {
    available: boolean;
    reason?: string;
    recommendation: string;
  } {
    if (!simplePeerAvailable) {
      return {
        available: false,
        reason: 'simple-peer not installed or wrtc dependency failed',
        recommendation: 'Install with: npm install simple-peer (Note: will not work in Bun due to wrtc incompatibility)'
      };
    }

    // Try to detect if we're in Bun
    if (typeof process !== 'undefined' && process.versions && process.versions.bun) {
      return {
        available: false,
        reason: 'Running in Bun environment - wrtc dependency not compatible',
        recommendation: 'Use node-datachannel instead, which is fully compatible with Bun'
      };
    }

    return {
      available: true,
      recommendation: 'SimplePeer is available and should work in Node.js environment'
    };
  }
}
