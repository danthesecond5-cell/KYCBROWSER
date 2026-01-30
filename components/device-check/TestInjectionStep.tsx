import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Platform, UIManager } from 'react-native';
import { WebView } from 'react-native-webview';
import { Globe, CheckCircle, XCircle, Loader } from 'lucide-react-native';
import type { CaptureDevice, DeviceModelInfo } from '@/types/device';
import { APP_CONFIG } from '@/constants/app';
import {
  SAMPLE_VIDEOS,
  DEFAULT_PORTRAIT_RESOLUTION,
  findBestMatchingResolution,
} from '@/constants/sampleVideos';
import { createMediaInjectionScript, VIDEO_SIMULATION_TEST_SCRIPT } from '@/constants/browserScripts';
import { formatVideoUriForWebView } from '@/utils/videoServing';
import { useProtocol, type ProtocolType } from '@/contexts/ProtocolContext';
import { useDeviceTemplate } from '@/contexts/DeviceTemplateContext';

interface TestInjectionStepProps {
  captureDevices: CaptureDevice[];
  deviceInfo: DeviceModelInfo | null;
  onCompletionChange: (complete: boolean) => void;
}

type InjectionStatus = 'idle' | 'loading' | 'running' | 'success' | 'failed' | 'skipped';

interface ProtocolTestState {
  status: InjectionStatus;
  detail?: string;
  startedAt?: number;
  completedAt?: number;
}

interface ProtocolRunConfig {
  protocolId: ProtocolType;
  name: string;
  enabled: boolean;
  note?: string;
  stealthMode: boolean;
  forceSimulation: boolean;
  mirrorVideo: boolean;
  protocolLabel: string;
  showOverlayLabel: boolean;
}

const PROTOCOL_ORDER: ProtocolType[] = ['standard', 'allowlist', 'protected', 'harness'];
const TEST_TIMEOUT_MS = 20000;

const AUTO_RUN_SCRIPT = `
(function() {
  function postResult(success, errorMessage) {
    if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'videoSimTestResult',
        payload: {
          success: success,
          errors: errorMessage ? [errorMessage] : [],
          steps: [],
          timestamp: new Date().toISOString()
        }
      }));
    }
  }

  if (window.__runVideoSimulationTest) {
    window.__runVideoSimulationTest().catch(function(err) {
      postResult(false, err && err.message ? err.message : 'Video simulation test failed');
    });
    return;
  }

  if (!navigator || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    postResult(false, 'MediaDevices API unavailable');
    return;
  }

  navigator.mediaDevices.getUserMedia({ video: true, audio: false })
    .then(function(stream) {
      stream.getTracks().forEach(function(track) { track.stop(); });
      postResult(true);
    })
    .catch(function(err) {
      postResult(false, err && err.message ? err.message : 'getUserMedia failed');
    });
})();
true;
`;

const createInitialStates = (): Record<ProtocolType, ProtocolTestState> => ({
  standard: { status: 'idle' },
  allowlist: { status: 'idle' },
  protected: { status: 'idle' },
  harness: { status: 'idle' },
});

const STATUS_LABELS: Record<InjectionStatus, string> = {
  idle: 'Queued',
  loading: 'Loading',
  running: 'Running',
  success: 'Passed',
  failed: 'Failed',
  skipped: 'Skipped',
};

