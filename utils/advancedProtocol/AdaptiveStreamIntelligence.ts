/**
 * Adaptive Stream Intelligence (ASI) Engine
 * 
 * An on-device ML-powered system that analyzes target websites to understand
 * their camera handling patterns and dynamically adapts video injection
 * parameters for optimal stealth and compatibility.
 */

import {
  ASIConfig,
  ASIState,
  ASIThreat,
  ASIAdaptation,
  SiteProfile,
  Resolution,
  VideoSourceConfig,
  DEFAULT_ASI_CONFIG,
} from '@/types/advancedProtocol';

// ============================================================================
// TYPES
// ============================================================================

interface AnalysisResult {
  domain: string;
  timestamp: number;
  getUserMediaPatterns: GetUserMediaPattern[];
  enumerateDevicesPatterns: EnumerateDevicesPattern[];
  canvasPatterns: CanvasPattern[];
  webrtcPatterns: WebRTCPattern[];
  detectedThreats: ASIThreat[];
  recommendations: Partial<VideoSourceConfig>;
}

interface GetUserMediaPattern {
  constraints: MediaStreamConstraints;
  timestamp: number;
  success: boolean;
  responseTime: number;
}

interface EnumerateDevicesPattern {
  timestamp: number;
  resultCount: number;
  responseTime: number;
}

interface CanvasPattern {
  type: 'toDataURL' | 'getImageData' | 'captureStream';
  timestamp: number;
  dimensions?: { width: number; height: number };
  frequency: number;
}

interface WebRTCPattern {
  type: 'createOffer' | 'createAnswer' | 'addTrack' | 'getStats';
  timestamp: number;
  details: Record<string, unknown>;
}

interface FingerprintSignature {
  canvasHash: string;
  webglHash: string;
  audioHash: string;
  timingPattern: number[];
}

// ============================================================================
// SITE ANALYZER
// ============================================================================

class SiteAnalyzer {
  private config: ASIConfig;
  private analysisHistory: Map<string, AnalysisResult[]> = new Map();
  private interceptedCalls: {
    getUserMedia: GetUserMediaPattern[];
    enumerateDevices: EnumerateDevicesPattern[];
    canvas: CanvasPattern[];
    webrtc: WebRTCPattern[];
  } = {
    getUserMedia: [],
    enumerateDevices: [],
    canvas: [],
    webrtc: [],
  };

  constructor(config: ASIConfig) {
    this.config = config;
  }

  /**
   * Start analyzing the current page
   */
  startAnalysis(domain: string): void {
    console.log('[SiteAnalyzer] Starting analysis for:', domain);
    
    this.interceptedCalls = {
      getUserMedia: [],
      enumerateDevices: [],
      canvas: [],
      webrtc: [],
    };
    
    if (this.config.siteFingerprinting.analyzeGetUserMediaCalls) {
      this.instrumentGetUserMedia();
    }
    
    if (this.config.siteFingerprinting.analyzeEnumerateDevices) {
      this.instrumentEnumerateDevices();
    }
    
    this.instrumentCanvas();
    this.instrumentWebRTC();
  }

  private instrumentGetUserMedia(): void {
    const originalGetUserMedia = navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices);
    if (!originalGetUserMedia) return;
    
    const analyzer = this;
    
