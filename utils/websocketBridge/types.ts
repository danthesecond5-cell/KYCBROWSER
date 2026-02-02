/**
 * WebSocket Video Bridge Types
 */

export interface WebSocketBridgeConfig {
  /** Port to run the WebSocket server on (default: 8765) */
  port: number;
  
  /** Target video width */
  width: number;
  
  /** Target video height */
  height: number;
  
  /** Target frame rate */
  fps: number;
  
  /** JPEG quality for frame encoding (0-1, default: 0.7) */
  quality: number;
  
  /** Enable debug logging */
  debug: boolean;
  
  /** Video source URI (file path or asset) */
  videoUri?: string;
  
  /** Use synthetic green screen if no video */
  useSyntheticFallback: boolean;
  
  /** Device metadata for spoofing */
  deviceInfo: {
    deviceId: string;
    groupId: string;
    label: string;
    facingMode: 'user' | 'environment';
  };
}

export interface WebSocketBridgeState {
  /** Is the bridge currently running */
  isRunning: boolean;
  
  /** Number of connected WebView clients */
  connectedClients: number;
  
  /** Current frame rate being achieved */
  currentFps: number;
  
  /** Total frames sent */
  framesSent: number;
  
  /** Last error if any */
  lastError: string | null;
  
  /** WebSocket URL for clients to connect to */
  wsUrl: string;
}

export interface FrameData {
  /** Frame sequence number */
  seq: number;
  
  /** Timestamp in milliseconds */
  timestamp: number;
  
  /** Frame width */
  width: number;
  
  /** Frame height */
  height: number;
  
  /** Base64 encoded JPEG data */
  data: string;
}

export type BridgeEventType = 
  | 'started'
  | 'stopped'
  | 'clientConnected'
  | 'clientDisconnected'
  | 'error'
  | 'frameDropped';

export interface BridgeMessage {
  type: 'frame' | 'config' | 'ping' | 'pong' | 'error';
  payload: any;
  timestamp: number;
}

export const DEFAULT_BRIDGE_CONFIG: WebSocketBridgeConfig = {
  port: 8765,
  width: 1080,
  height: 1920,
  fps: 30,
  quality: 0.7,
  debug: false,
  useSyntheticFallback: true,
  deviceInfo: {
    deviceId: 'ws-bridge-camera-0',
    groupId: 'ws-bridge-group',
    label: 'WebSocket Bridge Camera (1080x1920)',
    facingMode: 'user',
  },
};
