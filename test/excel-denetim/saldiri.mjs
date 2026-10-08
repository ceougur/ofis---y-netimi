// Hatalı ve yetkisiz işlem denemeleri (kötü niyetli personel gözüyle). Kod DEĞİŞTİRİLMEZ; her denemenin beklenen ve
// gerçek sonucu yazılır. 001/002'ye yalnız yetkisiz/okuma denemesi yapılır (denetlenen sayılar kirlenmesin, sonunda
// değişmediği kanıtlanır); veri bozan denemeler ayrı açılan 003 deneme şirketinde yapılır.
// Kullanım: SP=<çalışma> node saldiri.mjs
import zlib from "node:zlib";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { HERE, PASS, STAFF_PASS, staff, startServer } from "./ortak.mjs";

const SP = process.env.SP || path.join(HERE, "calisma");
const ROOT = path.join(SP, "canli");
const OUT = path.join(HERE, "cikti");
const state = JSON.parse(fs.readFileSync(path.join(ROOT, "durum.json"), "utf8"));
// 001 ve 002 gerçek veri; veri bozan denemeler 003 deneme şirketinde. Program en fazla 2 şirkete izin verdiği için
// (2.0.25; sınırın kendisi test/sirket-siniri-225'te sınanır) bu araç sınırı 3'e yükseltir.
const app = startServer(ROOT, { fresh: false, maxCompanies: 3 });
const { port } = await app.listen(0, "127.0.0.1");
const BASE = `http://127.0.0.1:${port}`;
const C1 = state.companies["001"];
const C2 = state.companies["002"];
const results = [];
let group = "";
const record = (name, expected, actual, ok, detail = "") => {
  results.push({ group, name, expected, actual, ok, detail });
  console.log(`${ok ? "✓" : "✗ BULGU"} [${group}] ${name}\n     beklenen: ${expected}\n     gerçek:   ${actual}${detail ? `\n     ayrıntı: ${detail}` : ""}`);
};
const short = r => `HTTP ${r.status}${r.data?.code ? ` (${r.data.code})` : ""} ${String(r.data?.error || (typeof r.data === "string" ? r.data : "")).slice(0, 160)}`;
const denied = r => r.status === 401 || r.status === 403 || r.status === 404;
const as = async (username, company, password = STAFF_PASS) => {
  const s = staff(BASE, company);
  const r = await s.login(username, password);
  if (r.status !== 200) throw new Error(`${username}: ${JSON.stringify(r.data)}`);
  return s;
};
const admin = await as("admin", "", PASS);
const fingerprint = async company => {
  const c = admin.withCompany(company);
  const acc = (await c.get("/api/workspace/accounts?status=all&limit=5000")).data.accounts;
  const cash = (await c.get("/api/workspace/cash?period=all")).data.totals;
  const inv = (await c.get("/api/workspace/invoices?tab=sale")).data.tabCounts;
  const ch = (await c.get("/api/workspace/cheques?status=all&limit=5000")).data;
  return JSON.stringify({ acc: acc.length, bal: acc.reduce((t, a) => t + a.balance, 0).toFixed(2), cash, inv, ch: (ch.cheques || ch.rows || []).length });
};
const before = { "001": await fingerprint(C1), "002": await fingerprint(C2) };

