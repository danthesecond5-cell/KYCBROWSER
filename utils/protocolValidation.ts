/**
 * Protocol Validation and State Management System
 * Provides comprehensive validation, state transitions, and error handling for all protocols
 */

import type { ProtocolType } from '@/contexts/ProtocolContext';

export interface ProtocolValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

export interface ProtocolMetrics {
  activations: number;
  successfulInjections: number;
  failedInjections: number;
  avgInjectionTime: number;
  lastActivated: string | null;
  totalRuntime: number;
  errorRate: number;
}

export interface ProtocolState {
  id: ProtocolType;
  status: 'idle' | 'initializing' | 'active' | 'suspended' | 'error' | 'degraded';
  health: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
  lastHealthCheck: string | null;
  metrics: ProtocolMetrics;
}

// Protocol state machine - valid state transitions
const VALID_TRANSITIONS: Record<string, Array<ProtocolState['status']>> = {
  idle: ['initializing', 'error'],
  initializing: ['active', 'error', 'idle'],
  active: ['suspended', 'degraded', 'error', 'idle'],
  suspended: ['active', 'idle', 'error'],
  degraded: ['active', 'error', 'idle'],
  error: ['idle', 'initializing'],
};

export class ProtocolValidator {
  private static instance: ProtocolValidator;
  private protocolStates: Map<string, ProtocolState> = new Map();
  private transitionHistory: Array<{ protocolId: string; from: string; to: string; timestamp: string }> = [];

  private constructor() {
    // Initialize default states for all protocols
    const protocols: ProtocolType[] = [
      'standard',
      'allowlist',
      'protected',
      'harness',
      'holographic',
      'websocket',
      'webrtc-loopback',
      'claude-sonnet',
      'claude',
      'sonnet',
    ];
    protocols.forEach(id => {
      this.protocolStates.set(id, {
        id,
        status: 'idle',
        health: 'excellent',
        lastHealthCheck: null,
        metrics: {
          activations: 0,
          successfulInjections: 0,
          failedInjections: 0,
          avgInjectionTime: 0,
          lastActivated: null,
          totalRuntime: 0,
          errorRate: 0,
        },
      });
    });
  }

  static getInstance(): ProtocolValidator {
    if (!ProtocolValidator.instance) {
      ProtocolValidator.instance = new ProtocolValidator();
    }
    return ProtocolValidator.instance;
  }

  validateProtocolConfig(protocolId: string, config: any): ProtocolValidationResult {
    const result: ProtocolValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
      suggestions: [],
    };

    // Validate protocol ID
    if (!['standard', 'allowlist', 'protected', 'harness', 'holographic', 'websocket', 'webrtc-loopback', 'claude-sonnet', 'claude', 'sonnet'].includes(protocolId)) {
      result.valid = false;
      result.errors.push(`Invalid protocol ID: ${protocolId}`);
      return result;
    }

