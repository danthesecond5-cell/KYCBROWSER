/**
 * Deep Diagnostic Harness for webcamtests.com/recorder
 * 
 * This script performs comprehensive testing of each injection protocol
 * and captures detailed diagnostics about what works and what fails.
 */
import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { createMediaInjectionScript } from '../constants/browserScripts';
import { createAdvancedProtocol2Script } from '../utils/advancedProtocol/browserScript';
import { createWorkingInjectionScript } from '../constants/workingInjection';

const TEST_URL = 'https://webcamtests.com/recorder';

interface SimDevice {
  id: string;
  nativeDeviceId?: string;
  groupId?: string;
  type: 'camera' | 'microphone';
  name?: string;
  facing?: 'front' | 'back';
  simulationEnabled?: boolean;
  assignedVideoUri?: string | null;
  capabilities?: {
    videoResolutions?: Array<{ width: number; height: number }>;
  };
}

const DEVICES: SimDevice[] = [
  {
    id: 'camera_front_0',
    nativeDeviceId: 'camera_front_0',
    groupId: 'default',
    type: 'camera',
    name: 'Front Camera',
    facing: 'front',
    simulationEnabled: true,
    assignedVideoUri: 'canvas:default',
    capabilities: { videoResolutions: [{ width: 1080, height: 1920 }] },
  },
];

interface ProtocolTest {
  name: string;
  id: string;
  script: string;
}

interface DiagnosticResult {
  protocol: string;
  success: boolean;
  diagnostics: {
    mediaDevicesAvailable: boolean;
    getUserMediaAvailable: boolean;
    enumerateDevicesAvailable: boolean;
    getUserMediaOverridden: boolean;
    enumerateDevicesOverridden: boolean;
    canvasAvailable: boolean;
    captureStreamAvailable: boolean;
    audioContextAvailable: boolean;
    rtcPeerConnectionAvailable: boolean;
    streamCreated: boolean;
    videoTracksCount: number;
    audioTracksCount: number;
    trackSettings: any;
    trackCapabilities: any;
    trackReadyState: string;
    mediaRecorderAvailable: boolean;
    recordingSuccessful: boolean;
    recordedBlobSize: number;
    uiVideoElements: number;
    uiVideosWithStream: number;
    errors: string[];
    consoleErrors: string[];
    pageErrors: string[];
    warnings: string[];
    timing: {
      scriptInjection: number;
      pageLoad: number;
      getUserMediaCall: number;
      recordingComplete: number;
    };
  };
}

