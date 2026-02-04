import { NativeEventEmitter, NativeModules, Platform } from 'react-native';
import type { RefObject } from 'react';
import type { WebView } from 'react-native-webview';
import type { WebRtcLoopbackSettings } from '@/types/protocols';
import { isExpoGo, safeRequireNativeModule } from './expoGoCompat';

type LoopbackOfferPayload = {
  offerId?: string;
  sdp: string;
  type: string;
  target?: { width: number; height: number; fps: number };
  config?: {
    preferredCodec?: string;
    maxBitrateKbps?: number;
    enableSimulcast?: boolean;
    iceServers?: Array<{ urls: string | string[]; username?: string; credential?: string }>;
  };
};

type LoopbackCandidatePayload = {
  candidate: any;
};

type NativeLoopbackModule = {
  createAnswer?: (payload: any) => Promise<{ sdp: string; type: string }>;
  addIceCandidate?: (candidate: any) => Promise<void>;
  updateConfig?: (config: any) => Promise<void>;
  stop?: () => Promise<void>;
  getStats?: () => Promise<any>;
  getRingBufferSegments?: () => Promise<string[]>;
  clearRingBuffer?: () => Promise<void>;
  exportRingBufferToPhotos?: () => Promise<void>;
};

const EVENT_NAMES = {
  candidate: 'WebRtcLoopbackIceCandidate',
  stats: 'WebRtcLoopbackStats',
  error: 'WebRtcLoopbackError',
  state: 'WebRtcLoopbackState',
};

/**
 * WebRTC Loopback Bridge
 * 
 * This bridge provides native WebRTC loopback functionality when available.
 * In Expo Go, the native module is not available, so this bridge will
 * gracefully indicate that WebView-based injection should be used instead.
 */
export class WebRtcLoopbackBridge {
  private webViewRef: RefObject<WebView> | null = null;
  private nativeModule: NativeLoopbackModule | null = null;
  private emitter: NativeEventEmitter | null = null;
  private subscriptions: Array<{ remove: () => void }> = [];
  private lastOfferId: string | null = null;
  private settings: WebRtcLoopbackSettings | null = null;
  private videoSources: Array<{
    id: string;
    uri: string | null;
    label?: string;
    loop?: boolean;
  }> = [];
  private isExpoGoEnv: boolean;

  constructor() {
    this.isExpoGoEnv = isExpoGo();
    
    // Only attempt to load native module if not in Expo Go
    if (!this.isExpoGoEnv) {
      this.nativeModule = safeRequireNativeModule<NativeLoopbackModule>('WebRtcLoopback', null);
      
      if (this.nativeModule) {
        this.emitter = new NativeEventEmitter(this.nativeModule as any);
        this.attachNativeEvents();
      }
    } else {
      console.log('[WebRtcLoopbackBridge] Running in Expo Go - native loopback module not available');
      console.log('[WebRtcLoopbackBridge] Use Protocol 0 (WebView injection) for camera simulation');
    }
  }

  /**
   * Check if native loopback is available in current environment
   */
  isAvailable(): boolean {
    return !this.isExpoGoEnv && this.nativeModule !== null;
  }

  setWebViewRef(ref: RefObject<WebView>) {
    this.webViewRef = ref;
  }

  updateSettings(settings: WebRtcLoopbackSettings) {
    this.settings = settings;
    if (this.nativeModule?.updateConfig) {
      this.nativeModule.updateConfig({
        ...settings,
        platform: Platform.OS,
      }).catch(() => {});
    }
  }

  updateDeviceSources(devices: Array<{ id: string; name?: string; assignedVideoUri?: string | null; simulationEnabled?: boolean }>) {
    const sources = devices
      .filter((d) => d.type === 'camera' && d.simulationEnabled !== false)
      .map((d) => ({
        id: d.id,
        label: d.name,
        uri: d.assignedVideoUri ?? null,
        loop: true,
      }));
    this.videoSources = sources;
    if (this.nativeModule?.updateConfig) {
      this.nativeModule.updateConfig({
        videoSources: sources,
      }).catch(() => {});
    }
  }

