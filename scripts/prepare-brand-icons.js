const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

const root = path.join(__dirname, "..");
const SRC = path.join(root, "assets", "icon.png");
const OUT_ICON = path.join(root, "assets", "icon.png");
const OUT_ADAPTIVE = path.join(root, "assets", "adaptive-icon.png");
const BG = { r: 15, g: 36, b: 96 }; // #0F2460 deep navy matching splash/app

async function main() {
  const meta = await sharp(SRC).metadata();
  console.log("source", meta.width, meta.height);

  // Fill near-white / transparent corners with brand blue, then output 1024²
  const { data, info } = await sharp(SRC)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const w = info.width;
  const h = info.height;
  const ch = info.channels;
  const out = Buffer.from(data);

  for (let i = 0; i < out.length; i += ch) {
    const r = out[i];
    const g = out[i + 1];
    const b = out[i + 2];
    const a = ch > 3 ? out[i + 3] : 255;
    const nearWhite = r > 240 && g > 240 && b > 240;
    const nearTransparent = a < 20;
    if (nearWhite || nearTransparent) {
      out[i] = BG.r;
      out[i + 1] = BG.g;
      out[i + 2] = BG.b;
      if (ch > 3) out[i + 3] = 255;
    }
  }

  const filled = await sharp(out, { raw: { width: w, height: h, channels: ch } })
    .png()
    .toBuffer();

  // 1024×1024 store icon — full bleed blue
  await sharp(filled)
    .resize(1024, 1024, { fit: "cover", position: "centre" })
    .png()
    .toFile(OUT_ICON);

  // Adaptive foreground: same full-bleed artwork (safe-zone already centered)
  await sharp(filled)
    .resize(1024, 1024, { fit: "cover", position: "centre" })
    .png()
    .toFile(OUT_ADAPTIVE);

  // Ensure splash points at dedicated asset; regenerate contain-friendly
  // version from approved splash if needed (keep existing property-journal-splash.png)
  const splashMeta = await sharp(path.join(root, "assets", "property-journal-splash.png")).metadata();

  const iconMeta = await sharp(OUT_ICON).metadata();
  console.log(
    JSON.stringify(
      {
        icon: { width: iconMeta.width, height: iconMeta.height, bytes: fs.statSync(OUT_ICON).size },
        adaptive: {
          width: (await sharp(OUT_ADAPTIVE).metadata()).width,
          height: (await sharp(OUT_ADAPTIVE).metadata()).height,
          bytes: fs.statSync(OUT_ADAPTIVE).size,
        },
        splash: { width: splashMeta.width, height: splashMeta.height },
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
