/**
 * Advanced Protocol 2: Hybrid WebRTC Local Relay + Adaptive Stream Intelligence
 * 
 * This module exports all components of the most technically advanced video
 * injection system ever created, featuring:
 * 
 * - Multi-source video pipeline with hot-switching
 * - WebRTC local relay with virtual TURN emulation
 * - GPU-accelerated video processing with shader effects
 * - Adaptive Stream Intelligence (ASI) for site-specific optimization
 * - Cross-device live streaming support
 * - Cryptographic stream validation and tamper detection
 * 
 * EXPO GO COMPATIBILITY:
 * ----------------------
 * This module is PARTIALLY COMPATIBLE with Expo Go:
 * 
 * ✅ WORKS in Expo Go:
 *   - Browser-side injection script (browserScript.ts)
 *   - Video Source Pipeline (WebView-based canvas rendering)
 *   - WebRTC Relay (browser-side WebRTC APIs)
 *   - Adaptive Stream Intelligence (JavaScript-based)
 *   - Crypto Validator (WebCrypto API in browser)
 * 
 * ⚠️ LIMITED in Expo Go:
 *   - GPU Processor: Uses WebGL in browser, works but may be slower
 *   - Cross-Device Streaming: Requires WebSocket, works with limitations
 * 
 * The main engine and injection scripts run in the WebView's browser context,
 * not in React Native native code, making them compatible with Expo Go.
 * 
 * @module advancedProtocol
 * @version 1.0.0
 */

// Main Engine
export {
  AdvancedProtocol2Engine,
  getAdvancedProtocol2Engine,
  destroyAdvancedProtocol2Engine,
} from './AdvancedProtocol2Engine';

// Video Source Pipeline
export {
  VideoSourcePipeline,
  VideoSourceInstance,
  createVideoSource,
} from './VideoSourcePipeline';

// WebRTC Relay
export {
  WebRTCRelay,
  VirtualIceCandidateGenerator,
  SDPManipulator,
} from './WebRTCRelay';

// GPU Processor
export { GPUProcessor } from './GPUProcessor';

// Adaptive Stream Intelligence
export { AdaptiveStreamIntelligence } from './AdaptiveStreamIntelligence';

// Cross-Device Streaming
export { CrossDeviceStreamingManager } from './CrossDeviceStreaming';

// Crypto Validator
export { CryptoValidator } from './CryptoValidator';

// Browser Injection Script
export {
  createAdvancedProtocol2Script,
  createAdvancedProtocol2InitScript,
} from './browserScript';
export type { AdvancedProtocol2ScriptOptions } from './browserScript';

// Re-export types
export type {
  // Core types
  AdvancedProtocol2Config,
  AdvancedProtocol2State,
  
  // Video Source types
  VideoSource,
  VideoSourceType,
  VideoSourceStatus,
  VideoSourceHealth,
  VideoSourceConfig,
  VideoSourceMetadata,
  VideoPipelineConfig,
  VideoPipelineState,
  PipelineEvent,
  Resolution,
  
  // WebRTC types
  WebRTCRelayConfig,
  WebRTCRelayState,
  VirtualIceCandidate,
  
  // GPU types
  GPUProcessingConfig,
  GPUProcessingState,
  ShaderUniform,
  
  // ASI types
  ASIConfig,
  ASIState,
  ASIThreat,
  ASIAdaptation,
  SiteProfile,
  
  // Cross-Device types
  CrossDeviceConfig,
  CrossDeviceState,
  PeerDevice,
  PeerCapabilities,
  PeerStatus,
  
  // Crypto types
  CryptoConfig,
  CryptoState,
  FrameSignature,
} from '@/types/advancedProtocol';

// Re-export defaults
export {
  DEFAULT_ADVANCED_PROTOCOL2_CONFIG,
  DEFAULT_VIDEO_SOURCE_CONFIG,
  DEFAULT_VIDEO_SOURCE_HEALTH,
  DEFAULT_PIPELINE_CONFIG,
  DEFAULT_WEBRTC_RELAY_CONFIG,
  DEFAULT_GPU_CONFIG,
  DEFAULT_ASI_CONFIG,
  DEFAULT_CROSS_DEVICE_CONFIG,
  DEFAULT_CRYPTO_CONFIG,
} from '@/types/advancedProtocol';