    navigator.mediaDevices.getUserMedia = async function(constraints) {
      const startTime = performance.now();
      
      try {
        const stream = await originalGetUserMedia(constraints);
        const responseTime = performance.now() - startTime;
        
        analyzer.interceptedCalls.getUserMedia.push({
          constraints: constraints || {},
          timestamp: Date.now(),
          success: true,
          responseTime,
        });
        
        console.log('[SiteAnalyzer] getUserMedia call intercepted:', constraints);
        return stream;
      } catch (error) {
        const responseTime = performance.now() - startTime;
        
        analyzer.interceptedCalls.getUserMedia.push({
          constraints: constraints || {},
          timestamp: Date.now(),
          success: false,
          responseTime,
        });
        
        throw error;
      }
    };
  }

  private instrumentEnumerateDevices(): void {
    const originalEnumerateDevices = navigator.mediaDevices?.enumerateDevices?.bind(navigator.mediaDevices);
    if (!originalEnumerateDevices) return;
    
    const analyzer = this;
    
    navigator.mediaDevices.enumerateDevices = async function() {
      const startTime = performance.now();
      const devices = await originalEnumerateDevices();
      const responseTime = performance.now() - startTime;
      
      analyzer.interceptedCalls.enumerateDevices.push({
        timestamp: Date.now(),
        resultCount: devices.length,
        responseTime,
      });
      
      console.log('[SiteAnalyzer] enumerateDevices call intercepted:', devices.length, 'devices');
      return devices;
    };
  }

  private instrumentCanvas(): void {
    const analyzer = this;
    
    // Instrument toDataURL
    const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function(...args) {
      analyzer.interceptedCalls.canvas.push({
        type: 'toDataURL',
        timestamp: Date.now(),
        dimensions: { width: this.width, height: this.height },
        frequency: analyzer.calculateFrequency('toDataURL'),
      });
      
      return originalToDataURL.apply(this, args);
    };
    
    // Instrument getImageData
    const originalGetImageData = CanvasRenderingContext2D.prototype.getImageData;
    CanvasRenderingContext2D.prototype.getImageData = function(...args) {
      analyzer.interceptedCalls.canvas.push({
        type: 'getImageData',
        timestamp: Date.now(),
        dimensions: { width: args[2] as number, height: args[3] as number },
        frequency: analyzer.calculateFrequency('getImageData'),
      });
      
      return originalGetImageData.apply(this, args as [number, number, number, number, ImageDataSettings?]);
    };
  }

  private instrumentWebRTC(): void {
    const analyzer = this;
    const OriginalPC = window.RTCPeerConnection;
    
    if (!OriginalPC) return;
    
    // Already instrumented by WebRTCRelay, but we can observe
    // This is just for analysis purposes
  }

  private calculateFrequency(type: string): number {
    const recentCalls = this.interceptedCalls.canvas.filter(
      c => c.type === type && Date.now() - c.timestamp < 1000
    );
    return recentCalls.length;
  }

  /**
   * Generate analysis result
   */
  generateAnalysis(domain: string): AnalysisResult {
    const detectedThreats = this.detectThreats();
    const recommendations = this.generateRecommendations();
    
    const result: AnalysisResult = {
      domain,
      timestamp: Date.now(),
      getUserMediaPatterns: [...this.interceptedCalls.getUserMedia],
      enumerateDevicesPatterns: [...this.interceptedCalls.enumerateDevices],
      canvasPatterns: [...this.interceptedCalls.canvas],
      webrtcPatterns: [...this.interceptedCalls.webrtc],
      detectedThreats,
      recommendations,
    };
    
    // Store in history
    const history = this.analysisHistory.get(domain) || [];
    history.push(result);
    if (history.length > 10) history.shift();
    this.analysisHistory.set(domain, history);
    
    return result;
  }

  private detectThreats(): ASIThreat[] {
    const threats: ASIThreat[] = [];
    
    // Check for fingerprinting attempts
    const canvasCalls = this.interceptedCalls.canvas;
    const recentToDataURL = canvasCalls.filter(
      c => c.type === 'toDataURL' && Date.now() - c.timestamp < 5000
    );
    
    if (recentToDataURL.length > 3) {
      threats.push({
        id: `threat_${Date.now()}_canvas`,
        type: 'canvas_analysis',
        severity: 'medium',
        description: 'Multiple canvas fingerprinting attempts detected',
        detectedAt: Date.now(),
        mitigated: false,
      });
    }
    
    // Check for timing attacks
    const getUserMediaCalls = this.interceptedCalls.getUserMedia;
    if (getUserMediaCalls.length >= 2) {
      const timings = getUserMediaCalls.map(c => c.responseTime);
      const avgTiming = timings.reduce((a, b) => a + b, 0) / timings.length;
      const variance = timings.reduce((sum, t) => sum + Math.pow(t - avgTiming, 2), 0) / timings.length;
      
      if (variance < 1) { // Very consistent timing might indicate detection
        threats.push({
          id: `threat_${Date.now()}_timing`,
          type: 'timing_attack',
          severity: 'low',
          description: 'Consistent timing patterns detected (possible detection attempt)',
          detectedAt: Date.now(),
          mitigated: false,
        });
      }
    }
    
    // Check for resolution mismatches
    const constraintPatterns = getUserMediaCalls.map(c => c.constraints);
    const requestedResolutions = constraintPatterns
      .filter(c => typeof c.video === 'object')
      .map(c => {
        const video = c.video as MediaTrackConstraints;
        return {
          width: this.extractConstraintValue(video.width),
          height: this.extractConstraintValue(video.height),
        };
      })
      .filter(r => r.width && r.height);
    
    if (requestedResolutions.length > 0) {
      // Check if we need to adapt
      const uniqueResolutions = new Set(
        requestedResolutions.map(r => `${r.width}x${r.height}`)
      );
      
      if (uniqueResolutions.size > 1) {
        threats.push({
          id: `threat_${Date.now()}_resolution`,
          type: 'resolution_mismatch',
          severity: 'low',
          description: 'Site requests multiple different resolutions',
          detectedAt: Date.now(),
          mitigated: false,
        });
      }
    }
    
    return threats;
  }

  private extractConstraintValue(constraint: ConstrainULong | undefined): number | null {
    if (!constraint) return null;
    if (typeof constraint === 'number') return constraint;
    if (typeof constraint === 'object') {
      return (constraint as ConstrainULongRange).ideal || 
             (constraint as ConstrainULongRange).exact || 
             null;
    }
    return null;
  }

  private generateRecommendations(): Partial<VideoSourceConfig> {
    const recommendations: Partial<VideoSourceConfig> = {};
    
    // Analyze requested resolutions
    const getUserMediaCalls = this.interceptedCalls.getUserMedia;
    const resolutions: Resolution[] = [];
    
    for (const call of getUserMediaCalls) {
      if (typeof call.constraints.video === 'object') {
        const video = call.constraints.video as MediaTrackConstraints;
        const width = this.extractConstraintValue(video.width);
        const height = this.extractConstraintValue(video.height);
        
        if (width && height) {
          resolutions.push({ width, height });
        }
      }
    }
    
    if (resolutions.length > 0) {
      // Use the most commonly requested resolution
      const resolutionCounts = new Map<string, number>();
      for (const res of resolutions) {
        const key = `${res.width}x${res.height}`;
        resolutionCounts.set(key, (resolutionCounts.get(key) || 0) + 1);
      }
      
      let maxCount = 0;
      let preferredRes = resolutions[0];
      resolutionCounts.forEach((count, key) => {
        if (count > maxCount) {
          maxCount = count;
          const [w, h] = key.split('x').map(Number);
          preferredRes = { width: w, height: h };
        }
      });
      
      recommendations.preferredResolution = preferredRes;
    }
    
    // Recommend noise injection if canvas fingerprinting detected
    const canvasThreats = this.interceptedCalls.canvas.filter(
      c => c.type === 'toDataURL' || c.type === 'getImageData'
    );
    
    if (canvasThreats.length > 0) {
      recommendations.noiseInjection = true;
      recommendations.noiseIntensity = 0.03;
    }
    
    return recommendations;
  }

  /**
   * Get analysis history for a domain
   */
  getHistory(domain: string): AnalysisResult[] {
    return this.analysisHistory.get(domain) || [];
  }
}

