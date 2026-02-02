// Mock TurboModuleRegistry to prevent DevMenu errors
jest.mock('react-native/Libraries/TurboModule/TurboModuleRegistry', () => ({
  get: jest.fn(() => null),
  getEnforcing: jest.fn(() => ({})),
}));

// Mock NativeAnimatedHelper (prevents Animated/native crashes in Jest)
// RN may reference either the private path or the Libraries path depending on version/bundler.
jest.mock('react-native/src/private/animated/NativeAnimatedHelper', () => ({
  __esModule: true,
  default: {
    // RN uses `import NativeAnimatedHelper from ...` and then reads `NativeAnimatedHelper.API`,
    // so the default export must include the API surface.
    API: {
      flushQueue: jest.fn(),
      getValue: jest.fn(),
      createAnimatedNode: jest.fn(),
      startListeningToAnimatedNodeValue: jest.fn(),
      stopListeningToAnimatedNodeValue: jest.fn(),
      connectAnimatedNodes: jest.fn(),
      disconnectAnimatedNodes: jest.fn(),
      startAnimatingNode: jest.fn(),
      stopAnimation: jest.fn(),
      setAnimatedNodeValue: jest.fn(),
      setAnimatedNodeOffset: jest.fn(),
      flattenAnimatedNodeOffset: jest.fn(),
      extractAnimatedNodeOffset: jest.fn(),
      connectAnimatedNodeToView: jest.fn(),
      disconnectAnimatedNodeFromView: jest.fn(),
      dropAnimatedNode: jest.fn(),
      addAnimatedEventToView: jest.fn(),
      removeAnimatedEventFromView: jest.fn(),
    },
    shouldUseNativeDriver: jest.fn(() => false),
    nativeOpsValue: null,
  },
  // Keep these top-level exports too, since some RN internals access them directly.
  API: {
    flushQueue: jest.fn(),
    getValue: jest.fn(),
    createAnimatedNode: jest.fn(),
    startListeningToAnimatedNodeValue: jest.fn(),
    stopListeningToAnimatedNodeValue: jest.fn(),
    connectAnimatedNodes: jest.fn(),
    disconnectAnimatedNodes: jest.fn(),
    startAnimatingNode: jest.fn(),
    stopAnimation: jest.fn(),
    setAnimatedNodeValue: jest.fn(),
    setAnimatedNodeOffset: jest.fn(),
    flattenAnimatedNodeOffset: jest.fn(),
    extractAnimatedNodeOffset: jest.fn(),
    connectAnimatedNodeToView: jest.fn(),
    disconnectAnimatedNodeFromView: jest.fn(),
    dropAnimatedNode: jest.fn(),
    addAnimatedEventToView: jest.fn(),
    removeAnimatedEventToView: jest.fn(),
    removeAnimatedEventFromView: jest.fn(),
  },
  shouldUseNativeDriver: jest.fn(() => false),
}));


// Mock NativePlatformConstantsIOS
jest.mock('react-native/Libraries/Utilities/NativePlatformConstantsIOS', () => ({
  __esModule: true,
  default: {
    getConstants: jest.fn(() => ({
      forceTouchAvailable: false,
      osVersion: '17.0',
      systemName: 'iOS',
      interfaceIdiom: 'phone',
      isTesting: true,
    })),
  },
}));

