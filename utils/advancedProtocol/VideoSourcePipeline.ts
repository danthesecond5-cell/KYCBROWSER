/**
 * Video Source Pipeline - Multi-source video management with hot-switching
 * 
 * This system manages multiple video sources simultaneously and provides
 * seamless switching between them based on health metrics and priority.
 */

import {
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
  DEFAULT_VIDEO_SOURCE_CONFIG,
  DEFAULT_VIDEO_SOURCE_HEALTH,
  DEFAULT_PIPELINE_CONFIG,
} from '@/types/advancedProtocol';

// ============================================================================
// VIDEO SOURCE CLASS
// ============================================================================

export class VideoSourceInstance {
  public readonly id: string;
  public readonly type: VideoSourceType;
  public priority: number;
  public status: VideoSourceStatus = 'idle';
  public health: VideoSourceHealth = { ...DEFAULT_VIDEO_SOURCE_HEALTH };
  public config: VideoSourceConfig;
  public metadata: VideoSourceMetadata;
  
  private uri?: string;
  private videoElement?: HTMLVideoElement;
  private canvas?: HTMLCanvasElement;
  private ctx?: CanvasRenderingContext2D;
  private animationFrameId?: number;
  private lastFrameTime: number = 0;
  private frameCount: number = 0;
  private fpsHistory: number[] = [];
  private errorHistory: { time: number; error: string }[] = [];
  private onFrameCallback?: (imageData: ImageData) => void;
  private healthCheckInterval?: NodeJS.Timeout;

  constructor(
    id: string,
    type: VideoSourceType,
    priority: number,
    config: Partial<VideoSourceConfig> = {},
    metadata: Partial<VideoSourceMetadata> = {}
  ) {
    this.id = id;
    this.type = type;
    this.priority = priority;
    this.config = { ...DEFAULT_VIDEO_SOURCE_CONFIG, ...config };
    this.metadata = {
      name: metadata.name || `Source ${id}`,
      description: metadata.description,
      createdAt: metadata.createdAt || new Date().toISOString(),
      lastUsedAt: metadata.lastUsedAt,
      totalPlayTime: metadata.totalPlayTime || 0,
      successRate: metadata.successRate || 1.0,
    };
  }

