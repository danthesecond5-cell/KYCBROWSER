/**
 * Advanced Protocol 2: Hybrid WebRTC Local Relay + Adaptive Stream Intelligence
 * 
 * This is the most technically advanced video injection system, featuring:
 * - Multi-source video pipeline with hot-switching
 * - WebRTC local relay with virtual TURN emulation
 * - GPU-accelerated video processing
 * - Adaptive Stream Intelligence (ASI) for site-specific optimization
 * - Cross-device live streaming support
 * - Cryptographic stream validation
 */

// ============================================================================
// LAYER 1: VIDEO SOURCE TYPES
// ============================================================================

export type VideoSourceType = 
  | 'local_file'      // Pre-recorded video from device storage
  | 'live_device'     // Live stream from another device
  | 'rtsp_stream'     // RTSP/RTMP stream from IP cameras/OBS
  | 'synthetic'       // Dynamically generated via WebGL
  | 'canvas_fallback'; // Ultimate fallback - canvas pattern

export type VideoSourceStatus = 
  | 'idle'
  | 'connecting'
  | 'buffering'
  | 'active'
  | 'error'
  | 'disconnected';

export interface VideoSourceHealth {
  fps: number;
  bitrate: number;
  droppedFrames: number;
  latencyMs: number;
  bufferHealth: number; // 0-1
  lastFrameTime: number;
  errorCount: number;
}

export interface VideoSource {
  id: string;
  type: VideoSourceType;
  priority: number; // Lower = higher priority
  status: VideoSourceStatus;
  health: VideoSourceHealth;
  uri?: string;
  config: VideoSourceConfig;
  metadata: VideoSourceMetadata;
}

export interface VideoSourceConfig {
  // Connection settings
  connectionTimeout: number;
  reconnectAttempts: number;
  reconnectDelay: number;
  
  // Quality settings
  preferredResolution: Resolution;
  preferredFrameRate: number;
  maxBitrate: number;
  
  // Processing settings
  enableGpuAcceleration: boolean;
  colorSpaceConversion: 'none' | 'bt601' | 'bt709' | 'srgb';
  noiseInjection: boolean;
  noiseIntensity: number;
}

export interface VideoSourceMetadata {
  name: string;
  description?: string;
  createdAt: string;
  lastUsedAt?: string;
  totalPlayTime: number;
  successRate: number;
}

export interface Resolution {
  width: number;
  height: number;
}

// ============================================================================
// LAYER 2: VIDEO PIPELINE TYPES
// ============================================================================

export interface VideoPipelineConfig {
  sources: VideoSource[];
  hotSwitchThresholdMs: number; // Max time to switch sources
  healthCheckIntervalMs: number;
  minAcceptableFps: number;
  enableParallelDecoding: boolean;
  maxBufferedFrames: number;
}

export interface VideoPipelineState {
  activeSourceId: string | null;
  pendingSourceId: string | null;
  isTransitioning: boolean;
  transitionProgress: number;
  lastSwitchTime: number;
  switchCount: number;
  totalFramesProcessed: number;
}

export interface PipelineEvent {
  type: 'source_change' | 'health_warning' | 'error' | 'recovery' | 'transition_start' | 'transition_complete';
  timestamp: number;
  sourceId?: string;
  details: Record<string, unknown>;
}

// ============================================================================
// LAYER 3: WEBRTC RELAY TYPES
// ============================================================================

export interface WebRTCRelayConfig {
  enabled: boolean;
  signalingMode: 'local' | 'remote' | 'hybrid';
  localSignalingPort: number;
  
  // ICE configuration
  iceTransportPolicy: 'all' | 'relay';
  virtualTurnEnabled: boolean;
  virtualTurnCredentials: {
    username: string;
    credential: string;
  };
  
  // SDP manipulation
  sdpManipulation: {
    enabled: boolean;
    forceCodec?: 'vp8' | 'vp9' | 'h264' | 'av1';
    forceBitrate?: number;
    injectCustomSdp: boolean;
  };
  
