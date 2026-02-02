/**
 * Deep Diagnostic Test for webcamtests.com/recorder
 * 
 * This script performs comprehensive testing of each injection protocol
 * against the real webcamtests.com/recorder page to identify exactly
 * where and why injection might fail.
 */

import { chromium, type Browser, type Page, type BrowserContext } from 'playwright';
import { createMediaInjectionScript } from '../constants/browserScripts';
import { createAdvancedProtocol2Script } from '../utils/advancedProtocol/browserScript';
import { createWorkingInjectionScript } from '../constants/workingInjection';
import {
  createProtocol0DeepHook,
  createProtocol1MediaStreamOverride,
  createProtocol2DescriptorHook,
  createProtocol3ProxyIntercept,
} from '../utils/deepInjectionProtocols';
import type { CaptureDevice } from '../types/device';

const TEST_URL = 'https://webcamtests.com/recorder';

// Test devices
const DEVICES: CaptureDevice[] = [
  {
    id: 'camera_front_0',
    nativeDeviceId: 'camera_front_0',
    groupId: 'default',
    type: 'camera',
    name: 'Front Camera',
    facing: 'front',
    lensType: 'wide',
    tested: true,
    simulationEnabled: true,
    assignedVideoUri: null,
    capabilities: { videoResolutions: [{ width: 1080, height: 1920 }] },
  } as unknown as CaptureDevice,
];

type ProtocolTest = {
  name: string;
  id: string;
  createScript: () => string;
  description: string;
};

const PROTOCOL_TESTS: ProtocolTest[] = [
  {
    name: 'Protocol 0: Ultra-Early Deep Hook',
    id: 'protocol0',
    createScript: () => createProtocol0DeepHook({
      width: 1080,
      height: 1920,
      fps: 30,
      deviceLabel: 'Front Camera',
      deviceId: 'camera_front_0',
      showDebugOverlay: true,
      useTestPattern: true,
    }),
    description: 'Hooks getUserMedia before any page scripts load',
  },
  {
    name: 'Protocol 1: MediaStream Constructor Override',
    id: 'protocol1',
    createScript: () => createProtocol1MediaStreamOverride({
      width: 1080,
      height: 1920,
      fps: 30,
      deviceLabel: 'Front Camera',
      deviceId: 'camera_front_0',
      showDebugOverlay: true,
      useTestPattern: true,
    }),
    description: 'Intercepts MediaStream constructor and getUserMedia',
  },
  {
    name: 'Protocol 2: Descriptor-Level Hook',
    id: 'protocol2',
    createScript: () => createProtocol2DescriptorHook({
      width: 1080,
      height: 1920,
      fps: 30,
      deviceLabel: 'Front Camera',
      deviceId: 'camera_front_0',
      showDebugOverlay: true,
      useTestPattern: true,
    }),
    description: 'Overrides property descriptors on MediaDevices prototype',
  },
  {
    name: 'Protocol 3: Proxy-Based Intercept',
    id: 'protocol3',
    createScript: () => createProtocol3ProxyIntercept({
      width: 1080,
      height: 1920,
      fps: 30,
      deviceLabel: 'Front Camera',
      deviceId: 'camera_front_0',
      showDebugOverlay: true,
      useTestPattern: true,
    }),
    description: 'Uses JavaScript Proxy to intercept mediaDevices',
  },
  {
    name: 'Working Injection (React Native)',
    id: 'working',
    createScript: () => createWorkingInjectionScript({
      videoUri: null,
      devices: DEVICES,
      stealthMode: true,
      debugEnabled: true,
      targetWidth: 1080,
      targetHeight: 1920,
      targetFPS: 30,
    }),
    description: 'The "working injection" script used for RN WebView',
  },
  {
    name: 'Media Injection (Standard)',
    id: 'mediaInjection',
    createScript: () => createMediaInjectionScript(DEVICES, {
      protocolId: 'standard',
      stealthMode: true,
      forceSimulation: true,
      debugEnabled: true,
      permissionPromptEnabled: false,
      showOverlayLabel: false,
    }),
    description: 'Standard media injection with forceSimulation',
  },
  {
    name: 'Advanced Protocol 2 (WebRTC Relay)',
    id: 'advancedP2',
    createScript: () => createAdvancedProtocol2Script({
      devices: DEVICES,
      videoUri: undefined,
      enableWebRTCRelay: true,
      enableASI: true,
      enableGPU: false,
      enableCrypto: false,
      debugEnabled: true,
      stealthMode: true,
      protocolLabel: 'Advanced P2',
      showOverlayLabel: false,
    }),
    description: 'Advanced Protocol 2 with WebRTC relay and ASI',
  },
];