// ============================================================================
// THREAT MITIGATOR
// ============================================================================

class ThreatMitigator {
  private config: ASIConfig;
  private mitigations: Map<string, ASIAdaptation> = new Map();

  constructor(config: ASIConfig) {
    this.config = config;
  }

  /**
   * Mitigate a detected threat
   */
  mitigate(threat: ASIThreat): ASIAdaptation | null {
    if (!this.config.adaptation.antiDetectionMeasures) {
      return null;
    }
    
    console.log('[ThreatMitigator] Mitigating threat:', threat.type);
    
    let adaptation: ASIAdaptation | null = null;
    
    switch (threat.type) {
      case 'canvas_analysis':
        adaptation = this.mitigateCanvasAnalysis(threat);
        break;
      case 'fingerprint_detection':
        adaptation = this.mitigateFingerprinting(threat);
        break;
      case 'timing_attack':
        adaptation = this.mitigateTimingAttack(threat);
        break;
      case 'webrtc_leak':
        adaptation = this.mitigateWebRTCLeak(threat);
        break;
      case 'resolution_mismatch':
        adaptation = this.mitigateResolutionMismatch(threat);
        break;
      case 'fps_anomaly':
        adaptation = this.mitigateFpsAnomaly(threat);
        break;
    }
    
    if (adaptation) {
      this.mitigations.set(threat.id, adaptation);
      threat.mitigated = true;
      threat.mitigation = adaptation.reason;
    }
    
    return adaptation;
  }

