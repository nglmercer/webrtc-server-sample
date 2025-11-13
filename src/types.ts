import { ParsedUrlQuery } from "querystring";

// Definimos una interfaz genérica para el socket
interface ISocket {
  id: string;
  handshake: {
    query: ParsedUrlQuery;
  };
  off(event: string, callback: (...args: any[]) => void): this;
  on(event: string, callback: (...args: any[]) => void): this;
  emit(event: string, ...args: any[]): boolean;
  broadcast: {
    emit(event: string, ...args: any[]): void;
  };
  disconnect(close?: boolean): this;
  nsp?: any;
}

interface User {
  userid: string;
  socket: CustomSocket;
  connectedWith: { [key: string]: CustomSocket };
  extra: any;
  socketMessageEvent: string;
  socketCustomEvent: string;
  roomid?: string;
  connectedAt?: Date;
}

interface Room {
  roomid?: string;
  maxParticipantsAllowed: number;
  owner: string;
  participants: string[];
  extra: any;
  socketMessageEvent: string;
  socketCustomEvent: string;
  identifier: string;
  session: {
    audio: boolean;
    video: boolean;
    oneway?: boolean;
    broadcast?: boolean;
    scalable?: boolean;
  };
  password?: string;
  createdAt?: Date;
  maxUsers?: number;
  // Computed property getter for users based on participants
  users?: User[];
}

interface CustomSocket extends ISocket {
  userid: string;
  admininfo?: {
    sessionid: string;
    session: any;
    mediaConstraints: any;
    sdpConstraints: any;
    streams: any;
    extra: any;
  };
  connected?: boolean;
  ondisconnect?: () => void;
  customEvents?: Set<string>;
  // WebRTC specific properties
  webrtcCapabilities?: string[];
  isWebRTCPeer?: boolean;
}

// WebRTC related interfaces
interface WebRTCMessage {
  id: string;
  type: 'offer' | 'answer' | 'ice-candidate' | 'join-room' | 'leave-room' | 'peer-joined' | 'peer-left';
  from: string;
  to?: string;
  room?: string;
  timestamp: number;
  payload: any;
}

interface WebRTCPeerInfo {
  id: string;
  roomId: string;
  joinedAt: number;
  metadata?: any;
  capabilities?: string[];
  socket?: CustomSocket;
}

interface WebRTCConfig {
  iceServers?: RTCIceServer[];
  debug?: boolean;
  userId?: string;
}

interface RTCDataChannel {
  label: string;
  readyState: 'connecting' | 'open' | 'closing' | 'closed';
  bufferedAmount: number;
  binaryType: string;
  send(data: string | ArrayBuffer | ArrayBufferView): void;
  close(): void;
  addEventListener(type: string, listener: EventListener): void;
  removeEventListener(type: string, listener: EventListener): void;
}

interface RTCIceCandidate {
  candidate: string;
  sdpMid: string | null;
  sdpMLineIndex: number | null;
  usernameFragment: string | null;
}

interface RTCIceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

interface RTCSessionDescription {
  type: 'offer' | 'answer' | 'pranswer' | 'rollback';
  sdp: string;
}

export type { 
  User, 
  Room, 
  CustomSocket, 
  ISocket,
  WebRTCMessage,
  WebRTCPeerInfo,
  WebRTCConfig,
  RTCDataChannel,
  RTCIceCandidate,
  RTCIceServer,
  RTCSessionDescription
};
