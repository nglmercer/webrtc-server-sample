/**
 * Type definitions for WebRTC providers
 */

export interface RTCConfiguration {
  iceServers?: RTCIceServer[];
  iceCandidatePoolSize?: number;
  bundlePolicy?: RTCBundlePolicy;
  rtcpMuxPolicy?: RTCRtcpMuxPolicy;
  certificates?: RTCCertificate[];
}

export interface RTCIceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
  credentialType?: 'password';
}

export enum RTCBundlePolicy {
  BALANCED = 'balanced',
  MAX_COMPAT = 'max-compat',
  MAX_BUNDLE = 'max-bundle',
}

export enum RTCRtcpMuxPolicy {
  REQUIRE = 'require',
  NEGOTIATE = 'negotiate',
}

export interface RTCCertificate {
  expires?: number;
  getFingerprints(): string[];
}

export interface RTCSessionDescriptionInit {
  type: RTCSdpType;
  sdp?: string;
}

export enum RTCSdpType {
  OFFER = 'offer',
  ANSWER = 'answer',
  ROLLBACK = 'rollback',
}

export interface RTCIceCandidateInit {
  candidate?: string;
  sdpMid?: string;
  sdpMLineIndex?: number;
  usernameFragment?: string;
}

export interface WebRTCConfig extends RTCConfiguration {
  // General configuration
  debug?: boolean;
  autoConnect?: boolean;
  
  // Media configuration
  mediaConstraints?: {
    audio?: boolean | MediaTrackConstraints;
    video?: boolean | MediaTrackConstraints;
  };
  
  // Signaling configuration
  signalingServer?: string;
  roomId?: string;
  userId?: string;
  
  // Provider-specific configuration
  providerSpecific?: Record<string, any>;
}

export interface MediaTrackConstraints {
  width?: number | { min?: number; max?: number; ideal?: number };
  height?: number | { min?: number; max?: number; ideal?: number };
  frameRate?: number | { min?: number; max?: number; ideal?: number };
  facingMode?: string;
  deviceId?: string;
  groupId?: string;
  echoCancellation?: boolean;
  noiseSuppression?: boolean;
  autoGainControl?: boolean;
  sampleRate?: number;
  sampleSize?: number;
}

// Basic MediaStream interface for Node.js environment
export interface MediaStream {
  id: string;
  active: boolean;
  getAudioTracks(): MediaStreamTrack[];
  getVideoTracks(): MediaStreamTrack[];
  getTracks(): MediaStreamTrack[];
  addTrack(track: MediaStreamTrack): void;
  removeTrack(track: MediaStreamTrack): void;
  clone(): MediaStream;
}

export interface MediaStreamTrack {
  id: string;
  kind: 'audio' | 'video';
  label: string;
  enabled: boolean;
  muted: boolean;
  readonly state: 'live' | 'ended';
  stop(): void;
  getSettings(): MediaTrackSettings;
  getCapabilities(): MediaTrackCapabilities;
  getConstraints(): MediaTrackConstraints;
}

export interface MediaTrackSettings {
  width?: number;
  height?: number;
  sampleRate?: number;
  sampleSize?: number;
  echoCancellation?: boolean;
  noiseSuppression?: boolean;
  autoGainControl?: boolean;
  deviceId?: string;
  groupId?: string;
}

export interface MediaTrackCapabilities {
  width?: { min?: number; max?: number };
  height?: { min?: number; max?: number };
  sampleRate?: { min?: number; max?: number };
  sampleSize?: { min?: number; max?: number };
  echoCancellation?: boolean[];
  noiseSuppression?: boolean[];
  autoGainControl?: boolean[];
  deviceId?: string;
  groupId?: string;
}

export interface WebRTCProvider {
  // Connection management
  connect(config?: WebRTCConfig): Promise<void>;
  disconnect(): void;
  isConnected(): boolean;
  
  // Signaling
  createOffer(options?: RTCOfferOptions): Promise<RTCSessionDescriptionInit>;
  createAnswer(offer: RTCSessionDescriptionInit, options?: RTCAnswerOptions): Promise<RTCSessionDescriptionInit>;
  setLocalDescription(description: RTCSessionDescriptionInit): Promise<void>;
  setRemoteDescription(description: RTCSessionDescriptionInit): Promise<void>;
  addIceCandidate(candidate: RTCIceCandidateInit): Promise<void>;
  
