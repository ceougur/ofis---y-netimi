// Hakem K3 (10.10.2026; docs/kanit/2026-10-10/kahin/hakem-hukumleri.json → KASA-ISTEK-KIMLIGI): Kasa elle hareketi (POST /api/workspace/cash)
// istek kimliğini (x-hof-request) yok sayıyordu — aynı istek iki kez gelince Kasa ve 770 iki kez yazılıyordu; mizan dengede kaldığı için
// Mutabakat Testi görmüyordu. v2.0.26'da da vardı (orada bu uçta kimlik hiç yoktu).
// Plan (docs/BANKA-MODULU-PLAN.md): §7 "Yazan her uç x-hof-request alır ve bank.post'tan geçer"; §3.3 adım 1 "aynı kimlik + farklı içerik → 409";
// §3.10/1 kalıcı istek kimliği, "replayed:true" ve "Bu işlem zaten kaydedildi (BNK-…); ikinci kez yazılmadı."
//
// Nasıl bozarım (önce yazıldı; testler buradan):
//   B1 Kasa'dan 212 çıkış iki kez aynı kimlikle (zaman aşımından sonra yeniden Kaydet, ağ tekrarı) → iki çıkış? (beklenen: tek satır, replayed)
//   B2 Aynı kimlik, farklı tutar (formu değiştirip yeniden gönder) → ikinci satır? (beklenen: 409 request-id-reused, satır yok)
//   B3 Aynı kimlikle iki istek AYNI ANDA → iki satır? (beklenen: tek satır)
//   B4 Giriş yönünde aynısı (Kasa ve 649 iki kez)
//   B5 Kimliksiz iki aynı istek → ikisi de yazılır (gerçekten iki ödeme; eski davranış korunur)
// Bu dosya yalnız test/helpers.mjs kullanır: aynı dosya v2.0.26'nın gerçek koduyla da koşulur (canlı sürümdeki kırmızı).
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { loginAdmin, startTestServer } from "./helpers.mjs";

const pad = n => String(n).padStart(2, "0");
// Göreli tarih (ders 13): dünün yerel tarihi — gerçek saatle de, ileri tarih kuralına takılmaz.
const yesterday = (() => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
})();
const ID = { k13: "ik13-kasa-istek-kimligi-0001", k21: "ik21-kasa-istek-kimligi-0002", par: "ikpar-kasa-istek-kimligi-003" };
const body = (kind, amount, description) => ({ kind, amount, date: yesterday, description, method: "cash" });
const data = r => (r.data && r.data.ok === true ? r.data.data : r.data);

