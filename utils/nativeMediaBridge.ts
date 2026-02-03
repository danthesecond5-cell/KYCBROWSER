import { NativeEventEmitter, NativeModules, Platform } from 'react-native';
import { requireNativeModule } from 'expo-modules-core';
import {
  RTCPeerConnection,
  RTCSessionDescription,
  RTCIceCandidate,
  mediaDevices,
  type MediaStream as RTCMediaStream,
} from 'react-native-webrtc';

import type {
  NativeGumOfferPayload,
  NativeGumAnswerPayload,
  NativeGumIcePayload,
  NativeGumErrorPayload,
  NativeGumCancelPayload,
} from '@/types/nativeMediaBridge';

type NativeBridgeHandlers = {
  onAnswer: (payload: NativeGumAnswerPayload) => void;
  onIceCandidate: (payload: NativeGumIcePayload) => void;
  onError: (payload: NativeGumErrorPayload) => void;
};

type NativeBridgeSession = {
  pc: RTCPeerConnection;
  stream: RTCMediaStream | null;
};

const sessions = new Map<string, NativeBridgeSession>();

let nativeBridge: {
  createSession?: (requestId: string, offer: RTCSessionDescriptionInit, constraints?: MediaStreamConstraints, rtcConfig?: RTCConfiguration) => Promise<RTCSessionDescriptionInit>;
  addIceCandidate?: (requestId: string, candidate: RTCIceCandidateInit) => Promise<void>;
  closeSession?: (requestId: string) => Promise<void>;
} | null = null;

try {
  nativeBridge = (NativeModules as any).NativeMediaBridge || requireNativeModule('NativeMediaBridge');
} catch {
  nativeBridge = null;
}

let nativeEmitter: NativeEventEmitter | null = null;
let nativeEmitterBound = false;

const ensureNativeEmitter = (handlers: NativeBridgeHandlers) => {
  if (!nativeBridge || nativeEmitterBound) return;
  nativeEmitter = new NativeEventEmitter(nativeBridge as any);
  nativeEmitter.addListener('nativeGumIce', (payload: NativeGumIcePayload) => {
    if (payload && payload.requestId && payload.candidate) {
      handlers.onIceCandidate(payload);
    }
  });
  nativeEmitter.addListener('nativeGumError', (payload: NativeGumErrorPayload) => {
    if (payload && payload.requestId) {
      handlers.onError(payload);
    }
  });
  nativeEmitterBound = true;
};

const DEFAULT_RTC_CONFIG: RTCConfiguration = {
  iceServers: [],
};

const buildError = (requestId: string, message: string, code?: string): NativeGumErrorPayload => ({
  requestId,
  message,
  code,
});

const normalizeConstraints = (constraints?: MediaStreamConstraints): MediaStreamConstraints => {
  if (!constraints) {
    return { video: true, audio: false };
  }
  const wantsVideo = constraints.video ?? true;
  const wantsAudio = constraints.audio ?? false;
  return { video: wantsVideo, audio: wantsAudio };
};

export async function handleNativeGumOffer(
  payload: NativeGumOfferPayload,
  handlers: NativeBridgeHandlers
): Promise<void> {
  const requestId = payload?.requestId;
  if (!requestId) {
    return;
  }

  if (Platform.OS !== 'ios') {
    handlers.onError(buildError(requestId, 'Native bridge only enabled on iOS', 'platform'));
    return;
  }

  if (nativeBridge?.createSession) {
    try {
      ensureNativeEmitter(handlers);
      const answer = await nativeBridge.createSession(
        requestId,
        payload.offer,
        payload.constraints,
        payload.rtcConfig
      );
      handlers.onAnswer({ requestId, answer });
      return;
    } catch (error) {
      handlers.onError(buildError(requestId, (error as Error)?.message || 'Native bridge error', 'native'));
      return;
    }
  }

  if (typeof RTCPeerConnection !== 'function' || !mediaDevices?.getUserMedia) {
    handlers.onError(buildError(requestId, 'react-native-webrtc is not available', 'missing_dependency'));
    return;
  }

  try {
    const pc = new RTCPeerConnection(payload?.rtcConfig || DEFAULT_RTC_CONFIG);
    sessions.set(requestId, { pc, stream: null });

    pc.onicecandidate = (event: RTCPeerConnectionIceEvent) => {
      if (event.candidate) {
        handlers.onIceCandidate({
          requestId,
          candidate: event.candidate.toJSON ? event.candidate.toJSON() : event.candidate,
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        handlers.onError(buildError(requestId, 'Native WebRTC connection failed', pc.connectionState));
        closeNativeGumSession({ requestId });
      }
    };

    // NOTE: This currently uses the real camera. Replace with a custom video capturer
    // for file-backed or synthetic streams once the iOS native module is ready.
    const stream = await mediaDevices.getUserMedia(normalizeConstraints(payload?.constraints));
    sessions.set(requestId, { pc, stream });

    stream.getTracks().forEach((track) => {
      pc.addTrack(track, stream);
    });

    await pc.setRemoteDescription(new RTCSessionDescription(payload.offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    handlers.onAnswer({
      requestId,
      answer: pc.localDescription?.toJSON ? pc.localDescription.toJSON() : pc.localDescription!,
    });
  } catch (error) {
    handlers.onError(buildError(requestId, (error as Error)?.message || 'Native bridge error', 'exception'));
    closeNativeGumSession({ requestId });
  }
}

export async function handleNativeGumIceCandidate(payload: NativeGumIcePayload): Promise<void> {
  const requestId = payload?.requestId;
  const candidate = payload?.candidate;
  if (!requestId || !candidate) return;

  if (nativeBridge?.addIceCandidate) {
    try {
      await nativeBridge.addIceCandidate(requestId, candidate);
    } catch {
      // Ignore ICE errors
    }
    return;
  }

  const session = sessions.get(requestId);
  if (!session) return;

  try {
    await session.pc.addIceCandidate(new RTCIceCandidate(candidate));
  } catch {
    // Ignore ICE errors for now (common during teardown).
  }
}

export function closeNativeGumSession(payload: NativeGumCancelPayload): void {
  const requestId = payload?.requestId;
  if (!requestId) return;

  if (nativeBridge?.closeSession) {
    nativeBridge.closeSession(requestId).catch(() => {});
    return;
  }

  const session = sessions.get(requestId);
  if (!session) return;

  try {
    session.stream?.getTracks().forEach((track) => track.stop());
  } catch {}

  try {
    session.pc.close();
  } catch {}

  sessions.delete(requestId);
}
