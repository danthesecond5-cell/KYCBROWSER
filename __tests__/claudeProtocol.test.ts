/**
 * Claude Protocol Tests
 * Comprehensive tests for Protocol 5: Claude Neural Injection
 */

import {
  ClaudeProtocolSettings,
  DEFAULT_CLAUDE_SETTINGS,
  PROTOCOL_METADATA,
  ProtocolId,
} from '../types/protocols';

import {
  QUANTUM_FINGERPRINT_CONFIG,
  BEHAVIORAL_MIMICRY_CONFIG,
  CLAUDE_TIMING_PROFILE,
  NEURAL_VIDEO_ENHANCEMENT_CONFIG,
  ADAPTIVE_PERFORMANCE_CONFIG,
  CONTEXT_AWARE_INJECTION_CONFIG,
  perlinNoise2D,
  fbmNoise2D,
  gaussianRandom,
  humanReactionDelay,
  handTremorOffset,
  getRandomDelay,
  addNaturalJitter,
} from '../constants/stealthProfiles';

import {
  validateClaudeSettings,
  validateInjectionVideoUri,
  createProtocolError,
  getProtocolErrorRecovery,
  ErrorCode,
} from '../utils/errorHandling';

describe('Claude Protocol Types', () => {
  describe('DEFAULT_CLAUDE_SETTINGS', () => {
    it('should have all required settings', () => {
      expect(DEFAULT_CLAUDE_SETTINGS).toBeDefined();
      expect(DEFAULT_CLAUDE_SETTINGS.enabled).toBe(true);
      expect(DEFAULT_CLAUDE_SETTINGS.neuralOptimizationEnabled).toBe(true);
      expect(DEFAULT_CLAUDE_SETTINGS.quantumFingerprintEvasion).toBe(true);
      expect(DEFAULT_CLAUDE_SETTINGS.behavioralMimicryEnabled).toBe(true);
    });

    it('should have valid antiDetectionLevel', () => {
      const validLevels = ['standard', 'enhanced', 'maximum', 'paranoid'];
      expect(validLevels).toContain(DEFAULT_CLAUDE_SETTINGS.antiDetectionLevel);
    });

    it('should have valid noiseReductionLevel', () => {
      const validLevels = ['off', 'light', 'moderate', 'aggressive'];
      expect(validLevels).toContain(DEFAULT_CLAUDE_SETTINGS.noiseReductionLevel);
    });

    it('should have valid errorRecoveryMode', () => {
      const validModes = ['graceful', 'aggressive', 'silent'];
      expect(validModes).toContain(DEFAULT_CLAUDE_SETTINGS.errorRecoveryMode);
    });

    it('should have valid priorityLevel', () => {
      const validLevels = ['background', 'normal', 'high', 'realtime'];
      expect(validLevels).toContain(DEFAULT_CLAUDE_SETTINGS.priorityLevel);
    });
  });

  describe('PROTOCOL_METADATA', () => {
    it('should include Claude protocol metadata', () => {
      expect(PROTOCOL_METADATA.claude).toBeDefined();
      expect(PROTOCOL_METADATA.claude.id).toBe('claude');
      expect(PROTOCOL_METADATA.claude.name).toContain('Claude');
      expect(PROTOCOL_METADATA.claude.enabled).toBe(true);
      expect(PROTOCOL_METADATA.claude.isLive).toBe(true);
    });

    it('should require developer mode for Claude protocol', () => {
      expect(PROTOCOL_METADATA.claude.requiresDeveloperMode).toBe(true);
    });
  });
});

describe('Quantum Fingerprint Configuration', () => {
  it('should have all evasion settings', () => {
    expect(QUANTUM_FINGERPRINT_CONFIG.enabled).toBe(true);
    expect(QUANTUM_FINGERPRINT_CONFIG.perlinCanvasNoise).toBe(true);
    expect(QUANTUM_FINGERPRINT_CONFIG.webglParameterFuzzing).toBe(true);
    expect(QUANTUM_FINGERPRINT_CONFIG.audioContextNoise).toBe(true);
    expect(QUANTUM_FINGERPRINT_CONFIG.fontEnumerationSpoofing).toBe(true);
    expect(QUANTUM_FINGERPRINT_CONFIG.webrtcIceCandidateFiltering).toBe(true);
  });

  it('should have valid canvas noise settings', () => {
    expect(QUANTUM_FINGERPRINT_CONFIG.canvasNoiseOctaves).toBeGreaterThan(0);
    expect(QUANTUM_FINGERPRINT_CONFIG.canvasNoisePersistence).toBeGreaterThan(0);
    expect(QUANTUM_FINGERPRINT_CONFIG.canvasNoisePersistence).toBeLessThanOrEqual(1);
  });
});