describe("K3 — Kasa elle hareketi istek kimliği (plan §7, §3.3/1, §3.10/1)", () => {
  let server;
  let admin;
  const cash = async () => data(await admin.get("/api/workspace/cash?method=cash"));
  const rows = async description => (await cash()).entries.filter(entry => entry.source === "manual" && entry.description === description);
  const trial = async () => Object.fromEntries((data(await admin.get("/api/workspace/ledger"))?.trial?.accounts || []).map(row => [String(row.code), row]));
  before(async () => {
    server = await startTestServer();
    admin = await loginAdmin(server);
    // k0: Kasa'ya kimliksiz 1.000 giriş (çıkış eksi bakiye denetimine takılmasın).
    const opened = await admin.post("/api/workspace/cash", body("in", "1000", "Kasaya Giriş"));
    assert.equal(opened.status, 200, JSON.stringify(opened.data));
  });
  after(() => server?.close());

  it("B1: aynı kimlik + aynı içerik → 200 replayed, aynı id, tek satır; Kasa 788, 770 = 212", async () => {
    const first = await admin.post("/api/workspace/cash", body("out", "212", "Temizlik Gideri"), { "x-hof-request": ID.k13 });
    assert.equal(first.status, 200, JSON.stringify(first.data));
    const again = await admin.post("/api/workspace/cash", body("out", "212", "Temizlik Gideri"), { "x-hof-request": ID.k13 });
    assert.equal(again.status, 200, `yineleme: ${again.status} ${JSON.stringify(again.data)}`);
    assert.equal(data(again).replayed, true, `yineleme replayed:true dönmeli: ${JSON.stringify(again.data)}`);
    assert.equal(data(again).id, data(first).id, "yineleme ilk kaydın kimliğini döndürür");
    // Plan §3.10/1: arayüz "Bu işlem zaten kaydedildi (BNK-…); ikinci kez yazılmadı." yazar — yineleme İşlem No'yu taşır.
    assert.match(String(data(again).no || ""), /^BNK-\d{4}-\d+$/, `yinelemede İşlem No: ${JSON.stringify(again.data)}`);
    assert.equal((await rows("Temizlik Gideri")).length, 1, "Kasa'da tek Temizlik Gideri satırı");
    assert.equal((await cash()).byMethod.cash, 788, "Kasa 1.000 − 212 = 788");
    const accounts = await trial();
    if (accounts["770"]) assert.equal(accounts["770"].balance, 212, "770 Genel Giderler 212 (bir kez)");
  });

  it("B2: aynı kimlik + farklı içerik (250) → 409 request-id-reused; satır yazılmaz", async () => {
    const changed = await admin.post("/api/workspace/cash", body("out", "250", "Temizlik Gideri"), { "x-hof-request": ID.k13 });
    assert.equal(changed.status, 409, `farklı içerik: ${changed.status} ${JSON.stringify(changed.data)}`);
    assert.equal(changed.data?.code, "request-id-reused");
    assert.equal((await rows("Temizlik Gideri")).length, 1);
    assert.equal((await cash()).byMethod.cash, 788);
  });

  it("B3: aynı kimlikle iki istek AYNI ANDA → tek satır (biri yazar, öbürü onun sonucunu görür)", async () => {
    const both = await Promise.all([0, 1].map(() => admin.post("/api/workspace/cash", body("out", "10", "Çay Ocağı"), { "x-hof-request": ID.par })));
    for (const res of both) assert.equal(res.status, 200, JSON.stringify(res.data));
    assert.equal(both.filter(res => data(res).replayed === true).length, 1, "biri replayed");
    assert.equal(data(both[0]).id, data(both[1]).id, "iki yanıt aynı kayıt");
    assert.equal((await rows("Çay Ocağı")).length, 1);
    assert.equal((await cash()).byMethod.cash, 778);
  });

  it("B4: giriş yönünde aynı kimlik iki kez → tek giriş (Kasa ve 649 bir kez)", async () => {
    const first = await admin.post("/api/workspace/cash", body("in", "50", "Danışmanlık Ücreti"), { "x-hof-request": ID.k21 });
    assert.equal(first.status, 200);
    const again = await admin.post("/api/workspace/cash", body("in", "50", "Danışmanlık Ücreti"), { "x-hof-request": ID.k21 });
    assert.equal(again.status, 200);
    assert.equal(data(again).replayed, true, `giriş yinelemesi replayed:true: ${JSON.stringify(again.data)}`);
    assert.equal((await rows("Danışmanlık Ücreti")).length, 1);
    assert.equal((await cash()).byMethod.cash, 828);
  });

  it("B5: kimliksiz iki aynı istek iki ayrı ödemedir (eski davranış: ikisi de yazılır)", async () => {
    for (let i = 0; i < 2; i += 1) assert.equal((await admin.post("/api/workspace/cash", body("out", "5", "Posta Gideri"))).status, 200);
    assert.equal((await rows("Posta Gideri")).length, 2);
    assert.equal((await cash()).byMethod.cash, 818);
  });

  it("Mutabakat Testi tamam", async () => {
    const result = data(await admin.get("/api/workspace/ledger/integrity"));
    assert.equal(result.ok, true, JSON.stringify(result.failures || result).slice(0, 600));
  });
});
