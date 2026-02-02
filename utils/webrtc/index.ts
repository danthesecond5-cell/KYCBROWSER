/**
 * WebRTC Video Injection System
 * 
 * Complete system for streaming video from React Native to WebView
 * using WebRTC peer-to-peer connections.
 */

// Signaling
export {
  SignalingChannel,
  createSignalingChannel,
  generateMessageId,
  createSignalingMessage,
  parseSignalingMessage,
  serializeSignalingMessage,
  DEFAULT_WEBRTC_CONFIG,
} from './WebRTCSignaling';

export type {
  SignalingMessage,
  SignalingMessageType,
  WebRTCConfig,
  ConnectionStats,
} from './WebRTCSignaling';

// Bridge
export {
  WebRTCBridge,
  createWebRTCBridge,
  CanvasVideoSource,
} from './WebRTCBridge';

export type {
  WebRTCBridgeConfig,
  ConnectionState,
  VideoSource,
} from './WebRTCBridge';

// Injection Script
export {
  createWebRTCInjectionScript,
} from './WebRTCInjectionScript';

export type {
  WebRTCInjectionConfig,
} from './WebRTCInjectionScript';