    // Protocol-specific validation
    switch (protocolId) {
      case 'standard':
        if (config.injectionDelay && (config.injectionDelay < 0 || config.injectionDelay > 5000)) {
          result.warnings.push('Injection delay should be between 0-5000ms for optimal performance');
        }
        if (config.maxRetries && config.maxRetries > 10) {
          result.warnings.push('Max retries > 10 may cause performance issues');
        }
        break;

      case 'allowlist':
        if (config.domains && !Array.isArray(config.domains)) {
          result.valid = false;
          result.errors.push('Allowlist domains must be an array');
        }
        if (config.domains && config.domains.length === 0 && config.blockByDefault) {
          result.warnings.push('Allowlist is blocking all domains - no domains configured');
        }
        if (config.domains && config.domains.some((d: string) => !this.isValidDomain(d))) {
          result.warnings.push('Some domains may not be valid - check format');
        }
        break;

      case 'protected':
        if (config.swapDelayMs && config.swapDelayMs < 50) {
          result.warnings.push('Swap delay < 50ms may cause visual artifacts');
        }
        if (!config.fallbackToPlaceholder && !config.replacementVideoId) {
          result.warnings.push('No fallback configured - users may see blank video');
        }
        break;

      case 'harness':
        if (config.captureFrameRate && config.captureFrameRate > 60) {
          result.warnings.push('Frame rate > 60fps may not be supported on all devices');
        }
        break;

      case 'holographic':
        if (config.bridgePort && (config.bridgePort < 1 || config.bridgePort > 65535)) {
          result.warnings.push('Bridge port should be between 1 and 65535');
        }
        if (config.noiseInjectionLevel && (config.noiseInjectionLevel < 0 || config.noiseInjectionLevel > 1)) {
          result.errors.push('Noise injection level must be between 0 and 1');
          result.valid = false;
        }
        break;

      case 'websocket':
        if (config.port && (config.port < 1 || config.port > 65535)) {
          result.errors.push('WebSocket bridge port must be between 1 and 65535');
          result.valid = false;
        }
        if (config.quality && (config.quality < 0 || config.quality > 1)) {
          result.errors.push('Quality must be between 0 and 1');
          result.valid = false;
        }
        break;

      case 'webrtc-loopback':
        if (config.signalingTimeoutMs && (config.signalingTimeoutMs < 1000 || config.signalingTimeoutMs > 60000)) {
          result.warnings.push('Signaling timeout should be between 1000ms and 60000ms');
        }
        if (config.maxBitrateKbps && config.maxBitrateKbps < 0) {
          result.errors.push('Max bitrate must be >= 0');
          result.valid = false;
        }
        if (config.minBitrateKbps && config.minBitrateKbps < 0) {
          result.errors.push('Min bitrate must be >= 0');
          result.valid = false;
        }
        if (config.targetBitrateKbps && config.targetBitrateKbps < 0) {
          result.errors.push('Target bitrate must be >= 0');
          result.valid = false;
        }
        if (config.keepAliveIntervalMs && config.keepAliveIntervalMs < 500) {
          result.warnings.push('Keepalive interval < 500ms may be too aggressive');
        }
        if (config.ringBufferSeconds && config.ringBufferSeconds < 1) {
          result.warnings.push('Ring buffer < 1s may be too small for playback');
        }
        if (config.cacheTTLHours && config.cacheTTLHours < 1) {
          result.warnings.push('Cache TTL < 1 hour may cause frequent re-downloads');
        }
        if (config.cacheMaxSizeMB && config.cacheMaxSizeMB < 50) {
          result.warnings.push('Cache max size < 50MB may be too small for large videos');
        }
        break;

      case 'claude-sonnet':
        if (config.antiDetectionLevel && !['standard', 'advanced', 'maximum'].includes(config.antiDetectionLevel)) {
          result.warnings.push('Unknown anti-detection level - using standard');
        }
        if (config.fallbackProtocols && !Array.isArray(config.fallbackProtocols)) {
          result.errors.push('Fallback protocols must be an array');
          result.valid = false;
        }
        break;

      case 'claude':
        if (config.antiDetectionLevel && !['standard', 'enhanced', 'maximum', 'paranoid'].includes(config.antiDetectionLevel)) {
          result.warnings.push('Unknown anti-detection level - using standard');
        }
        if (config.noiseReductionLevel && !['off', 'light', 'moderate', 'aggressive'].includes(config.noiseReductionLevel)) {
          result.warnings.push('Unknown noise reduction level - using moderate');
        }
        break;

      case 'sonnet':
        // Advanced AI-powered protocol validation
        if (!config.aiModelVersion) {
          result.warnings.push('AI model version not specified - using default');
        }
        if (config.adaptiveThreshold && (config.adaptiveThreshold < 0 || config.adaptiveThreshold > 1)) {
          result.valid = false;
          result.errors.push('Adaptive threshold must be between 0 and 1');
        }
        if (config.mlInferenceEnabled && !config.mlModelPath) {
          result.warnings.push('ML inference enabled but no model path configured');
        }
        break;
    }

    // Add suggestions for optimization
    if (config.loggingLevel === 'verbose') {
      result.suggestions.push('Consider using minimal logging in production for better performance');
    }
    if (!config.retryOnFail) {
      result.suggestions.push('Enable retry on fail for more robust injection');
    }

