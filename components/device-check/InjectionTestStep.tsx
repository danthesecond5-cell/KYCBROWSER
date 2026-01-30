import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
  UIManager,
  ActivityIndicator,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { 
  FlaskConical, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Shield,
  Zap,
  Lock,
  Monitor,
} from 'lucide-react-native';
import type { CaptureDevice, DeviceModelInfo } from '@/types/device';
import type { ProtocolType } from '@/contexts/ProtocolContext';
import { 
  createMediaInjectionScript, 
  SAFARI_SPOOFING_SCRIPT,
  VIDEO_SIMULATION_TEST_SCRIPT,
} from '@/constants/browserScripts';

// Webcam test page URLs - using popular webcam test sites
const WEBCAM_TEST_PAGE = 'https://webcamtests.com/check';

interface ProtocolTestResult {
  protocol: ProtocolType;
  status: 'pending' | 'running' | 'passed' | 'failed' | 'timeout';
  startTime: number | null;
  endTime: number | null;
  duration: number | null;
  error: string | null;
  streamDetected: boolean;
  injectionActive: boolean;
  deviceLabel: string | null;
  resolution: { width: number; height: number } | null;
  fps: number | null;
}

interface InjectionTestStepProps {
  captureDevices: CaptureDevice[];
  deviceInfo: DeviceModelInfo | null;
  onTestsComplete: (results: ProtocolTestResult[]) => void;
  stealthMode?: boolean;
  assignedVideoUri?: string | null;
}

const PROTOCOL_CONFIG: Record<ProtocolType, { 
  name: string; 
  icon: typeof FlaskConical;
  color: string;
  description: string;
}> = {
  standard: {
    name: 'Standard Injection',
    icon: Zap,
    color: '#00ff88',
    description: 'Direct media stream replacement',
  },
  allowlist: {
    name: 'Allowlist Mode',
    icon: Shield,
    color: '#00aaff',
    description: 'Domain-restricted injection',
  },
  protected: {
    name: 'Protected Preview',
    icon: Lock,
    color: '#ff6b35',
    description: 'Safe video replacement with consent',
  },
  harness: {
    name: 'Local Harness',
    icon: Monitor,
    color: '#8a2be2',
    description: 'Local sandbox testing',
  },
};

const TEST_TIMEOUT_MS = 15000; // 15 seconds per test
const ALL_TESTS_TIMEOUT_MS = 60000; // 60 seconds total