  private mitigateCanvasAnalysis(threat: ASIThreat): ASIAdaptation {
    return {
      id: `adapt_${Date.now()}_canvas`,
      type: 'noise',
      originalValue: 0,
      adaptedValue: 0.05,
      reason: 'Increased noise injection to counter canvas fingerprinting',
      appliedAt: Date.now(),
      confidence: 0.85,
    };
  }

  private mitigateFingerprinting(threat: ASIThreat): ASIAdaptation {
    return {
      id: `adapt_${Date.now()}_fp`,
      type: 'metadata',
      originalValue: {},
      adaptedValue: { spoofDeviceId: true, randomizeLabels: true },
      reason: 'Randomizing device metadata to counter fingerprinting',
      appliedAt: Date.now(),
      confidence: 0.9,
    };
  }

  private mitigateTimingAttack(threat: ASIThreat): ASIAdaptation {
    return {
      id: `adapt_${Date.now()}_timing`,
      type: 'timing',
      originalValue: 0,
      adaptedValue: { minDelay: 10, maxDelay: 50 },
      reason: 'Adding timing jitter to counter timing analysis',
      appliedAt: Date.now(),
      confidence: 0.75,
    };
  }

  private mitigateWebRTCLeak(threat: ASIThreat): ASIAdaptation {
    return {
      id: `adapt_${Date.now()}_webrtc`,
      type: 'metadata',
      originalValue: {},
      adaptedValue: { blockLocalIPs: true, spoofCandidates: true },
      reason: 'Blocking local IP exposure in WebRTC',
      appliedAt: Date.now(),
      confidence: 0.95,
    };
  }

  private mitigateResolutionMismatch(threat: ASIThreat): ASIAdaptation {
    return {
      id: `adapt_${Date.now()}_res`,
      type: 'resolution',
      originalValue: { width: 1080, height: 1920 },
      adaptedValue: { width: 1280, height: 720 }, // Will be updated based on site preferences
      reason: 'Adapting resolution to match site expectations',
      appliedAt: Date.now(),
      confidence: 0.8,
    };
  }

  private mitigateFpsAnomaly(threat: ASIThreat): ASIAdaptation {
    return {
      id: `adapt_${Date.now()}_fps`,
      type: 'framerate',
      originalValue: 30,
      adaptedValue: 30, // Will be updated based on analysis
      reason: 'Adjusting frame rate to match expected patterns',
      appliedAt: Date.now(),
      confidence: 0.7,
    };
  }

  /**
   * Get all active mitigations
   */
  getActiveMitigations(): ASIAdaptation[] {
    return Array.from(this.mitigations.values());
  }
}

