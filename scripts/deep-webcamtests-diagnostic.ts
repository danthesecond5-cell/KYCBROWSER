/**
 * Deep Diagnostic Test for webcamtests.com
 * 
 * This script performs an exhaustive analysis of what webcamtests.com expects
 * and whether our injection satisfies all requirements.
 */

import { chromium } from 'playwright';
import { createMediaInjectionScript } from '../constants/browserScripts';
import { createAdvancedProtocol2Script } from '../utils/advancedProtocol/browserScript';
import { createWorkingInjectionScript } from '../constants/workingInjection';

const TEST_URL = 'https://webcamtests.com/recorder';

type SimDevice = {
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
};

const DEVICES: SimDevice[] = [
  {
    id: 'camera_front_0',
    nativeDeviceId: 'camera_front_0',
    groupId: 'default',
    type: 'camera',
    name: 'Front Camera',
    facing: 'front',
    simulationEnabled: true,
    assignedVideoUri: null,
    capabilities: { videoResolutions: [{ width: 1080, height: 1920 }] },
  },
];

interface DiagnosticResult {
  testName: string;
  passed: boolean;
  details: any;
  error?: string;
}

async function runDeepDiagnostic(protocolName: string, injectionScript: string): Promise<DiagnosticResult[]> {
  const results: DiagnosticResult[] = [];
  
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-fake-ui-for-media-stream', '--no-sandbox', '--disable-dev-shm-usage'],
  });

  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: 390, height: 844 },
  });

  const page = await context.newPage();
  const consoleMessages: string[] = [];
  const pageErrors: string[] = [];

  page.on('pageerror', (err) => pageErrors.push(String(err)));
  page.on('console', (msg) => {
    consoleMessages.push(`[${msg.type()}] ${msg.text()}`);
  });

  try {
    // Inject script before page load
    await page.addInitScript({ content: injectionScript });
    await page.goto(TEST_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForTimeout(2000);

    // Test 1: Check if navigator.mediaDevices exists
    const test1 = await page.evaluate(() => {
      return {
        mediaDevicesExists: !!navigator.mediaDevices,
        getUserMediaExists: !!navigator.mediaDevices?.getUserMedia,
        enumerateDevicesExists: !!navigator.mediaDevices?.enumerateDevices,
      };
    });
    results.push({
      testName: 'MediaDevices API Available',
      passed: test1.mediaDevicesExists && test1.getUserMediaExists && test1.enumerateDevicesExists,
      details: test1,
    });

    // Test 2: Check enumerateDevices returns devices
    const test2 = await page.evaluate(async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(d => d.kind === 'videoinput');
        return {
          totalDevices: devices.length,
          videoDevices: videoDevices.length,
          deviceList: devices.map(d => ({ deviceId: d.deviceId, kind: d.kind, label: d.label })),
        };
      } catch (e: any) {
        return { error: e.message };
      }
    });
    results.push({
      testName: 'enumerateDevices Returns Devices',
      passed: !('error' in test2) && test2.videoDevices > 0,
      details: test2,
    });

    // Test 3: getUserMedia returns a valid stream
    const test3 = await page.evaluate(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        const tracks = stream.getTracks();
        const videoTracks = stream.getVideoTracks();
        const videoTrack = videoTracks[0];
        
        return {
          streamExists: !!stream,
          trackCount: tracks.length,
          videoTrackCount: videoTracks.length,
          videoTrackKind: videoTrack?.kind,
          videoTrackReadyState: videoTrack?.readyState,
          videoTrackEnabled: videoTrack?.enabled,
          videoTrackMuted: videoTrack?.muted,
          videoTrackLabel: videoTrack?.label,
        };
      } catch (e: any) {
        return { error: e.message, errorName: e.name };
      }
    });
    results.push({
      testName: 'getUserMedia Returns Stream',
      passed: !('error' in test3) && test3.videoTrackCount > 0 && test3.videoTrackReadyState === 'live',
      details: test3,
    });

    // Test 4: Check video track settings (webcamtests.com checks this)
    const test4 = await page.evaluate(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        const videoTrack = stream.getVideoTracks()[0];
        
        if (!videoTrack) {
          return { error: 'No video track' };
        }
        
        const settings = videoTrack.getSettings ? videoTrack.getSettings() : null;
        const capabilities = videoTrack.getCapabilities ? videoTrack.getCapabilities() : null;
        const constraints = videoTrack.getConstraints ? videoTrack.getConstraints() : null;
        
        stream.getTracks().forEach(t => t.stop());
        
        return {
          hasGetSettings: typeof videoTrack.getSettings === 'function',
          hasGetCapabilities: typeof videoTrack.getCapabilities === 'function',
          hasGetConstraints: typeof videoTrack.getConstraints === 'function',
          settings,
          capabilities,
          constraints,
        };
      } catch (e: any) {
        return { error: e.message };
      }
    });
    results.push({
      testName: 'VideoTrack Has Required Methods',
      passed: !('error' in test4) && test4.hasGetSettings && (test4.settings?.width ?? 0) > 0,
      details: test4,
    });

    // Test 5: MediaRecorder works with the stream
    const test5 = await page.evaluate(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        const videoTrack = stream.getVideoTracks()[0];
        
        if (!videoTrack || videoTrack.readyState !== 'live') {
          return { error: 'Video track not live', readyState: videoTrack?.readyState };
        }
        
        // Check MediaRecorder support
        const mimeTypes = [
          'video/webm;codecs=vp9',
          'video/webm;codecs=vp8',
          'video/webm',
          'video/mp4',
        ];
        const supportedMimeType = mimeTypes.find(t => MediaRecorder.isTypeSupported(t));
        
        if (!supportedMimeType) {
          return { error: 'No supported MIME type', checkedTypes: mimeTypes };
        }
        
        return new Promise((resolve) => {
          const chunks: Blob[] = [];
          const recorder = new MediaRecorder(stream, { mimeType: supportedMimeType });
          
          recorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) {
              chunks.push(e.data);
            }
          };
          
          recorder.onerror = (e: any) => {
            resolve({ error: 'MediaRecorder error', errorEvent: e.error?.message || 'Unknown' });
          };
          
          recorder.onstop = () => {
            const totalSize = chunks.reduce((acc, c) => acc + c.size, 0);
            stream.getTracks().forEach(t => t.stop());
            resolve({
              mimeType: supportedMimeType,
              chunkCount: chunks.length,
              totalSize,
              success: totalSize > 0,
            });
          };
          
          recorder.start(100); // Record in 100ms chunks
          
          setTimeout(() => {
            if (recorder.state === 'recording') {
              recorder.stop();
            }
          }, 1000);
        });
      } catch (e: any) {
        return { error: e.message, errorName: e.name };
      }
    });
    const test5Result = test5 as any;
    results.push({
      testName: 'MediaRecorder Records Data',
      passed: !('error' in test5Result) && test5Result.success === true && test5Result.totalSize > 0,
      details: test5Result,
    });

    // Test 6: webcamtests.com UI flow
    const test6: any = { steps: [] };
    try {
      // Check if page loaded correctly
      const pageTitle = await page.title();
      test6.steps.push({ step: 'Page Title', value: pageTitle });
      
      // Look for the Start Recording button
      const startButton = page.getByRole('button', { name: /start recording/i });
      const startButtonVisible = await startButton.isVisible().catch(() => false);
      test6.steps.push({ step: 'Start Button Visible', value: startButtonVisible });
      
      if (startButtonVisible) {
        await startButton.click({ timeout: 5000 });
        test6.steps.push({ step: 'Clicked Start', value: true });
        
        await page.waitForTimeout(2000);
        
        // Check if video element has srcObject
        const videoCheck = await page.evaluate(() => {
          const videos = Array.from(document.querySelectorAll('video'));
          return videos.map(v => ({
            hasSrcObject: !!(v as any).srcObject,
            trackCount: (v as any).srcObject?.getTracks?.()?.length || 0,
            width: v.videoWidth,
            height: v.videoHeight,
            paused: v.paused,
            readyState: v.readyState,
          }));
        });
        test6.steps.push({ step: 'Video Elements', value: videoCheck });
        
        // Look for stop button (indicates recording is active)
        const stopButton = page.getByRole('button', { name: /stop recording/i });
        const stopButtonVisible = await stopButton.isVisible().catch(() => false);
        test6.steps.push({ step: 'Stop Button Visible', value: stopButtonVisible });
        
        test6.passed = videoCheck.some(v => v.hasSrcObject && v.trackCount > 0);
      } else {
        test6.passed = false;
        test6.error = 'Start button not found';
      }
    } catch (e: any) {
      test6.error = e.message;
      test6.passed = false;
    }
    results.push({
      testName: 'webcamtests.com UI Flow',
      passed: test6.passed === true,
      details: test6,
    });

    // Test 7: Check for canvas captureStream support
    const test7 = await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      canvas.width = 100;
      canvas.height = 100;
      const ctx = canvas.getContext('2d');
      if (!ctx) return { error: 'No canvas context' };
      
      ctx.fillStyle = 'red';
      ctx.fillRect(0, 0, 100, 100);
      
      const hasCaptureStream = typeof (canvas as any).captureStream === 'function';
      
      if (hasCaptureStream) {
        const stream = (canvas as any).captureStream(30);
        const tracks = stream.getTracks();
        return {
          hasCaptureStream: true,
          trackCount: tracks.length,
          trackType: tracks[0]?.kind,
        };
      }
      
      return { hasCaptureStream: false };
    });
    results.push({
      testName: 'Canvas captureStream Support',
      passed: test7.hasCaptureStream === true && test7.trackCount > 0,
      details: test7,
    });

    // Test 8: Check injection globals
    const test8 = await page.evaluate(() => {
      return {
        workingInjectionActive: !!(window as any).__workingInjectionActive,
        mediaSimConfig: !!(window as any).__mediaSimConfig,
        advancedProtocol2Initialized: !!(window as any).__advancedProtocol2Initialized,
        earlyOverrideActive: !!(window as any).__earlyOverrideActive,
        mediaInjectorInitialized: !!(window as any).__mediaInjectorInitialized,
        bulletproofConfig: !!(window as any).__bulletproofConfig,
      };
    });
    results.push({
      testName: 'Injection Globals Present',
      passed: Object.values(test8).some(v => v === true),
      details: test8,
    });

  } catch (e: any) {
    results.push({
      testName: 'Overall Diagnostic',
      passed: false,
      details: { consoleMessages: consoleMessages.slice(-20), pageErrors },
      error: e.message,
    });
  } finally {
    await browser.close();
  }

  return results;
}

