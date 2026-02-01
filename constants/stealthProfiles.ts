export interface DeviceFingerprintProfile {
  navigator: {
    userAgent: string;
    platform: string;
    vendor: string;
    language: string;
    languages: string[];
    hardwareConcurrency: number;
    deviceMemory: number;
    maxTouchPoints: number;
  };
  screen: {
    width: number;
    height: number;
    availWidth: number;
    availHeight: number;
    colorDepth: number;
    pixelDepth: number;
    devicePixelRatio: number;
  };
  webgl: {
    vendor: string;
    renderer: string;
    version: string;
    shadingLanguageVersion: string;
    unmaskedVendor: string;
    unmaskedRenderer: string;
  };
  mediaCapabilities: {
    facingMode: 'user' | 'environment';
    frameRate: { min: number; max: number; ideal: number };
    width: { min: number; max: number; ideal: number };
    height: { min: number; max: number; ideal: number };
    aspectRatio: { min: number; max: number; ideal: number };
    resizeMode: string[];
    echoCancellation: boolean;
    autoGainControl: boolean;
    noiseSuppression: boolean;
    sampleRate: number;
    sampleSize: number;
    channelCount: number;
  };
  audio: {
    sampleRate: number;
    maxChannelCount: number;
    numberOfInputs: number;
    numberOfOutputs: number;
    channelCountMode: string;
    channelInterpretation: string;
  };
  battery: {
    charging: boolean;
    chargingTime: number;
    dischargingTime: number;
    level: number;
  };
  fonts: string[];
}

export const IPHONE_15_PRO_PROFILE: DeviceFingerprintProfile = {
  navigator: {
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
    platform: 'iPhone',
    vendor: 'Apple Computer, Inc.',
    language: 'en-US',
    languages: ['en-US', 'en'],
    hardwareConcurrency: 6,
    deviceMemory: 8,
    maxTouchPoints: 5,
  },
  screen: {
    width: 393,
    height: 852,
    availWidth: 393,
    availHeight: 852,
    colorDepth: 24,
    pixelDepth: 24,
    devicePixelRatio: 3,
  },
  webgl: {
    vendor: 'WebKit',
    renderer: 'WebKit WebGL',
    version: 'WebGL 2.0 (OpenGL ES 3.0)',
    shadingLanguageVersion: 'WebGL GLSL ES 3.00',
    unmaskedVendor: 'Apple Inc.',
    unmaskedRenderer: 'Apple GPU',
  },
  mediaCapabilities: {
    facingMode: 'user',
    frameRate: { min: 1, max: 60, ideal: 30 },
    width: { min: 1, max: 4032, ideal: 1080 },
    height: { min: 1, max: 3024, ideal: 1920 },
    aspectRatio: { min: 0.5, max: 2.0, ideal: 0.5625 },
    resizeMode: ['none', 'crop-and-scale'],
    echoCancellation: true,
    autoGainControl: true,
    noiseSuppression: true,
    sampleRate: 48000,
    sampleSize: 16,
    channelCount: 1,
  },
  audio: {
    sampleRate: 48000,
    maxChannelCount: 2,
    numberOfInputs: 1,
    numberOfOutputs: 1,
    channelCountMode: 'explicit',
    channelInterpretation: 'speakers',
  },
  battery: {
    charging: false,
    chargingTime: Infinity,
    dischargingTime: 28800,
    level: 0.85,
  },
  fonts: [
    'Arial',
    'Helvetica',
    'Helvetica Neue',
    'Times New Roman',
    'Georgia',
    'Verdana',
    'Courier New',
    'SF Pro Display',
    'SF Pro Text',
    'SF Mono',
  ],
};

