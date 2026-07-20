const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

async function main() {
  const root = path.join(__dirname, "..");
  const BG = "#0F2460";
  const W = 1284;
  const H = 2778;
  const out = path.join(root, "assets", "property-journal-splash.png");

  // Extract the app mark from icon.png and mask to a rounded square so
  // white export corners do not show on the navy splash.
  const logoSize = 720;
  const cornerRadius = Math.round(logoSize * 0.22);

  const extracted = await sharp(path.join(root, "assets", "icon.png"))
    .extract({ left: 138, top: 138, width: 976, height: 976 })
    .resize(logoSize, logoSize)
    .ensureAlpha()
    .png()
    .toBuffer();

  const roundedMask = Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg width="${logoSize}" height="${logoSize}" xmlns="http://www.w3.org/2000/svg">
  <rect x="0" y="0" width="${logoSize}" height="${logoSize}" rx="${cornerRadius}" ry="${cornerRadius}" fill="#ffffff"/>
</svg>`);

  const logo = await sharp(extracted)
    .composite([{ input: await sharp(roundedMask).png().toBuffer(), blend: "dest-in" }])
    .png()
    .toBuffer();

  // Slightly above optical center so wordmark sits balanced
  const logoTop = Math.round(H * 0.30);
  const logoLeft = Math.round((W - logoSize) / 2);
  const textY = logoTop + logoSize + 88;

  const svg = Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="${BG}"/>
  <text x="50%" y="${textY}" text-anchor="middle"
        font-family="Arial, Helvetica, sans-serif" font-size="72" font-weight="700"
        fill="#FFFFFF">Property Journal</text>
</svg>`);

  await sharp(svg)
    .composite([{ input: logo, top: logoTop, left: logoLeft }])
    .png()
    .toFile(out);

  const meta = await sharp(out).metadata();
  const stat = fs.statSync(out);
  console.log(
    JSON.stringify(
      {
        out,
        width: meta.width,
        height: meta.height,
        bytes: stat.size,
        logoSize,
        logoTop,
        logoLeft,
        textY,
        cornerRadius,
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
