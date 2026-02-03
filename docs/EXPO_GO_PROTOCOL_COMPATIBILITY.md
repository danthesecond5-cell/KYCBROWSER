# Expo Go Protocol Compatibility Report

This report evaluates each protocol in the app against Expo Go runtime
constraints and documents the current compatibility posture.

## Runtime constraints in Expo Go

- Custom native modules are not available (no custom dev client).
- Enterprise WebKit flags are not available, so WebCodecs and
  captureStream unlocks are not guaranteed on iOS.
- React Native WebView is available, but WKWebView feature support varies
  by OS version (for example, canvas captureStream on iOS).

## Protocol 1: Standard Injection

Files:
- constants/workingInjection.ts
- constants/browserScripts.ts
- app/index.tsx

Behavior:
- Uses canvas or video captureStream to generate a MediaStream.
- Falls back to a native bridge when captureStream is missing.

Expo Go compatibility:
- Android: generally compatible if captureStream is supported.
- iOS: captureStream is often missing in WKWebView, and the native
  fallback is not available in Expo Go.

Recommendation:
- Prefer the WebSocket protocol on iOS Expo Go runtimes.

## Protocol 2: Advanced Relay (Allowlist)

Files:
- utils/advancedProtocol/*
- constants/browserScripts.ts
- contexts/ProtocolContext.tsx

Behavior:
- Builds on Standard Injection with allowlist gating.
- Uses WebRTC relay and advanced features inside the WebView when
  available (GPU, ASI, SDP mutation).

Expo Go compatibility:
- Compatible at the WebView layer when WebRTC APIs exist.
- Advanced features degrade if WebRTC or Worker support is limited.

Recommendation:
- Keep enabled but allow fallback to Standard or WebSocket when
  captureStream or WebRTC is missing.

## Protocol 3: Protected Preview

Files:
- app/protected-preview.tsx
- components/protected-preview/*

Behavior:
- Local preview and safe replacement flow.
- Uses Expo-managed camera and media components.

Expo Go compatibility:
- Compatible. No custom native modules are required.

## Protocol 4: Local Test Harness

Files:
- app/test-harness.tsx
- components/harness/*

Behavior:
- Local sandbox for overlay testing.
- Uses the same WebView injection pipeline as Standard.

Expo Go compatibility:
- Compatible with the same captureStream constraints as Standard.

## Protocol 5: Holographic Stream Injection

Files:
- utils/deepInjectionProtocols.ts
- utils/websocketBridge/*

Behavior:
- WebSocket bridge and SDP mutation with optional WebRTC helpers.
- Uses WebView APIs like WebSocket and Worker.

Expo Go compatibility:
- Compatible when WebView has WebSocket and Worker support.
- Degrades gracefully if WebRTC APIs are missing.

## Protocol 6: WebSocket Bridge

Files:
- utils/websocketBridge/*
- constants/browserScripts.ts

Behavior:
- Streams frames via ReactNativeWebView postMessage.
- Does not rely on custom native modules.

Expo Go compatibility:
- Fully compatible and recommended as the default in Expo Go.

## Protocol 6: WebRTC Loopback (iOS)

Files:
- utils/webrtcLoopbackBridge.ts
- utils/webrtcLoopbackNative.ts
- packages/webrtc-loopback/*
- utils/nativeMediaBridge.ts

Behavior:
- Requires the native WebRtcLoopback module and react-native-webrtc.

Expo Go compatibility:
- Not supported. Custom native modules are unavailable in Expo Go.
- Automatically disabled in the Expo Go runtime.

## App-level mitigations implemented

- Expo Go detection disables the WebRTC Loopback protocol.
- Enterprise WebKit toggles are blocked in Expo Go.
- Native WebRTC bridge errors include Expo Go guidance.
- Permission and protocol UIs hide disabled protocols.

## Recommended Expo Go defaults

- Set the active protocol to WebSocket Bridge on first launch.
- Keep Enterprise WebKit toggles disabled.
- Leave WebRTC Loopback disabled unless running a custom dev build.
