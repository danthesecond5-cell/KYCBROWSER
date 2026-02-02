/**
 * WebRTC Bridge for React Native
 * 
 * Manages the WebRTC peer connection on the React Native side,
 * creating a video stream that can be received by the WebView.
 */

import { 
  SignalingChannel, 
  SignalingMessage,
  WebRTCConfig,
  DEFAULT_WEBRTC_CONFIG,
  createSignalingMessage,
  ConnectionStats,
} from './WebRTCSignaling';

export type ConnectionState = 
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'failed'
  | 'closed';

export interface WebRTCBridgeConfig {
  webrtcConfig?: WebRTCConfig;
  videoConfig: {
    width: number;
    height: number;
    fps: number;
  };
  debug?: boolean;
  useCanvas?: boolean;
  videoUri?: string | null;
}

export interface VideoSource {
  getStream(): Promise<MediaStream | null>;
  start(): Promise<void>;
  stop(): void;
}

/**
 * Canvas-based video source for testing
 */
export class CanvasVideoSource implements VideoSource {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private stream: MediaStream | null = null;
  private animationId: number | null = null;
  private frameCount: number = 0;

  constructor(
    private width: number,
    private height: number,
    private fps: number
  ) {}

  async start(): Promise<void> {
    if (this.canvas) return; // Already started

    // Create canvas
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.ctx = this.canvas.getContext('2d', { alpha: false });

    if (!this.ctx) {
      throw new Error('Failed to get canvas context');
    }

    // Start animation
    this.animate();

    console.log('[CanvasVideoSource] Started');
  }

  private animate = () => {
    if (!this.canvas || !this.ctx) return;

    const timestamp = performance.now();
    const t = timestamp / 1000;

    // Draw animated pattern
    const hue = (t * 60) % 360;
    const gradient = this.ctx.createLinearGradient(0, 0, 0, this.height);
    gradient.addColorStop(0, `hsl(${hue}, 70%, 40%)`);
    gradient.addColorStop(0.5, `hsl(${(hue + 60) % 360}, 70%, 30%)`);
    gradient.addColorStop(1, `hsl(${(hue + 120) % 360}, 70%, 40%)`);
    
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, this.width, this.height);

    // Draw animated circle
    const centerX = this.width / 2;
    const centerY = this.height / 2;
    const radius = 100 + Math.sin(t * 2) * 30;
    
    this.ctx.beginPath();
    this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    this.ctx.fill();

    // Draw text
    this.ctx.fillStyle = 'black';
    this.ctx.font = 'bold 40px sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('WebRTC Stream', centerX, centerY);
    
    this.ctx.font = '20px monospace';
    this.ctx.fillText(`Frame: ${this.frameCount}`, centerX, centerY + 40);

    this.frameCount++;
    this.animationId = requestAnimationFrame(this.animate);
  };

  async getStream(): Promise<MediaStream | null> {
    if (!this.canvas) {
      await this.start();
    }

    if (!this.stream && this.canvas) {
      this.stream = this.canvas.captureStream(this.fps);
    }

    return this.stream;
  }

  stop(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    this.canvas = null;
    this.ctx = null;
    console.log('[CanvasVideoSource] Stopped');
  }
}

/**
 * WebRTC Bridge
 * Manages peer connection and streams video to WebView
 */
export class WebRTCBridge {
  private pc: RTCPeerConnection | null = null;
  private videoSource: VideoSource | null = null;
  private state: ConnectionState = 'disconnected';
  private statsInterval: NodeJS.Timeout | null = null;
  private onStateChange?: (state: ConnectionState) => void;
  private onStats?: (stats: ConnectionStats) => void;

  constructor(
    private config: WebRTCBridgeConfig,
    private signalingChannel: SignalingChannel
  ) {
    this.setupSignaling();
  }

  private log(...args: any[]) {
    if (this.config.debug) {
      console.log('[WebRTCBridge]', ...args);
    }
  }

  /**
   * Setup signaling handlers
   */
  private setupSignaling() {
    this.signalingChannel.on('answer', this.handleAnswer.bind(this));
    this.signalingChannel.on('ice-candidate', this.handleIceCandidate.bind(this));
  }

