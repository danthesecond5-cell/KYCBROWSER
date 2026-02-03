/**
 * WebSocket Video Bridge
 * 
 * Protocol 6: Local WebSocket Relay
 * 
 * This module provides a WebSocket-based video streaming bridge between
 * the React Native app and the WebView. Instead of relying on canvas-based
 * injection which can have timing issues, this approach:
 * 
 * 1. Captures video frames in React Native
 * 2. Sends them via WebSocket to the WebView
 * 3. The WebView reconstructs the frames into a MediaStream
 * 
 * This bypasses all canvas/captureStream timing issues and gives
 * complete control over the video feed.
 */

export { WebSocketVideoBridge, createWebSocketVideoBridge } from './WebSocketVideoBridge';
export { createWebSocketInjectionScript } from './injectionScript';
export type {
  WebSocketBridgeConfig,
  WebSocketBridgeState,
  FrameData,
  BridgeMessage,
  BridgeEventType,
} from './types';
