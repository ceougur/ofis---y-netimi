// 2.4.3 SON ADAY 05e64d0 — GERÇEK EDM TEST ORTAMI (19.10.2026). Programın kendi API'siyle (gerçek sunucu kodu, sahte EDM YOK):
//   1 e-Fatura (mükellef, PK seçili) Kaydet ve Gönder · 2 e-Arşiv (kişi + Nihai Tüketici KÖ1) · 3 MM1 kâğıt asıllı iade (e-Fatura + e-Arşiv)
//   4 e-Fatura iadesi (Ticari istek → Temel, MM2) · 5 Tümünü Gönder (7 numarasız bekleyen, karışık tarih) · 6 Müşteri Fişi Olarak Bırak (KÖ2)
//   7 resmî PDF + karekod (jsQR; beklenen tutarlar ELLE hesaplı).
// Kimlik bilgisi yalnız yüklenen dosyadan (argv[2]); bütün çıktı maskelenir. Yalnız EDM TEST ortamı. Lisans servisi 127.0.0.1:9.
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
const R = path.resolve(new URL(".", import.meta.url).pathname, "../../../..");
const { startTestServer, ADMIN_PASSWORD } = await import(`${R}/test/helpers.mjs`);
const jsQR = (await import(`${R}/node_modules/jsqr/dist/jsQR.js`)).default;
const t = readFileSync(process.argv[2], "utf8");
const username = (t.match(/kullan[ıi]c[ıi] ad[ıi]\s*:\s*(\S+)/i) || [])[1];
const password = (t.match(/şifre\s*:\s*(\S+)/i) || [])[1];
if (!username || !password) throw new Error("kimlik dosyası okunamadı");
const OUT = process.argv[3]; mkdirSync(OUT, { recursive: true });
const mask = v => String(v).split(password).join("***").split(username).join("<kullanıcı>");
const log = (label, value) => console.log(mask(`${new Date().toISOString().slice(11, 19)} ${label}: ${typeof value === "string" ? value : JSON.stringify(value)}`).slice(0, 1600));
const unwrap = r => ({ ...r, data: r.data && typeof r.data === "object" && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data });
let failed = 0;
const check = (cond, what) => { if (!cond) failed += 1; console.log(mask(`  ${cond ? "✓" : "✗"} ${what}`)); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const server = await startTestServer({ edocEnabled: true, edocLive: true, testSeriesStart: null, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
const c = server.client(); await c.login("admin", ADMIN_PASSWORD);
const api = { get: async u => unwrap(await c.get(u)), post: async (u, b) => unwrap(await c.post(u, b)), put: async (u, b) => unwrap(await c.put(u, b)) };
const store = server.app.store;
const brief = d => ({ number: d?.number, profile: d?.profile, typeCode: d?.typeCode, eStatus: d?.eStatus, eMessage: d?.eMessage ? String(d.eMessage).slice(0, 300) : undefined, issueDate: d?.issueDate, payable: d?.money?.payable ?? d?.payable, code: d?.code, error: d?.error });
const day = off => { const x = new Date(); x.setDate(x.getDate() + off); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`; };

const SELLER = { name: "DENEME TICARET LTD. STI.", taxNo: "3230512384", taxOffice: "Kadıköy", address: "Test Cd. 1", district: "Kadıköy", city: "İstanbul", postalCode: "34000", email: "test@destekofis.com.tr" };
const s = await api.put("/api/workspace/invoices/settings", { seller: SELLER, efatura: true, earsiv: true, integrator: { env: "test", baseUrl: "", username, password, senderAlias: "urn:mail:defaultgb@edmbilisim.com.tr", mailboxAlias: "urn:mail:defaultpk@edmbilisim.com.tr" } });
log("AYAR", { status: s.status, testNumbers: s.data?.testNumbers, err: s.data?.error });
const conn = await api.post("/api/workspace/invoices/integrator/test", {});
log("BAĞLANTI SINAMASI", { status: conn.status, ok: conn.data?.ok, message: conn.data?.message || conn.data?.error });

const acc = async body => { const r = await api.post("/api/workspace/accounts", body); if (r.status !== 200) log("CARİ HATA", { status: r.status, data: r.data }); return r.data.id || r.data.account?.id; };
const firm = await acc({ name: "DENEME TICARET LTD. STI.", type: "customer", taxNo: "3230512384", taxOffice: "Kadıköy", address: "Test Cd. 1", district: "Kadıköy", city: "İstanbul" });
const person = await acc({ name: "Ahmet Yılmaz", type: "customer", partyKind: "person", firstName: "Ahmet", familyName: "Yılmaz", taxNo: "10000000146", taxOffice: "Kadıköy", city: "İstanbul", address: "Deneme Sk. 2", district: "Kadıköy" });
const supplier = await acc({ name: "TEST BILISIM", type: "supplier", taxNo: "4840847211", taxOffice: "TEST", address: "Test", district: "TEST", city: "TEST", eProfile: "TICARIFATURA" });
const paperSupplier = await acc({ name: "Kâğıtçı Mehmet Demir", type: "supplier", partyKind: "person", firstName: "Mehmet", familyName: "Demir", taxNo: "10000000078", taxOffice: "Konak", address: "Kordon 5", district: "Konak", city: "İzmir" });
for (const [label, taxNo, accountId] of [["müşteri firma", "3230512384", firm], ["tedarikçi", "4840847211", supplier], ["kâğıt tedarikçi (şahıs)", "10000000078", paperSupplier]]) {
  const q = await api.post("/api/workspace/invoices/check-user", { taxNo, accountId });
  const row = store.get("SELECT e_invoice AS f, e_alias AS alias FROM accounts WHERE id = ?", accountId);
  log(`MÜKELLEF SORGULA ${label}`, { status: q.status, registered: q.data?.registered, mailboxes: q.data?.aliases, kart: row });
}
const L = (price, name = "Hizmet Satışı", vat = 20) => [{ name, qty: 1, unitPrice: price, vatRate: vat }];
const tracked = []; // durum sorgusu + resmî PDF için

// ── 5) TÜMÜNÜ GÖNDER — önce (eski tarihli belgeler serinin ilk numaralarını almalı; sonraki adımlar bugün tarihli)
console.log("\n■ 5) Tümünü Gönder: 7 numarasız bekleyen (Kes, Sonra Gönder), karışık tarih ve kayıt sırası");
const plan5 = [["e-Arşiv", person, -1, 110], ["e-Fatura", firm, 0, 210], ["e-Arşiv", person, -2, 120], ["e-Fatura", firm, -1, 220], ["e-Arşiv", person, 0, 130], ["e-Fatura", firm, -2, 230], ["e-Arşiv", person, -2, 140]];
const docs5 = [];
for (const [label, accountId, off, price] of plan5) {
  const r = await api.post("/api/workspace/invoices", { scenario: "service_sale", accountId, issueDate: day(off), lines: L(price), payment: { rest: "open" }, eSend: "later" });
  log(`5 KAYDET (Kes, Sonra Gönder) ${label} ${day(off)}`, { status: r.status, ...brief(r.data) });
  docs5.push({ label, id: r.data.id, date: day(off), price, order: docs5.length });
}
check(docs5.every(d => !store.get("SELECT number FROM invoices WHERE id = ?", d.id).number), "5: 7 belge numarasız bekliyor");
let cursor = null; let turn = 0; let total = { sent: 0, failed: 0 };
while (turn < 12) {
  turn += 1;
  const r = await api.post("/api/workspace/invoices/send-pending", { all: true, ...(cursor ? { after: cursor } : {}) });
  log(`5 TÜMÜNÜ GÖNDER istek ${turn}`, { status: r.status, sent: r.data?.sent, failed: r.data?.failed, skipped: r.data?.skipped, remaining: r.data?.remaining, rerun: r.data?.rerun, stopped: r.data?.stopped, results: (r.data?.results || []).map(x => ({ ok: x.ok, code: x.code, number: x.number, message: x.message ? String(x.message).slice(0, 200) : undefined })) });
  if (r.status !== 200) break;
  total.sent += r.data.sent || 0; total.failed += r.data.failed || 0;
  cursor = r.data.cursor;
  if (!r.data.remaining && !r.data.rerun) break;
}
const rows5 = docs5.map(d => ({ ...d, ...store.get("SELECT number, series, seq, issue_date AS issueDate, e_status AS eStatus, profile FROM invoices WHERE id = ?", d.id) }));
for (const series of ["TEA", "TEF"]) {
  const list = rows5.filter(x => x.series === series).sort((a, b) => a.seq - b.seq);
  log(`5 SERİ ${series}`, list.map(x => ({ number: x.number, tarih: x.issueDate, kayitSirasi: x.order, eStatus: x.eStatus })));
  const consecutive = list.every((x, i) => i === 0 || x.seq === list[i - 1].seq + 1);
  const dateOrder = list.every((x, i) => i === 0 || x.issueDate > list[i - 1].issueDate || (x.issueDate === list[i - 1].issueDate && x.order > list[i - 1].order));
  check(list.length === (series === "TEA" ? 4 : 3) && consecutive, `5 ${series}: ${list.length} belge, numaralar boşluksuz ardışık`);
  check(dateOrder, `5 ${series}: numara sırası = tarih sırası (aynı gün kayıt sırası)`);
}
check(rows5.every(x => ["sent", "processing", "accepted"].includes(x.eStatus)), `5: 7 belgenin hepsi EDM'ye iletildi (gönderilen ${total.sent}, hata ${total.failed})`);
for (const x of rows5) tracked.push({ step: `5 ${x.label} ${x.issueDate}`, id: x.id });

// ── 1) e-FATURA Kaydet ve Gönder
console.log("\n■ 1) e-Fatura (mükellef, PK seçili) Kaydet ve Gönder");
const r1 = await api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: firm, lines: [{ name: "Danışmanlık", qty: 2, unitPrice: 500, vatRate: 20 }, { name: "Bakım", qty: 1, unitPrice: 250, vatRate: 10 }], payment: { rest: "open" }, eSend: "now" });
log("1 KAYDET VE GÖNDER", { status: r1.status, ...brief(r1.data), autoSend: r1.data?.autoSend });
check(r1.status === 200 && r1.data.profile !== "EARSIVFATURA" && /^TEF/.test(r1.data.number || "") && r1.data.autoSend?.ok, "1: e-Fatura TEF numarasıyla kaydedildi ve EDM'ye iletildi");
tracked.push({ step: "1 e-Fatura", id: r1.data.id, qr: { malhizmettoplam: "1250.00", "kdvmatrah(10)": "250.00", "hesaplanankdv(10)": "25.00", "kdvmatrah(20)": "1000.00", "hesaplanankdv(20)": "200.00", vergidahil: "1475.00", odenecek: "1475.00", avkntckn: "3230512384", tip: "SATIS" } });

// ── 2) e-ARŞİV: kişi + Nihai Tüketici (KÖ1)
console.log("\n■ 2) e-Arşiv: kişi alıcı + Nihai Tüketici hızlı seçeneği (KÖ1)");
const r2 = await api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: person, lines: L(300, "Bakım"), payment: { rest: "open" }, eSend: "now" });
log("2a KAYDET VE GÖNDER kişi", { status: r2.status, ...brief(r2.data), autoSend: r2.data?.autoSend });
check(r2.status === 200 && r2.data.profile === "EARSIVFATURA" && r2.data.autoSend?.ok, "2a: kişiye e-Arşiv iletildi");
tracked.push({ step: "2a e-Arşiv kişi", id: r2.data.id, qr: { malhizmettoplam: "300.00", "kdvmatrah(20)": "300.00", "hesaplanankdv(20)": "60.00", vergidahil: "360.00", odenecek: "360.00", avkntckn: "10000000146", tip: "SATIS" } });
const k1 = await api.post("/api/workspace/invoices/retail-account", {});
const k1b = await api.post("/api/workspace/invoices/retail-account", {});
log("2b NİHAİ TÜKETİCİ", { ilk: { status: k1.status, ...k1.data }, ikinci: { status: k1b.status, ...k1b.data }, kart: store.get("SELECT name, tax_no AS taxNo, city, district FROM accounts WHERE id = ?", k1.data.id), adet: store.get("SELECT COUNT(*) AS n FROM accounts WHERE tax_no = '11111111111'").n });
check(k1.data.created === true && k1b.data.created === false && k1.data.id === k1b.data.id, "2b: Nihai Tüketici carisi bir kez açıldı, ikinci basışta aynı cari");
const r2b = await api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: k1.data.id, lines: L(150, "Perakende Satış"), payment: { cash: [{ amount: 180, method: "cash" }], rest: "open" }, eSend: "now" });
log("2b KAYDET VE GÖNDER Nihai Tüketici", { status: r2b.status, ...brief(r2b.data), autoSend: r2b.data?.autoSend });
check(r2b.status === 200 && r2b.data.profile === "EARSIVFATURA" && r2b.data.autoSend?.ok, "2b: Nihai Tüketici (11111111111) e-Arşiv iletildi");
tracked.push({ step: "2b e-Arşiv Nihai Tüketici", id: r2b.data.id, qr: { malhizmettoplam: "150.00", "kdvmatrah(20)": "150.00", "hesaplanankdv(20)": "30.00", vergidahil: "180.00", odenecek: "180.00", avkntckn: "11111111111", tip: "SATIS" } });
const big = await api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: k1.data.id, lines: L(30000, "Perakende Satış"), payment: { rest: "open" }, eSend: "now" });
log("2c Nihai Tüketici 36.000 TL (sınır üstü)", { status: big.status, code: big.data?.code, error: String(big.data?.error || "").slice(0, 300) });
check(big.status === 400 || big.status === 409, "2c: 30.000 TL üstü Nihai Tüketici kaydedilmedi (gerçek kimlik istendi)");

