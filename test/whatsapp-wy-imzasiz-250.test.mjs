// 2.5.0 WY — Yol 2 ("WhatsApp'ı Bağla") bağlantısında İMZASIZ durum bildirimi (2.4.8 dar kontrol 18 DÜŞÜK: "Yol 2'de imzasız bildirim 503 yolunda deftere yazılıyor";
// plan docs/erp/WHATSAPP-PAKETI-2.5.0-PLANI.md §1 WY). Hedef (plandan): imzası doğrulanamayan bildirim "tanınmadı" kaydıyla ele alınır, gönderim durumunu DEĞİŞTİRMEZ
// (sahte bildirim teslim / teslim edilemedi saydırmaz) — şirket dosyası açılamazken de (geri yükleme sürüyor → 503, şirket silinmiş, veri dosyası yok); Meta'nın
// yeniden denemesi bildirimi KAYBETTİRMEZ (imzasız Yol 2 bildirimine 200 dönülmez; gerçek, imzalı bildirim sonra gelince uygulanır); aynı bildirim iki kez gelirse tek
// işlenir (wamid + durum). Yol 1 ("Elle Bağla") bildirimleri tasarım gereği imzasızdır (plan 2.4.8 §3 C) — bugünkü davranış AYNEN kalır (iki kipli aynı WABA dahil:
// 2.4.8 İş Y3'ün WABA başına kipi dk19 D2'de iki şirkette kayıp doğurmuştu, geri alındı).
//
// Düzenek (test/whatsapp-wy-ortak.mjs): GERÇEK program + GERÇEK kapıcı (bulut/kapi/kapi.mjs, yerel — Meta imzası X-Hub-Signature-256 kapıcıda DestekOfis uygulama sırrıyla
// doğrulanır: "wa1" imzalı / "wa0" imzasız) + yerel SAHTE Meta Graph (aynı el — kâhin DEĞİL, ders 5; beklenen sayılar plandan ve testin girdiği veriden). Yeniden
// açılış hücrelerinde kapıcı yok (bildirim imzasız). Ders 30: lisans servisi yerel ölü adres. Ders 13: sahte saat. Dosya TZ=UTC ve TZ=Europe/Istanbul ile koşulur.
// Ders 48 (Windows): veri dosyasını YENİDEN ADLANDIRAN hücreler var (şirket kapatıldıktan / program kapandıktan sonra; T-Ksil düzeni).
//
// "Nasıl bozulur": geri yükleme sürerken sahte imzasız "delivered" → defterde teslim → gerçek "failed" yok sayılır (kişi iletiyi almadığı hâlde Daha Önce Gönderildi);
// silinmiş / dosyası kayıp şirkete sahte "failed" → teslim edilemedi → kişiye aynı dönemde ikinci ileti; aynı WABA'da biri Yol 1 öbürü Yol 2 iki şirket (kip WABA'ya
// bağlanırsa Yol 1'in bildirimi kaybolur); program yeniden açılır ve şirketin dosyası açılamaz (kip bellekte yok → makine defterinden); 2.5.0 öncesi defter (kip kaydı yok).
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ADMIN_PASSWORD, failed, hideFile, kurulum, st, yenidenAcilis } from "./whatsapp-wy-ortak.mjs";

const removeCompany = s => s.api.raw("DELETE", `/api/companies/${s.company.id}`, { body: JSON.stringify({ confirm: s.company.code, password: ADMIN_PASSWORD }), headers: { "content-type": "application/json" } });

