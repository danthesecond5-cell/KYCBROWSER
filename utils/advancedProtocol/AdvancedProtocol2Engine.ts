/**
 * Advanced Protocol 2 Engine
 * 
 * Master orchestrator that ties together all components of the
 * Advanced Protocol 2 system:
 * - Video Source Pipeline (multi-source hot-switching)
 * - WebRTC Local Relay (virtual TURN/ICE)
 * - GPU Processing (shader-based video effects)
 * - Adaptive Stream Intelligence (site-specific optimization)
 * - Cross-Device Streaming (live relay from secondary devices)
 * - Cryptographic Validation (frame signing and tamper detection)
 */

import {
  AdvancedProtocol2Config,
  AdvancedProtocol2State,
  VideoSourceType,
  VideoSourceConfig,
  DEFAULT_ADVANCED_PROTOCOL2_CONFIG,
  DEFAULT_VIDEO_SOURCE_CONFIG,
  DEFAULT_VIDEO_SOURCE_HEALTH,
  Resolution,
} from '@/types/advancedProtocol';

import { VideoSourcePipeline, VideoSourceInstance, createVideoSource } from './VideoSourcePipeline';
import { WebRTCRelay } from './WebRTCRelay';
import { GPUProcessor } from './GPUProcessor';
import { AdaptiveStreamIntelligence } from './AdaptiveStreamIntelligence';
import { CrossDeviceStreamingManager } from './CrossDeviceStreaming';
import { CryptoValidator } from './CryptoValidator';

// ============================================================================
// TYPES
// ============================================================================

interface EngineCallbacks {
  onStateChange?: (state: AdvancedProtocol2State) => void;
  onError?: (error: Error, component: string) => void;
  onStreamReady?: (stream: MediaStream) => void;
  onThreatDetected?: (threat: unknown) => void;
  onMetricsUpdate?: (metrics: AdvancedProtocol2State['metrics']) => void;
}

interface StreamConfiguration {
  resolution: Resolution;
  frameRate: number;
  enableGpu: boolean;
  enableWebRTC: boolean;
  enableASI: boolean;
  enableCrypto: boolean;
}

// ============================================================================
// ADVANCED PROTOCOL 2 ENGINE
// ============================================================================

export class AdvancedProtocol2Engine {
  private config: AdvancedProtocol2Config;
  private state: AdvancedProtocol2State;
  private callbacks: EngineCallbacks = {};
  
  // Components
  private pipeline: VideoSourcePipeline;
  private webrtcRelay: WebRTCRelay;
  private gpuProcessor: GPUProcessor;
  private asi: AdaptiveStreamIntelligence;
  private crossDevice: CrossDeviceStreamingManager;
  private crypto: CryptoValidator;
  
  // State management
  private isInitialized: boolean = false;
  private isRunning: boolean = false;
  private outputStream: MediaStream | null = null;
  private metricsInterval?: NodeJS.Timeout;
  private startTime: number = 0;
  private frameCount: number = 0;
  private fpsHistory: number[] = [];
  private lastFrameTime: number = 0;

  constructor(config: Partial<AdvancedProtocol2Config> = {}) {
    this.config = this.mergeConfig(DEFAULT_ADVANCED_PROTOCOL2_CONFIG, config);
    this.state = this.createInitialState();
    
    // Initialize components
    this.pipeline = new VideoSourcePipeline(this.config.pipeline);
    this.webrtcRelay = new WebRTCRelay(this.config.webrtc);
    this.gpuProcessor = new GPUProcessor(this.config.gpu);
    this.asi = new AdaptiveStreamIntelligence(this.config.asi);
    this.crossDevice = new CrossDeviceStreamingManager(this.config.crossDevice);
    this.crypto = new CryptoValidator(this.config.crypto);
  }

  private mergeConfig(
    defaults: AdvancedProtocol2Config,
    overrides: Partial<AdvancedProtocol2Config>
  ): AdvancedProtocol2Config {
    return {
      ...defaults,
      ...overrides,
      pipeline: { ...defaults.pipeline, ...overrides.pipeline },
      webrtc: { ...defaults.webrtc, ...overrides.webrtc },
      gpu: { ...defaults.gpu, ...overrides.gpu },
      asi: { ...defaults.asi, ...overrides.asi },
      crossDevice: { ...defaults.crossDevice, ...overrides.crossDevice },
      crypto: { ...defaults.crypto, ...overrides.crypto },
      global: { ...defaults.global, ...overrides.global },
    };
  }