  /**
   * Initialize the peer connection
   */
  async initialize(): Promise<void> {
    this.log('Initializing WebRTC bridge...');

    // Create peer connection
    const rtcConfig = this.config.webrtcConfig || DEFAULT_WEBRTC_CONFIG;
    this.pc = new RTCPeerConnection(rtcConfig);

    // Setup event handlers
    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.log('ICE candidate:', event.candidate.candidate);
        this.sendMessage(createSignalingMessage('ice-candidate', {
          candidate: event.candidate.toJSON(),
        }));
      }
    };

    this.pc.onconnectionstatechange = () => {
      if (!this.pc) return;
      this.log('Connection state:', this.pc.connectionState);
      this.updateState(this.pc.connectionState as ConnectionState);
    };

    this.pc.oniceconnectionstatechange = () => {
      if (!this.pc) return;
      this.log('ICE connection state:', this.pc.iceConnectionState);
    };

    // Create video source
    if (this.config.useCanvas !== false) {
      this.videoSource = new CanvasVideoSource(
        this.config.videoConfig.width,
        this.config.videoConfig.height,
        this.config.videoConfig.fps
      );
    }

    if (this.videoSource) {
      await this.videoSource.start();
    }

    this.log('Initialization complete');
  }

  /**
   * Create and send offer
   */
  async createOffer(): Promise<void> {
    if (!this.pc) {
      throw new Error('Peer connection not initialized');
    }

    this.log('Creating offer...');

    // Get video stream and add to peer connection
    if (this.videoSource) {
      const stream = await this.videoSource.getStream();
      if (stream) {
        stream.getTracks().forEach(track => {
          this.log('Adding track:', track.kind, track.label);
          this.pc!.addTrack(track, stream);
        });
      }
    }

    // Create offer
    const offer = await this.pc.createOffer({
      offerToReceiveVideo: false,
      offerToReceiveAudio: false,
    });

    await this.pc.setLocalDescription(offer);

    this.log('Offer created:', offer.type);

    // Send offer to WebView
    this.sendMessage(createSignalingMessage('offer', {
      sdp: offer.sdp,
      type: offer.type,
    }));

    // Start stats collection
    this.startStatsCollection();
  }

  /**
   * Handle answer from WebView
   */
  private async handleAnswer(payload: any) {
    if (!this.pc) {
      console.error('[WebRTCBridge] No peer connection to handle answer');
      return;
    }

    this.log('Received answer');

    const answer = new RTCSessionDescription({
      type: payload.type,
      sdp: payload.sdp,
    });

    await this.pc.setRemoteDescription(answer);
    this.log('Remote description set');
  }

  /**
   * Handle ICE candidate from WebView
   */
  private async handleIceCandidate(payload: any) {
    if (!this.pc) {
      console.error('[WebRTCBridge] No peer connection to handle ICE candidate');
      return;
    }

    this.log('Received ICE candidate');

    const candidate = new RTCIceCandidate(payload.candidate);
    await this.pc.addIceCandidate(candidate);
  }

  /**
   * Send signaling message
   */
  private sendMessage(message: SignalingMessage) {
    // This will be sent via WebView postMessage
    // Implemented in the React component
    if ((window as any).__webrtcBridgeSendMessage) {
      (window as any).__webrtcBridgeSendMessage(message);
    } else {
      console.warn('[WebRTCBridge] No message sender available');
    }
  }

  /**
   * Update connection state
   */
  private updateState(newState: ConnectionState) {
    if (this.state !== newState) {
      this.state = newState;
      this.log('State changed:', newState);
      
      if (this.onStateChange) {
        this.onStateChange(newState);
      }

      this.sendMessage(createSignalingMessage('connection-state', {
        state: newState,
      }));
    }
  }

  /**
   * Start collecting stats
   */
  private startStatsCollection() {
    if (this.statsInterval) return;

    this.statsInterval = setInterval(async () => {
      if (!this.pc) return;

      try {
        const stats = await this.pc.getStats();
        const connectionStats = this.parseStats(stats);
        
        if (this.onStats) {
          this.onStats(connectionStats);
        }

        this.sendMessage(createSignalingMessage('stats', connectionStats));
      } catch (error) {
        console.error('[WebRTCBridge] Stats collection error:', error);
      }
    }, 1000);
  }

  /**
   * Parse RTCStatsReport
   */
  private parseStats(stats: RTCStatsReport): ConnectionStats {
    const connectionStats: ConnectionStats = {
      bytesSent: 0,
      bytesReceived: 0,
      packetsLost: 0,
      jitter: 0,
      roundTripTime: 0,
      currentRoundTripTime: 0,
    };

    stats.forEach(report => {
      if (report.type === 'outbound-rtp' && report.kind === 'video') {
        connectionStats.bytesSent = report.bytesSent || 0;
        connectionStats.framesSent = report.framesSent || 0;
        connectionStats.framesEncoded = report.framesEncoded || 0;
        connectionStats.keyFramesEncoded = report.keyFramesEncoded || 0;
        connectionStats.totalEncodeTime = report.totalEncodeTime || 0;
      }

      if (report.type === 'inbound-rtp' && report.kind === 'video') {
        connectionStats.bytesReceived = report.bytesReceived || 0;
        connectionStats.packetsLost = report.packetsLost || 0;
        connectionStats.jitter = report.jitter || 0;
        connectionStats.framesReceived = report.framesReceived || 0;
        connectionStats.framesDecoded = report.framesDecoded || 0;
        connectionStats.totalDecodeTime = report.totalDecodeTime || 0;
      }

      if (report.type === 'candidate-pair' && report.state === 'succeeded') {
        connectionStats.currentRoundTripTime = report.currentRoundTripTime || 0;
        connectionStats.roundTripTime = report.totalRoundTripTime || 0;
      }
    });

    return connectionStats;
  }

  /**
   * Set state change callback
   */
  setStateChangeCallback(callback: (state: ConnectionState) => void) {
    this.onStateChange = callback;
  }

  /**
   * Set stats callback
   */
  setStatsCallback(callback: (stats: ConnectionStats) => void) {
    this.onStats = callback;
  }

  /**
   * Get current state
   */
  getState(): ConnectionState {
    return this.state;
  }

  /**
   * Close connection and cleanup
   */
  close() {
    this.log('Closing WebRTC bridge...');

    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
    }

    if (this.videoSource) {
      this.videoSource.stop();
      this.videoSource = null;
    }

    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }

    this.updateState('closed');
    this.log('Closed');
  }
}

/**
 * Create a WebRTC bridge instance
 */
export function createWebRTCBridge(
  config: WebRTCBridgeConfig,
  signalingChannel: SignalingChannel
): WebRTCBridge {
  return new WebRTCBridge(config, signalingChannel);
}