export const IPHONE_14_PROFILE: DeviceFingerprintProfile = {
  navigator: {
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Mobile/15E148 Safari/604.1',
    platform: 'iPhone',
    vendor: 'Apple Computer, Inc.',
    language: 'en-US',
    languages: ['en-US', 'en'],
    hardwareConcurrency: 6,
    deviceMemory: 6,
    maxTouchPoints: 5,
  },
  screen: {
    width: 390,
    height: 844,
    availWidth: 390,
    availHeight: 844,
    colorDepth: 24,
    pixelDepth: 24,
    devicePixelRatio: 3,
  },
  webgl: {
    vendor: 'WebKit',
    renderer: 'WebKit WebGL',
    version: 'WebGL 2.0 (OpenGL ES 3.0)',
    shadingLanguageVersion: 'WebGL GLSL ES 3.00',
    unmaskedVendor: 'Apple Inc.',
    unmaskedRenderer: 'Apple GPU',
  },
  mediaCapabilities: {
    facingMode: 'user',
    frameRate: { min: 1, max: 60, ideal: 30 },
    width: { min: 1, max: 4032, ideal: 1080 },
    height: { min: 1, max: 3024, ideal: 1920 },
    aspectRatio: { min: 0.5, max: 2.0, ideal: 0.5625 },
    resizeMode: ['none', 'crop-and-scale'],
    echoCancellation: true,
    autoGainControl: true,
    noiseSuppression: true,
    sampleRate: 48000,
    sampleSize: 16,
    channelCount: 1,
  },
  audio: {
    sampleRate: 48000,
    maxChannelCount: 2,
    numberOfInputs: 1,
    numberOfOutputs: 1,
    channelCountMode: 'explicit',
    channelInterpretation: 'speakers',
  },
  battery: {
    charging: true,
    chargingTime: 3600,
    dischargingTime: Infinity,
    level: 0.72,
  },
  fonts: [
    'Arial',
    'Helvetica',
    'Helvetica Neue',
    'Times New Roman',
    'Georgia',
    'Verdana',
    'Courier New',
    'SF Pro Display',
    'SF Pro Text',
  ],
};

export interface VideoNaturalVariation {
  brightnessJitter: { min: number; max: number; frequency: number };
  colorTemperatureShift: { min: number; max: number; frequency: number };
  microShake: { amplitude: number; frequency: number };
  frameDropProbability: number;
  autoExposureDelay: number;
  autoFocusHuntProbability: number;
  sensorNoise: { intensity: number; grain: number };
  rollingShutterEffect: boolean;
  lensDistortion: { k1: number; k2: number };
}

export const NATURAL_CAMERA_VARIATIONS: VideoNaturalVariation = {
  brightnessJitter: { min: -0.02, max: 0.02, frequency: 0.3 },
  colorTemperatureShift: { min: -50, max: 50, frequency: 0.1 },
  microShake: { amplitude: 0.5, frequency: 2.0 },
  frameDropProbability: 0.001,
  autoExposureDelay: 150,
  autoFocusHuntProbability: 0.0005,
  sensorNoise: { intensity: 0.008, grain: 0.003 },
  rollingShutterEffect: false,
  lensDistortion: { k1: 0.0, k2: 0.0 },
};

export interface TimingProfile {
  getUserMediaDelay: { min: number; max: number };
  enumerateDevicesDelay: { min: number; max: number };
  trackStartDelay: { min: number; max: number };
  capabilitiesQueryDelay: { min: number; max: number };
  settingsQueryDelay: { min: number; max: number };
  frameIntervalJitter: number;
}

export const REALISTIC_TIMING: TimingProfile = {
  getUserMediaDelay: { min: 180, max: 450 },
  enumerateDevicesDelay: { min: 5, max: 25 },
  trackStartDelay: { min: 50, max: 150 },
  capabilitiesQueryDelay: { min: 1, max: 5 },
  settingsQueryDelay: { min: 1, max: 3 },
  frameIntervalJitter: 2.0,
};

export interface WebRTCStealthConfig {
  blockLocalIPs: boolean;
  spoofPublicIP: boolean;
  spoofedIP: string;
  disableSTUN: boolean;
  disableTURN: boolean;
  modifySDPFingerprint: boolean;
  randomizeCandidatePriority: boolean;
}

export const WEBRTC_STEALTH_CONFIG: WebRTCStealthConfig = {
  blockLocalIPs: true,
  spoofPublicIP: false,
  spoofedIP: '',
  disableSTUN: false,
  disableTURN: false,
  modifySDPFingerprint: true,
  randomizeCandidatePriority: true,
};

export interface CanvasStealthConfig {
  addNoise: boolean;
  noiseIntensity: number;
  modifyGetImageData: boolean;
  modifyToDataURL: boolean;
  modifyToBlob: boolean;
  consistentNoiseSeed: boolean;
}

export const CANVAS_STEALTH_CONFIG: CanvasStealthConfig = {
  addNoise: true,
  noiseIntensity: 0.005,
  modifyGetImageData: true,
  modifyToDataURL: true,
  modifyToBlob: true,
  consistentNoiseSeed: true,
};

export interface AudioStealthConfig {
  modifyAnalyserNode: boolean;
  modifyOscillator: boolean;
  addMicroVariations: boolean;
  spoofSampleRate: boolean;
  targetSampleRate: number;
}