  private createInitialState(): AdvancedProtocol2State {
    return {
      isInitialized: false,
      isActive: false,
      startTime: 0,
      pipeline: {
        activeSourceId: null,
        pendingSourceId: null,
        isTransitioning: false,
        transitionProgress: 0,
        lastSwitchTime: 0,
        switchCount: 0,
        totalFramesProcessed: 0,
      },
      webrtc: {
        isActive: false,
        signalingConnected: false,
        peerConnectionState: 'not_initialized',
        iceGatheringState: 'not_initialized',
        localCandidates: 0,
        remoteCandidates: 0,
        activeStreams: 0,
        bytesReceived: 0,
        bytesSent: 0,
      },
      gpu: {
        backend: 'not_initialized',
        isInitialized: false,
        texturesAllocated: 0,
        vramUsageEstimate: 0,
        averageProcessingTimeMs: 0,
        framesProcessed: 0,
        shadersCompiled: 0,
      },
      asi: {
        isActive: false,
        currentSiteProfile: null,
        detectedThreats: [],
        adaptationsApplied: [],
        mlModelLoaded: false,
        lastInferenceTime: 0,
        inferenceCount: 0,
      },
      crossDevice: {
        isScanning: false,
        discoveredDevices: [],
        connectedDevices: [],
        activeStreamDevice: null,
        totalBytesReceived: 0,
        averageLatencyMs: 0,
      },
      crypto: {
        isInitialized: false,
        currentKeyId: '',
        keyRotationCount: 0,
        framesValidated: 0,
        framesFailed: 0,
        lastValidationTime: 0,
        tampersDetected: 0,
      },
      metrics: {
        totalUptime: 0,
        totalFramesInjected: 0,
        averageFps: 0,
        peakFps: 0,
        averageLatencyMs: 0,
        peakLatencyMs: 0,
        memoryUsageMb: 0,
        cpuUsagePercent: 0,
        errorsCount: 0,
        recoveryCount: 0,
      },
    };
  }

  /**
   * Initialize the engine
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.warn('[AdvancedProtocol2] Already initialized');
      return;
    }
    
    console.log('[AdvancedProtocol2] Initializing Advanced Protocol 2 Engine...');
    this.startTime = Date.now();
    this.state.startTime = this.startTime;
    
    try {
      // Initialize pipeline
      await this.pipeline.initialize();
      console.log('[AdvancedProtocol2] Pipeline initialized');
      
      // Initialize GPU processor
      const resolution = this.config.pipeline.sources[0]?.config?.preferredResolution || 
                         { width: 1080, height: 1920 };
      await this.gpuProcessor.initialize(resolution.width, resolution.height);
      this.state.gpu = this.gpuProcessor.getState();
      console.log('[AdvancedProtocol2] GPU processor initialized');
      
      // Initialize WebRTC relay
      await this.webrtcRelay.initialize();
      this.state.webrtc = this.webrtcRelay.getState();
      console.log('[AdvancedProtocol2] WebRTC relay initialized');
      
      // Initialize ASI
      await this.asi.initialize();
      this.state.asi = this.asi.getState();
      console.log('[AdvancedProtocol2] ASI initialized');
      
      // Initialize cross-device streaming
      await this.crossDevice.initialize();
      this.state.crossDevice = this.crossDevice.getState();
      console.log('[AdvancedProtocol2] Cross-device streaming initialized');
      
      // Initialize crypto validator
      await this.crypto.initialize();
      this.state.crypto = this.crypto.getState();
      console.log('[AdvancedProtocol2] Crypto validator initialized');
      
      // Set up event handlers
      this.setupEventHandlers();
      
      // Start metrics collection
      this.startMetricsCollection();
      
      this.isInitialized = true;
      this.state.isInitialized = true;
      
      console.log('[AdvancedProtocol2] Engine initialized successfully');
      this.emitStateChange();
      
    } catch (error) {
      console.error('[AdvancedProtocol2] Initialization failed:', error);
      this.emitError(error instanceof Error ? error : new Error(String(error)), 'initialization');
      throw error;
    }
  }

  private setupEventHandlers(): void {
    // Pipeline events
    this.pipeline.on('source_change', (event) => {
      this.state.pipeline = this.pipeline.getState();
      this.emitStateChange();
    });
    
    this.pipeline.on('health_warning', (event) => {
      console.warn('[AdvancedProtocol2] Pipeline health warning:', event.details);
    });
    
    this.pipeline.on('error', (event) => {
      this.state.metrics.errorsCount++;
      this.emitError(new Error(String(event.details)), 'pipeline');
    });
    
    // Cross-device stream events
    this.crossDevice.onStream((stream) => {
      console.log('[AdvancedProtocol2] Cross-device stream received');
      this.addLiveDeviceSource(stream);
    });
    
    // ASI threat detection
    // Note: ASI doesn't have event emitters in current implementation
    // Would add: this.asi.onThreat((threat) => { ... });
    
    // Crypto tamper detection
    this.crypto.onTamper((event) => {
      console.warn('[AdvancedProtocol2] Tamper detected:', event);
      this.state.metrics.errorsCount++;
      
      if (this.callbacks.onThreatDetected) {
        this.callbacks.onThreatDetected(event);
      }
    });
  }

  private startMetricsCollection(): void {
    this.metricsInterval = setInterval(() => {
      this.updateMetrics();
    }, this.config.global.metricsCollectionIntervalMs);
  }

  private updateMetrics(): void {
    const now = Date.now();
    
    // Update uptime
    this.state.metrics.totalUptime = now - this.startTime;
    
    // Update FPS
    if (this.fpsHistory.length > 0) {
      this.state.metrics.averageFps = 
        this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length;
      this.state.metrics.peakFps = Math.max(...this.fpsHistory);
    }
    
    // Update component states
    this.state.pipeline = this.pipeline.getState();
    this.state.gpu = this.gpuProcessor.getState();
    this.state.webrtc = this.webrtcRelay.getState();
    this.state.asi = this.asi.getState();
    this.state.crossDevice = this.crossDevice.getState();
    this.state.crypto = this.crypto.getState();
    
    // Memory estimate
    if (typeof performance !== 'undefined' && (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory) {
      this.state.metrics.memoryUsageMb = 
        ((performance as unknown as { memory: { usedJSHeapSize: number } }).memory.usedJSHeapSize / (1024 * 1024));
    }
    
    // Emit metrics update
    if (this.callbacks.onMetricsUpdate) {
      this.callbacks.onMetricsUpdate(this.state.metrics);
    }
  }

  /**
   * Add a local video source
   */
  async addLocalVideoSource(
    uri: string,
    config: Partial<VideoSourceConfig> = {},
    metadata: { name?: string; description?: string } = {}
  ): Promise<string> {
    console.log('[AdvancedProtocol2] Adding local video source:', uri.substring(0, 50));
    
    // Get recommended config from ASI
    const asiConfig = this.asi.getRecommendedConfig();
    const mergedConfig = { ...DEFAULT_VIDEO_SOURCE_CONFIG, ...asiConfig, ...config };
    
    const source = createVideoSource('local_file', mergedConfig, metadata);
    await source.initialize(uri);
    await this.pipeline.addSource(source);
    
    return source.id;
  }

