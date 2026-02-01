/**
 * WebRTC Local Relay - Virtual TURN/ICE Emulation System
 * 
 * This system creates a local WebRTC relay that intercepts and manipulates
 * WebRTC connections to inject video streams at the signaling level.
 * This provides superior stealth compared to canvas-based injection.
 */

import {
  WebRTCRelayConfig,
  WebRTCRelayState,
  VirtualIceCandidate,
  DEFAULT_WEBRTC_RELAY_CONFIG,
} from '@/types/advancedProtocol';

// ============================================================================
// TYPES
// ============================================================================

interface SDPManipulationResult {
  sdp: string;
  modifications: SDPModification[];
}

interface SDPModification {
  type: 'codec_change' | 'bitrate_change' | 'direction_change' | 'ice_injection' | 'custom';
  original: string;
  modified: string;
  line: number;
}

interface PeerConnectionWrapper {
  id: string;
  originalPC: RTCPeerConnection;
  proxyPC: RTCPeerConnection;
  injectedStream?: MediaStream;
  state: RTCPeerConnectionState;
  createdAt: number;
}

// ============================================================================
// VIRTUAL ICE CANDIDATE GENERATOR
// ============================================================================

class VirtualIceCandidateGenerator {
  private candidateCounter: number = 0;
  private config: WebRTCRelayConfig;

  constructor(config: WebRTCRelayConfig) {
    this.config = config;
  }

  /**
   * Generate a virtual host ICE candidate
   */
  generateHostCandidate(port: number = 0): VirtualIceCandidate {
    const priority = this.calculatePriority('host', 0);
    const candidatePort = port || this.getRandomPort();
    
    return {
      candidate: this.buildCandidateString({
        foundation: this.generateFoundation(),
        component: 1,
        protocol: 'udp',
        priority,
        address: '127.0.0.1',
        port: candidatePort,
        type: 'host',
      }),
      sdpMid: '0',
      sdpMLineIndex: 0,
      foundation: this.generateFoundation(),
      priority,
      address: '127.0.0.1',
      port: candidatePort,
      type: 'host',
      protocol: 'udp',
    };
  }

  /**
   * Generate a virtual server reflexive (STUN) candidate
   */
  generateSrflxCandidate(): VirtualIceCandidate {
    const priority = this.calculatePriority('srflx', 1);
    const port = this.getRandomPort();
    const address = this.generateRealisticPublicIP();
    
    return {
      candidate: this.buildCandidateString({
        foundation: this.generateFoundation(),
        component: 1,
        protocol: 'udp',
        priority,
        address,
        port,
        type: 'srflx',
        raddr: '127.0.0.1',
        rport: this.getRandomPort(),
      }),
      sdpMid: '0',
      sdpMLineIndex: 0,
      foundation: this.generateFoundation(),
      priority,
      address,
      port,
      type: 'srflx',
      protocol: 'udp',
    };
  }

  /**
   * Generate a virtual relay (TURN) candidate
   */
  generateRelayCandidate(): VirtualIceCandidate {
    const priority = this.calculatePriority('relay', 2);
    const port = this.getRandomPort();
    const address = this.generateRealisticPublicIP();
    
    return {
      candidate: this.buildCandidateString({
        foundation: this.generateFoundation(),
        component: 1,
        protocol: 'udp',
        priority,
        address,
        port,
        type: 'relay',
        raddr: '127.0.0.1',
        rport: this.config.localSignalingPort,
      }),
      sdpMid: '0',
      sdpMLineIndex: 0,
      foundation: this.generateFoundation(),
      priority,
      address,
      port,
      type: 'relay',
      protocol: 'udp',
    };
  }

  /**
   * Generate a set of realistic ICE candidates
   */
  generateCandidateSet(): VirtualIceCandidate[] {
    const candidates: VirtualIceCandidate[] = [];
    
    // Always include host candidate
    candidates.push(this.generateHostCandidate());
    
    // Add server reflexive candidates (simulate STUN)
    if (!this.config.stealth.randomizeIceCandidates || Math.random() > 0.3) {
      candidates.push(this.generateSrflxCandidate());
    }
    
    // Add relay candidates if TURN is enabled
    if (this.config.virtualTurnEnabled) {
      candidates.push(this.generateRelayCandidate());
    }
    
    return candidates;
  }