describe("2.5.0 WY — Yol 2 imzasız bildirim: şirket dosyası açılamazken de yazılmaz, tanınmadı (401/503), gerçek bildirim kaybolmaz", () => {
  it("WY-1 Yol 2 · geri yükleme sürüyor (geçici) · İMZASIZ delivered → 503, defterde teslim YOK; açılınca imzasız yine 401; gerçek (imzalı) failed uygulanır: Başarısız, kişi gönderilecek, Bu Ay 0", { timeout: 120_000 }, async () => {
    const s = await kurulum();
    try {
      const { batchId, job, accountId } = await s.sent("Burak Kaya", "0533 444 55 66");
      s.busy(true);
      try {
        const forged = await s.post([st(s, job.wamid, "delivered")]);
        assert.equal(forged.status, 503, `geçici açılamama → 503 (geldi ${forged.status} ${forged.text})`);
        assert.equal(s.delivered(job.id), false, "imzasız bildirim defterde teslim YAZMADI (sahte teslim sayılmaz)");
      } finally {
        s.busy(false);
      }
      const again = await s.post([st(s, job.wamid, "delivered")]);
      assert.equal(again.status, 401, `şirket açıkken imzasız → 401 (geldi ${again.status} ${again.text})`);
      assert.equal((await s.job(batchId)).state, "accepted", "imzasız bildirim satırı değiştirmedi");
      const real = await s.post([failed(s, job.wamid)], { signed: true });
      assert.equal(real.status, 200, real.text);
      assert.equal((await s.job(batchId)).state, "failed", "gerçek (imzalı) teslim edilemedi bildirimi kaybolmadı");
      assert.equal(s.failures(job.id), 1, "defterde teslim edilemedi");
      assert.deepEqual(await s.skip(accountId), ["gönderilecek"], "kesin almadı → sayılmaz (ilke 1)");
      assert.equal(await s.buAy(), 0, "Bu Ay sahte teslimle artmadı");
    } finally {
      await s.close();
    }
  });

  it("WY-2 Yol 2 · geri yükleme sürüyor · İMZALI delivered ×2 → 503 ×2, defterde TEK teslim (503'ten önce yazım sürer — X1); açılınca imzalı delivered 200: Teslim Edildi, Bu Ay 1, Daha Önce Gönderildi", { timeout: 120_000 }, async () => {
    const s = await kurulum();
    try {
      const { batchId, job, accountId } = await s.sent("Ayşe Demir", "0533 444 55 67");
      s.busy(true);
      try {
        for (let i = 0; i < 2; i += 1) {
          const res = await s.post([st(s, job.wamid, "delivered")], { signed: true });
          assert.equal(res.status, 503, `geçici açılamama → 503 (${i + 1}. geliş: ${res.status} ${res.text})`);
        }
        assert.equal(s.delivered(job.id), true, "imzalı teslim 503'ten önce defterde (X1, karar 1)");
        assert.equal(s.deliveries(job.id), 1, "aynı bildirim iki kez → tek teslim");
      } finally {
        s.busy(false);
      }
      const res = await s.post([st(s, job.wamid, "delivered")], { signed: true });
      assert.equal(res.status, 200, res.text);
      assert.equal((await s.job(batchId)).state, "delivered");
      assert.equal(s.deliveries(job.id), 1, "üçüncü geliş de tek teslim");
      assert.equal(await s.buAy(), 1, "Bu Ay 1");
      assert.deepEqual(await s.skip(accountId), ["Daha Önce Gönderildi"]);
    } finally {
      await s.close();
    }
  });

  it("WY-3 Yol 2 · şirket SİLİNDİ · imzasız delivered ve failed → 401 (200 değil; Meta yeniden dener), defterde teslim / teslim edilemedi YOK; imzalı delivered ×2 → 200, defterde tek teslim", { timeout: 120_000 }, async () => {
    const s = await kurulum();
    try {
      const { job } = await s.sent("Can Yıldız", "0533 444 55 68");
      const del = await removeCompany(s);
      assert.equal(del.status, 200, `ön koşul: şirket silindi (geldi ${del.status})`);
      for (const [label, statuses] of [["delivered", [st(s, job.wamid, "delivered")]], ["failed", [failed(s, job.wamid)]]]) {
        const res = await s.post(statuses);
        assert.equal(res.status, 401, `silinmiş şirket · imzasız ${label} → 401 (geldi ${res.status} ${res.text})`);
      }
      assert.equal(s.delivered(job.id), false, "imzasız teslim defterde yok");
      assert.equal(s.failures(job.id), 0, "imzasız teslim edilemedi defterde yok");
      for (let i = 0; i < 2; i += 1) assert.equal((await s.post([st(s, job.wamid, "delivered")], { signed: true })).status, 200, `imzalı delivered ${i + 1}. geliş 200`);
      assert.equal(s.deliveries(job.id), 1, "imzalı teslim defterde, tek");
    } finally {
      await s.close();
    }
  });

  it("WY-4 Yol 2 · veri dosyası YOK (kalıcı) · imzasız failed 131026 → 401, teslim edilemedi YAZILMAZ; dosya geri gelince kişi Daha Önce Gönderildi (sahte başarısızlık ikinci ileti açmaz); imzalı failed → 200 + defterde", { timeout: 120_000 }, async () => {
    const s = await kurulum();
    try {
      const { job, accountId } = await s.sent("Deniz Ak", "0533 444 55 69");
      await s.server.app.context.closeCompany(s.company.id);
      const putBack = hideFile(s.server.app.config.dataDir);
      const forged = await s.post([failed(s, job.wamid)]);
      assert.equal(forged.status, 401, `kalıcı açılamama · imzasız failed → 401 (geldi ${forged.status} ${forged.text})`);
      assert.equal(s.failures(job.id), 0, "imzasız teslim edilemedi defterde yok");
      putBack();
      assert.deepEqual(await s.skip(accountId), ["Daha Önce Gönderildi"], "sahte başarısızlık kişiyi yeniden gönderilecek yapmadı");
      await s.server.app.context.closeCompany(s.company.id);
      const putBack2 = hideFile(s.server.app.config.dataDir);
      const real = await s.post([failed(s, job.wamid)], { signed: true });
      assert.equal(real.status, 200, real.text);
      assert.equal(s.failures(job.id), 1, "imzalı teslim edilemedi defterde (K4)");
      putBack2();
      assert.deepEqual(await s.skip(accountId), ["gönderilecek"], "gerçek başarısızlık → kesin almadı (ilke 1)");
    } finally {
      await s.close();
    }
  });

  it("WY-5 Yol 1 AYNEN · aynı WABA'da 001 WhatsApp'ı Bağla + 002 Elle Bağla · 002 geçici açılamıyor → imzasız delivered 503 + defterde teslim (X1); 002 silinince imzasız delivered 200 + defterde teslim (kip şirket başına)", { timeout: 120_000 }, async () => {
    const s = await kurulum({ root: "embedded", second: "manual" });
    try {
      const first = await s.sent("Ece Su", "0533 444 55 70");
      const second = await s.sent("Efe Tan", "0533 444 55 71");
      s.busy(true);
      try {
        const res = await s.post([st(s, first.job.wamid, "delivered")]);
        assert.equal(res.status, 503, `geçici açılamama → 503 (geldi ${res.status} ${res.text})`);
        assert.equal(s.delivered(first.job.id), true, "Yol 1 imzasız teslim 503'ten önce defterde (bugünkü davranış)");
      } finally {
        s.busy(false);
      }
      const del = await removeCompany(s);
      assert.equal(del.status, 200, `ön koşul: şirket silindi (geldi ${del.status})`);
      const res = await s.post([st(s, second.job.wamid, "delivered")]);
      assert.equal(res.status, 200, `silinmiş Yol 1 şirketi · imzasız delivered → 200 (geldi ${res.status} ${res.text})`);
      assert.equal(s.deliveries(second.job.id), 1, "Yol 1 imzasız teslim yalnız defterde (İş U (a))");
    } finally {
      await s.close();
    }
  });
});

