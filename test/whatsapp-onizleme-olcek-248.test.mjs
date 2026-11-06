// 2.4.8 İŞ Z (T9 ORTA bulgusu: 2.000 carili şirkette WhatsApp önizlemesi ~23 sn, başlatma ~26 sn, 3.014 caride ~38 sn; bu sürede olay döngüsü kilitli → öbür
// kullanıcılar donuyor). Kök neden (profil, docs/kanit/2026-11-01/248-isz-*): önizleme / açma kişi başı TAM cari kartını (accounts.detail; kartın ekran ekleri dahil)
// okuyordu; "Zaten Kuyrukta" kişi başı sorgu; makine defterinin "Tüm Hareketler" R3 sorgusu kişi anahtarlarını dizinle tek tek yokluyordu. Düzeltme: kartın ELEME
// ÇEKİRDEĞİ (routes/accounts.mjs waFacts — detail ile aynı işlevler), plan() başında tek "Zaten Kuyrukta" sorgusu, defter sorgusunda `+k.period_key` (yalnız plan).
// Davranış AYNEN: bu dosya (1) çekirdek ↔ tam kart eşitliğini eleme alanlarında her cari sınıfı için, (2) önizlemenin eleme nedenlerini SINIF TANIMINDAN beklenen
// değerlerle (kâhin = sınıf tanımı, programın çıktısı değil — ders 5), (3) cari kartındaki taksit özetinin kartın kendi ayrıntısıyla aynılığını, (4) yapısal sayıları
// (önizlemede tam kart okuması 0, "Zaten Kuyrukta" sorgusu 1, defter planında kişi anahtarı yoklaması yok) denetler. Eski kodda (b2e7bf19) (4) beklenen nedenle kırmızı.
// Gerçek program + yerel sahte Meta (ders 30), elle işçi (ders 20), sahte saat (ders 13).
import assert from "node:assert/strict";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, it } from "node:test";
import { SENT_BEFORE_SQL_YALNIZ_TEST, WA_LEDGER_FILE } from "../server/lib/whatsapp/defter.mjs";
import { URLS, startWa } from "./whatsapp-248-ortak.mjs";

const QUEUE_SQL = /FROM wa_(?:jobs j JOIN wa_batches b|batches b JOIN wa_jobs j)[\s\S]*b\.state IN \('running', 'paused'\)/;
// plan()'ın karttan okuduğu alanlar (lib/whatsapp/queue.mjs plan / eligibility / overdueOf; koddan sayıldı).
const elemeAlanlari = account => ({
  id: account.id,
  name: account.name,
  phone: account.phone,
  status: account.status,
  waOptOut: account.waOptOut,
  deletedAt: account.deletedAt,
  deleted_at: account.deleted_at,
  overdue: account.totals?.overdue,
  plans: (account.plans || []).map(plan => ({ status: plan.status, next: plan.next })),
  dates: (account.ledger || []).map(line => line.date),
});
const oku = (fn, ...args) => {
  try {
    return { ok: elemeAlanlari(fn(...args)) };
  } catch (error) {
    return { hata: `${error.status || ""} ${error.message}` };
  }
};

