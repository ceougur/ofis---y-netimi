// 2.4.3 — keşif testi A (Cari / Kasa / Kayıt) sunucu tarafı düzeltmeleri (docs/kanit/2026-10-17/ux-kesif/RAPOR-A.md):
//   A2  Kayda bağlı carinin tahsilat/ödemesi kaydın İşlem Geçmişi'nde (account-entry) ve Toplam Tahsilat'ta; "Kayıt Kartından Tahsilatlar"
//       raporunda Cari No ile. Sıralar: kayıt önce → cari → tahsilat; cari tahsilatı bağdan ÖNCE; bağ kalkınca düşer; bağsız cari girmez;
//       aynı adlı iki cari (yalnız bağlı olanınki); taksit kartı hareketi iki kez sayılmaz.
//   A5  Silinemeyen caride kart deleteBlock taşır (silme ucuyla aynı neden ve kod); engel kalkınca boşalır ve silme geçer.
//   A22 Cari ekstre PDF'inde alt TOPLAM satırı (satırların borç/alacak toplamı ve bakiye).
//   A15 Hareket türü adları başlık yazımıyla (cari defteri, Kasa raporu).
// Beklenen sayılar programdan bağımsız: aşağıda girilen tutarların elle toplamı.
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { pdfText } from "./banka-210-ortak.mjs";
import { loginAdmin, startTestServer } from "./helpers.mjs";