type DiagnosticResult = {
  protocol: string;
  description: string;
  steps: {
    scriptInjected: boolean;
    injectionDetected: boolean;
    enumerateDevicesWorks: boolean;
    devicesReturned: number;
    getUserMediaWorks: boolean;
    streamHasVideoTracks: boolean;
    trackSettings: any;
    trackCapabilities: any;
    mediaRecorderWorks: boolean;
    recordedBytes: number;
    uiButtonClicked: boolean;
    uiVideoDisplayed: boolean;
  };
  errors: string[];
  consoleOutput: string[];
  overallSuccess: boolean;
  failurePoint: string | null;
};

async function runDiagnostic(test: ProtocolTest): Promise<DiagnosticResult> {
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--use-fake-ui-for-media-stream',
      '--no-sandbox',
      '--disable-dev-shm-usage',
    ],
  });

  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: 390, height: 844 },
  });

  const page = await context.newPage();
  
  const result: DiagnosticResult = {
    protocol: test.name,
    description: test.description,
    steps: {
      scriptInjected: false,
      injectionDetected: false,
      enumerateDevicesWorks: false,
      devicesReturned: 0,
      getUserMediaWorks: false,
      streamHasVideoTracks: false,
      trackSettings: null,
      trackCapabilities: null,
      mediaRecorderWorks: false,
      recordedBytes: 0,
      uiButtonClicked: false,
      uiVideoDisplayed: false,
    },
    errors: [],
    consoleOutput: [],
    overallSuccess: false,
    failurePoint: null,
  };

  // Capture console output
  page.on('console', (msg) => {
    const text = msg.text();
    if (text.includes('[Protocol') || text.includes('[MediaSim') || 
        text.includes('[WorkingInject') || text.includes('[AdvP2') ||
        text.includes('getUserMedia') || text.includes('enumerateDevices')) {
      result.consoleOutput.push(`[${msg.type()}] ${text}`);
    }
  });

  page.on('pageerror', (err) => {
    // Ignore known irrelevant errors
    if (!err.message.includes('adsbygoogle')) {
      result.errors.push(err.message);
    }
  });

  try {
    // Step 1: Inject script before page load
    const script = test.createScript();
    await page.addInitScript({ content: script });
    result.steps.scriptInjected = true;

    // Step 2: Navigate to page
    await page.goto(TEST_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });

    // Step 3: Check if injection was detected
    const injectionStatus = await page.evaluate(() => {
      return {
        detected: !!(
          (window as any).__protocol0Initialized ||
          (window as any).__protocol1Initialized ||
          (window as any).__protocol2Initialized ||
          (window as any).__protocol3Initialized ||
          (window as any).__workingInjectionActive ||
          (window as any).__mediaInjectorInitialized ||
          (window as any).__advancedProtocol2Initialized
        ),
        flags: {
          protocol0: !!(window as any).__protocol0Initialized,
          protocol1: !!(window as any).__protocol1Initialized,
          protocol2: !!(window as any).__protocol2Initialized,
          protocol3: !!(window as any).__protocol3Initialized,
          workingInjection: !!(window as any).__workingInjectionActive,
          mediaInjector: !!(window as any).__mediaInjectorInitialized,
          advP2: !!(window as any).__advancedProtocol2Initialized,
        },
      };
    });
    result.steps.injectionDetected = injectionStatus.detected;

    if (!injectionStatus.detected) {
      result.failurePoint = 'Injection not detected - script may not have run before page';
    }

    // Step 4: Test enumerateDevices
    const enumResult = await page.evaluate(async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter((d: any) => d.kind === 'videoinput');
        return {
          success: true,
          total: devices.length,
          videoDevices: videoDevices.length,
          devices: videoDevices.map((d: any) => ({
            deviceId: d.deviceId,
            label: d.label,
            kind: d.kind,
          })),
        };
      } catch (e: any) {
        return { success: false, error: e.message };
      }
    });

    result.steps.enumerateDevicesWorks = enumResult.success;
    result.steps.devicesReturned = enumResult.videoDevices || 0;

    if (!enumResult.success) {
      result.failurePoint = result.failurePoint || `enumerateDevices failed: ${enumResult.error}`;
    }

    // Step 5: Test getUserMedia
    const gumResult = await page.evaluate(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1080 }, height: { ideal: 1920 } },
          audio: false,
        });

        if (!stream) {
          return { success: false, error: 'No stream returned' };
        }

        const videoTracks = stream.getVideoTracks();
        if (videoTracks.length === 0) {
          return { success: false, error: 'No video tracks in stream' };
        }

        const track = videoTracks[0];
        const settings = track.getSettings ? track.getSettings() : null;
        const capabilities = track.getCapabilities ? track.getCapabilities() : null;

        return {
          success: true,
          streamId: stream.id,
          videoTracksCount: videoTracks.length,
          trackInfo: {
            id: track.id,
            kind: track.kind,
            label: track.label,
            readyState: track.readyState,
            enabled: track.enabled,
            muted: track.muted,
          },
          settings,
          capabilities,
        };
      } catch (e: any) {
        return {
          success: false,
          error: e.message,
          errorName: e.name,
        };
      }
    });

    result.steps.getUserMediaWorks = gumResult.success;
    result.steps.streamHasVideoTracks = (gumResult.videoTracksCount || 0) > 0;
    result.steps.trackSettings = gumResult.settings;
    result.steps.trackCapabilities = gumResult.capabilities;

    if (!gumResult.success) {
      result.failurePoint = result.failurePoint || `getUserMedia failed: ${gumResult.error}`;
    }

    // Step 6: Test MediaRecorder
    if (gumResult.success) {
      const recorderResult = await page.evaluate(async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });

          const chunks: BlobPart[] = [];
          const recorder = new MediaRecorder(stream);
          
          const recordedPromise = new Promise<number>((resolve, reject) => {
            recorder.ondataavailable = (e) => {
              if (e.data && e.data.size > 0) chunks.push(e.data);
            };
            recorder.onerror = (e: any) => reject(new Error(e.error?.message || 'Recording failed'));
            recorder.onstop = () => {
              const blob = new Blob(chunks, { type: 'video/webm' });
              stream.getTracks().forEach(t => t.stop());
              resolve(blob.size);
            };
          });

          recorder.start(250);
          await new Promise(r => setTimeout(r, 1000));
          recorder.stop();

          const size = await recordedPromise;
          return { success: true, recordedBytes: size };
        } catch (e: any) {
          return { success: false, error: e.message };
        }
      });

      result.steps.mediaRecorderWorks = recorderResult.success;
      result.steps.recordedBytes = recorderResult.recordedBytes || 0;

      if (!recorderResult.success) {
        result.failurePoint = result.failurePoint || `MediaRecorder failed: ${recorderResult.error}`;
      }
    }

    // Step 7: Test UI interaction - click Start Recording
    try {
      const startButton = await page.getByRole('button', { name: /start recording/i });
      await startButton.click({ timeout: 10000 });
      result.steps.uiButtonClicked = true;
      
      // Wait for UI to update
      await page.waitForTimeout(2000);

      // Check if video is displayed
      const uiResult = await page.evaluate(() => {
        const videos = Array.from(document.querySelectorAll('video'));
        const activeVideos = videos.filter(v => {
          const srcObj = (v as any).srcObject;
          return srcObj && typeof srcObj.getTracks === 'function' && srcObj.getTracks().length > 0;
        });

        return {
          totalVideos: videos.length,
          activeVideos: activeVideos.length,
          videoDisplaying: activeVideos.length > 0,
        };
      });

      result.steps.uiVideoDisplayed = uiResult.videoDisplaying;

      if (!uiResult.videoDisplaying) {
        result.failurePoint = result.failurePoint || 'Video not displayed in UI after clicking Start';
      }
    } catch (e: any) {
      result.errors.push(`UI interaction failed: ${e.message}`);
      result.failurePoint = result.failurePoint || `UI button click failed: ${e.message}`;
    }

    // Determine overall success
    result.overallSuccess = 
      result.steps.injectionDetected &&
      result.steps.enumerateDevicesWorks &&
      result.steps.getUserMediaWorks &&
      result.steps.streamHasVideoTracks &&
      result.steps.mediaRecorderWorks &&
      result.steps.recordedBytes > 0;

  } catch (e: any) {
    result.errors.push(`Test error: ${e.message}`);
    result.failurePoint = result.failurePoint || `Test crashed: ${e.message}`;
  } finally {
    await page.close().catch(() => {});
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }

  return result;
}