async function runDeepDiagnostics(page: Page, protocol: ProtocolTest): Promise<DiagnosticResult> {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  const consoleWarnings: string[] = [];
  const consoleLogs: string[] = [];

  page.on('pageerror', (err) => pageErrors.push(String(err)));
  page.on('console', (msg) => {
    const text = msg.text();
    if (msg.type() === 'error') consoleErrors.push(text);
    else if (msg.type() === 'warning') consoleWarnings.push(text);
    else consoleLogs.push(text);
  });

  const startTime = Date.now();
  
  // Inject the script before page load
  await page.addInitScript({ content: protocol.script });
  const scriptInjectionTime = Date.now() - startTime;

  // Navigate to the test page
  await page.goto(TEST_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  const pageLoadTime = Date.now() - startTime;

  // Give the page a moment to settle
  await page.waitForTimeout(1000);

  // Run comprehensive diagnostics inside the page
  const diagnostics = await page.evaluate(async () => {
    const results: any = {
      errors: [],
      warnings: [],
    };

    try {
      // 1. Check basic API availability
      results.mediaDevicesAvailable = typeof navigator.mediaDevices !== 'undefined';
      results.getUserMediaAvailable = typeof navigator.mediaDevices?.getUserMedia === 'function';
      results.enumerateDevicesAvailable = typeof navigator.mediaDevices?.enumerateDevices === 'function';

      // 2. Check Canvas API
      results.canvasAvailable = typeof HTMLCanvasElement !== 'undefined';
      if (results.canvasAvailable) {
        const testCanvas = document.createElement('canvas');
        testCanvas.width = 100;
        testCanvas.height = 100;
        const ctx = testCanvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = 'green';
          ctx.fillRect(0, 0, 100, 100);
        }
        results.captureStreamAvailable = typeof testCanvas.captureStream === 'function';
      }

      // 3. Check AudioContext
      const AudioContextCtor = (window as any).AudioContext || (window as any).webkitAudioContext;
      results.audioContextAvailable = typeof AudioContextCtor === 'function';

      // 4. Check RTCPeerConnection
      results.rtcPeerConnectionAvailable = typeof RTCPeerConnection === 'function';

      // 5. Check MediaRecorder
      results.mediaRecorderAvailable = typeof MediaRecorder === 'function';

      // 6. Check if getUserMedia is overridden
      const gumSource = navigator.mediaDevices?.getUserMedia?.toString() || '';
      results.getUserMediaOverridden = gumSource.includes('native code') ? false : true;
      
      const enumSource = navigator.mediaDevices?.enumerateDevices?.toString() || '';
      results.enumerateDevicesOverridden = enumSource.includes('native code') ? false : true;

      // 7. Test enumerateDevices
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        results.enumeratedDevices = devices.map((d) => ({
          deviceId: d.deviceId?.substring(0, 20) + '...',
          kind: d.kind,
          label: d.label,
        }));
      } catch (e: any) {
        results.errors.push('enumerateDevices failed: ' + e.message);
      }

      // 8. Test getUserMedia
      const gumStart = Date.now();
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: {
            width: { ideal: 1080 },
            height: { ideal: 1920 },
            facingMode: 'user'
          }, 
          audio: false 
        });
        results.gumTime = Date.now() - gumStart;
        
        results.streamCreated = true;
        results.streamId = stream.id;
        
        const videoTracks = stream.getVideoTracks();
        const audioTracks = stream.getAudioTracks();
        
        results.videoTracksCount = videoTracks.length;
        results.audioTracksCount = audioTracks.length;

        if (videoTracks.length > 0) {
          const vt = videoTracks[0];
          results.trackSettings = vt.getSettings ? vt.getSettings() : null;
          results.trackCapabilities = vt.getCapabilities ? vt.getCapabilities() : null;
          results.trackReadyState = vt.readyState;
          results.trackLabel = vt.label;
          results.trackMuted = vt.muted;
          results.trackEnabled = vt.enabled;
          results.trackKind = vt.kind;
        }

        // 9. Test MediaRecorder with the stream
        if (results.mediaRecorderAvailable) {
          try {
            const chunks: Blob[] = [];
            const recorder = new MediaRecorder(stream);
            
            const recordingPromise = new Promise<number>((resolve, reject) => {
              const timeout = setTimeout(() => reject(new Error('Recording timeout')), 10000);
              
              recorder.ondataavailable = (e) => {
                if (e.data && e.data.size > 0) chunks.push(e.data);
              };
              
              recorder.onstop = () => {
                clearTimeout(timeout);
                const blob = new Blob(chunks, { type: recorder.mimeType || 'video/webm' });
                resolve(blob.size);
              };
              
              recorder.onerror = (e: any) => {
                clearTimeout(timeout);
                reject(new Error(e?.error?.message || 'MediaRecorder error'));
              };
            });

            recorder.start();
            await new Promise(r => setTimeout(r, 1500));
            recorder.stop();

            results.recordedBlobSize = await recordingPromise;
            results.recordingSuccessful = results.recordedBlobSize > 1000;
          } catch (e: any) {
            results.recordingSuccessful = false;
            results.recordedBlobSize = 0;
            results.errors.push('MediaRecorder failed: ' + e.message);
          }
        }

        // Cleanup
        stream.getTracks().forEach(t => t.stop());
      } catch (e: any) {
        results.streamCreated = false;
        results.videoTracksCount = 0;
        results.audioTracksCount = 0;
        results.gumError = e.name + ': ' + e.message;
        results.errors.push('getUserMedia failed: ' + e.name + ': ' + e.message);
      }

      // 10. Check UI elements
      const videos = Array.from(document.querySelectorAll('video'));
      results.uiVideoElements = videos.length;
      results.uiVideosWithStream = videos.filter((v: any) => v.srcObject && v.srcObject.getTracks).length;

    } catch (e: any) {
      results.errors.push('Diagnostic error: ' + e.message);
    }

    return results;
  });

  // Try to click the start recording button and verify site integration
  let uiTestResults = { success: false, details: '' };
  try {
    const startButton = page.getByRole('button', { name: /start recording/i });
    await startButton.click({ timeout: 10_000 });
    await page.waitForTimeout(2000);

    uiTestResults = await page.evaluate(() => {
      const videos = Array.from(document.querySelectorAll('video'));
      const videosWithStream = videos.filter((v: any) => v.srcObject && v.srcObject.getTracks);
      const tracks = videosWithStream.flatMap((v: any) => v.srcObject.getTracks());
      
      return {
        success: videosWithStream.length > 0 && tracks.length > 0,
        details: `Videos: ${videos.length}, With stream: ${videosWithStream.length}, Tracks: ${tracks.length}`,
      };
    });
  } catch (e: any) {
    uiTestResults.details = 'UI test failed: ' + e.message;
  }

  const totalTime = Date.now() - startTime;

  // Filter out irrelevant errors
  const IGNORED_ERRORS = [
    'adsbygoogle.push() error',
    'ResizeObserver loop',
    'Non-Error promise rejection',
  ];
  
  const relevantPageErrors = pageErrors.filter(
    e => !IGNORED_ERRORS.some(needle => e.includes(needle))
  );
  const relevantConsoleErrors = consoleErrors.filter(
    e => !IGNORED_ERRORS.some(needle => e.includes(needle))
  );

  const success = diagnostics.streamCreated && 
                  diagnostics.videoTracksCount > 0 && 
                  diagnostics.recordingSuccessful &&
                  relevantPageErrors.length === 0;

  return {
    protocol: protocol.name,
    success,
    diagnostics: {
      ...diagnostics,
      consoleErrors: relevantConsoleErrors,
      pageErrors: relevantPageErrors,
      warnings: consoleWarnings,
      timing: {
        scriptInjection: scriptInjectionTime,
        pageLoad: pageLoadTime,
        getUserMediaCall: diagnostics.gumTime || 0,
        recordingComplete: totalTime,
      },
    },
  };
}