  // Stealth settings
  stealth: {
    randomizeIceCandidates: boolean;
    spoofNetworkType: 'wifi' | 'cellular' | 'ethernet';
    addRealisticLatency: boolean;
    latencyRangeMs: [number, number];
  };
}

export interface WebRTCRelayState {
  isActive: boolean;
  signalingConnected: boolean;
  peerConnectionState: RTCPeerConnectionState | 'not_initialized';
  iceGatheringState: RTCIceGatheringState | 'not_initialized';
  localCandidates: number;
  remoteCandidates: number;
  activeStreams: number;
  bytesReceived: number;
  bytesSent: number;
}

export interface VirtualIceCandidate {
  candidate: string;
  sdpMid: string;
  sdpMLineIndex: number;
  foundation: string;
  priority: number;
  address: string;
  port: number;
  type: 'host' | 'srflx' | 'prflx' | 'relay';
  protocol: 'udp' | 'tcp';
}

// ============================================================================
// LAYER 4: GPU PROCESSING TYPES
// ============================================================================

export interface GPUProcessingConfig {
  enabled: boolean;
  preferredBackend: 'webgl2' | 'webgl' | 'software';
  
  // Shader pipeline
  shaders: {
    colorCorrection: boolean;
    noiseInjection: boolean;
    filmGrain: boolean;
    chromaticAberration: boolean;
    vignetteEffect: boolean;
    lenDistortion: boolean;
  };
  
  // Performance settings
  texturePoolSize: number;
  maxConcurrentFrames: number;
  useOffscreenCanvas: boolean;
  enableZeroCopy: boolean;
  
  // Quality vs Performance
  qualityPreset: 'ultra' | 'high' | 'medium' | 'low' | 'potato';
  dynamicQualityAdjustment: boolean;
}

export interface GPUProcessingState {
  backend: string;
  isInitialized: boolean;
  texturesAllocated: number;
  vramUsageEstimate: number;
  averageProcessingTimeMs: number;
  framesProcessed: number;
  shadersCompiled: number;
}

export interface ShaderUniform {
  name: string;
  type: 'float' | 'vec2' | 'vec3' | 'vec4' | 'mat4' | 'sampler2D';
  value: number | number[] | WebGLTexture;
}

// ============================================================================
// LAYER 5: ADAPTIVE STREAM INTELLIGENCE (ASI) TYPES
// ============================================================================

export interface ASIConfig {
  enabled: boolean;
  
  // Site fingerprinting
  siteFingerprinting: {
    enabled: boolean;
    analyzeGetUserMediaCalls: boolean;
    analyzeEnumerateDevices: boolean;
    detectResolutionPreferences: boolean;
    detectFrameRateRequirements: boolean;
    detectCodecPreferences: boolean;
  };
  
  // Dynamic adaptation
  adaptation: {
    autoResolutionMatching: boolean;
    autoFrameRateMatching: boolean;
    autoColorSpaceMatching: boolean;
    antiDetectionMeasures: boolean;
  };
  
  // Machine learning
  ml: {
    enabled: boolean;
    modelType: 'tflite' | 'tfjs' | 'onnx' | 'coreml';
    modelPath?: string;
    inferenceIntervalMs: number;
    confidenceThreshold: number;
  };
  
  // Learning
  learning: {
    enabled: boolean;
    storeHistory: boolean;
    maxHistoryEntries: number;
    shareAnonymousStats: boolean;
  };
}

export interface SiteProfile {
  domain: string;
  hash: string;
  
  // Detected preferences
  preferredResolutions: Resolution[];
  preferredFrameRates: number[];
  preferredCodecs: string[];
  usesWebRTC: boolean;
  usesCanvas: boolean;
  detectsVirtualCamera: boolean;
  
  // Behavioral patterns
  getUserMediaCallPattern: {
    frequency: number;
    constraints: Record<string, unknown>[];
    timing: number[];
  };
  
