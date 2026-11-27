// 2.5.0 Ç5-K tur 2 — "Kasa Açılışından Önce Tarihli Hareket" SAPMA DEĞİL UYARIDIR (dar kontrol 10.11 ORTA-1, GERİLEME; docs/erp/C5K-KASA-TASARIM.md §10).
// Karar (S20 = A "Mutabakat Testi uyarı verir"; BAŞ MİMAR 10.11 — sunum, para kuralı değil):
//   a) Yönetim › Sistem: sarı uyarı + sunucunun hint'i; başka sapma yoksa "N denetim tamam" bozulmaz (ekran: test/e2e/senaryo-kasa-acilis-uyari-250.mjs).
//   b) Defter Mutabakatı (ekran / PDF / Excel aynı): satırın durumu "Uyarı", Sonuç bu satır yüzünden "Fark Var" olmaz, "yöneticiye bildirin" çıkmaz; metin "eski
//      sürümden kalan" demez (Silinenler'den geri alınan satır da olabilir).
//   c) Kapı: familyOf("cash:before-opening") tam kapıyı tetiklemez; açılıştan sonraki ilk yazım süzgeçli yolda (scoped); uyarı "yeni sapma" günlüğü / zili üretmez —
//      sayı artarsa da.
//   d) Uyarı gerçek sapmayı gizlemez: ikisi birlikteyken sapma yine "Fark Var" / günlük / zil.
// Önceden (78855096): denetim ok:false + severity warning ama ekran ve rapor yalnız `legacy`'ye bakıyordu → "1 denetimde sapma var" (kırmızı), "Fark Var" + "yöneticiye
// bildirin"; familyOf kodu tanımıyor → "all" → açılıştan sonraki ilk nakit yazımı TAM KAPI; geri yüklemeden sonraki tarama "kapının görmediği yeni sapma" + zil.
// Ayrıca (dar kontrol DÜŞÜK-3, yaşayan mutant K14): uyarının örnek (sample) metni "Kaynak · kimlik · tarih".
// Veri programın API'sinden (Silinenler'den geri alınan açılış öncesi Kasa hareketi — Z9 yolu); sahte saat (ders 13); iki TZ'de koşulur; lisans servisi yok (ders 30).
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { familyOf } from "../server/lib/integrity-scope.mjs";
import { pdfText, xlsxRows } from "./fixtures/rapor-dosya-oku.mjs";
import { loginAdmin, removeTestDir, startTestServer } from "./helpers.mjs";

process.env.HUKUK_LICENSE_URL ||= "http://127.0.0.1:9";
const NOW = "2026-03-20T12:00:00";
const OPEN = "2026-03-10";
const AFTER = "2026-03-11";
const EARLY = "2026-03-05";
const EARLY2 = "2026-03-06";
const NAME = "Kasa Açılışından Önce Tarihli Hareket";
const CLEAN_SUBTITLE = "Tüm hesaplar tutarlı; borç toplamı alacak toplamına eşit. Her kayıt yazılmadan önce bu denetimden geçer.";

const unwrap = r => ({ status: r.status, data: r.data && typeof r.data === "object" && r.data.ok === true ? r.data.data : r.data, code: r.data?.code, error: r.data?.error, buffer: r.buffer });
const apiOf = client => ({
  client,
  get: async url => unwrap(await client.get(url)),
  post: async (url, body) => unwrap(await client.post(url, body)),
  del: async url => unwrap(await client.del(url)),
  file: async url => unwrap(await client.raw("GET", url)),
});
const must = async (label, promise) => {
  const res = await promise;
  assert.equal(res.status, 200, `${label}: ${res.status} ${res.code || ""} ${JSON.stringify(res.data).slice(0, 400)}`);
  return res.data;
};
const idOf = data => data?.id || data?.entry?.id || "";
const integrityOf = api => must("Mutabakat Testi", api.get("/api/workspace/ledger/integrity"));
const noticeOf = integrity => (integrity.checks || []).find(item => item.code === "cash:before-opening") || null;
const drifts = integrity => (integrity.failures || []).filter(item => !item.notice);
const report = api => must("Defter Mutabakatı", api.get("/api/workspace/report-center/defter-mutabakati"));
const rowOf = (data, name) => (data.rows || []).find(row => String(row[1]) === name) || null;
const resultOf = data => (data.summary || []).find(pair => pair[0] === "Sonuç")?.[1];
const dayText = iso => iso.split("-").reverse().join(".");
const capture = () => {
  const lines = [];
  return { lines, log: { debug() {}, info() {}, warn: (...a) => lines.push(`warn: ${a.join(" ")}`), error: (...a) => lines.push(`error: ${a.join(" ")}`) } };
};
/** Silinenler'den geri yükleme (Z9 yolu; S12 uygulanmaz). */
async function restoreFromTrash(api, ref) {
  const listed = await must("Silinenler", api.get("/api/admin/trash"));
  const item = (Array.isArray(listed) ? listed : listed.items || []).find(row => row.ref === ref);
  assert.ok(item, `Silinenler'de ${ref}`);
  await must(`geri yükle ${ref}`, api.post("/api/admin/trash/restore", { id: item.id }));
}