  /**
   * Initialize the video source with a URI
   */
  async initialize(uri: string): Promise<void> {
    this.uri = uri;
    this.status = 'connecting';
    
    console.log(`[VideoSource:${this.id}] Initializing with URI:`, uri.substring(0, 50));
    
    try {
      switch (this.type) {
        case 'local_file':
          await this.initializeLocalFile(uri);
          break;
        case 'live_device':
          await this.initializeLiveDevice(uri);
          break;
        case 'rtsp_stream':
          await this.initializeRtspStream(uri);
          break;
        case 'synthetic':
          await this.initializeSynthetic();
          break;
        case 'canvas_fallback':
          await this.initializeCanvasFallback();
          break;
      }
      
      this.status = 'active';
      this.startHealthMonitoring();
      console.log(`[VideoSource:${this.id}] Initialized successfully`);
    } catch (error) {
      this.status = 'error';
      this.recordError(error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  private async initializeLocalFile(uri: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.setAttribute('playsinline', 'true');
      video.preload = 'auto';
      video.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;opacity:0;';
      
      const timeout = setTimeout(() => {
        reject(new Error('Video load timeout'));
      }, this.config.connectionTimeout);
      
      video.onloadeddata = () => {
        clearTimeout(timeout);
        this.videoElement = video;
        this.setupCanvas(video.videoWidth, video.videoHeight);
        resolve();
      };
      
      video.onerror = () => {
        clearTimeout(timeout);
        reject(new Error(`Failed to load video: ${video.error?.message || 'Unknown error'}`));
      };
      
      if (document.body) {
        document.body.appendChild(video);
      }
      
      video.src = uri;
      video.load();
    });
  }

  private async initializeLiveDevice(uri: string): Promise<void> {
    // Live device streaming will be handled by CrossDeviceManager
    // For now, we set up the canvas for receiving frames
    this.setupCanvas(
      this.config.preferredResolution.width,
      this.config.preferredResolution.height
    );
    this.status = 'connecting';
  }

  private async initializeRtspStream(uri: string): Promise<void> {
    // RTSP streams require native bridge or WebSocket relay
    // This is a placeholder for the actual implementation
    console.log(`[VideoSource:${this.id}] RTSP stream initialization`);
    this.setupCanvas(
      this.config.preferredResolution.width,
      this.config.preferredResolution.height
    );
  }

  private async initializeSynthetic(): Promise<void> {
    this.setupCanvas(
      this.config.preferredResolution.width,
      this.config.preferredResolution.height
    );
    this.startSyntheticGeneration();
  }

  private async initializeCanvasFallback(): Promise<void> {
    this.setupCanvas(
      this.config.preferredResolution.width,
      this.config.preferredResolution.height
    );
    this.startFallbackPattern();
  }

  private setupCanvas(width: number, height: number): void {
    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx = this.canvas.getContext('2d', { 
      alpha: false,
      desynchronized: true,
      willReadFrequently: false,
    }) || undefined;
  }

  private startSyntheticGeneration(): void {
    const render = (timestamp: number) => {
      if (this.status !== 'active' || !this.ctx || !this.canvas) return;
      
      this.recordFrame(timestamp);
      
      // Generate synthetic video frame (green screen by default)
      const w = this.canvas.width;
      const h = this.canvas.height;
      const t = timestamp / 1000;
      
      // Create gradient green screen with subtle animation
      const gradient = this.ctx.createLinearGradient(0, 0, 0, h);
      const offset = Math.sin(t * 0.5) * 0.05;
      gradient.addColorStop(0, `rgb(0, ${Math.floor(255 + offset * 20)}, 0)`);
      gradient.addColorStop(0.5, `rgb(0, ${Math.floor(238 + offset * 20)}, 0)`);
      gradient.addColorStop(1, `rgb(0, ${Math.floor(255 + offset * 20)}, 0)`);
      
      this.ctx.fillStyle = gradient;
      this.ctx.fillRect(0, 0, w, h);
      
      // Add subtle noise if enabled
      if (this.config.noiseInjection) {
        this.addNoise();
      }
      
      this.animationFrameId = requestAnimationFrame(render);
    };
    
    this.animationFrameId = requestAnimationFrame(render);
  }

  private startFallbackPattern(): void {
    const render = (timestamp: number) => {
      if (this.status !== 'active' || !this.ctx || !this.canvas) return;
      
      this.recordFrame(timestamp);
      
      // Simple green screen fallback
      this.ctx.fillStyle = '#00FF00';
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      
      this.animationFrameId = requestAnimationFrame(render);
    };
    
    this.animationFrameId = requestAnimationFrame(render);
  }

  private addNoise(): void {
    if (!this.ctx || !this.canvas) return;
    
    const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    const data = imageData.data;
    const intensity = this.config.noiseIntensity * 255;
    
    // Add subtle noise to every 4th pixel for performance
    for (let i = 0; i < data.length; i += 16) {
      const noise = (Math.random() - 0.5) * intensity;
      data[i] = Math.max(0, Math.min(255, data[i] + noise));
      data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));
      data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise));
    }
    
    this.ctx.putImageData(imageData, 0, 0);
  }

  private recordFrame(timestamp: number): void {
    this.frameCount++;
    
    if (this.lastFrameTime > 0) {
      const delta = timestamp - this.lastFrameTime;
      const fps = 1000 / delta;
      this.fpsHistory.push(fps);
      
      if (this.fpsHistory.length > 60) {
        this.fpsHistory.shift();
      }
      
      this.health.fps = this.getAverageFps();
    }
    
    this.lastFrameTime = timestamp;
    this.health.lastFrameTime = timestamp;
  }

  private getAverageFps(): number {
    if (this.fpsHistory.length === 0) return 0;
    const sum = this.fpsHistory.reduce((a, b) => a + b, 0);
    return sum / this.fpsHistory.length;
  }

  private recordError(message: string): void {
    this.errorHistory.push({ time: Date.now(), error: message });
    this.health.errorCount++;
    
    // Keep only last 10 errors
    if (this.errorHistory.length > 10) {
      this.errorHistory.shift();
    }
    
    console.error(`[VideoSource:${this.id}] Error:`, message);
  }

  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(() => {
      this.updateHealth();
    }, 1000);
  }

  private updateHealth(): void {
    // Update buffer health for video sources
    if (this.videoElement && this.videoElement.buffered.length > 0) {
      const buffered = this.videoElement.buffered;
      const currentTime = this.videoElement.currentTime;
      const duration = this.videoElement.duration;
      
      let bufferEnd = 0;
      for (let i = 0; i < buffered.length; i++) {
        if (buffered.start(i) <= currentTime && buffered.end(i) >= currentTime) {
          bufferEnd = buffered.end(i);
          break;
        }
      }
      
      this.health.bufferHealth = Math.min(1, (bufferEnd - currentTime) / 5);
    }
    
    // Calculate success rate
    const totalErrors = this.health.errorCount;
    const totalFrames = this.frameCount;
    if (totalFrames > 0) {
      this.metadata.successRate = Math.max(0, 1 - (totalErrors / totalFrames));
    }
  }

  /**
   * Start playback
   */
  async play(): Promise<void> {
    if (this.videoElement) {
      await this.videoElement.play();
    }
    this.status = 'active';
    this.metadata.lastUsedAt = new Date().toISOString();
  }

  /**
   * Pause playback
   */
  pause(): void {
    if (this.videoElement) {
      this.videoElement.pause();
    }
    this.status = 'idle';
  }

  /**
   * Get the current frame as ImageData
   */
  getCurrentFrame(): ImageData | null {
    if (!this.ctx || !this.canvas) return null;
    
    // If we have a video element, draw the current frame to canvas
    if (this.videoElement && this.videoElement.readyState >= 2) {
      this.ctx.drawImage(
        this.videoElement,
        0, 0,
        this.canvas.width,
        this.canvas.height
      );
    }
    
    return this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
  }

  /**
   * Get the canvas for streaming
   */
  getCanvas(): HTMLCanvasElement | null {
    return this.canvas || null;
  }

  /**
   * Get video element for direct streaming
   */
  getVideoElement(): HTMLVideoElement | null {
    return this.videoElement || null;
  }

  /**
   * Register callback for new frames
   */
  onFrame(callback: (imageData: ImageData) => void): void {
    this.onFrameCallback = callback;
  }

  /**
   * Push external frame data (for live device streaming)
   */
  pushFrame(imageData: ImageData): void {
    if (!this.ctx || !this.canvas) return;
    
    this.ctx.putImageData(imageData, 0, 0);
    this.recordFrame(performance.now());
    
    if (this.onFrameCallback) {
      this.onFrameCallback(imageData);
    }
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.status = 'disconnected';
    
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    if (this.videoElement) {
      this.videoElement.pause();
      this.videoElement.src = '';
      this.videoElement.remove();
    }
    
    if (this.canvas) {
      this.canvas.remove();
    }
    
    console.log(`[VideoSource:${this.id}] Destroyed`);
  }

  /**
   * Get source data for serialization
   */
  toJSON(): VideoSource {
    return {
      id: this.id,
      type: this.type,
      priority: this.priority,
      status: this.status,
      health: { ...this.health },
      uri: this.uri,
      config: { ...this.config },
      metadata: { ...this.metadata },
    };
  }
}

