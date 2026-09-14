import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function read(rel: string): string {
  return readFileSync(resolve(import.meta.dirname, rel), "utf8");
}

describe("product-owner LIMITS structure", () => {
  it("EN LIMITS has blockers / ceiling / shortfalls / next / conditions plus tried-partial", () => {
    const md = read("../../docs/LIMITS.md");
    expect(md).toMatch(/## .*Blockers/);
    expect(md).toMatch(/## .*Ceiling/);
    expect(md).toMatch(/## .*Shortfalls/);
    expect(md).toMatch(/## .*Next optimizations/);
    expect(md).toMatch(/## .*Conditions/);
    expect(md.toLowerCase()).toContain("tried");
    expect(md).toContain("~45°");
    expect(md).toMatch(/does \*\*not\*\* require yaw ∈ \[70, 90\]/i);
    expect(md.toLowerCase()).toContain("ear segmentation");
    expect(md.toLowerCase()).toContain("hair");
    expect(md.toLowerCase()).toContain("motion blur");
    expect(md.toLowerCase()).toContain("labeled");
  });

  it("zh LIMITS has 卡点 / 上限 / 短板 / 后续优化 / 优化条件 plus 试过", () => {
    const md = read("../../docs/LIMITS.zh-CN.md");
    expect(md).toContain("## 卡点");
    expect(md).toContain("## 当前上限");
    expect(md).toContain("## 短板");
    expect(md).toContain("## 后续优化");
    expect(md).toContain("## 优化条件");
    expect(md).toContain("试过");
    expect(md).toContain("~45°");
    expect(md).not.toContain("固定 70–90 作为 READY 硬门且已上线");
  });

  it("READMEs point at LIMITS and name ceiling vs cannot-do", () => {
    const en = read("../../README.md");
    const zh = read("../../README.zh-CN.md");
    expect(en).toContain("docs/LIMITS.md");
    expect(zh).toContain("docs/LIMITS.zh-CN.md");
    expect(en).toMatch(/Ceiling that ships|能实现的天花板/);
    expect(zh).toContain("能实现的天花板");
    expect(en).toMatch(/Explicitly not solved|明确做不到的/);
    expect(zh).toContain("明确做不到的");
    expect(en).toMatch(/hysteresis|exitBandDeg/);
    expect(zh).toContain("滞后");
  });
});
