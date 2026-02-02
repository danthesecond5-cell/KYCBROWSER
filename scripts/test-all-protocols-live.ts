/**
 * Comprehensive Live Protocol Testing Script
 * Tests all protocols against webcamtests.com/recorder
 * 
 * Usage: npx tsx scripts/test-all-protocols-live.ts
 */

import { chromium, type Browser, type Page } from 'playwright';
import { createMediaInjectionScript } from '@/constants/browserScripts';
import { createProtocol0DeepHook, createProtocol1MediaStreamOverride, createProtocol2DescriptorHook, createProtocol3ProxyIntercept } from '@/utils/deepInjectionProtocols';
import type { CaptureDevice } from '@/types/device';
import type { ProtocolId } from '@/types/protocols';

const TEST_URL = 'https://webcamtests.com/recorder';
const TEST_TIMEOUT = 60000; // 60 seconds per test

interface TestResult {
  protocol: string;
  protocolId: ProtocolId | string;
  success: boolean;
  error?: string;
  details?: {
    streamCreated?: boolean;
    videoTracks?: number;
    audioTracks?: number;
    resolution?: { width: number; height: number };
    mediaRecorderWorks?: boolean;
    recordedSize?: number;
  };
  logs: string[];
  errors: string[];
}

const results: TestResult[] = [];

function log(message: string) {
  console.log(`[TestRunner] ${message}`);
}

function buildTestDevices(): CaptureDevice[] {
  return [
    {
      id: 'cam_front_1',
      nativeDeviceId: 'test-camera-001',
      name: 'Test Front Camera',
      type: 'camera',
      facing: 'front',
      groupId: 'test-group-1',
      simulationEnabled: true,
      assignedVideoUri: null,
      assignedVideoName: 'Green Screen',
      capabilities: {
        videoResolutions: [{ width: 1080, height: 1920, fps: 30 }],
      },
    } as unknown as CaptureDevice,
  ];
}