async function kur() {
  const ctx = await startWa();
  try {
    return await doldur(ctx);
  } catch (error) {
    await ctx.close();
    throw error;
  }
}
async function doldur(ctx) {
  const c = {};
  const yeni = async (anahtar, ad, telefon, ek = {}, acilis = 0) => {
    c[anahtar] = await ctx.account(ad, telefon, acilis, ek);
    return c[anahtar];
  };
  await yeni("olagan", "Olağan Bir", "0532 100 00 01", {}, 1500);
  await yeni("olagan2", "Olağan İki", "0532 100 00 02", {}, 800);
  await yeni("pasif", "Pasif Cari", "0532 100 00 03", { status: "passive" }, 300);
  await yeni("istemiyor", "İstemiyor Cari", "0532 100 00 04", { waOptOut: true }, 300);
  await yeni("telefonsuz", "Telefonsuz Cari", "", {}, 200);
  await yeni("gecersiz", "Geçersiz Telefon", "123", {}, 200);
  await yeni("yurtdisi", "Yurt Dışı Telefon", "+44 20 7946 0958", {}, 200);
  await yeni("sabit", "Sabit Hat", "0212 555 01 02", {}, 200);
  await yeni("ayniA", "Aynı Telefon A", "0532 100 00 09", {}, 100);
  await yeni("ayniB", "Aynı Telefon B", "0532 100 00 09", {}, 100);
  await yeni("hareketsiz", "Hareketsiz Cari", "0532 100 00 10");
  await yeni("ileri", "İleri Tarihli Cari", "0532 100 00 11");
  await yeni("taksitli", "Taksitli Gecikmiş", "0532 100 00 12");
  await yeni("kapsayan", "Mevcut Borcu Taksitli", "0532 100 00 13", {}, 900);
  await yeni("silinen", "Silinen Cari", "0532 100 00 14");
  // Hareketler: tahsilat, ileri tarihli borç, iki taksit kartı (biri yeni borç, biri mevcut borcu taksitlendiren), silinen cari.
  const hareket = async (id, govde) => {
    const r = await ctx.api.post(`/api/workspace/accounts/${id}/entries`, govde);
    assert.equal(r.status, 200, `hareket: ${JSON.stringify(r.data).slice(0, 300)}`);
  };
  await hareket(c.olagan.id, { kind: "in", amount: "250", date: "2026-11-02", method: "cash" });
  for (const [anahtar, govde] of [
    ["taksitli", { name: "Taksit", total: "3000", count: 3, firstDue: "2026-11-15", startDate: "2026-11-03" }],
    ["kapsayan", { name: "Mevcut Borç", total: "900", count: 3, firstDue: "2026-11-20", startDate: "2026-11-03", coversBalance: true }],
  ]) {
    const r = await ctx.api.post("/api/workspace/plans", { accountId: c[anahtar].id, ...govde });
    assert.equal(r.status, 200, `taksit kartı: ${JSON.stringify(r.data).slice(0, 300)}`);
  }
  assert.equal((await ctx.api.del(`/api/workspace/accounts/${c.silinen.id}`)).status, 200, "silinen cari silinemedi");
  // İleri tarihli hareket (programda bugünden ileri tarih girilemez): saat 30.12.2026'ya alınıp borç o güne yazılır, sonra saat 22.12.2026'ya döner — kaydın tek
  // satırı "bugünden" sonradır (saat geri alınmış / geri yüklenmiş veri durumu). Vadeler geçer: taksitlinin iki, kapsayanın iki taksiti gecikmiş.
  ctx.clock.set("2026-12-30T10:00:00+03:00");
  await hareket(c.ileri.id, { kind: "debt", amount: "700", date: "2026-12-30" });
  ctx.clock.set("2026-12-22T10:00:00+03:00");
  const user = ctx.store.get("SELECT id, username, display_name, role FROM users WHERE username = 'admin'");
  const ids = [...Object.values(c).map(a => a.id), "olmayan-cari-kimligi"];
  return { ctx, c, user, ids };
}