  // Events
  on(event: string, callback: Function): void;
  off(event: string, callback: Function): void;
  emit(event: string, ...args: any[]): void;
  
  // Media
  getLocalStreams(): MediaStream[];
  getRemoteStreams(): MediaStream[];
  addStream(stream: MediaStream): void;
  removeStream(stream: MediaStream): void;
  
  // Data channels
  createDataChannel(label: string, options?: RTCDataChannelInit): RTCDataChannel;
  
  // Statistics
  getStats(): Promise<RTCStatsReport>;
  
  // Provider info
  getProviderType(): string;
  getConfiguration(): RTCConfiguration;
}

export interface RTCOfferOptions {
  offerToReceiveAudio?: boolean;
  offerToReceiveVideo?: boolean;
  voiceActivityDetection?: boolean;
  iceRestart?: boolean;
}

export interface RTCAnswerOptions {
  voiceActivityDetection?: boolean;
}

export interface RTCDataChannelInit {
  ordered?: boolean;
  maxPacketLifeTime?: number;
  maxRetransmits?: number;
  protocol?: string;
  negotiated?: boolean;
  id?: number;
}

export interface RTCDataChannel {
  label: string;
  ordered: boolean;
  maxPacketLifeTime: number | null;
  maxRetransmits: number | null;
  protocol: string;
  negotiated: boolean;
  id: number | null;
  readyState: RTCDataChannelState;
  bufferedAmount: number;
  bufferedAmountLowThreshold: number;
  
  onopen: ((event: Event) => void) | null;
  onmessage: ((event: MessageEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  onclose: ((event: Event) => void) | null;
  
  send(data: string | ArrayBuffer | ArrayBufferView | Blob): void;
  close(): void;
}

export enum RTCDataChannelState {
  CONNECTING = 'connecting',
  OPEN = 'open',
  CLOSING = 'closing',
  CLOSED = 'closed',
}

export interface RTCStatsReport {
  [key: string]: RTCStats | EnhancedRTCStats;
}

export interface RTCStats {
  timestamp: number;
  type: RTCStatsType;
  id: string;
}

export interface EnhancedRTCStats extends RTCStats {
  totalPeers?: number;
  connectedPeers?: number;
  totalQueuedMessages?: number;
  uptime?: number;
}

export enum RTCStatsType {
  INBOUND_RTP = 'inbound-rtp',
  OUTBOUND_RTP = 'outbound-rtp',
  REMOTE_INBOUND_RTP = 'remote-inbound-rtp',
  REMOTE_OUTBOUND_RTP = 'remote-outbound-rtp',
  CSRC = 'csrc',
  SESSION = 'session',
  DATA_CHANNEL = 'data-channel',
  TRACK = 'track',
  TRANSPORT = 'transport',
  CANDIDATE_PAIR = 'candidate-pair',
  LOCAL_CANDIDATE = 'local-candidate',
  REMOTE_CANDIDATE = 'remote-candidate',
  CERTIFICATE = 'certificate',
}

// Signaling message types
export interface SignalingMessage {
  type: 'offer' | 'answer' | 'ice-candidate' | 'join-room' | 'leave-room' | 'error';
  payload: any;
  userId?: string;
  roomId?: string;
  timestamp: number;
}

export interface JoinRoomMessage extends SignalingMessage {
  type: 'join-room';
  payload: {
    roomId: string;
    userId: string;
    userInfo?: any;
  };
}

export interface LeaveRoomMessage extends SignalingMessage {
  type: 'leave-room';
  payload: {
    roomId: string;
    userId: string;
  };
}

export interface OfferMessage extends SignalingMessage {
  type: 'offer';
  payload: RTCSessionDescriptionInit;
}

export interface AnswerMessage extends SignalingMessage {
  type: 'answer';
  payload: RTCSessionDescriptionInit;
}

export interface IceCandidateMessage extends SignalingMessage {
  type: 'ice-candidate';
  payload: RTCIceCandidateInit;
}

export interface ErrorMessage extends SignalingMessage {
  type: 'error';
  payload: {
    code: string;
    message: string;
    details?: any;
  };
}