// HTML for the webcam test page that will be loaded in each WebView
const createWebcamTestHtml = (protocolId: string, deviceLabel: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Webcam Test - ${protocolId}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #0a0a0a;
      color: #fff;
      font-family: -apple-system, system-ui, sans-serif;
      padding: 8px;
    }
    .container { text-align: center; }
    .status {
      font-size: 10px;
      color: rgba(255,255,255,0.6);
      margin-bottom: 6px;
      min-height: 14px;
    }
    .video-frame {
      position: relative;
      width: 100%;
      aspect-ratio: 9/16;
      max-height: 180px;
      background: #111;
      border-radius: 8px;
      overflow: hidden;
      border: 1px solid rgba(255,255,255,0.1);
    }
    video {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .overlay {
      position: absolute;
      bottom: 4px;
      left: 4px;
      right: 4px;
      background: rgba(0,0,0,0.7);
      padding: 4px 6px;
      border-radius: 4px;
      font-size: 9px;
      display: flex;
      justify-content: space-between;
    }
    .label { color: #00ff88; }
    .info { color: rgba(255,255,255,0.5); }
    .error { color: #ff4757; font-size: 10px; padding: 8px; }
    .protocol-badge {
      position: absolute;
      top: 4px;
      left: 4px;
      background: rgba(0,0,0,0.7);
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 8px;
      color: #00ff88;
      text-transform: uppercase;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="status" id="status">Initializing...</div>
    <div class="video-frame">
      <video id="video" autoplay playsinline muted></video>
      <div class="protocol-badge" id="badge">${protocolId.toUpperCase()}</div>
      <div class="overlay">
        <span class="label" id="label">-</span>
        <span class="info" id="info">-</span>
      </div>
    </div>
    <div class="error" id="error" style="display:none;"></div>
  </div>
  <script>
    const statusEl = document.getElementById('status');
    const videoEl = document.getElementById('video');
    const labelEl = document.getElementById('label');
    const infoEl = document.getElementById('info');
    const errorEl = document.getElementById('error');
    
    let testResult = {
      protocol: '${protocolId}',
      status: 'running',
      streamDetected: false,
      injectionActive: false,
      deviceLabel: null,
      resolution: null,
      fps: null,
      error: null
    };
    
    let frameCount = 0;
    let lastFpsTime = Date.now();
    
    function reportResult(result) {
      testResult = { ...testResult, ...result };
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'injectionTestResult',
          payload: testResult
        }));
      }
    }
    
    function countFrames() {
      frameCount++;
      const now = Date.now();
      if (now - lastFpsTime >= 1000) {
        testResult.fps = frameCount;
        infoEl.textContent = frameCount + ' fps | ' + (testResult.resolution?.width || '-') + 'x' + (testResult.resolution?.height || '-');
        frameCount = 0;
        lastFpsTime = now;
      }
      if (testResult.streamDetected) {
        requestAnimationFrame(countFrames);
      }
    }
    
    async function startTest() {
      statusEl.textContent = 'Requesting camera...';
      
      try {
        // Check if mediaDevices is available
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('MediaDevices API not available');
        }
        
        // Wait for injection to be ready
        await new Promise(r => setTimeout(r, 500));
        
        // Request camera with portrait constraints
        const constraints = {
          video: {
            width: { ideal: 1080 },
            height: { ideal: 1920 },
            aspectRatio: { ideal: 9/16 },
            facingMode: 'user'
          },
          audio: false
        };
        
        statusEl.textContent = 'Getting stream...';
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        
        if (!stream) {
          throw new Error('No stream returned');
        }
        
        const videoTrack = stream.getVideoTracks()[0];
        if (!videoTrack) {
          throw new Error('No video track in stream');
        }
        
        videoEl.srcObject = stream;
        await videoEl.play();
        
        const settings = videoTrack.getSettings();
        testResult.streamDetected = true;
        testResult.deviceLabel = videoTrack.label || '${deviceLabel}';
        testResult.resolution = { width: settings.width || 0, height: settings.height || 0 };
        testResult.status = 'passed';
        
        // Check if injection is active
        testResult.injectionActive = !!(
          window.__mediaInjectorInitialized ||
          window.__mediaSimConfig ||
          videoTrack.label?.includes('Simulated') ||
          videoTrack.label?.includes('Camera')
        );
        
        labelEl.textContent = testResult.deviceLabel?.substring(0, 15) || 'Camera';
        statusEl.textContent = 'Stream active';
        statusEl.style.color = '#00ff88';
        
        // Start FPS counting
        requestAnimationFrame(countFrames);
        
        reportResult(testResult);
        
      } catch (err) {
        console.error('[WebcamTest] Error:', err);
        testResult.status = 'failed';
        testResult.error = err.message || 'Unknown error';
        statusEl.textContent = 'Failed';
        statusEl.style.color = '#ff4757';
        errorEl.style.display = 'block';
        errorEl.textContent = testResult.error;
        reportResult(testResult);
      }
    }
    
    // Wait for scripts to be injected, then start test
    setTimeout(startTest, 1000);
  </script>
