import { access, cp, mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(root, "dist");
const rawDir = path.join(
  root,
  "harmony",
  "entry",
  "src",
  "main",
  "resources",
  "rawfile",
);
const keep = new Set(["README.md"]);

try {
  await access(path.join(distDir, "index.html"));
} catch {
  console.error(
    "sync-harmony-rawfile: dist/index.html is missing. Run npm run build first.",
  );
  process.exit(1);
}

await mkdir(rawDir, { recursive: true });

const existing = await readdir(rawDir);
for (const name of existing) {
  if (keep.has(name)) continue;
  await rm(path.join(rawDir, name), { recursive: true, force: true });
}

const produced = await readdir(distDir);
let copied = 0;
for (const name of produced) {
  if (keep.has(name)) {
    console.warn(
      `sync-harmony-rawfile: skipped dist/${name} so rawfile/README.md stays the shell note.`,
    );
    continue;
  }
  await cp(path.join(distDir, name), path.join(rawDir, name), {
    recursive: true,
  });
  copied += 1;
}

console.log(
  `sync-harmony-rawfile: copied ${copied} entr${copied === 1 ? "y" : "ies"} from dist/ into harmony rawfile.`,
);
console.log(
  "sync-harmony-rawfile: this does not sign, assemble, or install a HAP.",
);