// ============================================================================
// PROFILE MANAGER
// ============================================================================

class ProfileManager {
  private profiles: Map<string, SiteProfile> = new Map();
  private storageKey = '@asi_site_profiles';
  private maxProfiles: number;

  constructor(maxProfiles: number = 100) {
    this.maxProfiles = maxProfiles;
  }

  /**
   * Load profiles from storage
   */
  async loadProfiles(): Promise<void> {
    // In a real implementation, this would use AsyncStorage
    // For now, we use localStorage as a fallback
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const parsed = JSON.parse(stored) as SiteProfile[];
        for (const profile of parsed) {
          this.profiles.set(profile.domain, profile);
        }
        console.log('[ProfileManager] Loaded', this.profiles.size, 'profiles');
      }
    } catch (e) {
      console.warn('[ProfileManager] Failed to load profiles:', e);
    }
  }

  /**
   * Save profiles to storage
   */
  async saveProfiles(): Promise<void> {
    try {
      const profiles = Array.from(this.profiles.values());
      localStorage.setItem(this.storageKey, JSON.stringify(profiles));
    } catch (e) {
      console.warn('[ProfileManager] Failed to save profiles:', e);
    }
  }

  /**
   * Get or create a profile for a domain
   */
  getOrCreateProfile(domain: string): SiteProfile {
    let profile = this.profiles.get(domain);
    
    if (!profile) {
      profile = {
        domain,
        hash: this.generateDomainHash(domain),
        preferredResolutions: [],
        preferredFrameRates: [],
        preferredCodecs: [],
        usesWebRTC: false,
        usesCanvas: false,
        detectsVirtualCamera: false,
        getUserMediaCallPattern: {
          frequency: 0,
          constraints: [],
          timing: [],
        },
        recommendedConfig: {},
        firstSeen: new Date().toISOString(),
        lastSeen: new Date().toISOString(),
        visitCount: 0,
        successRate: 1.0,
      };
      
      this.profiles.set(domain, profile);
      this.pruneOldProfiles();
    }
    
    return profile;
  }

  /**
   * Update a profile with analysis results
   */
  updateProfile(domain: string, analysis: AnalysisResult): void {
    const profile = this.getOrCreateProfile(domain);
    
    profile.lastSeen = new Date().toISOString();
    profile.visitCount++;
    
    // Update patterns
    if (analysis.getUserMediaPatterns.length > 0) {
      const constraints = analysis.getUserMediaPatterns.map(p => p.constraints);
      profile.getUserMediaCallPattern.constraints = constraints;
      profile.getUserMediaCallPattern.frequency = analysis.getUserMediaPatterns.length;
      profile.getUserMediaCallPattern.timing = analysis.getUserMediaPatterns.map(p => p.responseTime);
    }
    
    // Detect feature usage
    profile.usesCanvas = analysis.canvasPatterns.length > 0;
    profile.usesWebRTC = analysis.webrtcPatterns.length > 0;
    profile.detectsVirtualCamera = analysis.detectedThreats.some(
      t => t.type === 'fingerprint_detection' || t.type === 'canvas_analysis'
    );
    
    // Update recommendations
    profile.recommendedConfig = {
      ...profile.recommendedConfig,
      ...analysis.recommendations,
    };
    
    // Extract preferred resolutions from constraints
    for (const constraint of profile.getUserMediaCallPattern.constraints) {
      if (typeof constraint.video === 'object') {
        const video = constraint.video as MediaTrackConstraints;
        const width = this.extractValue(video.width);
        const height = this.extractValue(video.height);
        
        if (width && height) {
          const resolution = { width, height };
          if (!profile.preferredResolutions.some(r => r.width === width && r.height === height)) {
            profile.preferredResolutions.push(resolution);
          }
        }
        
        const fps = this.extractValue(video.frameRate);
        if (fps && !profile.preferredFrameRates.includes(fps)) {
          profile.preferredFrameRates.push(fps);
        }
      }
    }
    
    this.saveProfiles();
  }

  private extractValue(constraint: ConstrainDouble | ConstrainULong | undefined): number | null {
    if (!constraint) return null;
    if (typeof constraint === 'number') return constraint;
    if (typeof constraint === 'object') {
      const range = constraint as ConstrainDoubleRange;
      return range.ideal || range.exact || null;
    }
    return null;
  }

  private generateDomainHash(domain: string): string {
    let hash = 0;
    for (let i = 0; i < domain.length; i++) {
      const char = domain.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }

  private pruneOldProfiles(): void {
    if (this.profiles.size <= this.maxProfiles) return;
    
    // Remove oldest profiles
    const sorted = Array.from(this.profiles.entries())
      .sort((a, b) => new Date(a[1].lastSeen).getTime() - new Date(b[1].lastSeen).getTime());
    
    const toRemove = sorted.slice(0, this.profiles.size - this.maxProfiles);
    for (const [domain] of toRemove) {
      this.profiles.delete(domain);
    }
  }

  /**
   * Get profile for a domain
   */
  getProfile(domain: string): SiteProfile | null {
    return this.profiles.get(domain) || null;
  }

  /**
   * Get all profiles
   */
  getAllProfiles(): SiteProfile[] {
    return Array.from(this.profiles.values());
  }
}

