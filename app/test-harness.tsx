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
} from 'react-native';
import { Stack, router } from 'expo-router';
import { WebView } from 'react-native-webview';
import { ChevronLeft, Monitor, Film, FlaskConical, Settings, Lock, Activity, Shield } from 'lucide-react-native';
import { useVideoLibrary } from '@/contexts/VideoLibraryContext';
import { useDeveloperMode } from '@/contexts/DeveloperModeContext';
import { useProtocol } from '@/contexts/ProtocolContext';
import { formatVideoUriForWebView, isLocalFileUri } from '@/utils/videoServing';
import TestingWatermark from '@/components/TestingWatermark';
import { BULLETPROOF_INJECTION_SCRIPT } from '@/constants/browserScripts';

const TEST_HARNESS_HTML = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Protocol 4: Local Test Harness</title>
    <style>
      * { box-sizing: border-box; }
      body {
        margin: 0;
        background: #0a0a0a;
        color: #ffffff;
        font-family: -apple-system, system-ui, sans-serif;
      }
      .container {
        padding: 12px;
      }
      .status-bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 10px 14px;
        background: rgba(0, 255, 136, 0.1);
        border-radius: 10px;
        margin-bottom: 12px;
        border: 1px solid rgba(0, 255, 136, 0.3);
      }
      .status-indicator {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: #00ff88;
        animation: pulse 1.5s ease-in-out infinite;
      }
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }
      .status-text {
        font-size: 13px;
        font-weight: 600;
        color: #00ff88;
        margin-left: 10px;
        flex: 1;
      }
      .status-info {
        font-size: 11px;
        color: rgba(255, 255, 255, 0.6);
      }
      .frame {
        position: relative;
        border-radius: 16px;
        overflow: hidden;
        background: #111111;
        border: 2px solid rgba(0, 255, 136, 0.3);
        aspect-ratio: 9/16;
        max-height: 450px;
      }
      #camera {
        width: 100%;
        height: 100%;
        object-fit: cover;
        background: #000;
      }
      #overlay {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
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
        z-index: 20;
      }
      .label-title {
        font-size: 14px;
        font-weight: 700;
        color: #00ff88;
        margin-bottom: 4px;
      }
      .label-info {
        font-size: 11px;
        color: rgba(255, 255, 255, 0.7);
      }
      .corner-marker {
        position: absolute;
        width: 30px;
        height: 30px;
        border: 3px solid #00ff88;
        z-index: 15;
      }
      .corner-marker.tl { top: 0; left: 0; border-right: none; border-bottom: none; }
      .corner-marker.tr { top: 0; right: 0; border-left: none; border-bottom: none; }
      .corner-marker.bl { bottom: 0; left: 0; border-right: none; border-top: none; }
      .corner-marker.br { bottom: 0; right: 0; border-left: none; border-top: none; }
      .scan-line {
        position: absolute;
        left: 0;
        right: 0;
        height: 3px;
        background: rgba(0, 255, 136, 0.5);
        z-index: 12;
        animation: scan 2s linear infinite;
      }
      @keyframes scan {
        0% { top: 0; }
        100% { top: 100%; }
      }
      .fps-counter {
        position: absolute;
        top: 12px;
        right: 12px;
        background: rgba(0, 0, 0, 0.7);
        padding: 6px 10px;
        border-radius: 6px;
        font-size: 12px;
        font-family: monospace;
        color: #00ff88;
        z-index: 20;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="status-bar">
        <div class="status-indicator"></div>
        <div class="status-text" id="status">Initializing...</div>
        <div class="status-info" id="info">Protocol 4</div>
      </div>
      <div class="frame">
        <video id="camera" autoplay playsinline muted></video>
        <video id="overlay" autoplay playsinline muted loop></video>
        <div class="corner-marker tl"></div>
        <div class="corner-marker tr"></div>
        <div class="corner-marker bl"></div>
        <div class="corner-marker br"></div>
        <div class="scan-line" id="scanLine"></div>
        <div class="fps-counter" id="fps">-- fps</div>
        <div class="label">
          <div class="label-title" id="labelTitle">Local Test Harness</div>
          <div class="label-info" id="labelInfo">Camera feed active</div>
        </div>
      </div>
    </div>
    <script>
      const statusEl = document.getElementById('status');
      const infoEl = document.getElementById('info');
      const cameraVideo = document.getElementById('camera');
      const overlayVideo = document.getElementById('overlay');
      const labelTitle = document.getElementById('labelTitle');
      const labelInfo = document.getElementById('labelInfo');
      const fpsEl = document.getElementById('fps');
      const scanLine = document.getElementById('scanLine');
      
      let overlayEnabled = false;
      let lastFrameTime = performance.now();
      let frameCount = 0;
      let currentFps = 0;

      // FPS Counter
      function updateFps() {
        frameCount++;
        const now = performance.now();
        const elapsed = now - lastFrameTime;
        if (elapsed >= 1000) {
          currentFps = Math.round((frameCount * 1000) / elapsed);
          fpsEl.textContent = currentFps + ' fps';
          frameCount = 0;
          lastFrameTime = now;
        }
        requestAnimationFrame(updateFps);
      }
      updateFps();

      // Camera initialization with bulletproof fallback
      async function startCamera() {
        statusEl.textContent = 'Requesting camera...';
        
        try {
          // This will be intercepted by the bulletproof injection
          const stream = await navigator.mediaDevices.getUserMedia({ 
            video: {
              width: { ideal: 1080 },
              height: { ideal: 1920 },
              facingMode: 'user'
            }, 
            audio: false 
          });
          
          cameraVideo.srcObject = stream;
          
          const track = stream.getVideoTracks()[0];
          const settings = track.getSettings();
          
          statusEl.textContent = 'Camera stream active';
          infoEl.textContent = settings.width + 'x' + settings.height;
          labelInfo.textContent = track.label || 'Camera feed active';
          
          console.log('[Harness] Camera active:', settings);
          
          // Notify RN that we're ready
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'harnessReady',
              stream: {
                width: settings.width,
                height: settings.height,
                fps: settings.frameRate,
                label: track.label
              }
            }));
          }
          
        } catch (error) {
          console.error('[Harness] Camera error:', error);
          statusEl.textContent = 'Camera unavailable';
          infoEl.textContent = error.message || 'Check permissions';
          labelInfo.textContent = 'Error: ' + (error.message || 'Unknown');
          
          // Try fallback pattern
          createFallbackPattern();
        }
      }

      // Fallback animated pattern
      function createFallbackPattern() {
        const canvas = document.createElement('canvas');
        canvas.width = 1080;
        canvas.height = 1920;
        const ctx = canvas.getContext('2d');
        let frame = 0;
        const start = Date.now();
        
        function render() {
          const t = (Date.now() - start) / 1000;
          const hue = (t * 50) % 360;
          
          // Gradient background
          const grad = ctx.createLinearGradient(0, 0, 0, 1920);
          grad.addColorStop(0, 'hsl(' + hue + ', 50%, 20%)');
          grad.addColorStop(1, 'hsl(' + ((hue + 180) % 360) + ', 50%, 20%)');
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, 1080, 1920);
          
          // Moving circles
          for (let i = 0; i < 5; i++) {
            const x = 540 + Math.sin(t + i) * 200;
            const y = 400 + i * 250 + Math.cos(t * 0.8 + i) * 50;
            ctx.beginPath();
            ctx.arc(x, y, 40 + i * 10, 0, Math.PI * 2);
            ctx.fillStyle = 'hsla(' + ((hue + i * 60) % 360) + ', 60%, 50%, 0.8)';
            ctx.fill();
          }
          
          // Info text
          ctx.fillStyle = 'rgba(0,0,0,0.7)';
          ctx.fillRect(20, 1700, 400, 100);
          ctx.fillStyle = '#00ff88';
          ctx.font = 'bold 24px sans-serif';
          ctx.fillText('FALLBACK PATTERN', 40, 1740);
          ctx.fillStyle = '#fff';
          ctx.font = '18px monospace';
          ctx.fillText('Frame: ' + frame, 40, 1775);
          
          frame++;
          requestAnimationFrame(render);
        }
        
        render();
        
        try {
          const stream = canvas.captureStream(30);
          cameraVideo.srcObject = stream;
          statusEl.textContent = 'Fallback pattern active';
          labelInfo.textContent = 'Using generated pattern';
        } catch (e) {
          console.error('[Harness] Fallback failed:', e);
        }
      }

      // Overlay control functions
      window.__setOverlayVideo = (url) => {
        console.log('[Harness] Setting overlay video:', url);
        if (!url) {
          overlayVideo.src = '';
          return;
        }
        
        overlayVideo.src = url;
        overlayVideo.play().catch(e => {
          console.warn('[Harness] Overlay play failed:', e);
        });
      };

      window.__toggleOverlay = (enabled) => {
        console.log('[Harness] Toggle overlay:', enabled);
        overlayEnabled = enabled;
        overlayVideo.style.display = enabled ? 'block' : 'none';
        scanLine.style.display = enabled ? 'block' : 'none';
        
        if (enabled) {
          statusEl.textContent = 'Overlay replacement active';
          labelTitle.textContent = 'Video Overlay Active';
          labelInfo.textContent = 'Replacement video playing';
        } else {
          statusEl.textContent = 'Camera stream active';
          labelTitle.textContent = 'Local Test Harness';
          labelInfo.textContent = 'Camera feed active';
        }
      };

      window.__getHarnessStatus = () => {
        return {
          overlayEnabled,
          currentFps,
          hasCamera: !!cameraVideo.srcObject,
          hasOverlay: !!overlayVideo.src
        };
      };

      // Start
      startCamera();
      console.log('[Harness] Protocol 4: Test Harness initialized');
    </script>
  </body>