    return result;
  }

  canTransition(protocolId: string, toStatus: ProtocolState['status']): boolean {
    const state = this.protocolStates.get(protocolId);
    if (!state) return false;

    const validNextStates = VALID_TRANSITIONS[state.status] || [];
    return validNextStates.includes(toStatus);
  }

  transitionState(protocolId: string, toStatus: ProtocolState['status']): boolean {
    if (!this.canTransition(protocolId, toStatus)) {
      console.warn(`[ProtocolValidator] Invalid state transition for ${protocolId}: ${this.protocolStates.get(protocolId)?.status} -> ${toStatus}`);
      return false;
    }

    const state = this.protocolStates.get(protocolId);
    if (!state) return false;

    const fromStatus = state.status;
    state.status = toStatus;
    state.lastHealthCheck = new Date().toISOString();

    this.transitionHistory.push({
      protocolId,
      from: fromStatus,
      to: toStatus,
      timestamp: new Date().toISOString(),
    });

    // Keep only last 100 transitions
    if (this.transitionHistory.length > 100) {
      this.transitionHistory.shift();
    }

    console.log(`[ProtocolValidator] State transition: ${protocolId} ${fromStatus} -> ${toStatus}`);
    return true;
  }

  updateMetrics(protocolId: string, updates: Partial<ProtocolMetrics>): void {
    const state = this.protocolStates.get(protocolId);
    if (!state) return;

    state.metrics = { ...state.metrics, ...updates };

    // Calculate error rate
    const total = state.metrics.successfulInjections + state.metrics.failedInjections;
    state.metrics.errorRate = total > 0 ? state.metrics.failedInjections / total : 0;

    // Update health based on metrics
    this.updateHealth(protocolId);
  }

  private updateHealth(protocolId: string): void {
    const state = this.protocolStates.get(protocolId);
    if (!state) return;

    const { errorRate, avgInjectionTime } = state.metrics;

    if (errorRate > 0.5 || avgInjectionTime > 5000) {
      state.health = 'critical';
    } else if (errorRate > 0.3 || avgInjectionTime > 3000) {
      state.health = 'poor';
    } else if (errorRate > 0.15 || avgInjectionTime > 2000) {
      state.health = 'fair';
    } else if (errorRate > 0.05 || avgInjectionTime > 1000) {
      state.health = 'good';
    } else {
      state.health = 'excellent';
    }
  }

  getState(protocolId: string): ProtocolState | null {
    return this.protocolStates.get(protocolId) || null;
  }

  getAllStates(): Map<string, ProtocolState> {
    return new Map(this.protocolStates);
  }

  getTransitionHistory(protocolId?: string): Array<{ protocolId: string; from: string; to: string; timestamp: string }> {
    if (protocolId) {
      return this.transitionHistory.filter(t => t.protocolId === protocolId);
    }
    return [...this.transitionHistory];
  }

  resetMetrics(protocolId: string): void {
    const state = this.protocolStates.get(protocolId);
    if (!state) return;

    state.metrics = {
      activations: 0,
      successfulInjections: 0,
      failedInjections: 0,
      avgInjectionTime: 0,
      lastActivated: null,
      totalRuntime: 0,
      errorRate: 0,
    };
    state.health = 'excellent';
  }

  private isValidDomain(domain: string): boolean {
    // Basic domain validation - can be enhanced
    const domainRegex = /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/i;
    return domainRegex.test(domain);
  }

  // Diagnostic methods
  generateHealthReport(): { overall: string; protocols: Record<string, any> } {
    const protocols: Record<string, any> = {};
    let totalHealth = 0;
    let count = 0;

    this.protocolStates.forEach((state, id) => {
      protocols[id] = {
        status: state.status,
        health: state.health,
        metrics: state.metrics,
        lastHealthCheck: state.lastHealthCheck,
      };

      // Convert health to numeric for averaging
      const healthScore = { excellent: 5, good: 4, fair: 3, poor: 2, critical: 1 }[state.health] || 3;
      totalHealth += healthScore;
      count++;
    });

    const avgHealth = count > 0 ? totalHealth / count : 3;
    const overall =
      avgHealth >= 4.5 ? 'excellent' :
      avgHealth >= 3.5 ? 'good' :
      avgHealth >= 2.5 ? 'fair' :
      avgHealth >= 1.5 ? 'poor' : 'critical';

    return { overall, protocols };
  }
}

export default ProtocolValidator.getInstance();
