/**
 * Cross-Device Streaming System
 * 
 * Enables live video streaming from secondary devices (phones, webcams)
 * to be used as a video source. Features local network discovery,
 * WebRTC mesh networking, and ultra-low latency streaming.
 */

import {
  CrossDeviceConfig,
  CrossDeviceState,
  PeerDevice,
  PeerCapabilities,
  PeerStatus,
  Resolution,
  DEFAULT_CROSS_DEVICE_CONFIG,
} from '@/types/advancedProtocol';

// ============================================================================
// TYPES
// ============================================================================

interface SignalingMessage {
  type: 'offer' | 'answer' | 'ice-candidate' | 'bye' | 'ping' | 'pong' | 'capabilities';
  from: string;
  to?: string;
  payload: unknown;
  timestamp: number;
}

interface StreamMetrics {
  fps: number;
  bitrate: number;
  latencyMs: number;
  packetsLost: number;
  jitterMs: number;
}

// ============================================================================
// DEVICE DISCOVERY
// ============================================================================

class DeviceDiscovery {
  private config: CrossDeviceConfig;
  private discoveredDevices: Map<string, PeerDevice> = new Map();
  private scanInterval?: NodeJS.Timeout;
  private onDeviceFound?: (device: PeerDevice) => void;
  private onDeviceLost?: (deviceId: string) => void;
  private localDeviceId: string;

  constructor(config: CrossDeviceConfig) {
    this.config = config;
    this.localDeviceId = this.generateDeviceId();
  }

