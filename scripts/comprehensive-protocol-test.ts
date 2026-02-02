/**
 * Comprehensive Protocol Test for webcamtests.com/recorder
 * Tests ALL protocols including Sonnet Protocol with real video sources
 */

import { chromium, type Browser, type Page } from 'playwright';
import { createMediaInjectionScript } from '../constants/browserScripts';
import { createSonnetProtocolScript, type SonnetProtocolConfig } from '../constants/sonnetProtocol';
import { createAdvancedProtocol2Script } from '../utils/advancedProtocol/browserScript';
import { createWorkingInjectionScript } from '../constants/workingInjection';
import type { CaptureDevice } from '../types/device';

const TARGET_URL = 'https://webcamtests.com/recorder';
const TEST_TIMEOUT = 120000;

interface TestResult {
  protocolName: string;
  protocolId: string;
  success: boolean;
  details: {
    injectionDetected: boolean;
    getUserMediaSuccess: boolean;
    streamTracks?: { video: number; audio: number };
    videoSettings?: any;
    canPlayVideo: boolean;
    recordingStarted: boolean;
    recordedDataSize?: number;
    errors: string[];
    pageErrors: string[];
  };
}

const devices: CaptureDevice[] = [
  {
    id: 'cam_front',
    nativeDeviceId: 'cam_front_native',
    name: 'Front Camera (Test)',
    type: 'camera',
    facing: 'front',
    lensType: 'wide',
    groupId: 'group_default',
    tested: true,
    simulationEnabled: true,
    capabilities: {
      photoResolutions: [],
      videoResolutions: [
        { width: 1080, height: 1920, label: '1080p', maxFps: 30 },
        { width: 720, height: 1280, label: '720p', maxFps: 30 },
      ],
      supportedModes: ['video'],
    },
  },
];

async function testProtocol(
  protocolName: string,
  protocolId: string,
  injectionScript: string
): Promise<TestResult> {
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--use-fake-ui-for-media-stream',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--autoplay-policy=no-user-gesture-required',
    ],
  });

  const result: TestResult = {
    protocolName,
    protocolId,
    success: false,
    details: {
      injectionDetected: false,
      getUserMediaSuccess: false,
      canPlayVideo: false,
      recordingStarted: false,
      errors: [],
      pageErrors: [],
    },
  };

  try {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      ignoreHTTPSErrors: true,
    });

    const page = await context.newPage();

    // Collect errors
    page.on('pageerror', (err) => {
      const errStr = String(err.message || err);
      if (!errStr.includes('adsbygoogle')) {
        result.details.pageErrors.push(errStr);
      }
    });

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (!text.includes('adsbygoogle')) {
          result.details.errors.push(text);
        }
      }
    });

    // Inject script before page load
    await page.addInitScript({ content: injectionScript });

    // Navigate to test site
    await page.goto(TARGET_URL, { 
      waitUntil: 'domcontentloaded', 
      timeout: TEST_TIMEOUT 
    });

    // Give injection time to initialize
    await page.waitForTimeout(1000);

    // Deep protocol validation
    const validation = await page.evaluate(async () => {
      const output: any = {
        injectionDetected: false,
        getUserMediaSuccess: false,
        canPlayVideo: false,
        streamTracks: { video: 0, audio: 0 },
        errors: [],
      };

      // Check for injection markers
      const injectionMarkers = [
        '__mediaInjectorInitialized',
        '__mediaSimConfig',
        '__workingInjectionActive',
        '__advancedProtocol2Initialized',
        '__sonnetProtocolInitialized',
      ];

      for (const marker of injectionMarkers) {
        if ((window as any)[marker]) {
          output.injectionDetected = true;
          output.detectedMarker = marker;
          break;
        }
      }

      // Test getUserMedia
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          output.errors.push('getUserMedia not available');
          return output;
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            width: { ideal: 1080 }, 
            height: { ideal: 1920 },
            facingMode: 'user' 
          },
          audio: true,
        });

        if (!stream) {
          output.errors.push('getUserMedia returned null');
          return output;
        }

        output.getUserMediaSuccess = true;
        output.streamTracks.video = stream.getVideoTracks().length;
        output.streamTracks.audio = stream.getAudioTracks().length;

        // Get video track details
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
          output.videoTrackLabel = videoTrack.label;
          output.videoTrackState = videoTrack.readyState;
          
          if (videoTrack.getSettings) {
            output.videoSettings = videoTrack.getSettings();
          }
          
          if (videoTrack.getCapabilities) {
            output.videoCapabilities = videoTrack.getCapabilities();
          }
        }

        // Test video playback
        const video = document.createElement('video');
        video.muted = true;
        video.playsInline = true;
        video.autoplay = true;
        (video as any).srcObject = stream;
        document.body.appendChild(video);

        // Wait for video to start playing
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            output.errors.push('Video play timeout');
            reject(new Error('timeout'));
          }, 5000);

          video.onloadeddata = () => {
            clearTimeout(timeout);
            output.canPlayVideo = true;
            resolve();
          };

          video.onerror = (e) => {
            clearTimeout(timeout);
            output.errors.push('Video error: ' + String(e));
            reject(e);
          };

          video.play().catch((e) => {
            clearTimeout(timeout);
            output.errors.push('Video.play() failed: ' + e.message);
            reject(e);
          });
        }).catch(() => {});

        // Test MediaRecorder
        if (typeof MediaRecorder !== 'undefined') {
          try {
            const chunks: BlobPart[] = [];
            const recorder = new MediaRecorder(stream);
            
            recorder.ondataavailable = (e) => {
              if (e.data && e.data.size > 0) {
                chunks.push(e.data);
              }
            };

            const recordPromise = new Promise<number>((resolve) => {
              recorder.onstop = () => {
                const blob = new Blob(chunks, { type: 'video/webm' });
                resolve(blob.size);
              };
            });

            recorder.start(250);
            await new Promise(r => setTimeout(r, 1000));
            recorder.stop();

            output.recordedDataSize = await recordPromise;
            output.recordingSuccess = output.recordedDataSize > 0;
          } catch (e: any) {
            output.errors.push('MediaRecorder failed: ' + e.message);
          }
        }

        // Cleanup
        stream.getTracks().forEach(t => t.stop());
        video.remove();

      } catch (e: any) {
        output.errors.push('getUserMedia exception: ' + (e.message || String(e)));
      }

      return output;
    });

    // Merge validation results
    result.details = {
      ...result.details,
      ...validation,
    };

    // Determine success
    result.success = 
      validation.injectionDetected &&
      validation.getUserMediaSuccess &&
      validation.streamTracks.video > 0 &&
      validation.canPlayVideo &&
      result.details.pageErrors.length === 0;

    await context.close();
  } catch (e: any) {
    result.details.errors.push(`Test exception: ${e.message || String(e)}`);
  } finally {
    await browser.close();
  }

  return result;
}