  /**
   * Add a live device source (from cross-device streaming)
   */
  private async addLiveDeviceSource(stream: MediaStream): Promise<string> {
    console.log('[AdvancedProtocol2] Adding live device source');
    
    const source = createVideoSource('live_device', {
      ...DEFAULT_VIDEO_SOURCE_CONFIG,
      preferredFrameRate: 30,
    }, {
      name: 'Live Device Stream',
      description: 'Real-time stream from paired device',
    });
    
    // Source will receive frames from the stream
    // This requires additional handling to convert MediaStream to frame data
    await this.pipeline.addSource(source);
    
    return source.id;
  }

  /**
   * Add a synthetic (generated) source
   */
  async addSyntheticSource(): Promise<string> {
    console.log('[AdvancedProtocol2] Adding synthetic source');
    
    const source = createVideoSource('synthetic', {
      ...DEFAULT_VIDEO_SOURCE_CONFIG,
      preferredResolution: { width: 1080, height: 1920 },
    }, {
      name: 'Synthetic Green Screen',
      description: 'Dynamically generated green screen pattern',
    });
    
    await source.initialize('synthetic://green-screen');
    await this.pipeline.addSource(source);
    
    return source.id;
  }

  /**
   * Connect to a secondary device for live streaming
   */
  async connectToDevice(address: string, port: number = 8765): Promise<boolean> {
    console.log('[AdvancedProtocol2] Connecting to device:', address);
    return this.crossDevice.connectToDevice(address, port);
  }

  /**
   * Start the injection
   */
  async start(url?: string): Promise<MediaStream | null> {
    if (!this.isInitialized) {
      throw new Error('Engine not initialized');
    }
    
    if (this.isRunning) {
      console.warn('[AdvancedProtocol2] Already running');
      return this.outputStream;
    }
    
    console.log('[AdvancedProtocol2] Starting injection...');
    
    // Start ASI analysis if URL provided
    if (url) {
      this.asi.startSiteAnalysis(url);
    }
    
    // Create output stream from pipeline
    this.outputStream = await this.createOutputStream();
    
    if (this.outputStream) {
      // Set injected stream for WebRTC relay
      this.webrtcRelay.setInjectedStream(this.outputStream);
      
      this.isRunning = true;
      this.state.isActive = true;
      
      if (this.callbacks.onStreamReady) {
        this.callbacks.onStreamReady(this.outputStream);
      }
      
      console.log('[AdvancedProtocol2] Injection started');
      this.emitStateChange();
    }
    
    return this.outputStream;
  }

