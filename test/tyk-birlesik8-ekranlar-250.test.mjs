// 2.5.0 BİRLEŞİK TUR 8 — İş 1: S129 = A HER ekranda ("ekranda tek sayı") + S142 = A (cari kartındaki taksit kartı satırının durum etiketi ve sıradaki taksiti).
// KARARLAR (iş listesi D, AYNEN):
//   S129 = A (12.11 13:26): "taksit kartının penceresindeki 'Tahsil Edilen' / 'Kalan' göstergeleri, Taksitler listesindeki aynı sütunlar ve taksit satırının 'Ödenen'i de TEK
//   KUYRUKTAN gösterilir (ekranda tek sayı: örnekte kart 900, bağsız tahsilat 500 → Tahsil Edilen 500 · Kalan 400; kart 600, bağsız tahsilat 800 → Kalan 0 · Tamamlandı);
//   tahsilat formunun sınırı / sorusu / önerilen tutarı S118 = B'deki gibi kartın KENDİ kalanından kalır."
//   S142 = A (13.11 03:44): "cari kartındaki taksit kartı satırında durum etiketi ve 'sıradaki taksit' de aynı (tek) hesaptan; aynı küçük işte kart penceresindeki 'Hareketler:
//   henüz hareket yok' satırına açıklama".
// Yer tablosu: docs/erp/C5B-TYK-TASARIM.md §15.1. Beklenen sayılar kararların örneklerinden ve S50 sırasından ELLE (ders 5, 40) — programın çıktısından değil; "aynı kart → aynı
// sayı": tablodaki her yer kart penceresiyle karşılaştırılır.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, describe, it } from "node:test";
import { resolveMobile } from "../server/lib/mobile.mjs";
import { loginAdmin, startTestServer } from "./helpers.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TODAY = "2026-10-20";
const NOW = `${TODAY}T12:00:00+03:00`;
const day = offset => {
  const d = new Date(`${TODAY}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
};
const dayText = iso => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : "");
const unwrap = response => ({ ...response, data: response.data && typeof response.data === "object" && "ok" in response.data ? (response.data.ok ? response.data.data : response.data) : response.data });
const steppingClock = (start = NOW, step = 7) => {
  let at = Date.parse(start);
  return () => (at += step);
};
const tlText = value => `${new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)} TL`;
const num = cell => Number(String(cell ?? "").replace(/[^\d,-]/g, "").replace(",", ".")) || 0;

describe("Birleşik tur 8 — İş 1: kartın göstergeleri yer tablosunun HER yerinde kart penceresiyle aynı (S129 = A, S142 = A)", () => {
  let h;
  let pdfText;
  let xlsxRows;
  before(async () => {
    ({ pdfText, xlsxRows } = await import("./fixtures/rapor-dosya-oku.mjs"));
    const server = await startTestServer({ now: steppingClock(), env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
    const client = await loginAdmin(server);
    const api = { get: async url => unwrap(await client.get(url)), post: async (url, body) => unwrap(await client.post(url, body)), put: async (url, body) => unwrap(await client.put(url, body)) };
    await api.post("/api/workspace/bank/setup/dismiss", {});
    const must = async (label, promise) => {
      const res = await promise;
      assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
      return res.data;
    };
    let n = 0;
    h = { server, client, api, must, store: server.app.store };
    h.account = label => must(`cari ${label}`, api.post("/api/workspace/accounts", { name: `Tur8 ${label}`, type: "customer", registeredOn: day(-400), phone: `0500 288 ${String(10 + Math.floor((n += 1) / 100)).padStart(2, "0")} ${String(n % 100).padStart(2, "0")}` }));
    h.entry = (acc, body) => must(`hareket ${body.kind}`, api.post(`/api/workspace/accounts/${acc.id}/entries`, { method: "cash", cashForce: true, similarOk: true, ...body }));
    h.newCard = (acc, total, count, { firstDue = day(-10), coversBalance = false } = {}) => must("kart", api.post("/api/workspace/plans", { name: acc.name, registeredOn: day(-40), total: String(total), accountId: acc.id, mode: "auto", count: String(count), firstDue, everyMonths: "1", ...(coversBalance ? { coversBalance: true } : {}) }));
    h.cardPay = (planId, amount, date = day(-8)) => must("kart tahsilatı", api.post(`/api/workspace/plans/${planId}/entries`, { kind: "in", amount: String(amount), method: "cash", date, cashForce: true, similarOk: true }));
    h.raw = async url => {
      const res = await client.raw("GET", url);
      assert.equal(res.status, 200, `${url}: ${res.status}`);
      return res.buffer;
    };
    // Kaydın kartı: kartın kayıt bağı (case_key / case_source) — kayıt bağının kurulumu yerine veri tabanından (okuma yolu aynı; dar kontrol kayit-kart.mjs ile aynı yöntem).
    h.linkCase = (planId, key) => {
      const source = server.app.context?.dataset?.currentKey ? server.app.context.dataset.currentKey() : "";
      h.store.run("UPDATE plans SET case_key = ?, case_source = ? WHERE id = ?", key, source, planId);
    };
  });
  after(async () => h?.server.close());

  // Tablodaki her yerden kartın sayıları (yer tablosu §15.1 numaralarıyla).
  async function everywhere(acc, planId, caseKey) {
    const { api, must } = h;
    const win = await must("kart penceresi", api.get(`/api/workspace/plans/${planId}`));
    const pick = p => ({ paid: p.totals.paid, remaining: p.totals.remaining, state: p.state, next: p.next ? p.next.seq : null, nextDue: p.next ? p.next.dueDate : null, overdueCount: p.totals.overdueCount });
    const out = { "1 kart penceresi": { ...pick(win), items: win.items.map(item => [item.paid, item.remaining, item.state]) } };
    const list = await must("Taksitler", api.get("/api/workspace/plans?status=all"));
    out["2 Taksitler listesi"] = pick(list.plans.find(row => row.id === planId));
    const tab = win.state === "closed" ? "closed" : win.state === "done" ? "done" : "active";
    const inTab = await must(`Taksitler ${tab}`, api.get(`/api/workspace/plans?status=${tab}`));
    out["2 Taksitler sekmesi"] = pick(inTab.plans.find(row => row.id === planId) || { totals: {}, state: "YOK" });
    const ekstre = pdfText(await h.raw(`/api/workspace/plans/${planId}/ekstre.pdf`));
    out["4 taksit ekstresi PDF"] = ekstre.includes(`Tahsil edilen\n${tlText(win.totals.paid)}\nKalan\n${tlText(win.totals.remaining)}`);
    const listePdf = pdfText(await h.raw("/api/workspace/plans/liste.pdf?status=all"));
    out["3 Taksit Listesi PDF"] = listePdf.includes(`${tlText(win.totals.paid)}\n${tlText(win.totals.remaining)}`);
    if (caseKey) {
      const cases = await must("kayıt detayı", api.get(`/api/workspace/cases/${caseKey}/plans`));
      const row = cases.plans.find(item => item.id === planId);
      out["5-6 kayıt detayı Taksit Planı / Tahsilat penceresi"] = { ...pick(row), items: row.items.map(item => [item.paid, item.remaining, item.state]) };
    }
    const card = await must("cari kartı", api.get(`/api/workspace/accounts/${acc.id}`));
    const summary = card.plans.find(item => item.id === planId);
    out["8 cari kartı taksit kartı satırı"] = pick(summary);
    out["9 cari kartı Taksitten Kalan"] = card.totals.planRemaining;
    const accounts = await must("Cari Listesi", api.get("/api/workspace/accounts?status=all&limit=5000"));
    const accRow = accounts.accounts.find(item => item.id === acc.id);
    out["12 Cari Listesi"] = { planRemaining: accRow.planRemaining, nextDue: accRow.next ? accRow.next.dueDate : null, overdueCount: accRow.planOverdueCount };
    const xlsx = xlsxRows(await h.raw("/api/workspace/accounts/export.xlsx?status=all"));
    out["13 Cari Listesi Excel"] = xlsx.find(cells => cells[xlsx[0].indexOf("Ad / Unvan")] === acc.name)[xlsx[0].indexOf("Taksitten Kalan")];
    const cariPdf = pdfText(await h.raw(`/api/workspace/accounts/${acc.id}/ekstre.pdf`));
    // Özet satırı kalan 0 iken yazılmaz; yazılıyorsa sayı pencereyle aynı.
    const pdfLeft = /Taksitlerden Kalan[^T]{0,30}\n([\d.,]+ TL)/.exec(cariPdf)?.[1] || null;
    out["14 cari ekstresi PDF"] = card.totals.planRemaining > 0.005 ? pdfLeft === tlText(card.totals.planRemaining) : pdfLeft === null || pdfLeft === tlText(0);
    const kartlar = await must("Rapor Taksit Kartları", api.get("/api/workspace/report-center/taksit-kartlari?planStatus=all"));
    const kRow = kartlar.rows.find(cells => cells[kartlar.headers.indexOf("Ad")] === acc.name && num(cells[kartlar.headers.indexOf("Toplam")]) === win.totals.total);
    out["15 Rapor Taksit Kartları"] = { paid: num(kRow[kartlar.headers.indexOf("Ödenen")]), remaining: num(kRow[kartlar.headers.indexOf("Kalan")]), nextDue: kRow[kartlar.headers.indexOf("Sıradaki Vade")] };
    const vade = await must("Rapor Taksit Vade Listesi", api.get(`/api/workspace/report-center/taksit-vadeleri?from=${day(-120)}&to=${day(400)}`));
    out["15 Rapor Taksit Vade Listesi"] = vade.rows.filter(cells => cells[vade.headers.indexOf("Ad")] === acc.name).map(cells => [num(cells[vade.headers.indexOf("Ödenen")]), num(cells[vade.headers.indexOf("Kalan")])]);
    return { win, out };
  }
  // Her yer kart penceresiyle aynı mı (yer → fark listesi; boş = aynı).
  function sameAsWindow({ win, out }, { open = true } = {}) {
    const diffs = [];
    const w = out["1 kart penceresi"];
    const eq = (label, a, b) => {
      if (JSON.stringify(a) !== JSON.stringify(b)) diffs.push(`${label}: ${JSON.stringify(a)} ≠ pencere ${JSON.stringify(b)}`);
    };
    const head = row => ({ paid: row.paid, remaining: row.remaining, state: row.state, next: row.next, nextDue: row.nextDue, overdueCount: row.overdueCount });
    const wHead = head(w);
    eq("2 Taksitler listesi", head(out["2 Taksitler listesi"]), wHead);
    eq("2 Taksitler sekmesi", head(out["2 Taksitler sekmesi"]), wHead);
    if (!out["3 Taksit Listesi PDF"]) diffs.push("3 Taksit Listesi PDF: pencerenin Ödenen / Kalan'ı yok");
    if (!out["4 taksit ekstresi PDF"]) diffs.push("4 taksit ekstresi PDF: pencerenin Tahsil edilen / Kalan'ı yok");
    if (out["5-6 kayıt detayı Taksit Planı / Tahsilat penceresi"]) {
      eq("5-6 kayıt detayı (gösterge)", head(out["5-6 kayıt detayı Taksit Planı / Tahsilat penceresi"]), wHead);
      eq("5-6 kayıt detayı (satırlar)", out["5-6 kayıt detayı Taksit Planı / Tahsilat penceresi"].items, w.items);
    }
    eq("8 cari kartı taksit kartı satırı", head(out["8 cari kartı taksit kartı satırı"]), wHead);
    if (open) {
      eq("9 cari kartı Taksitten Kalan", out["9 cari kartı Taksitten Kalan"], win.totals.remaining);
      eq("12 Cari Listesi Taksitten Kalan", out["12 Cari Listesi"].planRemaining, win.totals.remaining);
      eq("12 Cari Listesi sıradaki", out["12 Cari Listesi"].nextDue, w.nextDue);
      eq("12 Cari Listesi N geciken", out["12 Cari Listesi"].overdueCount, w.overdueCount);
      eq("13 Cari Listesi Excel", out["13 Cari Listesi Excel"], win.totals.remaining);
      if (!out["14 cari ekstresi PDF"]) diffs.push("14 cari ekstresi PDF: Taksitlerden Kalan pencereyle aynı değil");
    }
    eq("15 Rapor Taksit Kartları", { paid: out["15 Rapor Taksit Kartları"].paid, remaining: out["15 Rapor Taksit Kartları"].remaining, nextDue: out["15 Rapor Taksit Kartları"].nextDue }, { paid: win.totals.paid, remaining: win.totals.remaining, nextDue: win.next ? `${dayText(win.next.dueDate)} · ${tlText(win.next.remaining)}` : out["15 Rapor Taksit Kartları"].nextDue });
    if (open) eq("15 Rapor Taksit Vade Listesi", out["15 Rapor Taksit Vade Listesi"], w.items.map(([paid, remaining]) => [paid, remaining]));
    return diffs;
  }

  it("KARAR ÖRNEĞİ (S129) + ORTA-A — kayda bağlı kart 900 (3 × 300), karta BAĞLANMADAN 500 tahsilat: her yerde Tahsil Edilen 500 · Kalan 400, satırlar 300 / 200 / 0", async () => {
    const acc = await h.account("Karar Örneği");
    const plan = await h.newCard(acc, 900, 3);
    h.linkCase(plan.id, "TUR8-KAYIT-1");
    await h.entry(acc, { kind: "in", amount: "500", date: day(-5) });
    const seen = await everywhere(acc, plan.id, "TUR8-KAYIT-1");
    const w = seen.out["1 kart penceresi"];
    assert.deepEqual([seen.win.totals.paid, seen.win.totals.remaining, w.items.map(([paid, remaining]) => [paid, remaining])], [500, 400, [[300, 0], [200, 100], [0, 300]]], "kart penceresi = karar örneği");
    assert.deepEqual(sameAsWindow(seen), [], "yer tablosunun her yeri kart penceresiyle aynı");
    // S118 = B: kayıt detayından açılan formun sınırı kartın KENDİ kalanı (ayrı alanlarda) — kart penceresiyle aynı alanlar.
    const caseRow = (await h.must("kayıt", h.api.get("/api/workspace/cases/TUR8-KAYIT-1/plans"))).plans.find(item => item.id === plan.id);
    assert.deepEqual([caseRow.totals.ownPaid, caseRow.totals.ownRemaining, caseRow.items.map(item => item.ownRemaining), caseRow.ownNext?.seq], [0, 900, [300, 300, 300], 1], "kayıttaki kartın kendi hesabı (form sınırı)");
  });

  it("komşu 1 — BAĞSIZ tahsilat gecikmiş taksiti kapatır: kart 900 (ilk vade 40 gün önce), bağsız 300 ⇒ her yerde Tahsil Edilen 300, durum Gecikti · 1 taksit, sıradaki 2. taksit (S142: cari kartı satırı da)", async () => {
    const acc = await h.account("Bağsız Gecikmiş");
    const plan = await h.newCard(acc, 900, 3, { firstDue: day(-40) });
    h.linkCase(plan.id, "TUR8-KAYIT-2");
    await h.entry(acc, { kind: "in", amount: "300", date: day(-5) });
    const seen = await everywhere(acc, plan.id, "TUR8-KAYIT-2");
    const w = seen.out["1 kart penceresi"];
    // S50 sırası: bağsız para en eski vadeli açık taksiti kapatır → 1. taksit ödendi; 2. taksit (vade 10 gün önce) gecikti; 3. taksit (vade 20 gün sonra) açık.
    assert.deepEqual([seen.win.totals.paid, seen.win.totals.remaining, w.state, w.overdueCount, w.next], [300, 600, "overdue", 1, 2], "kart penceresi");
    assert.deepEqual(sameAsWindow(seen), [], "yer tablosunun her yeri kart penceresiyle aynı (S142: cari kartı satırının durum etiketi ve sıradaki taksit dahil)");
    // Kartın KENDİ hesabı bu sayıları vermez (dişi: önceki kodda cari kartı satırı 2 taksit gecikti / sıradaki 1. taksit gösteriyordu).
    assert.deepEqual([seen.win.totals.ownOverdue > 0, seen.win.ownNext?.seq], [true, 1], "ön koşul: kartın kendi hesabında 1. taksit açık");
  });

  it("komşu 2 — FAZLA ödeyen: kart 600 (2 × 300), bağsız 800 ⇒ her yerde Kalan 0 · Tamamlandı, sıradaki yok; cari 200 alacaklı", async () => {
    const acc = await h.account("Fazla Ödeyen");
    const plan = await h.newCard(acc, 600, 2);
    h.linkCase(plan.id, "TUR8-KAYIT-3");
    await h.entry(acc, { kind: "in", amount: "800", date: day(-5) });
    const seen = await everywhere(acc, plan.id, "TUR8-KAYIT-3");
    assert.deepEqual([seen.win.totals.paid, seen.win.totals.remaining, seen.win.state, seen.win.next], [600, 0, "done", null]);
    assert.deepEqual(sameAsWindow(seen), []);
  });

  it("komşu 3 — İADE FATURASI almış taksitli fatura: 2 × 500 → iade faturası 1 adet ⇒ kart 500'e küçülür, her yerde Tahsil Edilen 0 · Kalan 500 (S151: iade faturasında bugünkü davranış aynen)", async () => {
    const acc = await h.account("İade Faturası");
    const item = await h.must("hizmet", h.api.post("/api/workspace/stock", { kind: "service", code: "HZM-TUR8", name: "Hizmet Tur8", unit: "Adet", salePrice: "500" }));
    const inv = await h.must("taksitli fatura", h.api.post("/api/workspace/invoices", { kind: "sale", accountId: acc.id, issueDate: day(-60), lines: [{ itemId: item.id, name: "", qty: 2, unitPrice: "500", discountRate: 0, vatRate: 0 }], payment: { cash: [], cheques: [], endorse: [], rest: "installments", installments: { count: 2, firstDue: day(-30), everyMonths: 1 } }, force: true, cashForce: true }));
    const det = await h.must("fatura", h.api.get(`/api/workspace/invoices/${inv.id}`));
    await h.must("iade faturası", h.api.post("/api/workspace/invoices", { kind: "sale_return", originalId: inv.id, issueDate: day(-20), lines: [{ originLineId: det.lines[0].id, qty: 1 }], payment: { rest: "open" }, cashForce: true }));
    h.linkCase(det.planId, "TUR8-KAYIT-4");
    const seen = await everywhere(acc, det.planId, "TUR8-KAYIT-4");
    assert.deepEqual([seen.win.totals.total, seen.win.totals.paid, seen.win.totals.remaining], [500, 0, 500]);
    assert.deepEqual(sameAsWindow(seen), []);
  });

  it("komşu 4 — KAPATILMIŞ kart (S144 = C: gösterim bugünkü gibi): kart 900, karta 300, Kartı Kapat ⇒ her yerde Tahsil Edilen 300 · Kalan 600 (kartın kendi hesabı), durum Kapalı", async () => {
    const acc = await h.account("Kapatılmış");
    const plan = await h.newCard(acc, 900, 3);
    h.linkCase(plan.id, "TUR8-KAYIT-5");
    await h.cardPay(plan.id, 300);
    const cur = h.store.get("SELECT name, registered_on AS registeredOn FROM plans WHERE id = ?", plan.id);
    assert.equal((await h.api.put(`/api/workspace/plans/${plan.id}`, { name: cur.name, registeredOn: cur.registeredOn, status: "closed" })).status, 200);
    const seen = await everywhere(acc, plan.id, "TUR8-KAYIT-5");
    assert.deepEqual([seen.win.state, seen.win.totals.paid, seen.win.totals.remaining], ["closed", 300, 600]);
    assert.deepEqual(sameAsWindow(seen, { open: false }), []);
  });

  it("mobil uçlar yer tablosundaki uçlara gider (17: aynı sayılar) — cari listesi, cari kartı, taksit özeti", () => {
    const url = (pathname, query = "") => resolveMobile("GET", pathname, new URLSearchParams(query)).url;
    assert.match(url("/api/mobil/accounts"), /^\/api\/workspace\/accounts(\?|$)/);
    assert.match(url("/api/mobil/accounts/acc_1"), /^\/api\/workspace\/accounts\/acc_1(\?|$)/);
    assert.match(url("/api/mobil/plans"), /^\/api\/workspace\/plans\?count=1/);
  });
});

// ---------------- Kaynak taraması (ders 10, 27): kart kaydını kartın KENDİ hesabıyla biçimleyen her yer yer tablosundaki bir sınıfa bağlı; yeni çağıran kırmızı ----------------
describe("Birleşik tur 8 — İş 1: kart göstergelerinin yer tablosu kaynakla aynı (yeni bir gösterim yeri eklenince kırmızı)", () => {
  const read = rel => readFileSync(path.join(ROOT, rel), "utf8");
  // Fonksiyon adına göre çağrı yerleri: her satırı (CRLF bilir) en yakın üstteki "function X(" / "const X = " tanımına bağlar.
  const callersOf = (text, needle) => {
    const lines = text.split(/\r?\n/);
    const found = new Set();
    let current = "(dosya)";
    for (const line of lines) {
      const head = /^\s{2}(?:async\s+)?function\s+([A-Za-z0-9_]+)\s*\(/.exec(line) || /^\s{2}const\s+([A-Za-z0-9_]+)\s*=\s*(?:\([^)]*\)|[A-Za-z0-9_]+)\s*=>/.exec(line) || /^\s{2}router\.(get|post|put|delete)\("([^"]+)"/.exec(line);
      if (head) current = head[2] ? `${head[1]} ${head[2]}` : head[1];
      if (line.includes(needle) && !/^\s*\/\//.test(line)) found.add(current);
    }
    return [...found].sort();
  };
  it("routes/plans.mjs: kartın kendi biçimini (shape) okuyan yerler — detail (yazım içi), detailView (pencere, PDF; kuyruk), forCase (kayıt detayı; kuyruk), forAccount (cari kartı; queueSummaryOf)", () => {
    const text = read("server/routes/plans.mjs");
    assert.deepEqual([...new Set([...callersOf(text, "shape(plan"), ...callersOf(text, "shape(planRow")])].sort(), ["detail", "detailView", "forAccount", "forCase"].sort(), "yeni bir 'shape(' çağıranı yer tablosuna (tasarım §15.1) ve bu teste eklenmeli");
    const body = name => {
      const start = text.indexOf(`function ${name}(`) >= 0 ? text.indexOf(`function ${name}(`) : text.indexOf(`const ${name} = `);
      return text.slice(start, start + 1400);
    };
    assert.ok(body("forCase").includes("withQueue("), "kayıt detayı (forCase) kuyruk görünümünü verir — S129 = A");
    assert.ok(body("detailView").includes("withQueue("), "kart penceresi (detailView) kuyruk görünümünü verir");
  });
  it("routes/plans.mjs ve öbür yollar: kartın kendi hesabını (allocate) kuran her yer kuyruk görünümüne bağlı ya da iç çağıran olarak listede", () => {
    const allowed = new Map([
      // assertRoom: K8 sınırı / S118 = B (formun sınırı kartın KENDİ kalanından — yer tablosu 7, 19).
      ["server/routes/plans.mjs", ["assertRoom", "dueItems", "list", "openItems", "shape", "summariesByAccount"]],
    ]);
    // Rapor Merkezi: kartın kendi hesabını kuran HER satır aynı satırda (viewOf) ya da hemen ardından (queueLedger) kuyruk görünümüne geçer.
    const rc = read("server/routes/report-center.mjs").split(/\r?\n/);
    const rcCalls = rc.map((line, index) => [line, index]).filter(([line]) => line.includes("allocate(") && !/^\s*\/\//.test(line) && !line.includes("import "));
    assert.equal(rcCalls.length, 2, "Rapor Merkezi: allocate( çağıran iki yer (aylık performans, taksit vade / geciken raporları) — yeni yer yer tablosuna eklenmeli");
    for (const [line, index] of rcCalls) assert.ok(line.includes("viewOf(") || rc.slice(index, index + 3).some(next => next.includes("queueLedger")), `Rapor Merkezi satır ${index + 1}: kuyruk görünümü yok`);
    for (const [rel, expected] of allowed) {
      const got = callersOf(read(rel), "allocate(").filter(name => !name.startsWith("allocate"));
      assert.deepEqual(got, expected.sort(), `${rel}: allocate( çağıranları — yeni bir yer yer tablosuna (tasarım §15.1) ve bu teste eklenmeli`);
    }
    const plans = read("server/routes/plans.mjs");
    for (const name of ["list", "dueItems", "openItems"]) {
      const start = plans.indexOf(`function ${name}(`);
      assert.ok(plans.slice(start, start + 3200).includes("withQueue("), `${name}: kuyruk görünümü`);
    }
    const sums = plans.slice(plans.indexOf("function summariesByAccount("), plans.indexOf("function summariesByAccount(") + 3200);
    assert.ok(sums.includes("withQueue("), "summariesByAccount (Cari Listesi): kuyruk görünümü (view)");
  });
  it("routes/accounts.mjs: cari kartının taksit özeti queueSummaryOf (durum + sıradaki + Tahsil Edilen / Kalan), Cari Listesi kuyruğu summariesByAccount'a verir", () => {
    const text = read("server/routes/accounts.mjs");
    assert.ok(text.includes("plans().queueSummaryOf(plan, tyk)"), "cari kartı (8, 8b): queueSummaryOf");
    assert.ok(text.includes("summariesByAccount(ids, { queue: tykAll })"), "Cari Listesi (12): kuyruk");
    assert.ok(/planOverdueCount \+= plan\.view \? plan\.view\.overdueCount/.test(text) && text.includes("const planNext = plan.view ? plan.view.next : plan.next;"), "Cari Listesi satırı: N geciken + sıradaki kuyruktan");
  });
  it("istemci: kart sayılarını gösteren dosyalar listede — yeni bir dosya kart toplamlarını okursa yer tablosuna eklenmeli", () => {
    const dir = path.join(ROOT, "client/assets");
    const files = ["hof-accounts.js", "hof-cheques.js", "hof-plans.js", "hof-workspace.js", "hof-whatsapp.js"];
    const scanned = readFileSync(path.join(ROOT, "client/index.html"), "utf8").match(/assets\/hof-[a-z0-9-]+\.js/g) || [];
    const readers = [...new Set(scanned)].map(rel => rel.replace("assets/", "")).filter(name => {
      try {
        return /plan\.totals\.(paid|remaining)|\.totals\.planRemaining|planRemaining\)|plan\.next\b|\.next\.dueDate/.test(readFileSync(path.join(dir, name), "utf8"));
      } catch {
        return false;
      }
    });
    for (const name of readers) assert.ok(files.includes(name), `${name} kart toplamlarını / sıradaki taksiti okuyor — yer tablosuna (tasarım §15.1) ve bu listeye eklenmeli`);
    // Kayıt detayı: ₺ / Tahsil Et düğmesi kartın KENDİ kalanından (S118 = B).
    const ws = readFileSync(path.join(dir, "hof-workspace.js"), "utf8");
    assert.equal((ws.match(/canCollect && ownLeft\(item\) > 0\.005/g) || []).length, 2, "kayıt detayının iki düğmesi kendi kalanından");
  });
});

// ---------------- İş 2 (dar kontrol Ç5-B kapanış 2 DÜŞÜK-C): "Kalanı Aşan Tutar" sorusunun metni formun nitelemesini taşır; KURAL değişmez (S118 = B) ----------------
describe("Birleşik tur 8 — İş 2: 'Kalanı Aşan Tutar' sorusu kartın KENDİ kalanını niteleyerek söyler (S118 = B kuralı aynen)", () => {
  let server;
  let api;
  before(async () => {
    server = await startTestServer({ now: steppingClock(), env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
    const client = await loginAdmin(server);
    api = { get: async url => unwrap(await client.get(url)), post: async (url, body) => unwrap(await client.post(url, body)) };
    await api.post("/api/workspace/bank/setup/dismiss", {});
  });
  after(async () => server?.close());
  it("kart 900 (3 × 300) + bağsız 500 (pencere: Kalan 400): 901 → 409 plan-overpay, ileti 'kartın kendi tahsilatlarına göre kalan 900,00 TL'; 900 kabul (sınır kartın kendi kalanı)", async () => {
    const acc = (await api.post("/api/workspace/accounts", { name: "Tur8 Soru Metni", type: "customer", registeredOn: day(-400), phone: "0500 288 99 01" })).data;
    const plan = (await api.post("/api/workspace/plans", { name: acc.name, registeredOn: day(-40), total: "900", accountId: acc.id, mode: "auto", count: "3", firstDue: day(-10), everyMonths: "1" })).data;
    assert.equal((await api.post(`/api/workspace/accounts/${acc.id}/entries`, { kind: "in", amount: "500", date: day(-5), method: "cash", cashForce: true, similarOk: true })).status, 200);
    assert.equal((await api.get(`/api/workspace/plans/${plan.id}`)).data.totals.remaining, 400, "ön koşul: pencerenin Kalan'ı (kuyruk) 400");
    const over = await api.post(`/api/workspace/plans/${plan.id}/entries`, { kind: "in", amount: "901", method: "cash", date: day(-1), cashForce: true, similarOk: true });
    assert.deepEqual([over.status, over.data?.code ?? over.data?.error?.code], [409, "plan-overpay"], "kural aynı: sınır kartın kendi kalanı (S118 = B)");
    const message = String(over.data?.message || over.data?.error?.message || over.data?.error || "");
    assert.match(message, /Tutar kartın kalanını aşıyor: kartın kendi tahsilatlarına göre kalan 900,00 TL, girilen 901,00 TL, fazlası 1,00 TL;/, `soru metni nitelemeyi taşır: ${message}`);
    const okay = await api.post(`/api/workspace/plans/${plan.id}/entries`, { kind: "in", amount: "900", method: "cash", date: day(-1), cashForce: true, similarOk: true });
    assert.equal(okay.status, 200, "kartın kendi kalanı kadar tahsilat kabul (kural değişmedi)");
  });
});
