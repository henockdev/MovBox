// Convert the small PNG into a single-size .ico and overwrite both
// public/favicon.ico and app/favicon.ico.
import sharp from "sharp";
import { copyFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const src = resolve(root, "public", "favicon-32x32.png");
const dst1 = resolve(root, "public", "favicon.ico");
const dst2 = resolve(root, "app", "favicon.ico");

// sharp doesn't have a true multi-size .ico encoder with a public API,
// but a single 32x32 PNG renamed to .ico is recognized by all modern
// browsers (Chrome, Firefox, Edge, Safari). 977 bytes vs 830 KB.
await sharp(src)
  .toFormat("png")
  .toBuffer()
  .then(async (buf) => {
    const fs = await import("node:fs/promises");
    await fs.writeFile(dst1, buf);
    await fs.writeFile(dst2, buf);
    console.log(`wrote ${dst1} and ${dst2} (${buf.length} bytes)`);
  });
