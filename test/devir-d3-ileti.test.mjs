// 2.5.1 D3 TUR 3 — DEVİR NEDEN DURDU: ileti düzeninin KALICI testi (kullanıcı 27.11.2026 11:39 UTC, AYNEN: "devir yapılırken bir sebeple duruyorya, nedenini kullanıcıya açıkça
// türkçe yazsın program, önerilerine ek olarak bunuda uygula."). Her durdurma nedeni onu GERÇEKTEN tetikleyen veriyle (programın API'si; API'nin üretemediği eski sürüm / göç
// durumları ham veriyle — "kaynak" sütunu) kurulur; ön izleme yanıtındaki ileti dört alanlı, değerler veriyle aynı, yasak kalıp yok. K = 31.12.2026, bugün 20.01.2027 (sahte saat).
//   (a) her neden: e-Belge (Gönderilecek W1, Listeden Silinen W2, Sonucu Belirsiz W3 — sahte EDM), Taslak T1, Bekleyen Banka İşi (ham: ay sonu komisyon işi), Açılış Olabilir
//       (ham: göçün işaretlediği eski Borç Yaz), tanımsız tablo (ham), Defter Mutabakatı + plan sorunu (kural kancası: W1'in maddesine 120 / 600 500,00 TL), ön izleme reddi
//       (31.12 olmayan / gelecek yıl / seçenek), beklenmeyen hata (ham: okuyucunun okuduğu sütun yok) — "Verileriniz değişmedi."
//   (b) nedenler birlikte, sıra kararlı (iki koşu aynı); (c) yalnız uyarı varken geçilebilir; (d) kaynak tarayan denetim (yardımcıyı atlayan yol kırılır; /\r?\n/ — ders 27);
//   (e) Devir Raporu: "Devri Durduran Nedenler" ve "Uyarılar" iki ayrı başlık, ekran = Excel = PDF aynı cümleler.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, describe, it } from "node:test";
import { resetEdmCaches } from "../server/lib/einvoice/edm.mjs";
import { OUR_VKN, startMockEdm } from "./einvoice-mock.mjs";
import { apiOf, boot, must, pdfText, rawRun, xlsxSheets } from "./banka-210-ortak.mjs";
import { loginAdmin, startTestServer } from "./helpers.mjs";
import { katalogaYaz } from "./fixtures/devir-d3-ileti-katalog.mjs";

const iletiModule = await import("../server/lib/devir/iletiler.mjs").catch(() => null);
const K = "2026-12-31";
const SELLER = { name: "Deneme Ofis Ltd.", taxNo: OUR_VKN, taxOffice: "Çankaya", address: "Atatürk Blv. 1", district: "Çankaya", city: "Ankara", email: "bilgi@deneme.com.tr" };
const PERSON = { name: "Ayşe Demir", type: "customer", partyKind: "person", firstName: "Ayşe", familyName: "Demir", taxNo: "10000000078", city: "İzmir", address: "Karşıyaka 9", district: "Karşıyaka", email: "ayse@example.com" };
const FIELDS = ["kod", "seviye", "baslik", "neOldu", "neden", "neYapmali", "nereye", "metin"];