  // Recommended settings
  recommendedConfig: Partial<VideoSourceConfig>;
  
  // Metadata
  firstSeen: string;
  lastSeen: string;
  visitCount: number;
  successRate: number;
  notes?: string;
}

export interface ASIState {
  isActive: boolean;
  currentSiteProfile: SiteProfile | null;
  detectedThreats: ASIThreat[];
  adaptationsApplied: ASIAdaptation[];
  mlModelLoaded: boolean;
  lastInferenceTime: number;
  inferenceCount: number;
}

export interface ASIThreat {
  id: string;
  type: 'fingerprint_detection' | 'canvas_analysis' | 'timing_attack' | 'webrtc_leak' | 'resolution_mismatch' | 'fps_anomaly';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  detectedAt: number;
  mitigated: boolean;
  mitigation?: string;
}

export interface ASIAdaptation {
  id: string;
  type: 'resolution' | 'framerate' | 'colorspace' | 'noise' | 'timing' | 'metadata';
  originalValue: unknown;
  adaptedValue: unknown;
  reason: string;
  appliedAt: number;
  confidence: number;
}

// ============================================================================
// LAYER 6: CROSS-DEVICE STREAMING TYPES
// ============================================================================

export interface CrossDeviceConfig {
  enabled: boolean;
  
  // Discovery
  discovery: {
    method: 'mdns' | 'manual' | 'qr' | 'bluetooth';
    mdnsServiceName: string;
    scanIntervalMs: number;
    scanTimeoutMs: number;
  };
  
  // Connection
  connection: {
    preferredProtocol: 'webrtc' | 'websocket' | 'http';
    encryption: 'none' | 'dtls' | 'tls';
    authMethod: 'pin' | 'qr' | 'certificate';
  };
  
  // Streaming
  streaming: {
    targetLatencyMs: number;
    maxLatencyMs: number;
    adaptiveBitrate: boolean;
    minBitrate: number;
    maxBitrate: number;
  };
  
  // Reliability
  reliability: {
    autoReconnect: boolean;
    reconnectAttempts: number;
    reconnectDelayMs: number;
    heartbeatIntervalMs: number;
    timeoutMs: number;
  };
}

export interface PeerDevice {
  id: string;
  name: string;
  type: 'ios' | 'android' | 'web' | 'desktop';
  address: string;
  port: number;
  capabilities: PeerCapabilities;
  status: PeerStatus;
  lastSeen: number;
  latencyMs: number;
  signalStrength?: number;
}

export interface PeerCapabilities {
  maxResolution: Resolution;
  maxFrameRate: number;
  supportedCodecs: string[];
  hasCamera: boolean;
  hasMicrophone: boolean;
  supportsScreenShare: boolean;
}

export type PeerStatus = 
  | 'discovered'
  | 'connecting'
  | 'authenticating'
  | 'connected'
  | 'streaming'
  | 'paused'
  | 'disconnected'
  | 'error';

export interface CrossDeviceState {
  isScanning: boolean;
  discoveredDevices: PeerDevice[];
  connectedDevices: PeerDevice[];
  activeStreamDevice: string | null;
  totalBytesReceived: number;
  averageLatencyMs: number;
}

// ============================================================================
// LAYER 7: CRYPTOGRAPHIC VALIDATION TYPES
// ============================================================================

export interface CryptoConfig {
  enabled: boolean;
  
  // Frame signing
  frameSigning: {
    enabled: boolean;
    algorithm: 'hmac-sha256' | 'hmac-sha512' | 'ed25519';
    keyRotationIntervalMs: number;
  };
  
  // Stream integrity
  streamIntegrity: {
    enabled: boolean;
    sequenceValidation: boolean;
    timestampValidation: boolean;
    maxClockSkewMs: number;
  };
  
  // Origin validation
  originValidation: {
    enabled: boolean;
    trustedOrigins: string[];
    validateCertificates: boolean;
  };
  
