/**
 * WebRTC Signaling System
 * 
 * Handles the signaling protocol between React Native and WebView
 * for establishing WebRTC peer connections to stream video.
 */

export type SignalingMessageType = 
  | 'offer'
  | 'answer'
  | 'ice-candidate'
  | 'ready'
  | 'error'
  | 'connection-state'
  | 'stats';

export interface SignalingMessage {
  type: SignalingMessageType;
  payload: any;
  timestamp: number;
  id: string;
}

export interface WebRTCConfig {
  iceServers: RTCIceServer[];
  iceTransportPolicy?: RTCIceTransportPolicy;
  bundlePolicy?: RTCBundlePolicy;
  rtcpMuxPolicy?: RTCRtcpMuxPolicy;
}

export interface ConnectionStats {
  bytesSent: number;
  bytesReceived: number;
  packetsLost: number;
  jitter: number;
  roundTripTime: number;
  currentRoundTripTime: number;
  framesEncoded?: number;
  framesDecoded?: number;
  framesSent?: number;
  framesReceived?: number;
  keyFramesEncoded?: number;
  totalEncodeTime?: number;
  totalDecodeTime?: number;
}

/**
 * Default WebRTC configuration with STUN servers
 */
export const DEFAULT_WEBRTC_CONFIG: WebRTCConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
  iceTransportPolicy: 'all',
  bundlePolicy: 'balanced',
  rtcpMuxPolicy: 'require',
};

/**
 * Generates a unique message ID
 */
export function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Creates a signaling message
 */
export function createSignalingMessage(
  type: SignalingMessageType,
  payload: any
): SignalingMessage {
  return {
    type,
    payload,
    timestamp: Date.now(),
    id: generateMessageId(),
  };
}

/**
 * Parses a signaling message from JSON string
 */
export function parseSignalingMessage(json: string): SignalingMessage | null {
  try {
    const message = JSON.parse(json);
    if (!message.type || !message.timestamp || !message.id) {
      console.warn('[WebRTCSignaling] Invalid message format:', message);
      return null;
    }
    return message as SignalingMessage;
  } catch (error) {
    console.error('[WebRTCSignaling] Failed to parse message:', error);
    return null;
  }
}

/**
 * Serializes a signaling message to JSON string
 */
export function serializeSignalingMessage(message: SignalingMessage): string {
  return JSON.stringify(message);
}

/**
 * WebRTC Signaling Channel
 * Manages bidirectional communication for WebRTC setup
 */
export class SignalingChannel {
  private messageQueue: SignalingMessage[] = [];
  private handlers: Map<SignalingMessageType, Set<(payload: any) => void>> = new Map();
  private isReady: boolean = false;

  constructor(private debug: boolean = false) {}

  private log(...args: any[]) {
    if (this.debug) {
      console.log('[SignalingChannel]', ...args);
    }
  }

  /**
   * Mark the channel as ready for communication
   */
  setReady() {
    this.isReady = true;
    this.log('Channel ready, processing queued messages:', this.messageQueue.length);
    this.processQueue();
  }

  /**
   * Check if channel is ready
   */
  isChannelReady(): boolean {
    return this.isReady;
  }

  /**
   * Register a handler for a specific message type
   */
  on(type: SignalingMessageType, handler: (payload: any) => void) {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler);
    this.log('Registered handler for:', type);
  }

  /**
   * Unregister a handler
   */
  off(type: SignalingMessageType, handler: (payload: any) => void) {
    const handlers = this.handlers.get(type);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.handlers.delete(type);
      }
    }
  }

  /**
   * Receive and process a signaling message
   */
  receive(message: SignalingMessage) {
    this.log('Received message:', message.type, message.id);

    if (!this.isReady) {
      this.log('Channel not ready, queueing message');
      this.messageQueue.push(message);
      return;
    }

    this.processMessage(message);
  }

  /**
   * Process a single message
   */
  private processMessage(message: SignalingMessage) {
    const handlers = this.handlers.get(message.type);
    if (handlers && handlers.size > 0) {
      handlers.forEach(handler => {
        try {
          handler(message.payload);
        } catch (error) {
          console.error('[SignalingChannel] Handler error:', error);
        }
      });
    } else {
      this.log('No handlers for message type:', message.type);
    }
  }

  /**
   * Process queued messages
   */
  private processQueue() {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift()!;
      this.processMessage(message);
    }
  }

  /**
   * Clear all handlers
   */
  clear() {
    this.handlers.clear();
    this.messageQueue = [];
    this.isReady = false;
    this.log('Channel cleared');
  }
}

/**
 * Create a default signaling channel
 */
export function createSignalingChannel(debug: boolean = false): SignalingChannel {
  return new SignalingChannel(debug);
}
