/**
 * Centralized Protocol Monitoring System
 * Tracks performance, errors, and metrics across all protocols
 */

export interface ProtocolMetrics {
  protocolId: string;
  startTime: number;
  endTime?: number;
  success: boolean;
  fps?: number;
  latency?: number;
  cacheHitRate?: number;
  qualityLevel?: number;
  errorCount: number;
  errors: Array<{
    message: string;
    timestamp: number;
    severity: 'low' | 'medium' | 'high';
  }>;
  performanceScore?: number;
}

export interface SystemMetrics {
  totalInjections: number;
  successfulInjections: number;
  failedInjections: number;
  averageFps: number;
  averageLatency: number;
  protocolUsage: Record<string, number>;
  lastUpdated: number;
}

class ProtocolMonitor {
  private metrics: Map<string, ProtocolMetrics> = new Map();
  private systemMetrics: SystemMetrics = {
    totalInjections: 0,
    successfulInjections: 0,
    failedInjections: 0,
    averageFps: 0,
    averageLatency: 0,
    protocolUsage: {},
    lastUpdated: Date.now(),
  };
  private metricsHistory: ProtocolMetrics[] = [];
  private maxHistorySize = 100;

  /**
   * Start tracking a protocol session
   */
  startSession(protocolId: string): string {
    const sessionId = `${protocolId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.metrics.set(sessionId, {
      protocolId,
      startTime: Date.now(),
      success: false,
      errorCount: 0,
      errors: [],
    });

    this.systemMetrics.totalInjections++;
    this.systemMetrics.protocolUsage[protocolId] = 
      (this.systemMetrics.protocolUsage[protocolId] || 0) + 1;

    console.log('[ProtocolMonitor] Session started:', sessionId);
    return sessionId;
  }

  /**
   * Record a successful session
   */
  recordSuccess(sessionId: string, metrics?: Partial<ProtocolMetrics>): void {
    const session = this.metrics.get(sessionId);
    if (!session) {
      console.warn('[ProtocolMonitor] Session not found:', sessionId);
      return;
    }

    session.success = true;
    session.endTime = Date.now();
    if (metrics) {
      Object.assign(session, metrics);
    }

    this.systemMetrics.successfulInjections++;
    this.updateAverages();
    this.archiveSession(sessionId);

    console.log('[ProtocolMonitor] Session success:', sessionId);
  }

  /**
   * Record a failed session
   */
  recordFailure(sessionId: string, error: string, severity: 'low' | 'medium' | 'high' = 'medium'): void {
    const session = this.metrics.get(sessionId);
    if (!session) {
      console.warn('[ProtocolMonitor] Session not found:', sessionId);
      return;
    }

    session.success = false;
    session.endTime = Date.now();
    session.errorCount++;
    session.errors.push({
      message: error,
      timestamp: Date.now(),
      severity,
    });

    this.systemMetrics.failedInjections++;
    this.archiveSession(sessionId);

    console.error('[ProtocolMonitor] Session failed:', sessionId, error);
  }

  /**
   * Update metrics for an active session
   */
  updateMetrics(sessionId: string, metrics: Partial<ProtocolMetrics>): void {
    const session = this.metrics.get(sessionId);
    if (!session) return;

    Object.assign(session, metrics);
  }

  /**
   * Record an error without ending the session
   */
  recordError(sessionId: string, error: string, severity: 'low' | 'medium' | 'high' = 'medium'): void {
    const session = this.metrics.get(sessionId);
    if (!session) return;

    session.errorCount++;
    session.errors.push({
      message: error,
      timestamp: Date.now(),
      severity,
    });
  }

  /**
   * Get metrics for a specific session
   */
  getSessionMetrics(sessionId: string): ProtocolMetrics | undefined {
    return this.metrics.get(sessionId);
  }

  /**
   * Get system-wide metrics
   */
  getSystemMetrics(): SystemMetrics {
    this.systemMetrics.lastUpdated = Date.now();
    return { ...this.systemMetrics };
  }

  /**
   * Get metrics history
   */
  getHistory(protocolId?: string): ProtocolMetrics[] {
    if (protocolId) {
      return this.metricsHistory.filter(m => m.protocolId === protocolId);
    }
    return [...this.metricsHistory];
  }

  /**
   * Calculate performance score for a session
   */
  calculatePerformanceScore(sessionId: string): number {
    const session = this.metrics.get(sessionId);
    if (!session) return 0;

    let score = 100;

    // Deduct for errors
    score -= session.errorCount * 10;

    // Deduct for poor FPS
    if (session.fps !== undefined) {
      if (session.fps < 15) score -= 30;
      else if (session.fps < 24) score -= 15;
      else if (session.fps >= 30) score += 10;
    }

    // Deduct for high latency
    if (session.latency !== undefined) {
      if (session.latency > 100) score -= 20;
      else if (session.latency > 50) score -= 10;
      else if (session.latency < 20) score += 10;
    }

    // Bonus for cache hits
    if (session.cacheHitRate !== undefined) {
      score += session.cacheHitRate * 20;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Get protocol comparison report
   */
  getProtocolComparison(): Record<string, {
    usage: number;
    successRate: number;
    avgFps: number;
    avgLatency: number;
    avgScore: number;
  }> {
    const protocolStats: Record<string, any> = {};

    this.metricsHistory.forEach(session => {
      const pid = session.protocolId;
      if (!protocolStats[pid]) {
        protocolStats[pid] = {
          total: 0,
          success: 0,
          fps: [],
          latency: [],
          scores: [],
        };
      }

      protocolStats[pid].total++;
      if (session.success) protocolStats[pid].success++;
      if (session.fps !== undefined) protocolStats[pid].fps.push(session.fps);
      if (session.latency !== undefined) protocolStats[pid].latency.push(session.latency);
      if (session.performanceScore !== undefined) protocolStats[pid].scores.push(session.performanceScore);
    });

    const result: Record<string, any> = {};
    Object.entries(protocolStats).forEach(([pid, stats]) => {
      result[pid] = {
        usage: stats.total,
        successRate: stats.total > 0 ? (stats.success / stats.total) * 100 : 0,
        avgFps: stats.fps.length > 0 ? stats.fps.reduce((a: number, b: number) => a + b, 0) / stats.fps.length : 0,
        avgLatency: stats.latency.length > 0 ? stats.latency.reduce((a: number, b: number) => a + b, 0) / stats.latency.length : 0,
        avgScore: stats.scores.length > 0 ? stats.scores.reduce((a: number, b: number) => a + b, 0) / stats.scores.length : 0,
      };
    });

    return result;
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics.clear();
    this.metricsHistory = [];
    this.systemMetrics = {
      totalInjections: 0,
      successfulInjections: 0,
      failedInjections: 0,
      averageFps: 0,
      averageLatency: 0,
      protocolUsage: {},
      lastUpdated: Date.now(),
    };
    console.log('[ProtocolMonitor] Metrics cleared');
  }

  /**
   * Export metrics as JSON
   */
  export(): string {
    return JSON.stringify({
      system: this.systemMetrics,
      history: this.metricsHistory,
      comparison: this.getProtocolComparison(),
    }, null, 2);
  }

  // Private methods

  private archiveSession(sessionId: string): void {
    const session = this.metrics.get(sessionId);
    if (!session) return;

    // Calculate performance score before archiving
    session.performanceScore = this.calculatePerformanceScore(sessionId);

    // Add to history
    this.metricsHistory.push({ ...session });
    
    // Trim history if needed
    if (this.metricsHistory.length > this.maxHistorySize) {
      this.metricsHistory.shift();
    }

    // Remove from active metrics
    this.metrics.delete(sessionId);
  }

  private updateAverages(): void {
    const recentSessions = this.metricsHistory.slice(-20);
    
    if (recentSessions.length === 0) return;

    const fpsValues = recentSessions.filter(s => s.fps !== undefined).map(s => s.fps!);
    const latencyValues = recentSessions.filter(s => s.latency !== undefined).map(s => s.latency!);

    if (fpsValues.length > 0) {
      this.systemMetrics.averageFps = fpsValues.reduce((a, b) => a + b, 0) / fpsValues.length;
    }

    if (latencyValues.length > 0) {
      this.systemMetrics.averageLatency = latencyValues.reduce((a, b) => a + b, 0) / latencyValues.length;
    }
  }
}

// Singleton instance
export const protocolMonitor = new ProtocolMonitor();

// Helper functions for common operations
export const monitoringHelpers = {
  /**
   * Track a protocol operation
   */
  async trackOperation<T>(
    protocolId: string,
    operation: () => Promise<T>
  ): Promise<T> {
    const sessionId = protocolMonitor.startSession(protocolId);
    const startTime = Date.now();

    try {
      const result = await operation();
      const endTime = Date.now();
      
      protocolMonitor.recordSuccess(sessionId, {
        latency: endTime - startTime,
      });

      return result;
    } catch (error) {
      protocolMonitor.recordFailure(
        sessionId,
        error instanceof Error ? error.message : String(error),
        'high'
      );
      throw error;
    }
  },

  /**
   * Get recommended protocol based on performance
   */
  getRecommendedProtocol(): string {
    const comparison = protocolMonitor.getProtocolComparison();
    
    let bestProtocol = 'standard';
    let bestScore = 0;

    Object.entries(comparison).forEach(([protocolId, stats]) => {
      // Weight: 40% success rate, 30% score, 20% fps, 10% latency
      const weightedScore = 
        stats.successRate * 0.4 +
        stats.avgScore * 0.3 +
        (stats.avgFps / 30) * 100 * 0.2 +
        (1 - Math.min(stats.avgLatency / 100, 1)) * 100 * 0.1;

      if (weightedScore > bestScore) {
        bestScore = weightedScore;
        bestProtocol = protocolId;
      }
    });

    return bestProtocol;
  },

  /**
   * Check if protocol is healthy
   */
  isProtocolHealthy(protocolId: string): boolean {
    const comparison = protocolMonitor.getProtocolComparison();
    const stats = comparison[protocolId];

    if (!stats || stats.usage < 3) return true; // Not enough data

    return stats.successRate > 80 && stats.avgScore > 60;
  },
};