export default function TestInjectionStep({
  captureDevices,
  deviceInfo,
  onCompletionChange,
}: TestInjectionStepProps) {
  const {
    protocols,
    standardSettings,
    allowlistSettings,
    protectedSettings,
    harnessSettings,
    isAllowlisted,
    developerModeEnabled,
  } = useProtocol();
  const { shouldUseStealthForUrl } = useDeviceTemplate();

  const webViewAvailable = Platform.OS !== 'web' && Boolean(
    UIManager.getViewManagerConfig?.('RNCWebView') ||
    UIManager.getViewManagerConfig?.('RCTWebView')
  );
  const sessionIdRef = useRef(`inj_${Date.now().toString(36)}`);
  const timeoutsRef = useRef<Record<ProtocolType, ReturnType<typeof setTimeout> | null>>({
    standard: null,
    allowlist: null,
    protected: null,
    harness: null,
  });
  const [testStates, setTestStates] = useState<Record<ProtocolType, ProtocolTestState>>(
    () => createInitialStates()
  );

  const testUrl = APP_CONFIG.WEBVIEW.TEST_URL;
  const testHostname = useMemo(() => {
    const normalized = testUrl.replace(/^https?:\/\//i, '');
    const host = normalized.split('/')[0] || '';
    return host.split('?')[0];
  }, [testUrl]);
  const allowlistAllowed = testHostname ? isAllowlisted(testHostname) : true;
  const allowlistBlocked = allowlistSettings.enabled && allowlistSettings.blockUnlisted && !allowlistAllowed;

  const sampleVideo = useMemo(() => {
    return SAMPLE_VIDEOS.find(video => video.id === 'canvas_webcam_ready') || SAMPLE_VIDEOS[0];
  }, []);
  const defaultResolution = useMemo(() => {
    if (sampleVideo?.resolutions?.[0]) return sampleVideo.resolutions[0];
    return {
      label: 'Default',
      width: DEFAULT_PORTRAIT_RESOLUTION.width,
      height: DEFAULT_PORTRAIT_RESOLUTION.height,
      fps: DEFAULT_PORTRAIT_RESOLUTION.fps,
      url: 'canvas:default',
    };
  }, [sampleVideo]);

  const getPortraitTarget = useCallback((device: CaptureDevice) => {
    const res = device.capabilities?.videoResolutions?.[0];
    if (!res) {
      return {
        width: DEFAULT_PORTRAIT_RESOLUTION.width,
        height: DEFAULT_PORTRAIT_RESOLUTION.height,
        fps: DEFAULT_PORTRAIT_RESOLUTION.fps,
      };
    }
    const width = Math.min(res.width, res.height);
    const height = Math.max(res.width, res.height);
    return {
      width,
      height,
      fps: res.maxFps || DEFAULT_PORTRAIT_RESOLUTION.fps,
    };
  }, []);

  const resolveSampleResolution = useCallback((device: CaptureDevice) => {
    if (!sampleVideo) return defaultResolution;
    const target = getPortraitTarget(device);
    const match = findBestMatchingResolution(
      sampleVideo,
      target.width,
      target.height,
      target.fps
    );
    return match || defaultResolution;
  }, [defaultResolution, getPortraitTarget, sampleVideo]);

  const testDevices = useMemo(() => {
    return captureDevices.map(device => {
      const resolution = resolveSampleResolution(device);
      return {
        ...device,
        simulationEnabled: true,
        assignedVideoUri: formatVideoUriForWebView(resolution.url),
        assignedVideoName: `${sampleVideo?.name || 'Test Pattern'} (${resolution.label})`,
      };
    });
  }, [captureDevices, resolveSampleResolution, sampleVideo]);

  const fallbackDevice = testDevices.find(device => device.facing === 'front') || testDevices[0];
  const fallbackVideoUri = fallbackDevice?.assignedVideoUri || formatVideoUriForWebView(defaultResolution.url);
  const fallbackVideoName = fallbackDevice?.assignedVideoName || sampleVideo?.name || 'Test Pattern';

  const normalizedDevices = useMemo(() => {
    return testDevices.map(device => ({
      ...device,
      assignedVideoUri: device.assignedVideoUri || fallbackVideoUri,
      assignedVideoName: device.assignedVideoName || fallbackVideoName,
    }));
  }, [fallbackVideoName, fallbackVideoUri, testDevices]);

  const baseStealthMode = useMemo(() => {
    if (!standardSettings.stealthByDefault) return false;
    if (!standardSettings.respectSiteSettings) return true;
    return shouldUseStealthForUrl(testUrl);
  }, [
    standardSettings.stealthByDefault,
    standardSettings.respectSiteSettings,
    shouldUseStealthForUrl,
    testUrl,
  ]);

  const protocolRuns: ProtocolRunConfig[] = useMemo(() => {
    return PROTOCOL_ORDER.map((protocolId, index) => {
      const protocol = protocols[protocolId];
      const enabled = protocol?.enabled ?? true;
      const name = protocol?.name || `Protocol ${index + 1}`;
      const stealthMode = protocolId === 'protected' || protocolId === 'harness'
        ? true
        : baseStealthMode;
      const forceSimulation = protocolId === 'protected' || (
        protocolId === 'harness' && harnessSettings.overlayEnabled
      );
      const mirrorVideo = protocolId === 'harness' && harnessSettings.mirrorVideo;
      let protocolLabel = '';

      if (protocolId === 'protected') {
        protocolLabel = 'Protected Replacement Active';
      } else if (protocolId === 'harness') {
        protocolLabel = harnessSettings.overlayEnabled ? 'Harness Overlay Active' : 'Harness Ready';
      } else if (protocolId === 'allowlist' && allowlistSettings.enabled) {
        protocolLabel = allowlistBlocked ? 'Allowlist Blocked' : 'Allowlist Active';
      }

      const showOverlayLabel = protocolId === 'protected'
        ? protectedSettings.showProtectedBadge
        : protocolId === 'harness'
          ? (harnessSettings.showDebugInfo || harnessSettings.overlayEnabled)
          : false;

      const note = protocolId === 'allowlist' && allowlistBlocked
        ? 'Allowlist blocks this domain. Injection forced for diagnostics.'
        : undefined;

      return {
        protocolId,
        name,
        enabled,
        note,
        stealthMode,
        forceSimulation,
        mirrorVideo,
        protocolLabel,
        showOverlayLabel,
      };
    });
  }, [
    protocols,
    baseStealthMode,
    harnessSettings.overlayEnabled,
    harnessSettings.mirrorVideo,
    harnessSettings.showDebugInfo,
    allowlistSettings.enabled,
    allowlistBlocked,
    protectedSettings.showProtectedBadge,
  ]);

  const originWhitelist = useMemo(() => ['https://*', 'http://*', 'about:blank', 'blob:*', 'data:*'], []);

  const updateStatus = useCallback((
    protocolId: ProtocolType,
    updater: ProtocolTestState | ((current: ProtocolTestState) => ProtocolTestState)
  ) => {
    setTestStates(prev => {
      const current = prev[protocolId];
      const next = typeof updater === 'function' ? updater(current) : { ...current, ...updater };
      return { ...prev, [protocolId]: next };
    });
  }, []);

  const clearTimeoutFor = useCallback((protocolId: ProtocolType) => {
    const timeout = timeoutsRef.current[protocolId];
    if (timeout) {
      clearTimeout(timeout);
      timeoutsRef.current[protocolId] = null;
    }
  }, []);

  const handleTimeout = useCallback((protocolId: ProtocolType) => {
    updateStatus(protocolId, current => {
      if (['success', 'failed', 'skipped'].includes(current.status)) return current;
      return {
        ...current,
        status: 'failed',
        detail: 'Test timed out before completion.',
        completedAt: Date.now(),
      };
    });
  }, [updateStatus]);

  const handleMessage = useCallback((protocolId: ProtocolType, rawMessage: string) => {
    let data: any = null;
    try {
      data = JSON.parse(rawMessage);
    } catch (error) {
      return;
    }

    if (data?.type === 'videoSimTestResult') {
      clearTimeoutFor(protocolId);
      const success = Boolean(data?.payload?.success);
      const errors: string[] = data?.payload?.errors || [];
      updateStatus(protocolId, current => {
        if (['success', 'failed', 'skipped'].includes(current.status)) return current;
        return {
          ...current,
          status: success ? 'success' : 'failed',
          detail: success ? undefined : (errors[0] || 'Simulation test failed.'),
          completedAt: Date.now(),
        };
      });
      return;
    }

    if (data?.type === 'error') {
      updateStatus(protocolId, current => {
        if (['success', 'failed', 'skipped'].includes(current.status)) return current;
        return {
          ...current,
          detail: current.detail || data?.message || 'Injection error detected.',
        };
      });
    }
  }, [clearTimeoutFor, updateStatus]);

  useEffect(() => {
    if (!webViewAvailable) {
      setTestStates(prev => {
        const next = { ...prev };
        PROTOCOL_ORDER.forEach(protocolId => {
          next[protocolId] = {
            status: 'skipped',
            detail: 'WebView is unavailable on this build.',
            completedAt: Date.now(),
          };
        });
        return next;
      });
    }
  }, [webViewAvailable]);

  useEffect(() => {
    const complete = PROTOCOL_ORDER.every(protocolId =>
      ['success', 'failed', 'skipped'].includes(testStates[protocolId].status)
    );
    onCompletionChange(complete);
  }, [onCompletionChange, testStates]);

  useEffect(() => {
    return () => {
      PROTOCOL_ORDER.forEach(protocolId => clearTimeoutFor(protocolId));
    };
  }, [clearTimeoutFor]);

  const renderStatusBadge = (status: InjectionStatus) => (
    <View style={[styles.statusBadge, styles[`status${status.charAt(0).toUpperCase()}${status.slice(1)}`]]}>
      <Text style={styles.statusBadgeText}>{STATUS_LABELS[status]}</Text>
    </View>
  );

  const getBeforeLoadScript = useCallback((config: ProtocolRunConfig) => {
    const script = createMediaInjectionScript(normalizedDevices, {
      stealthMode: config.stealthMode,
      fallbackVideoUri,
      forceSimulation: config.forceSimulation,
      protocolId: config.protocolId,
      protocolLabel: config.protocolLabel,
      showOverlayLabel: config.showOverlayLabel,
      loopVideo: standardSettings.loopVideo,
      mirrorVideo: config.mirrorVideo,
      debugEnabled: developerModeEnabled,
    });
    return `${script}\n${VIDEO_SIMULATION_TEST_SCRIPT}`;
  }, [
    developerModeEnabled,
    fallbackVideoUri,
    normalizedDevices,
    standardSettings.loopVideo,
  ]);

  const completedCount = PROTOCOL_ORDER.filter(protocolId =>
    ['success', 'failed', 'skipped'].includes(testStates[protocolId].status)
  ).length;

  return (
    <View style={styles.stepContent}>
      <View style={styles.iconContainer}>
        <Globe size={48} color="#00ff88" />
      </View>
      <Text style={styles.stepTitle}>Test Injection</Text>
      <Text style={styles.stepDescription}>
        The webcam test page is loaded four times in parallel - one per protocol. These runs use your
        template camera data and tuned fallback patterns to maximize injection success.
      </Text>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Injection Summary</Text>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Template</Text>
          <Text style={styles.summaryValue}>{deviceInfo?.model || 'Unknown device'}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Cameras Prepared</Text>
          <Text style={styles.summaryValue}>{normalizedDevices.length}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Fallback Pattern</Text>
          <Text style={styles.summaryValue}>{fallbackVideoName}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Protocols Completed</Text>
          <Text style={styles.summaryValue}>{completedCount}/{PROTOCOL_ORDER.length}</Text>
        </View>
      </View>

      {!webViewAvailable ? (
        <View style={styles.unavailableCard}>
          <Text style={styles.unavailableTitle}>WebView Unavailable</Text>
          <Text style={styles.unavailableText}>
            Injection tests require the native WebView module. Run this step on a device build to verify
            protocol injection behavior.
          </Text>
        </View>
      ) : (
        <View style={styles.protocolGrid}>
          {protocolRuns.map(config => {
            const state = testStates[config.protocolId];
            const statusIcon = state.status === 'success'
              ? <CheckCircle size={14} color="#00ff88" />
              : state.status === 'failed'
                ? <XCircle size={14} color="#ff4757" />
                : <Loader size={14} color="rgba(255,255,255,0.6)" />;
            const testUri = `${testUrl}${testUrl.includes('?') ? '&' : '?'}protocol=${config.protocolId}&run=${sessionIdRef.current}`;

            return (
              <View key={config.protocolId} style={styles.protocolCard}>
                <View style={styles.protocolHeader}>
                  <View style={styles.protocolTitleRow}>
                    <Text style={styles.protocolName}>{config.name}</Text>
                    {statusIcon}
                  </View>
                  {renderStatusBadge(state.status)}
                </View>
                {config.note && (
                  <Text style={styles.protocolNote}>{config.note}</Text>
                )}
                <View style={styles.webViewFrame}>
                  <WebView
                    source={{ uri: testUri }}
                    style={styles.webView}
                    originWhitelist={originWhitelist}
                    injectedJavaScriptBeforeContentLoaded={getBeforeLoadScript(config)}
                    injectedJavaScript={AUTO_RUN_SCRIPT}
                    onLoadStart={() => {
                      updateStatus(config.protocolId, current => ({
                        ...current,
                        status: 'loading',
                        startedAt: Date.now(),
                      }));
                    }}
                    onLoadEnd={() => {
                      updateStatus(config.protocolId, current => ({
                        ...current,
                        status: current.status === 'loading' ? 'running' : current.status,
                      }));
                      clearTimeoutFor(config.protocolId);
                      timeoutsRef.current[config.protocolId] = setTimeout(() => {
                        handleTimeout(config.protocolId);
                      }, TEST_TIMEOUT_MS);
                    }}
                    onError={(event) => {
                      updateStatus(config.protocolId, current => ({
                        ...current,
                        status: 'failed',
                        detail: event.nativeEvent.description || 'WebView load error.',
                        completedAt: Date.now(),
                      }));
                    }}
                    onHttpError={(event) => {
                      updateStatus(config.protocolId, current => ({
                        ...current,
                        status: 'failed',
                        detail: `HTTP ${event.nativeEvent.statusCode}`,
                        completedAt: Date.now(),
                      }));
                    }}
                    onMessage={(event) => handleMessage(config.protocolId, event.nativeEvent.data)}
                    javaScriptEnabled={true}
                    domStorageEnabled={true}
                    mediaPlaybackRequiresUserAction={false}
                    scrollEnabled={false}
                  />
                </View>
                {state.detail && (
                  <Text style={styles.statusDetail}>{state.detail}</Text>
                )}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  stepContent: {
    alignItems: 'center',
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(0,255,136,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    borderWidth: 2,
    borderColor: 'rgba(0,255,136,0.3)',
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#ffffff',
    marginBottom: 12,
    textAlign: 'center',
  },
  stepDescription: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  summaryCard: {
    width: '100%',
    backgroundColor: 'rgba(0,255,136,0.08)',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(0,255,136,0.3)',
    marginBottom: 20,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#ffffff',
    marginBottom: 12,
    textAlign: 'center',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  summaryLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#00ff88',
  },
  unavailableCard: {
    width: '100%',
    backgroundColor: 'rgba(255, 165, 0, 0.08)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 165, 0, 0.3)',
  },
  unavailableTitle: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#ffa502',
    marginBottom: 6,
  },
  unavailableText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 18,
  },
  protocolGrid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  protocolCard: {
    width: '48%',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  protocolHeader: {
    marginBottom: 8,
  },
  protocolTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  protocolName: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#ffffff',
    flex: 1,
  },
  protocolNote: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 6,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 6,
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: '700' as const,
    textTransform: 'uppercase' as const,
    color: '#0a0a0a',
  },
  statusIdle: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  statusLoading: {
    backgroundColor: 'rgba(255, 170, 0, 0.8)',
  },
  statusRunning: {
    backgroundColor: 'rgba(0, 170, 255, 0.8)',
  },
  statusSuccess: {
    backgroundColor: 'rgba(0,255,136,0.9)',
  },
  statusFailed: {
    backgroundColor: 'rgba(255, 71, 87, 0.9)',
  },
  statusSkipped: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  webViewFrame: {
    width: '100%',
    height: 140,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#0a0a0a',
  },
  webView: {
    flex: 1,
  },
  statusDetail: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 6,
  },
});