// ============================================================================
// VIDEO PIPELINE CLASS
// ============================================================================

export class VideoSourcePipeline {
  private config: VideoPipelineConfig;
  private state: VideoPipelineState;
  private sources: Map<string, VideoSourceInstance> = new Map();
  private eventListeners: Map<string, ((event: PipelineEvent) => void)[]> = new Map();
  private healthCheckInterval?: NodeJS.Timeout;
  private isRunning: boolean = false;

  constructor(config: Partial<VideoPipelineConfig> = {}) {
    this.config = { ...DEFAULT_PIPELINE_CONFIG, ...config };
    this.state = {
      activeSourceId: null,
      pendingSourceId: null,
      isTransitioning: false,
      transitionProgress: 0,
      lastSwitchTime: 0,
      switchCount: 0,
      totalFramesProcessed: 0,
    };
  }

  /**
   * Initialize the pipeline
   */
  async initialize(): Promise<void> {
    console.log('[VideoSourcePipeline] Initializing...');
    
    this.isRunning = true;
    this.startHealthMonitoring();
    
    console.log('[VideoSourcePipeline] Initialized');
  }

  /**
   * Add a video source to the pipeline
   */
  async addSource(source: VideoSourceInstance): Promise<void> {
    this.sources.set(source.id, source);
    console.log(`[VideoSourcePipeline] Added source: ${source.id} (priority: ${source.priority})`);
    
    // If this is the first source or highest priority, make it active
    if (!this.state.activeSourceId || source.priority < this.getActiveSource()!.priority) {
      await this.switchToSource(source.id);
    }
  }