// Mock NativeDeviceInfo
jest.mock('react-native/src/private/specs_DEPRECATED/modules/NativeDeviceInfo', () => ({
  __esModule: true,
  default: {
    getConstants: jest.fn(() => ({
      Dimensions: {
        window: { width: 375, height: 667, scale: 2, fontScale: 1 },
        screen: { width: 375, height: 667, scale: 2, fontScale: 1 },
      },
      isIPhoneX_deprecated: false,
    })),
  },
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage');

// Use fake timers for animations
jest.useFakeTimers();

// Mock expo-sensors
jest.mock('expo-sensors', () => ({
  Accelerometer: {
    isAvailableAsync: jest.fn(() => Promise.resolve(true)),
    setUpdateInterval: jest.fn(),
    addListener: jest.fn(() => ({ remove: jest.fn() })),
  },
  Gyroscope: {
    isAvailableAsync: jest.fn(() => Promise.resolve(true)),
    setUpdateInterval: jest.fn(),
    addListener: jest.fn(() => ({ remove: jest.fn() })),
  },
  Magnetometer: {
    isAvailableAsync: jest.fn(() => Promise.resolve(true)),
    setUpdateInterval: jest.fn(),
    addListener: jest.fn(() => ({ remove: jest.fn() })),
  },
}));

// Mock expo-device
jest.mock('expo-device', () => ({
  deviceName: 'Test Device',
  brand: 'TestBrand',
  modelName: 'TestModel',
  modelId: 'test-model-id',
  osName: 'iOS',
  osVersion: '17.0',
  isDevice: true,
}));

// Mock expo-camera
jest.mock('expo-camera', () => ({
  Camera: {
    requestCameraPermissionsAsync: jest.fn(() =>
      Promise.resolve({ granted: true, status: 'granted' })
    ),
    getCameraPermissionsAsync: jest.fn(() =>
      Promise.resolve({ granted: true, status: 'granted' })
    ),
  },
  CameraView: jest.fn(() => null),
}));

// Mock expo-file-system
jest.mock('expo-file-system', () => ({
  File: jest.fn().mockImplementation((uri) => ({
    uri,
    exists: true,
    info: jest.fn(() => ({ size: 1024, creationTime: Date.now() })),
    copy: jest.fn(),
    delete: jest.fn(),
    write: jest.fn(),
  })),
  Directory: jest.fn().mockImplementation((base, name) => ({
    uri: `${base}/${name}`,
    exists: true,
    create: jest.fn(),
    list: jest.fn(() => []),
  })),
  Paths: {
    document: 'file:///mock/documents',
    cache: 'file:///mock/cache',
    basename: jest.fn((uri) => uri.split('/').pop()),
    extname: jest.fn((uri) => {
      const parts = uri.split('.');
      return parts.length > 1 ? `.${parts.pop()}` : '';
    }),
  },
}));

// Mock expo-video-thumbnails
jest.mock('expo-video-thumbnails', () => ({
  getThumbnailAsync: jest.fn(() =>
    Promise.resolve({ uri: 'file:///mock/thumbnail.jpg' })
  ),
}));

// Mock expo-crypto
jest.mock('expo-crypto', () => ({
  getRandomBytesAsync: jest.fn((length) =>
    Promise.resolve(new Uint8Array(length).fill(0))
  ),
  digestStringAsync: jest.fn((algorithm, data) =>
    Promise.resolve(`digest_${algorithm}_${data}`)
  ),
  CryptoDigestAlgorithm: {
    SHA256: 'SHA256',
  },
}));

// Mock expo-av
jest.mock('expo-av', () => ({
  Audio: {
    Sound: {
      createAsync: jest.fn(() =>
        Promise.resolve({
          sound: {
            getStatusAsync: jest.fn(() =>
              Promise.resolve({ isLoaded: true, durationMillis: 5000 })
            ),
            unloadAsync: jest.fn(() => Promise.resolve()),
          },
          status: { isLoaded: true, durationMillis: 5000 },
        })
      ),
    },
    setAudioModeAsync: jest.fn(() => Promise.resolve()),
  },
  Video: jest.fn(() => null),
}));

// Mock expo-clipboard
jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn(() => Promise.resolve()),
  getStringAsync: jest.fn(() => Promise.resolve('')),
}));

// Mock expo-haptics
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  selectionAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: {
    Light: 'light',
    Medium: 'medium',
    Heavy: 'heavy',
  },
  NotificationFeedbackType: {
    Success: 'success',
    Warning: 'warning',
    Error: 'error',
  },
}));

// Mock expo-image-picker
jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(() =>
    Promise.resolve({ canceled: true, assets: null })
  ),
  launchCameraAsync: jest.fn(() =>
    Promise.resolve({ canceled: true, assets: null })
  ),
  MediaTypeOptions: {
    All: 'All',
    Images: 'Images',
    Videos: 'Videos',
  },
}));

// Mock expo-document-picker
jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn(() =>
    Promise.resolve({ canceled: true, assets: null })
  ),
}));

// Mock expo-constants
jest.mock('expo-constants', () => ({
  default: {
    expoConfig: {
      name: 'test-app',
      slug: 'test-app',
    },
  },
}));

// Mock expo-splash-screen
jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(() => Promise.resolve()),
  hideAsync: jest.fn(() => Promise.resolve()),
}));

// Mock react-native-webview
jest.mock('react-native-webview', () => {
  const { View } = require('react-native');
  return {
    WebView: View,
  };
});

// Mock lucide-react-native
jest.mock('lucide-react-native', () => {
  const { View } = require('react-native');
  return new Proxy({}, {
    get: () => View,
  });
});

// Silence console warnings during tests
const originalWarn = console.warn;
console.warn = (...args) => {
  if (
    typeof args[0] === 'string' &&
    (args[0].includes('Animated:') ||
      args[0].includes('componentWillReceiveProps') ||
      args[0].includes('componentWillMount'))
  ) {
    return;
  }
  originalWarn.apply(console, args);
};