async function main() {
  console.log('='.repeat(80));
  console.log('DEEP DIAGNOSTIC HARNESS - webcamtests.com/recorder');
  console.log('='.repeat(80));
  console.log('\nThis test will analyze each injection protocol in detail.\n');

  const protocols: ProtocolTest[] = [
    {
      name: 'Protocol 1: Standard',
      id: 'standard',
      script: createMediaInjectionScript(DEVICES as any, {
        protocolId: 'standard',
        protocolLabel: 'standard',
        stealthMode: true,
        forceSimulation: true,
        debugEnabled: true,
        permissionPromptEnabled: false,
        showOverlayLabel: false,
        loopVideo: true,
        mirrorVideo: false,
      }),
    },
    {
      name: 'Protocol 2: Allowlist',
      id: 'allowlist',
      script: createMediaInjectionScript(DEVICES as any, {
        protocolId: 'allowlist',
        protocolLabel: 'allowlist',
        stealthMode: true,
        forceSimulation: true,
        debugEnabled: true,
        permissionPromptEnabled: false,
        showOverlayLabel: false,
        loopVideo: true,
        mirrorVideo: false,
      }),
    },
    {
      name: 'Protocol 3: Protected',
      id: 'protected',
      script: createMediaInjectionScript(DEVICES as any, {
        protocolId: 'protected',
        protocolLabel: 'protected',
        stealthMode: true,
        forceSimulation: true,
        debugEnabled: true,
        permissionPromptEnabled: false,
        showOverlayLabel: false,
        loopVideo: true,
        mirrorVideo: false,
      }),
    },
    {
      name: 'Protocol 4: Harness',
      id: 'harness',
      script: createMediaInjectionScript(DEVICES as any, {
        protocolId: 'harness',
        protocolLabel: 'harness',
        stealthMode: true,
        forceSimulation: true,
        debugEnabled: true,
        permissionPromptEnabled: false,
        showOverlayLabel: false,
        loopVideo: true,
        mirrorVideo: false,
      }),
    },
    {
      name: 'Protocol 5: Holographic',
      id: 'holographic',
      script: createMediaInjectionScript(DEVICES as any, {
        protocolId: 'holographic',
        protocolLabel: 'holographic',
        stealthMode: true,
        forceSimulation: true,
        debugEnabled: true,
        permissionPromptEnabled: false,
        showOverlayLabel: false,
        loopVideo: true,
        mirrorVideo: false,
      }),
    },
    {
      name: 'Protocol 2 Advanced: WebRTC Relay',
      id: 'advanced-relay',
      script: createAdvancedProtocol2Script({
        devices: DEVICES as any,
        videoUri: undefined,
        enableWebRTCRelay: true,
        enableASI: true,
        enableGPU: false,
        enableCrypto: false,
        debugEnabled: true,
        stealthMode: true,
        protocolLabel: 'Advanced Relay',
        showOverlayLabel: false,
      }),
    },
    {
      name: 'Working Injection (Base)',
      id: 'working-injection',
      script: createWorkingInjectionScript({
        devices: DEVICES as any,
        videoUri: undefined,
        stealthMode: true,
        debugEnabled: true,
        targetWidth: 1080,
        targetHeight: 1920,
        targetFPS: 30,
      }),
    },
  ];

  const results: DiagnosticResult[] = [];

  for (const protocol of protocols) {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`Testing: ${protocol.name}`);
    console.log(`${'─'.repeat(60)}`);

    const browser = await chromium.launch({
      headless: true,
      args: [
        '--use-fake-ui-for-media-stream',
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--autoplay-policy=no-user-gesture-required',
      ],
    });

    const context = await browser.newContext({
      ignoreHTTPSErrors: true,
      viewport: { width: 390, height: 844 },
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
    });

    const page = await context.newPage();

    try {
      const result = await runDeepDiagnostics(page, protocol);
      results.push(result);

      // Print summary
      console.log(`\n  Status: ${result.success ? '✅ PASS' : '❌ FAIL'}`);
      console.log(`  Stream Created: ${result.diagnostics.streamCreated ? '✓' : '✗'}`);
      console.log(`  Video Tracks: ${result.diagnostics.videoTracksCount}`);
      console.log(`  Recording Success: ${result.diagnostics.recordingSuccessful ? '✓' : '✗'}`);
      console.log(`  Recorded Blob Size: ${result.diagnostics.recordedBlobSize} bytes`);
      
      if (result.diagnostics.trackSettings) {
        console.log(`  Track Settings: ${JSON.stringify(result.diagnostics.trackSettings, null, 2).substring(0, 200)}...`);
      }
      
      if (result.diagnostics.errors.length > 0) {
        console.log(`  Errors: ${result.diagnostics.errors.join(', ')}`);
      }
      
      if (result.diagnostics.pageErrors.length > 0) {
        console.log(`  Page Errors: ${result.diagnostics.pageErrors.join(', ').substring(0, 200)}`);
      }

      console.log(`  Timing: Load=${result.diagnostics.timing.pageLoad}ms, GUM=${result.diagnostics.timing.getUserMediaCall}ms`);

    } catch (e: any) {
      console.error(`  Error running test: ${e.message}`);
      results.push({
        protocol: protocol.name,
        success: false,
        diagnostics: {
          errors: [`Test error: ${e.message}`],
        } as any,
      });
    } finally {
      await page.close();
      await context.close();
      await browser.close();
    }
  }

  // Print final summary
  console.log('\n' + '='.repeat(80));
  console.log('FINAL SUMMARY');
  console.log('='.repeat(80));
  
  const passed = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  console.log(`\nTotal: ${results.length} | Passed: ${passed.length} | Failed: ${failed.length}\n`);

  console.log('RESULTS BY PROTOCOL:');
  for (const result of results) {
    const status = result.success ? '✅ PASS' : '❌ FAIL';
    const recordingInfo = result.diagnostics.recordingSuccessful 
      ? `recorded ${result.diagnostics.recordedBlobSize} bytes`
      : 'recording failed';
    console.log(`  ${status} ${result.protocol} - ${recordingInfo}`);
  }

  if (failed.length > 0) {
    console.log('\nFAILURE DETAILS:');
    for (const result of failed) {
      console.log(`\n  ${result.protocol}:`);
      if (result.diagnostics.errors?.length > 0) {
        result.diagnostics.errors.forEach(e => console.log(`    - ${e}`));
      }
      if (result.diagnostics.pageErrors?.length > 0) {
        result.diagnostics.pageErrors.slice(0, 3).forEach(e => console.log(`    - Page: ${e.substring(0, 100)}`));
      }
    }
  }

  console.log('\n' + '='.repeat(80));
  
  // Exit with appropriate code
  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('Harness crashed:', e);
  process.exit(1);
});
