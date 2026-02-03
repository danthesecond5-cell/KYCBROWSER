import fs from 'node:fs';
import path from 'node:path';

type Y4mSpec = {
  width: number;
  height: number;
  fps: number;
  seconds: number;
};

/**
 * Generate a small synthetic Y4M clip (I420) for Chromium fake video capture.
 * No ffmpeg required.
 */
export function ensureSyntheticY4m(spec: Y4mSpec): string {
  const { width, height, fps, seconds } = spec;
  const frames = Math.max(1, Math.floor(fps * seconds));
  const filename = `synthetic_${width}x${height}_${fps}fps_${seconds}s.y4m`;
  const outPath = path.join(process.cwd(), '.cache');
  const fullPath = path.join(outPath, filename);

  fs.mkdirSync(outPath, { recursive: true });
  if (fs.existsSync(fullPath)) return fullPath;

  const header = `YUV4MPEG2 W${width} H${height} F${fps}:1 Ip A1:1 C420\n`;
  const frameHeader = `FRAME\n`;

  const ySize = width * height;
  const uvWidth = Math.floor(width / 2);
  const uvHeight = Math.floor(height / 2);
  const uvSize = uvWidth * uvHeight;

  const fd = fs.openSync(fullPath, 'w');
  try {
    fs.writeSync(fd, header);

    const y = Buffer.allocUnsafe(ySize);
    const u = Buffer.allocUnsafe(uvSize);
    const v = Buffer.allocUnsafe(uvSize);

    for (let f = 0; f < frames; f++) {
      // Moving gradient + timestamp-ish bars.
      const t = f / fps;
      const barX = Math.floor(((Math.sin(t * 1.3) + 1) / 2) * (width - 1));
      const barY = Math.floor(((Math.cos(t * 0.9) + 1) / 2) * (height - 1));

      for (let yy = 0; yy < height; yy++) {
        for (let xx = 0; xx < width; xx++) {
          const idx = yy * width + xx;
          let val = 90; // mid gray
          // Green-ish background in YUV space (approx).
          val += Math.floor((xx / width) * 40);
          val += Math.floor((yy / height) * 20);
          if (Math.abs(xx - barX) < 3 || Math.abs(yy - barY) < 3) val = 235; // bright crosshair
          y[idx] = val;
        }
      }

      // Constant chroma (green tint-ish)
      u.fill(80);
      v.fill(80);

      fs.writeSync(fd, frameHeader);
      fs.writeSync(fd, y);
      fs.writeSync(fd, u);
      fs.writeSync(fd, v);
    }
  } finally {
    fs.closeSync(fd);
  }

  return fullPath;
}

