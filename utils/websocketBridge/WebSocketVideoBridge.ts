/**
 * WebSocket Video Bridge
 * 
 * This bridge facilitates video frame streaming from React Native to WebView
 * using the WebView's postMessage API instead of actual WebSockets.
 * 
 * Architecture:
 * 1. React Native captures video frames (from camera, video file, or synthetic)
 * 2. Frames are encoded as base64 JPEG and sent via injectJavaScript
 * 3. WebView receives frames and renders them to a canvas
 * 4. Canvas is captured as MediaStream for getUserMedia
 * 
 * This approach works in Expo Go without native modules.
 */

import { WebSocketBridgeConfig, WebSocketBridgeState, FrameData, DEFAULT_BRIDGE_CONFIG } from './types';

export class WebSocketVideoBridge {
  private config: WebSocketBridgeConfig;
  private state: WebSocketBridgeState;
  private frameInterval: ReturnType<typeof setInterval> | null = null;
  private frameSeq: number = 0;
  private webViewRef: any = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private onStateChange: ((state: WebSocketBridgeState) => void) | null = null;
  
  constructor(config: Partial<WebSocketBridgeConfig> = {}) {
    this.config = { ...DEFAULT_BRIDGE_CONFIG, ...config };
    this.state = {
      isRunning: false,
      connectedClients: 0,
      currentFps: 0,
      framesSent: 0,
      lastError: null,
      wsUrl: `postMessage://bridge`,
    };
  }
  
  /**
   * Set the WebView reference for frame injection
   */
  setWebViewRef(ref: any): void {
    this.webViewRef = ref;
    if (ref) {
      this.state.connectedClients = 1;
      this.updateState();
    }
  }
  
  /**
   * Set callback for state changes
   */
  onStateUpdate(callback: (state: WebSocketBridgeState) => void): void {
    this.onStateChange = callback;
  }
  
  /**
   * Start the video bridge
   */
  async start(): Promise<void> {
    if (this.state.isRunning) {
      this.log('Bridge already running');
      return;
    }
    
    this.log('Starting WebSocket Video Bridge...');
    
    try {
      // Initialize canvas for frame generation
      await this.initializeFrameSource();
      
      // Start frame generation loop
      const frameTime = 1000 / this.config.fps;
      this.frameInterval = setInterval(() => {
        this.generateAndSendFrame();
      }, frameTime);
      
      this.state.isRunning = true;
      this.updateState();
      this.log('Bridge started successfully');
    } catch (error: any) {
      this.state.lastError = error.message;
      this.updateState();
      throw error;
    }
  }
  
  /**
   * Stop the video bridge
   */
  stop(): void {
    if (this.frameInterval) {
      clearInterval(this.frameInterval);
      this.frameInterval = null;
    }
    
    if (this.videoElement) {
      this.videoElement.pause();
      this.videoElement = null;
    }
    
    this.state.isRunning = false;
    this.state.framesSent = 0;
    this.frameSeq = 0;
    this.updateState();
    this.log('Bridge stopped');
  }
  
  /**
   * Get current state
   */
  getState(): WebSocketBridgeState {
    return { ...this.state };
  }
  
  /**
   * Update configuration
   */
  updateConfig(config: Partial<WebSocketBridgeConfig>): void {
    const wasRunning = this.state.isRunning;
    
    if (wasRunning) {
      this.stop();
    }
    
    this.config = { ...this.config, ...config };
    
    if (wasRunning) {
      this.start();
    }
  }
  
  /**
   * Send a single frame to the WebView
   */
  sendFrame(frameData: FrameData): void {
    if (!this.webViewRef?.current) {
      return;
    }
    
    const message = JSON.stringify({
      type: 'ws-bridge-frame',
      frame: frameData,
    });
    
    // Inject the frame data into the WebView
    this.webViewRef.current.injectJavaScript(`
      (function() {
        if (window.__wsBridgeReceiveFrame) {
          window.__wsBridgeReceiveFrame(${message});
        }
      })();
      true;
    `);
    
    this.state.framesSent++;
  }
  
  // ============ Private Methods ============
  
  private async initializeFrameSource(): Promise<void> {
    // In React Native, we'll generate synthetic frames
    // This would be replaced with actual camera/video capture in native code
    this.log('Initializing frame source...');
    
    // For now, we'll rely on the injection script to generate frames
    // In a full implementation, you'd capture from expo-camera here
  }
  
  private generateAndSendFrame(): void {
    if (!this.webViewRef?.current) {
      return;
    }
    
    const frameData: FrameData = {
      seq: this.frameSeq++,
      timestamp: Date.now(),
      width: this.config.width,
      height: this.config.height,
      data: '', // Empty - the WebView will generate synthetic frames
    };
    
    // For efficiency, just send a trigger rather than full frame data
    // The WebView will render its own frames
    const message = JSON.stringify({
      type: 'ws-bridge-tick',
      seq: frameData.seq,
      timestamp: frameData.timestamp,
    });
    
    this.webViewRef.current.injectJavaScript(`
      (function() {
        if (window.__wsBridgeTick) {
          window.__wsBridgeTick(${message});
        }
      })();
      true;
    `);
    
    this.state.framesSent++;
    
    // Update FPS calculation every second
    if (this.frameSeq % this.config.fps === 0) {
      this.state.currentFps = this.config.fps;
      this.updateState();
    }
  }
  
  private updateState(): void {
    if (this.onStateChange) {
      this.onStateChange({ ...this.state });
    }
  }
  
  private log(...args: any[]): void {
    if (this.config.debug) {
      console.log('[WSBridge]', ...args);
    }
  }
}

/**
 * Create a new WebSocket Video Bridge instance
 */
export function createWebSocketVideoBridge(
  config: Partial<WebSocketBridgeConfig> = {}
): WebSocketVideoBridge {
  return new WebSocketVideoBridge(config);
}
