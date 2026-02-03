import { chromium } from 'playwright';
import { ensureSyntheticY4m } from './y4m';

async function main() {
  const url = process.env.TARGET_URL || 'https://webcamtests.com/recorder';
  const fakeVideoPath = ensureSyntheticY4m({ width: 640, height: 480, fps: 30, seconds: 3 });

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--autoplay-policy=no-user-gesture-required',
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      `--use-file-for-fake-video-capture=${fakeVideoPath}`,
    ],
  });

  try {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.grantPermissions(['camera', 'microphone']);
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });

    const result = await page.evaluate(async () => {
      const out: any = { gumOk: false, mediaRecorderOk: false, bytes: 0 };
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      out.gumOk = !!stream && stream.getVideoTracks().length > 0;
      const chunks: BlobPart[] = [];
      const rec = new MediaRecorder(stream);
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };
      const done = new Promise<void>((resolve) => (rec.onstop = () => resolve()));
      rec.start(250);
      await new Promise((r) => setTimeout(r, 750));
      rec.stop();
      await done;
      const blob = new Blob(chunks);
      out.bytes = blob.size;
      out.mediaRecorderOk = blob.size > 0;
      stream.getTracks().forEach((t) => t.stop());
      return out;
    });

    // eslint-disable-next-line no-console
    console.log('[selftest]', { url, ...result });
    process.exitCode = result.mediaRecorderOk ? 0 : 1;
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('[selftest] failed', e);
  process.exit(1);
});