try {
  // ---------------------------------------------------------------- Yetki ve şirket ayrımı
  group = "Yetki ve Şirket Ayrımı";
  const s1 = await as("satis001", C1);
  const s1on2 = s1.withCompany(C2);
  let r = await s1on2.get("/api/workspace/accounts?limit=5");
  record("Yalnız 001 yetkili personel ?hofCompany=002 ile 002'nin carilerini okumaya çalışır", "reddedilir (403/404), veri dönmez", short(r), denied(r) && !r.data?.accounts);
  const someAcc2 = (await admin.withCompany(C2).get("/api/workspace/accounts?limit=1")).data.accounts[0];
  r = await s1on2.post(`/api/workspace/accounts/${someAcc2.id}/entries`, { kind: "in", amount: 1, date: "2025-09-30", method: "cash" });
  record("001 personeli ?hofCompany=002 ile 002'deki bir cariye tahsilat yazmaya çalışır", "reddedilir", short(r), denied(r));
  r = await s1.post(`/api/workspace/accounts/${someAcc2.id}/entries`, { kind: "in", amount: 1, date: "2025-09-30", method: "cash" });
  record("001 personeli 002'deki carinin kimliğini kendi şirketinde (001) kullanır", "bulunamaz (404), 001'e de yazılmaz", short(r), r.status === 404 || r.status === 400);
  r = await s1.post("/api/companies/select", { id: C2 });
  record("001 personeli kendini 002'ye geçirmeye çalışır (Şirket Seçimi)", "reddedilir", short(r), denied(r) || r.status === 400);
  r = await s1.get("/api/companies");
  const visible = (r.data?.companies || []).map(c => c.code);
  record("001 personelinin şirket listesinde ne görünür", "yalnız 001", visible.join(", "), visible.length === 1 && visible[0] === "001");
  const inv2 = (await admin.withCompany(C2).get("/api/workspace/invoices?tab=sale")).data.invoices[0];
  r = await s1.raw("GET", `/api/workspace/invoices/${inv2.id}/fatura.pdf`);
  record("001 personeli 002'nin fatura PDF'ini kimliğiyle indirmeye çalışır", "bulunamaz", `HTTP ${r.status}`, r.status === 404 || r.status === 403);
  r = await s1.raw("GET", `/api/workspace/accounts/${someAcc2.id}/ekstre.pdf?hofCompany=${C2}`);
  record("001 personeli 002'deki carinin ekstre PDF'ini ?hofCompany=002 ile indirmeye çalışır", "reddedilir", `HTTP ${r.status}`, r.status === 403 || r.status === 404);
  const intern = await as("stajyer001", C1);
  const acc1 = (await admin.withCompany(C1).get("/api/workspace/accounts?limit=1")).data.accounts[0];
  r = await intern.post("/api/workspace/invoices", { scenario: "service_sale", accountId: acc1.id, issueDate: "2025-09-30", lines: [{ name: "x", qty: 1, unitPrice: 1, vatRate: 20 }], payment: { rest: "open" } });
  record("Personel rolü (stajyer) fatura kesmeye çalışır", "403 (Fatura Kesme yetkisi yok)", short(r), r.status === 403);
  r = await intern.get("/api/workspace/cash?period=all");
  record("Personel rolü Kasa'yı görmeye çalışır", "403", short(r), r.status === 403);
  r = await intern.post("/api/workspace/cash", { kind: "out", amount: 100, date: "2025-09-30", method: "cash" });
  record("Personel rolü Kasa'dan para çıkışı yazmaya çalışır", "403", short(r), r.status === 403);
  r = await intern.post(`/api/workspace/accounts/${acc1.id}/entries`, { kind: "out", amount: 100, date: "2025-09-30", method: "cash" });
  record("Personel rolü cariye ÖDEME yazmaya çalışır (yalnız tahsilat yetkisi var)", "403", short(r), r.status === 403);
  r = await intern.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", accountId: acc1.id, amount: 100, issueDate: "2025-09-30", dueDate: "2025-10-30", serialNo: "STJ-1", bank: "x" });
  record("Personel rolü çek girmeye çalışır", "403", short(r), r.status === 403);
  for (const [label, method, url, body] of [
    ["kullanıcı listesini okumaya", "get", "/api/admin/users"],
    ["kendine yönetici kullanıcı açmaya", "post", "/api/admin/users", { username: "hacker", name: "h", role: "admin", password: "Hacker-2026-xx!", mustChangePassword: false }],
    ["yedek almaya", "post", "/api/admin/backups", { scope: "all" }],
    ["yedekten geri yüklemeye", "post", "/api/admin/backups/restore", { name: "x.sqlite", confirm: "001", password: STAFF_PASS }],
    ["dönem kilidini kaldırmaya", "put", "/api/admin/period-lock", { lockedUntil: "" }],
    ["kendi şirket yetkisini 002'ye genişletmeye", "put", `/api/companies/access/${state.users.satis001.id}`, { companies: [C1, C2] }],
    ["002 şirketini silmeye", "del", `/api/companies/${C2}`],
    ["002'nin verisini sıfırlamaya", "post", `/api/companies/${C2}/reset`, { confirm: "002", password: STAFF_PASS, mode: "all" }],
  ]) {
    r = await s1[method](url, body);
    record(`Muhasebe personeli (yönetici değil) ${label} çalışır`, "403", short(r), r.status === 403 || r.status === 401);
  }
  const anon = staff(BASE, C1);
  r = await anon.get("/api/workspace/accounts?limit=1");
  record("Oturum açmadan cari listesi istenir", "401", short(r), r.status === 401);
  r = await anon.post("/api/auth/login", { username: "admin", password: "' OR 1=1 --" });
  record("Giriş ekranında SQL enjeksiyonu (' OR 1=1 --)", "giriş reddedilir", short(r), r.status === 401 || r.status === 400 || r.status === 429);
  let locked = null;
  for (let i = 0; i < 12; i += 1) { locked = await anon.post("/api/auth/login", { username: "satis002", password: `yanlis-${i}` }); if (locked.status === 429) break; }
  record("Aynı hesaba arka arkaya 12 yanlış parola (kaba kuvvet)", "bir noktada geçici kilit / 429", short(locked), locked.status === 429, "429 yoksa sınırsız deneme açığı");
  const mudur = await as("mudur", C2);
  r = await mudur.get("/api/workspace/accounts?limit=1");
  record("Kontrol: iki şirkete yetkili müdür 002'yi okuyabilir", "200", short(r), r.status === 200);

  // ---------------------------------------------------------------- 003 deneme şirketi (veri bozan denemeler)
  group = "Girdi Bozma (003 deneme şirketi)";
  const old3 = ((await admin.get("/api/companies")).data.companies || []).find(c => c.code === "003");
  if (old3) await admin.raw("DELETE", `/api/companies/${old3.id}`, { body: JSON.stringify({ confirm: "003", password: PASS }), headers: { "content-type": "application/json" } });
  const made = await admin.post("/api/companies", { code: "003", name: "Saldırı Deneme Şirketi" });
  if (made.status !== 200 || !made.data?.company?.id) throw new Error(`003 deneme şirketi açılamadı: ${made.status} ${JSON.stringify(made.data)}`);
  const C3 = made.data.company.id;
  const t = admin.withCompany(C3);
  const cust = (await t.post("/api/workspace/accounts", { name: "Deneme Müşteri", type: "customer" })).data;
  const supp = (await t.post("/api/workspace/accounts", { name: "Deneme Tedarikçi", type: "supplier" })).data;
  const item = (await t.post("/api/workspace/stock", { name: "Deneme Ürün", code: "DNM-1", unit: "Adet", unitPrice: 10, salePrice: 20 })).data;
  const stored = res => (res.data?.entries || []).find(e => e.id === res.data?.entryId) || null;
  const entry = (kind, amount, extra = {}) => t.post(`/api/workspace/accounts/${cust.id}/entries`, { kind, amount, date: "2025-09-30", method: "cash", ...extra });
  r = await entry("in", -5000);
  record("Eksi tutarlı tahsilat (−5.000)", "400", short(r), r.status === 400);
  r = await entry("in", 0);
  record("Sıfır tutarlı tahsilat", "400", short(r), r.status === 400);
  r = await entry("in", 1e13);
  record("Devasa tutar (10 trilyon)", "400 (üst sınır 1 trilyon)", short(r), r.status === 400);
  r = await entry("in", 1e9, { cashForce: true });
  record("1 milyar TL tahsilat (üst sınırın altında)", "programın kuralı: kabul edilir (üst sınır 1 trilyon); uyarı yok", short(r), r.status === 200, "Önceki (yanlış) raporda 'sorun' denmişti; gerçekte bilinçli sınır 1e12.");
  if (r.status === 200) await t.del(`/api/workspace/accounts/${cust.id}/entries/${r.data.entryId}`);
  r = await entry("in", "10,005");
  record("Kuruş artığı (10,005 TL)", "kuruşa yuvarlanır (10,01)", short(r) + ` kaydedilen tutar=${stored(r)?.amount}`, r.status === 200 && stored(r)?.amount === 10.01);
  if (r.status === 200) await t.del(`/api/workspace/accounts/${cust.id}/entries/${r.data.entryId}`);
  r = await entry("in", "on bin");
  record("Sayı yerine metin ('on bin')", "400", short(r), r.status === 400);
  r = await entry("in", 100, { date: "2099-01-01" });
  record("İleri tarihli tahsilat (2099)", "400 / reddedilir", short(r), r.status >= 400);
  r = await entry("in", 100, { date: "2025-02-30" });
  record("Var olmayan tarih (30 Şubat)", "400", short(r), r.status === 400);
  r = await entry("in", 100, { method: "bitcoin" });
  record("Tanımsız ödeme yolu ('bitcoin')", "400 (geçersiz yol reddedilir)", short(r) + ` kaydedilen yol=${stored(r)?.method}`, r.status === 400, r.status === 200 ? `Program reddetmedi; '${stored(r)?.method}' olarak kaydetti (kullanıcı arayüzde bunu seçemez; yalnız doğrudan API ile).` : "");
  if (r.status === 200) await t.del(`/api/workspace/accounts/${cust.id}/entries/${r.data.entryId}`);
  r = await t.post("/api/workspace/accounts", { name: "x".repeat(100000), type: "customer" });
  record("100.000 karakterlik cari adı", "400 ya da kısaltılır", short(r) + ` uzunluk=${r.data?.name?.length}`, r.status === 400 || (r.data?.name?.length || 0) <= 300);
  const raw = await t.raw("POST", "/api/workspace/accounts", { body: "{bozuk json", headers: { "content-type": "application/json" } });
  record("Bozuk JSON gövdesi", "400", `HTTP ${raw.status}`, raw.status === 400);
  const big = await t.raw("POST", "/api/workspace/accounts", { body: JSON.stringify({ name: "a", note: "b".repeat(30 * 1024 * 1024) }), headers: { "content-type": "application/json" } });
  record("30 MB'lık istek gövdesi", "413 / 400 (sunucu çökmez)", `HTTP ${big.status}`, big.status === 413 || big.status === 400);
  const xss = (await t.post("/api/workspace/accounts", { name: `<img src=x onerror="window.__xss=1">Kötü <script>window.__xss=2</script>`, type: "customer", note: "=HYPERLINK(\"http://kotu.example\",\"tıkla\")" })).data;
  const formula = (await t.post("/api/workspace/accounts", { name: "=1+1", type: "customer" })).data;
  r = await t.post("/api/workspace/invoices", { scenario: "goods_sale", accountId: cust.id, issueDate: "2099-01-01", lines: [{ itemId: item.id, qty: 1, unitPrice: 20, vatRate: 20 }], payment: { rest: "open" } });
  record("İleri tarihli fatura (2099)", "400 date-future", short(r), r.status === 400 && r.data?.code === "date-future");
  r = await t.post("/api/workspace/invoices", { scenario: "goods_sale", accountId: cust.id, issueDate: "2025-09-30", lines: [{ itemId: item.id, qty: -5, unitPrice: 20, vatRate: 20 }], payment: { rest: "open" } });
  record("Eksi miktarlı satış kalemi (−5)", "400", short(r), r.status === 400);
  r = await t.post("/api/workspace/invoices", { scenario: "goods_sale", accountId: cust.id, issueDate: "2025-09-30", lines: [{ itemId: item.id, qty: 1, unitPrice: 20, vatRate: 7 }], payment: { rest: "open" } });
  record("Geçersiz KDV oranı (%7)", "400", short(r), r.status === 400);
  r = await t.post("/api/workspace/invoices", { scenario: "goods_sale", accountId: cust.id, issueDate: "2025-09-30", lines: [{ itemId: item.id, qty: 1, unitPrice: 20, vatRate: 20 }], payment: { cash: [{ amount: 1000, method: "cash" }] } });
  record("Faturadan fazla peşin tahsilat (24 TL faturaya 1.000 TL)", "400 payment-exceeds", short(r), r.status === 400);
  const s1sale = await t.post("/api/workspace/invoices", { scenario: "goods_sale", accountId: cust.id, issueDate: "2025-09-20", lines: [{ itemId: item.id, qty: 1, unitPrice: 20, vatRate: 20 }], payment: { rest: "open" }, force: true });
  r = await t.post("/api/workspace/invoices", { scenario: "goods_sale", accountId: cust.id, issueDate: "2025-09-10", lines: [{ itemId: item.id, qty: 1, unitPrice: 20, vatRate: 20 }], payment: { rest: "open" }, force: true });
  record("Son satıştan (20.09) daha eski tarihli satış (10.09) — numara/tarih sırası (VUK 231)", "400 chronology", short(r), r.status === 400 && r.data?.code === "chronology");

  group = "Dönem Kilidi (003)";
  r = await admin.withCompany(C3).put("/api/admin/period-lock", { lockedUntil: "2025-08-31" });
  record("Yönetici 003'te dönemi 31.08.2025'e kadar kilitler", "200", short(r), r.status === 200);
  r = await entry("in", 100, { date: "2025-08-15" });
  record("Kilitli döneme (15.08.2025) tahsilat", "409 reddedilir", short(r), r.status === 409 || r.status === 400);
  r = await t.post("/api/workspace/invoices", { scenario: "goods_purchase", accountId: supp.id, number: "KLT-1", issueDate: "2025-08-15", lines: [{ itemId: item.id, qty: 1, unitPrice: 10, vatRate: 20 }], payment: { rest: "open" } });
  record("Kilitli döneme alış faturası", "reddedilir", short(r), r.status === 409 || r.status === 400);
  r = await t.post("/api/workspace/invoices", { scenario: "goods_sale", accountId: cust.id, issueDate: "2025-09-21", lines: [{ itemId: item.id, qty: 1, unitPrice: 20, vatRate: 20 }], payment: { rest: "open" }, force: true });
  const lockedSale = r.data;
  r = await t.put("/api/workspace/invoices/" + s1sale.data.id, { issueDate: "2025-08-20" });
  record("Açık dönemdeki faturanın tarihini kilitli döneme çekmek", "reddedilir", short(r), r.status >= 400);
  const lock1 = await as("satis001", C1);
  r = await lock1.withCompany(C3).put("/api/admin/period-lock", { lockedUntil: "" });
  record("Yetkisiz personel 003'ün dönem kilidini kaldırmaya çalışır", "403", short(r), denied(r));
  r = await t.get("/api/workspace/ledger/lock");
  record("Kontrol: 003 kilidi yerinde", "2025-08-31", r.data?.lockedUntil, r.data?.lockedUntil === "2025-08-31");
  r = await t.get("/api/workspace/ledger/lock?hofCompany=" + C1);
  r = await admin.withCompany(C1).get("/api/workspace/ledger/lock");
  record("Kontrol: 003'ün kilidi 001'e sızmadı", "001'de kilit yok", r.data?.lockedUntil || "(yok)", !r.data?.lockedUntil);

  group = "Eşzamanlılık ve Çift Kayıt (003)";
  const body = { scenario: "goods_sale", accountId: cust.id, issueDate: "2025-09-30", lines: [{ itemId: item.id, qty: 1, unitPrice: 20, vatRate: 20 }], payment: { rest: "open" }, force: true };
  const countBefore = (await t.get("/api/workspace/invoices?tab=sale")).data.tabCounts.sale;
  const twin = await Promise.all([t.post("/api/workspace/invoices", body), t.post("/api/workspace/invoices", body)]);
  const countAfter = (await t.get("/api/workspace/invoices?tab=sale")).data.tabCounts.sale;
  record("Aynı satış faturası aynı anda iki kez gönderilir (çift tıklama / ağ tekrarı, API'de)", "tek fatura kesilir (tekrar koruması)", `${twin.map(x => x.status).join(", ")} → fatura sayısı ${countBefore} → ${countAfter}`, countAfter - countBefore === 1, countAfter - countBefore === 2 ? "Doğrudan API'de tekrar (idempotency) koruması yok: iki ayrı numaralı fatura kesildi. Arayüzdeki çift tıklama ayrıca arayüz testinde denenir." : "");
  const ser = { direction: "in", instrument: "cheque", accountId: cust.id, amount: 50, issueDate: "2025-09-30", dueDate: "2025-12-30", serialNo: "AYNI-001", bank: "Ziraat" };
  const dup = await Promise.all([t.post("/api/workspace/cheques", ser), t.post("/api/workspace/cheques", ser), t.post("/api/workspace/cheques", ser)]);
  const okCount = dup.filter(x => x.status === 200).length;
  record("Aynı seri numaralı çek aynı anda 3 kez girilir", "yalnız 1'i kabul edilir (409 cheque-duplicate)", dup.map(x => x.status).join(", "), okCount === 1);
  const plSale = (await t.post("/api/workspace/invoices", { scenario: "goods_sale", accountId: cust.id, issueDate: "2025-09-30", lines: [{ itemId: item.id, qty: 10, unitPrice: 100, vatRate: 20 }], payment: { rest: "installments", installments: { count: 3, firstDue: "2025-10-30", everyMonths: 1 } }, force: true })).data;
  const plDoc = (await t.get(`/api/workspace/invoices/${plSale.id}`)).data;
  const plan = (await t.get(`/api/workspace/plans/${plDoc.plan?.id || plDoc.planId}`)).data;
  const first = plan.items[0];
  const race = await Promise.all([0, 1, 2].map(() => t.post(`/api/workspace/plans/${plan.id}/entries`, { kind: "in", amount: first.amount, date: "2025-09-30", method: "cash", itemId: first.id, cashForce: true })));
  const plan2 = (await t.get(`/api/workspace/plans/${plan.id}`)).data;
  record("Aynı taksite (1. taksit 400 TL) aynı anda 3 tahsilat", "taksit fazla ödenmez ya da fazlası sonraki taksite/carinin alacağına düşer; toplam tutar bozulmaz", `${race.map(x => x.status).join(", ")} → kart ödenen ${plan2.totals.paid}, kalan ${plan2.totals.remaining}, 1. taksit ödenen ${plan2.items[0].paid}`, plan2.totals.paid + plan2.totals.remaining > 1199 && plan2.items[0].paid <= first.amount + 0.005, "Yaygın programlarda fazla tahsilat sonraki taksite dağıtılır.");
  await admin.withCompany(C3).put("/api/admin/negative-policy", { cash: "block" });
  const cashNow = (await t.get("/api/workspace/cash?period=all")).data.totals.balance;
  const outs = await Promise.all([0, 1].map(() => t.post(`/api/workspace/accounts/${supp.id}/entries`, { kind: "out", amount: Math.max(1, cashNow) * 0.75 + 1, date: "2025-09-30", method: "cash", cashForce: true })));
  const cashAfter = (await t.get("/api/workspace/cash?period=all")).data.totals.balance;
  record(`Eksi Kasa "Engelle" kipinde, Kasa ${cashNow} TL iken aynı anda iki büyük nakit ödeme (onay atlanarak)`, "en çok biri geçer; Kasa eksiye düşmez", `${outs.map(x => `${x.status}${x.data?.code ? `/${x.data.code}` : ""}`).join(", ")} → Kasa ${cashNow} → ${cashAfter}`, cashAfter >= -0.005);
  const ac = new AbortController();
  const aborted = fetch(`${BASE}/api/workspace/invoices?hofCompany=${C3}`, { method: "POST", signal: ac.signal, headers: { "content-type": "application/json", cookie: t.client.cookie }, body: JSON.stringify({ ...body, issueDate: "2025-09-30" }) }).catch(e => e.name);
  ac.abort();
  await aborted;
  await new Promise(res => setTimeout(res, 500));
  const integ = (await t.get("/api/workspace/ledger/integrity")).data;
  record("Fatura isteği yolda kesilir (bağlantı koparılır), sonra Mutabakat Testi", "yarım kayıt yok; Mutabakat Testi temiz", `mutabakat: ${JSON.stringify(integ?.summary || integ?.status || integ).slice(0, 220)}`, !integ?.issues?.length && integ?.ok !== false);

  group = "Silme ve Bağ Koparma (003)";
  r = await t.del(`/api/workspace/stock/${item.id}`);
  record("Faturada kullanılmış ürünü silmeye çalışmak", "409 (fatura kalemi olan ürün silinmez)", short(r), r.status === 409);
  const lonely = (await t.post("/api/workspace/accounts", { name: "Silinecek Cari", type: "customer" })).data;
  await t.del(`/api/workspace/accounts/${lonely.id}`);
  r = await t.post("/api/workspace/invoices", { ...body, accountId: lonely.id });
  record("Silinmiş cariye fatura kesmek", "reddedilir", short(r), r.status >= 400);
  r = await t.post(`/api/workspace/invoices/${s1sale.data.id}/cancel`, { reason: "deneme" });
  const cancelled = r.status;
  r = await t.post("/api/workspace/invoices", { kind: "sale_return", originalId: s1sale.data.id, issueDate: "2025-09-30", lines: [{ originLineId: (await t.get(`/api/workspace/invoices/${s1sale.data.id}`)).data.lines[0].id, qty: 1 }], payment: {} });
  record("İptal edilmiş faturaya iade kesmek", "400", `iptal ${cancelled} → iade ${short(r)}`, r.status === 400);
  r = await t.post("/api/workspace/invoices", { kind: "sale_return", originalId: lockedSale.id, issueDate: "2025-09-30", lines: [{ originLineId: (await t.get(`/api/workspace/invoices/${lockedSale.id}`)).data.lines[0].id, qty: 5 }], payment: {}, force: true });
  record("1 adetlik faturadan 5 adet iade", "400 return-exceeds", short(r), r.status === 400);

  group = "Ekranda Zararlı Metin ve Excel Formülü (003)";
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "tr-TR", acceptDownloads: true })).newPage();
  let dialogs = 0;
  page.on("dialog", d => { dialogs += 1; d.dismiss(); });
  await page.goto(`${BASE}/`);
  await page.fill("#hof-auth input[name=username]", "admin");
  await page.fill("#hof-auth input[name=password]", PASS);
  await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
  await page.waitForSelector("#hof-company");
  await page.click("#hof-company [data-toggle]");
  await Promise.all([page.waitForEvent("load"), page.click(`#hof-company [data-pick="${C3}"]`)]);
  await page.waitForSelector("#hof-company");
  await page.click('#hof-sidecard [data-action="accounts"]');
  await page.waitForSelector(".hof-modal-backdrop.is-visible tr[data-account]");
  await page.click(`.hof-modal-backdrop.is-visible tr[data-account="${xss.id}"]`);
  await page.waitForTimeout(1500);
  const flag = await page.evaluate(() => window.__xss || 0);
  await page.screenshot({ path: path.join(OUT, "ekran", "saldiri-xss-cari-karti.png") });
  record("Cari adına HTML/JS (<img onerror>, <script>) yazılır, cari listesi ve kartı açılır", "metin olarak görünür, kod çalışmaz", `çalışan kod: ${flag ? "EVET" : "yok"}; açılan uyarı penceresi: ${dialogs}`, !flag && !dialogs);
  await browser.close();
  const xlsx = await t.raw("GET", "/api/workspace/accounts/export.xlsx");
  const hasFormula = /<f>/.test(extractSheet(xlsx.buffer));
  record("Cari adı '=1+1' ve notu '=HYPERLINK(…)' olan kartlar Excel'e dışa aktarılır", "hücreler metin; Excel formül çalıştırmaz", hasFormula ? "dosyada formül hücresi VAR" : "formül hücresi yok (metin)", !hasFormula);
  void formula;

  group = "003 Deneme Şirketinin Kaldırılması";
  r = await admin.raw("DELETE", `/api/companies/${C3}`, { body: JSON.stringify({ confirm: "003", password: "yanlis" }), headers: { "content-type": "application/json" } });
  record("Deneme şirketi 003'ü yanlış parolayla silmek", "403", `HTTP ${r.status}`, r.status === 403);
  r = await admin.raw("DELETE", `/api/companies/${C3}`, { body: JSON.stringify({ confirm: "003", password: PASS }), headers: { "content-type": "application/json" } });
  record("Deneme şirketi 003 silinir (önce kendi klasörüne yedeği alınır)", "200 + silme öncesi yedek", `HTTP ${r.status} ${JSON.stringify(r.data?.data?.backup || r.data?.backup || "")}`, r.status === 200);

} catch (error) {
  record("BETİK DURDU", "-", error.stack.split("\n").slice(0, 3).join(" | "), false);
}

