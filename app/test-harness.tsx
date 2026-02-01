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
import { useProtocol } from '@/contexts/ProtocolContext';
import { formatVideoUriForWebView, isLocalFileUri } from '@/utils/videoServing';
import TestingWatermark from '@/components/TestingWatermark';

const TEST_HARNESS_HTML = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Camera Test Harness</title>
    <style>
      body {
        margin: 0;
        background: #0a0a0a;
        color: #ffffff;
        font-family: -apple-system, system-ui, sans-serif;
      }
      .container {
        padding: 12px;
      }
      .status {
        font-size: 12px;
        color: rgba(255, 255, 255, 0.6);
        margin-bottom: 10px;
      }
      .frame {
        position: relative;
        border-radius: 12px;
        overflow: hidden;
        background: #111111;
        border: 1px solid rgba(255, 255, 255, 0.1);
        height: 360px;
      }
      video {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      #overlay {
        position: absolute;
        inset: 0;
        display: none;
        background: #000000;
      }
      .label {
        position: absolute;
        bottom: 10px;
        left: 10px;
        right: 10px;
        text-align: center;
        background: rgba(0, 0, 0, 0.6);
        padding: 6px 10px;
        border-radius: 8px;
        font-size: 12px;
        color: #00ff88;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="status" id="status">Requesting camera access...</div>
      <div class="frame">
        <video id="camera" autoplay playsinline muted></video>
        <video id="overlay" autoplay playsinline muted loop></video>
        <div class="label" id="label">Local Test Harness</div>
      </div>
    </div>
    <script>
      const statusEl = document.getElementById('status');
      const cameraVideo = document.getElementById('camera');
      const overlayVideo = document.getElementById('overlay');

      async function startCamera() {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
          cameraVideo.srcObject = stream;
          statusEl.textContent = 'Camera stream active.';
        } catch (error) {
          statusEl.textContent = 'Camera unavailable. Check permissions.';
        }
      }

      window.__setOverlayVideo = (url) => {
        if (!url) return;
        overlayVideo.src = url;
        overlayVideo.play().catch(() => {});
      };

      window.__toggleOverlay = (enabled) => {
        overlayVideo.style.display = enabled ? 'block' : 'none';
        statusEl.textContent = enabled
          ? 'Overlay replacement active.'
          : 'Overlay replacement disabled.';
      };

      startCamera();
    </script>
  </body>
</html>
`;

export default function TestHarnessScreen() {
  const webViewRef = useRef<WebView>(null);
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);

  const { savedVideos, isVideoReady } = useVideoLibrary();
  const {
    harnessSettings,
    updateHarnessSettings,
    developerModeEnabled,
    showTestingWatermark,
    presentationMode,
    mlSafetyEnabled,
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
  const allowLocalFileAccess = Platform.OS === 'android' && Boolean(selectedVideo && isLocalFileUri(selectedVideo.uri));

  useEffect(() => {
    if (!selectedVideoId && compatibleVideos.length > 0) {
      setSelectedVideoId(compatibleVideos[0].id);
    }
  }, [selectedVideoId, compatibleVideos]);

  const selectedVideo = compatibleVideos.find(video => video.id === selectedVideoId) || null;

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
              originWhitelist={webViewOriginWhitelist}
              source={{ html: TEST_HARNESS_HTML }}
              style={styles.webView}
              onLoadEnd={applyOverlaySettings}
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
});