// ── 3) MM1: kâğıt asıllı alış faturasının iadesi
console.log("\n■ 3) MM1: kâğıt numaralı ('A 004512') asıl faturanın iadesi");
for (const [label, accountId, number, price] of [["e-Fatura (mükellef tedarikçi)", supplier, "A 004512", 500], ["e-Arşiv (mükellef olmayan şahıs)", paperSupplier, "KR-77/2026", 50]]) {
  const p = await api.post("/api/workspace/invoices", { kind: "purchase", accountId, issueDate: day(-10), number, profile: "KAGIT", lines: [{ name: "Toner", qty: 4, unitPrice: price, vatRate: 20, goods: true }], payment: { rest: "open" } });
  log(`3 ${label} ALIŞ`, { status: p.status, ...brief(p.data) });
  const body = { kind: "purchase_return", originalId: p.data.id, accountId, lines: [{ originLineId: p.data.lines[0].id, qty: 1 }], payment: {} };
  const calc = await api.post("/api/workspace/invoices/calc", body);
  log(`3 ${label} HESAP`, { status: calc.status, returnRef: calc.data?.returnRef, profile: calc.data?.profile });
  const none = await api.post("/api/workspace/invoices", { ...body, eSend: "now" });
  log(`3 ${label} REFERANSSIZ KAYIT`, { status: none.status, code: none.data?.code, field: none.data?.field, error: String(none.data?.error || "").slice(0, 400) });
  const saved = await api.post("/api/workspace/invoices", { ...body, returnRef: calc.data?.returnRef?.suggested, eSend: "now" });
  log(`3 ${label} ÖNERİLEN REFERANSLA KAYDET VE GÖNDER`, { status: saved.status, ...brief(saved.data), returnRef: saved.data?.returnRef, autoSend: saved.data?.autoSend });
  const xml = await api.get(`/api/workspace/invoices/${saved.data.id}/ubl.xml`);
  const x = String(typeof xml.data === "string" ? xml.data : xml.text);
  log(`3 ${label} UBL`, { ProfileID: (x.match(/<cbc:ProfileID>([^<]*)</) || [])[1], InvoiceTypeCode: (x.match(/<cbc:InvoiceTypeCode>([^<]*)</) || [])[1], BillingReference: (x.match(/<cac:BillingReference>[\s\S]*?<\/cac:BillingReference>/) || [])[0], asilKayit: store.get("SELECT number FROM invoices WHERE id = ?", p.data.id).number });
  check(calc.data?.returnRef?.needed === true && calc.data.returnRef.suggested?.length === 16, `3 ${label}: öneri 16 karakter (${calc.data?.returnRef?.suggested})`);
  check(saved.status === 200 && saved.data.autoSend?.ok, `3 ${label}: önerilen referansla iade EDM'ye iletildi`);
  tracked.push({ step: `3 MM1 ${label}`, id: saved.data.id, mm1: true });
}