export const AUDIO_STEALTH_CONFIG: AudioStealthConfig = {
  modifyAnalyserNode: true,
  modifyOscillator: true,
  addMicroVariations: true,
  spoofSampleRate: true,
  targetSampleRate: 48000,
};

export const STEALTH_DETECTION_CHECKS = [
  'webdriver',
  'selenium',
  'phantom',
  'nightmare',
  'puppeteer',
  'playwright',
  'cypress',
  'chromedriver',
  'automationProtocol',
  '__webdriver_script_fn',
  '__driver_evaluate',
  '__webdriver_evaluate',
  '__selenium_evaluate',
  '__fxdriver_evaluate',
  '__driver_unwrapped',
  '__webdriver_unwrapped',
  '__selenium_unwrapped',
  '__fxdriver_unwrapped',
  '_Selenium_IDE_Recorder',
  '_selenium',
  'calledSelenium',
  '$cdc_',
  '$chrome_',
  '__nightmare',
  '__puppeteer',
  'domAutomation',
  'domAutomationController',
];

export const PROPERTIES_TO_DELETE = [
  'cdc_adoQpoasnfa76pfcZLmcfl_Array',
  'cdc_adoQpoasnfa76pfcZLmcfl_Promise',
  'cdc_adoQpoasnfa76pfcZLmcfl_Symbol',
  'cdc_adoQpoasnfa76pfcZLmcfl_JSON',
  'cdc_adoQpoasnfa76pfcZLmcfl_Object',
  'cdc_adoQpoasnfa76pfcZLmcfl_Proxy',
  '__webdriver_script_fn',
  '__driver_evaluate',
  '__webdriver_evaluate',
  '__selenium_evaluate',
  '__fxdriver_evaluate',
  '__driver_unwrapped',
  '__webdriver_unwrapped',
  '__selenium_unwrapped',
  '__fxdriver_unwrapped',
  '_Selenium_IDE_Recorder',
  '_selenium',
  'calledSelenium',
];