async function main() {
  console.log('========================================');
  console.log('COMPREHENSIVE PROTOCOL TEST');
  console.log('Target URL:', TARGET_URL);
  console.log('========================================\n');

  const testCases: Array<{
    name: string;
    id: string;
    createScript: () => string;
  }> = [
    // Protocol 1: Standard
    {
      name: 'Protocol 1: Standard (browserScripts)',
      id: 'standard',
      createScript: () => createMediaInjectionScript(devices, {
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

    // Protocol 2: Allowlist
    {
      name: 'Protocol 2: Allowlist (browserScripts)',
      id: 'allowlist',
      createScript: () => createMediaInjectionScript(devices, {
        protocolId: 'allowlist',
        stealthMode: true,
        forceSimulation: true,
        debugEnabled: true,
        permissionPromptEnabled: false,
        showOverlayLabel: false,
        loopVideo: true,
        mirrorVideo: false,
      }),
    },

    // Protocol 2: Advanced Relay
    {
      name: 'Protocol 2: Advanced Relay (Advanced Protocol 2)',
      id: 'advanced-protocol-2',
      createScript: () => createAdvancedProtocol2Script({
        devices: devices as any,
        videoUri: undefined,
        enableWebRTCRelay: true,
        enableASI: true,
        enableGPU: false,
        enableCrypto: false,
        debugEnabled: true,
        stealthMode: true,
        protocolLabel: 'Protocol 2: Advanced Relay',
        showOverlayLabel: false,
      }),
    },

    // Protocol 3: Protected
    {
      name: 'Protocol 3: Protected (browserScripts)',
      id: 'protected',
      createScript: () => createMediaInjectionScript(devices, {
        protocolId: 'protected',
        stealthMode: true,
        forceSimulation: true,
        debugEnabled: true,
        permissionPromptEnabled: false,
        showOverlayLabel: false,
        loopVideo: true,
        mirrorVideo: false,
      }),
    },

    // Protocol 4: Harness
    {
      name: 'Protocol 4: Harness (browserScripts)',
      id: 'harness',
      createScript: () => createMediaInjectionScript(devices, {
        protocolId: 'harness',
        stealthMode: true,
        forceSimulation: true,
        debugEnabled: true,
        permissionPromptEnabled: false,
        showOverlayLabel: false,
        loopVideo: true,
        mirrorVideo: false,
      }),
    },

    // Protocol 5: Holographic
    {
      name: 'Protocol 5: Holographic (browserScripts)',
      id: 'holographic',
      createScript: () => createMediaInjectionScript(devices, {
        protocolId: 'holographic',
        stealthMode: true,
        forceSimulation: true,
        debugEnabled: true,
        permissionPromptEnabled: false,
        showOverlayLabel: false,
        loopVideo: true,
        mirrorVideo: false,
      }),
    },

    // Protocol 5: Sonnet (AI-Powered)
    {
      name: 'Protocol 5: Sonnet (AI-Powered Adaptive)',
      id: 'sonnet',
      createScript: () => {
        const config: SonnetProtocolConfig = {
          enabled: true,
          aiAdaptiveQuality: true,
          behavioralMimicry: true,
          neuralStyleTransfer: false,
          predictiveFrameOptimization: true,
          quantumTimingRandomness: true,
          biometricSimulation: true,
          realTimeProfiler: true,
          adaptiveStealth: true,
          performanceTarget: 'balanced',
          stealthIntensity: 'maximum',
          learningMode: true,
        };
        return createSonnetProtocolScript(devices, config, undefined);
      },
    },

    // Working Injection (Baseline)
    {
      name: 'Working Injection (Baseline)',
      id: 'working-injection',
      createScript: () => createWorkingInjectionScript({
        videoUri: null,
        devices,
        stealthMode: true,
        debugEnabled: true,
        targetWidth: 1080,
        targetHeight: 1920,
        targetFPS: 30,
      }),
    },
  ];

  const results: TestResult[] = [];

  for (const testCase of testCases) {
    process.stdout.write(`Testing ${testCase.name}... `);
    
    const startTime = Date.now();
    const script = testCase.createScript();
    const result = await testProtocol(testCase.name, testCase.id, script);
    const duration = Date.now() - startTime;

    results.push(result);

    if (result.success) {
      console.log(`✅ PASS (${duration}ms)`);
    } else {
      console.log(`❌ FAIL (${duration}ms)`);
    }
  }

  // Print summary
  console.log('\n========================================');
  console.log('SUMMARY');
  console.log('========================================\n');

  const passed = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  console.log(`Total: ${results.length}`);
  console.log(`Passed: ${passed.length}`);
  console.log(`Failed: ${failed.length}`);
  console.log('');

  // Detailed results
  for (const result of results) {
    const status = result.success ? '✅ PASS' : '❌ FAIL';
    console.log(`${status}: ${result.protocolName}`);
    console.log(`  Injection Detected: ${result.details.injectionDetected ? '✓' : '✗'}`);
    console.log(`  getUserMedia: ${result.details.getUserMediaSuccess ? '✓' : '✗'}`);
    console.log(`  Video Playback: ${result.details.canPlayVideo ? '✓' : '✗'}`);
    console.log(`  Recording: ${result.details.recordingSuccess ? '✓' : '✗'}`);
    
    if (result.details.streamTracks) {
      console.log(`  Tracks: ${result.details.streamTracks.video}V / ${result.details.streamTracks.audio}A`);
    }
    
    if (result.details.recordedDataSize) {
      console.log(`  Recorded: ${result.details.recordedDataSize} bytes`);
    }

    if (result.details.errors.length > 0) {
      console.log(`  Errors:`);
      result.details.errors.forEach(e => console.log(`    - ${e}`));
    }

    if (result.details.pageErrors.length > 0) {
      console.log(`  Page Errors:`);
      result.details.pageErrors.forEach(e => console.log(`    - ${e}`));
    }

    console.log('');
  }

  // Exit with error if any failed
  if (failed.length > 0) {
    console.log('❌ Some protocols failed');
    process.exitCode = 1;
  } else {
    console.log('✅ All protocols passed!');
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exitCode = 1;
});