// ── 4) e-Fatura iadesi; Ticari istek → Temel (MM2)
console.log("\n■ 4) e-Fatura iadesi: Ticari profilli tedarikçi, iade TEMELFATURA (MM2)");
{
  const p = await api.post("/api/workspace/invoices", { kind: "purchase", accountId: supplier, issueDate: day(-5), number: "TBS2026000000123", profile: "TICARIFATURA", lines: [{ name: "Toner", qty: 10, unitPrice: 500, vatRate: 20, goods: true }], payment: { rest: "open" } });
  log("4 ALIŞ (Ticari)", { status: p.status, ...brief(p.data) });
  const body = { kind: "purchase_return", originalId: p.data.id, accountId: supplier, lines: [{ originLineId: p.data.lines[0].id, qty: 2 }], payment: {} };
  const calc = await api.post("/api/workspace/invoices/calc", body);
  log("4 HESAP", { status: calc.status, returnRef: calc.data?.returnRef, profile: calc.data?.profile });
  const saved = await api.post("/api/workspace/invoices", { ...body, profile: "TICARIFATURA", eSend: "now" });
  log("4 KAYDET VE GÖNDER (Ticari istendi)", { status: saved.status, ...brief(saved.data), autoSend: saved.data?.autoSend });
  const xml = await api.get(`/api/workspace/invoices/${saved.data.id}/ubl.xml`);
  const x = String(typeof xml.data === "string" ? xml.data : xml.text);
  log("4 UBL", { ProfileID: (x.match(/<cbc:ProfileID>([^<]*)</) || [])[1], InvoiceTypeCode: (x.match(/<cbc:InvoiceTypeCode>([^<]*)</) || [])[1], BillingReference: (x.match(/<cac:BillingReference>[\s\S]*?<\/cac:BillingReference>/) || [])[0] });
  check(saved.status === 200 && saved.data.profile === "TEMELFATURA" && /<cbc:ProfileID>TEMELFATURA</.test(x) && /<cbc:InvoiceTypeCode>IADE</.test(x), "4: iade TEMELFATURA + IADE (Ticari istek Temel'e döndü)");
  check(saved.data.autoSend?.ok === true, "4: iade EDM'ye iletildi");
  tracked.push({ step: "4 e-Fatura iade", id: saved.data.id, qr: { malhizmettoplam: "1000.00", "kdvmatrah(20)": "1000.00", "hesaplanankdv(20)": "200.00", vergidahil: "1200.00", odenecek: "1200.00", avkntckn: "4840847211", tip: "IADE" } });
}