export function getRandomDelay(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function addNaturalJitter(value: number, jitterPercent: number): number {
  const jitter = value * (jitterPercent / 100) * (Math.random() * 2 - 1);
  return value + jitter;
}

export function generateConsistentNoise(seed: number, x: number, y: number): number {
  const n = Math.sin(seed * 12.9898 + x * 78.233 + y * 43.1234) * 43758.5453;
  return n - Math.floor(n);
}

// ============================================================
// CLAUDE AI PROTOCOL - ADVANCED STEALTH CONFIGURATIONS
// The most advanced AI-designed stealth profiles
// ============================================================

/**
 * Claude Protocol Neural Fingerprint Configuration
 * Uses AI-inspired patterns to generate more realistic fingerprints
 */
export interface ClaudeNeuralFingerprintConfig {
  enabled: boolean;
  // Neural network-inspired noise generation
  layerDepth: number; // Number of processing layers
  activationFunction: 'sigmoid' | 'tanh' | 'relu' | 'swish';
  entropySource: 'time' | 'mouse' | 'scroll' | 'combined';
  // Fingerprint mutation
  mutationRate: number; // 0-1, how often fingerprint changes
  consistencyDuration: number; // ms to maintain same fingerprint
  // Anti-correlation
  correlationThreshold: number; // Minimum entropy between values
  crossDomainConsistency: boolean; // Same fingerprint across subdomains
}

export const CLAUDE_NEURAL_FINGERPRINT_CONFIG: ClaudeNeuralFingerprintConfig = {
  enabled: true,
  layerDepth: 3,
  activationFunction: 'swish',
  entropySource: 'combined',
  mutationRate: 0.02,
  consistencyDuration: 300000, // 5 minutes
  correlationThreshold: 0.7,
  crossDomainConsistency: true,
};

/**
 * Claude Protocol Adaptive Behavior Configuration
 * Learns and mimics natural user interaction patterns
 */
export interface ClaudeAdaptiveBehaviorConfig {
  enabled: boolean;
  // Timing patterns
  typingPatternLearning: boolean;
  mouseMovePatternLearning: boolean;
  scrollPatternLearning: boolean;
  // Response timing
  minResponseDelay: number; // ms
  maxResponseDelay: number; // ms
  jitterPercentage: number; // 0-100
  // Activity simulation
  idleActivityInjection: boolean;
  microMovementFrequency: number; // Hz
  // Anti-bot patterns
  humanlikePauseBehavior: boolean;
  readingSpeedSimulation: boolean;
}

export const CLAUDE_ADAPTIVE_BEHAVIOR_CONFIG: ClaudeAdaptiveBehaviorConfig = {
  enabled: true,
  typingPatternLearning: true,
  mouseMovePatternLearning: true,
  scrollPatternLearning: true,
  minResponseDelay: 50,
  maxResponseDelay: 300,
  jitterPercentage: 15,
  idleActivityInjection: true,
  microMovementFrequency: 0.5,
  humanlikePauseBehavior: true,
  readingSpeedSimulation: true,
};

/**
 * Claude Protocol Self-Healing Stream Configuration
 * Automatic recovery from stream failures
 */
export interface ClaudeSelfHealingConfig {
  enabled: boolean;
  // Health monitoring
  healthCheckIntervalMs: number;
  minAcceptableFps: number;
  qualityDegradationThreshold: number;
  // Recovery actions
  autoRestartOnFailure: boolean;
  maxRestartAttempts: number;
  restartBackoffMs: number;
  fallbackToCanvasPattern: boolean;
  // Stream quality
  qualityLevels: Array<{ name: string; scale: number; fps: number }>;
  autoQualityAdaptation: boolean;
  // Error handling
  silentErrorRecovery: boolean;
  notifyOnRecovery: boolean;
}

export const CLAUDE_SELF_HEALING_CONFIG: ClaudeSelfHealingConfig = {
  enabled: true,
  healthCheckIntervalMs: 2000,
  minAcceptableFps: 12,
  qualityDegradationThreshold: 0.7,
  autoRestartOnFailure: true,
  maxRestartAttempts: 5,
  restartBackoffMs: 500,
  fallbackToCanvasPattern: true,
  qualityLevels: [
    { name: 'ultra', scale: 1.0, fps: 60 },
    { name: 'high', scale: 1.0, fps: 30 },
    { name: 'medium', scale: 0.75, fps: 24 },
    { name: 'low', scale: 0.5, fps: 15 },
    { name: 'minimal', scale: 0.25, fps: 10 },
  ],
  autoQualityAdaptation: true,
  silentErrorRecovery: true,
  notifyOnRecovery: false,
};

/**
 * Claude Protocol Predictive Quality Configuration
 * ML-inspired quality prediction and adaptation
 */
export interface ClaudePredictiveQualityConfig {
  enabled: boolean;
  // Prediction model
  predictionWindowMs: number;
  sampleHistorySize: number;
  predictionAlgorithm: 'linear' | 'exponential' | 'adaptive';
  // Quality targets
  targetFps: number;
  targetLatencyMs: number;
  bufferTargetSeconds: number;
  // Adaptation
  adaptationSpeed: 'slow' | 'medium' | 'fast' | 'instant';
  overshootProtection: boolean;
  undershootRecovery: boolean;
}

export const CLAUDE_PREDICTIVE_QUALITY_CONFIG: ClaudePredictiveQualityConfig = {
  enabled: true,
  predictionWindowMs: 5000,
  sampleHistorySize: 120,
  predictionAlgorithm: 'adaptive',
  targetFps: 30,
  targetLatencyMs: 100,
  bufferTargetSeconds: 2,
  adaptationSpeed: 'fast',
  overshootProtection: true,
  undershootRecovery: true,
};

/**
 * Claude Protocol Anti-Detection Configuration
 * Maximum detection evasion capabilities
 */
export interface ClaudeAntiDetectionConfig {
  level: 'standard' | 'enhanced' | 'maximum' | 'paranoid';
  // Sandbox detection
  sandboxDetectionEvasion: boolean;
  vmDetectionEvasion: boolean;
  emulatorDetectionEvasion: boolean;
  // Headless browser detection
  headlessDetectionEvasion: boolean;
  puppeteerEvasion: boolean;
  playwrightEvasion: boolean;
  seleniumEvasion: boolean;
  // Advanced detection
  timeZoneConsistency: boolean;
  languageConsistency: boolean;
  pluginConsistency: boolean;
  mediaDevicesConsistency: boolean;
  // Fingerprint evasion
  canvasNoiseIntensity: number;
  webglNoiseIntensity: number;
  audioNoiseIntensity: number;
  fontListRandomization: boolean;
  // WebRTC protection
  webrtcLeakProtection: boolean;
  localIpMasking: boolean;
  stunServerFiltering: boolean;
}

export const CLAUDE_ANTI_DETECTION_CONFIGS: Record<ClaudeAntiDetectionConfig['level'], ClaudeAntiDetectionConfig> = {
  standard: {
    level: 'standard',
    sandboxDetectionEvasion: true,
    vmDetectionEvasion: false,
    emulatorDetectionEvasion: false,
    headlessDetectionEvasion: true,
    puppeteerEvasion: true,
    playwrightEvasion: true,
    seleniumEvasion: true,
    timeZoneConsistency: true,
    languageConsistency: true,
    pluginConsistency: false,
    mediaDevicesConsistency: true,
    canvasNoiseIntensity: 0.003,
    webglNoiseIntensity: 0.001,
    audioNoiseIntensity: 0.0001,
    fontListRandomization: false,
    webrtcLeakProtection: true,
    localIpMasking: true,
    stunServerFiltering: false,
  },
  enhanced: {
    level: 'enhanced',
    sandboxDetectionEvasion: true,
    vmDetectionEvasion: true,
    emulatorDetectionEvasion: true,
    headlessDetectionEvasion: true,
    puppeteerEvasion: true,
    playwrightEvasion: true,
    seleniumEvasion: true,
    timeZoneConsistency: true,
    languageConsistency: true,
    pluginConsistency: true,
    mediaDevicesConsistency: true,
    canvasNoiseIntensity: 0.005,
    webglNoiseIntensity: 0.002,
    audioNoiseIntensity: 0.0005,
    fontListRandomization: true,
    webrtcLeakProtection: true,
    localIpMasking: true,
    stunServerFiltering: true,
  },
  maximum: {
    level: 'maximum',
    sandboxDetectionEvasion: true,
    vmDetectionEvasion: true,
    emulatorDetectionEvasion: true,
    headlessDetectionEvasion: true,
    puppeteerEvasion: true,
    playwrightEvasion: true,
    seleniumEvasion: true,
    timeZoneConsistency: true,
    languageConsistency: true,
    pluginConsistency: true,
    mediaDevicesConsistency: true,
    canvasNoiseIntensity: 0.008,
    webglNoiseIntensity: 0.004,
    audioNoiseIntensity: 0.001,
    fontListRandomization: true,
    webrtcLeakProtection: true,
    localIpMasking: true,
    stunServerFiltering: true,
  },
  paranoid: {
    level: 'paranoid',
    sandboxDetectionEvasion: true,
    vmDetectionEvasion: true,
    emulatorDetectionEvasion: true,
    headlessDetectionEvasion: true,
    puppeteerEvasion: true,
    playwrightEvasion: true,
    seleniumEvasion: true,
    timeZoneConsistency: true,
    languageConsistency: true,
    pluginConsistency: true,
    mediaDevicesConsistency: true,
    canvasNoiseIntensity: 0.012,
    webglNoiseIntensity: 0.006,
    audioNoiseIntensity: 0.002,
    fontListRandomization: true,
    webrtcLeakProtection: true,
    localIpMasking: true,
    stunServerFiltering: true,
  },
};

/**
 * Claude Protocol Performance Optimization Configuration
 */
export interface ClaudePerformanceConfig {
  gpuAcceleration: boolean;
  webWorkerProcessing: boolean;
  offscreenCanvasSupport: boolean;
  requestIdleCallback: boolean;
  // Memory management
  aggressiveGarbageCollection: boolean;
  memoryPooling: boolean;
  streamRecycling: boolean;
  // Frame optimization
  intelligentFrameSkipping: boolean;
  frameInterpolation: boolean;
  adaptiveResolution: boolean;
  // Caching
  videoCacheEnabled: boolean;
  videoCacheMaxSize: number; // MB
  videoCacheTTL: number; // ms
}

export const CLAUDE_PERFORMANCE_CONFIG: ClaudePerformanceConfig = {
  gpuAcceleration: true,
  webWorkerProcessing: true,
  offscreenCanvasSupport: true,
  requestIdleCallback: true,
  aggressiveGarbageCollection: false,
  memoryPooling: true,
  streamRecycling: true,
  intelligentFrameSkipping: true,
  frameInterpolation: false,
  adaptiveResolution: true,
  videoCacheEnabled: true,
  videoCacheMaxSize: 100,
  videoCacheTTL: 600000, // 10 minutes
};

/**
 * Claude Protocol Failover Configuration
 * Multi-layer fallback system for maximum reliability
 */
export interface ClaudeFailoverConfig {
  enabled: boolean;
  // Failover layers
  layers: Array<{
    name: string;
    type: 'video' | 'canvas' | 'static' | 'placeholder';
    priority: number;
    maxRetries: number;
    timeoutMs: number;
  }>;
  // Failover behavior
  seamlessTransition: boolean;
  transitionDurationMs: number;
  preserveAspectRatio: boolean;
  // Monitoring
  failoverLogging: boolean;
  failoverMetrics: boolean;
}

export const CLAUDE_FAILOVER_CONFIG: ClaudeFailoverConfig = {
  enabled: true,
  layers: [
    { name: 'primary_video', type: 'video', priority: 1, maxRetries: 3, timeoutMs: 10000 },
    { name: 'fallback_video', type: 'video', priority: 2, maxRetries: 2, timeoutMs: 8000 },
    { name: 'green_screen', type: 'canvas', priority: 3, maxRetries: 1, timeoutMs: 1000 },
    { name: 'static_image', type: 'static', priority: 4, maxRetries: 1, timeoutMs: 500 },
    { name: 'placeholder', type: 'placeholder', priority: 5, maxRetries: 0, timeoutMs: 0 },
  ],
  seamlessTransition: true,
  transitionDurationMs: 150,
  preserveAspectRatio: true,
  failoverLogging: true,
  failoverMetrics: true,
};

// Claude Protocol complete configuration bundle
export interface ClaudeProtocolBundle {
  neuralFingerprint: ClaudeNeuralFingerprintConfig;
  adaptiveBehavior: ClaudeAdaptiveBehaviorConfig;
  selfHealing: ClaudeSelfHealingConfig;
  predictiveQuality: ClaudePredictiveQualityConfig;
  antiDetection: ClaudeAntiDetectionConfig;
  performance: ClaudePerformanceConfig;
  failover: ClaudeFailoverConfig;
}

export const DEFAULT_CLAUDE_PROTOCOL_BUNDLE: ClaudeProtocolBundle = {
  neuralFingerprint: CLAUDE_NEURAL_FINGERPRINT_CONFIG,
  adaptiveBehavior: CLAUDE_ADAPTIVE_BEHAVIOR_CONFIG,
  selfHealing: CLAUDE_SELF_HEALING_CONFIG,
  predictiveQuality: CLAUDE_PREDICTIVE_QUALITY_CONFIG,
  antiDetection: CLAUDE_ANTI_DETECTION_CONFIGS.maximum,
  performance: CLAUDE_PERFORMANCE_CONFIG,
  failover: CLAUDE_FAILOVER_CONFIG,
};

/**
 * Generate Claude neural noise - more sophisticated than standard noise
 * Uses a multi-layer approach inspired by neural network activations
 */
export function generateClaudeNeuralNoise(
  seed: number,
  x: number,
  y: number,
  config: ClaudeNeuralFingerprintConfig = CLAUDE_NEURAL_FINGERPRINT_CONFIG
): number {
  let value = seed;
  
  for (let layer = 0; layer < config.layerDepth; layer++) {
    const input = value * 12.9898 + x * 78.233 + y * 43.1234 + layer * 7.3217;
    const raw = Math.sin(input) * 43758.5453;
    const normalized = raw - Math.floor(raw);
    
    // Apply activation function
    switch (config.activationFunction) {
      case 'sigmoid':
        value = 1 / (1 + Math.exp(-normalized * 10 + 5));
        break;
      case 'tanh':
        value = Math.tanh(normalized * 2 - 1);
        break;
      case 'relu':
        value = Math.max(0, normalized - 0.5) * 2;
        break;
      case 'swish':
        const sigmoid = 1 / (1 + Math.exp(-normalized * 6));
        value = normalized * sigmoid;
        break;
    }
  }
  
  return value * config.mutationRate;
}

/**
 * Generate adaptive timing delay that mimics human behavior
 */
export function generateAdaptiveDelay(
  baseDelay: number,
  config: ClaudeAdaptiveBehaviorConfig = CLAUDE_ADAPTIVE_BEHAVIOR_CONFIG
): number {
  const range = config.maxResponseDelay - config.minResponseDelay;
  const randomFactor = Math.random();
  
  // Use a more natural distribution (roughly bell-curve shaped)
  const naturalRandom = (randomFactor + Math.random() + Math.random()) / 3;
  const jitter = (Math.random() * 2 - 1) * (config.jitterPercentage / 100);
  
  const delay = config.minResponseDelay + range * naturalRandom;
  return Math.round(delay * (1 + jitter));
}