  private generateFoundation(): string {
    this.candidateCounter++;
    return `${this.candidateCounter}${Math.random().toString(36).substr(2, 8)}`;
  }

  private calculatePriority(type: string, componentId: number): number {
    // RFC 5245 priority calculation
    const typePreference = type === 'host' ? 126 : type === 'srflx' ? 100 : 0;
    const localPreference = 65535;
    const componentPreference = 256 - componentId;
    
    return (typePreference << 24) + (localPreference << 8) + componentPreference;
  }

  private getRandomPort(): number {
    // Generate realistic ephemeral port
    return Math.floor(Math.random() * 16384) + 49152;
  }

  private generateRealisticPublicIP(): string {
    // Generate a realistic-looking public IP (avoid private ranges)
    const octet1 = Math.floor(Math.random() * 223) + 1;
    if (octet1 === 10 || octet1 === 127) return this.generateRealisticPublicIP();
    
    const octet2 = Math.floor(Math.random() * 256);
    if (octet1 === 172 && octet2 >= 16 && octet2 <= 31) return this.generateRealisticPublicIP();
    if (octet1 === 192 && octet2 === 168) return this.generateRealisticPublicIP();
    
    const octet3 = Math.floor(Math.random() * 256);
    const octet4 = Math.floor(Math.random() * 254) + 1;
    
    return `${octet1}.${octet2}.${octet3}.${octet4}`;
  }

  private buildCandidateString(params: {
    foundation: string;
    component: number;
    protocol: string;
    priority: number;
    address: string;
    port: number;
    type: string;
    raddr?: string;
    rport?: number;
  }): string {
    let candidate = `candidate:${params.foundation} ${params.component} ${params.protocol} ${params.priority} ${params.address} ${params.port} typ ${params.type}`;
    
    if (params.raddr && params.rport) {
      candidate += ` raddr ${params.raddr} rport ${params.rport}`;
    }
    
    return candidate;
  }
}

// ============================================================================
// SDP MANIPULATOR
// ============================================================================

class SDPManipulator {
  private config: WebRTCRelayConfig;

  constructor(config: WebRTCRelayConfig) {
    this.config = config;
  }

  /**
   * Manipulate SDP offer/answer to inject our requirements
   */
  manipulateSDP(sdp: string, type: 'offer' | 'answer'): SDPManipulationResult {
    const modifications: SDPModification[] = [];
    let modifiedSdp = sdp;
    
    if (!this.config.sdpManipulation.enabled) {
      return { sdp, modifications };
    }
    
    // Force specific codec if configured
    if (this.config.sdpManipulation.forceCodec) {
      const result = this.forceCodec(modifiedSdp, this.config.sdpManipulation.forceCodec);
      modifiedSdp = result.sdp;
      modifications.push(...result.modifications);
    }
    
    // Force specific bitrate if configured
    if (this.config.sdpManipulation.forceBitrate) {
      const result = this.forceBitrate(modifiedSdp, this.config.sdpManipulation.forceBitrate);
      modifiedSdp = result.sdp;
      modifications.push(...result.modifications);
    }
    
    // Inject custom SDP attributes for stealth
    if (this.config.sdpManipulation.injectCustomSdp) {
      const result = this.injectStealthAttributes(modifiedSdp);
      modifiedSdp = result.sdp;
      modifications.push(...result.modifications);
    }
    
    return { sdp: modifiedSdp, modifications };
  }

