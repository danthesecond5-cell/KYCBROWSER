import { chromium } from 'playwright';
import { createMediaInjectionScript } from '../constants/browserScripts';
import { createAdvancedProtocol2Script } from '../utils/advancedProtocol/browserScript';
import { createWebSocketInjectionScript } from '../utils/websocketBridge/injectionScript';

type ProtocolRun = {
  name: string;
  id: string;
  injectedBeforeLoad: string;
};

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

const TEST_URL = process.env.WEBCAMTESTS_URL || 'https://webcamtests.com/recorder';

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

async function runOnce(run: ProtocolRun) {
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-fake-ui-for-media-stream', '--no-sandbox', '--disable-dev-shm-usage'],
  });

  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: 390, height: 844 },
  });

  const page = await context.newPage();
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];

  page.on('pageerror', (err) => pageErrors.push(String(err)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  try {
    await page.addInitScript({ content: run.injectedBeforeLoad });
    await page.goto(TEST_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });

    // Deep API validation: ensure gUM succeeds and yields a live video track.
    const gum = await page.evaluate(async () => {
      const md = (navigator as any).mediaDevices;
      if (!md || typeof md.getUserMedia !== 'function') {
        return { ok: false, step: 'mediaDevices', error: 'navigator.mediaDevices.getUserMedia missing' };
      }

      const devices = typeof md.enumerateDevices === 'function' ? await md.enumerateDevices() : [];
      try {
        const stream = await md.getUserMedia({ video: true, audio: false });
        const tracks = stream.getTracks();
        const vt = stream.getVideoTracks()[0];
        return {
          ok: true,
          devicesCount: devices.length,
          tracks: tracks.map((t: any) => ({ kind: t.kind, readyState: t.readyState, label: t.label })),
          videoSettings: vt?.getSettings?.() ?? null,
          videoCapabilities: vt?.getCapabilities?.() ?? null,
        };
      } catch (e: any) {
        return { ok: false, step: 'getUserMedia', name: e?.name || 'Error', message: e?.message || String(e) };
      }
    });

    // Site flow validation: click "Start recording" and ensure a <video> element gets a MediaStream.
    await page.getByRole('button', { name: /start recording/i }).click({ timeout: 15_000 });
    await page.waitForTimeout(1500);

    const ui = await page.evaluate(() => {
      const videos = Array.from(document.querySelectorAll('video'));
      const videosWithStream = videos.filter((v) => (v as any).srcObject && (v as any).srcObject.getTracks);
      const tracks = videosWithStream.flatMap((v) => (v as any).srcObject.getTracks());
      const stopButtons = Array.from(document.querySelectorAll('button'))
        .filter((b) => (b.textContent || '').trim().toLowerCase() === 'stop recording');

      return {
        videosFound: videos.length,
        videosWithStream: videosWithStream.length,
        streamTracksInVideoElements: tracks.length,
        stopButtonsFound: stopButtons.length,
        stopDisabled: stopButtons.map((b) => (b as HTMLButtonElement).disabled),
      };
    });

    const IGNORED_PAGE_ERROR_SUBSTRINGS = [
      // Common headless-only noise from ad slots; not injection-related.
      'adsbygoogle.push() error: No slot size',
    ];

    const relevantPageErrors = pageErrors.filter(
      (e) => !IGNORED_PAGE_ERROR_SUBSTRINGS.some((needle) => e.includes(needle))
    );

    return {
      ok: gum.ok && ui.videosWithStream > 0 && ui.streamTracksInVideoElements > 0 && relevantPageErrors.length === 0,
      gum,
      ui,
      pageErrors: relevantPageErrors,
      consoleErrors,
    };
  } finally {
    await page.close().catch(() => {});
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

async function main() {
  const protocolRuns: ProtocolRun[] = [
    {
      name: 'Protocol 1: standard',
      id: 'standard',
      injectedBeforeLoad: createMediaInjectionScript(DEVICES as any, {
        protocolId: 'standard',
        protocolLabel: 'standard',
        stealthMode: true,
        forceSimulation: true,
        debugEnabled: false,
        permissionPromptEnabled: false,
        showOverlayLabel: false,
        loopVideo: true,
        mirrorVideo: false,
      }),
    },
    {
      name: 'Protocol 2: allowlist (createMediaInjectionScript path)',
      id: 'allowlist',
      injectedBeforeLoad: createMediaInjectionScript(DEVICES as any, {
        protocolId: 'allowlist',
        protocolLabel: 'allowlist',
        stealthMode: true,
        forceSimulation: true,
        debugEnabled: false,
        permissionPromptEnabled: false,
        showOverlayLabel: false,
        loopVideo: true,
        mirrorVideo: false,
      }),
    },
    {
      name: 'Protocol 3: protected',
      id: 'protected',
      injectedBeforeLoad: createMediaInjectionScript(DEVICES as any, {
        protocolId: 'protected',
        protocolLabel: 'protected',
        stealthMode: true,
        forceSimulation: true,
        debugEnabled: false,
        permissionPromptEnabled: false,
        showOverlayLabel: false,
        loopVideo: true,
        mirrorVideo: false,
      }),
    },
    {
      name: 'Protocol 4: harness',
      id: 'harness',
      injectedBeforeLoad: createMediaInjectionScript(DEVICES as any, {
        protocolId: 'harness',
        protocolLabel: 'harness',
        stealthMode: true,
        forceSimulation: true,
        debugEnabled: false,
        permissionPromptEnabled: false,
        showOverlayLabel: false,
        loopVideo: true,
        mirrorVideo: false,
      }),
    },
    {
      name: 'Protocol 5: holographic',
      id: 'holographic',
      injectedBeforeLoad: createMediaInjectionScript(DEVICES as any, {
        protocolId: 'holographic',
        protocolLabel: 'holographic',
        stealthMode: true,
        forceSimulation: true,
        debugEnabled: false,
        permissionPromptEnabled: false,
        showOverlayLabel: false,
        loopVideo: true,
        mirrorVideo: false,
      }),
    },
    {
      name: 'Protocol 2: Advanced Relay (createAdvancedProtocol2Script path)',
      id: 'allowlist-advanced-relay',
      injectedBeforeLoad: createAdvancedProtocol2Script({
        devices: DEVICES as any,
        videoUri: undefined,
        enableWebRTCRelay: true,
        enableASI: true,
        enableGPU: false,
        enableCrypto: false,
        debugEnabled: false,
        stealthMode: true,
        protocolLabel: 'Protocol 2: Advanced Relay',
        showOverlayLabel: false,
      }),
    },
    {
      name: 'Protocol 6: WebSocket Bridge',
      id: 'websocket-bridge',
      injectedBeforeLoad: createWebSocketInjectionScript({
        width: 1080,
        height: 1920,
        fps: 30,
        devices: DEVICES as any,
        debug: false,
        stealthMode: true,
        protocolLabel: 'Protocol 6: WebSocket Bridge',
        showOverlay: false,
      }),
    },
  ];

  console.log(`[webcamtests] URL: ${TEST_URL}`);
  const results: Array<{ name: string; ok: boolean; details: any }> = [];

  for (const run of protocolRuns) {
    process.stdout.write(`[webcamtests] Running ${run.name}... `);
    const res = await runOnce(run);
    results.push({ name: run.name, ok: res.ok, details: res });
    console.log(res.ok ? 'OK' : 'FAIL');
    if (!res.ok) {
      console.log(JSON.stringify({ gum: res.gum, ui: res.ui, pageErrors: res.pageErrors, consoleErrors: res.consoleErrors }, null, 2));
    }
  }

  const failed = results.filter((r) => !r.ok);
  console.log('\n[webcamtests] Summary:');
  for (const r of results) {
    console.log(`- ${r.ok ? 'PASS' : 'FAIL'}: ${r.name}`);
  }

  if (failed.length) {
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error('[webcamtests] Harness crashed:', e);
  process.exit(1);
});