  // Tamper detection
  tamperDetection: {
    enabled: boolean;
    sensitivity: 'low' | 'medium' | 'high';
    alertOnDetection: boolean;
    blockOnDetection: boolean;
  };
}

export interface CryptoState {
  isInitialized: boolean;
  currentKeyId: string;
  keyRotationCount: number;
  framesValidated: number;
  framesFailed: number;
  lastValidationTime: number;
  tampersDetected: number;
  lastTamperTime?: number;
}

export interface FrameSignature {
  frameId: number;
  timestamp: number;
  signature: string;
  keyId: string;
  sourceId: string;
}

// ============================================================================
// MASTER PROTOCOL 2 CONFIGURATION
// ============================================================================

export interface AdvancedProtocol2Config {
  id: 'advanced_relay';
  name: string;
  version: string;
  enabled: boolean;
  
  // Layer configurations
  pipeline: VideoPipelineConfig;
  webrtc: WebRTCRelayConfig;
  gpu: GPUProcessingConfig;
  asi: ASIConfig;
  crossDevice: CrossDeviceConfig;
  crypto: CryptoConfig;
  
  // Global settings
  global: {
    debugMode: boolean;
    verboseLogging: boolean;
    performanceMonitoring: boolean;
    metricsCollectionIntervalMs: number;
    maxMemoryUsageMb: number;
    batteryOptimization: boolean;
  };
}

export interface AdvancedProtocol2State {
  isInitialized: boolean;
  isActive: boolean;
  startTime: number;
  
  // Layer states
  pipeline: VideoPipelineState;
  webrtc: WebRTCRelayState;
  gpu: GPUProcessingState;
  asi: ASIState;
  crossDevice: CrossDeviceState;
  crypto: CryptoState;
  
  // Global metrics
  metrics: {
    totalUptime: number;
    totalFramesInjected: number;
    averageFps: number;
    peakFps: number;
    averageLatencyMs: number;
    peakLatencyMs: number;
    memoryUsageMb: number;
    cpuUsagePercent: number;
    errorsCount: number;
    recoveryCount: number;
  };
}

// ============================================================================
// DEFAULT CONFIGURATIONS
// ============================================================================

export const DEFAULT_VIDEO_SOURCE_CONFIG: VideoSourceConfig = {
  connectionTimeout: 10000,
  reconnectAttempts: 3,
  reconnectDelay: 1000,
  preferredResolution: { width: 1080, height: 1920 },
  preferredFrameRate: 30,
  maxBitrate: 5000000,
  enableGpuAcceleration: true,
  colorSpaceConversion: 'bt709',
  noiseInjection: true,
  noiseIntensity: 0.02,
};

export const DEFAULT_VIDEO_SOURCE_HEALTH: VideoSourceHealth = {
  fps: 0,
  bitrate: 0,
  droppedFrames: 0,
  latencyMs: 0,
  bufferHealth: 0,
  lastFrameTime: 0,
  errorCount: 0,
};

export const DEFAULT_PIPELINE_CONFIG: VideoPipelineConfig = {
  sources: [],
  hotSwitchThresholdMs: 50,
  healthCheckIntervalMs: 1000,
  minAcceptableFps: 15,
  enableParallelDecoding: true,
  maxBufferedFrames: 3,
};

export const DEFAULT_WEBRTC_RELAY_CONFIG: WebRTCRelayConfig = {
  enabled: true,
  signalingMode: 'local',
  localSignalingPort: 8765,
  iceTransportPolicy: 'all',
  virtualTurnEnabled: true,
  virtualTurnCredentials: {
    username: 'relay',
    credential: 'secure_credential',
  },
  sdpManipulation: {
    enabled: true,
    forceCodec: 'h264',
    injectCustomSdp: true,
  },
  stealth: {
    randomizeIceCandidates: true,
    spoofNetworkType: 'wifi',
    addRealisticLatency: true,
    latencyRangeMs: [5, 25],
  },
};