function formatResult(result: DiagnosticResult): string {
  const status = result.overallSuccess ? '✅ PASS' : '❌ FAIL';
  let output = `\n${'='.repeat(70)}\n`;
  output += `${status} ${result.protocol}\n`;
  output += `${result.description}\n`;
  output += `${'='.repeat(70)}\n\n`;

  output += 'STEPS:\n';
  output += `  1. Script Injected:       ${result.steps.scriptInjected ? '✓' : '✗'}\n`;
  output += `  2. Injection Detected:    ${result.steps.injectionDetected ? '✓' : '✗'}\n`;
  output += `  3. enumerateDevices:      ${result.steps.enumerateDevicesWorks ? '✓' : '✗'} (${result.steps.devicesReturned} devices)\n`;
  output += `  4. getUserMedia:          ${result.steps.getUserMediaWorks ? '✓' : '✗'}\n`;
  output += `  5. Stream has video:      ${result.steps.streamHasVideoTracks ? '✓' : '✗'}\n`;
  output += `  6. MediaRecorder:         ${result.steps.mediaRecorderWorks ? '✓' : '✗'} (${result.steps.recordedBytes} bytes)\n`;
  output += `  7. UI Button Click:       ${result.steps.uiButtonClicked ? '✓' : '✗'}\n`;
  output += `  8. Video Displayed:       ${result.steps.uiVideoDisplayed ? '✓' : '✗'}\n`;

  if (result.steps.trackSettings) {
    output += `\nTRACK SETTINGS:\n`;
    output += `  Width: ${result.steps.trackSettings.width}\n`;
    output += `  Height: ${result.steps.trackSettings.height}\n`;
    output += `  FPS: ${result.steps.trackSettings.frameRate}\n`;
    output += `  DeviceId: ${result.steps.trackSettings.deviceId}\n`;
  }

  if (result.failurePoint) {
    output += `\nFAILURE POINT: ${result.failurePoint}\n`;
  }

  if (result.errors.length > 0) {
    output += `\nERRORS:\n`;
    result.errors.forEach(e => {
      output += `  - ${e}\n`;
    });
  }

  if (result.consoleOutput.length > 0) {
    output += `\nRELEVANT CONSOLE OUTPUT (last 10):\n`;
    result.consoleOutput.slice(-10).forEach(line => {
      output += `  ${line}\n`;
    });
  }

  return output;
}