describe("2.4.8 İş Z — WhatsApp önizlemesi kartın eleme çekirdeğiyle (davranış aynen)", () => {
  it("eleme çekirdeği (waFacts) ↔ tam cari kartı (detail): her cari sınıfında plan()'ın okuduğu alanlar birebir aynı; cari kartındaki taksit özeti kartın kendi ayrıntısıyla aynı", async () => {
    const { ctx, c, user, ids } = await kur();
    try {
      const service = ctx.server.app.context.accounts;
      assert.equal(typeof service.waFacts, "function", "cari servisinde waFacts yok");
      for (const id of ids) {
        const tam = oku(service.detail, id, user);
        const cekirdek = oku(service.waFacts, id, user);
        assert.deepEqual(cekirdek, tam, `eleme alanları farklı: ${id}`);
      }
      // Silinen ve olmayan cari iki yolda da okunamaz (plan() → "Cari Silinmiş").
      assert.ok(oku(service.waFacts, c.silinen.id, user).hata && oku(service.detail, c.silinen.id, user).hata);
      // Sınıflar gerçekten kuruldu (eşitliğin boş geçmemesi): gecikmiş borç, ileri tarihli hareket, iki kart.
      const taksitli = oku(service.waFacts, c.taksitli.id, user).ok;
      assert.ok(taksitli.overdue > 0 && taksitli.plans.length === 1 && taksitli.plans[0].next, `taksitli carinin gecikmişi yok: ${JSON.stringify(taksitli)}`);
      assert.deepEqual(oku(service.waFacts, c.ileri.id, user).ok.dates, ["2026-12-30"]);
      assert.deepEqual(oku(service.waFacts, c.hareketsiz.id, user).ok.dates, []);
      assert.equal(oku(service.waFacts, c.istemiyor.id, user).ok.waOptOut, 1);
      // Cari kartı (GET) → taksit kartı özeti = kartın kendi ayrıntısı (GET /plans/:id) alan alan (plan eşlemesi ortak yardımcıda; M5 bunu bozar).
      for (const anahtar of ["taksitli", "kapsayan"]) {
        const kart = (await ctx.api.get(`/api/workspace/accounts/${c[anahtar].id}`)).data.data;
        assert.equal(kart.plans.length, 1);
        const ozet = kart.plans[0];
        const plan = (await ctx.api.get(`/api/workspace/plans/${ozet.id}`)).data.data;
        assert.deepEqual(Object.keys(ozet).sort(), ["coversBalance", "id", "itemCount", "name", "next", "refNo", "registeredOn", "state", "status", "total", "totals"].sort());
        // 2.5.0 Ç5-B (bilerek güncellendi; BİRLEŞİM KURALI "WhatsApp eski alanı Ç5-C'ye kadar okur"): Taksitler ekranı (GET /plans/:id) taksit kalanını, durumu, sıradakini
        // ve gecikmişi Tek Yükümlülük Kuyruğu'ndan gösterir (S50); cari kartının taksit özeti (WhatsApp'ın plan() okuması) kartın KENDİ hesabında kalır. Eşitlik kartın
        // kendi alanlarında aranır: kimlik alanları + kendi toplamları (kuyruk alanları çıkarılır, gecikmiş = ownOverdue). Durum / sıradaki / gecikmiş adedi Ç5-C'de birleşir.
        const omit = (obj, keys) => Object.fromEntries(Object.entries(obj).filter(([key]) => !keys.includes(key)));
        assert.equal(ozet.totals.overdue, plan.totals.ownOverdue, `${anahtar}: cari kartındaki taksit özetinin gecikmişi = kartın kendi gecikmişi`);
        assert.deepEqual(omit(ozet.totals, ["overdue", "overdueCount"]), omit(plan.totals, ["queueRemaining", "accountPaid", "ownOverdue", "overdue", "overdueCount"]), `${anahtar}: cari kartındaki taksit özetinin toplamları = kartın kendi toplamları`);
        const ozetKimlik = omit(ozet, ["state", "next", "totals"]);
        assert.deepEqual(ozetKimlik, { id: plan.id, name: plan.name, refNo: plan.refNo, status: plan.status, itemCount: plan.items.length, registeredOn: plan.registeredOn, total: plan.total, coversBalance: Boolean(plan.coversBalance) }, `${anahtar}: cari kartındaki taksit özeti kartın ayrıntısıyla aynı değil`);
      }
      assert.equal((await ctx.api.get(`/api/workspace/accounts/${c.kapsayan.id}`)).data.data.plans[0].coversBalance, true);
    } finally {
      await ctx.close();
    }
  });

  it("önizlemenin eleme nedenleri sınıf tanımından; önizleme ve açma kişi başı tam kart OKUMAZ, gönderim anı okur; 'Zaten Kuyrukta' tek sorgu (süren VE duraklatılmış iş)", async () => {
    const { ctx, c, ids } = await kur();
    try {
      const service = ctx.server.app.context.accounts;
      const detail = service.detail;
      let kartOkuma = 0;
      service.detail = (...args) => {
        kartOkuma += 1;
        return detail.apply(service, args);
      };
      const store = ctx.store;
      const all = store.all;
      let kuyrukSorgusu = 0;
      store.all = function (sql, ...args) {
        if (QUEUE_SQL.test(String(sql))) kuyrukSorgusu += 1;
        return all.call(this, sql, ...args);
      };
      const nedenler = async govde => {
        const r = await ctx.api.post(URLS.preview, govde);
        assert.equal(r.status, 200, `önizleme: ${JSON.stringify(r.data).slice(0, 300)}`);
        return Object.fromEntries(r.data.data.people.map(p => [p.id, p.skip]));
      };
      // Sınıf tanımı (plan §7a 1, 2, 6, 20; K1 A sabit hat / yurt dışı elenmez; K2 A aynı telefon iki ileti).
      const beklenenEkstre = {
        [c.olagan.id]: "", [c.olagan2.id]: "", [c.pasif.id]: "Pasif Cari", [c.istemiyor.id]: "WhatsApp Mesajı İstemiyor", [c.ayniA.id]: "", [c.ayniB.id]: "",
        [c.hareketsiz.id]: "", [c.ileri.id]: "", [c.taksitli.id]: "", [c.kapsayan.id]: "", [c.silinen.id]: "Cari Silinmiş", "olmayan-cari-kimligi": "Cari Silinmiş",
        [c.yurtdisi.id]: "", [c.sabit.id]: "",
      };
      // Yapısal sayım her önizlemede: tam kart okuması (accounts.detail) ve "Zaten Kuyrukta" sorgusu. Eski kodda ikisi de kişi sayısı kadardı.
      const sayim = [];
      const say = async (etiket, govde) => {
        const kart0 = kartOkuma;
        kuyrukSorgusu = 0;
        const n = await nedenler(govde);
        sayim.push({ etiket, tamKartOkuma: kartOkuma - kart0, kuyrukSorgusu });
        return n;
      };
      for (const donem of [{ preset: "lastMonth" }, { preset: "thisMonth" }, { preset: "last3" }, { preset: "all" }, { from: "2026-11-01", to: "2026-11-30" }]) {
        const n = await say(JSON.stringify(donem), { kind: "statement", ids, ...donem });
        for (const [id, neden] of Object.entries(beklenenEkstre)) assert.equal(n[id], neden, `${JSON.stringify(donem)} ${id}: ${n[id]} ≠ ${neden}`);
        assert.ok(n[c.telefonsuz.id] && n[c.gecersiz.id], `telefonsuz / geçersiz telefon elenmedi: ${n[c.telefonsuz.id]} / ${n[c.gecersiz.id]}`);
      }
      // Ödeme Hatırlatma: yalnız vadesi geçmiş taksiti olan cariler (taksitli + mevcut borcu taksitli) gider; borcu taksitsiz olan "Gecikmiş Borç Yok".
      const h = await say("reminder", { kind: "reminder", ids });
      assert.equal(h[c.taksitli.id], "");
      assert.equal(h[c.kapsayan.id], "");
      for (const anahtar of ["olagan", "olagan2", "hareketsiz", "ileri", "ayniA"]) assert.equal(h[c[anahtar].id], "Gecikmiş Borç Yok", `${anahtar} hatırlatmada`);
      assert.deepEqual(sayim, sayim.map(({ etiket }) => ({ etiket, tamKartOkuma: 0, kuyrukSorgusu: 1 })), `önizleme kişi başı okuyor (beklenen her önizlemede tam kart 0, "Zaten Kuyrukta" sorgusu 1): ${JSON.stringify(sayim)}`);
      // Açma: tam kart okunmaz; açılan işin kişileri "Zaten Kuyrukta" olur — süren de duraklatılmış da (§7a 9).
      const acilan = await ctx.batch({ kind: "statement", ids: [c.olagan.id, c.ayniA.id, c.taksitli.id], preset: "thisMonth", requestId: "isz-test-1" });
      assert.equal(acilan.status, 200, JSON.stringify(acilan.data).slice(0, 300));
      assert.equal(kartOkuma, 0, `toplu iş açma kişi başı tam cari kartı okudu: ${kartOkuma} çağrı (beklenen 0)`);
      let n = await nedenler({ kind: "statement", ids, preset: "thisMonth" });
      assert.equal(n[c.olagan.id], "Zaten Kuyrukta");
      assert.equal(n[c.ayniA.id], "Zaten Kuyrukta");
      assert.equal(n[c.olagan2.id], "");
      // Dar kontrol 20 DÜŞÜK-1: "Zaten Kuyrukta" yalnız AYNI türdeki işe bakar — süren EKSTRE işindeki gecikmiş borçlu kişi Ödeme Hatırlatma'da elenmez (tür süzgeci).
      const hatirlatma = await nedenler({ kind: "reminder", ids });
      assert.equal(hatirlatma[c.taksitli.id], "", `süren ekstre işindeki kişi Ödeme Hatırlatma'da elendi: ${hatirlatma[c.taksitli.id]}`);
      assert.equal((await ctx.api.post(`${URLS.batches}/${acilan.data.data.batch.id}/pause`, {})).status, 200);
      n = await nedenler({ kind: "statement", ids, from: "2026-12-01", to: "2026-12-22" });
      assert.equal(n[c.olagan.id], "Zaten Kuyrukta", "duraklatılmış işteki kişi 'Zaten Kuyrukta' değil (S1b: Özel = Bu Ay)");
      assert.equal(n[c.olagan2.id], "");
      // Gönderim anı (dokunulmayan yol) tam kartı okur.
      assert.equal((await ctx.api.post(`${URLS.batches}/${acilan.data.data.batch.id}/resume`, {})).status, 200);
      await ctx.drain();
      assert.ok(kartOkuma >= 2, `gönderim anında tam kart okunmadı: ${kartOkuma}`);
      service.detail = detail;
      store.all = all;
    } finally {
      await ctx.close();
    }
  });

  it("makine defteri: 'Tüm Hareketler' R3 sorgusunun planında claim_keys kişi anahtarlarıyla tek tek yoklanmaz; Tüm ↔ Özel aralık eşliği sonuç olarak aynen", async () => {
    const { ctx, c } = await kur();
    try {
      // Sonuç (Z3 yalnız planı değiştirir): "Tüm Hareketler"le gönderilen kişiye aynı tarihli Özel aralık "Daha Önce Gönderildi" (claim_keys yolu, İş Q1/R5).
      const gonder = await ctx.batch({ kind: "statement", ids: [c.olagan.id], preset: "all", requestId: "isz-test-2" });
      assert.equal(gonder.status, 200, JSON.stringify(gonder.data).slice(0, 300));
      await ctx.drain();
      // Olağan Bir'in ilk hareketi testin girdiği 02.11.2026 tahsilatı (açılış 03.11.2026) → kişiye özel dönem 02.11.2026 – 22.12.2026.
      const r = await ctx.api.post(URLS.preview, { kind: "statement", ids: [c.olagan.id, c.olagan2.id], from: "2026-11-02", to: "2026-12-22" });
      const n = Object.fromEntries(r.data.data.people.map(p => [p.id, p.skip]));
      assert.equal(n[c.olagan.id], "Daha Önce Gönderildi", `Tüm ↔ Özel eşliği: ${n[c.olagan.id]}`);
      assert.equal(n[c.olagan2.id], "");
      const tum = await ctx.api.post(URLS.preview, { kind: "statement", ids: [c.olagan.id, c.olagan2.id], preset: "all" });
      assert.equal(Object.fromEntries(tum.data.data.people.map(p => [p.id, p.skip]))[c.olagan.id], "Daha Önce Gönderildi");
      // Plan: kişi başı anahtarlı biçim (İş Q1) — claim_keys araması (job_id, attempt) ile; period_key dizin yoklaması YOK.
      const db = new DatabaseSync(path.join(ctx.server.dataDir, WA_LEDGER_FILE), { readOnly: true });
      try {
        for (const [ad, outer, tail] of [["satır", "SELECT accountId, at, period_key AS ownKey, extra_keys AS extraKeys", ""], ["grup", "SELECT accountId, MAX(at) AS last", "GROUP BY accountId"]]) {
          const plan = db.prepare(`EXPLAIN QUERY PLAN ${SENT_BEFORE_SQL_YALNIZ_TEST(outer, tail)}`).all("s", "statement", "[]", "[]", "", "", "").map(row => String(row.detail));
          const yoklama = plan.filter(line => /^SEARCH k USING .*claim_keys.*period_key=\?/.test(line));
          assert.deepEqual(yoklama, [], `R3 (${ad}) sorgusu claim_keys'i her anahtarla ayrı yokluyor: ${yoklama.join(" | ")}`);
          assert.ok(plan.some(line => /^SEARCH k USING .*claim_keys.*\(job_id=\? AND attempt=\?\)/.test(line)), `beklenen claim_keys araması yok: ${plan.filter(l => /claim_keys/.test(l)).join(" | ")}`);
        }
      } finally {
        db.close();
      }
    } finally {
      await ctx.close();
    }
  });
});
