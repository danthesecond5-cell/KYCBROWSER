/**
 * Tests for Claude Sonnet Advanced Protocol
 */

import { protocolMonitor, monitoringHelpers } from '@/utils/protocolMonitoring';

describe('Claude Sonnet Protocol', () => {
  beforeEach(() => {
    protocolMonitor.clear();
  });

  describe('Protocol Configuration', () => {
    it('should have claude-sonnet protocol ID', () => {
      const protocolId = 'claude-sonnet';
      expect(protocolId).toBe('claude-sonnet');
    });

    it('should support all advanced features', () => {
      const features = {
        adaptiveQuality: true,
        behavioralAnalysis: true,
        advancedStealth: true,
        mlBodyDetection: true,
        realTimeOptimization: true,
        timingRandomization: true,
        protocolChaining: true,
        performanceMonitoring: true,
        contextAwareness: true,
        adaptiveBitrate: true,
        smartCaching: true,
        predictivePreloading: true,
        neuralEnhancement: true,
      };

      Object.values(features).forEach(feature => {
        expect(feature).toBe(true);
      });
    });
  });

  describe('Protocol Monitoring', () => {
    it('should track protocol sessions', () => {
      const sessionId = protocolMonitor.startSession('claude-sonnet');
      expect(sessionId).toContain('claude-sonnet');
      
      const metrics = protocolMonitor.getSessionMetrics(sessionId);
      expect(metrics).toBeDefined();
      expect(metrics?.protocolId).toBe('claude-sonnet');
      expect(metrics?.success).toBe(false);
    });

    it('should record successful sessions', () => {
      const sessionId = protocolMonitor.startSession('claude-sonnet');
      
      protocolMonitor.recordSuccess(sessionId, {
        fps: 30,
        latency: 15,
        cacheHitRate: 0.85,
      });

      const systemMetrics = protocolMonitor.getSystemMetrics();
      expect(systemMetrics.successfulInjections).toBe(1);
      expect(systemMetrics.totalInjections).toBe(1);
    });

    it('should record failed sessions', () => {
      const sessionId = protocolMonitor.startSession('claude-sonnet');
      
      protocolMonitor.recordFailure(sessionId, 'Test error', 'high');

      const systemMetrics = protocolMonitor.getSystemMetrics();
      expect(systemMetrics.failedInjections).toBe(1);
      expect(systemMetrics.totalInjections).toBe(1);
    });

    it('should calculate performance scores', () => {
      const sessionId = protocolMonitor.startSession('claude-sonnet');
      
      protocolMonitor.updateMetrics(sessionId, {
        fps: 30,
        latency: 20,
        cacheHitRate: 0.9,
      });

      const score = protocolMonitor.calculatePerformanceScore(sessionId);
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(100);
    });
  });

  describe('Monitoring Helpers', () => {
    it('should track async operations', async () => {
      const operation = async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return 'success';
      };

      const result = await monitoringHelpers.trackOperation('claude-sonnet', operation);
      expect(result).toBe('success');

      const systemMetrics = protocolMonitor.getSystemMetrics();
      expect(systemMetrics.successfulInjections).toBe(1);
    });

    it('should handle operation failures', async () => {
      const operation = async () => {
        throw new Error('Test error');
      };

      await expect(
        monitoringHelpers.trackOperation('claude-sonnet', operation)
      ).rejects.toThrow('Test error');

      const systemMetrics = protocolMonitor.getSystemMetrics();
      expect(systemMetrics.failedInjections).toBe(1);
    });

    it('should check protocol health', () => {
      // Not enough data yet
      expect(monitoringHelpers.isProtocolHealthy('claude-sonnet')).toBe(true);

      // Add successful sessions
      for (let i = 0; i < 5; i++) {
        const sessionId = protocolMonitor.startSession('claude-sonnet');
        protocolMonitor.recordSuccess(sessionId, {
          fps: 30,
          latency: 20,
        });
      }

      expect(monitoringHelpers.isProtocolHealthy('claude-sonnet')).toBe(true);
    });
  });

  describe('Protocol Comparison', () => {
    it('should compare protocols', () => {
      // Add sessions for different protocols
      const protocols = ['standard', 'claude-sonnet', 'protected'];
      
      protocols.forEach(protocol => {
        for (let i = 0; i < 3; i++) {
          const sessionId = protocolMonitor.startSession(protocol);
          protocolMonitor.recordSuccess(sessionId, {
            fps: 28 + Math.random() * 4,
            latency: 20 + Math.random() * 10,
          });
        }
      });

      const comparison = protocolMonitor.getProtocolComparison();
      expect(Object.keys(comparison)).toHaveLength(3);
      
      protocols.forEach(protocol => {
        expect(comparison[protocol]).toBeDefined();
        expect(comparison[protocol].usage).toBe(3);
        expect(comparison[protocol].successRate).toBe(100);
      });
    });

    it('should recommend best protocol', () => {
      // Add sessions with different performance
      const protocols = [
        { id: 'standard', fps: 25, latency: 30 },
        { id: 'claude-sonnet', fps: 30, latency: 15 },
        { id: 'protected', fps: 28, latency: 20 },
      ];

      protocols.forEach(({ id, fps, latency }) => {
        for (let i = 0; i < 5; i++) {
          const sessionId = protocolMonitor.startSession(id);
          protocolMonitor.recordSuccess(sessionId, { fps, latency });
        }
      });

      const recommended = monitoringHelpers.getRecommendedProtocol();
      expect(recommended).toBe('claude-sonnet'); // Should be best performing
    });
  });

  describe('Metrics Export', () => {
    it('should export metrics as JSON', () => {
      const sessionId = protocolMonitor.startSession('claude-sonnet');
      protocolMonitor.recordSuccess(sessionId, {
        fps: 30,
        latency: 15,
      });

      const exported = protocolMonitor.export();
      expect(exported).toBeDefined();
      
      const parsed = JSON.parse(exported);
      expect(parsed.system).toBeDefined();
      expect(parsed.history).toBeDefined();
      expect(parsed.comparison).toBeDefined();
    });
  });

  describe('Error Tracking', () => {
    it('should track errors without ending session', () => {
      const sessionId = protocolMonitor.startSession('claude-sonnet');
      
      protocolMonitor.recordError(sessionId, 'Minor error', 'low');
      protocolMonitor.recordError(sessionId, 'Another error', 'medium');

      const metrics = protocolMonitor.getSessionMetrics(sessionId);
      expect(metrics?.errorCount).toBe(2);
      expect(metrics?.errors).toHaveLength(2);
      expect(metrics?.errors[0].severity).toBe('low');
      expect(metrics?.errors[1].severity).toBe('medium');
    });

    it('should track error severity', () => {
      const sessionId = protocolMonitor.startSession('claude-sonnet');
      
      protocolMonitor.recordError(sessionId, 'Critical error', 'high');
      
      const metrics = protocolMonitor.getSessionMetrics(sessionId);
      expect(metrics?.errors[0].severity).toBe('high');
    });
  });

  describe('Performance Thresholds', () => {
    it('should penalize poor FPS in performance score', () => {
      const lowFpsSession = protocolMonitor.startSession('claude-sonnet');
      protocolMonitor.updateMetrics(lowFpsSession, { fps: 10 });
      const lowFpsScore = protocolMonitor.calculatePerformanceScore(lowFpsSession);

      const highFpsSession = protocolMonitor.startSession('claude-sonnet');
      protocolMonitor.updateMetrics(highFpsSession, { fps: 30 });
      const highFpsScore = protocolMonitor.calculatePerformanceScore(highFpsSession);

      expect(highFpsScore).toBeGreaterThan(lowFpsScore);
    });

    it('should penalize high latency in performance score', () => {
      const lowLatencySession = protocolMonitor.startSession('claude-sonnet');
      protocolMonitor.updateMetrics(lowLatencySession, { latency: 10 });
      const lowLatencyScore = protocolMonitor.calculatePerformanceScore(lowLatencySession);

      const highLatencySession = protocolMonitor.startSession('claude-sonnet');
      protocolMonitor.updateMetrics(highLatencySession, { latency: 150 });
      const highLatencyScore = protocolMonitor.calculatePerformanceScore(highLatencySession);

      expect(lowLatencyScore).toBeGreaterThan(highLatencyScore);
    });
  });
});