export const DEFAULT_GPU_CONFIG: GPUProcessingConfig = {
  enabled: true,
  preferredBackend: 'webgl2',
  shaders: {
    colorCorrection: true,
    noiseInjection: true,
    filmGrain: false,
    chromaticAberration: false,
    vignetteEffect: false,
    lenDistortion: false,
  },
  texturePoolSize: 4,
  maxConcurrentFrames: 2,
  useOffscreenCanvas: true,
  enableZeroCopy: true,
  qualityPreset: 'high',
  dynamicQualityAdjustment: true,
};

export const DEFAULT_ASI_CONFIG: ASIConfig = {
  enabled: true,
  siteFingerprinting: {
    enabled: true,
    analyzeGetUserMediaCalls: true,
    analyzeEnumerateDevices: true,
    detectResolutionPreferences: true,
    detectFrameRateRequirements: true,
    detectCodecPreferences: true,
  },
  adaptation: {
    autoResolutionMatching: true,
    autoFrameRateMatching: true,
    autoColorSpaceMatching: true,
    antiDetectionMeasures: true,
  },
  ml: {
    enabled: false, // Disabled by default, requires model
    modelType: 'tfjs',
    inferenceIntervalMs: 5000,
    confidenceThreshold: 0.7,
  },
  learning: {
    enabled: true,
    storeHistory: true,
    maxHistoryEntries: 100,
    shareAnonymousStats: false,
  },
};

export const DEFAULT_CROSS_DEVICE_CONFIG: CrossDeviceConfig = {
  enabled: true,
  discovery: {
    method: 'manual',
    mdnsServiceName: '_advrelay._tcp',
    scanIntervalMs: 5000,
    scanTimeoutMs: 10000,
  },
  connection: {
    preferredProtocol: 'webrtc',
    encryption: 'dtls',
    authMethod: 'qr',
  },
  streaming: {
    targetLatencyMs: 100,
    maxLatencyMs: 500,
    adaptiveBitrate: true,
    minBitrate: 500000,
    maxBitrate: 8000000,
  },
  reliability: {
    autoReconnect: true,
    reconnectAttempts: 5,
    reconnectDelayMs: 2000,
    heartbeatIntervalMs: 1000,
    timeoutMs: 5000,
  },
};

export const DEFAULT_CRYPTO_CONFIG: CryptoConfig = {
  enabled: true,
  frameSigning: {
    enabled: true,
    algorithm: 'hmac-sha256',
    keyRotationIntervalMs: 3600000, // 1 hour
  },
  streamIntegrity: {
    enabled: true,
    sequenceValidation: true,
    timestampValidation: true,
    maxClockSkewMs: 5000,
  },
  originValidation: {
    enabled: true,
    trustedOrigins: ['localhost', '127.0.0.1'],
    validateCertificates: false,
  },
  tamperDetection: {
    enabled: true,
    sensitivity: 'medium',
    alertOnDetection: true,
    blockOnDetection: false,
  },
};

export const DEFAULT_ADVANCED_PROTOCOL2_CONFIG: AdvancedProtocol2Config = {
  id: 'advanced_relay',
  name: 'Protocol 2: Advanced Relay',
  version: '1.0.0',
  enabled: true,
  pipeline: DEFAULT_PIPELINE_CONFIG,
  webrtc: DEFAULT_WEBRTC_RELAY_CONFIG,
  gpu: DEFAULT_GPU_CONFIG,
  asi: DEFAULT_ASI_CONFIG,
  crossDevice: DEFAULT_CROSS_DEVICE_CONFIG,
  crypto: DEFAULT_CRYPTO_CONFIG,
  global: {
    debugMode: false,
    verboseLogging: false,
    performanceMonitoring: true,
    metricsCollectionIntervalMs: 1000,
    maxMemoryUsageMb: 256,
    batteryOptimization: true,
  },
};