async function main() {
  console.log('='.repeat(80));
  console.log('DEEP DIAGNOSTIC: webcamtests.com Protocol Analysis');
  console.log('='.repeat(80));
  console.log();

  const protocols = [
    {
      name: 'Protocol 1: Standard (Working Injection)',
      script: createWorkingInjectionScript({
        videoUri: null,
        devices: DEVICES as any,
        stealthMode: true,
        debugEnabled: true,
        targetWidth: 1080,
        targetHeight: 1920,
        targetFPS: 30,
      }),
    },
    {
      name: 'Protocol 2: Standard (createMediaInjectionScript)',
      script: createMediaInjectionScript(DEVICES as any, {
        protocolId: 'standard',
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
      name: 'Protocol 3: Advanced Relay',
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
  ];

  for (const protocol of protocols) {
    console.log('-'.repeat(80));
    console.log(`Testing: ${protocol.name}`);
    console.log('-'.repeat(80));
    
    const results = await runDeepDiagnostic(protocol.name, protocol.script);
    
    let allPassed = true;
    for (const result of results) {
      const status = result.passed ? '✓ PASS' : '✗ FAIL';
      console.log(`  ${status}: ${result.testName}`);
      if (!result.passed) {
        allPassed = false;
        if (result.error) {
          console.log(`    Error: ${result.error}`);
        }
        console.log(`    Details: ${JSON.stringify(result.details, null, 2).split('\n').map(l => '    ' + l).join('\n').substring(4)}`);
      }
    }
    
    console.log();
    console.log(`  Overall: ${allPassed ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}`);
    console.log();
  }
}

main().catch(console.error);
