/**
 * Real Node-DataChannel WebRTC Provider for Bun
 * 
 * This module provides a REAL WebRTC provider implementation using node-datachannel library
 * WITHOUT MOCKS for actual network connectivity testing
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
import { getLogger, createPrefixedLogger, type Logger } from './logger.js';

// Try to import node-datachannel
let nodeDataChannel: any;
try {
  nodeDataChannel = require('node-datachannel');
} catch (error) {
  console.warn('node-datachannel not available. Install it with: npm install node-datachannel');
}

/**
 * REAL Node-DataChannel WebRTC Provider Implementation (No Mocks)
 */
export class NodeDataChannelWebRTCReal extends EventEmitter implements WebRTCProvider {
  private peerConnection: any;
  private dataChannels: Map<string, RTCDataChannel> = new Map();
  private localStreams: MediaStream[] = [];
  private remoteStreams: MediaStream[] = [];
  private config: WebRTCConfig;
  private connected = false;
  private isInitialized = false;
  private logger: Logger;

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

    this.logger = createPrefixedLogger('NodeDataChannelReal');

    if (this.config.debug) {
      this.logger.debug('NodeDataChannelWebRTCReal initialized with config:', this.config);
    }

    this.initialize();
  }

  private initialize(): void {
    if (!nodeDataChannel) {
      this.logger.error('node-datachannel is not available. Install it with: npm install node-datachannel');
      throw new Error('node-datachannel is not available. Install it with: npm install node-datachannel');
    }

    try {
      // Initialize node-datachannel for REAL network connectivity
      if (nodeDataChannel.initLogger) {
        nodeDataChannel.initLogger(this.config.debug ? 'debug' : 'warning');
      }
      
      this.isInitialized = true;
      
      if (this.config.debug) {
        this.logger.debug('Node-DataChannel REAL initialized successfully');
      }
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to initialize node-datachannel:', errorMessage);
      throw error;
    }
  }

  async connect(config?: WebRTCConfig): Promise<void> {
    if (this.connected) {
      throw new Error('Already connected');
    }

    if (!this.isInitialized) {
      this.initialize();
    }

    // Merge configs
    const finalConfig = { ...this.config, ...config };

    try {
      // Create REAL PeerConnection
      const peerName = finalConfig.userId || `peer-${Date.now()}`;
      
      // Convert iceServers format for node-datachannel
      const iceServers = (finalConfig.iceServers || [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]).map(server => {
        if (typeof server.urls === 'string') {
          const url = new URL(server.urls);
          return {
            hostname: url.hostname,
            port: parseInt(url.port) || (url.protocol === 'stun:' ? 3478 : 5349),
            protocol: url.protocol.replace(':', '')
          };
        }
        return server;
      });

      this.peerConnection = new nodeDataChannel.PeerConnection(peerName, {
        iceServers,
        enableIceUdpMux: true,
        enableIceTcp: true,
        portRangeBegin: 10000,
        portRangeEnd: 20000,
      });

      this.setupPeerConnectionEvents();
      
      this.connected = true;
      this.config = finalConfig;

      if (finalConfig.debug) {
        this.logger.debug(`REAL PeerConnection created: ${peerName}`);
      }

      this.emit('connected');
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to create REAL PeerConnection:', errorMessage);
      throw error;
    }
  }

  private setupPeerConnectionEvents(): void {
    if (!this.peerConnection) return;

    // Connection state changes
    this.peerConnection.onStateChange((state: string) => {
      if (this.config.debug) {
        this.logger.debug('REAL PeerConnection state changed:', state);
      }
      
      this.emit('connectionStateChange', state);
      
      if (state === 'connected') {
        this.emit('connect');
      } else if (state === 'disconnected' || state === 'failed') {
        this.connected = false;
        this.emit('disconnect');
      }
    });

    // ICE gathering state
    this.peerConnection.onGatheringStateChange((state: string) => {
      if (this.config.debug) {
        this.logger.debug('REAL ICE gathering state:', state);
      }
      this.emit('iceGatheringStateChange', state);
    });

    // REAL ICE candidates from actual network
    this.peerConnection.onLocalCandidate((candidate: string, sdpMid: string, sdpMLineIndex: number) => {
      if (candidate && candidate.trim()) {
        const iceCandidate: RTCIceCandidateInit = {
          candidate: candidate.startsWith('a=') ? candidate : `a=${candidate}`,
          sdpMid: sdpMid || '0',
          sdpMLineIndex: sdpMLineIndex || 0,
        };
        
        if (this.config.debug) {
          this.logger.debug('REAL Local ICE candidate:', iceCandidate);
        }
        
        this.emit('iceCandidate', iceCandidate);
      }
    });

    // REAL Data channel events
    this.peerConnection.onDataChannel((dataChannel: any) => {
      const wrappedChannel = this.wrapDataChannel(dataChannel);
      this.emit('dataChannel', wrappedChannel);
    });
  }

  disconnect(): void {
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
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
    return this.connected && this.peerConnection !== null;
  }

  async createOffer(options?: RTCOfferOptions): Promise<RTCSessionDescriptionInit> {
    if (!this.peerConnection) {
      throw new Error('PeerConnection not initialized. Call connect() first.');
    }

    try {
      if (this.config.debug) {
        this.logger.debug('Creating REAL offer...');
      }

      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('REAL Offer creation timeout'));
        },10000);

        // Set up listener for REAL local description
        const originalHandler = this.peerConnection.onLocalDescription;
        
        const handleLocalDescription = (type: string, sdp: string) => {
          clearTimeout(timeout);
          
          const offer: RTCSessionDescriptionInit = {
            type: RTCSdpType.OFFER,
            sdp: sdp, // Use REAL SDP from node-datachannel
          };

          if (this.config.debug) {
            this.logger.debug('REAL Local description generated:', offer);
          }

          // Restore original handler if it existed
          if (originalHandler) {
            this.peerConnection.onLocalDescription(originalHandler);
          } else {
            // Remove our listener if no original handler existed
            this.peerConnection.onLocalDescription(null);
          }

          resolve(offer);
        };

        this.peerConnection.onLocalDescription(handleLocalDescription);

        // Trigger REAL offer generation
        if (this.config.debug) {
          this.logger.debug('Triggering REAL offer generation...');
        }
        
        // Actually trigger offer creation
        try {
          this.peerConnection.createOffer();
        } catch (offerError) {
          clearTimeout(timeout);
          this.peerConnection.onLocalDescription(null);
          reject(offerError);
        }
      });
    } catch (error) {
      this.logger.error('Failed to create REAL offer:', error);
      throw error;
    }
  }

  async createAnswer(offer: RTCSessionDescriptionInit, options?: RTCAnswerOptions): Promise<RTCSessionDescriptionInit> {
    if (!this.peerConnection) {
      throw new Error('PeerConnection not initialized. Call connect() first.');
    }

    try {
      if (this.config.debug) {
        this.logger.debug('Creating REAL answer for offer:', offer.type);
      }

      // Set REAL offer as remote description
      if (offer.sdp) {
        try {
          // REAL setRemoteDescription for STUN connectivity
          await this.peerConnection.setRemoteDescription(offer.sdp, offer.type);
          
          if (this.config.debug) {
            this.logger.debug('REAL Remote description set successfully');
          }
        } catch (sdpError: any) {
          const errorMessage = sdpError instanceof Error ? sdpError.message : String(sdpError);
          this.logger.error('Failed to set REAL remote description:', errorMessage);
          throw new Error(`Failed to set remote description: ${errorMessage}`);
        }
      }

      // Wait for REAL node-datachannel to generate answer
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('REAL Answer creation timeout'));
        },10000);

        // Set up listener for REAL local description
        const originalHandler = this.peerConnection.onLocalDescription;
        
        const handleLocalDescription = (type: string, sdp: string) => {
          clearTimeout(timeout);
          
          const answer: RTCSessionDescriptionInit = {
            type: RTCSdpType.ANSWER,
            sdp: sdp, // Use REAL SDP from node-datachannel
          };

          if (this.config.debug) {
            this.logger.debug('REAL Answer generated:', answer);
          }

          // Restore original handler if it existed
          if (originalHandler) {
            this.peerConnection.onLocalDescription(originalHandler);
          } else {
            // Remove our listener if no original handler existed
            this.peerConnection.onLocalDescription(null);
          }

          resolve(answer);
        };

        this.peerConnection.onLocalDescription(handleLocalDescription);

        // Trigger REAL answer generation
        if (this.config.debug) {
          this.logger.debug('Triggering REAL answer generation...');
        }
        
        // Actually trigger answer creation
        try {
          this.peerConnection.createAnswer();
        } catch (answerError) {
          clearTimeout(timeout);
          this.peerConnection.onLocalDescription(null);
          reject(answerError);
        }
      });
    } catch (error) {
      this.logger.error('Failed to create REAL answer:', error);
      throw error;
    }
  }

  async setLocalDescription(description: RTCSessionDescriptionInit): Promise<void> {
    if (!this.peerConnection) {
      throw new Error('PeerConnection not initialized');
    }

    try {
      // REAL setLocalDescription
      await this.peerConnection.setLocalDescription(description.sdp, description.type);
      
      if (this.config.debug) {
        this.logger.debug('REAL Local description set:', description.type);
      }
      
      return Promise.resolve();
    } catch (error) {
      this.logger.error('Failed to set REAL local description:', error);
      throw error;
    }
  }

  async setRemoteDescription(description: RTCSessionDescriptionInit): Promise<void> {
    if (!this.peerConnection) {
      throw new Error('PeerConnection not initialized');
    }

    try {
      if (this.config.debug) {
        this.logger.debug('Setting REAL remote description:', description.type);
      }

      // REAL setRemoteDescription for STUN/TURN connectivity
      if (description.sdp) {
        await this.peerConnection.setRemoteDescription(description.sdp, description.type);
        
        if (this.config.debug) {
          this.logger.debug('REAL Remote description set successfully');
        }
      }
      
      return Promise.resolve();
    } catch (error) {
      this.logger.error('Failed to set REAL remote description:', error);
      throw error;
    }
  }

  async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.peerConnection) {
      throw new Error('PeerConnection not initialized');
    }

    try {
      // REAL addIceCandidate for STUN connectivity
      let candidateStr = candidate.candidate || '';
      if (candidateStr.startsWith('a=')) {
        candidateStr = candidateStr.substring(2);
      }
      
      // Only add if we have a valid candidate
      if (candidateStr.trim()) {
        await this.peerConnection.addRemoteCandidate(
          candidateStr,
          candidate.sdpMid || '0',
          candidate.sdpMLineIndex || 0
        );

        if (this.config.debug) {
          this.logger.debug('REAL Remote ICE candidate added:', {
            candidate: candidateStr,
            sdpMid: candidate.sdpMid || '0',
            sdpMLineIndex: candidate.sdpMLineIndex || 0
          });
        }
      }
      
      return Promise.resolve();
    } catch (error) {
      // Don't fail entire connection for a single bad candidate
      if (this.config.debug) {
        this.logger.warn('Failed to add REAL ICE candidate (continuing):', error);
      }
    }
  }

  createDataChannel(label: string, options: RTCDataChannelInit = {}): RTCDataChannel {
    if (!this.peerConnection) {
      throw new Error('PeerConnection not initialized');
    }

    try {
      const dataChannel = this.peerConnection.createDataChannel(label, {
        ordered: options.ordered !== false,
        maxRetransmits: options.maxRetransmits,
        protocol: options.protocol || '',
      });

      const wrappedChannel = this.wrapDataChannel(dataChannel);
      this.dataChannels.set(label, wrappedChannel);

      if (this.config.debug) {
        this.logger.debug(`REAL Data channel created: ${label}`);
      }

      return wrappedChannel;
    } catch (error) {
      this.logger.error('Failed to create REAL data channel:', error);
      throw error;
    }
  }

  private wrapDataChannel(dataChannel: any): RTCDataChannel {
    const self = this;
    const wrappedChannel: RTCDataChannel = {
      label: dataChannel.getLabel ? dataChannel.getLabel() : 'unknown',
      ordered: dataChannel.isOrdered ? dataChannel.isOrdered() : true,
      maxPacketLifeTime: dataChannel.getMaxPacketLifeTime ? dataChannel.getMaxPacketLifeTime() : null,
      maxRetransmits: dataChannel.getMaxRetransmits ? dataChannel.getMaxRetransmits() : null,
      protocol: dataChannel.getProtocol ? dataChannel.getProtocol() : '',
      negotiated: false, // node-datachannel doesn't support negotiated channels
      id: null,
      readyState: RTCDataChannelState.CONNECTING,
      bufferedAmount: 0,
      bufferedAmountLowThreshold: 0,
      onopen: null,
      onmessage: null,
      onerror: null,
      onclose: null,

      send(data: string | ArrayBuffer | ArrayBufferView | Blob): void {
        try {
          // REAL data channel send
          if (wrappedChannel.readyState === RTCDataChannelState.OPEN) {
            if (typeof data === 'string') {
              dataChannel.sendMessage(data);
            } else if (data instanceof ArrayBuffer) {
              dataChannel.sendMessageBinary(Buffer.from(data));
            } else if (ArrayBuffer.isView(data)) {
              dataChannel.sendMessageBinary(Buffer.from(data.buffer));
            } else {
              throw new Error('Unsupported data type for send');
            }
            
            if (self.config.debug) {
              self.logger.debug('REAL data sent:', typeof data === 'string' ? data : `${typeof data} data`);
            }
          } else {
            throw new Error('Data channel is not open');
          }
        } catch (error) {
          self.logger.error('Failed to send REAL data:', error);
          throw error;
        }
      },

      close(): void {
        try {
          dataChannel.close();
          wrappedChannel.readyState = RTCDataChannelState.CLOSED;
        } catch (error) {
          self.logger.error('Failed to close REAL data channel:', error);
        }
      }
    };

    // Set up REAL event handlers
    dataChannel.onOpen(() => {
      wrappedChannel.readyState = RTCDataChannelState.OPEN;
      if (wrappedChannel.onopen) {
        wrappedChannel.onopen(new Event('open'));
      }
      this.emit('dataChannelOpen', wrappedChannel);
      
      if (self.config.debug) {
        self.logger.debug('REAL Data channel opened:', wrappedChannel.label);
      }
    });

    dataChannel.onMessage((message: string | Buffer) => {
      let eventData: MessageEvent;
      
      if (Buffer.isBuffer(message)) {
        eventData = new MessageEvent('message', { data: message.buffer });
      } else {
        eventData = new MessageEvent('message', { data: message });
      }

      if (wrappedChannel.onmessage) {
        wrappedChannel.onmessage(eventData);
      }
      this.emit('dataChannelMessage', wrappedChannel, message);
      
      if (self.config.debug) {
        self.logger.debug('REAL Data message received:', typeof message === 'string' ? message : `${typeof message} data`);
      }
    });

    dataChannel.onError((error: string) => {
      if (wrappedChannel.onerror) {
        wrappedChannel.onerror(new ErrorEvent('error', { error: new Error(error) }));
      }
      this.emit('dataChannelError', wrappedChannel, error);
      
      if (self.config.debug) {
        self.logger.debug('REAL Data channel error:', error);
      }
    });

    dataChannel.onClosed(() => {
      wrappedChannel.readyState = RTCDataChannelState.CLOSED;
      if (wrappedChannel.onclose) {
        wrappedChannel.onclose(new Event('close'));
      }
      this.emit('dataChannelClose', wrappedChannel);
      
      if (self.config.debug) {
        self.logger.debug('REAL Data channel closed:', wrappedChannel.label);
      }
    });

    return wrappedChannel;
  }

  getLocalStreams(): MediaStream[] {
    return [...this.localStreams];
  }

  getRemoteStreams(): MediaStream[] {
    return [...this.remoteStreams];
  }

  addStream(stream: MediaStream): void {
    // node-datachannel has limited support for media streams
    // This is a placeholder for future implementation
    this.localStreams.push(stream);
    
    if (this.config.debug) {
      this.logger.debug('Media stream added (placeholder implementation)');
    }
  }

  removeStream(stream: MediaStream): void {
    const index = this.localStreams.indexOf(stream);
    if (index > -1) {
      this.localStreams.splice(index, 1);
    }
    
    if (this.config.debug) {
      this.logger.debug('Media stream removed (placeholder implementation)');
    }
  }

  async getStats(): Promise<RTCStatsReport> {
    // REAL getStats implementation
    if (!this.peerConnection) {
      throw new Error('PeerConnection not initialized');
    }

    // Try to get real stats from node-datachannel
    try {
      const stats = await this.peerConnection.getStats();
      return {
        'connection': {
          timestamp: Date.now(),
          type: 'session' as any,
          id: 'connection',
          ...stats
        }
      };
    } catch (error) {
      // Fallback to basic connection info
      if (this.config.debug) {
        this.logger.debug('Could not get real stats, using fallback:', error);
      }
      
      return {
        'connection': {
          timestamp: Date.now(),
          type: 'session' as any,
          id: 'connection',
        }
      };
    }
  }

  getProviderType(): string {
    return 'node-datachannel-real';
  }

  getConfiguration(): RTCConfiguration {
    return {
      iceServers: this.config.iceServers || [],
      iceCandidatePoolSize: this.config.iceCandidatePoolSize,
    };
  }
}
