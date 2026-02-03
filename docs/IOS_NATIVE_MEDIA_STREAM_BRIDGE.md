## iOS Native Media Stream Bridge Plan

### Why this is required
WKWebView does not reliably support `canvas.captureStream()` or
`video.captureStream()` on many iOS builds. When those APIs are missing, no
JavaScript-only injection can produce a real `MediaStream`. A native pipeline
is required.

### Design overview (high level)
1. **JS shim** overrides `navigator.mediaDevices.getUserMedia()` and
   `enumerateDevices()` inside the WebView.
2. The shim **requests a native stream** via `window.ReactNativeWebView.postMessage`.
3. **Native iOS bridge** builds a local WebRTC peer connection that publishes
   a synthetic or file-backed video track.
4. The JS shim receives SDP + ICE from native and completes a local WebRTC
   connection, yielding a **real `MediaStream` with a video track**.
5. The shim returns that MediaStream to the calling site.

### Native components (iOS)
- **WebRTC framework** (libwebrtc or react-native-webrtc)
- **Native bridge module** (Swift/Obj-C)
  - Creates `RTCPeerConnectionFactory`
  - Builds `RTCVideoSource` backed by:
    - **Synthetic frames (implemented)**
    - **AVAssetReader (file-backed video) (implemented)**
  - Adds video track to a local `RTCMediaStream`
  - Handles SDP/ICE exchange with JS

### JS shim (WebView)
- Intercepts `getUserMedia`
- Creates `RTCPeerConnection` in JS
- Exchanges SDP/ICE with native via postMessage
- Returns received remote track as a `MediaStream`
- Spoofs metadata (label/settings/capabilities) as needed

### Minimal message flow
1. JS -> Native: `{ type: "native_gum_offer", offer, constraints }`
2. Native -> JS: `{ type: "native_gum_answer", answer }`
3. JS <-> Native: ICE candidate exchange
4. JS returns stream once remote track arrives

### Implementation milestones
1. Add iOS WebRTC dependency and custom dev client (Expo prebuild).
   - **Done in JS:** `react-native-webrtc` added as a dependency.
2. Implement `NativeMediaStreamBridge` in iOS:
   - Video source from file/synthetic frames
   - PeerConnection lifecycle
3. Add JS shim + signaling in WebView injection.
   - **Done in JS:** working/advanced injection now request native streams
     when `captureStream` is unavailable.
4. Wire to existing protocol selection (Allowlist -> Advanced Relay).
   - **Done in JS:** allowlist now uses Advanced Protocol 2 by default.
5. Add diagnostic events for success/fail.

### Risks / constraints
- Requires custom iOS build (cannot work in pure Expo Go).
- WebRTC signaling must be robust to page reloads.
- Track metadata spoofing still required for webcamtests compatibility.
- **File capturer accepts**:
  - `file://` URLs or absolute paths
  - `data:` URIs (base64 only)
  - `ph://` photo library asset identifiers

### Next steps
- Implement the iOS native module + signaling.
- Add JS shim to request native streams when `captureStream` is unavailable.
- Validate on webcamtests.com/recorder.
