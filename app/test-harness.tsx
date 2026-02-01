import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Platform,
  ScrollView,
  UIManager,
  Alert,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { WebView } from 'react-native-webview';
import { ChevronLeft, Monitor, Film, FlaskConical, Settings, Lock, Activity, Shield, Play } from 'lucide-react-native';
import { useVideoLibrary } from '@/contexts/VideoLibraryContext';
import { useProtocol } from '@/contexts/ProtocolContext';
import { useDeviceTemplate } from '@/contexts/DeviceTemplateContext';
import { formatVideoUriForWebView, isLocalFileUri } from '@/utils/videoServing';
import { createMediaInjectionScript, CONSOLE_CAPTURE_SCRIPT } from '@/constants/browserScripts';
import { getBuiltInVideoUri } from '@/constants/builtInTestVideo';
import TestingWatermark from '@/components/TestingWatermark';

const TEST_HARNESS_HTML = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Camera Test Harness - Protocol 4</title>
    <style>
      * { box-sizing: border-box; }
      body {
        margin: 0;
        background: #0a0a0a;
        color: #ffffff;
        font-family: -apple-system, system-ui, sans-serif;
        min-height: 100vh;
      }
      .container {
        padding: 12px;
      }
      .header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 12px;
      }
      .status {
        font-size: 14px;
        color: rgba(255, 255, 255, 0.8);
        padding: 8px 12px;
        background: rgba(0, 255, 136, 0.1);
        border-radius: 8px;
        border: 1px solid rgba(0, 255, 136, 0.3);
      }
      .status.error {
        background: rgba(255, 100, 100, 0.1);
        border-color: rgba(255, 100, 100, 0.3);
      }
      .status.success {
        background: rgba(0, 255, 136, 0.2);
        color: #00ff88;
      }
      .frame {
        position: relative;
        border-radius: 16px;
        overflow: hidden;
        background: #111111;
        border: 2px solid rgba(255, 255, 255, 0.1);
        aspect-ratio: 9/16;
        max-height: 70vh;
        margin: 0 auto;
      }
      video, canvas {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }
      #overlay {
        position: absolute;
        inset: 0;
        display: none;
        z-index: 10;
      }
      .label {
        position: absolute;
        bottom: 12px;
        left: 12px;
        right: 12px;
        text-align: center;
        background: rgba(0, 0, 0, 0.75);
        padding: 10px 14px;
        border-radius: 10px;
        font-size: 13px;
        font-weight: 600;
        color: #00ff88;
        z-index: 20;
        backdrop-filter: blur(4px);
      }
      .badge {
        position: absolute;
        top: 12px;
        right: 12px;
        background: rgba(138, 43, 226, 0.9);
        color: white;
        padding: 6px 12px;
        border-radius: 6px;
        font-size: 11px;
        font-weight: 700;
        z-index: 20;
      }
      .controls {
        margin-top: 16px;
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
      }
      .btn {
        flex: 1;
        min-width: 120px;
        padding: 12px 16px;
        border: none;
        border-radius: 10px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
      }
      .btn-primary {
        background: #00ff88;
        color: #0a0a0a;
      }
      .btn-secondary {
        background: rgba(255, 255, 255, 0.1);
        color: #ffffff;
        border: 1px solid rgba(255, 255, 255, 0.2);
      }
      .btn:active {
        transform: scale(0.98);
      }
      .info {
        margin-top: 16px;
        padding: 12px;
        background: rgba(255, 255, 255, 0.05);
        border-radius: 10px;
        font-size: 11px;
        color: rgba(255, 255, 255, 0.6);
        line-height: 1.5;
      }
      .info-title {
        color: #ffffff;
        font-weight: 600;
        margin-bottom: 6px;
      }
      .metric {
        display: flex;
        justify-content: space-between;
        padding: 4px 0;
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      }
      .metric:last-child {
        border-bottom: none;
      }
      .metric-value {
        color: #00ff88;
        font-weight: 600;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <div class="status" id="status">Initializing Protocol 4...</div>
      </div>
      
      <div class="frame">
        <video id="camera" autoplay playsinline muted></video>
        <video id="overlay" autoplay playsinline muted loop></video>
        <canvas id="fallbackCanvas" style="display:none;"></canvas>
        <div class="badge">PROTOCOL 4</div>
        <div class="label" id="label">Local Test Harness</div>
      </div>
      
      <div class="controls">
        <button class="btn btn-primary" id="startBtn">Start Camera Test</button>
        <button class="btn btn-secondary" id="toggleBtn">Toggle Overlay</button>
      </div>
      
      <div class="info">
        <div class="info-title">Stream Metrics</div>
        <div class="metric">
          <span>Stream Type</span>
          <span class="metric-value" id="streamType">--</span>
        </div>
        <div class="metric">
          <span>Resolution</span>
          <span class="metric-value" id="resolution">--</span>
        </div>
        <div class="metric">
          <span>FPS</span>
          <span class="metric-value" id="fps">--</span>
        </div>
        <div class="metric">
          <span>Injection Status</span>
          <span class="metric-value" id="injectionStatus">Pending</span>
        </div>
      </div>
    </div>
    
    <script>
      const statusEl = document.getElementById('status');
      const cameraVideo = document.getElementById('camera');
      const overlayVideo = document.getElementById('overlay');
      const fallbackCanvas = document.getElementById('fallbackCanvas');
      const labelEl = document.getElementById('label');
      const startBtn = document.getElementById('startBtn');
      const toggleBtn = document.getElementById('toggleBtn');
      
      // Metrics elements
      const streamTypeEl = document.getElementById('streamType');
      const resolutionEl = document.getElementById('resolution');
      const fpsEl = document.getElementById('fps');
      const injectionStatusEl = document.getElementById('injectionStatus');
      
      let currentStream = null;
      let overlayEnabled = false;
      let frameCount = 0;
      let lastFpsTime = Date.now();
      
      function updateStatus(text, type) {
        statusEl.textContent = text;
        statusEl.className = 'status' + (type ? ' ' + type : '');
      }
      
      function updateMetrics(stream) {
        if (!stream) return;
        
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
          const settings = videoTrack.getSettings();
          streamTypeEl.textContent = stream._isBuiltIn ? 'Built-in Test' : 'Simulated';
          resolutionEl.textContent = (settings.width || '?') + 'x' + (settings.height || '?');
          injectionStatusEl.textContent = 'Active';
          injectionStatusEl.style.color = '#00ff88';
        }
      }
      
      // FPS counter
      setInterval(function() {
        const now = Date.now();
        const elapsed = (now - lastFpsTime) / 1000;
        if (elapsed > 0) {
          const currentFps = Math.round(frameCount / elapsed);
          fpsEl.textContent = currentFps + ' fps';
        }
        frameCount = 0;
        lastFpsTime = now;
      }, 1000);
      
      // Frame counter for video
      function countFrames() {
        frameCount++;
        if (cameraVideo.readyState >= 2) {
          requestAnimationFrame(countFrames);
        }
      }
      
      async function startCamera() {
        updateStatus('Requesting camera access...', '');
        
        try {
          // This will be intercepted by the injection script
          const stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: 'user',
              width: { ideal: 1080 },
              height: { ideal: 1920 },
              aspectRatio: { ideal: 9/16 }
            },
            audio: false
          });
          
          currentStream = stream;
          cameraVideo.srcObject = stream;
          
          // Wait for video to start playing
          await new Promise(function(resolve) {
            cameraVideo.onloadedmetadata = function() {
              cameraVideo.play().then(resolve).catch(resolve);
            };
          });
          
          updateStatus('Camera injection active - video playing!', 'success');
          labelEl.textContent = stream._isBuiltIn ? 'Built-in Test Video Active' : 'Simulated Camera Feed';
          updateMetrics(stream);
          
          // Start frame counting
          requestAnimationFrame(countFrames);
          
          // Notify React Native
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'testHarnessStarted',
              payload: { success: true, isBuiltIn: stream._isBuiltIn || false }
            }));
          }
          
        } catch (error) {
          console.error('Camera error:', error);
          updateStatus('Camera test failed: ' + error.message, 'error');
          labelEl.textContent = 'Test Failed';
          injectionStatusEl.textContent = 'Failed';
          injectionStatusEl.style.color = '#ff6b6b';
          
          // Try built-in fallback directly
          if (window.__createBuiltInVideoStream) {
            try {
              updateStatus('Trying built-in video fallback...', '');
              const fallbackStream = await window.__createBuiltInVideoStream({ patternType: 'bouncing_ball' });
              currentStream = fallbackStream;
              cameraVideo.srcObject = fallbackStream;
              await cameraVideo.play();
              updateStatus('Built-in video fallback active!', 'success');
              labelEl.textContent = 'Built-in Test Video';
              updateMetrics(fallbackStream);
              requestAnimationFrame(countFrames);
            } catch (fallbackError) {
              console.error('Fallback also failed:', fallbackError);
              updateStatus('All methods failed', 'error');
            }
          }
        }
      }
      
      function toggleOverlay() {
        overlayEnabled = !overlayEnabled;
        overlayVideo.style.display = overlayEnabled ? 'block' : 'none';
        toggleBtn.textContent = overlayEnabled ? 'Hide Overlay' : 'Show Overlay';
        
        if (overlayEnabled && !overlayVideo.src) {
          labelEl.textContent = 'Overlay enabled (no video set)';
        }
      }
      
      window.__setOverlayVideo = function(url) {
        if (!url) return;
        overlayVideo.src = url;
        overlayVideo.load();
        overlayVideo.play().catch(function() {});
        console.log('[TestHarness] Overlay video set:', url.substring(0, 50));
      };
      
      window.__toggleOverlay = function(enabled) {
        overlayEnabled = enabled;
        overlayVideo.style.display = enabled ? 'block' : 'none';
        toggleBtn.textContent = enabled ? 'Hide Overlay' : 'Show Overlay';
        updateStatus(enabled ? 'Overlay replacement active' : 'Camera injection active', 'success');
      };
      
      window.__getTestHarnessStatus = function() {
        return {
          hasStream: !!currentStream,
          overlayEnabled: overlayEnabled,
          isBuiltIn: currentStream && currentStream._isBuiltIn,
          tracks: currentStream ? currentStream.getTracks().length : 0
        };
      };
      
      // Event listeners
      startBtn.addEventListener('click', startCamera);
      toggleBtn.addEventListener('click', toggleOverlay);
      
      // Auto-start camera test
      setTimeout(startCamera, 500);
      
      console.log('[TestHarness] Protocol 4 initialized');
    </script>
  </body>