async function testProtocol(
  browser: Browser,
  protocolName: string,
  protocolId: ProtocolId | string,
  injectionScript: string
): Promise<TestResult> {
  log(`\n${'='.repeat(60)}`);
  log(`Testing ${protocolName} (${protocolId})`);
  log('='.repeat(60));

  const result: TestResult = {
    protocol: protocolName,
    protocolId,
    success: false,
    logs: [],
    errors: [],
    details: {},
  };

  let context;
  let page: Page | undefined;

  try {
    context = await browser.newContext({
      permissions: ['camera', 'microphone'],
    });

    page = await context.newPage();

    // Capture console logs and errors
    page.on('console', (msg) => {
      const text = msg.text();
      result.logs.push(text);
      if (msg.type() === 'error') {
        result.errors.push(text);
      }
    });

    page.on('pageerror', (error) => {
      result.errors.push(`Page error: ${error.message}`);
    });

    // Inject the protocol script BEFORE navigation
    await page.addInitScript(injectionScript);

    log('Navigating to webcamtests.com/recorder...');
    await page.goto(TEST_URL, { 
      waitUntil: 'domcontentloaded',
      timeout: TEST_TIMEOUT 
    });

    // Wait a bit for page to settle
    await page.waitForTimeout(1000);

    log('Testing getUserMedia...');

    // Test the protocol by calling getUserMedia
    const testResult = await page.evaluate(async () => {
      try {
        // Check if our injection is active
        const injectionStatus: any = {
          workingInjection: !!(window as any).__workingInjectionActive,
          protocol0: !!(window as any).__protocol0Initialized,
          protocol1: !!(window as any).__protocol1Initialized,
          protocol2: !!(window as any).__protocol2Initialized,
          protocol3: !!(window as any).__protocol3Initialized,
          advancedProtocol2: !!(window as any).__advancedProtocol2Initialized,
        };

        // Try getUserMedia
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        });

        if (!stream) {
          throw new Error('No stream returned');
        }

        const videoTracks = stream.getVideoTracks();
        const audioTracks = stream.getAudioTracks();

        if (videoTracks.length === 0) {
          throw new Error('No video tracks in stream');
        }

        const videoTrack = videoTracks[0];
        const settings = videoTrack.getSettings();

        // Test MediaRecorder
        let recordedSize = 0;
        let mediaRecorderWorks = false;

        try {
          const chunks: Blob[] = [];
          const recorder = new MediaRecorder(stream);
          
          await new Promise<void>((resolve, reject) => {
            recorder.ondataavailable = (e) => {
              if (e.data && e.data.size > 0) {
                chunks.push(e.data);
              }
            };

            recorder.onerror = (e: any) => {
              reject(new Error(`MediaRecorder error: ${e.error?.message || 'Unknown'}`));
            };

            recorder.onstop = () => {
              const blob = new Blob(chunks, { type: recorder.mimeType || 'video/webm' });
              recordedSize = blob.size;
              mediaRecorderWorks = recordedSize > 1024; // At least 1KB
              resolve();
            };

            recorder.start();
            
            // Record for 1 second
            setTimeout(() => {
              try {
                recorder.stop();
              } catch (e) {
                reject(e);
              }
            }, 1000);
          });
        } catch (e: any) {
          console.error('MediaRecorder test failed:', e.message);
        }

        // Clean up
        stream.getTracks().forEach(t => t.stop());

        return {
          success: true,
          streamCreated: true,
          videoTracks: videoTracks.length,
          audioTracks: audioTracks.length,
          resolution: {
            width: settings.width || 0,
            height: settings.height || 0
          },
          frameRate: settings.frameRate,
          deviceId: settings.deviceId,
          facingMode: settings.facingMode,
          label: videoTrack.label,
          mediaRecorderWorks,
          recordedSize,
          injectionStatus
        };

      } catch (error: any) {
        return {
          success: false,
          error: error.message || String(error),
          injectionStatus: {
            workingInjection: !!(window as any).__workingInjectionActive,
            protocol0: !!(window as any).__protocol0Initialized,
            protocol1: !!(window as any).__protocol1Initialized,
            protocol2: !!(window as any).__protocol2Initialized,
            protocol3: !!(window as any).__protocol3Initialized,
            advancedProtocol2: !!(window as any).__advancedProtocol2Initialized,
          }
        };
      }
    });

    if (testResult.success) {
      result.success = true;
      result.details = {
        streamCreated: testResult.streamCreated,
        videoTracks: testResult.videoTracks,
        audioTracks: testResult.audioTracks,
        resolution: testResult.resolution,
        mediaRecorderWorks: testResult.mediaRecorderWorks,
        recordedSize: testResult.recordedSize,
      };

      log(`✅ SUCCESS`);
      log(`   Stream: ${testResult.streamCreated ? 'Created' : 'Failed'}`);
      log(`   Video tracks: ${testResult.videoTracks}`);
      log(`   Audio tracks: ${testResult.audioTracks}`);
      log(`   Resolution: ${testResult.resolution.width}x${testResult.resolution.height}`);
      log(`   Frame rate: ${testResult.frameRate || 'unknown'}`);
      log(`   Device ID: ${testResult.deviceId || 'unknown'}`);
      log(`   Facing mode: ${testResult.facingMode || 'unknown'}`);
      log(`   Label: ${testResult.label || 'unknown'}`);
      log(`   MediaRecorder: ${testResult.mediaRecorderWorks ? 'WORKS' : 'FAILED'}`);
      log(`   Recorded size: ${testResult.recordedSize} bytes`);
      log(`   Injection status:`, JSON.stringify(testResult.injectionStatus, null, 2));
    } else {
      result.success = false;
      result.error = testResult.error;
      log(`❌ FAILED: ${testResult.error}`);
      log(`   Injection status:`, JSON.stringify(testResult.injectionStatus, null, 2));
    }

  } catch (error: any) {
    result.success = false;
    result.error = error.message || String(error);
    log(`❌ EXCEPTION: ${result.error}`);
  } finally {
    if (page) {
      await page.close().catch(() => {});
    }
    if (context) {
      await context.close().catch(() => {});
    }
  }

  return result;
}

