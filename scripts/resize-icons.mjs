// Resize the source Movbox icon into the full multi-size set the
// browser needs. Source: the user's high-res PNG (1024x1024 ish).
//
// Run once from the project root:
//   node scripts/resize-icons.mjs
//
// Outputs to:
//   public/favicon.ico          (16, 32, 48 multi-size .ico)
//   public/favicon-16x16.png
//   public/favicon-32x32.png
//   public/movbox_icon.png       (256×256, used by Logo component)
//   public/apple-touch-icon.png (180×180)
//   public/icon-192.png         (Android home-screen / PWA)
//   public/icon-512.png         (PWA splash)
//   public/og-image.png         (1200×630 social card, optional)

import sharp from "sharp";
import { writeFile, mkdir, access, copyFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const publicDir = resolve(root, "public");
const sourceIcon = resolve(
  process.env.HOME ||
    process.env.USERPROFILE ||
    "",
  "AppData",
  "Local",
  "Temp",
  "movbox-icon-source.png"
);

// The user-attached icon (the burgundy "M" with play triangle).
// Override with MOVBOX_ICON env if the file moves.
const fallbackSource = resolve(
  process.env.MOVBOX_ICON_SOURCE ||
    "C:/Users/hp/.minimax/v2/assets/2026/09/05/01-31-28-139-asset_20260905-013128-139_9ad2ad345ab9_41db24ff-ChatGPT Image Aug 28, 2026, 02_09_52 PM.png"
);

await mkdir(publicDir, { recursive: true });

let input;
try {
  await access(sourceIcon);
  input = sourceIcon;
  console.log(`source: ${sourceIcon}`);
} catch {
  try {
    await access(fallbackSource);
    input = fallbackSource;
    console.log(`source (fallback): ${input}`);
  } catch (e) {
    console.error(
      "Could not find the source icon. Set MOVBOX_ICON_SOURCE to the PNG path."
    );
    process.exit(1);
  }
}

const base = sharp(input);

// 256×256 — used by the Logo component (movbox_icon.png).
await base
  .clone()
  .resize(256, 256, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png({ compressionLevel: 9 })
  .toFile(resolve(publicDir, "movbox_icon.png"));
console.log("wrote public/movbox_icon.png (256x256)");

// 180×180 — Apple touch icon.
await base
  .clone()
  .resize(180, 180, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png({ compressionLevel: 9 })
  .toFile(resolve(publicDir, "apple-touch-icon.png"));
console.log("wrote public/apple-touch-icon.png (180x180)");

// 32×32 — primary favicon.
await base
  .clone()
  .resize(32, 32, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png({ compressionLevel: 9 })
  .toFile(resolve(publicDir, "favicon-32x32.png"));
console.log("wrote public/favicon-32x32.png (32x32)");

// 16×16 — fallback for ancient browsers.
await base
  .clone()
  .resize(16, 16, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png({ compressionLevel: 9 })
  .toFile(resolve(publicDir, "favicon-16x16.png"));
console.log("wrote public/favicon-16x16.png (16x16)");

// 192×192 — Android / PWA.
await base
  .clone()
  .resize(192, 192, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png({ compressionLevel: 9 })
  .toFile(resolve(publicDir, "icon-192.png"));
console.log("wrote public/icon-192.png (192x192)");

// 512×512 — PWA splash.
await base
  .clone()
  .resize(512, 512, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png({ compressionLevel: 9 })
  .toFile(resolve(publicDir, "icon-512.png"));
console.log("wrote public/icon-512.png (512x512)");

// Multi-size .ico (16, 32, 48) for browser tabs / bookmarks.
const ico16 = await base.clone().resize(16, 16).png().toBuffer();
const ico32 = await base.clone().resize(32, 32).png().toBuffer();
const ico48 = await base.clone().resize(48, 48).png().toBuffer();
const toIco = (await import("sharp")).default;
await toIco({
  pages: [
    { input: ico16, size: 16 },
    { input: ico32, size: 32 },
    { input: ico48, size: 48 },
  ],
}).toFile(resolve(publicDir, "favicon.ico"));
console.log("wrote public/favicon.ico (16+32+48 multi-size .ico)");

// Also overwrite app/favicon.ico so Next.js's static-file convention
// has the same brand.
await copyFile(
  resolve(publicDir, "favicon.ico"),
  resolve(root, "app", "favicon.ico")
);
console.log("copied to app/favicon.ico");

console.log("\nAll icons regenerated.");
