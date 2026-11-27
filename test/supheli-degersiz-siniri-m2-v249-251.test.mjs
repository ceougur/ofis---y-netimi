// 2.5.1 M2 — ders 53 (b): yeni Değersiz sınırı ↔ v2.4.9'un GERÇEK kodu, sınıf sınıf (KALICI). Eski sürümün sonuçları test/fixtures/m2-degersiz-v249/v249.json (üretici aynı klasörde
// uret.mjs.txt: v2.4.9 kopyasında aynı senaryo dosyasını — test/fixtures/m2-degersiz-senaryo.mjs — programın API'siyle koşar). v2.4.9 ile AYNI olması gerekenler (tam tutar, kısmi zincir,
// sonradan bağsız → 2.000, aynı günün altı yazım sırası, bağlı tahsilatın Değersiz'den sonra silinmesi / değişmesi, geri yükleme, iki kayıt) birebir; karar numarasıyla açıklanmış
// BEKLENEN FARKLAR aşağıda — listede olmayan her fark bu testi kırar, listede olup artık farklı olmayan da (liste güncel tutulur).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, describe, it } from "node:test";
import { loginAdmin, startTestServer } from "./helpers.mjs";
import { M2_NOW, runM2Classes } from "./fixtures/m2-degersiz-senaryo.mjs";

const V249 = JSON.parse(readFileSync(new URL("./fixtures/m2-degersiz-v249/v249.json", import.meta.url), "utf8"));
// Beklenen farklar: anahtar (adım kimliği | "bakiye:<cari>" | "kayit:<kayıt>") → karar.
const S_M2_1 = "S-M2-1 = B (sonraki tarihle yazılan Değersiz önceki günlerin bağlı payı düşülmüş kalan kadar; aynı gün şüpheliye almadan önce yazılmış bağlı tahsilat kayıttan düşer)";
const S270 = "S270 = A (ii) (Değersiz yazımı cariyi eksi bakiyeye düşürmez) + 2.5.0 S25 (c) / S181 (bağlı tahsilatın 120 payı aşarsa ret — v2.4.9'da kurulum tahsilatı reddediliyordu)";
const S155 = "Y30-6 / S155 (öneri = sınır ile bakiye kuralının küçüğü; kurulumda ikinci kayıt S-M2-1 = B ile alınabiliyor)";
const SK55 = "SK-55 = C (aynı gün bağlı → bağsız → Şüpheliye Al: 2.5.0'ın bugünkü davranışı korunur — v2.4.9'da bağlı tahsilat şüpheliden düşmüyordu)";
const EXPECTED_DIFF = {
  a6d1: S_M2_1, a6d3: S_M2_1, "bakiye:A6": S_M2_1, "kayit:A6-S": S_M2_1,
  a7d2: S_M2_1, a7d4: S_M2_1, "bakiye:A7": S_M2_1, "kayit:A7-S": S_M2_1,
  a10d1: S_M2_1, a10d2: S_M2_1, "bakiye:A10": S_M2_1, "kayit:A10-S": S_M2_1,
  a21d1: S_M2_1, a21d3: S_M2_1, "bakiye:A21": S_M2_1, "kayit:A21-S": S_M2_1, "kayit:A21-S2": S_M2_1,
  a25d1: S_M2_1, "bakiye:A25": S_M2_1, "kayit:A25-S": S_M2_1,
  a28d1: S_M2_1, "bakiye:A28": S_M2_1, "kayit:A28-S": S_M2_1,
  "kayit:A20-S2": S_M2_1,
  "t:A5-T": S270, a5d1: S270, a5d3: S270, "bakiye:A5": S270, "kayit:A5-S": S270,
  "s:A26-S2": S155, a26d1: S155, a26d2: S155, a26d3: S155, "bakiye:A26": S155, "kayit:A26-S": S155, "kayit:A26-S2": S155,
  a19d1: SK55, "bakiye:A19": SK55, "kayit:A19-S": SK55,
};

describe("M2 — Değersiz sınırı ↔ v2.4.9'un gerçek kodu (sınıf sınıf; ders 53 (b))", () => {
  let server;
  let now;
  before(async () => {
    server = await startTestServer({ now: M2_NOW, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
    now = await runM2Classes(await loginAdmin(server));
  });
  after(() => server.close());

  it("üreticinin sürümü ve saati", () => {
    assert.equal(V249.kod, "v2.4.9");
    assert.equal(V249.now, M2_NOW);
    assert.equal(V249.mutabakat, true);
  });
  it("aynı olması gerekenler birebir, farklar yalnız beklenen farklar listesinde (karar numarasıyla)", () => {
    const actual = new Map();
    for (const [id, item] of Object.entries(now.steps)) actual.set(id, JSON.stringify([item.status, item.code]));
    for (const [name, value] of Object.entries(now.balances)) actual.set(`bakiye:${name}`, JSON.stringify(value));
    for (const [name, value] of Object.entries(now.records)) actual.set(`kayit:${name}`, JSON.stringify(value));
    const old = new Map();
    for (const [id, item] of Object.entries(V249.steps)) old.set(id, JSON.stringify(item));
    for (const [name, value] of Object.entries(V249.balances)) old.set(`bakiye:${name}`, JSON.stringify(value));
    for (const [name, value] of Object.entries(V249.records)) old.set(`kayit:${name}`, JSON.stringify(value));
    const unexpected = [];
    const stale = [];
    const keys = new Set([...actual.keys(), ...old.keys()]);
    for (const key of keys) {
      const same = actual.get(key) === old.get(key);
      if (!same && !EXPECTED_DIFF[key]) unexpected.push(`${key}: yeni ${actual.get(key)} · v2.4.9 ${old.get(key)}`);
      if (same && EXPECTED_DIFF[key]) stale.push(`${key}: artık farklı değil (${EXPECTED_DIFF[key]})`);
    }
    assert.deepEqual(unexpected, [], "açıklanmamış fark (karar numarası yok) birleşmez");
    assert.deepEqual(stale, [], "beklenen fark listesi güncel değil");
  });
  it("v2.4.9 ile AYNI sınıflar: tam tutar (A1), kısmi zincir (A2, A3), bağlı = şüpheli (A4), sonradan bağsız → 2.000 (A9), altı yazım sırası (A11–A18), m.10, m.11", () => {
    for (const id of ["a1d2", "a2d2", "a3d3", "a4d1", "a9d1", "a9d3", "a11d1", "a11d2", "a16d2", "m10ex", "m11by", "m11bd3"]) assert.deepEqual([now.steps[id].status, now.steps[id].code], V249.steps[id], id);
    for (const name of ["A1", "A2", "A3", "A4", "A9", "M10E", "M11B", "M11C"]) assert.equal(now.balances[name], V249.balances[name], name);
  });
});