  /**
   * Remove a video source from the pipeline
   */
  removeSource(sourceId: string): void {
    const source = this.sources.get(sourceId);
    if (source) {
      source.destroy();
      this.sources.delete(sourceId);
      
      // If this was the active source, switch to next best
      if (this.state.activeSourceId === sourceId) {
        const nextBest = this.findBestSource();
        if (nextBest) {
          this.switchToSource(nextBest.id);
        } else {
          this.state.activeSourceId = null;
        }
      }
      
      console.log(`[VideoSourcePipeline] Removed source: ${sourceId}`);
    }
  }

  /**
   * Switch to a specific source
   */
  async switchToSource(sourceId: string, instant: boolean = false): Promise<void> {
    const source = this.sources.get(sourceId);
    if (!source) {
      console.error(`[VideoSourcePipeline] Source not found: ${sourceId}`);
      return;
    }
    
    const previousSourceId = this.state.activeSourceId;
    
    this.emitEvent({
      type: 'transition_start',
      timestamp: Date.now(),
      sourceId,
      details: { previousSourceId, instant },
    });
    
    this.state.pendingSourceId = sourceId;
    this.state.isTransitioning = !instant;
    this.state.transitionProgress = 0;
    
    if (instant) {
      this.state.activeSourceId = sourceId;
      this.state.pendingSourceId = null;
      this.state.isTransitioning = false;
      this.state.transitionProgress = 1;
    } else {
      // Gradual transition
      const startTime = performance.now();
      const duration = this.config.hotSwitchThresholdMs;
      
      const transition = () => {
        const elapsed = performance.now() - startTime;
        this.state.transitionProgress = Math.min(1, elapsed / duration);
        
        if (this.state.transitionProgress >= 1) {
          this.state.activeSourceId = sourceId;
          this.state.pendingSourceId = null;
          this.state.isTransitioning = false;
          
          this.emitEvent({
            type: 'transition_complete',
            timestamp: Date.now(),
            sourceId,
            details: { duration: elapsed },
          });
        } else {
          requestAnimationFrame(transition);
        }
      };
      
      requestAnimationFrame(transition);
    }
    
    this.state.lastSwitchTime = Date.now();
    this.state.switchCount++;
    
    await source.play();
    
    this.emitEvent({
      type: 'source_change',
      timestamp: Date.now(),
      sourceId,
      details: { previousSourceId },
    });
    
    console.log(`[VideoSourcePipeline] Switched to source: ${sourceId}`);
  }

  /**
   * Get the currently active source
   */
  getActiveSource(): VideoSourceInstance | null {
    if (!this.state.activeSourceId) return null;
    return this.sources.get(this.state.activeSourceId) || null;
  }

  /**
   * Get all sources sorted by priority
   */
  getSortedSources(): VideoSourceInstance[] {
    return Array.from(this.sources.values())
      .sort((a, b) => a.priority - b.priority);
  }

