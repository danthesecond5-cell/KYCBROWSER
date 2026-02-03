# Quick Test Guide: Webcamtests.com Injection Testing

## TL;DR - How to Test NOW

### Method 1: Use Built-in Protocol Tester (Easiest)

1. Open your React Native app
2. Navigate to `/protocol-tester` route
3. Click "Run All" or test individual protocols
4. Watch the results appear in real-time

**What you'll see:**
- ○ = Pending
- ◐ = Running  
- ✓ = Success (protocol works!)
- ✗ = Failed (check error message)

### Method 2: Run Automated Test Suite

```bash
npm run webcamtests:check
```

**This will:**
- Test all 5 protocols on webcamtests.com/recorder
- Show success/failure for each
- Report bytes recorded by MediaRecorder
- Complete in ~10 seconds

**Expected output:**
```json
{
  "protocolId": "standard",
  "injectionDetected": true,
  "getUserMediaOk": true,
  "mediaRecorderOk": true,
  "recordedBytes": 11387
}
```

## Current Test Results

**Date**: February 2, 2026

**ALL PROTOCOLS WORKING ✅**

| Protocol | Status | Bytes Recorded |
|----------|--------|----------------|
| Standard | ✅ WORKING | 11,387 |
| Advanced Relay | ✅ WORKING | 11,762 |
| Protected | ✅ WORKING | 12,217 |
| Test Harness | ✅ WORKING | 11,483 |
| Holographic | ✅ WORKING | 12,821 |

## If Protocols Don't Work in Your WebView

### Step 1: Run Diagnostics

The Protocol Tester screen runs diagnostics automatically. Look for:

**Success Logs:**
```
[Guaranteed] GUARANTEED INJECTION ACTIVE
[Guaranteed] getUserMedia INTERCEPTED
[Diagnostics] ✓ getUserMedia successful
```

**Failure Logs:**
```
[Guaranteed] CRITICAL: navigator.mediaDevices not available!
[Diagnostics] ✗ getUserMedia failed
```

### Step 2: Check WebView Props

Your WebView MUST have these settings:

```typescript
<WebView
  injectedJavaScriptBeforeContentLoaded={script}  // ← NOT injectedJavaScript
  javaScriptEnabled={true}                        // ← REQUIRED
  domStorageEnabled={true}                        // ← REQUIRED
  mediaPlaybackRequiresUserAction={false}         // ← IMPORTANT
  allowsInlineMediaPlayback={true}                // ← IMPORTANT
/>
```

### Step 3: Try Guaranteed Injection

This is the most bulletproof method:

```typescript
import { createGuaranteedInjection } from '@/utils/webcamTestDiagnostics';

const script = createGuaranteedInjection();

<WebView
  injectedJavaScriptBeforeContentLoaded={script}
  // ... other props
/>
```

**What it does:**
- Creates animated test pattern (no video file needed)
- Intercepts getUserMedia BEFORE any page code runs
- Works even if other APIs are limited
- Shows visual confirmation of injection

### Step 4: Enable Debug Mode

For any protocol:

```typescript
const script = createMediaInjectionScript(devices, {
  debugEnabled: true,  // ← Add this
  // ... other options
});
```

Then check React Native logs:
```bash
# iOS
npx react-native log-ios | grep "\[Guaranteed\]\|\[MediaSim\]\|\[AdvP2\]"

# Android
npx react-native log-android | grep "\[Guaranteed\]\|\[MediaSim\]\|\[AdvP2\]"
```

## Common Issues & Quick Fixes

### Issue: "getUserMedia is not a function"

**Fix**: Add to WebView:
```typescript
javaScriptEnabled={true}
```

### Issue: "captureStream is not a function"

**Fix**: This is handled automatically now. If still failing:
1. Update to latest code (commit 4530cad or later)
2. Check if WebView supports HTML5 Canvas

### Issue: "Script runs too late"

**Fix**: Use `injectedJavaScriptBeforeContentLoaded`, NOT `injectedJavaScript`

### Issue: "No video visible"

**Fix**: This is expected! The injection works even if you don't see video in the WebView. Check:
1. Console logs for success messages
2. Whether webcamtests.com accepts the stream
3. MediaRecorder test results

### Issue: "MediaRecorder fails"

**Cause**: This is a WebView limitation on some platforms

**Fix**: The injection itself still works! MediaRecorder is just for testing. The site (webcamtests.com) will use its own recording mechanism.

## What Success Looks Like

### In Console Logs:
```
[Guaranteed] ================================================
[Guaranteed] GUARANTEED INJECTION ACTIVE
[Guaranteed] getUserMedia INTERCEPTED
[Guaranteed] Returning injected stream
[Guaranteed] Stream has 2 tracks
[Diagnostics] ✓ getUserMedia successful
[Diagnostics]   Total tracks: 2
[Diagnostics]   Video tracks: 1
[Diagnostics]   Audio tracks: 1
```

### In Protocol Tester UI:
- Test status changes from ○ to ◐ to ✓
- "✓ Test passed" message appears
- No error messages

### On Webcamtests.com:
- Camera preview shows your injected video/test pattern
- Recording button becomes active
- Can record and download video file

## Quick Debug Checklist

- [ ] Using `injectedJavaScriptBeforeContentLoaded` (not `injectedJavaScript`)
- [ ] WebView has `javaScriptEnabled={true}`
- [ ] WebView has `domStorageEnabled={true}`
- [ ] WebView has `mediaPlaybackRequiresUserAction={false}`
- [ ] WebView has `allowsInlineMediaPlayback={true}`
- [ ] Debug mode enabled (`debugEnabled: true`)
- [ ] Checking console logs in React Native debugger
- [ ] Tested with Guaranteed Injection first
- [ ] Tested on actual device (not just simulator/emulator)

## Need More Help?

See `WEBCAMTESTS_PROTOCOL_ANALYSIS.md` for:
- Detailed protocol analysis
- WebView vs Browser differences
- Alternative approaches if nothing works
- Advanced troubleshooting

## Testing Workflow

```
1. Start App
   ↓
2. Go to /protocol-tester
   ↓
3. Click "Test" on any protocol
   ↓
4. Wait 10 seconds
   ↓
5. Check result:
   ✓ = Success → Protocol works!
   ✗ = Failed → Check console logs
   ↓
6. If failed:
   → Try Guaranteed Injection
   → Check WebView props
   → Enable debug mode
   → Read error messages
```

## Success Criteria

A protocol is **WORKING** if:
1. ✅ Injection detected: `window.__mediaInjectorInitialized === true` (or equivalent)
2. ✅ getUserMedia succeeds: Returns a MediaStream
3. ✅ Stream has video track: `stream.getVideoTracks().length > 0`
4. ✅ Track is "live": `track.readyState === "live"`

MediaRecorder is nice to have but not required for the injection to work.

---

**Last Updated**: February 2, 2026  
**Test Status**: All 5 protocols confirmed working in headless browser tests  
**WebView Status**: Enhanced for compatibility (commit 4530cad)