describe("2.5.0 WY — kip makine defterinde: yeniden açılışta şirket dosyası açılamazken de bilinir", () => {
  it("WY-6 Yol 2 · program YENİDEN AÇILDI, 002'nin veri dosyası açılışta YOK (kip bellekte değil, makine defterinde) · imzasız delivered → 401, defterde teslim YOK", { timeout: 120_000 }, async () => {
    const r = await yenidenAcilis({ mode: "embedded" });
    assert.equal(r.status, 401, `imzasız Yol 2 → 401 (geldi ${r.status} ${r.text})`);
    assert.equal(r.delivered, false, "imzasız teslim defterde yok");
  });
  it("WY-7 kip BİLİNMİYOR (2.5.0 öncesi defter, dosya açılamıyor) → Yol 1 sayılır (bugünkü davranış): imzasız delivered 200 + defterde teslim (BAŞ MİMAR KARARI: 2.5.0 öncesi Yol 2 ileti gönderemezdi)", { timeout: 120_000 }, async () => {
    const r = await yenidenAcilis({ mode: "manual", forgetMode: true });
    assert.equal(r.status, 200, `kipi bilinmeyen (Yol 1) → 200 (geldi ${r.status} ${r.text})`);
    assert.equal(r.delivered, true, "Yol 1 imzasız teslim yalnız defterde (İş V1)");
  });
});