async function main() {
  console.log('\n');
  log('╔════════════════════════════════════════════════════════╗');
  log('║  COMPREHENSIVE PROTOCOL TESTING                        ║');
  log('║  Target: webcamtests.com/recorder                      ║');
  log('╚════════════════════════════════════════════════════════╝');
  console.log('\n');

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      '--autoplay-policy=no-user-gesture-required',
      '--no-sandbox',
      '--disable-setuid-sandbox',
    ],
  });

  const devices = buildTestDevices();

  try {
    // ========================================================================
    // TEST 1: Standard Protocol (Protocol 1)
    // ========================================================================
    const standardScript = createMediaInjectionScript(devices, {
      protocolId: 'standard',
      stealthMode: true,
      forceSimulation: true,
      permissionPromptEnabled: false,
      debugEnabled: true,
      showOverlayLabel: true,
      loopVideo: true,
      mirrorVideo: false,
    });

    results.push(await testProtocol(
      browser,
      'Protocol 1: Standard Injection',
      'standard',
      standardScript
    ));

    // ========================================================================
    // TEST 2: Advanced Relay Protocol (Protocol 2)
    // ========================================================================
    const advancedRelayScript = createMediaInjectionScript(devices, {
      protocolId: 'allowlist',
      stealthMode: true,
      forceSimulation: true,
      permissionPromptEnabled: false,
      debugEnabled: true,
      showOverlayLabel: true,
      loopVideo: true,
      mirrorVideo: false,
    });

    results.push(await testProtocol(
      browser,
      'Protocol 2: Advanced Relay',
      'allowlist',
      advancedRelayScript
    ));

    // ========================================================================
    // TEST 3: Protected Preview Protocol (Protocol 3)
    // ========================================================================
    const protectedScript = createMediaInjectionScript(devices, {
      protocolId: 'protected',
      stealthMode: true,
      forceSimulation: true,
      permissionPromptEnabled: false,
      debugEnabled: true,
      showOverlayLabel: true,
      loopVideo: true,
      mirrorVideo: false,
    });

    results.push(await testProtocol(
      browser,
      'Protocol 3: Protected Preview',
      'protected',
      protectedScript
    ));

    // ========================================================================
    // TEST 4: Test Harness Protocol (Protocol 4)
    // ========================================================================
    const harnessScript = createMediaInjectionScript(devices, {
      protocolId: 'harness',
      stealthMode: true,
      forceSimulation: true,
      permissionPromptEnabled: false,
      debugEnabled: true,
      showOverlayLabel: true,
      loopVideo: true,
      mirrorVideo: false,
    });

    results.push(await testProtocol(
      browser,
      'Protocol 4: Test Harness',
      'harness',
      harnessScript
    ));

    // ========================================================================
    // TEST 5: Holographic Protocol (Protocol 5)
    // ========================================================================
    const holographicScript = createMediaInjectionScript(devices, {
      protocolId: 'holographic',
      stealthMode: true,
      forceSimulation: true,
      permissionPromptEnabled: false,
      debugEnabled: true,
      showOverlayLabel: true,
      loopVideo: true,
      mirrorVideo: false,
    });

    results.push(await testProtocol(
      browser,
      'Protocol 5: Holographic Stream Injection',
      'holographic',
      holographicScript
    ));

    // ========================================================================
    // TEST 6: Deep Injection Protocol 0
    // ========================================================================
    const protocol0Script = createProtocol0DeepHook({
      videoUri: undefined,
      width: 1080,
      height: 1920,
      fps: 30,
      deviceLabel: 'Test Camera',
      deviceId: 'deep-inject-0',
      showDebugOverlay: true,
      useTestPattern: true,
    });

    results.push(await testProtocol(
      browser,
      'Deep Protocol 0: Ultra-Early Hook',
      'protocol0',
      protocol0Script
    ));

    // ========================================================================
    // TEST 7: Deep Injection Protocol 1
    // ========================================================================
    const protocol1Script = createProtocol1MediaStreamOverride({
      videoUri: undefined,
      width: 1080,
      height: 1920,
      fps: 30,
      deviceLabel: 'Test Camera',
      deviceId: 'deep-inject-1',
      showDebugOverlay: true,
      useTestPattern: true,
    });

    results.push(await testProtocol(
      browser,
      'Deep Protocol 1: MediaStream Override',
      'protocol1',
      protocol1Script
    ));

    // ========================================================================
    // TEST 8: Deep Injection Protocol 2
    // ========================================================================
    const protocol2Script = createProtocol2DescriptorHook({
      videoUri: undefined,
      width: 1080,
      height: 1920,
      fps: 30,
      deviceLabel: 'Test Camera',
      deviceId: 'deep-inject-2',
      showDebugOverlay: true,
      useTestPattern: true,
    });

    results.push(await testProtocol(
      browser,
      'Deep Protocol 2: Descriptor Hook',
      'protocol2',
      protocol2Script
    ));

    // ========================================================================
    // TEST 9: Deep Injection Protocol 3
    // ========================================================================
    const protocol3Script = createProtocol3ProxyIntercept({
      videoUri: undefined,
      width: 1080,
      height: 1920,
      fps: 30,
      deviceLabel: 'Test Camera',
      deviceId: 'deep-inject-3',
      showDebugOverlay: true,
      useTestPattern: true,
    });

    results.push(await testProtocol(
      browser,
      'Deep Protocol 3: Proxy Intercept',
      'protocol3',
      protocol3Script
    ));

  } finally {
    await browser.close();
  }

  // ========================================================================
  // PRINT RESULTS
  // ========================================================================
  console.log('\n');
  log('╔════════════════════════════════════════════════════════╗');
  log('║  TEST RESULTS SUMMARY                                  ║');
  log('╚════════════════════════════════════════════════════════╝');
  console.log('\n');

  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  results.forEach((result, index) => {
    const status = result.success ? '✅ PASSED' : '❌ FAILED';
    const icon = result.success ? '✓' : '✗';
    
    console.log(`${index + 1}. ${icon} ${result.protocol}`);
    console.log(`   Protocol ID: ${result.protocolId}`);
    console.log(`   Status: ${status}`);
    
    if (result.success) {
      console.log(`   Stream: ✓ Created`);
      console.log(`   Video tracks: ${result.details?.videoTracks || 0}`);
      console.log(`   Audio tracks: ${result.details?.audioTracks || 0}`);
      console.log(`   Resolution: ${result.details?.resolution?.width}x${result.details?.resolution?.height}`);
      console.log(`   MediaRecorder: ${result.details?.mediaRecorderWorks ? '✓ Works' : '✗ Failed'}`);
      console.log(`   Recorded: ${result.details?.recordedSize || 0} bytes`);
    } else {
      console.log(`   Error: ${result.error || 'Unknown error'}`);
      if (result.errors.length > 0) {
        console.log(`   Console errors: ${result.errors.length}`);
        result.errors.slice(0, 3).forEach(err => {
          console.log(`     - ${err.substring(0, 80)}`);
        });
      }
    }
    console.log('');
  });

  console.log('─'.repeat(60));
  console.log(`Total tests: ${results.length}`);
  console.log(`Passed: ${passed} (${Math.round(passed / results.length * 100)}%)`);
  console.log(`Failed: ${failed} (${Math.round(failed / results.length * 100)}%)`);
  console.log('─'.repeat(60));

  // ========================================================================
  // SAVE DETAILED REPORT
  // ========================================================================
  const fs = await import('fs');
  const path = await import('path');

  const reportPath = path.join(__dirname, '../test-results-webcamtests.json');
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  
  log(`\nDetailed results saved to: ${reportPath}`);

  // Generate markdown report
  const mdReport = generateMarkdownReport(results);
  const mdPath = path.join(__dirname, '../WEBCAMTESTS_PROTOCOL_REPORT.md');
  fs.writeFileSync(mdPath, mdReport);
  
  log(`Markdown report saved to: ${mdPath}`);

  // Exit with appropriate code
  process.exit(failed > 0 ? 1 : 0);
}