// ── 6) Müşteri Fişi Olarak Bırak (KÖ2)
console.log("\n■ 6) Müşteri Fişi Olarak Bırak (KÖ2)");
{
  const r = await api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: person, lines: L(77, "Fiş Hizmeti"), payment: { rest: "open" }, eSend: "later" });
  log("6 KAYDET (Kes, Sonra Gönder)", { status: r.status, ...brief(r.data), canWithdraw: r.data?.canWithdraw });
  const w = await api.post(`/api/workspace/invoices/${r.data.id}/withdraw`, {});
  log("6 MÜŞTERİ FİŞİ OLARAK BIRAK", { status: w.status, ...brief(w.data), canSend: w.data?.canSend, canRefresh: w.data?.canRefresh, canOfficial: w.data?.canOfficial });
  const ref = await api.post(`/api/workspace/invoices/${r.data.id}/e-refresh`, {});
  const ev = store.all("SELECT type FROM audit_events WHERE entity_id = ? ORDER BY created_at", r.data.id).map(e => e.type);
  log("6 DURUM SORGULA + DENETİM İZİ", { eRefresh: { status: ref.status, code: ref.data?.code, error: ref.data?.error }, olaylar: ev, ettnEdmde: store.get("SELECT e_status AS eStatus, e_at AS eAt FROM invoices WHERE id = ?", r.data.id) });
  check(w.status === 200 && w.data.profile === "KAGIT" && /^FIS/.test(w.data.number || "") && w.data.eStatus === "withdrawn", `6: belge Müşteri Fişi oldu (${w.data?.number})`);
  check(!ev.some(type => /invoice\.e\.(sent|send|draft)/.test(type)) && ref.status === 409, "6: EDM'ye gönderim olayı yok, Durum Sorgula 409 (entegratöre gitmedi)");
}