</html>
`;

export default function TestHarnessScreen() {
  const webViewRef = useRef<WebView>(null);
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const [useBuiltInVideo, setUseBuiltInVideo] = useState(true);
  const [testStatus, setTestStatus] = useState<'idle' | 'running' | 'success' | 'failed'>('idle');

  const { savedVideos, isVideoReady } = useVideoLibrary();
  const { activeTemplate, stealthMode } = useDeviceTemplate();
  const {
    harnessSettings,
    updateHarnessSettings,
    developerModeEnabled,
    presentationMode,
    mlSafetyEnabled,
    showTestingWatermark,
    protocols,
  } = useProtocol();

  const protocolEnabled = protocols.harness?.enabled ?? true;
  const webViewAvailable = Platform.OS !== 'web' && Boolean(
    UIManager.getViewManagerConfig?.('RNCWebView') ||
    UIManager.getViewManagerConfig?.('RCTWebView')
  );
  const isHighFrameRate = harnessSettings.captureFrameRate >= 60;

  const overlayEnabled = harnessSettings.overlayEnabled;
  const setOverlayEnabled = (enabled: boolean) => updateHarnessSettings({ overlayEnabled: enabled });
  const setHighFrameRate = (enabled: boolean) =>
    updateHarnessSettings({ captureFrameRate: enabled ? 60 : 30 });

  const compatibleVideos = useMemo(() => {
    return savedVideos.filter(video => {
      const status = video.compatibility?.overallStatus;
      const isFullyCompatible = status === 'perfect' || status === 'compatible';
      return isFullyCompatible && isVideoReady(video.id);
    });
  }, [savedVideos, isVideoReady]);

  useEffect(() => {
    if (!selectedVideoId && compatibleVideos.length > 0) {
      setSelectedVideoId(compatibleVideos[0].id);
    }
  }, [selectedVideoId, compatibleVideos]);

  const selectedVideo = compatibleVideos.find(video => video.id === selectedVideoId) || null;

  // Create devices with built-in video for testing
  const testDevices = useMemo(() => {
    if (!activeTemplate) {
      // Create a default test device if no template
      return [{
        id: 'test_front_camera',
        name: 'Test Front Camera',
        type: 'camera' as const,
        facing: 'front' as const,
        simulationEnabled: true,
        assignedVideoUri: useBuiltInVideo ? getBuiltInVideoUri('bouncing_ball') : (selectedVideo?.uri || getBuiltInVideoUri('bouncing_ball')),
        capabilities: {
          videoResolutions: [{ width: 1080, height: 1920, maxFps: 30 }],
        },
      }];
    }
    
    // Use template devices but assign built-in video for testing
    return activeTemplate.captureDevices.map(device => ({
      ...device,
      simulationEnabled: true,
      assignedVideoUri: useBuiltInVideo ? getBuiltInVideoUri('bouncing_ball') : (selectedVideo?.uri || device.assignedVideoUri || getBuiltInVideoUri('bouncing_ball')),
    }));
  }, [activeTemplate, useBuiltInVideo, selectedVideo]);

  // Generate the injection script with test devices
  const injectionScript = useMemo(() => {
    return CONSOLE_CAPTURE_SCRIPT + createMediaInjectionScript(testDevices, true);
  }, [testDevices]);

  const applyOverlaySettings = useCallback(() => {
    if (!webViewRef.current) return;
    const formattedUri = selectedVideo ? formatVideoUriForWebView(selectedVideo.uri) : '';
    const enableOverlay = overlayEnabled && Boolean(formattedUri);

    const script = `
      (function() {
        if (window.__setOverlayVideo) {
          window.__setOverlayVideo(${JSON.stringify(formattedUri)});
        }
        if (window.__toggleOverlay) {
          window.__toggleOverlay(${enableOverlay});
        }
      })();
      true;
    `;
    webViewRef.current.injectJavaScript(script);
  }, [overlayEnabled, selectedVideo]);

  useEffect(() => {
    applyOverlaySettings();
  }, [applyOverlaySettings]);

  return (
    <View style={styles.container}>
      <TestingWatermark 
        visible={showTestingWatermark}
        position="top-right"
        variant="minimal"
      />
      
      <Stack.Screen
        options={{
          title: 'Local Test Harness',
          headerStyle: { backgroundColor: '#0a0a0a' },
          headerTintColor: '#ffffff',
          headerLeft: () => (
            <TouchableOpacity style={styles.headerButton} onPress={() => router.back()}>
              <ChevronLeft size={24} color="#00ff88" />
            </TouchableOpacity>
          ),
        }}
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Protocol Status Banner */}
        <View style={styles.protocolBanner}>
          <View style={styles.protocolBannerLeft}>
            <View style={[styles.protocolIcon, protocolEnabled && styles.protocolIconActive]}>
              <FlaskConical size={16} color={protocolEnabled ? '#0a0a0a' : '#8a2be2'} />
            </View>
            <View>
              <Text style={styles.protocolBannerTitle}>Protocol 4: Test Harness</Text>
              <Text style={styles.protocolBannerStatus}>
                {protocolEnabled ? 'LIVE - Benchmark Ready' : 'Disabled'}
              </Text>
            </View>
          </View>
          {overlayEnabled && (
            <View style={styles.benchmarkIndicator}>
              <Activity size={12} color="#00ff88" />
              <Text style={styles.benchmarkText}>Overlay</Text>
            </View>
          )}
        </View>
        {presentationMode && (
          <View style={styles.protocolBadge}>
            <FlaskConical size={14} color="#ffcc00" />
            <Text style={styles.protocolBadgeText}>Protocol 4: Local Test Harness</Text>
            {mlSafetyEnabled && (
              <View style={styles.mlBadge}>
                <Shield size={10} color="#00aaff" />
                <Text style={styles.mlBadgeText}>ML SAFE</Text>
              </View>
            )}
          </View>
        )}

        <View style={styles.infoCard}>
          <View style={styles.infoHeader}>
            <Monitor size={18} color="#00ff88" />
            <Text style={styles.infoTitle}>Sandbox Test Page</Text>
          </View>
          <Text style={styles.infoText}>
            This local harness requests camera access and lets you overlay a safe looping video
            for controlled testing. It does not affect third-party sites.
          </Text>
        </View>

        <View style={styles.controlsCard}>
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Enable overlay replacement</Text>
            <Switch
              value={overlayEnabled}
              onValueChange={setOverlayEnabled}
              trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#00ff88' }}
              thumbColor={overlayEnabled ? '#ffffff' : '#888888'}
              disabled={!developerModeEnabled}
            />
          </View>

          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Show Debug Info</Text>
            <Switch
              value={harnessSettings.showDebugInfo}
              onValueChange={(v) => updateHarnessSettings({ showDebugInfo: v })}
              trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#00aaff' }}
              thumbColor={harnessSettings.showDebugInfo ? '#ffffff' : '#888888'}
              disabled={!developerModeEnabled}
            />
          </View>

          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Mirror Video</Text>
            <Switch
              value={harnessSettings.mirrorVideo}
              onValueChange={(v) => updateHarnessSettings({ mirrorVideo: v })}
              trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#ff6b35' }}
              thumbColor={harnessSettings.mirrorVideo ? '#ffffff' : '#888888'}
              disabled={!developerModeEnabled}
            />
          </View>

          {!developerModeEnabled && (
            <Text style={styles.lockedHint}>
              Enable developer mode in Protocols to modify settings.
            </Text>
          )}

          <Text style={styles.selectorTitle}>Overlay Video</Text>
          {compatibleVideos.length === 0 ? (
            <Text style={styles.emptyText}>
              Import compatible videos in My Videos to enable overlay testing.
            </Text>
          ) : (
            <View style={styles.videoList}>
              {compatibleVideos.map(video => {
                const isSelected = video.id === selectedVideoId;
                return (
                  <TouchableOpacity
                    key={video.id}
                    style={[styles.videoOption, isSelected && styles.videoOptionSelected]}
                    onPress={() => setSelectedVideoId(video.id)}
                  >
                    <Film size={14} color={isSelected ? '#00ff88' : 'rgba(255,255,255,0.5)'} />
                    <Text
                      style={[styles.videoOptionText, isSelected && styles.videoOptionTextSelected]}
                      numberOfLines={1}
                    >
                      {video.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        <View style={styles.webViewCard}>
          {Platform.OS === 'web' ? (
            <Text style={styles.emptyText}>
              WebView test harness is not available on web builds.
            </Text>
          ) : !webViewAvailable ? (
            <Text style={styles.emptyText}>
              WebView is unavailable in this Expo Snack preview.
            </Text>
          ) : (
            <WebView
              ref={webViewRef}
              originWhitelist={['*']}
              source={{ html: TEST_HARNESS_HTML }}
              style={styles.webView}
              injectedJavaScriptBeforeContentLoaded={injectionScript}
              onLoadStart={() => setTestStatus('running')}
              onLoadEnd={() => {
                applyOverlaySettings();
                console.log('[TestHarness] WebView loaded, injection script applied');
              }}
              onMessage={(event) => {
                try {
                  const data = JSON.parse(event.nativeEvent.data);
                  if (data.type === 'console') {
                    console.log(`[TestHarness WebView ${data.level}]`, data.message);
                  } else if (data.type === 'testHarnessStarted') {
                    setTestStatus(data.payload?.success ? 'success' : 'failed');
                    if (data.payload?.success) {
                      console.log('[TestHarness] Camera injection successful!');
                    }
                  } else if (data.type === 'cameraIntercepted') {
                    console.log('[TestHarness] Camera intercepted:', data.payload);
                    setTestStatus('success');
                  }
                } catch {
                  console.log('[TestHarness Raw]', event.nativeEvent.data);
                }
              }}
              javaScriptEnabled
              domStorageEnabled
              allowsInlineMediaPlayback
              mediaPlaybackRequiresUserAction={false}
              allowFileAccess
              allowFileAccessFromFileURLs
              allowUniversalAccessFromFileURLs
            />
          )}
        </View>
        
        {/* Test Status Indicator */}
        <View style={styles.testStatusCard}>
          <View style={styles.testStatusHeader}>
            <Play size={16} color={testStatus === 'success' ? '#00ff88' : testStatus === 'failed' ? '#ff6b6b' : '#00aaff'} />
            <Text style={styles.testStatusTitle}>Injection Test Status</Text>
          </View>
          <View style={styles.testStatusContent}>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Built-in Test Video</Text>
              <Switch
                value={useBuiltInVideo}
                onValueChange={setUseBuiltInVideo}
                trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#00ff88' }}
                thumbColor={useBuiltInVideo ? '#ffffff' : '#888888'}
              />
            </View>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Status</Text>
              <Text style={[
                styles.statusValue,
                testStatus === 'success' && styles.statusValueSuccess,
                testStatus === 'failed' && styles.statusValueError,
              ]}>
                {testStatus === 'idle' ? 'Ready' : 
                 testStatus === 'running' ? 'Testing...' :
                 testStatus === 'success' ? 'Injection Active!' : 'Failed'}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.reloadButton}
              onPress={() => {
                setTestStatus('running');
                webViewRef.current?.reload();
              }}
            >
              <Text style={styles.reloadButtonText}>Reload Test</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Settings Card */}
        <View style={styles.settingsCard}>
          <View style={styles.settingsHeader}>
            <Settings size={16} color="#00aaff" />
            <Text style={styles.settingsTitle}>Protocol Settings</Text>
            {!developerModeEnabled && (
              <View style={styles.settingsLocked}>
                <Lock size={10} color="#ff6b35" />
                <Text style={styles.settingsLockedText}>Developer Mode Required</Text>
              </View>
            )}
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Audio Passthrough</Text>
              <Text style={styles.settingHint}>Allow microphone audio in overlay</Text>
            </View>
            <Switch
              value={harnessSettings.enableAudioPassthrough}
              onValueChange={(val) => developerModeEnabled && updateHarnessSettings({ enableAudioPassthrough: val })}
              disabled={!developerModeEnabled}
              trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#00ff88' }}
              thumbColor={harnessSettings.enableAudioPassthrough ? '#ffffff' : '#888888'}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Test Pattern Fallback</Text>
              <Text style={styles.settingHint}>Show test pattern when no video</Text>
            </View>
            <Switch
              value={harnessSettings.testPatternOnNoVideo}
              onValueChange={(val) => developerModeEnabled && updateHarnessSettings({ testPatternOnNoVideo: val })}
              disabled={!developerModeEnabled}
              trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#00ff88' }}
              thumbColor={harnessSettings.testPatternOnNoVideo ? '#ffffff' : '#888888'}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>High Frame Rate</Text>
              <Text style={styles.settingHint}>Capture at 60fps (default 30fps)</Text>
            </View>
            <Switch
              value={isHighFrameRate}
              onValueChange={(val) => developerModeEnabled && setHighFrameRate(val)}
              disabled={!developerModeEnabled}
              trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#ff6b35' }}
              thumbColor={isHighFrameRate ? '#ffffff' : '#888888'}
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  headerButton: {
    padding: 8,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  protocolBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(138, 43, 226, 0.1)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(138, 43, 226, 0.2)',
  },
  protocolBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  protocolIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(138, 43, 226, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  protocolIconActive: {
    backgroundColor: '#00ff88',
  },
  protocolBannerTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#ffffff',
  },
  protocolBannerStatus: {
    fontSize: 10,
    color: '#00ff88',
    marginTop: 2,
    fontWeight: '500' as const,
  },
  benchmarkIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 255, 136, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  benchmarkText: {
    fontSize: 10,
    color: '#00ff88',
    fontWeight: '600' as const,
  },
  infoCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginBottom: 12,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#ffffff',
  },
  infoText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 18,
  },
  controlsCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginBottom: 12,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  toggleLabel: {
    fontSize: 13,
    color: '#ffffff',
    fontWeight: '600' as const,
  },
  lockedHint: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 8,
    textAlign: 'center' as const,
  },
  protocolBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 204, 0, 0.1)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 204, 0, 0.3)',
  },
  protocolBadgeText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#ffcc00',
  },
  mlBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 170, 255, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  mlBadgeText: {
    fontSize: 9,
    fontWeight: '700' as const,
    color: '#00aaff',
  },
  selectorTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#ffffff',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
  },
  videoList: {
    gap: 8,
  },
  videoOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  videoOptionSelected: {
    borderColor: '#00ff88',
    backgroundColor: 'rgba(0,255,136,0.08)',
  },
  videoOptionText: {
    fontSize: 12,
    color: '#ffffff',
    flex: 1,
  },
  videoOptionTextSelected: {
    color: '#00ff88',
  },
  webViewCard: {
    height: 420,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: '#111111',
  },
  webView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  settingsCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginTop: 12,
  },
  settingsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  settingsTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#ffffff',
    flex: 1,
  },
  settingsLocked: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 107, 53, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  settingsLockedText: {
    fontSize: 10,
    color: '#ff6b35',
    fontWeight: '500' as const,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  settingInfo: {
    flex: 1,
    marginRight: 12,
  },
  settingLabel: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: '#ffffff',
  },
  settingHint: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
  },
  testStatusCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginTop: 12,
  },
  testStatusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  testStatusTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#ffffff',
  },
  testStatusContent: {
    gap: 12,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
  },
  statusValue: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#00aaff',
  },
  statusValueSuccess: {
    color: '#00ff88',
  },
  statusValueError: {
    color: '#ff6b6b',
  },
  reloadButton: {
    backgroundColor: 'rgba(0, 255, 136, 0.15)',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 136, 0.3)',
  },
  reloadButtonText: {
    color: '#00ff88',
    fontSize: 13,
    fontWeight: '600' as const,
  },
});