async function main() {
  console.log('\n' + '█'.repeat(70));
  console.log('WEBCAMTESTS.COM DEEP DIAGNOSTIC');
  console.log('Testing all injection protocols against real website');
  console.log('█'.repeat(70) + '\n');

  const results: DiagnosticResult[] = [];

  for (const test of PROTOCOL_TESTS) {
    process.stdout.write(`Testing: ${test.name}... `);
    
    try {
      const result = await runDiagnostic(test);
      results.push(result);
      console.log(result.overallSuccess ? 'PASS' : 'FAIL');
    } catch (e: any) {
      console.log('ERROR');
      results.push({
        protocol: test.name,
        description: test.description,
        steps: {
          scriptInjected: false,
          injectionDetected: false,
          enumerateDevicesWorks: false,
          devicesReturned: 0,
          getUserMediaWorks: false,
          streamHasVideoTracks: false,
          trackSettings: null,
          trackCapabilities: null,
          mediaRecorderWorks: false,
          recordedBytes: 0,
          uiButtonClicked: false,
          uiVideoDisplayed: false,
        },
        errors: [e.message],
        consoleOutput: [],
        overallSuccess: false,
        failurePoint: `Test crashed: ${e.message}`,
      });
    }
  }

  // Print detailed results
  console.log('\n\n' + '═'.repeat(70));
  console.log('DETAILED RESULTS');
  console.log('═'.repeat(70));

  for (const result of results) {
    console.log(formatResult(result));
  }

  // Summary
  console.log('\n' + '═'.repeat(70));
  console.log('SUMMARY');
  console.log('═'.repeat(70) + '\n');

  const passed = results.filter(r => r.overallSuccess);
  const failed = results.filter(r => !r.overallSuccess);

  console.log(`Total: ${results.length} | Passed: ${passed.length} | Failed: ${failed.length}\n`);

  console.log('WORKING PROTOCOLS:');
  if (passed.length === 0) {
    console.log('  None\n');
  } else {
    passed.forEach(r => console.log(`  ✅ ${r.protocol}`));
    console.log();
  }

  console.log('FAILING PROTOCOLS:');
  if (failed.length === 0) {
    console.log('  None\n');
  } else {
    failed.forEach(r => console.log(`  ❌ ${r.protocol}: ${r.failurePoint || 'Unknown'}`));
    console.log();
  }

  // Exit with error if any failed
  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('Diagnostic crashed:', err);
  process.exitCode = 1;
});