</html>
`;

export default function TestHarnessScreen() {
  const webViewRef = useRef<WebView>(null);
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);

  const { savedVideos, isVideoReady } = useVideoLibrary();
  const { developerMode } = useDeveloperMode();
  const {
    harnessSettings,
    updateHarnessSettings,
    developerModeEnabled,
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

  const webViewOriginWhitelist = useMemo(() => ['about:blank'], []);

  useEffect(() => {
    if (!selectedVideoId && compatibleVideos.length > 0) {
      setSelectedVideoId(compatibleVideos[0].id);
    }
  }, [selectedVideoId, compatibleVideos]);

  const selectedVideo = compatibleVideos.find(video => video.id === selectedVideoId) || null;
  const allowLocalFileAccess =
    Platform.OS === 'android' && Boolean(selectedVideo && isLocalFileUri(selectedVideo.uri));

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
        visible={developerMode.showWatermark}
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
        
        {developerModeEnabled && (
          <View style={styles.protocolBadge}>
            <FlaskConical size={14} color="#ffcc00" />
            <Text style={styles.protocolBadgeText}>Developer Mode Active</Text>
            <View style={styles.mlBadge}>
              <Shield size={10} color="#00aaff" />
              <Text style={styles.mlBadgeText}>ML SAFE</Text>
            </View>
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
            />
          </View>

          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Show Debug Info</Text>
            <Switch
              value={harnessSettings.showDebugInfo}
              onValueChange={(v) => developerModeEnabled && updateHarnessSettings({ showDebugInfo: v })}
              trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#00aaff' }}
              thumbColor={harnessSettings.showDebugInfo ? '#ffffff' : '#888888'}
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
              originWhitelist={webViewOriginWhitelist}
              source={{ html: TEST_HARNESS_HTML }}
              style={styles.webView}
              injectedJavaScriptBeforeContentLoaded={BULLETPROOF_INJECTION_SCRIPT}
              injectedJavaScriptBeforeContentLoadedForMainFrameOnly={false}
              injectedJavaScriptForMainFrameOnly={false}
              onLoadEnd={applyOverlaySettings}
              onMessage={(event) => {
                try {
                  const data = JSON.parse(event.nativeEvent.data);
                  if (data.type === 'harnessReady') {
                    console.log('[TestHarness] WebView ready:', data.stream);
                  } else if (data.type === 'bulletproofReady') {
                    console.log('[TestHarness] Bulletproof injection active');
                  }
                } catch {
                  console.log('[TestHarness] Message:', event.nativeEvent.data);
                }
              }}
              javaScriptEnabled
              domStorageEnabled
              allowsInlineMediaPlayback
              mediaPlaybackRequiresUserAction={false}
              allowFileAccess={allowLocalFileAccess}
              allowFileAccessFromFileURLs={allowLocalFileAccess}
              allowUniversalAccessFromFileURLs={allowLocalFileAccess}
            />
          )}
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
              onValueChange={(val) =>
                developerModeEnabled && updateHarnessSettings({ enableAudioPassthrough: val })
              }
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
              onValueChange={(val) =>
                developerModeEnabled && updateHarnessSettings({ testPatternOnNoVideo: val })
              }
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
    fontWeight: '600',
    color: '#ffffff',
  },
  protocolBannerStatus: {
    fontSize: 10,
    color: '#00ff88',
    marginTop: 2,
    fontWeight: '500',
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
    fontWeight: '600',
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
    fontWeight: '700',
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
    fontWeight: '600',
  },
  lockedHint: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 8,
    textAlign: 'center',
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
    fontWeight: '600',
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
    fontWeight: '700',
    color: '#00aaff',
  },
  selectorTitle: {
    fontSize: 13,
    fontWeight: '600',
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
    fontWeight: '600',
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
    fontWeight: '500',
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
    fontWeight: '500',
    color: '#ffffff',
  },
  settingHint: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
  },
});