// ── Durum sorgusu (EDM) + 7) resmî PDF ve karekod
console.log("\n■ Durum Sorgula (EDM) — son durum beklenir");
const pending = new Set(tracked.map(d => d.id));
for (let round = 1; round <= 16 && pending.size; round += 1) {
  for (const d of tracked.filter(item => pending.has(item.id))) {
    const st = await api.post(`/api/workspace/invoices/${d.id}/e-refresh`, {});
    d.status = st.data?.eStatus; d.number = st.data?.number; d.ettn = st.data?.ettn; d.issueDate = st.data?.issueDate; d.eMessage = st.data?.eMessage;
    if (st.status !== 200) { d.status = `HTTP ${st.status}`; d.eMessage = st.data?.error; }
    if (st.status !== 200 || st.data.eStatus !== "processing") pending.delete(d.id);
  }
  log(`DURUM turu ${round}`, tracked.map(d => `${d.number}=${d.status}`).join(" "));
  if (pending.size) await sleep(45_000);
}
for (const d of tracked) {
  log(`SON DURUM ${d.step}`, { number: d.number, eStatus: d.status, eMessage: d.eMessage ? String(d.eMessage).slice(0, 300) : "" });
  check(["sent", "accepted"].includes(d.status), `${d.step} ${d.number}: EDM son durum ${d.status}`);
}