// ============================================================================
// ADAPTIVE STREAM INTELLIGENCE ENGINE
// ============================================================================

export class AdaptiveStreamIntelligence {
  private config: ASIConfig;
  private state: ASIState;
  private siteAnalyzer: SiteAnalyzer;
  private threatMitigator: ThreatMitigator;
  private profileManager: ProfileManager;
  private currentDomain: string = '';
  private analysisInterval?: NodeJS.Timeout;

  constructor(config: Partial<ASIConfig> = {}) {
    this.config = { ...DEFAULT_ASI_CONFIG, ...config };
    this.state = {
      isActive: false,
      currentSiteProfile: null,
      detectedThreats: [],
      adaptationsApplied: [],
      mlModelLoaded: false,
      lastInferenceTime: 0,
      inferenceCount: 0,
    };
    
    this.siteAnalyzer = new SiteAnalyzer(this.config);
    this.threatMitigator = new ThreatMitigator(this.config);
    this.profileManager = new ProfileManager(this.config.learning.maxHistoryEntries);
  }

  /**
   * Initialize the ASI engine
   */
  async initialize(): Promise<void> {
    console.log('[ASI] Initializing Adaptive Stream Intelligence...');
    
    // Load stored profiles
    if (this.config.learning.storeHistory) {
      await this.profileManager.loadProfiles();
    }
    
    // Load ML model if enabled
    if (this.config.ml.enabled) {
      await this.loadMLModel();
    }
    
    this.state.isActive = true;
    console.log('[ASI] Initialized');
  }

  private async loadMLModel(): Promise<void> {
    // Placeholder for ML model loading
    // In a real implementation, this would load a TensorFlow.js or ONNX model
    console.log('[ASI] ML model loading not implemented (placeholder)');
    this.state.mlModelLoaded = false;
  }

  /**
   * Start analyzing a site
   */
  startSiteAnalysis(url: string): void {
    try {
      const urlObj = new URL(url);
      this.currentDomain = urlObj.hostname;
    } catch {
      this.currentDomain = url;
    }
    
    console.log('[ASI] Starting analysis for:', this.currentDomain);
    
    // Get or create profile
    const profile = this.profileManager.getOrCreateProfile(this.currentDomain);
    this.state.currentSiteProfile = profile;
    
    // Start analyzer
    this.siteAnalyzer.startAnalysis(this.currentDomain);
    
    // Start periodic analysis
    this.analysisInterval = setInterval(() => {
      this.runAnalysisCycle();
    }, this.config.ml.inferenceIntervalMs);
  }