describe("Ç5-K tur 2 — temiz veri (Kasa açılışı var, açılıştan önce satır yok): değişiklik yok", () => {
  let server;
  let api;
  before(async () => {
    server = await startTestServer({ now: { time: NOW, fixed: true } });
    api = apiOf(await loginAdmin(server));
    await api.post("/api/workspace/bank/setup/dismiss", {});
    await must("Kasa açılışı", api.post("/api/workspace/cash/opening", { amount: "5.000", date: OPEN }));
    await must("Kasa Giriş (açılıştan sonra)", api.post("/api/workspace/cash", { kind: "in", amount: "100", date: AFTER, description: "sonra", method: "cash" }));
  });
  after(() => server?.close());

  it("Mutabakat Testi tutarlı, uyarı denetimi listede YOK; Defter Mutabakatı alt başlığı aynen, 'Uyarı' satırı yok, Sonuç Tutarlı", async () => {
    const integrity = await integrityOf(api);
    assert.equal(integrity.ok, true, JSON.stringify(integrity.failures).slice(0, 300));
    assert.equal(noticeOf(integrity), null);
    const data = await report(api);
    assert.equal(data.subtitle, CLEAN_SUBTITLE);
    assert.equal(data.rows.filter(row => row.at(-1) === "Uyarı").length, 0);
    assert.equal(resultOf(data), "Tutarlı");
  });
});