</body>
</html>
`;

export default function InjectionTestStep({
  captureDevices,
  deviceInfo,
  onTestsComplete,
  stealthMode = true,
  assignedVideoUri = null,
}: InjectionTestStepProps) {
  const [testResults, setTestResults] = useState<ProtocolTestResult[]>([
    { protocol: 'standard', status: 'pending', startTime: null, endTime: null, duration: null, error: null, streamDetected: false, injectionActive: false, deviceLabel: null, resolution: null, fps: null },
    { protocol: 'allowlist', status: 'pending', startTime: null, endTime: null, duration: null, error: null, streamDetected: false, injectionActive: false, deviceLabel: null, resolution: null, fps: null },
    { protocol: 'protected', status: 'pending', startTime: null, endTime: null, duration: null, error: null, streamDetected: false, injectionActive: false, deviceLabel: null, resolution: null, fps: null },
    { protocol: 'harness', status: 'pending', startTime: null, endTime: null, duration: null, error: null, streamDetected: false, injectionActive: false, deviceLabel: null, resolution: null, fps: null },
  ]);
  const [isTestingComplete, setIsTestingComplete] = useState(false);
  const [overallProgress, setOverallProgress] = useState(0);
  
  const webViewRefs = useRef<Record<ProtocolType, WebView | null>>({
    standard: null,
    allowlist: null,
    protected: null,
    harness: null,
  });
  
  const testStartTime = useRef<number>(Date.now());
  const testTimeouts = useRef<Record<ProtocolType, NodeJS.Timeout | null>>({
    standard: null,
    allowlist: null,
    protected: null,
    harness: null,
  });
  
  const webViewAvailable = Platform.OS !== 'web' && Boolean(
    UIManager.getViewManagerConfig?.('RNCWebView') ||
    UIManager.getViewManagerConfig?.('RCTWebView')
  );

  // Build device label from template
  const primaryDevice = useMemo(() => {
    return captureDevices.find(d => d.facing === 'front' && d.isDefault) ||
           captureDevices.find(d => d.facing === 'front') ||
           captureDevices[0];
  }, [captureDevices]);
  
  const deviceLabel = useMemo(() => {
    return primaryDevice?.name || deviceInfo?.model || 'Camera';
  }, [primaryDevice, deviceInfo]);

  // Create injection script tailored to the template's devices
  const createInjectionScriptForProtocol = useCallback((protocol: ProtocolType) => {
    const protocolLabel = PROTOCOL_CONFIG[protocol].name;
    
    return createMediaInjectionScript(captureDevices, {
      stealthMode,
      fallbackVideoUri: assignedVideoUri,
      forceSimulation: true, // Always force simulation for testing
      protocolId: protocol,
      protocolLabel,
      showOverlayLabel: true,
      loopVideo: true,
      mirrorVideo: false,
      debugEnabled: true,
    });
  }, [captureDevices, stealthMode, assignedVideoUri]);

  // Handle messages from WebView
  const handleWebViewMessage = useCallback((protocol: ProtocolType, event: { nativeEvent: { data: string } }) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      
      if (data.type === 'injectionTestResult') {
        const payload = data.payload;
        
        setTestResults(prev => prev.map(result => {
          if (result.protocol !== protocol) return result;
          
          const now = Date.now();
          const duration = result.startTime ? now - result.startTime : null;
          
          // Clear timeout since we got a result
          if (testTimeouts.current[protocol]) {
            clearTimeout(testTimeouts.current[protocol]!);
            testTimeouts.current[protocol] = null;
          }
          
          return {
            ...result,
            status: payload.status === 'passed' ? 'passed' : 'failed',
            endTime: now,
            duration,
            streamDetected: payload.streamDetected,
            injectionActive: payload.injectionActive,
            deviceLabel: payload.deviceLabel,
            resolution: payload.resolution,
            fps: payload.fps,
            error: payload.error,
          };
        }));
      }
    } catch (err) {
      console.warn('[InjectionTest] Failed to parse WebView message:', err);
    }
  }, []);

  // Start individual test with timeout
  const startProtocolTest = useCallback((protocol: ProtocolType) => {
    const now = Date.now();
    
    setTestResults(prev => prev.map(result => {
      if (result.protocol !== protocol) return result;
      return { ...result, status: 'running', startTime: now };
    }));
    
    // Set timeout for this test
    testTimeouts.current[protocol] = setTimeout(() => {
      setTestResults(prev => prev.map(result => {
        if (result.protocol !== protocol) return result;
        if (result.status === 'running') {
          return {
            ...result,
            status: 'timeout',
            endTime: Date.now(),
            duration: TEST_TIMEOUT_MS,
            error: 'Test timed out after ' + (TEST_TIMEOUT_MS / 1000) + ' seconds',
          };
        }
        return result;
      }));
    }, TEST_TIMEOUT_MS);
  }, []);

  // Start all tests simultaneously
  useEffect(() => {
    if (!webViewAvailable) return;
    
    testStartTime.current = Date.now();
    
    // Start all protocol tests at once
    const protocols: ProtocolType[] = ['standard', 'allowlist', 'protected', 'harness'];
    protocols.forEach(protocol => {
      startProtocolTest(protocol);
    });
    
    // Cleanup timeouts on unmount
    return () => {
      Object.values(testTimeouts.current).forEach(timeout => {
        if (timeout) clearTimeout(timeout);
      });
    };
  }, [webViewAvailable, startProtocolTest]);

  // Update progress and check completion
  useEffect(() => {
    const completed = testResults.filter(r => r.status !== 'pending' && r.status !== 'running').length;
    const progress = (completed / testResults.length) * 100;
    setOverallProgress(progress);
    
    if (completed === testResults.length && !isTestingComplete) {
      setIsTestingComplete(true);
      onTestsComplete(testResults);
    }
  }, [testResults, isTestingComplete, onTestsComplete]);

  // Get injection script to run on page load
  const getInjectionScript = useCallback((protocol: ProtocolType) => {
    const mediaScript = createInjectionScriptForProtocol(protocol);
    const spoofScript = stealthMode ? SAFARI_SPOOFING_SCRIPT : '';
    
    return `
      ${spoofScript}
      ${mediaScript}
      ${VIDEO_SIMULATION_TEST_SCRIPT}
      true;
    `;
  }, [createInjectionScriptForProtocol, stealthMode]);

  const getStatusIcon = (status: ProtocolTestResult['status']) => {
    switch (status) {
      case 'passed':
        return <CheckCircle size={16} color="#00ff88" />;
      case 'failed':
      case 'timeout':
        return <XCircle size={16} color="#ff4757" />;
      case 'running':
        return <ActivityIndicator size="small" color="#00aaff" />;
      default:
        return <Clock size={14} color="rgba(255,255,255,0.4)" />;
    }
  };

  const getStatusText = (result: ProtocolTestResult) => {
    switch (result.status) {
      case 'passed':
        return result.injectionActive ? 'Injection Active' : 'Stream OK';
      case 'failed':
        return result.error?.substring(0, 30) || 'Failed';
      case 'timeout':
        return 'Timed out';
      case 'running':
        return 'Testing...';
      default:
        return 'Waiting';
    }
  };

  const passedCount = testResults.filter(r => r.status === 'passed').length;
  const failedCount = testResults.filter(r => r.status === 'failed' || r.status === 'timeout').length;

  return (
    <View style={styles.stepContent}>
      <View style={styles.iconContainer}>
        <FlaskConical size={48} color="#8a2be2" />
      </View>
      <Text style={styles.stepTitle}>Test Injection</Text>
      <Text style={styles.stepDescription}>
        Testing webcam injection across all 4 protocols simultaneously using your template configuration.
      </Text>

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${overallProgress}%` }]} />
        </View>
        <Text style={styles.progressText}>
          {isTestingComplete 
            ? `Complete: ${passedCount} passed, ${failedCount} failed`
            : `Testing ${testResults.filter(r => r.status === 'running').length} of 4 protocols...`
          }
        </Text>
      </View>

      {/* Template Info Card */}
      <View style={styles.templateInfoCard}>
        <Text style={styles.templateInfoTitle}>Template Configuration</Text>
        <View style={styles.templateInfoRow}>
          <Text style={styles.templateInfoLabel}>Device</Text>
          <Text style={styles.templateInfoValue}>{deviceInfo?.model || 'Unknown'}</Text>
        </View>
        <View style={styles.templateInfoRow}>
          <Text style={styles.templateInfoLabel}>Cameras</Text>
          <Text style={styles.templateInfoValue}>{captureDevices.length} detected</Text>
        </View>
        <View style={styles.templateInfoRow}>
          <Text style={styles.templateInfoLabel}>Primary Camera</Text>
          <Text style={styles.templateInfoValue}>{deviceLabel}</Text>
        </View>
        <View style={styles.templateInfoRow}>
          <Text style={styles.templateInfoLabel}>Stealth Mode</Text>
          <Text style={[styles.templateInfoValue, { color: stealthMode ? '#00ff88' : '#ff4757' }]}>
            {stealthMode ? 'Enabled' : 'Disabled'}
          </Text>
        </View>
      </View>

      {/* Protocol Test Grid */}
      {!webViewAvailable ? (
        <View style={styles.unavailableCard}>
          <Text style={styles.unavailableText}>
            WebView is not available in this environment. Injection testing requires a native build.
          </Text>
        </View>
      ) : (
        <ScrollView 
          style={styles.testGrid} 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.testGridContent}
        >
          {testResults.map((result) => {
            const config = PROTOCOL_CONFIG[result.protocol];
            const IconComponent = config.icon;
            
            return (
              <View key={result.protocol} style={styles.testCard}>
                {/* Header */}
                <View style={styles.testCardHeader}>
                  <View style={[styles.protocolIcon, { backgroundColor: config.color + '20' }]}>
                    <IconComponent size={14} color={config.color} />
                  </View>
                  <View style={styles.protocolInfo}>
                    <Text style={styles.protocolName}>{config.name}</Text>
                    <Text style={styles.protocolDesc}>{config.description}</Text>
                  </View>
                  {getStatusIcon(result.status)}
                </View>
                
                {/* WebView Preview */}
                <View style={styles.webViewContainer}>
                  <WebView
                    ref={(ref) => { webViewRefs.current[result.protocol] = ref; }}
                    source={{ html: createWebcamTestHtml(result.protocol, deviceLabel) }}
                    style={styles.webView}
                    injectedJavaScript={getInjectionScript(result.protocol)}
                    onMessage={(event) => handleWebViewMessage(result.protocol, event)}
                    javaScriptEnabled
                    domStorageEnabled
                    allowsInlineMediaPlayback
                    mediaPlaybackRequiresUserAction={false}
                    onLoadEnd={() => {
                      // Inject scripts after page loads
                      const webView = webViewRefs.current[result.protocol];
                      if (webView) {
                        webView.injectJavaScript(getInjectionScript(result.protocol));
                      }
                    }}
                  />
                </View>
                
                {/* Status Footer */}
                <View style={[
                  styles.testCardFooter,
                  result.status === 'passed' && styles.testCardFooterSuccess,
                  (result.status === 'failed' || result.status === 'timeout') && styles.testCardFooterError,
                ]}>
                  <Text style={[
                    styles.statusText,
                    result.status === 'passed' && styles.statusTextSuccess,
                    (result.status === 'failed' || result.status === 'timeout') && styles.statusTextError,
                  ]}>
                    {getStatusText(result)}
                  </Text>
                  {result.resolution && result.status === 'passed' && (
                    <Text style={styles.resolutionText}>
                      {result.resolution.width}x{result.resolution.height}
                    </Text>
                  )}
                  {result.duration !== null && (
                    <Text style={styles.durationText}>
                      {(result.duration / 1000).toFixed(1)}s
                    </Text>
                  )}
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Summary */}
      {isTestingComplete && (
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Injection Test Summary</Text>
          <View style={styles.summaryStats}>
            <View style={styles.summaryStat}>
              <Text style={[styles.summaryStatValue, styles.summaryStatSuccess]}>{passedCount}</Text>
              <Text style={styles.summaryStatLabel}>Passed</Text>
            </View>
            <View style={styles.summaryStat}>
              <Text style={[styles.summaryStatValue, styles.summaryStatError]}>{failedCount}</Text>
              <Text style={styles.summaryStatLabel}>Failed</Text>
            </View>
            <View style={styles.summaryStat}>
              <Text style={styles.summaryStatValue}>{testResults.length}</Text>
              <Text style={styles.summaryStatLabel}>Total</Text>
            </View>
          </View>
          <Text style={styles.summaryNote}>
            {passedCount === testResults.length 
              ? 'All protocols working! Your template is ready for use.'
              : passedCount > 0
                ? 'Some protocols succeeded. Template can be used with working protocols.'
                : 'Injection testing had issues. Template saved with camera data only.'
            }
          </Text>
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
    backgroundColor: 'rgba(138,43,226,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    borderWidth: 2,
    borderColor: 'rgba(138,43,226,0.3)',
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
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  progressContainer: {
    width: '100%',
    marginBottom: 16,
  },
  progressBar: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#8a2be2',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    marginTop: 6,
  },
  templateInfoCard: {
    width: '100%',
    backgroundColor: 'rgba(138,43,226,0.08)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(138,43,226,0.2)',
  },
  templateInfoTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#8a2be2',
    marginBottom: 10,
  },
  templateInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  templateInfoLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
  },
  templateInfoValue: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: '#ffffff',
  },
  unavailableCard: {
    width: '100%',
    backgroundColor: 'rgba(255,107,53,0.1)',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,107,53,0.3)',
  },
  unavailableText: {
    fontSize: 13,
    color: '#ff6b35',
    textAlign: 'center',
  },
  testGrid: {
    width: '100%',
    maxHeight: 440,
  },
  testGridContent: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
  },
  testCard: {
    width: '48%',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginBottom: 10,
  },
  testCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  protocolIcon: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  protocolInfo: {
    flex: 1,
  },
  protocolName: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#ffffff',
  },
  protocolDesc: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 1,
  },
  webViewContainer: {
    height: 160,
    backgroundColor: '#0a0a0a',
  },
  webView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  testCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 8,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  testCardFooterSuccess: {
    backgroundColor: 'rgba(0,255,136,0.08)',
  },
  testCardFooterError: {
    backgroundColor: 'rgba(255,71,87,0.08)',
  },
  statusText: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.6)',
    flex: 1,
  },
  statusTextSuccess: {
    color: '#00ff88',
  },
  statusTextError: {
    color: '#ff4757',
  },
  resolutionText: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.4)',
    marginLeft: 4,
  },
  durationText: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.4)',
    marginLeft: 4,
  },
  summaryCard: {
    width: '100%',
    backgroundColor: 'rgba(0,255,136,0.08)',
    borderRadius: 16,
    padding: 20,
    marginTop: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,255,136,0.3)',
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 16,
  },
  summaryStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
  },
  summaryStat: {
    alignItems: 'center',
  },
  summaryStatValue: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: '#ffffff',
  },
  summaryStatSuccess: {
    color: '#00ff88',
  },
  summaryStatError: {
    color: '#ff4757',
  },
  summaryStatLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 4,
  },
  summaryNote: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    lineHeight: 18,
  },
});