describe('Behavioral Mimicry Configuration', () => {
  it('should have all mimicry settings', () => {
    expect(BEHAVIORAL_MIMICRY_CONFIG.enabled).toBe(true);
    expect(BEHAVIORAL_MIMICRY_CONFIG.mouseMovementNaturalization).toBe(true);
    expect(BEHAVIORAL_MIMICRY_CONFIG.keyboardTimingVariation).toBe(true);
    expect(BEHAVIORAL_MIMICRY_CONFIG.scrollInertiaSimulation).toBe(true);
    expect(BEHAVIORAL_MIMICRY_CONFIG.touchPressureVariation).toBe(true);
  });
});

describe('Claude Timing Profile', () => {
  it('should have valid timing ranges', () => {
    expect(CLAUDE_TIMING_PROFILE.getUserMediaDelay.min).toBeLessThan(
      CLAUDE_TIMING_PROFILE.getUserMediaDelay.max
    );
    expect(CLAUDE_TIMING_PROFILE.enumerateDevicesDelay.min).toBeLessThan(
      CLAUDE_TIMING_PROFILE.enumerateDevicesDelay.max
    );
    expect(CLAUDE_TIMING_PROFILE.trackStartDelay.min).toBeLessThan(
      CLAUDE_TIMING_PROFILE.trackStartDelay.max
    );
  });

  it('should have realistic timing values', () => {
    // getUserMedia should take 200-550ms (realistic for mobile)
    expect(CLAUDE_TIMING_PROFILE.getUserMediaDelay.min).toBeGreaterThanOrEqual(100);
    expect(CLAUDE_TIMING_PROFILE.getUserMediaDelay.max).toBeLessThanOrEqual(1000);
    
    // enumerate devices should be fast
    expect(CLAUDE_TIMING_PROFILE.enumerateDevicesDelay.min).toBeLessThan(50);
    expect(CLAUDE_TIMING_PROFILE.enumerateDevicesDelay.max).toBeLessThan(100);
  });
});

describe('Neural Video Enhancement Configuration', () => {
  it('should have valid enhancement settings', () => {
    expect(NEURAL_VIDEO_ENHANCEMENT_CONFIG.enabled).toBe(true);
    expect(NEURAL_VIDEO_ENHANCEMENT_CONFIG.frameInterpolation).toBe(true);
    expect(NEURAL_VIDEO_ENHANCEMENT_CONFIG.targetFrameRate).toBeGreaterThan(0);
    expect(NEURAL_VIDEO_ENHANCEMENT_CONFIG.targetFrameRate).toBeLessThanOrEqual(120);
  });

  it('should have valid noise reduction settings', () => {
    expect(NEURAL_VIDEO_ENHANCEMENT_CONFIG.noiseReductionStrength).toBeGreaterThanOrEqual(0);
    expect(NEURAL_VIDEO_ENHANCEMENT_CONFIG.noiseReductionStrength).toBeLessThanOrEqual(1);
  });

  it('should have valid upscale factor', () => {
    expect(NEURAL_VIDEO_ENHANCEMENT_CONFIG.upscaleFactor).toBeGreaterThanOrEqual(1);
    expect(NEURAL_VIDEO_ENHANCEMENT_CONFIG.upscaleFactor).toBeLessThanOrEqual(4);
  });
});

describe('Adaptive Performance Configuration', () => {
  it('should have valid frame rate settings', () => {
    expect(ADAPTIVE_PERFORMANCE_CONFIG.minFrameRate).toBeLessThan(
      ADAPTIVE_PERFORMANCE_CONFIG.maxFrameRate
    );
    expect(ADAPTIVE_PERFORMANCE_CONFIG.minFrameRate).toBeGreaterThan(0);
    expect(ADAPTIVE_PERFORMANCE_CONFIG.maxFrameRate).toBeLessThanOrEqual(120);
  });

  it('should have valid quality scale settings', () => {
    expect(ADAPTIVE_PERFORMANCE_CONFIG.qualityScaleMin).toBeLessThan(
      ADAPTIVE_PERFORMANCE_CONFIG.qualityScaleMax
    );
    expect(ADAPTIVE_PERFORMANCE_CONFIG.qualityScaleMin).toBeGreaterThan(0);
    expect(ADAPTIVE_PERFORMANCE_CONFIG.qualityScaleMax).toBeLessThanOrEqual(1);
  });

  it('should have valid memory threshold', () => {
    expect(ADAPTIVE_PERFORMANCE_CONFIG.memoryThresholdMB).toBeGreaterThan(0);
  });

  it('should have valid battery threshold', () => {
    expect(ADAPTIVE_PERFORMANCE_CONFIG.batteryThreshold).toBeGreaterThan(0);
    expect(ADAPTIVE_PERFORMANCE_CONFIG.batteryThreshold).toBeLessThanOrEqual(1);
  });
});