function generateMarkdownReport(results: TestResult[]): string {
  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const successRate = Math.round(passed / results.length * 100);

  let md = `# Protocol Testing Report: webcamtests.com/recorder\n\n`;
  md += `**Test Date:** ${new Date().toISOString()}\n`;
  md += `**Target URL:** https://webcamtests.com/recorder\n`;
  md += `**Total Protocols Tested:** ${results.length}\n\n`;

  md += `## Summary\n\n`;
  md += `- ✅ **Passed:** ${passed} (${Math.round(passed / results.length * 100)}%)\n`;
  md += `- ❌ **Failed:** ${failed} (${Math.round(failed / results.length * 100)}%)\n`;
  md += `- 📊 **Success Rate:** ${successRate}%\n\n`;

  md += `## Detailed Results\n\n`;

  results.forEach((result, index) => {
    const status = result.success ? '✅ PASSED' : '❌ FAILED';
    
    md += `### ${index + 1}. ${result.protocol}\n\n`;
    md += `**Protocol ID:** \`${result.protocolId}\`\n`;
    md += `**Status:** ${status}\n\n`;
    
    if (result.success) {
      md += `**Details:**\n`;
      md += `- Stream created: ✓\n`;
      md += `- Video tracks: ${result.details?.videoTracks || 0}\n`;
      md += `- Audio tracks: ${result.details?.audioTracks || 0}\n`;
      md += `- Resolution: ${result.details?.resolution?.width}x${result.details?.resolution?.height}\n`;
      md += `- MediaRecorder: ${result.details?.mediaRecorderWorks ? '✓ Works' : '✗ Failed'}\n`;
      md += `- Recorded size: ${result.details?.recordedSize || 0} bytes\n`;
    } else {
      md += `**Error:** ${result.error || 'Unknown error'}\n\n`;
      
      if (result.errors.length > 0) {
        md += `**Console Errors:**\n`;
        md += `\`\`\`\n`;
        result.errors.slice(0, 5).forEach(err => {
          md += `${err}\n`;
        });
        md += `\`\`\`\n`;
      }
    }
    
    md += `\n---\n\n`;
  });

  md += `## Analysis\n\n`;
  
  if (failed > 0) {
    md += `### Failed Protocols\n\n`;
    results.filter(r => !r.success).forEach(result => {
      md += `- **${result.protocol}**: ${result.error}\n`;
    });
    md += `\n`;
  }

  if (passed > 0) {
    md += `### Working Protocols\n\n`;
    results.filter(r => r.success).forEach(result => {
      md += `- **${result.protocol}**: Successfully created stream and ${result.details?.mediaRecorderWorks ? 'recorded video' : 'failed to record'}\n`;
    });
    md += `\n`;
  }

  md += `## Recommendations\n\n`;
  md += `Based on the test results:\n\n`;
  
  if (passed === results.length) {
    md += `✅ All protocols are working! No changes needed.\n`;
  } else if (passed > 0) {
    md += `✅ ${passed} protocol(s) working successfully. Use these for webcamtests.com\n`;
    md += `❌ ${failed} protocol(s) need fixes or may not be compatible with this site\n`;
  } else {
    md += `❌ No protocols are currently working with webcamtests.com/recorder\n`;
    md += `\nPossible reasons:\n`;
    md += `1. Site-specific detection mechanisms\n`;
    md += `2. Injection timing issues\n`;
    md += `3. Browser security policies\n`;
    md += `4. MediaRecorder API compatibility\n`;
  }

  return md;
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
