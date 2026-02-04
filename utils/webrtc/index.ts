/**
 * WebRTC Video Injection System
 * 
 * Complete system for streaming video from React Native to WebView
 * using WebRTC peer-to-peer connections.
 * 
 * EXPO GO COMPATIBILITY:
 * ----------------------
 * This module primarily operates within the WebView context and is
 * FULLY COMPATIBLE with Expo Go. The WebRTC APIs (RTCPeerConnection, etc.)
 * are available in the WebView's JavaScript environment, not in React Native.
 * 
 * The injection scripts (WebRTCInjectionScript) run entirely in the browser
 * context and work without any native modules.
 * 
 * For React Native side signaling, use the SignalingChannel which uses
 * standard WebView postMessage communication that works in Expo Go.
 * 
 * Note: The CanvasVideoSource and WebRTCBridge classes run in the WebView
 * context (browser environment), not in React Native native code.
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
