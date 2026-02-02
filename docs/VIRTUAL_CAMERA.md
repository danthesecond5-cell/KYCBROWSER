# Virtual Camera Native Module

## Overview

The Virtual Camera module provides a native-level camera interception solution that completely bypasses JavaScript-based detection. Unlike the JavaScript injection protocols, this module intercepts camera access at the hardware abstraction layer (AVFoundation on iOS, Camera2 on Android).

## How It Works

### JavaScript Injection vs Native Interception

| Approach | Detection Risk | Complexity | Platform Support |
|----------|---------------|------------|------------------|
| JavaScript Injection | Medium-High | Low | All (WebView) |
| **Native Interception** | **Very Low** | High | iOS & Android |

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Your App                                  │
├─────────────────────────────────────────────────────────────────┤
│  WebView (webcamtests.com)                                      │
│  ├── JavaScript: navigator.mediaDevices.getUserMedia()         │
│  └── Requests camera access                                     │
├─────────────────────────────────────────────────────────────────┤
│  React Native Bridge                                            │
├─────────────────────────────────────────────────────────────────┤
│  Virtual Camera Native Module                                   │
│  ├── iOS: AVFoundation (AVCaptureSession swizzling)            │
│  └── Android: Camera2 API (Virtual camera device)              │
├─────────────────────────────────────────────────────────────────┤
│  Video File (MP4/WebM)                                          │
│  └── Frames extracted and delivered as "camera" output         │
└─────────────────────────────────────────────────────────────────┘
```

### iOS Implementation

On iOS, the module uses **method swizzling** to intercept `AVCaptureSession`:

1. Swizzles `startRunning()` to prevent real camera activation
2. Swizzles `addInput()` to skip real camera input
3. Uses `AVAssetReader` to extract frames from video file
4. Delivers frames through `AVCaptureVideoDataOutput` delegate

### Android Implementation

On Android, the module creates a **virtual camera device**:

1. Uses `MediaMetadataRetriever` to extract frames from video
2. Creates a virtual camera surface
3. Intercepts `CameraManager.openCamera()` calls
4. Delivers frames as if from a real camera

## Installation

### 1. Add the module to your app

```bash
# The module is located in modules/virtual-camera
# It's automatically linked by Expo's autolinking
```

### 2. Update app.json

Add the module to your Expo config:

```json
{
  "expo": {
    "plugins": [
      "./modules/virtual-camera"
    ]
  }
}
```

### 3. Rebuild the native app

```bash
# For development
npx expo prebuild

# For production
eas build
```

## Usage

### Basic Usage

```typescript
import { useVirtualCamera } from '@/hooks/useVirtualCamera';

function CameraScreen() {
  const { 
    isAvailable,
    isEnabled, 
    enable, 
    disable,
    error,
  } = useVirtualCamera();

  const handleEnable = async () => {
    // Enable with a local video file
    const success = await enable('/path/to/video.mp4', {
      loop: true,
      width: 1080,
      height: 1920,
      fps: 30,
      mirror: true, // For front camera simulation
    });
    
    if (success) {
      console.log('Virtual camera enabled!');
    }
  };

  if (!isAvailable) {
    return <Text>Virtual camera requires a native build</Text>;
  }

  return (
    <View>
      <Button 
        title={isEnabled ? 'Disable' : 'Enable Virtual Camera'}
        onPress={isEnabled ? disable : handleEnable}
      />
      {error && <Text style={{ color: 'red' }}>{error}</Text>}
    </View>
  );
}
```

### With WebView

```typescript
import { WebView } from 'react-native-webview';
import { useVirtualCamera } from '@/hooks/useVirtualCamera';

function BrowserScreen() {
  const { enable, disable, isEnabled } = useVirtualCamera();
  const [url, setUrl] = useState('https://webcamtests.com/recorder');

  useEffect(() => {
    // Enable virtual camera before loading the page
    enable('/path/to/video.mp4');
    
    return () => {
      // Disable when leaving the screen
      disable();
    };
  }, []);

  return (
    <WebView
      source={{ uri: url }}
      // No JavaScript injection needed!
      // The virtual camera works at the native level
    />
  );
}
```

### Direct Module Usage

```typescript
import VirtualCamera from '@/modules/virtual-camera';

// Check availability
const available = VirtualCamera.isAvailable();

// Get current state
const state = await VirtualCamera.getState();

// Enable with configuration
await VirtualCamera.enable({
  videoUri: '/path/to/video.mp4',
  loop: true,
  width: 1080,
  height: 1920,
  fps: 30,
  mirror: false,
});

// Control playback
await VirtualCamera.pause();
await VirtualCamera.resume();
await VirtualCamera.seekTo(5.0); // Seek to 5 seconds

// Get current frame as base64
const frameBase64 = await VirtualCamera.getCurrentFrame();

