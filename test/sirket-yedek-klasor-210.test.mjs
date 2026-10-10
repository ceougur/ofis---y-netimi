// 2.1.0 eksik test turu — rastgele sıra testinin uzun koşusunda bulundu (`npm run test:guvenilirlik -- --islem 3000 --tohumlar 2`, tohum 2, taban
// boş, işlem 2331: "silinen 013 · Işık Turizm şirketinin yedek klasörü 013 şirketine verildi"). Önce kırmızı test, sonra en küçük düzeltme.
//
// Hata (R4): şirketin adı yalnız BÜYÜK/küçük harf farkıyla değişince ("ışık turizm" → "Işık Turizm") yedek klasörünün yeni adı (`005 - Işık Turizm`)
// eski adla "aynı" sayılıyor (Windows gibi büyük harfle karşılaştırma) ve boşluğu hiç denetlenmiyordu. Aynı kod ve aynı yazımla açılmış, sonra
// silinmiş bir şirketin yedek klasörü diskte bu yazımla duruyorsa (silinen şirketin yedekleri klasöründe kalır, v2.0.20) büyük/küçük harf duyarlı
// dosya sisteminde bu ayrı bir klasördür: yeniden adlandırma şirketin yedeklerini SİLİNMİŞ şirketin klasörüne taşıyor ve klasörü ona veriyordu —
// iki şirketin yedekleri aynı klasörde. (NTFS'de iki yazım aynı klasördür ve klasör açılırken zaten "(2)" eki alınır; hata büyük/küçük harf
// duyarlı dosya sisteminde görünür. Kural her dosya sisteminde aynı olmalı: içinde başka şirketten kalma yedek olan klasör verilmez.)
// NASIL BOZARIM: A (005 · Işık Turizm) yedek alıp silinir → B aynı kodla "ışık turizm" adıyla açılır → B'nin adı "Işık Turizm" yapılır.
import assert from "node:assert/strict";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { ADMIN_PASSWORD, loginAdmin, startTestServer } from "./helpers.mjs";

const data = res => (res.data && typeof res.data === "object" && "ok" in res.data ? res.data.data : res.data);
const must = async (label, promise) => {
  const res = await promise;
  assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
  return data(res);
};

describe("R4 — yalnız büyük/küçük harf farkıyla ad değişince silinmiş şirketin yedek klasörü verilmez", () => {
  let server;
  let api;
  before(async () => {
    server = await startTestServer({ maxCompanies: 10 });
    api = await loginAdmin(server);
  });
  after(() => server?.close());
  const folderOf = id => server.app.backups.folderOf(server.app.companies.get(id));

  it("A silinir, B aynı kod + küçük harfli adla açılır, B'nin adı A'nın yazımına çevrilir → B'nin klasörü A'nınki değil; A'nın yedekleri yerinde, B'ninkiler B'de", async () => {
    const a = (await must("A aç", api.post("/api/companies", { code: "005", name: "Işık Turizm" }))).company;
    const aFolder = folderOf(a.id);
    await must("A yedek", api.post("/api/admin/backups", { scope: "one", companyId: a.id }));
    const removed = await api.raw("DELETE", `/api/companies/${a.id}`, { body: JSON.stringify({ confirm: "005", password: ADMIN_PASSWORD }), headers: { "content-type": "application/json" } });
    assert.equal(removed.status, 200, `A sil: ${removed.status} ${removed.buffer.toString("utf8").slice(0, 300)}`);
    const deleted = data(removed);
    assert.ok(existsSync(aFolder), "silinen A'nın yedek klasörü yerinde kalır");
    const aBackups = readdirSync(aFolder).sort();
    assert.ok(aBackups.length >= 2 && aBackups.includes(deleted.backup), `A'nın yedekleri: ${aBackups.join(", ")}`);

    const b = (await must("B aç", api.post("/api/companies", { code: "005", name: "ışık turizm" }))).company;
    await must("B yedek", api.post("/api/admin/backups", { scope: "one", companyId: b.id }));
    const bBefore = readdirSync(folderOf(b.id));
    assert.notEqual(path.resolve(folderOf(b.id)), path.resolve(aFolder), "B açılırken A'nın klasörünü almadı");

    await must("B ad değiştir (yalnız büyük harf)", api.put(`/api/companies/${b.id}`, { name: "Işık Turizm" }));
    const bFolder = folderOf(b.id);
    assert.notEqual(path.resolve(bFolder), path.resolve(aFolder), `B'nin yeni yedek klasörü silinmiş A'nınki olmamalı (${path.basename(bFolder)})`);
    assert.deepEqual(readdirSync(aFolder).sort(), aBackups, "A'nın klasörüne B'nin yedeği taşınmadı; A'nın yedekleri aynı");
    assert.deepEqual(readdirSync(bFolder).sort(), bBefore.sort(), "B'nin yedekleri B'nin klasöründe, yalnız B'ninkiler");
    const listed = await must("yedek listesi", api.get("/api/admin/backups"));
    const rows = Array.isArray(listed) ? listed : listed.backups || [];
    assert.ok(!rows.some(row => row.companyId === b.id && aBackups.includes(row.name)), "B'nin listesinde A'nın yedeği yok");
  });
});