  /**
   * Run a single analysis cycle
   */
  private runAnalysisCycle(): void {
    if (!this.currentDomain) return;
    
    // Generate analysis
    const analysis = this.siteAnalyzer.generateAnalysis(this.currentDomain);
    
    // Update profile
    this.profileManager.updateProfile(this.currentDomain, analysis);
    this.state.currentSiteProfile = this.profileManager.getProfile(this.currentDomain);
    
    // Process threats
    for (const threat of analysis.detectedThreats) {
      if (!this.state.detectedThreats.some(t => t.id === threat.id)) {
        this.state.detectedThreats.push(threat);
        
        // Attempt mitigation
        const adaptation = this.threatMitigator.mitigate(threat);
        if (adaptation) {
          this.state.adaptationsApplied.push(adaptation);
        }
      }
    }
    
    this.state.lastInferenceTime = Date.now();
    this.state.inferenceCount++;
    
    // Limit stored threats
    if (this.state.detectedThreats.length > 50) {
      this.state.detectedThreats = this.state.detectedThreats.slice(-50);
    }
    if (this.state.adaptationsApplied.length > 50) {
      this.state.adaptationsApplied = this.state.adaptationsApplied.slice(-50);
    }
  }

  /**
   * Get recommended configuration for current site
   */
  getRecommendedConfig(): Partial<VideoSourceConfig> {
    const profile = this.state.currentSiteProfile;
    if (!profile) {
      return {};
    }
    
    const config: Partial<VideoSourceConfig> = {
      ...profile.recommendedConfig,
    };
    
    // Apply adaptation overrides
    for (const adaptation of this.state.adaptationsApplied) {
      switch (adaptation.type) {
        case 'resolution':
          config.preferredResolution = adaptation.adaptedValue as Resolution;
          break;
        case 'framerate':
          config.preferredFrameRate = adaptation.adaptedValue as number;
          break;
        case 'noise':
          config.noiseInjection = true;
          config.noiseIntensity = adaptation.adaptedValue as number;
          break;
      }
    }
    
    // Use site's preferred resolution if available
    if (profile.preferredResolutions.length > 0 && this.config.adaptation.autoResolutionMatching) {
      config.preferredResolution = profile.preferredResolutions[0];
    }
    
    // Use site's preferred frame rate if available
    if (profile.preferredFrameRates.length > 0 && this.config.adaptation.autoFrameRateMatching) {
      config.preferredFrameRate = profile.preferredFrameRates[0];
    }
    
    return config;
  }

  /**
   * Stop analysis
   */
  stopSiteAnalysis(): void {
    if (this.analysisInterval) {
      clearInterval(this.analysisInterval);
      this.analysisInterval = undefined;
    }
    
    console.log('[ASI] Stopped analysis for:', this.currentDomain);
    this.currentDomain = '';
  }

  /**
   * Get current state
   */
  getState(): ASIState {
    return { ...this.state };
  }

  /**
   * Get site profile
   */
  getSiteProfile(domain: string): SiteProfile | null {
    return this.profileManager.getProfile(domain);
  }

  /**
   * Get all site profiles
   */
  getAllProfiles(): SiteProfile[] {
    return this.profileManager.getAllProfiles();
  }

  /**
   * Get active threats
   */
  getActiveThreats(): ASIThreat[] {
    return this.state.detectedThreats.filter(t => !t.mitigated);
  }

  /**
   * Get applied adaptations
   */
  getAppliedAdaptations(): ASIAdaptation[] {
    return [...this.state.adaptationsApplied];
  }

  /**
   * Manually add a site preference
   */
  addSitePreference(domain: string, preference: Partial<VideoSourceConfig>): void {
    const profile = this.profileManager.getOrCreateProfile(domain);
    profile.recommendedConfig = {
      ...profile.recommendedConfig,
      ...preference,
    };
    
    console.log('[ASI] Added preference for:', domain);
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.stopSiteAnalysis();
    this.state.isActive = false;
    
    console.log('[ASI] Destroyed');
  }
}