console.log("\n■ 7) Resmî PDF + karekod");
const readQr = (pdf, name) => {
  writeFileSync(`${OUT}/${name}.pdf`, pdf);
  execFileSync("pdftoppm", ["-r", "200", "-gray", "-f", "1", "-l", "1", `${OUT}/${name}.pdf`, `${OUT}/${name}`]);
  const pgm = readdirSync(OUT).find(f => f.startsWith(`${name}-`) && f.endsWith(".pgm"));
  const file = readFileSync(`${OUT}/${pgm}`);
  const header = file.toString("latin1", 0, 64).split(/\s+/);
  const width = Number(header[1]), height = Number(header[2]);
  const start = file.length - width * height;
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) { const v = file[start + i]; rgba[i * 4] = rgba[i * 4 + 1] = rgba[i * 4 + 2] = v; rgba[i * 4 + 3] = 255; }
  execFileSync("rm", ["-f", `${OUT}/${pgm}`]);
  const found = jsQR(rgba, width, height);
  return found ? { data: found.data, sol: found.location.topLeftCorner.x / width, ust: found.location.topLeftCorner.y / height } : null;
};
for (const d of tracked.filter(item => item.qr || item.mm1)) {
  const r = await c.raw("GET", `/api/workspace/invoices/${d.id}/resmi.pdf`);
  let cached; try { cached = execFileSync("find", [server.dataDir, "-path", "*e-belge-gorunum*", "-name", `${d.ettn}*`]).toString().trim().split("\n").filter(Boolean).map(f => path.relative(server.dataDir, f)); } catch (e) { cached = `okunamadı: ${e.message}`; }
  if (r.status !== 200) { log(`7 RESMÎ PDF ${d.step}`, { status: r.status, body: String(r.buffer || "").slice(0, 300) }); check(false, `7 ${d.step}: resmî PDF ${r.status}`); continue; }
  const qr = readQr(r.buffer, `${d.number}-resmi`);
  const json = qr ? JSON.parse(qr.data) : null;
  const want = { vkntckn: "3230512384", no: d.number, ettn: d.ettn, tarih: d.issueDate, parabirimi: "TRY", ...(d.qr || {}) };
  const diff = json ? Object.entries(want).filter(([k, v]) => json[k] !== v).map(([k, v]) => `${k}: beklenen ${v}, okunan ${json[k]}`) : ["karekod okunamadı"];
  log(`7 RESMÎ PDF ${d.step}`, { status: r.status, tip: r.headers.get("content-type"), bayt: r.buffer.length, disposition: r.headers.get("content-disposition"), onbellek: cached, karekod: Boolean(qr), sagUst: qr ? `${qr.sol.toFixed(2)},${qr.ust.toFixed(2)}` : "", farklar: diff, json: qr?.data });
  check(Boolean(qr) && !diff.length, `7 ${d.step} ${d.number}: resmî PDF indi, karekod çözüldü, ${d.qr ? "tutarlar ELLE hesapla aynı" : "no/ETTN/tarih aynı"}`);
}
log("SONUÇ", failed ? `${failed} denetim KALDI` : "hepsi geçti");
await server.close();
process.exit(failed ? 1 : 0);
