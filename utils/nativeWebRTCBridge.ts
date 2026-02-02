import type { RefObject } from 'react';
import { Platform } from 'react-native';
import type { WebView } from 'react-native-webview';

type WebRTCOfferMessage = {
  type: 'nativeWebRTCOffer';
  payload: {
    requestId: string;
    sdp: string;
    constraints?: any;
  };
};

type WebRTCIceMessage = {
  type: 'nativeWebRTCIceCandidate';
  payload: {
    requestId: string;
    candidate: any;
  };
};

type WebRTCCloseMessage = {
  type: 'nativeWebRTCClose';
  payload: {
    requestId: string;
  };
};

type WebViewSignalMessage = WebRTCOfferMessage | WebRTCIceMessage | WebRTCCloseMessage;

type Session = {
  pc: any;
  stream?: any;
};

export class NativeWebRTCBridge {
  private webViewRef: RefObject<WebView>;
  private sessions = new Map<string, Session>();
  private webrtcModule: any | null | undefined = undefined;

  constructor(webViewRef: RefObject<WebView>) {
    this.webViewRef = webViewRef;
  }

  dispose() {
    this.sessions.forEach((session) => {
      this.cleanupSession(session);
    });
    this.sessions.clear();
  }

  async handleSignalMessage(message: any) {
    if (!message || !message.type || !message.payload) return;
    const payload = message.payload;
    if (message.type === 'nativeWebRTCOffer') {
      await this.handleOffer(payload);
    } else if (message.type === 'nativeWebRTCIceCandidate') {
      await this.handleIceCandidate(payload);
    } else if (message.type === 'nativeWebRTCClose') {
      this.closeSession(payload.requestId);
    }
  }

  private getWebRTCModule() {
    if (Platform.OS === 'web') return null;
    if (this.webrtcModule !== undefined) {
      return this.webrtcModule;
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      this.webrtcModule = require('react-native-webrtc');
    } catch (e) {
      this.webrtcModule = null;
    }
    return this.webrtcModule;
  }

  private sendToWebView(message: { type: string; requestId: string; sdp?: string; candidate?: any; message?: string }) {
    const payload = JSON.stringify(message);
    this.webViewRef.current?.injectJavaScript(`
      window.__nativeWebRTCBridgeHandleMessage && window.__nativeWebRTCBridgeHandleMessage(${payload});
      true;
    `);
  }

  private async handleOffer(payload: { requestId: string; sdp: string; constraints?: any }) {
    const webrtc = this.getWebRTCModule();
    if (!webrtc) {
      this.sendToWebView({
        type: 'error',
        requestId: payload.requestId,
        message: 'react-native-webrtc not available',
      });
      return;
    }

    const { RTCPeerConnection, RTCSessionDescription, mediaDevices } = webrtc;
    const pc = new RTCPeerConnection({ iceServers: [] });
    const session: Session = { pc };
    this.sessions.set(payload.requestId, session);

    pc.onicecandidate = (event: any) => {
      if (event && event.candidate) {
        this.sendToWebView({
          type: 'ice',
          requestId: payload.requestId,
          candidate: event.candidate,
        });
      }
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState || pc.iceConnectionState;
      if (state === 'failed' || state === 'closed' || state === 'disconnected') {
        this.closeSession(payload.requestId);
      }
    };

    try {
      const constraints = payload.constraints || {};
      const wantsVideo = Boolean(constraints.video);
      const wantsAudio = Boolean(constraints.audio);
      const mediaConstraints = {
        video: wantsVideo ? (typeof constraints.video === 'object' ? constraints.video : true) : false,
        audio: wantsAudio ? (typeof constraints.audio === 'object' ? constraints.audio : true) : false,
      };

      const stream = await mediaDevices.getUserMedia(mediaConstraints);
      session.stream = stream;
      stream.getTracks().forEach((track: any) => pc.addTrack(track, stream));

      await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: payload.sdp }));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      this.sendToWebView({
        type: 'answer',
        requestId: payload.requestId,
        sdp: answer.sdp,
      });
    } catch (err: any) {
      this.sendToWebView({
        type: 'error',
        requestId: payload.requestId,
        message: err?.message || String(err),
      });
      this.closeSession(payload.requestId);
    }
  }

  private async handleIceCandidate(payload: { requestId: string; candidate: any }) {
    const webrtc = this.getWebRTCModule();
    if (!webrtc) return;
    const session = this.sessions.get(payload.requestId);
    if (!session) return;
    try {
      const candidate = new webrtc.RTCIceCandidate(payload.candidate);
      await session.pc.addIceCandidate(candidate);
    } catch (err) {
      // Ignore; candidate might arrive before remote description.
    }
  }

  private closeSession(requestId: string) {
    const session = this.sessions.get(requestId);
    if (!session) return;
    this.cleanupSession(session);
    this.sessions.delete(requestId);
  }

  private cleanupSession(session: Session) {
    if (session.stream) {
      try {
        session.stream.getTracks().forEach((track: any) => track.stop());
      } catch (e) {}
    }
    try {
      session.pc.close();
    } catch (e) {}
  }
}