  /**
   * Create the output MediaStream
   */
  private async createOutputStream(): Promise<MediaStream | null> {
    const canvas = this.pipeline.getActiveCanvas();
    if (!canvas) {
      console.error('[AdvancedProtocol2] No active canvas');
      return null;
    }
    
    // Capture stream from canvas
    const captureStream = (canvas as HTMLCanvasElement).captureStream?.(30);
    if (!captureStream) {
      console.error('[AdvancedProtocol2] captureStream not supported');
      return null;
    }
    
    return captureStream;
  }

  /**
   * Stop the injection
   */
  stop(): void {
    if (!this.isRunning) return;
    
    console.log('[AdvancedProtocol2] Stopping injection...');
    
    // Stop ASI analysis
    this.asi.stopSiteAnalysis();
    
    // Stop output stream tracks
    if (this.outputStream) {
      this.outputStream.getTracks().forEach(track => track.stop());
      this.outputStream = null;
    }
    
    this.isRunning = false;
    this.state.isActive = false;
    
    console.log('[AdvancedProtocol2] Injection stopped');
    this.emitStateChange();
  }

  /**
   * Get current configuration
   */
  getConfig(): AdvancedProtocol2Config {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<AdvancedProtocol2Config>): void {
    this.config = this.mergeConfig(this.config, config);
    
    // Apply configuration changes to components
    if (config.gpu) {
      if (config.gpu.qualityPreset) {
        this.gpuProcessor.setQualityPreset(config.gpu.qualityPreset);
      }
      if (config.gpu.shaders) {
        this.gpuProcessor.updateShaderConfig(config.gpu.shaders);
      }
    }
    
    console.log('[AdvancedProtocol2] Configuration updated');
  }

  /**
   * Get current state
   */
  getState(): AdvancedProtocol2State {
    return { ...this.state };
  }

  /**
   * Get the output stream
   */
  getOutputStream(): MediaStream | null {
    return this.outputStream;
  }

  /**
   * Register callbacks
   */
  on<K extends keyof EngineCallbacks>(
    event: K,
    callback: NonNullable<EngineCallbacks[K]>
  ): void {
    this.callbacks[event] = callback as EngineCallbacks[K];
  }

  private emitStateChange(): void {
    if (this.callbacks.onStateChange) {
      this.callbacks.onStateChange(this.state);
    }
  }

  private emitError(error: Error, component: string): void {
    if (this.callbacks.onError) {
      this.callbacks.onError(error, component);
    }
  }

  /**
   * Get metrics
   */
  getMetrics(): AdvancedProtocol2State['metrics'] {
    return { ...this.state.metrics };
  }

  /**
   * Get ASI site profiles
   */
  getSiteProfiles(): unknown[] {
    return this.asi.getAllProfiles();
  }

  /**
   * Get detected threats
   */
  getDetectedThreats(): unknown[] {
    return this.asi.getActiveThreats();
  }

  /**
   * Get discovered devices
   */
  getDiscoveredDevices(): unknown[] {
    return this.crossDevice.getDiscoveredDevices();
  }

  /**
   * Get connected devices
   */
  getConnectedDevices(): unknown[] {
    return this.crossDevice.getConnectedDevices();
  }

  /**
   * Generate pairing QR code data
   */
  generatePairingData(): string {
    return this.crossDevice.generatePairingData();
  }

  /**
   * Cleanup and destroy
   */
  destroy(): void {
    console.log('[AdvancedProtocol2] Destroying engine...');
    
    this.stop();
    
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }
    
    // Destroy all components
    this.pipeline.destroy();
    this.webrtcRelay.destroy();
    this.gpuProcessor.destroy();
    this.asi.destroy();
    this.crossDevice.destroy();
    this.crypto.destroy();
    
    this.isInitialized = false;
    this.state = this.createInitialState();
    
    console.log('[AdvancedProtocol2] Engine destroyed');
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let engineInstance: AdvancedProtocol2Engine | null = null;

export function getAdvancedProtocol2Engine(): AdvancedProtocol2Engine {
  if (!engineInstance) {
    engineInstance = new AdvancedProtocol2Engine();
  }
  return engineInstance;
}

export function destroyAdvancedProtocol2Engine(): void {
  if (engineInstance) {
    engineInstance.destroy();
    engineInstance = null;
  }
}
