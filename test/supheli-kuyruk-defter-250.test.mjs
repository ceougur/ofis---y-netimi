// 2.5.0 Ç5-A tur 3c — şüpheli ↔ kuyruk defter kuralı + "Normal Cari Hesaba İşle" sınırı (tasarım notu docs/erp/C5-ACILIS-TASARIM.md §19).
// KARARLAR (iş listesi D, AYNEN):
//   S14 = A: "şüpheli alacaklı caride faturaya BAĞLI alınan çek / senet bağlı faturanın durduğu hesaptan düşer (şüpheliye aktarılmış fatura 128, sonradan kesilmiş 120)."
//   S25 = A: "(a) kısmen şüpheliye aktarılmış faturaya küçük çek → önce şüpheli kısım (128), kalan 120; (b) çekin açık kısmı aşan fazlası → carinin bağsız alacağı (avans, 120); (c) nakit /
//     havale / POS ile şüpheliye aktarılmış faturaya bağlı tahsilat → S14 ile aynı (şüpheli kısım 128'den düşer)."
//   S39 = A: "şüpheli alacaklı caride faturaya bağlı Kredi Kartına İade → S25 / S14 ile aynı (önce şüpheli kısım, kalanı 120)."
//   S168 = B (13.11 20:15, "önerini uygula"): "şüpheli kaydı açık caride faturaya bağlı tahsilat, fatura şüpheli kaydından SONRA kesilmiş olsa da, faturanın kuyrukta şüpheli sayılan kısmını
//     ÖNCE şüpheli alacaktan (128) düşer, kalanı normal alacaktan (120); defterin 120 / 128 ayrımı kuyruğun dağılımını izler … S14 = A'nın 'sonradan kesilmiş fatura 120' sözü, faturanın
//     kuyrukta şüpheli sayılan kısmı YOKSA geçerlidir. Örnek: Fatura 1 1.000 → şüpheliye alma 1.000 → Fatura 2 500 (kayıttan sonra) → 400 nakit 'Normal Cari Hesaba İşle' (120 = 100,
//     128 = 1.000; şüpheli dağılımı Fatura 1 600 + Fatura 2 400) → Fatura 2'ye bağlı 300 tahsilat (çek de nakit de) KABUL, 128 = 700, 120 = 100."
//   Görev metni (ana oturum, S168'in sonucu): "'Normal Cari Hesaba İşle' sınırı YALNIZ 120'ye düşecek kısma uygulanır … 120'ye düşecek kısım şüpheli dışı borcu aşıyorsa ret AYNEN kalır
//     (ileti doğru iki tutarı söyler)"; "Fatura 2'ye bağlı 500 → 400'ü 128'den, 100'ü 120'den".
// Beklenen sayılar karar metinlerinden (programdan türetilmedi — ders 5). Tarihler göreli ve sabit sahte saatle (ders 13); fatura kronolojisi yüzünden her senaryo bir öncekinden ileri
// tarihlidir (taban günü senaryo başına 30 gün ilerler).
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { after, before, describe, it } from "node:test";
import { gunzipSync } from "node:zlib";
import { loginAdmin, removeTestDir, startTestServer } from "./helpers.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const lib = rel => pathToFileURL(path.join(HERE, "..", "server", "lib", rel)).href;
const TODAY = "2026-10-20";
const day = offset => {
  const d = new Date(`${TODAY}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
};
const unwrap = r => ({ status: r.status, data: r.data && typeof r.data === "object" && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data });
const messageOf = res => String(res.data?.error?.message || res.data?.message || res.data?.error || "");
const codeOf = res => res.data?.code ?? res.data?.error?.code;

describe("Ç5-A tur 3c: şüpheli ↔ kuyruk defter kuralı (S14, S25, S39, S168 = B) ve 'Normal Cari Hesaba İşle' sınırı", () => {
  let server;
  let api;
  let n = 0;
  let base = -900; // senaryonun taban günü (her senaryo +30)
  before(async () => {
    server = await startTestServer({ now: { time: `${TODAY}T12:00:00+03:00`, fixed: true }, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
    const client = await loginAdmin(server);
    api = { get: async u => unwrap(await client.get(u)), post: async (u, b) => unwrap(await client.post(u, b)), put: async (u, b) => unwrap(await client.put(u, b)), del: async u => unwrap(await client.del(u)) };
    await api.post("/api/workspace/bank/setup/dismiss", {});
  });
  after(async () => server?.close());
  const must = async (label, promise) => {
    const res = await promise;
    assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 400)}`);
    return res.data;
  };
  const invoice = async (acc, date, amount) => (await must("fatura", api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: acc.id, issueDate: date, lines: [{ name: "Hizmet", qty: 1, unitPrice: String(amount), vatRate: 0 }], payment: { rest: "open" } }))).id;
  const cash = (acc, date, amount, extra = {}) => api.post(`/api/workspace/accounts/${acc.id}/entries`, { kind: "in", amount: String(amount), date, method: "cash", cashForce: true, similarOk: true, ...extra });
  const cheque = (acc, date, amount, invoiceId = "") => api.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", bank: "Akbank", drawer: "X", serialNo: `SKD${(n += 1)}`, amount: String(amount), accountId: acc.id, issueDate: date, dueDate: day(60), ...(invoiceId ? { invoiceId } : {}) });
  // Senaryo: Fatura 1 1.000 (B−60) → Şüpheli Alacağa Al `rec` (B−40) → Fatura 2 500 (B−30, kayıttan SONRA) → [Normal Cari Hesaba İşle `normal` (B−20)]. Son adım B−10.
  const scenario = async (label, { rec = 1000, normal = 400, f2 = 500 } = {}) => {
    base += 30;
    const B = base;
    const acc = await must("cari", api.post("/api/workspace/accounts", { name: `Şüpheli Kuyruk ${label}`, type: "customer", registeredOn: day(-1200), phone: `0500 319 ${String(10 + Math.floor((n += 1) / 100)).padStart(2, "0")} ${String(n % 100).padStart(2, "0")}` }));
    const f1 = await invoice(acc, day(B - 60), 1000);
    const record = await must("şüpheliye al", api.post(`/api/workspace/accounts/${acc.id}/doubtful`, { amount: String(rec), date: day(B - 40), reason: "lawsuit", note: "tur 3c" }));
    const f2id = f2 ? await invoice(acc, day(B - 30), f2) : "";
    if (normal) await must("Normal Cari Hesaba İşle", cash(acc, day(B - 20), normal, { doubtfulSkip: true }));
    return { acc, f1, f2: f2id, record, at: offset => day(B + offset) };
  };
  // Defterden (yevmiye — birinci yükleyici): carinin 120 / 128 bakiyesi (TL) ve bir cari satırının alacak satırları.
  const gl = accountId => {
    const b = { 120: 0, 128: 0 };
    for (const entry of server.app.ledger.build()) for (const line of entry.lines || []) if ((line.account === "120" || line.account === "128") && line.party === accountId) b[line.account] += line.debit - line.credit;
    return { b120: b[120] / 100, b128: b[128] / 100 };
  };
  const creditsOf = entryId => {
    const entry = server.app.ledger.build().find(item => item.id === `account:${entryId}`);
    return (entry?.lines || []).filter(line => line.credit > 0).map(line => `A ${line.account} ${line.credit / 100}`).sort();
  };
  const lastEntry = async acc => {
    const card = await must("cari kartı", api.get(`/api/workspace/accounts/${acc.id}`));
    return card.entries.reduce((last, row) => (!last || String(row.createdAt) >= String(last.createdAt) ? row : last), null);
  };
  const clean = () => assert.deepEqual((server.app.integrity.scan().findings || []).map(f => f.code), [], "Mutabakat Testi bulgusuz (iki yükleyici aynı: yevmiye 128 = Σ kalan, 120 = cari)");
  const state = async () => (await import(lib("bank/doubtful.mjs"))).doubtfulState(server.app.store);

  it("S168 örneği — Fatura 2'ye bağlı 300 NAKİT: KABUL (bugün 409), 128 = 700, 120 = 100; satır A 128 300", async () => {
    const s = await scenario("S168 Nakit 300");
    assert.deepEqual(gl(s.acc.id), { b120: 100, b128: 1000 }, "ön durum (karar metni: 120 = 100, 128 = 1.000)");
    const res = await cash(s.acc, s.at(-10), 300, { invoiceId: s.f2 });
    assert.equal(res.status, 200, `KABUL bekleniyor: ${res.status} ${messageOf(res)}`);
    assert.deepEqual(gl(s.acc.id), { b120: 100, b128: 700 });
    assert.deepEqual(creditsOf((await lastEntry(s.acc)).id), ["A 128 300"]);
    clean();
  });
  it("S168 örneği — Fatura 2'ye bağlı 300 ÇEK: KABUL, 128 = 700, 120 = 100 (kuyruğun Fatura 2 payından)", async () => {
    const s = await scenario("S168 Çek 300");
    await must("çek", cheque(s.acc, s.at(-10), 300, s.f2));
    assert.deepEqual(gl(s.acc.id), { b120: 100, b128: 700 });
    clean();
  });
  it("Fatura 2'ye bağlı 100 nakit → 128'den 100 (Fatura 2'nin şüpheli payı 400 ≥ 100): 128 = 900, 120 = 100 (bugün A 120 100)", async () => {
    const s = await scenario("F2 Nakit 100");
    await must("tahsilat", cash(s.acc, s.at(-10), 100, { invoiceId: s.f2 }));
    assert.deepEqual(gl(s.acc.id), { b120: 100, b128: 900 });
    assert.deepEqual(creditsOf((await lastEntry(s.acc)).id), ["A 128 100"]);
    clean();
  });
  it("Fatura 1'e bağlı 300 nakit → KABUL (bugün 409), 128'den 300: 128 = 700, 120 = 100", async () => {
    const s = await scenario("F1 Nakit 300");
    await must("tahsilat", cash(s.acc, s.at(-10), 300, { invoiceId: s.f1 }));
    assert.deepEqual(gl(s.acc.id), { b120: 100, b128: 700 });
    assert.deepEqual(creditsOf((await lastEntry(s.acc)).id), ["A 128 300"]);
    clean();
  });
  it("bağsız işaretsiz 300 nakit → DEĞİŞMEZ (en eski açık kayıttan 128 300)", async () => {
    const s = await scenario("Bağsız 300");
    await must("tahsilat", cash(s.acc, s.at(-10), 300));
    assert.deepEqual(gl(s.acc.id), { b120: 100, b128: 700 });
    assert.deepEqual(creditsOf((await lastEntry(s.acc)).id), ["A 128 300"]);
    clean();
  });
  it("Fatura 2'ye bağlı 500 nakit → 400'ü 128'den, 100'ü 120'den (S25 (a)): 128 = 600, 120 = 0", async () => {
    const s = await scenario("F2 Nakit 500");
    await must("tahsilat", cash(s.acc, s.at(-10), 500, { invoiceId: s.f2 }));
    assert.deepEqual(gl(s.acc.id), { b120: 0, b128: 600 });
    assert.deepEqual(creditsOf((await lastEntry(s.acc)).id), ["A 120 100", "A 128 400"]);
    clean();
  });
  it("Fatura 2'ye bağlı 500 ÇEK → 400 128'den, 100 120'den (S25 (a); bugün en eski kayıttan 128 500)", async () => {
    const s = await scenario("F2 Çek 500");
    await must("çek", cheque(s.acc, s.at(-10), 500, s.f2));
    assert.deepEqual(gl(s.acc.id), { b120: 0, b128: 600 });
    clean();
  });
  it("SINIR: Fatura 2'ye bağlı 700 nakit → 120'ye düşecek 300 > şüpheli dışı borç 100: RET AYNEN, ileti iki tutarı söyler, hiçbir şey yazılmaz", async () => {
    const s = await scenario("F2 Nakit 700 Ret");
    const count = () => Number(server.app.store.get("SELECT COUNT(*) AS n FROM account_entries WHERE account_id = ?", s.acc.id).n);
    const before = count();
    const res = await cash(s.acc, s.at(-10), 700, { invoiceId: s.f2 });
    assert.deepEqual([res.status, codeOf(res)], [409, "doubtful-normal-exceeds"]);
    const text = messageOf(res);
    assert.match(text, /Normal cari hesaba işlenecek kısım \(300,00 TL; 700,00 TL tahsilatın 400,00 TL'si faturanın şüpheli alacaktaki payından düşüyor\)/, text);
    assert.match(text, /şüpheli dışı borç bakiyesini \(100,00 TL\) aşıyor/, text);
    assert.match(text, /Tutarı 500,00 TL'ye indirin ya da Kapatılacak Fatura bağını kaldırın\./, text);
    assert.equal(count(), before, "satır yazılmadı (işlem geri alındı)");
    assert.deepEqual(gl(s.acc.id), { b120: 100, b128: 1000 });
    // İletinin önerdiği tutar KABUL edilir (önerinin kendisi doğru).
    await must("önerilen tutar", cash(s.acc, s.at(-10), 500, { invoiceId: s.f2 }));
    assert.deepEqual(gl(s.acc.id), { b120: 0, b128: 600 });
    clean();
  });
  it("SINIR: 'Normal Cari Hesaba İşle' işaretli tahsilat bugünkü gibi (tamamı 120): 300 > 100 → RET, ileti 'tahsilat (300,00 TL)'", async () => {
    const s = await scenario("İşaretli 300 Ret");
    const res = await cash(s.acc, s.at(-10), 300, { doubtfulSkip: true });
    assert.deepEqual([res.status, codeOf(res)], [409, "doubtful-normal-exceeds"]);
    assert.match(messageOf(res), /^Normal cari hesaba işlenecek tahsilat \(300,00 TL\) carinin şüpheli dışı borç bakiyesini \(100,00 TL\) aşıyor;/, messageOf(res));
    // İşaretli + bağlı: işaret kazanır (tamamı 120) — 100 sığar.
    await must("işaretli + bağlı 100", cash(s.acc, s.at(-10), 100, { doubtfulSkip: true, invoiceId: s.f2 }));
    assert.deepEqual(gl(s.acc.id), { b120: 0, b128: 1000 });
    clean();
  });

  // Sınıf listesi (kabul D'nin kalıcı ayağı; programın kendi API'siyle): kayıt Fatura 1'in 600'ü (kısmi), Fatura 2 kayıttan SONRA, işaretli tahsilat yok. Kuyruk: Fatura 1 600 şüpheli, Fatura 2 0.
  for (const [label, kind, link, amount, want, lines] of [
    ["kayıttan ÖNCE kesilmiş faturaya bağlı nakit (S25 (c))", "cash", "f1", 400, { b120: 900, b128: 200 }, ["A 128 400"]],
    ["kayıttan ÖNCE kesilmiş faturaya bağlı çek (S14)", "cheque", "f1", 400, { b120: 900, b128: 200 }, null],
    ["kayıttan SONRA kesilmiş, kuyrukta şüpheli payı olmayan faturaya bağlı nakit (S14'ün sözü)", "cash", "f2", 400, { b120: 500, b128: 600 }, ["A 120 400"]],
    ["kayıttan SONRA kesilmiş, kuyrukta şüpheli payı olmayan faturaya bağlı çek (S14; bugün 128)", "cheque", "f2", 400, { b120: 500, b128: 600 }, null],
    ["bağsız nakit (değişmez)", "cash", "", 400, { b120: 900, b128: 200 }, ["A 128 400"]],
    ["bağsız çek (değişmez)", "cheque", "", 400, { b120: 900, b128: 200 }, null],
    ["kısmen şüpheli faturaya bağlı 700 nakit (S25 (a): 600 128, 100 120)", "cash", "f1", 700, { b120: 800, b128: 0 }, ["A 120 100", "A 128 600"]],
  ]) {
    it(`sınıf: ${label}`, async () => {
      const s = await scenario(`Sınıf ${(n += 1)}`, { rec: 600, normal: 0 });
      assert.deepEqual(gl(s.acc.id), { b120: 900, b128: 600 }, "ön durum");
      const target = link ? s[link] : "";
      if (kind === "cash") await must("tahsilat", cash(s.acc, s.at(-10), amount, target ? { invoiceId: target } : {}));
      else await must("çek", cheque(s.acc, s.at(-10), amount, target));
      assert.deepEqual(gl(s.acc.id), want);
      if (lines) assert.deepEqual(creditsOf((await lastEntry(s.acc)).id), lines);
      clean();
    });
  }

  it("iki kayıt (K-1 (b)): Fatura 2'ye bağlı çek Fatura 2'yi tutan İKİNCİ kayıttan düşer (en eski kayıttan değil)", async () => {
    base += 30;
    const B = base;
    const acc = await must("cari", api.post("/api/workspace/accounts", { name: "Şüpheli Kuyruk İki Kayıt", type: "customer", registeredOn: day(-1200), phone: "0500 319 99 01" }));
    const f1 = await invoice(acc, day(B - 60), 1000);
    const r1 = await must("kayıt 1", api.post(`/api/workspace/accounts/${acc.id}/doubtful`, { amount: "1000", date: day(B - 40), reason: "lawsuit" }));
    const f2 = await invoice(acc, day(B - 35), 500);
    const r2 = await must("kayıt 2", api.post(`/api/workspace/accounts/${acc.id}/doubtful`, { amount: "400", date: day(B - 32), reason: "other" }));
    // Evrakla (bugünkü kuralda bağlı evrak en eski kayıttan düşerdi — bu yüzden ayırt edici; nakitte bugünkü sınır zaten reddederdi).
    await must("Fatura 2'ye bağlı çek", cheque(acc, day(B - 10), 300, f2));
    const { state: map } = await state();
    const id1 = r1.record?.id || r1.id;
    const id2 = r2.record?.id || r2.id;
    assert.ok(id1 && id2, `kayıt kimlikleri: ${JSON.stringify(r1).slice(0, 200)}`);
    assert.equal(map.get(id1)?.remaining, 100000, "kayıt 1 (Fatura 1'i tutar) dokunulmadı");
    assert.equal(map.get(id2)?.remaining, 10000, "kayıt 2 (Fatura 2'yi tutar) 400 → 100");
    assert.equal(f1.length > 0, true);
    clean();
  });

  it("aynı gün bağlı + bağsız iki tahsilat: toplam ayırıcının sırasından bağımsız (ders 31) — iki cari, ters yazım sırası, aynı 120 / 128", async () => {
    const run = async (label, order) => {
      const s = await scenario(label, { normal: 0 });
      for (const step of order) await must(step, step === "bagli" ? cash(s.acc, s.at(-10), 300, { invoiceId: s.f1 }) : cash(s.acc, s.at(-10), 500));
      return gl(s.acc.id);
    };
    // Karar metinlerinden: bağsız 500 en eski kayıttan; Fatura 1'e bağlı 300 Fatura 1'in o anki şüpheli payından → iki sırada da 128 = 1.000 − 800 = 200, 120 = 1.500 − 800 − 200 = 500.
    assert.deepEqual(await run("Aynı Gün A", ["bagsiz", "bagli"]), { b120: 500, b128: 200 });
    assert.deepEqual(await run("Aynı Gün B", ["bagli", "bagsiz"]), { b120: 500, b128: 200 });
    // Fatura 2'ye bağlı (şüpheli payı yok) + bağsız: 128 = 500, 120 = 200 iki sırada.
    const run2 = async (label, order) => {
      const s = await scenario(label, { normal: 0 });
      for (const step of order) await must(step, step === "bagli" ? cash(s.acc, s.at(-10), 300, { invoiceId: s.f2 }) : cash(s.acc, s.at(-10), 500));
      return gl(s.acc.id);
    };
    assert.deepEqual(await run2("Aynı Gün C", ["bagsiz", "bagli"]), { b120: 200, b128: 500 });
    assert.deepEqual(await run2("Aynı Gün D", ["bagli", "bagsiz"]), { b120: 200, b128: 500 });
    clean();
  });

  it("düzeltme: bağ kaldırılır / yeniden kurulur, tutar sınırı düzeltmede de; sil + bağsız yeniden gir", async () => {
    const s = await scenario("Düzeltme");
    await must("bağlı 300", cash(s.acc, s.at(-10), 300, { invoiceId: s.f2 }));
    const row = await lastEntry(s.acc);
    assert.deepEqual(gl(s.acc.id), { b120: 100, b128: 700 });
    await must("bağı kaldır", api.put(`/api/workspace/accounts/${s.acc.id}/entries/${row.id}`, { invoiceId: "", cashForce: true }));
    assert.deepEqual(gl(s.acc.id), { b120: 100, b128: 700 }, "bağsız da en eski kayıttan 300 (aynı sayı)");
    await must("Fatura 2'ye yeniden bağla, 500", api.put(`/api/workspace/accounts/${s.acc.id}/entries/${row.id}`, { invoiceId: s.f2, amount: "500", cashForce: true }));
    assert.deepEqual(gl(s.acc.id), { b120: 0, b128: 600 });
    const res = await api.put(`/api/workspace/accounts/${s.acc.id}/entries/${row.id}`, { invoiceId: s.f2, amount: "700", cashForce: true });
    assert.deepEqual([res.status, codeOf(res)], [409, "doubtful-normal-exceeds"], messageOf(res));
    assert.deepEqual(gl(s.acc.id), { b120: 0, b128: 600 }, "düzeltme reddi: satır değişmedi");
    await must("sil", api.del(`/api/workspace/accounts/${s.acc.id}/entries/${row.id}?cashForce=1`));
    assert.deepEqual(gl(s.acc.id), { b120: 100, b128: 1000 });
    await must("bağsız 300", cash(s.acc, s.at(-10), 300));
    assert.deepEqual(gl(s.acc.id), { b120: 100, b128: 700 });
    clean();
  });

  it("K-1 (a) + (b): doubtfulBefore — satırdan ÖNCEKİ anki dağılım, kalem başına kayıt kimliğiyle; kuyruğun bugünkü çıktısına alan eklenmez", async () => {
    const s = await scenario("Kesit");
    await must("bağlı 300", cash(s.acc, s.at(-10), 300, { invoiceId: s.f2 }));
    const row = await lastEntry(s.acc);
    // Satırdan SONRA bir bağsız tahsilat: kesite girmemeli (girerse Fatura 1'in açığı 400'e iner, Fatura 2'nin payı 500'e çıkar).
    await must("sonraki bağsız 200", cash(s.acc, s.at(-5), 200));
    const { createObligationInput } = await import(lib("obligation-input.mjs"));
    const { buildObligations, doubtfulBefore } = await import(lib("obligation-queue.mjs"));
    assert.equal(typeof doubtfulBefore, "function", "kuyruk doubtfulBefore'u dışa verir");
    const input = createObligationInput({ store: server.app.store }).accountInput(s.acc.id, TODAY);
    const recordId = s.record.record?.id || s.record.id;
    // Satırdan önce: kayıt kalanı 1.000 (o anki) → Fatura 1 600 + Fatura 2 400.
    const cut = doubtfulBefore({ ...input, doubtfulRecords: [{ id: recordId, date: s.at(-40), remainingMinor: 100000 }] }, { lineId: row.id });
    assert.deepEqual(cut.get(`inv:${s.f2}`), { minor: 40000, records: [{ recordId, minor: 40000 }] });
    assert.deepEqual(cut.get(`inv:${s.f1}`), { minor: 60000, records: [{ recordId, minor: 60000 }] });
    // Kuyruğun kendisi: son durum (kayıt kalanı 1.000 − 300 − 200 = 500) → 500 = Fatura 1 400 + Fatura 2 100; dönüşte yeni alan yok.
    const q = buildObligations(input);
    assert.deepEqual(Object.keys(q).sort(), ["coverage", "doubtful", "entries", "installments", "invoiceNet", "invoices", "items", "overdue", "prepaidPasses"]);
    assert.deepEqual(Object.keys(q.doubtful).sort(), ["amount", "items"]);
    assert.equal(q.doubtful.amount, 500);
    for (const item of q.doubtful.items) assert.deepEqual(Object.keys(item).sort(), ["amount", "invoiceId", "itemId", "key", "kind", "lineId", "planId", "vade"]);
  });

  it("kart haritası (ledgerPlansOf) cari kümesiyle = bütün harita (ledgerPlansByAccount) — her cari", async () => {
    base += 30;
    const acc = await must("cari", api.post("/api/workspace/accounts", { name: "Şüpheli Kuyruk Kartlı", type: "customer", registeredOn: day(-1200), phone: "0500 319 99 02" }));
    await must("borç", api.post(`/api/workspace/accounts/${acc.id}/entries`, { kind: "debt", amount: "1200", date: day(base - 20), method: "cash", cashForce: true, similarOk: true }));
    await must("kart", api.post("/api/workspace/plans", { name: acc.name, registeredOn: day(base - 15), total: "1200", accountId: acc.id, mode: "auto", count: "3", firstDue: day(base), everyMonths: "1", coversBalance: true }));
    const second = await must("kart 2", api.post("/api/workspace/plans", { name: acc.name, registeredOn: day(base - 12), total: "300", accountId: acc.id, mode: "auto", count: "2", firstDue: day(base + 5), everyMonths: "1", coversBalance: false }));
    await must("kart 2 tahsilatı", api.post(`/api/workspace/plans/${second.id || second.plan?.id}/entries`, { kind: "in", amount: "100", date: day(base - 11), method: "cash", cashForce: true, similarOk: true }));
    const third = await must("kart 3 (silinecek)", api.post("/api/workspace/plans", { name: acc.name, registeredOn: day(base - 10), total: "200", accountId: acc.id, mode: "auto", count: "1", firstDue: day(base + 6), everyMonths: "1", coversBalance: false }));
    await must("kart 3 sil", api.del(`/api/workspace/plans/${third.id || third.plan?.id}`));
    const { createAccountLines } = await import(lib("account-lines.mjs"));
    const lines = createAccountLines({ store: server.app.store });
    const all = lines.ledgerPlansByAccount();
    assert.ok((all.get(acc.id) || []).length >= 2, "kartlı cari haritada");
    assert.ok((all.get(acc.id) || []).some(plan => plan.entries.length > 0), "ön koşul: kartta tahsilat satırı var (kart haritasının tahsilat alanı sınanır)");
    const ids = server.app.store.all("SELECT id FROM accounts").map(row => row.id);
    const scoped = lines.ledgerPlansOf(ids);
    for (const id of ids) assert.deepEqual(scoped.get(id) || [], all.get(id) || [], `cari ${id}`);
    assert.deepEqual(lines.ledgerPlansOf([acc.id]).get(acc.id), all.get(acc.id), "tek cari");
    assert.equal(lines.ledgerPlansOf([]).size, 0);
  });

  it("kilit: kilitli dönemin 120 / 128'i donmuş = canlı (aynı kural); kilitten sonra bağlı tahsilat o anki dağılımdan", async () => {
    const s = await scenario("Kilit");
    await must("bağlı 300", cash(s.acc, s.at(-10), 300, { invoiceId: s.f2 }));
    await must("kilit", api.put("/api/admin/period-lock", { lockedUntil: s.at(-5) }));
    assert.deepEqual(gl(s.acc.id), { b120: 100, b128: 700 });
    clean();
    // Kilitten sonra Fatura 1'e bağlı 200: Fatura 1'in şüpheli payı 600 → 128'den 200.
    await must("kilitten sonra bağlı 200", cash(s.acc, s.at(-3), 200, { invoiceId: s.f1 }));
    assert.deepEqual(gl(s.acc.id), { b120: 100, b128: 500 });
    clean();
    await must("kilit kaldır", api.put("/api/admin/period-lock", { lockedUntil: "" }));
  });

  it("ESM döngüsü (lib/bank/doubtful.mjs ↔ lib/obligation-input.mjs): hangisi önce yüklenirse yüklensin çalışır", () => {
    for (const first of ["bank/doubtful.mjs", "obligation-input.mjs", "obligation-queue.mjs", "general-ledger.mjs"]) {
      const code = `const a = await import(${JSON.stringify(lib(first))}); const d = await import(${JSON.stringify(lib("bank/doubtful.mjs"))}); const o = await import(${JSON.stringify(lib("obligation-input.mjs"))}); if (typeof d.doubtfulState !== "function" || typeof o.createObligationInput !== "function" || typeof d.linkedShares !== "function") process.exit(3); console.log("ok", Object.keys(a).length > 0);`;
      const res = spawnSync(process.execPath, ["--disable-warning=ExperimentalWarning", "--input-type=module", "-e", code], { encoding: "utf8", env: { ...process.env, HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
      assert.equal(res.status, 0, `${first} önce: ${res.stderr}`);
      assert.match(res.stdout, /^ok true/);
    }
  });
});

// Kabul D (ders 17, 53 (b)): v2.4.9'un GERÇEK koduyla üretilmiş, şüpheli kaydı OLAN carili KİLİTLİ veri (test/fixtures/supheli-kuyruk-v249; üretici uret.mjs.txt). Güncellemeden sonra:
// kilitli dönemin 120 / 128'i donmuş (2.4.9 kuralı), canlı türetme yeni kural; fark Kural Değişikliği Farkı (uyarı) ve düzeltme fişi ön izlemesinde KAYNAĞIYLA, fişe girmez (B14 (a));
// açık dönemde yeni kural. Beklenenler karar metinlerinden (S14, S25 (c), S168 = B — dosyanın başı).
describe("Ç5-A tur 3c — v2.4.9 gerçek verisi (kilitli + kilitsiz; sınıf sınıf)", () => {
  it("donmuş 2.4.9 ↔ canlı yeni kural; fark kaynağıyla ön izlemede, fiş satırı yok; açık dönemde yeni kural", { timeout: 180_000 }, async () => {
    const DIR = path.join(HERE, "fixtures", "supheli-kuyruk-v249");
    const old = JSON.parse(readFileSync(path.join(DIR, "v249.json"), "utf8"));
    assert.equal(old.kod, "v2.4.9 (ccf0b0ca)", "ön koşul: fikstür v2.4.9'un gerçek koduyla üretildi");
    const root = mkdtempSync(path.join(tmpdir(), "supheli-kuyruk-v249-"));
    const dataDir = path.join(root, "data");
    mkdirSync(dataDir, { recursive: true });
    writeFileSync(path.join(dataDir, "destekofis.sqlite"), gunzipSync(readFileSync(path.join(DIR, "destekofis.sqlite.gz"))));
    copyFileSync(path.join(DIR, "sirketler.json"), path.join(dataDir, "sirketler.json"));
    const server = await startTestServer({ dataDir, backupDir: path.join(root, "backups"), now: { time: old.now, fixed: true }, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
    try {
      const client = await loginAdmin(server);
      const get = async url => unwrap(await client.get(url));
      const app = server.app;
      await app.context.ledger.snapshots.runPending(); // açılışta bekleyen dondurma (göç) — ürünün kendi koşusu biter
      assert.equal(app.context.ledger.snapshots.state().coverage, old.kilit, "kilitli dönem donmuş");
      const bal = () => {
        const b = {};
        for (const entry of app.ledger.build()) for (const line of entry.lines || []) if ((line.account === "120" || line.account === "128") && line.party) {
          b[line.party] ||= { 120: 0, 128: 0 };
          b[line.party][line.account] += line.debit - line.credit;
        }
        return label => ({ b120: (b[old.cariler[label].id]?.[120] || 0) / 100, b128: (b[old.cariler[label].id]?.[128] || 0) / 100 });
      };
      const now = bal();
      // 2.4.9'da (fikstürün kendi sayısı) ↔ yeni kural (karar metni):
      assert.deepEqual(old.cariler["Kilitli F1 Bağlı Nakit"].defter249, { b120: 500, b128: 600 }, "2.4.9: bağlı nakit 120'den");
      assert.deepEqual(now("Kilitli F1 Bağlı Nakit"), { b120: 900, b128: 200 }, "S25 (c): şüpheliye aktarılmış faturaya bağlı nakit 128'den");
      assert.deepEqual(old.cariler["Kilitli F2 Bağlı Çek"].defter249, { b120: 900, b128: 200 }, "2.4.9: bağlı çek en eski kayıttan 128");
      assert.deepEqual(now("Kilitli F2 Bağlı Çek"), { b120: 500, b128: 600 }, "S14: kuyrukta şüpheli payı olmayan (sonradan kesilmiş) faturaya bağlı çek 120");
      assert.deepEqual(now("Kilitli F1 Bağlı Çek"), { b120: 900, b128: 200 }, "S14: şüpheliye aktarılmış faturaya bağlı çek 128 (iki kuralda aynı)");
      assert.deepEqual(now("Kilitli Bağsız Nakit"), { b120: 900, b128: 200 }, "bağsız: değişmez");
      assert.deepEqual(old.cariler["Kilitli S168 F2 Nakit 100"].defter249, { b120: 0, b128: 1000 });
      assert.deepEqual(now("Kilitli S168 F2 Nakit 100"), { b120: 100, b128: 900 }, "S168 = B: Fatura 2'nin şüpheli payından 128");
      assert.deepEqual(now("Kilitsiz F1 Bağlı Nakit"), { b120: 900, b128: 200 }, "kilitsiz dönem: yeni kural");
      assert.deepEqual(now("Kilitsiz F2 Bağlı Çek"), { b120: 500, b128: 600 }, "kilitsiz dönem: yeni kural");
      // Kural farkı: uyarı (kilitli dönem donmuş); üç kaynak (bağlı nakit, bağlı çek, S168 nakit) — 120 ↔ 128, alt defter, fişe girmez; "Düzeltildi" yok.
      const integrity = await get("/api/workspace/ledger/integrity");
      const item = (integrity.data.checks || []).find(check => check.code === "ledger:rule-diff");
      assert.ok(item && item.ok === false && item.severity === "warning" && item.count === 3, `kural farkı uyarısı: ${JSON.stringify(item)?.slice(0, 300)}`);
      assert.ok(!/Düzeltildi/.test(item.name), "120 ↔ 128 farkı varken 'Düzeltildi' gelmez");
      assert.deepEqual(item.breakdown.map(row => [row.account, row.differenceMinor]).sort(), [["120", 10000], ["128", -10000]]);
      const preview = (await get("/api/admin/ledger/rule-diff-correction")).data;
      assert.deepEqual([preview.lines.length, preview.code], [0, "rule-diff-nothing"], "fişe yazılacak satır yok (B14 (a))");
      const sources = preview.sources.map(source => ({ id: source.id, excluded: source.excluded, deltas: source.deltas.map(d => `${d.account} ${d.minor / 100}`).sort() }));
      assert.equal(sources.length, 3, JSON.stringify(sources));
      for (const source of sources) assert.equal(source.excluded, true, "kaynak 'fişle düzeltilmez' (alt defter)");
      const byParty = label => preview.sources.find(source => source.deltas.some(d => d.party === old.cariler[label].id));
      assert.deepEqual(byParty("Kilitli F1 Bağlı Nakit").deltas.map(d => `${d.account} ${d.minor / 100}`).sort(), ["120 400", "128 -400"]);
      assert.deepEqual(byParty("Kilitli F2 Bağlı Çek").deltas.map(d => `${d.account} ${d.minor / 100}`).sort(), ["120 -400", "128 400"]);
      assert.deepEqual(byParty("Kilitli S168 F2 Nakit 100").deltas.map(d => `${d.account} ${d.minor / 100}`).sort(), ["120 100", "128 -100"]);
      assert.equal(byParty("Kilitli F1 Bağlı Çek"), undefined, "iki kuralda aynı sonuç → kaynak listesinde yok");
      // Açık dönemde: Fatura 1'e bağlı 100 nakit → Fatura 1'in o anki şüpheli payından (kalan 200) 128'den.
      const a = old.cariler["Kilitli F1 Bağlı Nakit"];
      const write = unwrap(await client.post(`/api/workspace/accounts/${a.id}/entries`, { kind: "in", amount: "100", date: "2026-09-10", method: "cash", cashForce: true, similarOk: true, invoiceId: a.f1 }));
      assert.equal(write.status, 200, JSON.stringify(write.data).slice(0, 300));
      assert.deepEqual(bal()("Kilitli F1 Bağlı Nakit"), { b120: 900, b128: 100 });
      assert.deepEqual((app.integrity.scan().findings || []).map(f => f.code), [], "Mutabakat Testi bulgusuz");
    } finally {
      await server.close();
      removeTestDir(root);
    }
  });
});