const unwrap = response => ({ ...response, data: response.data && typeof response.data === "object" && "ok" in response.data ? (response.data.ok ? response.data.data : response.data) : response.data });
const pad = value => String(value).padStart(2, "0");
const day = offset => {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

describe("2.4.3 keşif A: kayda bağlı cari geçmişi, Sil engeli, ekstre TOPLAM, hareket adları", () => {
  let server;
  let admin;
  const api = {
    get: async url => unwrap(await admin.get(url)),
    post: async (url, body) => unwrap(await admin.post(url, body)),
    put: async (url, body) => unwrap(await admin.put(url, body)),
    del: async url => unwrap(await admin.del(url)),
  };
  const ok200 = async (label, promise) => {
    const res = await promise;
    assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 200)}`);
    return res.data;
  };
  const record = (key, name) => ok200(`kayıt ${key}`, api.post("/api/workspace/records", { values: { "DOSYA NO": key, BORÇLU: name, TUTAR: "1000,00" }, caseKey: key }));
  const activity = key => ok200("geçmiş", api.get(`/api/workspace/cases/${encodeURIComponent(key)}/activity`));
  const entry = (accountId, kind, amount, offset = -1, extra = {}) => ok200(`hareket ${kind} ${amount}`, api.post(`/api/workspace/accounts/${accountId}/entries`, { kind, amount: String(amount), date: day(offset), method: "cash", ...extra }));

  before(async () => {
    server = await startTestServer();
    admin = await loginAdmin(server);
    await ok200("kurulum", api.post("/api/workspace/bank/setup/dismiss", {}));
  });
  after(async () => server?.close());

  test("A2 kayıt önce → cari bağlı → kayıttan tahsilat: geçmişte ve Toplam Tahsilat'ta; bağsız aynı adlı carinin tahsilatı girmez", async () => {
    await record("2026/200", "Ahmet Yılmaz");
    const linked = await ok200("bağlı cari", api.post("/api/workspace/accounts", { name: "Ahmet Yılmaz", phone: "0533 111 11 11", type: "customer", caseKey: "2026/200", caseTitle: "2026/200 · Ahmet Yılmaz" }));
    const twin = await ok200("aynı adlı bağsız cari", api.post("/api/workspace/accounts", { name: "Ahmet Yılmaz", phone: "0533 222 22 22", type: "customer" }));
    await entry(linked.id, "debt", 2000, -5);
    await entry(linked.id, "in", 750, -2);
    await entry(linked.id, "out", 50, -1);
    await entry(twin.id, "in", 999, -1);
    // Kaydın kendi defterine (cari dışı) bir tahsilat da: ikisi toplanır, hiçbiri iki kez sayılmaz.
    await ok200("kayıt tahsilatı", api.post(`/api/workspace/cases/${encodeURIComponent("2026/200")}/payments`, { amount: "100", date: day(-1), method: "cash" }));
    const data = await activity("2026/200");
    const fromAccount = data.items.filter(item => item.type === "account-entry");
    assert.deepEqual(fromAccount.map(item => [item.kind, item.amount]).sort(), [["in", 750], ["out", 50]], "yalnız bağlı carinin tahsilat/ödemesi (borç satırı ve ikizinki yok)");
    assert.equal(fromAccount[0].accountId, linked.id);
    assert.equal(fromAccount[0].accountRefNo, linked.refNo);
    assert.equal(data.items.filter(item => item.type === "payment").length, 1);
    // Kâhin (elle): 100 (kayıt) + 750 − 50 (cari) = 800.
    assert.equal(data.paidTotal, 800);
    assert.equal(data.accountPaid, 700);
    assert.equal(data.account?.id, linked.id);
  });

  test("A2 cari önce (tahsilat bağdan ÖNCE girilmiş) → sonra kayda bağlanır: geçmişte görünür; bağ kalkınca düşer", async () => {
    await record("2026/201", "Mehmet Demir");
    const account = await ok200("cari", api.post("/api/workspace/accounts", { name: "Mehmet Demir", type: "customer" }));
    await entry(account.id, "in", 300, -3);
    assert.equal((await activity("2026/201")).items.filter(item => item.type === "account-entry").length, 0, "bağ yokken görünmez");
    const detail = await ok200("kart", api.get(`/api/workspace/accounts/${account.id}`));
    await ok200("bağla", api.put(`/api/workspace/accounts/${account.id}`, { ...detail, fields: detail.fields || [], caseKey: "2026/201", caseTitle: "2026/201 · Mehmet Demir" }));
    let data = await activity("2026/201");
    assert.deepEqual(data.items.filter(item => item.type === "account-entry").map(item => item.amount), [300]);
    assert.equal(data.paidTotal, 300);
    await ok200("bağı kaldır", api.put(`/api/workspace/accounts/${account.id}`, { ...detail, fields: detail.fields || [], caseKey: "", caseTitle: "" }));
    data = await activity("2026/201");
    assert.equal(data.items.filter(item => item.type === "account-entry").length, 0, "bağ kalkınca düşer");
    assert.equal(data.paidTotal, 0);
  });

  test("A2 taksit önce: kayda ve cariye bağlı taksit kartının tahsilatı bir kez (plan-entry), cari tahsilatı ayrıca", async () => {
    await record("2026/202", "Ayşe Kaya");
    const account = await ok200("cari", api.post("/api/workspace/accounts", { name: "Ayşe Kaya", type: "customer", caseKey: "2026/202", caseTitle: "2026/202 · Ayşe Kaya", registeredOn: day(-40) }));
    const plan = await ok200("kart", api.post("/api/workspace/plans", { accountId: account.id, name: "Ayşe Kaya", total: "1.200", mode: "auto", count: 2, firstDue: day(-20), registeredOn: day(-30), caseKey: "2026/202", caseTitle: "2026/202 · Ayşe Kaya" }));
    await ok200("taksit tahsilatı", api.post(`/api/workspace/plans/${plan.id}/entries`, { kind: "in", amount: "400", date: day(-2), method: "cash" }));
    await entry(account.id, "in", 150, -1);
    const data = await activity("2026/202");
    assert.deepEqual(data.items.filter(item => item.type === "plan-entry").map(item => item.amount), [400]);
    assert.deepEqual(data.items.filter(item => item.type === "account-entry").map(item => item.amount), [150]);
    assert.equal(data.paidTotal, 550, "400 (taksit) + 150 (cari); taksit tahsilatı cari satırı olarak ikinci kez sayılmaz");
  });

  test("A2 \"Kayıt Kartından Tahsilatlar\": kayıt tahsilatları + kayda bağlı carilerin tahsilatları (Cari No ile); bağsız cari girmez", async () => {
    const report = await ok200("rapor", api.get(`/api/workspace/report-center/kayit-tahsilatlari?from=${day(-60)}&to=${day(0)}`));
    const rows = report.rows.map(row => [row[1], row[2]]);
    const has = (pattern, amount) => rows.some(([title, money]) => pattern.test(title) && money.startsWith(amount));
    assert.ok(has(/^2026\/200 · Ahmet Yılmaz$/, "100,00"), `kayıt tahsilatı: ${JSON.stringify(rows)}`);
    assert.ok(has(/2026\/200 · Ahmet Yılmaz · Cari No \d+/, "750,00"), "bağlı cari tahsilatı Cari No ile");
    assert.ok(has(/2026\/202 · Ayşe Kaya · Cari No \d+/, "150,00"));
    assert.ok(!rows.some(([, money]) => money.startsWith("999,00")), "bağsız ikizin tahsilatı yok");
    assert.ok(!rows.some(([, money]) => money.startsWith("400,00")), "taksit tahsilatı bu raporda değil (Taksit Tahsilatları)");
    // Kâhin (elle): 100 + 750 + 150 = 1.000 (2026/201'in bağı kaldırıldı; 300 girmez; ödeme 50 tahsilat değildir).
    const total = report.summary.find(([label]) => label === "Toplam")?.[1];
    assert.match(total, /^1\.000,00/);
  });

  test("A5 silinemeyen caride kart deleteBlock taşır, silme ucuyla aynı neden; engel kalkınca silinir", async () => {
    const account = await ok200("cari", api.post("/api/workspace/accounts", { name: "Taksitli Kişi", type: "customer", registeredOn: day(-40) }));
    const plan = await ok200("kart", api.post("/api/workspace/plans", { accountId: account.id, name: "Taksitli Kişi", total: "600", mode: "auto", count: 2, firstDue: day(5), registeredOn: day(-30) }));
    const detail = await ok200("kart", api.get(`/api/workspace/accounts/${account.id}`));
    assert.match(detail.deleteBlock, /1 taksit kartı var/);
    const refused = await api.del(`/api/workspace/accounts/${account.id}`);
    assert.equal(refused.status, 409);
    assert.equal(refused.data.error || refused.data.message, detail.deleteBlock);
    await ok200("kartı sil", api.del(`/api/workspace/plans/${plan.id}`));
    assert.equal((await ok200("kart", api.get(`/api/workspace/accounts/${account.id}`))).deleteBlock, "");
    await ok200("cariyi sil", api.del(`/api/workspace/accounts/${account.id}`));
    // Faturası olan cari: kod (account-has-invoices) korunur.
    const buyer = await ok200("alıcı", api.post("/api/workspace/accounts", { name: "Faturalı Alıcı", type: "customer" }));
    await ok200("fatura", api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: buyer.id, lines: [{ name: "Hizmet", qty: 1, unitPrice: 100, vatRate: 20 }], payment: { rest: "open" } }));
    const blocked = await ok200("kart", api.get(`/api/workspace/accounts/${buyer.id}`));
    assert.match(blocked.deleteBlock, /faturası olan cari silinemez/);
    const refusedInvoice = await api.del(`/api/workspace/accounts/${buyer.id}`);
    assert.equal(refusedInvoice.status, 409);
    assert.equal(refusedInvoice.data.code, "account-has-invoices");
    // Yetkisi olmayan (yalnız görüntüleyen) kullanıcıya neden gönderilmez.
    const staff = await ok200("personel", api.post("/api/admin/users", { username: "personel243", name: "Personel", role: "personel", password: "Personel-2026!", mustChangePassword: false }));
    assert.ok(staff);
    const client = server.client();
    assert.equal((await client.login("personel243", "Personel-2026!")).status, 200);
    const seen = unwrap(await client.get(`/api/workspace/accounts/${buyer.id}`));
    if (seen.status === 200) assert.equal(seen.data.deleteBlock, "");
  });

  test("A22 cari ekstre PDF'inde TOPLAM satırı = satırların toplamı; A15 hareket türü adları", async () => {
    const account = await ok200("cari", api.post("/api/workspace/accounts", { name: "Ekstre Kişi", type: "customer", registeredOn: day(-40) }));
    await entry(account.id, "debt", 1234.5, -10);
    await entry(account.id, "debt", 765.5, -9);
    await entry(account.id, "in", 500, -8);
    const plan = await ok200("kart", api.post("/api/workspace/plans", { accountId: account.id, name: "Ekstre Kişi", total: "900", mode: "auto", count: 3, firstDue: day(-5), registeredOn: day(-7) }));
    await ok200("taksit", api.post(`/api/workspace/plans/${plan.id}/entries`, { kind: "in", amount: "300", date: day(-1), method: "cash" }));
    const pdf = await admin.raw("GET", `/api/workspace/accounts/${account.id}/ekstre.pdf`);
    assert.equal(pdf.status, 200);
    const lines = pdfText(pdf.buffer).split("\n");
    const at = lines.indexOf("TOPLAM");
    assert.ok(at >= 0, "TOPLAM satırı var");
    // Kâhin (elle): borç 1.234,50 + 765,50 + 900 (taksit planı) = 2.900,00; alacak 500 + 300 = 800,00; bakiye 2.100,00 borçlu.
    assert.deepEqual(lines.slice(at + 1, at + 4), ["2.900,00 TL", "800,00 TL", "2.100,00 TL borçlu"]);
    const detail = await ok200("kart", api.get(`/api/workspace/accounts/${account.id}`));
    const labels = detail.ledger.map(line => line.label);
    assert.ok(labels.some(label => /^Taksit Tahsilatı/.test(label)), `cari defteri: ${labels.join(" | ")}`);
    assert.ok(!labels.some(label => /Taksit tahsilatı/.test(label)));
    // Kasa Dökümü PDF'i (Kasa penceresindeki satır metniyle aynı).
    const cashPdf = await admin.raw("GET", `/api/workspace/cash.pdf?from=${day(-30)}&to=${day(0)}`);
    assert.equal(cashPdf.status, 200);
    const texts = pdfText(cashPdf.buffer);
    assert.match(texts, /Cari Tahsilat · Ekstre Kişi/);
    assert.match(texts, /Taksit Tahsilatı · Ekstre Kişi/);
    assert.doesNotMatch(texts, /Cari tahsilat|Taksit tahsilatı/);
  });
});