async function waitPreview(api, body) {
  const started = await must("ön izleme", api.post("/api/admin/devir/preview", body));
  for (let i = 0; i < 600; i += 1) {
    const job = await must("ön izleme durumu", api.get(`/api/admin/devir/preview/${started.id}`));
    if (job.state !== "running") return job;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error("ön izleme bitmedi");
}
/** Dört alan dolu, yasak kalıp yok (iletiler.mjs iletiDenetimi), metin dört alanın birleşimi. */
function fourFields(ileti, label) {
  for (const field of FIELDS) assert.ok(ileti[field] !== undefined && ileti[field] !== "", `${label}: ${field} boş`);
  assert.ok(Array.isArray(ileti.neYapmali) && ileti.neYapmali.length >= 1, `${label}: adım yok`);
  assert.ok(ileti.nereye.ekran && ileti.nereye.hedef, `${label}: nereye`);
  assert.ok(iletiModule, "ileti yardımcısı (iletiler.mjs) yok");
  assert.deepEqual(iletiModule.iletiDenetimi(ileti), [], `${label}: yasak kalıp / boş alan`);
  for (const part of [ileti.neOldu, ileti.neden, ...ileti.neYapmali]) assert.ok(ileti.metin.includes(part.replace(/[.]$/, "")), `${label}: metin "${part}" içermiyor`);
  assert.ok(ileti.metin.includes(ileti.nereye.ekran), `${label}: metin gidilecek yeri söylemiyor`);
  assert.deepEqual(ileti.git, ileti.nereye, `${label}: git = nereye (eski okuyucular)`);
}
const fingerprint = store => JSON.stringify(["invoices", "account_entries", "bank_jobs", "settings", "audit_events", "ledger_snapshot_runs"].map(table => store.get(`SELECT COUNT(*) AS n, COALESCE(MAX(rowid), 0) AS m FROM ${table}`)));

describe("D3 tur 3 — (a)(b)(e) API verisiyle bütün durdurma nedenleri birlikte: dört alan, veriyle aynı değerler, kararlı sıra, Devir Raporu'nda iki başlık", () => {
  let edm;
  let server;
  let api;
  let loseSend = false;
  const ids = {};
  const fetchImpl = async (input, init) => {
    const url = String(typeof input === "string" || input instanceof URL ? input : input.url);
    if (!url.startsWith("http://127.0.0.1")) throw new Error(`ağa çıkılmaz (test): ${url}`);
    const response = await globalThis.fetch(input, init);
    if (loseSend && /SendInvoiceRequest/.test(String(init?.body || ""))) {
      loseSend = false;
      await response.text();
      throw Object.assign(new TypeError("fetch failed"), { cause: Object.assign(new Error("socket hang up"), { code: "ECONNRESET" }) });
    }
    return response;
  };
  let jobs = [];
  before(async () => {
    resetEdmCaches();
    edm = await startMockEdm();
    server = await startTestServer({ edocEnabled: true, fetchImpl, now: { time: "2026-11-01T10:00:00+03:00", fixed: true } });
    api = apiOf(await loginAdmin(server));
    await must("ayarlar", api.put("/api/workspace/invoices/settings", { seller: SELLER, efatura: true, earsiv: true, integrator: { env: "test", baseUrl: edm.url, username: "edmkullanici", password: "Gizli-Parola-1", senderAlias: "urn:mail:defaultgb@deneme.com.tr" } }));
    ids.p = (await must("kişi", api.post("/api/workspace/accounts", PERSON))).id;
    // Açılış Olabilir (S-2): eski sürümden gelen "Açılış…" açıklamalı Borç Yaz'ı göç (KG-16) aday işaretler — API bu işareti yazmaz, ham veriyle (göç benzetimi).
    await must("Borç Yaz", api.post(`/api/workspace/accounts/${ids.p}/entries`, { kind: "debt", amount: "250", date: "2026-11-01", note: "Açılış bakiyesi" }));
    rawRun(server.app.db, "UPDATE account_entries SET opening_review = 'candidate' WHERE account_id = ? AND note = 'Açılış bakiyesi'", ids.p);
    const sale = (label, issueDate, extra = {}) => must(label, api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: ids.p, issueDate, lines: [{ name: "Danışmanlık", qty: 1, unitPrice: 1000, vatRate: 20 }], payment: { rest: "open" }, ...extra }));
    server.clock.set("2026-12-15T10:00:00+03:00");
    ids.t1 = (await sale("T1", "2026-12-15", { status: "draft" })).id;
    server.clock.set("2026-12-31T10:00:00+03:00");
    ids.w3 = (await sale("W3", "2026-12-31", { eSend: "later" })).id;
    loseSend = true;
    await api.post(`/api/workspace/invoices/${ids.w3}/send`, {});
    ids.w1 = (await sale("W1", "2026-12-31", { eSend: "later" })).id;
    ids.w2 = (await sale("W2", "2026-12-31", { eSend: "later" })).id;
    await must("W2 listeden sil", api.post(`/api/workspace/invoices/${ids.w2}/withdraw`, {}));
    // Bekleyen Banka İşi: ay sonu komisyon faturası işi (lib/bank/pos.mjs comm-invoice) — POS kurulumu yerine ham veri.
    rawRun(server.app.db, "INSERT INTO bank_jobs (id, kind, due_date, ref, payload_json, status, created_by, created_at) VALUES ('bjob-test-1', 'comm-invoice', '2026-12-31', 'pos-test', '{}', 'pending', 'admin', '2026-12-31T10:00:00.000Z')");
    // Tanımsız tablo (yeni sürümün tablosu / yarım göç): okuyucunun sınıflandırmadığı tablo.
    server.app.db.exec("CREATE TABLE yarim_goc_tablosu (id TEXT PRIMARY KEY)");
    server.clock.set("2027-01-20T10:00:00+03:00");
    jobs = [await waitPreview(api, { company: "sirket-001", cutoff: K }), await waitPreview(api, { company: "sirket-001", cutoff: K })];
  });
  after(async () => {
    await server?.close();
    await edm?.close?.();
  });

  it("(a) her DURDURUR nedeni dört alanlı; sayı / belge no / tarih veri tabanıyla aynı", () => {
    const job = jobs[0];
    assert.equal(job.state, "done", JSON.stringify(job.error));
    const stop = job.result.onDenetim.durdurur;
    assert.deepEqual(stop.map(row => row.kod), ["e-belge-bekleyen", "e-belge-listeden-silinen", "e-belge-belirsiz", "taslak-fatura", "banka-isi", "acilis-olabilir", "plan-siniflandirilmamis-tablo"]);
    for (const row of stop) {
      fourFields(row, row.kod);
      katalogaYaz("devir-d3-ileti", "(a) API verisi: W1 / W2 / W3 / T1 + ham banka işi, Açılış Olabilir, tanımsız tablo; K 31.12.2026, bugün 20.01.2027", row, ["banka-isi", "acilis-olabilir", "plan-siniflandirilmamis-tablo"].includes(row.kod) ? "ham veri (eski sürüm / göç benzetimi)" : "API");
    }
    const db = server.app.store;
    // Örnek belge: numara (yoksa "numarasız belge") — cari, tarih, tutar (1.000 + %20 KDV = 1.200,00 TL; elle).
    const sampleOf = id => `${(db.get("SELECT number FROM invoices WHERE id = ?", id).number || "numarasız belge").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} — Ayşe Demir, 31\\.12\\.2026, 1\\.200,00 TL`;
    const by = Object.fromEntries(stop.map(row => [row.kod, row]));
    assert.match(by["e-belge-bekleyen"].neOldu, new RegExp(`^31\\.12\\.2026 ve öncesi tarihli 1 e-Belge Gönderilecekler'de bekliyor \\(ör\\. ${sampleOf(ids.w1)}\\)\\.$`));
    assert.match(by["e-belge-listeden-silinen"].neOldu, new RegExp(`1 e-Belge Listeden Sil .* \\(ör\\. ${sampleOf(ids.w2)}\\)`));
    assert.match(by["e-belge-belirsiz"].neOldu, new RegExp(`^1 e-Belgenin gönderim sonucu henüz belli değil \\(ör\\. ${sampleOf(ids.w3)}\\)\\.$`));
    assert.match(by["taslak-fatura"].neOldu, /^31\.12\.2026 ve öncesi tarihli 1 taslak fatura var \(ör\. numarasız belge — Ayşe Demir, 15\.12\.2026, 1\.200,00 TL\)\.$/);
    assert.equal(db.get("SELECT COUNT(*) AS n FROM bank_jobs WHERE status = 'pending'").n, 1);
    assert.match(by["banka-isi"].neOldu, /^1 banka \/ POS işi bekliyor/);
    assert.equal(db.get("SELECT COUNT(*) AS n FROM account_entries WHERE opening_review = 'candidate'").n, 1);
    assert.match(by["acilis-olabilir"].neOldu, /^31\.12\.2026 ve öncesi tarihli 1 kayıt "Açılış Olabilir" listesinde onay bekliyor\.$/);
    // Adımlar ve gidilecek yer
    assert.deepEqual(by["e-belge-belirsiz"].neYapmali.slice(0, 2), ["Faturalar'da belgeyi açın.", "Durum Sorgula ile sonucunu öğrenin."]);
    assert.equal(by["e-belge-bekleyen"].nereye.ekran, "Faturalar › Gönderilecekler");
    assert.equal(by["plan-siniflandirilmamis-tablo"].metin.includes("yarim_goc_tablosu"), false, "tablo adı (iç ad) kullanıcıya gitmez");
    assert.equal(by["plan-siniflandirilmamis-tablo"].ayrinti.tablo, "yarim_goc_tablosu", "makine alanında kalır");
    assert.equal(job.result.onDenetim.gecebilir, false);
  });

  it("(a) UYARIR maddeleri de dört alanlı; uyarılar durdururla karışmaz", () => {
    const warn = jobs[0].result.onDenetim.uyarir;
    assert.deepEqual(warn.map(row => row.kod), ["aralik-mahsubu", "yeniden-baslatma", "erken-devir"]);
    for (const row of warn) {
      fourFields(row, row.kod);
      assert.equal(row.seviye, "uyarir");
      katalogaYaz("devir-d3-ileti", "(a) uyarılar: Aralık mahsubu yok, 001, bugün 20.01.2027", row);
    }
    assert.match(warn[2].neOldu, /^Son işlem tarihinin üzerinden 20 gün geçti\.$/);
    for (const row of jobs[0].result.onDenetim.durdurur) assert.equal(row.seviye, "durdurur");
  });

  it("(b) iki ön izleme: nedenler ve sıraları bayt bayt aynı", () => {
    assert.equal(JSON.stringify(jobs[1].result.onDenetim), JSON.stringify(jobs[0].result.onDenetim));
  });

  it("(e) Devir Raporu: 'Devri Durduran Nedenler' ve 'Uyarılar' ayrı başlıklar; ekran = Excel = PDF aynı cümleler", async () => {
    const job = jobs[0];
    const rapor = job.result.rapor;
    const expect = (list, levelWord) => list.flatMap(row => [[row.baslik, `Ne Oldu: ${row.neOldu}`], [row.baslik, `${levelWord}: ${row.neden}`], [row.baslik, `Ne Yapmalı: ${row.neYapmali.map((step, index) => `(${index + 1}) ${step}`).join(" ")}`], [row.baslik, `Nereye: ${row.nereye.ekran}`]]);
    const section = name => rapor.rows.filter(row => row[0] === name).map(row => [row[1], row[2]]);
    assert.deepEqual(section("Devri Durduran Nedenler"), expect(job.result.onDenetim.durdurur, "Neden Duruyor"));
    assert.deepEqual(section("Uyarılar"), expect(job.result.onDenetim.uyarir, "Neden Önemli"));
    const xlsx = await api.raw("GET", `/api/admin/devir/preview/${job.id}/report.xlsx`);
    assert.equal(xlsx.status, 200);
    const sheet = xlsxSheets(xlsx.buffer)["Devir Raporu"];
    const header = sheet.findIndex(row => row[0] === "Bölüm");
    const body = sheet.slice(header + 1).filter(row => row.length && row[0]);
    for (const name of ["Devri Durduran Nedenler", "Uyarılar"]) assert.deepEqual(body.filter(row => row[0] === name).map(row => [String(row[1]), row[2]]), section(name), `Excel ${name}`);
    const pdf = await api.raw("GET", `/api/admin/devir/preview/${job.id}/report.pdf`);
    assert.equal(pdf.status, 200);
    const flat = pdfText(pdf.buffer).replace(/\s+/g, "");
    for (const name of ["Devri Durduran Nedenler", "Uyarılar"]) for (const [, sentence] of section(name)) assert.ok(flat.includes(sentence.replace(/\s+/g, "")), `PDF'te yok: ${sentence}`);
  });
});

