// Copy the compiled CSS out of .next so it survives the next build.
// Used by the CSS-equivalence guard to compare a "before" stylesheet with
// the "after" one.
const fs = require("fs");
const path = require("path");

const src = path.join(__dirname, "..", ".next", "static", "chunks");
const dest = path.join(__dirname, "..", "ref-css");

fs.mkdirSync(dest, { recursive: true });
const files = fs.readdirSync(src).filter((f) => f.endsWith(".css"));
let total = 0;
for (const f of files) {
  const buf = fs.readFileSync(path.join(src, f));
  fs.writeFileSync(path.join(dest, f), buf);
  total += buf.length;
  console.log(`copied ${f} (${buf.length} bytes)`);
}
console.log(`total ${total} bytes -> ${dest}`);
