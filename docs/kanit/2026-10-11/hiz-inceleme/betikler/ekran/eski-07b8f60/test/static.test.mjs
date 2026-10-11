import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { startTestServer } from "./helpers.mjs";

describe("statik dosyalar", () => {
  let server;
  before(async () => {
    server = await startTestServer();
  });
  after(() => server.close());

  it("ana sayfayı güvenlik başlıkları ve CSP ile sunar", async () => {
    const response = await fetch(`${server.base}/`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-security-policy"), /script-src 'self'/);
    assert.equal(response.headers.get("x-frame-options"), "DENY");
    assert.equal(response.headers.get("cache-control"), "no-store");
    const html = await response.text();
    assert.ok(!html.includes("manus-runtime"), "Manus çalışma zamanı kaldırılmış olmalı");
    assert.ok(!/<script(?![^>]*\bsrc=)[^>]*>/i.test(html), "satır içi betik olmamalı");
  });

  it("değişmeyen dosyada 304 döner ve sıkıştırma uygular", async () => {
    const first = await fetch(`${server.base}/assets/hof-core.js`, { headers: { "accept-encoding": "br, gzip" } });
    assert.equal(first.status, 200);
    const etag = first.headers.get("etag");
    assert.ok(etag);
    await first.arrayBuffer();
    const second = await fetch(`${server.base}/assets/hof-core.js`, { headers: { "if-none-match": etag } });
    assert.equal(second.status, 304);
  });

  it("klasör dışına çıkma ve gizli dosya denemelerini engeller", async () => {
    for (const target of ["/../package.json", "/%2e%2e/package.json", "/assets/../../server/server.mjs", "/__manus__/version.json", "/.gitignore", "/assets"]) {
      const response = await fetch(`${server.base}${target}`);
      assert.equal(response.status, 404, target);
      await response.arrayBuffer();
    }
  });

  it("bilinmeyen sayfada tarayıcıya HTML 404 gösterir", async () => {
    const response = await fetch(`${server.base}/olmayan-sayfa`, { headers: { accept: "text/html" } });
    assert.equal(response.status, 404);
    assert.match(await response.text(), /Sayfa bulunamadı/);
  });

  it("bilinmeyen API ucu 404, desteklenmeyen yöntem 405 döner", async () => {
    assert.equal((await fetch(`${server.base}/api/yok`)).status, 404);
    assert.equal((await fetch(`${server.base}/api/health`, { method: "DELETE" })).status, 405);
  });
});