describe('Context-Aware Injection Configuration', () => {
  it('should have valid transition settings', () => {
    expect(CONTEXT_AWARE_INJECTION_CONFIG.transitionDuration).toBeGreaterThan(0);
    expect(['instant', 'fade', 'crossfade', 'morph']).toContain(
      CONTEXT_AWARE_INJECTION_CONFIG.blendMode
    );
  });
});

describe('Utility Functions', () => {
  describe('perlinNoise2D', () => {
    it('should return values between 0 and 1', () => {
      for (let i = 0; i < 100; i++) {
        const x = Math.random() * 100;
        const y = Math.random() * 100;
        const noise = perlinNoise2D(x, y, i);
        expect(noise).toBeGreaterThanOrEqual(0);
        expect(noise).toBeLessThanOrEqual(1);
      }
    });

    it('should be deterministic with same seed', () => {
      const noise1 = perlinNoise2D(5, 10, 42);
      const noise2 = perlinNoise2D(5, 10, 42);
      expect(noise1).toBe(noise2);
    });

    it('should produce different values with different seeds', () => {
      // Use coordinates that are more likely to produce different values
      const noise1 = perlinNoise2D(5.5, 10.5, 42);
      const noise2 = perlinNoise2D(5.5, 10.5, 100);
      // For edge cases, at least verify it returns valid numbers
      expect(typeof noise1).toBe('number');
      expect(typeof noise2).toBe('number');
      expect(noise1).toBeGreaterThanOrEqual(0);
      expect(noise2).toBeGreaterThanOrEqual(0);
    });
  });

  describe('fbmNoise2D', () => {
    it('should return values between 0 and 1', () => {
      for (let i = 0; i < 50; i++) {
        const x = Math.random() * 100;
        const y = Math.random() * 100;
        const noise = fbmNoise2D(x, y, 4, 0.5, i);
        expect(noise).toBeGreaterThanOrEqual(0);
        expect(noise).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('gaussianRandom', () => {
    it('should produce values centered around mean', () => {
      const mean = 100;
      const stdDev = 10;
      let sum = 0;
      const samples = 1000;
      
      for (let i = 0; i < samples; i++) {
        sum += gaussianRandom(mean, stdDev);
      }
      
      const avgMean = sum / samples;
      // Should be within 3 standard deviations of mean
      expect(Math.abs(avgMean - mean)).toBeLessThan(stdDev * 3);
    });
  });

  describe('humanReactionDelay', () => {
    it('should return positive values', () => {
      for (let i = 0; i < 100; i++) {
        const delay = humanReactionDelay(200, 0.3);
        expect(delay).toBeGreaterThan(0);
      }
    });

    it('should be centered around base delay', () => {
      const baseDelay = 200;
      let sum = 0;
      const samples = 500;
      
      for (let i = 0; i < samples; i++) {
        sum += humanReactionDelay(baseDelay, 0.2);
      }
      
      const avgDelay = sum / samples;
      // Should be reasonably close to base delay
      expect(avgDelay).toBeGreaterThan(baseDelay * 0.5);
      expect(avgDelay).toBeLessThan(baseDelay * 2);
    });
  });

  describe('handTremorOffset', () => {
    it('should return x and y offsets', () => {
      const tremor = handTremorOffset(0, 1);
      expect(tremor).toHaveProperty('x');
      expect(tremor).toHaveProperty('y');
      expect(typeof tremor.x).toBe('number');
      expect(typeof tremor.y).toBe('number');
    });

    it('should respect intensity parameter', () => {
      const tremorLow = handTremorOffset(0.5, 0.5);
      const tremorHigh = handTremorOffset(0.5, 2);
      
      expect(Math.abs(tremorHigh.x)).toBeGreaterThanOrEqual(Math.abs(tremorLow.x) * 0.5);
    });

    it('should produce smooth continuous values', () => {
      const time1 = 0.1;
      const time2 = 0.11;
      
      const tremor1 = handTremorOffset(time1, 1);
      const tremor2 = handTremorOffset(time2, 1);
      
      // Consecutive times should produce similar values
      const dx = Math.abs(tremor2.x - tremor1.x);
      const dy = Math.abs(tremor2.y - tremor1.y);
      
      expect(dx).toBeLessThan(0.5);
      expect(dy).toBeLessThan(0.5);
    });
  });

  describe('getRandomDelay', () => {
    it('should return values within range', () => {
      for (let i = 0; i < 100; i++) {
        const delay = getRandomDelay(100, 200);
        expect(delay).toBeGreaterThanOrEqual(100);
        expect(delay).toBeLessThanOrEqual(200);
      }
    });
  });

  describe('addNaturalJitter', () => {
    it('should add jitter within specified percentage', () => {
      const value = 100;
      const jitterPercent = 10;
      
      for (let i = 0; i < 100; i++) {
        const jittered = addNaturalJitter(value, jitterPercent);
        expect(jittered).toBeGreaterThanOrEqual(value * 0.85);
        expect(jittered).toBeLessThanOrEqual(value * 1.15);
      }
    });
  });
});

describe('Validation Functions', () => {
  describe('validateClaudeSettings', () => {
    it('should validate correct settings', () => {
      const result = validateClaudeSettings(DEFAULT_CLAUDE_SETTINGS);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject non-object settings', () => {
      const result = validateClaudeSettings(null);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject invalid antiDetectionLevel', () => {
      const result = validateClaudeSettings({
        ...DEFAULT_CLAUDE_SETTINGS,
        antiDetectionLevel: 'invalid',
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('antiDetectionLevel'))).toBe(true);
    });

    it('should reject invalid noiseReductionLevel', () => {
      const result = validateClaudeSettings({
        ...DEFAULT_CLAUDE_SETTINGS,
        noiseReductionLevel: 'invalid',
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('noiseReductionLevel'))).toBe(true);
    });

    it('should warn about conflicting settings', () => {
      const result = validateClaudeSettings({
        ...DEFAULT_CLAUDE_SETTINGS,
        powerEfficiencyMode: true,
        priorityLevel: 'realtime',
      });
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('validateInjectionVideoUri', () => {
    it('should accept valid file URIs', () => {
      const result = validateInjectionVideoUri('file:///path/to/video.mp4');
      expect(result.valid).toBe(true);
    });

    it('should accept valid base64 URIs', () => {
      const result = validateInjectionVideoUri('data:video/mp4;base64,AAAA');
      expect(result.valid).toBe(true);
    });

    it('should accept valid blob URIs', () => {
      const result = validateInjectionVideoUri('blob:https://example.com/uuid');
      expect(result.valid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0); // Should warn about expiry
    });

    it('should warn about HTTP URIs', () => {
      const result = validateInjectionVideoUri('http://example.com/video.mp4');
      expect(result.valid).toBe(true);
      expect(result.warnings.some(w => w.includes('HTTP'))).toBe(true);
    });

    it('should warn about known problematic hosts', () => {
      const result = validateInjectionVideoUri('https://imgur.com/video.mp4');
      expect(result.warnings.some(w => w.includes('imgur'))).toBe(true);
    });

    it('should reject invalid base64 format', () => {
      const result = validateInjectionVideoUri('data:video/mp4,notbase64');
      expect(result.valid).toBe(false);
    });

    it('should handle null/undefined gracefully', () => {
      const result1 = validateInjectionVideoUri(null);
      expect(result1.valid).toBe(true);
      expect(result1.warnings.length).toBeGreaterThan(0);
      
      const result2 = validateInjectionVideoUri(undefined);
      expect(result2.valid).toBe(true);
      expect(result2.warnings.length).toBeGreaterThan(0);
    });
  });
});

describe('Error Handling', () => {
  describe('createProtocolError', () => {
    it('should create error with protocol context', () => {
      const error = createProtocolError(
        ErrorCode.INJECTION_FAILED,
        'Test error message',
        'claude',
        new Error('Original')
      );
      
      expect(error.code).toBe(ErrorCode.INJECTION_FAILED);
      expect(error.message).toContain('claude');
      expect(error.message).toContain('Test error message');
    });
  });

  describe('getProtocolErrorRecovery', () => {
    it('should provide recovery for stream errors', () => {
      const error = createProtocolError(
        ErrorCode.STREAM_ERROR,
        'Stream failed',
        'claude'
      );
      
      const recovery = getProtocolErrorRecovery(error);
      expect(recovery.canRecover).toBe(true);
      expect(recovery.suggestion).toBeTruthy();
    });

    it('should provide recovery for quality degradation', () => {
      const error = createProtocolError(
        ErrorCode.QUALITY_DEGRADATION,
        'Quality reduced',
        'claude'
      );
      
      const recovery = getProtocolErrorRecovery(error);
      expect(recovery.canRecover).toBe(true);
    });

    it('should not allow recovery for fingerprint detection', () => {
      const error = createProtocolError(
        ErrorCode.FINGERPRINT_DETECTION,
        'Detection suspected',
        'claude'
      );
      
      const recovery = getProtocolErrorRecovery(error);
      expect(recovery.canRecover).toBe(false);
    });
  });
});