group = "Değişmezlik";
const after = { "001": await fingerprint(C1), "002": await fingerprint(C2) };
record("Saldırılardan sonra 001'in sayıları (cari, bakiye, Kasa, fatura, çek) aynı", before["001"], after["001"], before["001"] === after["001"]);
record("Saldırılardan sonra 002'nin sayıları aynı", before["002"], after["002"], before["002"] === after["002"]);
fs.writeFileSync(path.join(OUT, "saldiri-sonucu.json"), JSON.stringify(results, null, 1));
console.log(`\nSaldırı denemeleri: ${results.length}; beklenene uymayan (bulgu): ${results.filter(x => !x.ok).length}`);
await app.close();

function extractSheet(buffer) {
  // .xlsx bir zip; sheet1.xml'i bul ve aç (yalnız "deflate" ve "store").
  let out = "";
  for (let i = 0; i < buffer.length - 30; i += 1) {
    if (buffer.readUInt32LE(i) !== 0x04034b50) continue;
    const method = buffer.readUInt16LE(i + 8);
    const size = buffer.readUInt32LE(i + 18);
    const nameLen = buffer.readUInt16LE(i + 26);
    const extra = buffer.readUInt16LE(i + 28);
    const name = buffer.slice(i + 30, i + 30 + nameLen).toString();
    const start = i + 30 + nameLen + extra;
    if (/worksheets\/sheet\d+\.xml$/.test(name)) {
      const data = buffer.slice(start, start + size);
      out += method === 8 ? zlib.inflateRawSync(data).toString("utf8") : data.toString("utf8");
    }
  }
  return out;
}