  private forceCodec(sdp: string, codec: string): SDPManipulationResult {
    const modifications: SDPModification[] = [];
    const lines = sdp.split('\r\n');
    const codecPayloads = this.findCodecPayloads(lines, codec);
    
    if (codecPayloads.length === 0) {
      return { sdp, modifications };
    }
    
    // Reorder m=video line to prioritize our codec
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('m=video')) {
        const original = lines[i];
        const parts = lines[i].split(' ');
        const payloads = parts.slice(3);
        
        // Move our codec payloads to the front
        const reordered = [
          ...codecPayloads.filter(p => payloads.includes(p.toString())),
          ...payloads.filter(p => !codecPayloads.includes(parseInt(p))),
        ];
        
        lines[i] = `${parts.slice(0, 3).join(' ')} ${reordered.join(' ')}`;
        
        modifications.push({
          type: 'codec_change',
          original,
          modified: lines[i],
          line: i,
        });
        break;
      }
    }
    
    return { sdp: lines.join('\r\n'), modifications };
  }

  private findCodecPayloads(lines: string[], codecName: string): number[] {
    const payloads: number[] = [];
    const codecUpper = codecName.toUpperCase();
    
    for (const line of lines) {
      if (line.startsWith('a=rtpmap:')) {
        const match = line.match(/a=rtpmap:(\d+)\s+(\w+)/);
        if (match && match[2].toUpperCase() === codecUpper) {
          payloads.push(parseInt(match[1]));
        }
      }
    }
    
    return payloads;
  }

  private forceBitrate(sdp: string, bitrate: number): SDPManipulationResult {
    const modifications: SDPModification[] = [];
    const lines = sdp.split('\r\n');
    
    // Find or add b=AS line after m=video
    let inVideoSection = false;
    let insertIndex = -1;
    
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('m=video')) {
        inVideoSection = true;
        insertIndex = i + 1;
      } else if (lines[i].startsWith('m=') && inVideoSection) {
        break;
      } else if (inVideoSection && lines[i].startsWith('b=AS:')) {
        const original = lines[i];
        lines[i] = `b=AS:${Math.floor(bitrate / 1000)}`;
        
        modifications.push({
          type: 'bitrate_change',
          original,
          modified: lines[i],
          line: i,
        });
        insertIndex = -1;
        break;
      }
    }
    
    if (insertIndex > 0) {
      const newLine = `b=AS:${Math.floor(bitrate / 1000)}`;
      lines.splice(insertIndex, 0, newLine);
      
      modifications.push({
        type: 'bitrate_change',
        original: '',
        modified: newLine,
        line: insertIndex,
      });
    }
    
    return { sdp: lines.join('\r\n'), modifications };
  }

  private injectStealthAttributes(sdp: string): SDPManipulationResult {
    const modifications: SDPModification[] = [];
    const lines = sdp.split('\r\n');
    
    // Find session-level section (before first m= line)
    let insertIndex = 0;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('m=')) {
        insertIndex = i;
        break;
      }
    }
    
    // Add realistic session attributes
    const stealthAttributes = [
      'a=ice-options:trickle',
      'a=ice-lite',
    ];
    
    // Only add if not already present
    for (const attr of stealthAttributes) {
      const attrKey = attr.split(':')[0];
      if (!lines.some(l => l.startsWith(attrKey))) {
        lines.splice(insertIndex, 0, attr);
        insertIndex++;
        
        modifications.push({
          type: 'custom',
          original: '',
          modified: attr,
          line: insertIndex - 1,
        });
      }
    }
    
    return { sdp: lines.join('\r\n'), modifications };
  }

  /**
   * Create a minimal SDP for local relay connections
   */
  createLocalRelaySDP(videoTrack: MediaStreamTrack): string {
    const now = Date.now();
    
    return `v=0
o=- ${now} ${now} IN IP4 127.0.0.1
s=Local Relay Session
t=0 0
a=group:BUNDLE 0
a=msid-semantic: WMS localStream
m=video 9 UDP/TLS/RTP/SAVPF 96 97 98 99
c=IN IP4 0.0.0.0
a=rtcp:9 IN IP4 0.0.0.0
a=ice-ufrag:${this.generateIceUfrag()}
a=ice-pwd:${this.generateIcePwd()}
a=ice-options:trickle
a=fingerprint:sha-256 ${this.generateFingerprint()}
a=setup:actpass
a=mid:0
a=extmap:1 urn:ietf:params:rtp-hdrext:toffset
a=extmap:2 http://www.webrtc.org/experiments/rtp-hdrext/abs-send-time
a=sendrecv
a=rtcp-mux
a=rtpmap:96 VP8/90000
a=rtcp-fb:96 ccm fir
a=rtcp-fb:96 nack
a=rtcp-fb:96 nack pli
a=rtpmap:97 VP9/90000
a=rtcp-fb:97 ccm fir
a=rtcp-fb:97 nack
a=rtcp-fb:97 nack pli
a=rtpmap:98 H264/90000
a=rtcp-fb:98 ccm fir
a=rtcp-fb:98 nack
a=rtcp-fb:98 nack pli
a=fmtp:98 level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=42e01f
a=rtpmap:99 rtx/90000
a=fmtp:99 apt=96
a=ssrc:${this.generateSSRC()} cname:${this.generateCname()}
a=ssrc:${this.generateSSRC()} msid:localStream ${videoTrack.id}
a=ssrc:${this.generateSSRC()} mslabel:localStream
a=ssrc:${this.generateSSRC()} label:${videoTrack.id}
`;
  }

  private generateIceUfrag(): string {
    return Array.from({ length: 4 }, () => 
      Math.random().toString(36).charAt(2)
    ).join('');
  }

  private generateIcePwd(): string {
    return Array.from({ length: 24 }, () => 
      Math.random().toString(36).charAt(2)
    ).join('');
  }

  private generateFingerprint(): string {
    return Array.from({ length: 32 }, () => 
      Math.floor(Math.random() * 256).toString(16).padStart(2, '0').toUpperCase()
    ).join(':');
  }

  private generateSSRC(): number {
    return Math.floor(Math.random() * 4294967295);
  }

  private generateCname(): string {
    return `cname_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
  }
}

// ============================================================================
// WEBRTC RELAY CLASS
// ============================================================================

export class WebRTCRelay {
  private config: WebRTCRelayConfig;
  private state: WebRTCRelayState;
  private iceCandidateGenerator: VirtualIceCandidateGenerator;
  private sdpManipulator: SDPManipulator;
  private peerConnections: Map<string, PeerConnectionWrapper> = new Map();
  private injectedStream?: MediaStream;
  private originalRTCPeerConnection: typeof RTCPeerConnection | null = null;
  private isIntercepting: boolean = false;

  constructor(config: Partial<WebRTCRelayConfig> = {}) {
    this.config = { ...DEFAULT_WEBRTC_RELAY_CONFIG, ...config };
    this.state = {
      isActive: false,
      signalingConnected: false,
      peerConnectionState: 'not_initialized',
      iceGatheringState: 'not_initialized',
      localCandidates: 0,
      remoteCandidates: 0,
      activeStreams: 0,
      bytesReceived: 0,
      bytesSent: 0,
    };
    
    this.iceCandidateGenerator = new VirtualIceCandidateGenerator(this.config);
    this.sdpManipulator = new SDPManipulator(this.config);
  }

  /**
   * Initialize the WebRTC relay
   */
  async initialize(): Promise<void> {
    console.log('[WebRTCRelay] Initializing...');
    
    if (typeof RTCPeerConnection === 'undefined') {
      console.warn('[WebRTCRelay] RTCPeerConnection not available');
      return;
    }
    
    // Store original RTCPeerConnection
    this.originalRTCPeerConnection = RTCPeerConnection;
    
    // Start intercepting WebRTC connections
    this.startInterception();
    
    this.state.isActive = true;
    console.log('[WebRTCRelay] Initialized');
  }

  /**
   * Set the stream to inject into WebRTC connections
   */
  setInjectedStream(stream: MediaStream): void {
    this.injectedStream = stream;
    this.state.activeStreams = stream.getTracks().length;
    
    // Update existing connections
    this.peerConnections.forEach(wrapper => {
      this.injectStreamIntoConnection(wrapper);
    });
    
    console.log('[WebRTCRelay] Injected stream set:', stream.getTracks().length, 'tracks');
  }

  /**
   * Start intercepting RTCPeerConnection
   */
  private startInterception(): void {
    if (this.isIntercepting) return;
    this.isIntercepting = true;
    
    const relay = this;
    const OriginalPC = this.originalRTCPeerConnection!;
    
    // Create proxy constructor
    const ProxyPeerConnection = function(this: RTCPeerConnection, config?: RTCConfiguration) {
      console.log('[WebRTCRelay] Intercepted RTCPeerConnection creation');
      
      // Modify ICE configuration if needed
      const modifiedConfig = relay.modifyIceConfiguration(config);
      
      // Create actual connection
      const pc = new OriginalPC(modifiedConfig);
      
      // Wrap and track the connection
      const wrapper = relay.wrapPeerConnection(pc);
      
      return wrapper.proxyPC;
    } as unknown as typeof RTCPeerConnection;
    
    // Copy static properties
    ProxyPeerConnection.prototype = OriginalPC.prototype;
    Object.setPrototypeOf(ProxyPeerConnection, OriginalPC);
    
    // Replace global RTCPeerConnection
    (window as unknown as { RTCPeerConnection: typeof RTCPeerConnection }).RTCPeerConnection = ProxyPeerConnection;
    
    console.log('[WebRTCRelay] RTCPeerConnection interception active');
  }

  /**
   * Modify ICE configuration
   */
  private modifyIceConfiguration(config?: RTCConfiguration): RTCConfiguration {
    const modifiedConfig: RTCConfiguration = { ...config };
    
    // Apply ICE transport policy
    if (this.config.iceTransportPolicy) {
      modifiedConfig.iceTransportPolicy = this.config.iceTransportPolicy;
    }
    
    // Inject virtual TURN server if enabled
    if (this.config.virtualTurnEnabled) {
      modifiedConfig.iceServers = [
        ...(config?.iceServers || []),
        {
          urls: `turn:127.0.0.1:${this.config.localSignalingPort}`,
          username: this.config.virtualTurnCredentials.username,
          credential: this.config.virtualTurnCredentials.credential,
        },
      ];
    }
    
    return modifiedConfig;
  }

  /**
   * Wrap a PeerConnection with our proxy
   */
  private wrapPeerConnection(originalPC: RTCPeerConnection): PeerConnectionWrapper {
    const id = `pc_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
    const relay = this;
    
    // Create a proxy for the peer connection
    const handler: ProxyHandler<RTCPeerConnection> = {
      get(target, prop, receiver) {
        const value = Reflect.get(target, prop, receiver);
        
        // Intercept createOffer
        if (prop === 'createOffer') {
          return async function(options?: RTCOfferOptions) {
            const offer = await target.createOffer(options);
            const manipulated = relay.sdpManipulator.manipulateSDP(offer.sdp || '', 'offer');
            return { ...offer, sdp: manipulated.sdp };
          };
        }
        
        // Intercept createAnswer
        if (prop === 'createAnswer') {
          return async function(options?: RTCAnswerOptions) {
            const answer = await target.createAnswer(options);
            const manipulated = relay.sdpManipulator.manipulateSDP(answer.sdp || '', 'answer');
            return { ...answer, sdp: manipulated.sdp };
          };
        }
        
        // Intercept addTrack to potentially replace tracks
        if (prop === 'addTrack') {
          return function(track: MediaStreamTrack, ...streams: MediaStream[]) {
            // If we have an injected stream and this is a video track, use ours
            if (relay.injectedStream && track.kind === 'video') {
              const injectedTrack = relay.injectedStream.getVideoTracks()[0];
              if (injectedTrack) {
                console.log('[WebRTCRelay] Replacing video track with injected stream');
                return target.addTrack(injectedTrack, ...streams);
              }
            }
            return target.addTrack(track, ...streams);
          };
        }
        
        // Intercept getSenders to report our tracks
        if (prop === 'getSenders') {
          return function() {
            const senders = target.getSenders();
            // Could modify senders here if needed
            return senders;
          };
        }
        
        if (typeof value === 'function') {
          return value.bind(target);
        }
        
        return value;
      },
      
      set(target, prop, value) {
        // Intercept ontrack to potentially modify incoming tracks
        if (prop === 'ontrack') {
          const originalHandler = value as ((event: RTCTrackEvent) => void) | null;
          
          target.ontrack = originalHandler ? function(event: RTCTrackEvent) {
            // Could modify incoming tracks here
            relay.state.bytesReceived += 1; // Placeholder metric
            originalHandler.call(target, event);
          } : null;
          
          return true;
        }
        
        return Reflect.set(target, prop, value);
      },
    };
    
    const proxyPC = new Proxy(originalPC, handler);
    
    const wrapper: PeerConnectionWrapper = {
      id,
      originalPC,
      proxyPC,
      injectedStream: this.injectedStream,
      state: originalPC.connectionState,
      createdAt: Date.now(),
    };
    
    // Track connection state changes
    originalPC.onconnectionstatechange = () => {
      wrapper.state = originalPC.connectionState;
      this.state.peerConnectionState = originalPC.connectionState;
      console.log(`[WebRTCRelay] Connection ${id} state:`, originalPC.connectionState);
    };
    
    // Track ICE gathering state
    originalPC.onicegatheringstatechange = () => {
      this.state.iceGatheringState = originalPC.iceGatheringState;
    };
    
    // Inject virtual ICE candidates
    if (this.config.stealth.randomizeIceCandidates) {
      this.injectVirtualCandidates(originalPC);
    }
    
    this.peerConnections.set(id, wrapper);
    console.log(`[WebRTCRelay] Wrapped connection: ${id}`);
    
    return wrapper;
  }

  /**
   * Inject virtual ICE candidates
   */
  private injectVirtualCandidates(pc: RTCPeerConnection): void {
    const originalOnIceCandidate = pc.onicecandidate;
    
    pc.onicecandidate = (event) => {
      // Generate additional virtual candidates
      if (event.candidate) {
        this.state.localCandidates++;
        
        // Add realistic latency if configured
        if (this.config.stealth.addRealisticLatency) {
          const [minLatency, maxLatency] = this.config.stealth.latencyRangeMs;
          const delay = minLatency + Math.random() * (maxLatency - minLatency);
          
          setTimeout(() => {
            if (originalOnIceCandidate) {
              originalOnIceCandidate.call(pc, event);
            }
          }, delay);
          return;
        }
      }
      
      if (originalOnIceCandidate) {
        originalOnIceCandidate.call(pc, event);
      }
    };
  }

  /**
   * Inject stream into existing connection
   */
  private injectStreamIntoConnection(wrapper: PeerConnectionWrapper): void {
    if (!this.injectedStream) return;
    
    const videoTrack = this.injectedStream.getVideoTracks()[0];
    if (!videoTrack) return;
    
    const senders = wrapper.originalPC.getSenders();
    const videoSender = senders.find(s => s.track?.kind === 'video');
    
    if (videoSender) {
      videoSender.replaceTrack(videoTrack).then(() => {
        console.log(`[WebRTCRelay] Replaced track in connection ${wrapper.id}`);
      }).catch(err => {
        console.error(`[WebRTCRelay] Failed to replace track:`, err);
      });
    }
    
    wrapper.injectedStream = this.injectedStream;
  }

  /**
   * Stop interception and restore original RTCPeerConnection
   */
  stopInterception(): void {
    if (!this.isIntercepting || !this.originalRTCPeerConnection) return;
    
    (window as unknown as { RTCPeerConnection: typeof RTCPeerConnection }).RTCPeerConnection = this.originalRTCPeerConnection;
    this.isIntercepting = false;
    
    console.log('[WebRTCRelay] Interception stopped');
  }

  /**
   * Get current state
   */
  getState(): WebRTCRelayState {
    return { ...this.state };
  }

  /**
   * Get statistics
   */
  getStats(): {
    connections: number;
    activeConnections: number;
    totalBytesReceived: number;
    totalBytesSent: number;
  } {
    let activeConnections = 0;
    
    this.peerConnections.forEach(wrapper => {
      if (wrapper.state === 'connected') {
        activeConnections++;
      }
    });
    
    return {
      connections: this.peerConnections.size,
      activeConnections,
      totalBytesReceived: this.state.bytesReceived,
      totalBytesSent: this.state.bytesSent,
    };
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.stopInterception();
    
    this.peerConnections.forEach(wrapper => {
      try {
        wrapper.originalPC.close();
      } catch (e) {
        // Ignore errors during cleanup
      }
    });
    
    this.peerConnections.clear();
    this.state.isActive = false;
    
    console.log('[WebRTCRelay] Destroyed');
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export { VirtualIceCandidateGenerator, SDPManipulator };
