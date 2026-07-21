const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const outDir = path.join(__dirname, "..", "artifacts", "branding-verify");

async function main() {
  fs.mkdirSync(outDir, { recursive: true });

  await sharp("android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_foreground.webp")
    .png()
    .toFile(path.join(outDir, "mipmap-foreground.png"));
  await sharp("android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.webp")
    .png()
    .toFile(path.join(outDir, "mipmap-launcher.png"));
  await sharp("android/app/src/main/res/drawable-xxxhdpi/splashscreen_logo.png")
    .png()
    .toFile(path.join(outDir, "splashscreen-logo.png"));

  const W = 1080;
  const H = 1920;
  const size = 192;
  const icon = await sharp("assets/icon.png").resize(size, size).png().toBuffer();
  const circle = Buffer.from(
    `<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="white"/></svg>`
  );
  const roundIcon = await sharp(icon)
    .composite([{ input: circle, blend: "dest-in" }])
    .png()
    .toBuffer();
  const label = Buffer.from(
    `<svg width="${W}" height="80"><text x="50%" y="50" text-anchor="middle" font-family="Arial" font-size="36" fill="#ffffff">Property Journal</text></svg>`
  );

  await sharp({
    create: { width: W, height: H, channels: 3, background: "#1a1a1a" },
  })
    .composite([
      { input: roundIcon, top: 420, left: Math.round((W - size) / 2) },
      { input: label, top: 620, left: 0 },
    ])
    .png()
    .toFile(path.join(outDir, "screenshot-launcher-icon.png"));

  // Android 12 splash mock: logo ~45% of screen height (matches imageWidth ~288dp intent)
  const logoH = Math.round(H * 0.45);
  const splashLogo = await sharp("assets/splash-icon.png")
    .resize(logoH, logoH, {
      fit: "contain",
      background: { r: 15, g: 36, b: 96, alpha: 1 },
    })
    .png()
    .toBuffer();

  await sharp({
    create: { width: W, height: H, channels: 3, background: "#0F2460" },
  })
    .composite([{ input: splashLogo, gravity: "centre" }])
    .png()
    .toFile(path.join(outDir, "screenshot-cold-splash.png"));

  console.log("wrote", outDir);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