describe("D3 tur 3 — (a) Defter Mutabakatı (kural kancası; ön izlemenin aynı işlevi, iş parçacığısız)", () => {
  const rule = { on: false, id: "" };
  // YALNIZ TEST kancası (test/c6h-bilanco-uc deseni): açıkken W1'in maddesine B 120 / A 600 500,00 TL eklenir — Ana Defter alt defterle (cari bakiyesi) tutmaz.
  rule.fn = entries => (!rule.on ? entries : entries.map(entry => (!entry.id.includes(rule.id) ? entry : { ...entry, lines: [...entry.lines.map(line => (line.account === "600" ? { ...line, credit: line.credit + 50000 } : line.account === "120" ? { ...line, debit: line.debit + 50000 } : line))] })));
  let ctx;
  let out;
  before(async () => {
    ctx = await boot({ now: { time: "2027-02-10T12:00:00+03:00", fixed: true }, __testLedgerRule: rule });
    const c = (await must("cari", ctx.api.post("/api/workspace/accounts", { name: "Mutabakat Müşterisi", type: "customer" }))).id;
    rule.id = (await must("satış", ctx.api.post("/api/workspace/invoices", { kind: "sale", accountId: c, issueDate: "2026-06-10", lines: [{ name: "Hizmet", qty: 1, unitPrice: 1000, discountRate: 0, vatRate: 0 }], payment: { cash: [], cheques: [], endorse: [], rest: "open" }, force: true }))).id;
    rule.on = true;
    const worker = await import("../server/lib/devir/plan-worker.mjs");
    out = worker.runPreview({ store: ctx.app.store, ledger: ctx.app.context.ledger, job: { K, today: "2027-02-10", option: "borc-alacak", company: null, isRoot: true } });
  });
  after(() => ctx?.server.close());

  it("Defter Mutabakatı DURDURUR (120 farkı 500,00 TL; dört alan)", () => {
    const stop = out.onDenetim.durdurur;
    const rec = stop.find(row => row.kod === "defter-mutabakati");
    assert.ok(rec, stop.map(row => row.kod).join(", "));
    assert.match(rec.neOldu, /120 Alıcılar \(Müşteri Carileri\): fark -?500,00 TL/);
    for (const row of stop) {
      fourFields(row, row.kod);
      katalogaYaz("devir-d3-ileti", "(a) kural kancası: W1 maddesine B 120 / A 600 500,00 TL (Ana Defter ≠ cari bakiyesi); K 31.12.2026", row, "API + test kancası");
    }
  });
});

