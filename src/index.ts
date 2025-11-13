import signaling_server from "./default_server";
import defaultSignal, { SignalingServer } from "./signal_server";
import {
  SocketIOLikeSocket,
  SocketIOLikeServer,
} from "./adapters/SocketIOLikeAdapter";
import { BunWebSocketAdapter } from "./adapters/BunWebSocketAdapter";
import { SignalingAdapter, createSignalingAdapter } from "./adapters/SignalingAdapter";
import { defaultLogger as logger } from "./logger/index";
import { getHeartbeatConfig } from "./heartbeat/index";
export * from "./logger/index";
export * from "./heartbeat/index";
export * from "./webrtc/index";
import type { 
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
} from "./types";

// Export all the imports to ensure they're available in the built module
export {
  signaling_server,
  SignalingServer,
  defaultSignal,
  SocketIOLikeSocket,
  SocketIOLikeServer,
  BunWebSocketAdapter,
  SignalingAdapter,
  createSignalingAdapter,
  logger,
  getHeartbeatConfig,
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
