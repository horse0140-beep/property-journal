/**
 * Rebuild Property Journal icon + splash from the approved splash master.
 * Does NOT remapping white pixels (that caused paint-splatter corruption).
 * Does NOT upscale the mark — only pads or downscales.
 *
 * Usage: node scripts/fix-branding-assets.js [path-to-master-splash]
 */
const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

const root = path.join(__dirname, "..");
const DEFAULT_MASTER = path.join(root, "assets", "_master_splash_ec93.png");
const OUT_ICON = path.join(root, "assets", "icon.png");
const OUT_ADAPTIVE = path.join(root, "assets", "adaptive-icon.png");
const OUT_SPLASH = path.join(root, "assets", "property-journal-splash.png");
const OUT_SPLASH_LEGACY = path.join(root, "assets", "splash.png");
const OUT_SPLASH_ICON = path.join(root, "assets", "splash-icon.png");
const BG = "#0F2460";

async function extractMarkBounds(masterBuf, W, H, padRatio = 0.1) {
  const { data, info } = await sharp(masterBuf)
    .raw()
    .ensureAlpha()
    .toBuffer({ resolveWithObject: true });
  const ch = info.channels;
  const y0 = Math.round(H * 0.08);
  const y1 = Math.round(H * 0.34);
  let minX = W;
  let minY = H;
  let maxX = 0;
  let maxY = 0;

  for (let y = y0; y < y1; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * ch;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const whiteish = max > 195 && max - min < 55 && r > 180 && g > 180;
      const gold = r > 170 && g > 130 && b < 130 && r > b;
      const accentBlue = b > 160 && r < 140 && g < 180 && b - r > 40;
      if (whiteish || gold || accentBlue) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  const pad = Math.round((maxX - minX) * padRatio);
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(W - 1, maxX + pad);
  maxY = Math.min(H - 1, maxY + pad);
  const side = Math.max(maxX - minX + 1, maxY - minY + 1);
  const cx = ((minX + maxX) / 2) | 0;
  const cy = ((minY + maxY) / 2) | 0;
  let left = cx - Math.floor(side / 2);
  let top = cy - Math.floor(side / 2);
  left = Math.max(0, Math.min(left, W - side));
  top = Math.max(0, Math.min(top, H - side));
  return { left, top, side };
}

async function main() {
  const masterPath = process.argv[2]
    ? path.resolve(process.argv[2])
    : DEFAULT_MASTER;
  if (!fs.existsSync(masterPath)) {
    throw new Error(`Master splash not found: ${masterPath}`);
  }

  const masterBuf = await fs.promises.readFile(masterPath);
  const meta = await sharp(masterBuf).metadata();
  const W = meta.width;
  const H = meta.height;
  console.log("master", masterPath, W, H);

  const markLoose = await extractMarkBounds(masterBuf, W, H, 0.1);
  const markTight = await extractMarkBounds(masterBuf, W, H, 0.04);
  console.log("mark icon", markLoose, "mark splash", markTight);

  async function writePaddedIcon(bounds, dest) {
    const mark = await sharp(masterBuf)
      .extract({
        left: bounds.left,
        top: bounds.top,
        width: bounds.side,
        height: bounds.side,
      })
      .png({ compressionLevel: 6 })
      .toBuffer();

    const ICON = 1024;
    let logo = mark;
    if (bounds.side > ICON) {
      logo = await sharp(mark)
        .resize(ICON, ICON, { fit: "inside", kernel: sharp.kernel.lanczos3 })
        .png({ compressionLevel: 6 })
        .toBuffer();
    }

    await sharp({
      create: { width: ICON, height: ICON, channels: 3, background: BG },
    })
      .composite([{ input: logo, gravity: "centre" }])
      .png({ compressionLevel: 6 })
      .toFile(dest);
  }

  await writePaddedIcon(markLoose, OUT_ICON);
  await fs.promises.copyFile(OUT_ICON, OUT_ADAPTIVE);
  await writePaddedIcon(markTight, OUT_SPLASH_ICON);

  // Keep full marketing splash for iOS (master already fills canvas)
  await fs.promises.copyFile(masterPath, OUT_SPLASH);
  await fs.promises.copyFile(OUT_SPLASH, OUT_SPLASH_LEGACY);

  console.log(
    JSON.stringify(
      {
        icon: { bytes: fs.statSync(OUT_ICON).size, markSide: markLoose.side },
        splash: { bytes: fs.statSync(OUT_SPLASH).size },
        splashIcon: { bytes: fs.statSync(OUT_SPLASH_ICON).size, markSide: markTight.side },
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