// Disable
await VirtualCamera.disable();
```

## API Reference

### VirtualCamera Module

#### Methods

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `isAvailable()` | none | `boolean` | Check if native module is available |
| `getState()` | none | `Promise<VirtualCameraState>` | Get current state |
| `enable(config)` | `VirtualCameraConfig` | `Promise<boolean>` | Enable virtual camera |
| `disable()` | none | `Promise<boolean>` | Disable virtual camera |
| `setVideoSource(uri)` | `string` | `Promise<boolean>` | Set video source |
| `seekTo(position)` | `number` (seconds) | `Promise<boolean>` | Seek to position |
| `pause()` | none | `Promise<boolean>` | Pause playback |
| `resume()` | none | `Promise<boolean>` | Resume playback |
| `getCurrentFrame()` | none | `Promise<string \| null>` | Get frame as base64 |

#### Types

```typescript
interface VirtualCameraConfig {
  videoUri: string;      // Path to video file
  loop?: boolean;        // Loop video (default: true)
  width?: number;        // Target width (default: 1080)
  height?: number;       // Target height (default: 1920)
  fps?: number;          // Target FPS (default: 30)
  mirror?: boolean;      // Mirror horizontally (default: false)
}

interface VirtualCameraState {
  status: 'disabled' | 'enabled' | 'error';
  videoUri: string | null;
  isPlaying: boolean;
  currentFrame: number;
  totalFrames: number;
  fps: number;
  width: number;
  height: number;
  error: string | null;
}
```

### useVirtualCamera Hook

```typescript
const {
  // State
  isAvailable,    // boolean - Module available
  isEnabled,      // boolean - Virtual camera enabled
  isPlaying,      // boolean - Video playing
  currentFrame,   // number - Current frame
  totalFrames,    // number - Total frames
  fps,            // number - Video FPS
  width,          // number - Video width
  height,         // number - Video height
  videoUri,       // string | null - Current video
  error,          // string | null - Error message
  isLoading,      // boolean - Loading state
  
  // Actions
  enable,         // (uri, options?) => Promise<boolean>
  disable,        // () => Promise<boolean>
  setVideoSource, // (uri) => Promise<boolean>
  seekTo,         // (seconds) => Promise<boolean>
  pause,          // () => Promise<boolean>
  resume,         // () => Promise<boolean>
  getCurrentFrame,// () => Promise<string | null>
  refreshState,   // () => Promise<void>
} = useVirtualCamera();
```

## Supported Video Formats

| Platform | Formats |
|----------|---------|
| iOS | MP4 (H.264), MOV, M4V |
| Android | MP4 (H.264), WebM (VP8/VP9), 3GP |

## Supported Video Sources

| Source Type | iOS | Android | Example |
|-------------|-----|---------|---------|
| Local file | ✅ | ✅ | `/path/to/video.mp4` |
| File URI | ✅ | ✅ | `file:///path/to/video.mp4` |
| Bundle asset | ✅ | ✅ | `sample-video.mp4` |
| Content URI | ❌ | ✅ | `content://...` |
| HTTP/HTTPS | ❌ | ❌ | Requires download first |

## Limitations

1. **Requires native build**: This module uses native code and won't work in Expo Go. You need to create a development build or use EAS Build.

2. **Remote URLs not supported**: Videos must be local files. For remote videos, download them first using `expo-file-system`.

3. **Platform-specific behavior**: The exact interception mechanism differs between iOS and Android.

4. **Performance**: Frame extraction can be CPU-intensive for high-resolution videos at high frame rates.

## Troubleshooting

### Module not available

```
Virtual camera requires a native build
```

**Solution**: Create a development build:
```bash
npx expo prebuild
npx expo run:ios  # or run:android
```

### Video not loading

```
Failed to load video: Invalid video URI
```

**Solution**: Ensure the video path is correct and the file exists:
```typescript
import * as FileSystem from 'expo-file-system';

const fileInfo = await FileSystem.getInfoAsync(videoUri);
if (!fileInfo.exists) {
  console.error('Video file does not exist');
}
```

### Low frame rate

**Solution**: Reduce video resolution or frame rate:
```typescript
await enable(videoUri, {
  width: 720,
  height: 1280,
  fps: 24,
});
```

## Comparison with JavaScript Injection

| Feature | JS Injection | Native Virtual Camera |
|---------|-------------|----------------------|
| Works in Expo Go | ✅ | ❌ |
| Detection resistance | Medium | Very High |
| WebRTC support | Limited | Full |
| Setup complexity | Low | High |
| Platform support | All WebViews | iOS & Android |
| Performance | Good | Excellent |

## When to Use Which

**Use JavaScript Injection when:**
- You need quick prototyping
- You're using Expo Go
- The target site doesn't have anti-detection measures

**Use Native Virtual Camera when:**
- Maximum stealth is required
- The target site detects canvas-based streams
- You need full WebRTC compatibility
- Performance is critical
