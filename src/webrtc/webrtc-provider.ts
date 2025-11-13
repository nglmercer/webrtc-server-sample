/**
 * Unified WebRTC Provider Implementation
 * 
 * A simplified, modular WebRTC provider that supports both real and mock modes
 * without complex dependencies or API compatibility issues
 */

import { EventEmitter } from 'events';
import type {
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
  WebRTCProvider as IWebRTCProvider,
} from './types';
import {
  RTCSdpType,
  RTCDataChannelState,
} from './types';
import { getLogger, createPrefixedLogger, type Logger } from './logger';

/**
 * Simplified WebRTC Provider Implementation
 * Supports both real connectivity (using node-datachannel) and mock mode
 */
export class WebRTCProvider extends EventEmitter implements IWebRTCProvider {
  private peerConnection: any = null;
  private dataChannels: Map<string, RTCDataChannel> = new Map();
  private localStreams: MediaStream[] = [];
  private remoteStreams: MediaStream[] = [];
  private config: WebRTCConfig;
  private connected = false;
  private isReal = false;
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

    this.isReal = this.config.useRealWebRTC === true;
    this.logger = createPrefixedLogger(this.isReal ? 'WebRTC-Real' : 'WebRTC-Mock');

    if (this.config.debug) {
      this.logger.debug('WebRTCProvider initialized:', {
        mode: this.isReal ? 'REAL' : 'MOCK',
        config: this.config
      });
    }
  }

  async connect(config?: WebRTCConfig): Promise<void> {
    if (this.connected) {
      throw new Error('Already connected');
    }

    // Merge configs
    const finalConfig = { ...this.config, ...config };

    try {
      if (this.isReal) {
        await this.connectReal(finalConfig);
      } else {
        await this.connectMock(finalConfig);
      }
      
      this.config = finalConfig;
      this.emit('connected');
    } catch (error) {
      this.logger.error('Failed to connect:', error);
      throw error;
    }
  }

  private async connectReal(config: WebRTCConfig): Promise<void> {
    try {
      const nodeDataChannel = require('node-datachannel');
      
      // Initialize node-datachannel
      if (nodeDataChannel.initLogger) {
        nodeDataChannel.initLogger(config.debug ? 'debug' : 'warning');
      }

      // Create PeerConnection
      const peerName = config.userId || `peer-${Date.now()}`;
      this.peerConnection = new nodeDataChannel.PeerConnection(peerName, {
        iceServers: config.iceServers || [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      });

      this.setupRealEvents();
      
      if (config.debug) {
        this.logger.debug(`REAL PeerConnection created: ${peerName}`);
      }
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to create REAL WebRTC connection: ${errorMessage}`);
    }
  }

  private async connectMock(config: WebRTCConfig): Promise<void> {
    // Mock implementation for development/testing
    this.peerConnection = {
      state: 'new',
      localDescription: null,
      remoteDescription: null,
      iceCandidates: [],
      dataChannels: new Map()
    };

    this.setupMockEvents();
    
    if (config.debug) {
      this.logger.debug('MOCK PeerConnection created');
    }

    // Simulate connection delay
    await new Promise(resolve => setTimeout(resolve, 100));
    
    this.peerConnection.state = 'connected';
    this.emit('connect');
    
    if (config.debug) {
      this.logger.debug('MOCK PeerConnection connected');
    }
  }

  private setupRealEvents(): void {
    if (!this.peerConnection) return;

    // Connection state changes
    this.peerConnection.onStateChange?.((state: string) => {
      if (this.config.debug) {
        this.logger.debug('REAL PeerConnection state:', state);
      }
      
      this.emit('connectionStateChange', state);
      
      if (state === 'connected') {
        this.connected = true;
        this.emit('connect');
      } else if (state === 'disconnected' || state === 'failed') {
        this.connected = false;
        this.emit('disconnect');
      }
    });

    // ICE candidates
    this.peerConnection.onLocalCandidate?.((candidate: string, sdpMid: string, sdpMLineIndex: number) => {
      if (candidate && candidate.trim()) {
        const iceCandidate: RTCIceCandidateInit = {
          candidate: candidate.startsWith('a=') ? candidate : `a=${candidate}`,
          sdpMid: sdpMid || '0',
          sdpMLineIndex: sdpMLineIndex || 0,
        };
        
        if (this.config.debug) {
          this.logger.debug('REAL ICE candidate:', iceCandidate);
        }
        
        this.emit('iceCandidate', iceCandidate);
      }
    });

    // Data channels
    this.peerConnection.onDataChannel?.((dataChannel: any) => {
      const wrappedChannel = this.wrapDataChannel(dataChannel);
      this.emit('dataChannel', wrappedChannel);
    });
  }

  private setupMockEvents(): void {
    // Simulate ICE candidates after a short delay
    setTimeout(() => {
      const mockCandidates = [
        'a=candidate:1 1 UDP 2130706431 192.168.1.1 54400 typ host',
        'a=candidate:2 1 UDP 2130706431 192.168.1.1 54401 typ host'
      ];

      mockCandidates.forEach((candidate, index) => {
        setTimeout(() => {
          const iceCandidate: RTCIceCandidateInit = {
            candidate,
            sdpMid: '0',
            sdpMLineIndex: index,
          };
          
          if (this.config.debug) {
            this.logger.debug('MOCK ICE candidate:', iceCandidate);
          }
          
          this.emit('iceCandidate', iceCandidate);
        }, index * 100);
      });
    }, 200);
  }

  disconnect(): void {
    if (this.peerConnection) {
      if (this.isReal && this.peerConnection.close) {
        this.peerConnection.close();
      }
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
        this.logger.debug('Creating offer...');
      }

      if (this.isReal) {
        return this.createRealOffer();
      } else {
        return this.createMockOffer();
      }
    } catch (error) {
      this.logger.error('Failed to create offer:', error);
      throw error;
    }
  }

  private async createRealOffer(): Promise<RTCSessionDescriptionInit> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Offer creation timeout'));
      }, 10000);

      // Set up listener for local description
      const handleDescription = (type: string, sdp: string) => {
        clearTimeout(timeout);
        
        const offer: RTCSessionDescriptionInit = {
          type: RTCSdpType.OFFER,
          sdp: sdp
        };

        if (this.config.debug) {
          this.logger.debug('REAL offer created:', offer);
        }

        resolve(offer);
      };

      this.peerConnection.onLocalDescription = handleDescription;

      try {
        // Try different ways to trigger offer creation
        if (typeof this.peerConnection.createOffer === 'function') {
          this.peerConnection.createOffer();
        } else if (typeof this.peerConnection.createOffer === 'object') {
          // Maybe it's an async function or has different signature
          const result = this.peerConnection.createOffer();
          if (result && typeof result.then === 'function') {
            result.then(() => {}).catch(reject);
          }
        } else {
          reject(new Error('createOffer method not available or has unexpected signature'));
        }
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  }

  private async createMockOffer(): Promise<RTCSessionDescriptionInit> {
    // Simulate SDP generation delay
    await new Promise(resolve => setTimeout(resolve, 200));
    
    const mockOffer: RTCSessionDescriptionInit = {
      type: RTCSdpType.OFFER,
      sdp: `v=0\r\no=- 0 0 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\na=ice-ufrag:${Math.random().toString(36).substring(0, 8)}\r\na=ice-pwd:${Math.random().toString(36).substring(0, 16)}\r\na=fingerprint:sha-256 ${Buffer.from('mock-fingerprint').toString('hex')}\r\nm=audio 9 UDP/TLS/RTP/SAVPF 0 0 0 127.0.0.1 ${Math.floor(Math.random() * 9000) + 1000} typ\r\nm=video 9 UDP/TLS/RTP/SAVPF 0 0 0 127.0.0.1 ${Math.floor(Math.random() * 9000) + 1000} typ\r\na=sendrecv\r\na=mid:audio\r\na=mid:video\r\na=rtcp-mux\r\na=rtpmap:111 opus/48000/2\r\na=rtpmap:96 VP8/90000\r\na=ssrc:1 cname:mock\r\na=ssrc:2 cname:mock\r\n`
    };

    if (this.config.debug) {
      this.logger.debug('MOCK offer created:', mockOffer);
    }

    return mockOffer;
  }

  async createAnswer(offer: RTCSessionDescriptionInit, options?: RTCAnswerOptions): Promise<RTCSessionDescriptionInit> {
    if (!this.peerConnection) {
      throw new Error('PeerConnection not initialized. Call connect() first.');
    }

    try {
      if (this.config.debug) {
        this.logger.debug('Creating answer...');
      }

      if (this.isReal) {
        return this.createRealAnswer(offer);
      } else {
        return this.createMockAnswer(offer);
      }
    } catch (error) {
      this.logger.error('Failed to create answer:', error);
      throw error;
    }
  }

  private async createRealAnswer(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Answer creation timeout'));
      }, 10000);

      // Set remote description first
      if (this.peerConnection.setRemoteDescription && offer.sdp) {
        try {
          this.peerConnection.setRemoteDescription(offer.sdp, offer.type);
          
          if (this.config.debug) {
            this.logger.debug('REAL remote description set');
          }
        } catch (error: any) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          clearTimeout(timeout);
          reject(new Error(`Failed to set remote description: ${errorMessage}`));
          return;
        }
      }

      // Set up listener for local description
      const handleDescription = (type: string, sdp: string) => {
        clearTimeout(timeout);
        
        const answer: RTCSessionDescriptionInit = {
          type: RTCSdpType.ANSWER,
          sdp: sdp
        };

        if (this.config.debug) {
          this.logger.debug('REAL answer created:', answer);
        }

        resolve(answer);
      };

      this.peerConnection.onLocalDescription = handleDescription;

      // Trigger answer creation
      try {
        if (typeof this.peerConnection.createAnswer === 'function') {
          this.peerConnection.createAnswer();
        } else {
          reject(new Error('createAnswer method not available'));
        }
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  }

  private async createMockAnswer(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 150));
    
    const mockAnswer: RTCSessionDescriptionInit = {
      type: RTCSdpType.ANSWER,
      sdp: `v=0\r\no=- 0 0 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\na=ice-ufrag:answer-${Math.random().toString(36).substring(0, 8)}\r\na=ice-pwd:${Math.random().toString(36).substring(0, 16)}\r\na=fingerprint:sha-256 ${Buffer.from('mock-answer-fingerprint').toString('hex')}\r\nm=audio 9 UDP/TLS/RTP/SAVPF 0 0 0 127.0.0.1 ${Math.floor(Math.random() * 9000) + 1000} typ\r\nm=video 9 UDP/TLS/RTP/SAVPF 0 0 0 127.0.0.1 ${Math.floor(Math.random() * 9000) + 1000} typ\r\na=sendrecv\r\na=mid:audio\r\na=mid:video\r\na=rtcp-mux\r\na=rtpmap:111 opus/48000/2\r\na=rtpmap:96 VP8/90000\r\na=ssrc:1 cname:mock-answer\r\na=ssrc:2 cname:mock-answer\r\n`
    };

    if (this.config.debug) {
      this.logger.debug('MOCK answer created:', mockAnswer);
    }

    return mockAnswer;
  }

  async setLocalDescription(description: RTCSessionDescriptionInit): Promise<void> {
    if (!this.peerConnection) {
      throw new Error('PeerConnection not initialized');
    }

    try {
      if (this.config.debug) {
        this.logger.debug('Setting local description:', description.type);
      }

      if (this.isReal && this.peerConnection.setLocalDescription) {
        await this.peerConnection.setLocalDescription(description.sdp, description.type);
      } else {
        // Mock: just store description
        this.peerConnection.localDescription = description;
      }
    } catch (error) {
      this.logger.error('Failed to set local description:', error);
      throw error;
    }
  }

  async setRemoteDescription(description: RTCSessionDescriptionInit): Promise<void> {
    if (!this.peerConnection) {
      throw new Error('PeerConnection not initialized');
    }

    try {
      if (this.config.debug) {
        this.logger.debug('Setting remote description:', description.type);
      }

      if (this.isReal && this.peerConnection.setRemoteDescription) {
        await this.peerConnection.setRemoteDescription(description.sdp, description.type);
      } else {
        // Mock: just store description
        this.peerConnection.remoteDescription = description;
      }
    } catch (error) {
      this.logger.error('Failed to set remote description:', error);
      throw error;
    }
  }

  async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.peerConnection) {
      throw new Error('PeerConnection not initialized');
    }

    try {
      if (this.config.debug) {
        this.logger.debug('Adding ICE candidate');
      }

      if (this.isReal && this.peerConnection.addRemoteCandidate) {
        let candidateStr = candidate.candidate || '';
        if (candidateStr.startsWith('a=')) {
          candidateStr = candidateStr.substring(2);
        }
        
        if (candidateStr.trim()) {
          await this.peerConnection.addRemoteCandidate(
            candidateStr,
            candidate.sdpMid || '0',
            candidate.sdpMLineIndex || 0
          );
        }
      } else {
        // Mock: store candidate
        if (!this.peerConnection.iceCandidates) {
          this.peerConnection.iceCandidates = [];
        }
        this.peerConnection.iceCandidates.push(candidate);
      }
    } catch (error) {
      if (this.config.debug) {
        this.logger.warn('Failed to add ICE candidate (continuing):', error);
      }
    }
  }

  createDataChannel(label: string, options: RTCDataChannelInit = {}): RTCDataChannel {
    if (!this.peerConnection) {
      throw new Error('PeerConnection not initialized');
    }

    try {
      if (this.config.debug) {
        this.logger.debug(`Creating data channel: ${label}`);
      }

      let dataChannel: any;
      
      if (this.isReal && this.peerConnection.createDataChannel) {
        dataChannel = this.peerConnection.createDataChannel(label, {
          ordered: options.ordered !== false,
          maxRetransmits: options.maxRetransmits,
          protocol: options.protocol || '',
        });
      } else {
        // Mock data channel
        dataChannel = {
          label,
          state: RTCDataChannelState.CONNECTING,
          messages: [],
          onOpen: null,
          onMessage: null,
          onError: null,
          onClose: null
        };

        // Simulate opening after delay
        setTimeout(() => {
          dataChannel.state = RTCDataChannelState.OPEN;
          if (dataChannel.onOpen) dataChannel.onOpen();
          if (this.config.debug) {
            this.logger.debug(`MOCK Data channel opened: ${label}`);
          }
        }, 100);
      }

      const wrappedChannel = this.wrapDataChannel(dataChannel);
      this.dataChannels.set(label, wrappedChannel);

      return wrappedChannel;
    } catch (error) {
      this.logger.error('Failed to create data channel:', error);
      throw error;
    }
  }

  private wrapDataChannel(dataChannel: any): RTCDataChannel {
    const self = this;
    const wrappedChannel: RTCDataChannel = {
      label: dataChannel.label || dataChannel.getLabel?.() || 'unknown',
      ordered: dataChannel.ordered !== false,
      maxPacketLifeTime: dataChannel.maxPacketLifeTime || null,
      maxRetransmits: dataChannel.maxRetransmits || null,
      protocol: dataChannel.protocol || dataChannel.getProtocol?.() || '',
      negotiated: false,
      id: dataChannel.id || null,
      readyState: dataChannel.state || dataChannel.readyState || RTCDataChannelState.CONNECTING,
      bufferedAmount: 0,
      bufferedAmountLowThreshold: 0,
      onopen: null,
      onmessage: null,
      onerror: null,
      onclose: null,

      send(data: string | ArrayBuffer | ArrayBufferView | Blob): void {
        try {
          if (wrappedChannel.readyState === RTCDataChannelState.OPEN) {
            if (self.isReal && dataChannel.sendMessage) {
              if (typeof data === 'string') {
                dataChannel.sendMessage(data);
              } else if (data instanceof ArrayBuffer) {
                dataChannel.sendMessageBinary(Buffer.from(data));
              } else if (ArrayBuffer.isView(data)) {
                dataChannel.sendMessageBinary(Buffer.from(data.buffer));
              } else {
                throw new Error('Unsupported data type for send');
              }
            } else if (dataChannel.messages) {
              // Mock: store message
              dataChannel.messages.push(data);
              
              // Simulate message event
              setTimeout(() => {
                if (dataChannel.onMessage) {
                  dataChannel.onMessage(new MessageEvent('message', { data }));
                }
              }, 10);
            }
            
            if (self.config.debug) {
              self.logger.debug('Data sent:', typeof data === 'string' ? data : `${typeof data} data`);
            }
          } else {
            throw new Error('Data channel is not open');
          }
        } catch (error) {
          self.logger.error('Failed to send data:', error);
          throw error;
        }
      },

      close(): void {
        try {
          if (self.isReal && dataChannel.close) {
            dataChannel.close();
          } else if (dataChannel.state) {
            dataChannel.state = RTCDataChannelState.CLOSED;
          }
          
          wrappedChannel.readyState = RTCDataChannelState.CLOSED;
        } catch (error) {
          self.logger.error('Failed to close data channel:', error);
        }
      }
    };

    // Set up event handlers
    if (this.isReal) {
      // Real data channel events
      dataChannel.onOpen?.(() => {
        wrappedChannel.readyState = RTCDataChannelState.OPEN;
        if (wrappedChannel.onopen) {
          wrappedChannel.onopen(new Event('open'));
        }
        this.emit('dataChannelOpen', wrappedChannel);
        
        if (self.config.debug) {
          self.logger.debug(`Data channel opened: ${wrappedChannel.label}`);
        }
      });

      dataChannel.onMessage?.((message: string | Buffer) => {
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
          self.logger.debug('Data message received:', typeof message === 'string' ? message : 'binary data');
        }
      });

      dataChannel.onError?.((error: string) => {
        if (wrappedChannel.onerror) {
          wrappedChannel.onerror(new ErrorEvent('error', { error: new Error(error) }));
        }
        this.emit('dataChannelError', wrappedChannel, error);
        
        if (self.config.debug) {
          self.logger.debug('Data channel error:', error);
        }
      });

      dataChannel.onClosed?.(() => {
        wrappedChannel.readyState = RTCDataChannelState.CLOSED;
        if (wrappedChannel.onclose) {
          wrappedChannel.onclose(new Event('close'));
        }
        this.emit('dataChannelClose', wrappedChannel);
        
        if (self.config.debug) {
          self.logger.debug(`Data channel closed: ${wrappedChannel.label}`);
        }
      });
    } else {
      // Mock event handlers
      dataChannel.onOpen = () => {
        wrappedChannel.readyState = RTCDataChannelState.OPEN;
        if (wrappedChannel.onopen) {
          wrappedChannel.onopen(new Event('open'));
        }
        this.emit('dataChannelOpen', wrappedChannel);
        
        if (self.config.debug) {
          self.logger.debug(`MOCK Data channel opened: ${wrappedChannel.label}`);
        }
      };

      dataChannel.onMessage = (event: MessageEvent) => {
        if (wrappedChannel.onmessage) {
          wrappedChannel.onmessage(event);
        }
        this.emit('dataChannelMessage', wrappedChannel, event.data);
        
        if (self.config.debug) {
          self.logger.debug('MOCK Data message received:', typeof event.data === 'string' ? event.data : 'binary data');
        }
      };

      dataChannel.onError = (error: ErrorEvent) => {
        if (wrappedChannel.onerror) {
          wrappedChannel.onerror(error);
        }
        this.emit('dataChannelError', wrappedChannel, error.message);
        
        if (self.config.debug) {
          self.logger.debug('MOCK Data channel error:', error.message);
        }
      };

      dataChannel.onClose = () => {
        wrappedChannel.readyState = RTCDataChannelState.CLOSED;
        if (wrappedChannel.onclose) {
          wrappedChannel.onclose(new Event('close'));
        }
        this.emit('dataChannelClose', wrappedChannel);
        
        if (self.config.debug) {
          self.logger.debug(`MOCK Data channel closed: ${wrappedChannel.label}`);
        }
      };
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
    this.localStreams.push(stream);
    
    if (this.config.debug) {
      this.logger.debug('Media stream added (placeholder)');
    }
  }

  removeStream(stream: MediaStream): void {
    const index = this.localStreams.indexOf(stream);
    if (index > -1) {
      this.localStreams.splice(index, 1);
    }
    
    if (this.config.debug) {
      this.logger.debug('Media stream removed (placeholder)');
    }
  }

  async getStats(): Promise<RTCStatsReport> {
    if (!this.peerConnection) {
      throw new Error('PeerConnection not initialized');
    }

    // Try to get real stats
    try {
      if (this.isReal && this.peerConnection.getStats) {
        const stats = await this.peerConnection.getStats();
        return {
          'connection': {
            timestamp: Date.now(),
            type: 'session' as any,
            id: 'connection',
            ...stats
          }
        };
      }
    } catch (error) {
      if (this.config.debug) {
        this.logger.debug('Could not get real stats, using fallback:', error);
      }
    }

    // Fallback to basic stats
    const baseStats: any = {
      timestamp: Date.now(),
      type: 'session' as any,
      id: 'connection',
      dataChannels: this.dataChannels.size
    };
    
    if (!this.isReal) {
      baseStats.candidates = this.peerConnection.iceCandidates?.length || 0;
    }
    
    return {
      'connection': baseStats
    };
  }

  getProviderType(): string {
    return this.isReal ? 'webrtc-unified-real' : 'webrtc-unified-mock';
  }

  getConfiguration(): RTCConfiguration {
    return {
      iceServers: this.config.iceServers || [],
      iceCandidatePoolSize: this.config.iceCandidatePoolSize,
    };
  }
}
