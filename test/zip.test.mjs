import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { createZip, readZip, safeEntryName } from "../server/lib/zip.mjs";

describe("ZIP yazma/okuma", () => {
  it("yazdığını aynen okur (UTF-8 adlar, boş ve ikili dosyalar)", () => {
    const binary = Buffer.from([0, 1, 2, 250, 255]);
    const zip = createZip([
      { name: "klasör/ğüşiöç.txt", data: Buffer.from("Merhaba DestekOfis ".repeat(50)) },
      { name: "bos.txt", data: Buffer.alloc(0) },
      { name: "a/b/ikili.bin", data: binary },
    ]);
    const entries = readZip(zip);
    assert.deepEqual(entries.map(entry => entry.name), ["klasör/ğüşiöç.txt", "bos.txt", "a/b/ikili.bin"]);
    assert.equal(entries[0].data.toString(), "Merhaba DestekOfis ".repeat(50));
    assert.deepEqual(entries[2].data, binary);
  });

  it("sistem unzip aracıyla uyumludur", { skip: !hasUnzip() }, () => {
    const dir = mkdtempSync(path.join(tmpdir(), "zip-"));
    try {
      const file = path.join(dir, "test.zip");
      writeFileSync(file, createZip([{ name: "x/y.txt", data: Buffer.from("tamam") }]));
      const output = execFileSync("unzip", ["-p", file, "x/y.txt"], { encoding: "utf8" });
      assert.equal(output, "tamam");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("zip-slip girişlerini reddeder", () => {
    assert.equal(safeEntryName("../kotu.txt"), null);
    assert.equal(safeEntryName("a/../../kotu.txt"), null);
    assert.equal(safeEntryName("/etc/passwd"), null);
    assert.equal(safeEntryName("C:/Windows/x"), null);
    assert.equal(safeEntryName("a\\b\\c.txt"), "a/b/c.txt");
    const evil = createZip([{ name: "../kotu.txt", data: Buffer.from("x") }]);
    assert.throws(() => readZip(evil), /Güvensiz/);
  });

  it("bozulmuş içeriği CRC ile yakalar", () => {
    const zip = createZip([{ name: "a.txt", data: Buffer.from("a".repeat(1000)) }]);
    const broken = Buffer.from(zip);
    broken[40] ^= 0xff;
    assert.throws(() => readZip(broken));
  });
});

function hasUnzip() {
  try {
    execFileSync("unzip", ["-v"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}