describe("Ç5-K tur 2 — Silinenler'den geri gelen açılış öncesi Kasa hareketi: uyarı SAPMA DEĞİL", () => {
  const root = mkdtempSync(path.join(tmpdir(), "c5k-uyari-"));
  const dataDir = path.join(root, "data");
  const backupDir = path.join(root, "backups");
  const first = capture();
  const alerts = [];
  const ids = {};
  let server;
  let api;
  before(async () => {
    // gateVerify: false → üretimdeki kapı yolu (süzgeç; tam kapı yalnız gerektiğinde) ölçülür.
    server = await startTestServer({ dataDir, backupDir, now: { time: NOW, fixed: true }, gateVerify: false, log: first.log });
    api = apiOf(await loginAdmin(server));
    await api.post("/api/workspace/bank/setup/dismiss", {});
    // Açılış yokken açılıştan önceki günlere yazılır, silinir; açılış girilir; biri Silinenler'den geri alınır (Z9) → açılış öncesi satır.
    ids.c1 = idOf(await must("Kasa Giriş 05.03", api.post("/api/workspace/cash", { kind: "in", amount: "100", date: EARLY, description: "eski giriş", method: "cash" })));
    ids.c2 = idOf(await must("Kasa Giriş 06.03", api.post("/api/workspace/cash", { kind: "in", amount: "40", date: EARLY2, description: "eski giriş 2", method: "cash" })));
    await must("sil 1", api.del(`/api/workspace/cash/${ids.c1}`));
    await must("sil 2", api.del(`/api/workspace/cash/${ids.c2}`));
    await must("Kasa açılışı", api.post("/api/workspace/cash/opening", { amount: "5.000", date: OPEN }));
    server.app.events.tap((name, payload) => {
      if (name === "integrity.alert") alerts.push(payload);
    });
    await restoreFromTrash(api, ids.c1);
  });
  after(async () => {
    await server?.close();
    removeTestDir(root);
  });

  it("Mutabakat Testi: denetim görünür (ok false, gizlenmez) ama UYARI işaretli (notice, severity warning); ne yapılacağı (hint) var, 'eski sürümden kalan' demez; örnek metni Kaynak · kimlik · tarih (K14); uyarı dışı sapma yok", async () => {
    const integrity = await integrityOf(api);
    const notice = noticeOf(integrity);
    assert.ok(notice, "uyarı denetimi listede");
    assert.deepEqual({ name: notice.name, ok: notice.ok, notice: notice.notice, severity: notice.severity, count: notice.count, opening: notice.opening }, { name: NAME, ok: false, notice: true, severity: "warning", count: 1, opening: OPEN });
    assert.match(notice.hint, /Kasa → Açılış Bakiyesi'nin tarihini öne alır; uyarı kalkar\./);
    assert.match(notice.hint, /Silinenler'den geri gelen kayıt/);
    assert.doesNotMatch(notice.hint, /eski sürümden kalan/i);
    assert.deepEqual(notice.sample, [`Kasa Hareketi ${ids.c1} · ${dayText(EARLY)}`], "örnek metni (dar kontrol K14)");
    assert.deepEqual(notice.items, [{ source: "manual", id: ids.c1, date: EARLY }]);
    assert.deepEqual(drifts(integrity).map(item => item.code), [], `uyarı dışı sapma yok: ${JSON.stringify(drifts(integrity)).slice(0, 300)}`);
    assert.ok(integrity.failures.some(item => item.code === "cash:before-opening"), "sonuçta gizlenmez (failures içinde, notice işaretli)");
  });

  it("tarama 'yeni sapma' kaydı ve zili üretmez — Mutabakat Testi (iş parçacığında da), sayı ARTINCA da (ikinci geri yükleme)", async () => {
    // Önce hepsi gözlenir, sonra tek karşılaştırma (kırmızıda bütün farklar birlikte okunur — ders 38).
    const scans = () => server.app.store.all("SELECT summary FROM integrity_log WHERE action = 'scan'").map(row => row.summary);
    const seen = { ilkTaramaGunlugu: scans() };
    await restoreFromTrash(api, ids.c2);
    seen.sayi = noticeOf(await integrityOf(api))?.count;
    const background = await server.app.integrity.scanInBackground();
    seen.isParcacigi = background?.findings?.map(item => item.code) ?? background;
    seen.taramaGunlugu = scans();
    seen.zil = alerts.map(item => item.findings.map(finding => finding.code));
    seen.sunucuGunlugu = first.lines.filter(line => /yeni sapma|sapma var/.test(line));
    assert.deepEqual(seen, { ilkTaramaGunlugu: [], sayi: 2, isParcacigi: [], taramaGunlugu: [], zil: [], sunucuGunlugu: [] }, "uyarı 'yeni sapma' sayılmaz (sayı 1 → 2 artarken de)");
  });

  it("Defter Mutabakatı (ekran verisi, PDF, Excel aynı): satır 'Uyarı'; Sonuç 'Tutarlı' (Fark Var DEĞİL); alt başlık uyarıyı ve ne yapılacağını söyler, 'yöneticiye bildirin' / 'eski sürümden kalan' demez", async () => {
    const data = await report(api);
    const row = rowOf(data, NAME);
    assert.ok(row, JSON.stringify(data.rows).slice(0, 400));
    assert.deepEqual([row[4], row.at(-1)], ["2 satır", "Uyarı"]);
    assert.equal(resultOf(data), "Tutarlı");
    assert.ok(data.subtitle.startsWith(CLEAN_SUBTITLE), data.subtitle);
    assert.match(data.subtitle, new RegExp(`Uyarı \\(yeni işlemleri engellemez\\): ${NAME} — 2 hareket \\(aşağıda “Uyarı”\\)\\.`));
    assert.match(data.subtitle, /Açılış Bakiyesi'nin tarihini öne alır/);
    assert.doesNotMatch(data.subtitle, /yöneticiye bildirin|[Ee]ski [Ss]ürümden [Kk]alan/);
    assert.equal(data.rows.filter(row => row.at(-1) === "Fark Var").length, 0);
    const pdf = await api.file("/api/workspace/report-center/defter-mutabakati/pdf");
    assert.equal(pdf.status, 200);
    const text = pdfText(pdf.buffer).replace(/\s+/g, " ");
    assert.ok(text.includes(NAME) && text.includes("Uyarı"), "PDF: uyarı satırı");
    assert.ok(!text.includes("Fark Var") && !text.includes("yöneticiye bildirin"), "PDF: Fark Var / yöneticiye bildirin yok");
    const xlsx = await api.file("/api/workspace/report-center/defter-mutabakati/xlsx");
    assert.equal(xlsx.status, 200);
    const sheet = xlsxRows(xlsx.buffer);
    const xrow = sheet.find(cells => cells[1] === NAME);
    assert.equal(xrow?.at(-1), "Uyarı", `Excel satırı: ${JSON.stringify(xrow)}`);
    assert.equal(sheet.flat().filter(cell => cell === "Fark Var").length, 0, "Excel: Fark Var yok");
  });

  it("kapı: uyarının alanı yok — familyOf('cash:before-opening') = null (tam kapıyı tetiklemez)", () => {
    assert.equal(familyOf("cash:before-opening"), null);
  });

  it("program yeniden açılınca: açılış günlüğü / sunucu günlüğü 'sapma' yazmaz; açılıştan sonraki İLK nakit yazımı süzgeçli yolda (scoped), sonrakiler de", async () => {
    await server.close();
    const second = capture();
    server = await startTestServer({ dataDir, backupDir, now: { time: NOW, fixed: true }, gateVerify: false, log: second.log });
    api = apiOf(await loginAdmin(server));
    const paths = [];
    for (const [k, date] of [AFTER, OPEN, AFTER].entries()) {
      await must(`Kasa Giriş ${k + 1}`, api.post("/api/workspace/cash", { kind: "in", amount: "1", date, description: `sonra ${k + 1}`, method: "cash" }));
      const gate = server.app.integrity.stats().gate;
      paths.push(`${gate.path}${gate.reason ? ` (${gate.reason})` : ""}`);
    }
    // Önce hepsi gözlenir, sonra tek karşılaştırma (kırmızıda bütün farklar birlikte okunur — ders 38).
    const seen = {
      sunucuGunlugu: second.lines.filter(line => /Mutabakat/.test(line)),
      mutabakatGunlugu: server.app.store.all("SELECT action, summary FROM integrity_log WHERE action = 'baseline'").filter(row => row.summary.includes(NAME)).map(row => `${row.action}: ${row.summary}`),
      kapiYolu: paths,
      uyari: noticeOf(await integrityOf(api))?.count,
    };
    assert.deepEqual(seen, { sunucuGunlugu: [], mutabakatGunlugu: [], kapiYolu: ["scoped", "scoped", "scoped"], uyari: 2 }, "yeniden açılış: günlük yok, açılıştan sonraki nakit yazımları süzgeçli yolda, uyarı sürer");
  });

  it("uyarı gerçeği GİZLEMEZ: gerçek sapma (kapının görmediği tanınmayan ödeme yolu) + uyarı → sapma 'Fark Var' + 'yöneticiye bildirin', taramada günlük + zil YALNIZ sapma için; uyarı satırı yine 'Uyarı'", async () => {
    const tapped = [];
    server.app.events.tap((name, payload) => {
      if (name === "integrity.alert") tapped.push(payload);
    });
    // Kapının görmediği yazım (store dışı, aynı bağlantı): tanınmayan ödeme yolu (inceleme-226 G4'ün yeni satırı).
    server.app.db.prepare("INSERT INTO cash_entries (id, kind, amount, date, description, method, created_by, created_at) VALUES ('cash-d2t3-yol', 'in', 10, ?, 'x', 'bitcoin', 'x', ?)").run(AFTER, new Date().toISOString());
    const integrity = await integrityOf(api);
    // Store dışı satır üç denetimde sapma: Kasa ana defteri (gl:100), tanınmayan yol, işlem başlığı yok.
    const codes = drifts(integrity).map(item => item.code);
    assert.deepEqual(codes, ["gl:100", "money:method", "money:event"], "gerçek sapmalar sonuçta (sapma, uyarı değil)");
    assert.ok(drifts(integrity).every(item => !item.notice));
    assert.equal(noticeOf(integrity)?.count, 2);
    const scans = server.app.store.all("SELECT summary FROM integrity_log WHERE action = 'scan'");
    assert.equal(scans.length, 1, JSON.stringify(scans));
    assert.match(scans[0].summary, /Tanınmayan ödeme yolu/);
    assert.doesNotMatch(scans[0].summary, new RegExp(NAME));
    assert.deepEqual(tapped.map(item => item.findings.map(finding => finding.code)), [codes], "zil yalnız gerçek sapmalar için (uyarı yok)");
    const data = await report(api);
    assert.equal(resultOf(data), "Fark Var");
    assert.match(data.subtitle, /^Fark bulunan hesap var; yöneticiye bildirin\./);
    assert.match(data.subtitle, new RegExp(`Uyarı \\(yeni işlemleri engellemez\\): ${NAME} — 2 hareket`));
    assert.equal(rowOf(data, NAME)?.at(-1), "Uyarı");
    assert.equal(data.rows.find(row => String(row[1]).startsWith("Tanınmayan ödeme yolu"))?.at(-1), "Fark Var");
  });
});