  /**
   * Find the best available source based on health and priority
   */
  private findBestSource(): VideoSourceInstance | null {
    const sortedSources = this.getSortedSources();
    
    for (const source of sortedSources) {
      if (source.status === 'active' && source.health.fps >= this.config.minAcceptableFps) {
        return source;
      }
    }
    
    // If no healthy source, return highest priority regardless of health
    return sortedSources[0] || null;
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(() => {
      this.checkSourcesHealth();
    }, this.config.healthCheckIntervalMs);
  }

  /**
   * Check health of all sources and switch if needed
   */
  private checkSourcesHealth(): void {
    const activeSource = this.getActiveSource();
    
    if (!activeSource) {
      const bestSource = this.findBestSource();
      if (bestSource) {
        this.switchToSource(bestSource.id);
      }
      return;
    }
    
    // Check if active source is unhealthy
    const isUnhealthy = 
      activeSource.status === 'error' ||
      activeSource.status === 'disconnected' ||
      activeSource.health.fps < this.config.minAcceptableFps;
    
    if (isUnhealthy) {
      this.emitEvent({
        type: 'health_warning',
        timestamp: Date.now(),
        sourceId: activeSource.id,
        details: { 
          status: activeSource.status, 
          fps: activeSource.health.fps,
          threshold: this.config.minAcceptableFps,
        },
      });
      
      // Find a better source
      const sortedSources = this.getSortedSources();
      for (const source of sortedSources) {
        if (source.id !== activeSource.id && 
            source.status === 'active' && 
            source.health.fps >= this.config.minAcceptableFps) {
          console.log(`[VideoSourcePipeline] Hot-switching from ${activeSource.id} to ${source.id}`);
          this.switchToSource(source.id);
          return;
        }
      }
      
      // No better source found, emit error
      this.emitEvent({
        type: 'error',
        timestamp: Date.now(),
        sourceId: activeSource.id,
        details: { message: 'No healthy sources available' },
      });
    }
  }

  /**
   * Get current frame from active source
   */
  getCurrentFrame(): ImageData | null {
    const activeSource = this.getActiveSource();
    if (!activeSource) return null;
    
    this.state.totalFramesProcessed++;
    return activeSource.getCurrentFrame();
  }

  /**
   * Get canvas from active source for streaming
   */
  getActiveCanvas(): HTMLCanvasElement | null {
    const activeSource = this.getActiveSource();
    return activeSource?.getCanvas() || null;
  }

  /**
   * Get video element from active source
   */
  getActiveVideoElement(): HTMLVideoElement | null {
    const activeSource = this.getActiveSource();
    return activeSource?.getVideoElement() || null;
  }

  /**
   * Event handling
   */
  on(eventType: PipelineEvent['type'], callback: (event: PipelineEvent) => void): void {
    const listeners = this.eventListeners.get(eventType) || [];
    listeners.push(callback);
    this.eventListeners.set(eventType, listeners);
  }

  off(eventType: PipelineEvent['type'], callback: (event: PipelineEvent) => void): void {
    const listeners = this.eventListeners.get(eventType) || [];
    const index = listeners.indexOf(callback);
    if (index > -1) {
      listeners.splice(index, 1);
    }
  }

  private emitEvent(event: PipelineEvent): void {
    const listeners = this.eventListeners.get(event.type) || [];
    listeners.forEach(callback => callback(event));
  }

  /**
   * Get pipeline state
   */
  getState(): VideoPipelineState {
    return { ...this.state };
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.isRunning = false;
    
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    this.sources.forEach(source => source.destroy());
    this.sources.clear();
    this.eventListeners.clear();
    
    console.log('[VideoSourcePipeline] Destroyed');
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

export function createVideoSource(
  type: VideoSourceType,
  config: Partial<VideoSourceConfig> = {},
  metadata: Partial<VideoSourceMetadata> = {}
): VideoSourceInstance {
  const id = `source_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const priority = type === 'local_file' ? 1 : 
                   type === 'live_device' ? 2 : 
                   type === 'rtsp_stream' ? 3 : 
                   type === 'synthetic' ? 4 : 5;
  
  return new VideoSourceInstance(id, type, priority, config, metadata);
}