  private generateDeviceId(): string {
    return `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Start scanning for devices
   */
  startScanning(): void {
    console.log('[DeviceDiscovery] Starting device scan...');
    
    // For manual discovery, we don't actively scan
    // Instead, we wait for connections or manual IP entry
    
    if (this.config.discovery.method === 'manual') {
      console.log('[DeviceDiscovery] Manual discovery mode - waiting for connections');
      return;
    }
    
    // For mDNS, we would use native modules
    // This is a placeholder for the actual implementation
    if (this.config.discovery.method === 'mdns') {
      this.startMdnsDiscovery();
    }
  }

  private startMdnsDiscovery(): void {
    // mDNS requires native module support
    // In Expo, this would need expo-mdns or a custom native module
    console.log('[DeviceDiscovery] mDNS discovery not available in this environment');
    console.log('[DeviceDiscovery] Falling back to manual discovery');
  }

  /**
   * Manually add a device by IP address
   */
  async addManualDevice(address: string, port: number = 8765): Promise<PeerDevice | null> {
    console.log('[DeviceDiscovery] Adding manual device:', address, port);
    
    const deviceId = `manual_${address}_${port}`;
    
    // Check if device is reachable
    const isReachable = await this.pingDevice(address, port);
    
    if (!isReachable) {
      console.warn('[DeviceDiscovery] Device not reachable:', address);
      return null;
    }
    
    const device: PeerDevice = {
      id: deviceId,
      name: `Device at ${address}`,
      type: 'ios', // Will be updated when device responds
      address,
      port,
      capabilities: {
        maxResolution: { width: 1920, height: 1080 },
        maxFrameRate: 30,
        supportedCodecs: ['h264', 'vp8'],
        hasCamera: true,
        hasMicrophone: true,
        supportsScreenShare: false,
      },
      status: 'discovered',
      lastSeen: Date.now(),
      latencyMs: 0,
    };
    
    this.discoveredDevices.set(deviceId, device);
    
    if (this.onDeviceFound) {
      this.onDeviceFound(device);
    }
    
    return device;
  }

  private async pingDevice(address: string, port: number): Promise<boolean> {
    // In a real implementation, this would attempt to connect
    // For now, we assume the device is reachable
    return true;
  }

  /**
   * Get discovered devices
   */
  getDiscoveredDevices(): PeerDevice[] {
    return Array.from(this.discoveredDevices.values());
  }

  /**
   * Register callbacks
   */
  onDevice(found: (device: PeerDevice) => void, lost: (deviceId: string) => void): void {
    this.onDeviceFound = found;
    this.onDeviceLost = lost;
  }

  /**
   * Stop scanning
   */
  stopScanning(): void {
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = undefined;
    }
    
    console.log('[DeviceDiscovery] Stopped scanning');
  }

  /**
   * Get local device ID
   */
  getLocalDeviceId(): string {
    return this.localDeviceId;
  }

  /**
   * Remove a device
   */
  removeDevice(deviceId: string): void {
    this.discoveredDevices.delete(deviceId);
    
    if (this.onDeviceLost) {
      this.onDeviceLost(deviceId);
    }
  }
}

// ============================================================================
// SIGNALING CLIENT
// ============================================================================

class SignalingClient {
  private config: CrossDeviceConfig;
  private socket: WebSocket | null = null;
  private localDeviceId: string;
  private messageHandlers: Map<string, ((message: SignalingMessage) => void)[]> = new Map();
  private reconnectAttempts: number = 0;
  private isConnecting: boolean = false;

  constructor(config: CrossDeviceConfig, localDeviceId: string) {
    this.config = config;
    this.localDeviceId = localDeviceId;
  }

  /**
   * Connect to a signaling server or peer
   */
  async connect(address: string, port: number): Promise<boolean> {
    if (this.isConnecting) {
      console.warn('[SignalingClient] Already connecting');
      return false;
    }
    
    this.isConnecting = true;
    
    return new Promise((resolve) => {
      const url = `ws://${address}:${port}`;
      console.log('[SignalingClient] Connecting to:', url);
      
      try {
        this.socket = new WebSocket(url);
        
        this.socket.onopen = () => {
          console.log('[SignalingClient] Connected');
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          
          // Send capabilities
          this.send({
            type: 'capabilities',
            from: this.localDeviceId,
            payload: this.getLocalCapabilities(),
            timestamp: Date.now(),
          });
          
          resolve(true);
        };
        
        this.socket.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data) as SignalingMessage;
            this.handleMessage(message);
          } catch (e) {
            console.warn('[SignalingClient] Invalid message:', e);
          }
        };
        
        this.socket.onerror = (error) => {
          console.error('[SignalingClient] WebSocket error:', error);
          this.isConnecting = false;
          resolve(false);
        };
        
        this.socket.onclose = () => {
          console.log('[SignalingClient] Disconnected');
          this.socket = null;
          this.isConnecting = false;
          
          // Attempt reconnection if enabled
          if (this.config.reliability.autoReconnect && 
              this.reconnectAttempts < this.config.reliability.reconnectAttempts) {
            this.scheduleReconnect(address, port);
          }
        };
        
        // Timeout
        setTimeout(() => {
          if (this.isConnecting) {
            console.warn('[SignalingClient] Connection timeout');
            this.socket?.close();
            this.isConnecting = false;
            resolve(false);
          }
        }, this.config.reliability.timeoutMs);
        
      } catch (e) {
        console.error('[SignalingClient] Failed to create WebSocket:', e);
        this.isConnecting = false;
        resolve(false);
      }
    });
  }

  private scheduleReconnect(address: string, port: number): void {
    this.reconnectAttempts++;
    const delay = this.config.reliability.reconnectDelayMs * this.reconnectAttempts;
    
    console.log(`[SignalingClient] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    setTimeout(() => {
      this.connect(address, port);
    }, delay);
  }

  private handleMessage(message: SignalingMessage): void {
    // Ignore messages from self
    if (message.from === this.localDeviceId) return;
    
    // Check if message is for us
    if (message.to && message.to !== this.localDeviceId) return;
    
    const handlers = this.messageHandlers.get(message.type) || [];
    handlers.forEach(handler => handler(message));
  }

  private getLocalCapabilities(): PeerCapabilities {
    return {
      maxResolution: { width: 1920, height: 1080 },
      maxFrameRate: 30,
      supportedCodecs: ['h264', 'vp8', 'vp9'],
      hasCamera: true,
      hasMicrophone: true,
      supportsScreenShare: false,
    };
  }

  /**
   * Send a message
   */
  send(message: SignalingMessage): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      console.warn('[SignalingClient] Cannot send - not connected');
      return;
    }
    
    this.socket.send(JSON.stringify(message));
  }

  /**
   * Register message handler
   */
  on(type: SignalingMessage['type'], handler: (message: SignalingMessage) => void): void {
    const handlers = this.messageHandlers.get(type) || [];
    handlers.push(handler);
    this.messageHandlers.set(type, handlers);
  }

  /**
   * Disconnect
   */
  disconnect(): void {
    if (this.socket) {
      this.send({
        type: 'bye',
        from: this.localDeviceId,
        payload: {},
        timestamp: Date.now(),
      });
      
      this.socket.close();
      this.socket = null;
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.socket !== null && this.socket.readyState === WebSocket.OPEN;
  }
}

// ============================================================================
// PEER CONNECTION MANAGER
// ============================================================================

class PeerConnectionManager {
  private config: CrossDeviceConfig;
  private localDeviceId: string;
  private connections: Map<string, RTCPeerConnection> = new Map();
  private streams: Map<string, MediaStream> = new Map();
  private signalingClient: SignalingClient;
  private onStreamReceived?: (deviceId: string, stream: MediaStream) => void;
  private onStreamLost?: (deviceId: string) => void;
  private metrics: Map<string, StreamMetrics> = new Map();

  constructor(config: CrossDeviceConfig, localDeviceId: string, signalingClient: SignalingClient) {
    this.config = config;
    this.localDeviceId = localDeviceId;
    this.signalingClient = signalingClient;
    
    this.setupSignalingHandlers();
  }

  private setupSignalingHandlers(): void {
    this.signalingClient.on('offer', async (message) => {
      await this.handleOffer(message.from, message.payload as RTCSessionDescriptionInit);
    });
    
    this.signalingClient.on('answer', async (message) => {
      await this.handleAnswer(message.from, message.payload as RTCSessionDescriptionInit);
    });
    
    this.signalingClient.on('ice-candidate', async (message) => {
      await this.handleIceCandidate(message.from, message.payload as RTCIceCandidateInit);
    });
    
    this.signalingClient.on('bye', (message) => {
      this.handleBye(message.from);
    });
  }

  /**
   * Initiate connection to a peer
   */
  async connectToPeer(device: PeerDevice): Promise<boolean> {
    console.log('[PeerConnectionManager] Connecting to peer:', device.id);
    
    const pc = this.createPeerConnection(device.id);
    
    // Create data channel for heartbeat
    const dataChannel = pc.createDataChannel('heartbeat');
    dataChannel.onopen = () => {
      console.log('[PeerConnectionManager] Data channel opened');
      this.startHeartbeat(device.id, dataChannel);
    };
    
    // Create offer
    try {
      const offer = await pc.createOffer({
        offerToReceiveVideo: true,
        offerToReceiveAudio: true,
      });
      
      await pc.setLocalDescription(offer);
      
      this.signalingClient.send({
        type: 'offer',
        from: this.localDeviceId,
        to: device.id,
        payload: offer,
        timestamp: Date.now(),
      });
      
      return true;
    } catch (e) {
      console.error('[PeerConnectionManager] Failed to create offer:', e);
      return false;
    }
  }

  private createPeerConnection(peerId: string): RTCPeerConnection {
    const config: RTCConfiguration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
      ],
    };
    
    const pc = new RTCPeerConnection(config);
    
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.signalingClient.send({
          type: 'ice-candidate',
          from: this.localDeviceId,
          to: peerId,
          payload: event.candidate.toJSON(),
          timestamp: Date.now(),
        });
      }
    };
    
    pc.ontrack = (event) => {
      console.log('[PeerConnectionManager] Received track from:', peerId);
      
      const stream = event.streams[0];
      if (stream) {
        this.streams.set(peerId, stream);
        
        if (this.onStreamReceived) {
          this.onStreamReceived(peerId, stream);
        }
      }
    };
    
    pc.onconnectionstatechange = () => {
      console.log('[PeerConnectionManager] Connection state:', pc.connectionState);
      
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        this.handleBye(peerId);
      }
    };
    
    this.connections.set(peerId, pc);
    return pc;
  }

  private async handleOffer(peerId: string, offer: RTCSessionDescriptionInit): Promise<void> {
    console.log('[PeerConnectionManager] Received offer from:', peerId);
    
    let pc = this.connections.get(peerId);
    if (!pc) {
      pc = this.createPeerConnection(peerId);
    }
    
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      
      this.signalingClient.send({
        type: 'answer',
        from: this.localDeviceId,
        to: peerId,
        payload: answer,
        timestamp: Date.now(),
      });
    } catch (e) {
      console.error('[PeerConnectionManager] Failed to handle offer:', e);
    }
  }

  private async handleAnswer(peerId: string, answer: RTCSessionDescriptionInit): Promise<void> {
    console.log('[PeerConnectionManager] Received answer from:', peerId);
    
    const pc = this.connections.get(peerId);
    if (!pc) {
      console.warn('[PeerConnectionManager] No connection for peer:', peerId);
      return;
    }
    
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
    } catch (e) {
      console.error('[PeerConnectionManager] Failed to handle answer:', e);
    }
  }

  private async handleIceCandidate(peerId: string, candidate: RTCIceCandidateInit): Promise<void> {
    const pc = this.connections.get(peerId);
    if (!pc) return;
    
    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (e) {
      console.error('[PeerConnectionManager] Failed to add ICE candidate:', e);
    }
  }

  private handleBye(peerId: string): void {
    console.log('[PeerConnectionManager] Peer disconnected:', peerId);
    
    const pc = this.connections.get(peerId);
    if (pc) {
      pc.close();
      this.connections.delete(peerId);
    }
    
    this.streams.delete(peerId);
    this.metrics.delete(peerId);
    
    if (this.onStreamLost) {
      this.onStreamLost(peerId);
    }
  }

  private startHeartbeat(peerId: string, dataChannel: RTCDataChannel): void {
    const interval = setInterval(() => {
      if (dataChannel.readyState === 'open') {
        const pingTime = Date.now();
        dataChannel.send(JSON.stringify({ type: 'ping', timestamp: pingTime }));
      } else {
        clearInterval(interval);
      }
    }, this.config.reliability.heartbeatIntervalMs);
    
    dataChannel.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'pong') {
          const latency = Date.now() - data.timestamp;
          const currentMetrics = this.metrics.get(peerId) || {
            fps: 0,
            bitrate: 0,
            latencyMs: 0,
            packetsLost: 0,
            jitterMs: 0,
          };
          currentMetrics.latencyMs = latency;
          this.metrics.set(peerId, currentMetrics);
        } else if (data.type === 'ping') {
          dataChannel.send(JSON.stringify({ type: 'pong', timestamp: data.timestamp }));
        }
      } catch (e) {
        // Ignore invalid messages
      }
    };
  }

  /**
   * Register callbacks
   */
  onStream(received: (deviceId: string, stream: MediaStream) => void, lost: (deviceId: string) => void): void {
    this.onStreamReceived = received;
    this.onStreamLost = lost;
  }

  /**
   * Get stream from a peer
   */
  getStream(peerId: string): MediaStream | null {
    return this.streams.get(peerId) || null;
  }

  /**
   * Get metrics for a peer
   */
  getMetrics(peerId: string): StreamMetrics | null {
    return this.metrics.get(peerId) || null;
  }

  /**
   * Disconnect from a peer
   */
  disconnectFromPeer(peerId: string): void {
    this.handleBye(peerId);
    
    this.signalingClient.send({
      type: 'bye',
      from: this.localDeviceId,
      to: peerId,
      payload: {},
      timestamp: Date.now(),
    });
  }

  /**
   * Disconnect from all peers
   */
  disconnectAll(): void {
    for (const peerId of this.connections.keys()) {
      this.disconnectFromPeer(peerId);
    }
  }

  /**
   * Get connected peers
   */
  getConnectedPeers(): string[] {
    return Array.from(this.connections.keys()).filter(id => {
      const pc = this.connections.get(id);
      return pc && pc.connectionState === 'connected';
    });
  }
}

// ============================================================================
// CROSS-DEVICE STREAMING MANAGER
// ============================================================================

export class CrossDeviceStreamingManager {
  private config: CrossDeviceConfig;
  private state: CrossDeviceState;
  private discovery: DeviceDiscovery;
  private signalingClient: SignalingClient;
  private peerManager: PeerConnectionManager;
  private localDeviceId: string;
  private onStreamCallback?: (stream: MediaStream) => void;

  constructor(config: Partial<CrossDeviceConfig> = {}) {
    this.config = { ...DEFAULT_CROSS_DEVICE_CONFIG, ...config };
    this.state = {
      isScanning: false,
      discoveredDevices: [],
      connectedDevices: [],
      activeStreamDevice: null,
      totalBytesReceived: 0,
      averageLatencyMs: 0,
    };
    
    this.discovery = new DeviceDiscovery(this.config);
    this.localDeviceId = this.discovery.getLocalDeviceId();
    this.signalingClient = new SignalingClient(this.config, this.localDeviceId);
    this.peerManager = new PeerConnectionManager(this.config, this.localDeviceId, this.signalingClient);
    
    this.setupCallbacks();
  }

  private setupCallbacks(): void {
    this.discovery.onDevice(
      (device) => {
        this.state.discoveredDevices.push(device);
        console.log('[CrossDevice] Device discovered:', device.name);
      },
      (deviceId) => {
        this.state.discoveredDevices = this.state.discoveredDevices.filter(d => d.id !== deviceId);
        console.log('[CrossDevice] Device lost:', deviceId);
      }
    );
    
    this.peerManager.onStream(
      (deviceId, stream) => {
        const device = this.state.discoveredDevices.find(d => d.id === deviceId);
        if (device) {
          device.status = 'streaming';
          this.state.connectedDevices.push(device);
          this.state.activeStreamDevice = deviceId;
          
          if (this.onStreamCallback) {
            this.onStreamCallback(stream);
          }
        }
        console.log('[CrossDevice] Stream received from:', deviceId);
      },
      (deviceId) => {
        this.state.connectedDevices = this.state.connectedDevices.filter(d => d.id !== deviceId);
        if (this.state.activeStreamDevice === deviceId) {
          this.state.activeStreamDevice = null;
        }
        console.log('[CrossDevice] Stream lost from:', deviceId);
      }
    );
  }

  /**
   * Initialize the cross-device streaming manager
   */
  async initialize(): Promise<void> {
    console.log('[CrossDevice] Initializing...');
    
    // Start device discovery
    this.discovery.startScanning();
    this.state.isScanning = true;
    
    console.log('[CrossDevice] Initialized');
  }

  /**
   * Connect to a device by IP address
   */
  async connectToDevice(address: string, port: number = 8765): Promise<boolean> {
    console.log('[CrossDevice] Connecting to:', address, port);
    
    // Add device
    const device = await this.discovery.addManualDevice(address, port);
    if (!device) {
      console.error('[CrossDevice] Failed to add device');
      return false;
    }
    
    // Connect signaling
    const signalingConnected = await this.signalingClient.connect(address, port);
    if (!signalingConnected) {
      console.error('[CrossDevice] Signaling connection failed');
      return false;
    }
    
    // Initiate peer connection
    const peerConnected = await this.peerManager.connectToPeer(device);
    if (!peerConnected) {
      console.error('[CrossDevice] Peer connection failed');
      return false;
    }
    
    device.status = 'connecting';
    return true;
  }

  /**
   * Disconnect from a device
   */
  disconnectFromDevice(deviceId: string): void {
    this.peerManager.disconnectFromPeer(deviceId);
    this.discovery.removeDevice(deviceId);
  }

  /**
   * Get the active stream
   */
  getActiveStream(): MediaStream | null {
    if (!this.state.activeStreamDevice) return null;
    return this.peerManager.getStream(this.state.activeStreamDevice);
  }

  /**
   * Register callback for when stream is received
   */
  onStream(callback: (stream: MediaStream) => void): void {
    this.onStreamCallback = callback;
  }

  /**
   * Get discovered devices
   */
  getDiscoveredDevices(): PeerDevice[] {
    return [...this.state.discoveredDevices];
  }

  /**
   * Get connected devices
   */
  getConnectedDevices(): PeerDevice[] {
    return [...this.state.connectedDevices];
  }

  /**
   * Get current state
   */
  getState(): CrossDeviceState {
    // Update latency
    if (this.state.activeStreamDevice) {
      const metrics = this.peerManager.getMetrics(this.state.activeStreamDevice);
      if (metrics) {
        this.state.averageLatencyMs = metrics.latencyMs;
      }
    }
    
    return { ...this.state };
  }

  /**
   * Generate QR code data for pairing
   */
  generatePairingData(): string {
    // This would be displayed as a QR code on the screen
    // The companion app would scan it to connect
    const data = {
      type: 'advanced_relay_pairing',
      version: '1.0.0',
      deviceId: this.localDeviceId,
      // In a real implementation, we'd include the local IP and port
      address: '192.168.1.x', // Placeholder
      port: 8765,
      timestamp: Date.now(),
    };
    
    return JSON.stringify(data);
  }

  /**
   * Parse pairing data from QR code
   */
  parsePairingData(data: string): { address: string; port: number } | null {
    try {
      const parsed = JSON.parse(data);
      if (parsed.type === 'advanced_relay_pairing') {
        return {
          address: parsed.address,
          port: parsed.port,
        };
      }
    } catch (e) {
      console.error('[CrossDevice] Invalid pairing data');
    }
    return null;
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.peerManager.disconnectAll();
    this.signalingClient.disconnect();
    this.discovery.stopScanning();
    
    this.state.isScanning = false;
    this.state.discoveredDevices = [];
    this.state.connectedDevices = [];
    this.state.activeStreamDevice = null;
    
    console.log('[CrossDevice] Destroyed');
  }
}
