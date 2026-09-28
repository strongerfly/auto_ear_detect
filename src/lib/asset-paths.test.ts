import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("relative asset paths for the ArkWeb rawfile shell", () => {
  it("keeps the Vite base and favicon relative to the page", () => {
    const root = resolve(import.meta.dirname, "../..");
    const vite = readFileSync(resolve(root, "vite.config.ts"), "utf8");
    const html = readFileSync(resolve(root, "index.html"), "utf8");
    expect(vite).toMatch(/base:\s*"\.\/"/);
    expect(html).toContain('href="./favicon.svg"');
    expect(html).not.toMatch(/href="\/favicon\.svg"/);
  });
});