describe("D3 tur 3 — (a) planın kendi sorunları (program tutarlı veride üretmez — OLGU düzeyinde, her sorun türü): cari adı, hesap, iki tutar", () => {
  it("her plan sorunu ve değişmez dört alanlı; tutarlar sorundaki sayılarla aynı", async () => {
    const { problemIletisi } = await import("../server/lib/devir/preflight.mjs");
    const names = new Map([["account-1", "Kural Müşterisi"]]);
    const cases = [
      [{ kod: "yil-kapanmis", yil: "2026" }, /2026 yılı için Kapanış Fişi zaten yazılmış/],
      [{ kod: "donem-sonucu-farki", yil: "2026", beklenenMinor: 120000, bulunanMinor: 100000 }, /Gelir Tablosu'nda 1\.200,00 TL, kapanışta 1\.000,00 TL \(fark 200,00 TL\)/],
      [{ kod: "onceki-yil-dengesiz", yil: "2025", farkMinor: 5000 }, /2025 yılının Önceki Yıl Sonucu Fişi dengede değil \(fark 50,00 TL\)/],
      [{ kod: "sonuc-hesabi-kaldi", hesaplar: [{ hesap: "600", minor: -1500 }] }, /600 Yurt İçi Satışlar \(Stok\) -15,00 TL/],
      [{ kod: "yedi-sinifi-kaldi", hesap: "760", alt: "", minor: 300 }, /760 .* \(3,00 TL\)/],
      [{ kod: "modul-farki", hesap: "120", alt: "", cari: "account-1", beklenenMinor: 400000, bulunanMinor: 0 }, /120 Alıcılar \(Müşteri Carileri\) \(Kural Müşterisi\) hesabının 31\.12\.2026 bakiyesi Ana Defter'de 4\.000,00 TL, modülün açılışında 0,00 TL \(fark 4\.000,00 TL\)/],
      [{ kod: "cari-satir-farki", cari: "account-1", hesap: "120", beklenenMinor: 70000, bulunanMinor: 50000 }, /^Kural Müşterisi carisinin devir satırları 31\.12\.2026 bakiyesini vermiyor \(bakiye 700,00 TL, satırların toplamı 500,00 TL\)\.$/],
      [{ kod: "supheli-farki", cari: "", hesap: "129", beklenenMinor: -50000, bulunanMinor: 0 }, /129 .* bakiyesi Ana Defter'de -500,00 TL, şüpheli alacak kayıtlarında 0,00 TL/],
      [{ kod: "siniflandirilmamis-tablo", tablo: "x_y" }, /tanımlı olmayan bir tablo var/],
      [{ kod: "degismez", kod2: "stok-dss", beklenenMinor: 10000, bulunanMinor: 9000 }, /153 Ticari Mallar bakiyesi \(90,00 TL\) dönem sonu stok değeriyle \(100,00 TL\) tutmuyor/],
      [{ kod: "degismez", kod2: "vergi-191", beklenenMinor: 100, bulunanMinor: 0 }, /191 İndirilecek KDV açılışı \(0,00 TL\) arşivdeki bakiyesiyle \(1,00 TL\) tutmuyor/],
    ];
    for (const [problem, pattern] of cases) {
      const ileti = problemIletisi(problem, { names, K });
      fourFields(ileti, problem.kod);
      assert.match(ileti.neOldu, pattern, problem.kod);
      katalogaYaz("devir-d3-ileti", `plan sorunu (olgu düzeyi): ${problem.kod}${problem.kod2 ? ` / ${problem.kod2}` : ""}`, ileti, "olgu (program tutarlı veride üretmez)");
    }
  });
});

describe("D3 tur 3 — (a)(c) ön izleme reddi ve beklenmeyen hata: Türkçe dört alan + 'Verileriniz değişmedi.'; yalnız uyarı varken geçilebilir", () => {
  let ctx;
  before(async () => {
    ctx = await boot({ now: { time: "2027-03-15T10:00:00+03:00", fixed: true } });
  });
  after(() => ctx?.server.close());

  it("(c) temiz şirket: DURDURUR yok, yalnız uyarı (Aralık mahsubu, 001) → geçilebilir", async () => {
    const job = await waitPreview(ctx.api, { company: "sirket-001", cutoff: K });
    assert.deepEqual(job.result.onDenetim.durdurur, []);
    assert.deepEqual(job.result.onDenetim.uyarir.map(row => row.kod), ["aralik-mahsubu", "yeniden-baslatma"]);
    assert.equal(job.result.onDenetim.gecebilir, true);
    const section = job.result.rapor.rows.filter(row => row[0] === "Devri Durduran Nedenler");
    assert.deepEqual(section, [["Devri Durduran Nedenler", "Yok", "Devri durduran neden yok.", "", "", ""]]);
  });

  it("ret: 31.12 olmayan tarih / bu yıl / geçersiz seçenek → 400, kod makine alanında, ileti dört alanlı", async () => {
    const cases = [
      [{ company: "sirket-001", cutoff: "2026-06-30" }, "DEVIR_K_31_ARALIK", /Seçilen son işlem tarihi \(30\.06\.2026\) bir yılın son günü değil/],
      [{ company: "sirket-001", cutoff: "2027-12-31" }, "DEVIR_K_GELECEK", /\(31\.12\.2027\) bu yılın ya da gelecek bir yılın sonu \(bugün 15\.03\.2027\)/],
      [{ company: "sirket-001", cutoff: K, option: "hepsi" }, "DEVIR_SECENEK", /Cari Bakiye Tipi geçerli bir seçenek değil/],
    ];
    for (const [body, code, pattern] of cases) {
      const res = await ctx.api.client.post("/api/admin/devir/preview", body);
      assert.equal(res.status, 400, code);
      assert.equal(res.data.code, code);
      const ileti = res.data.ileti;
      fourFields(ileti, code);
      assert.match(ileti.neOldu, pattern);
      assert.equal(res.data.error, ileti.metin, `${code}: kullanıcıya giden metin ileti`);
      assert.ok(ileti.metin.endsWith("Verileriniz değişmedi."), code);
      katalogaYaz("devir-d3-ileti", `ön izleme reddi: ${JSON.stringify(body)}`, ileti);
    }
  });

  it("beklenmeyen hata (okuyucunun okuduğu sütun yok — ham veri): Türkçe cümle + 'Verileriniz değişmedi.'; ham ileti yanıta girmez; veri aynı", async () => {
    ctx.store.exec("ALTER TABLE invoice_repeats RENAME COLUMN next_date TO sonraki_gun");
    const before = fingerprint(ctx.store);
    try {
      const job = await waitPreview(ctx.api, { company: "sirket-001", cutoff: K });
      assert.equal(job.state, "failed");
      fourFields(job.error.ileti, "beklenmeyen-hata");
      assert.equal(job.error.message, job.error.ileti.metin);
      assert.ok(job.error.message.endsWith("Verileriniz değişmedi."), job.error.message);
      assert.doesNotMatch(JSON.stringify(job), /no such column|next_date|SqliteError|at \S+ \(/);
      assert.equal(fingerprint(ctx.store), before, "veri değişmedi");
      katalogaYaz("devir-d3-ileti", "beklenmeyen hata: okuyucunun okuduğu sütun yok (ham veri)", job.error.ileti, "ham veri");
      const report = await ctx.api.client.get(`/api/admin/devir/preview/${job.id}/report.pdf`);
      assert.equal(report.status, 409);
      fourFields(report.data.ileti, "devir-preview-running");
      katalogaYaz("devir-d3-ileti", "Devir Raporu istendi, ön izleme tamamlanamadı", report.data.ileti);
    } finally {
      ctx.store.exec("ALTER TABLE invoice_repeats RENAME COLUMN sonraki_gun TO next_date");
    }
    const missing = await ctx.api.client.get("/api/admin/devir/preview/onizleme-yok");
    assert.equal(missing.status, 404);
    fourFields(missing.data.ileti, "devir-preview-not-found");
    katalogaYaz("devir-d3-ileti", "bilinmeyen ön izleme kimliği", missing.data.ileti);
  });
});

describe("D3 tur 3 — (d) kaynak tarayan denetim: durdurma / uyarı / ret yolu ileti yardımcısını atlayamaz (satır bölme /\\r?\\n/ — ders 27)", () => {
  const read = file => readFileSync(new URL(`../${file}`, import.meta.url), "utf8").split(/\r?\n/);
  it("preflight.mjs: stop / warn listesine yalnız devirIletisi ya da problemIletisi girer; ham 'metin:' yok", () => {
    assert.ok(iletiModule, "D3 tur 3 ileti yardımcısı yok (eski kod)");
    const lines = read("server/lib/devir/preflight.mjs");
    const pushes = lines.map((line, index) => [index + 1, line]).filter(([, line]) => /\b(stop|warn)\.push\(/.test(line));
    assert.ok(pushes.length >= 3, "denetim noktası bulunamadı");
    for (const [no, line] of pushes) assert.match(line, /(devirIletisi|problemIletisi)\(/, `preflight.mjs:${no} yardımcıyı atlıyor: ${line.trim()}`);
    for (const [no, line] of lines.map((line, index) => [index + 1, line.replace(/\/\/.*$/, "")])) assert.doesNotMatch(line, /\bmetin\s*:/, `preflight.mjs:${no} ham metin alanı: ${line.trim()}`);
  });
  it("routes/devir.mjs ön izleme bölümü: HttpError yalnız refuse() ile; başarısız işin iletisi ham hata iletisi değil", () => {
    assert.ok(iletiModule, "D3 tur 3 ileti yardımcısı yok (eski kod)");
    const lines = read("server/routes/devir.mjs");
    const start = lines.findIndex(line => line.includes("2.5.1 D3: ön izleme işleri"));
    const end = lines.findIndex((line, index) => index > start && line.includes('"/api/admin/maintenance"'));
    assert.ok(start > 0 && end > start, "bölüm bulunamadı");
    const section = lines.slice(start, end).map((line, index) => [start + index + 1, line]);
    const http = section.filter(([, line]) => /new HttpError\(/.test(line));
    assert.equal(http.length, 1, http.map(([no, line]) => `${no}: ${line.trim()}`).join("\n"));
    assert.match(http[0][1], /const refuse = \(status, ileti\) => new HttpError\(status, ileti\.metin, \{ code: ileti\.kod, ileti \}\)/);
    for (const [no, line] of section) assert.doesNotMatch(line, /message:\s*error\.message|error\.message\s*:/, `devir.mjs:${no} ham hata iletisi yanıta`);
  });
  it("devir modüllerinde iletiler.mjs dışında seviye / metin nesnesi kurulmaz", () => {
    assert.ok(iletiModule, "D3 tur 3 ileti yardımcısı yok (eski kod)");
    for (const file of ["server/lib/devir/plan.mjs", "server/lib/devir/plan-reader.mjs", "server/lib/devir/report.mjs", "server/lib/devir/plan-worker.mjs", "server/routes/devir.mjs"]) {
      for (const [no, line] of read(file).map((line, index) => [index + 1, line.replace(/\/\/.*$/, "")])) assert.doesNotMatch(line, /seviye:\s*"(durdurur|uyarir)"|\bmetin\s*:/, `${file}:${no}: ${line.trim()}`);
    }
  });
  it("iletiDenetimi yasak kalıpları yakalar (dişi)", () => {
    assert.ok(iletiModule, "D3 tur 3 ileti yardımcısı yok (eski kod)");
    const good = iletiModule.devirIletisi({ kod: "x", baslik: "Deneme", neOldu: "Bir şey oldu", neden: "Çünkü", neYapmali: ["Şunu yapın"], nereye: iletiModule.DEVIR_TARGETS.faturalar });
    assert.deepEqual(iletiModule.iletiDenetimi(good), []);
    for (const bad of ["Tutar undefined", "null kayıt", "NaN TL", "[object Object]", "Error: failed", "2026-12-31 tarihli", "12.50 TL", "plan-modul-farki", "invoice_lines tablosu"]) {
      assert.notDeepEqual(iletiModule.iletiDenetimi({ ...good, neOldu: bad, metin: bad }), [], bad);
    }
  });
});