  private attachNativeEvents() {
    if (!this.emitter) return;
    this.subscriptions.forEach((s) => s.remove());
    this.subscriptions = [];

    this.subscriptions.push(
      this.emitter.addListener(EVENT_NAMES.candidate, (payload) => {
        if (!payload?.candidate) return;
        this.sendToWebView(`window.__webrtcLoopbackCandidate && window.__webrtcLoopbackCandidate(${JSON.stringify(payload.candidate)});`);
      })
    );

    this.subscriptions.push(
      this.emitter.addListener(EVENT_NAMES.stats, (payload) => {
        if (!payload) return;
        this.sendToWebView(`window.__webrtcLoopbackStats && window.__webrtcLoopbackStats(${JSON.stringify(payload)});`);
      })
    );

    this.subscriptions.push(
      this.emitter.addListener(EVENT_NAMES.error, (payload) => {
        const message = payload?.message || 'Native WebRTC loopback error';
        this.sendToWebView(`window.__webrtcLoopbackError && window.__webrtcLoopbackError(${JSON.stringify(message)});`);
      })
    );
  }

  private sendToWebView(script: string) {
    if (!this.webViewRef?.current) return;
    this.webViewRef.current.injectJavaScript(`${script} true;`);
  }

  private ensureNativeAvailable(requireNative: boolean): boolean {
    if (!this.nativeModule || !this.nativeModule.createAnswer) {
      if (requireNative) {
        this.sendToWebView(`window.__webrtcLoopbackError && window.__webrtcLoopbackError(${JSON.stringify('Native WebRTC loopback module not available.')});`);
      }
      return false;
    }
    return true;
  }

  async handleOffer(payload: LoopbackOfferPayload) {
    const requireNative = this.settings?.requireNativeBridge ?? true;
    if (!this.ensureNativeAvailable(requireNative)) return;
    if (!payload?.sdp || !payload?.type) {
      this.sendToWebView(`window.__webrtcLoopbackError && window.__webrtcLoopbackError(${JSON.stringify('Invalid WebRTC offer payload.')});`);
      return;
    }

    const offerId = payload.offerId || `offer_${Date.now()}`;
    this.lastOfferId = offerId;

    const config = {
      ...this.settings,
      platform: Platform.OS,
      target: payload.target,
      offerId,
      preferredCodec: payload.config?.preferredCodec ?? this.settings?.preferredCodec,
      maxBitrateKbps: payload.config?.maxBitrateKbps ?? this.settings?.maxBitrateKbps,
      enableSimulcast: payload.config?.enableSimulcast ?? this.settings?.enableSimulcast,
      iceServers: payload.config?.iceServers ?? this.settings?.iceServers,
      videoSources: this.videoSources,
    };

    try {
      const answer = await this.nativeModule!.createAnswer!({
        offer: { sdp: payload.sdp, type: payload.type },
        config,
      });
      if (!answer?.sdp) {
        throw new Error('Native loopback returned empty answer');
      }
      this.sendToWebView(`window.__webrtcLoopbackAnswer && window.__webrtcLoopbackAnswer(${JSON.stringify(answer)});`);
    } catch (e: any) {
      const message = e?.message || 'Failed to create WebRTC answer';
      this.sendToWebView(`window.__webrtcLoopbackError && window.__webrtcLoopbackError(${JSON.stringify(message)});`);
    }
  }

  async handleCandidate(payload: LoopbackCandidatePayload) {
    const requireNative = this.settings?.requireNativeBridge ?? true;
    if (!this.ensureNativeAvailable(requireNative)) return;
    if (!payload?.candidate) return;
    try {
      await this.nativeModule!.addIceCandidate?.(payload.candidate);
    } catch {
      // Ignore; ICE is best-effort
    }
  }

  async stop() {
    if (this.nativeModule?.stop) {
      await this.nativeModule.stop().catch(() => {});
    }
  }

  async getRingBufferSegments(): Promise<string[]> {
    if (!this.nativeModule?.getRingBufferSegments) return [];
    return this.nativeModule.getRingBufferSegments().catch(() => []);
  }

  async clearRingBuffer(): Promise<void> {
    if (!this.nativeModule?.clearRingBuffer) return;
    await this.nativeModule.clearRingBuffer().catch(() => {});
  }

  async exportRingBufferToPhotos(): Promise<void> {
    if (!this.nativeModule?.exportRingBufferToPhotos) {
      throw new Error('Native WebRtcLoopback module does not support export.');
    }
    await this.nativeModule.exportRingBufferToPhotos();
  }
}
