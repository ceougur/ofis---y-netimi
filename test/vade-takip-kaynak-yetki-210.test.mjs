// 2.1.0 temel sürüm — ikinci küçük düzeltmeler (10.10.2026): Vade Takip / Nakit Akış'ta kaynak adı, yetki ve PDF alt başlığı.
//
//   m2 İstemcinin kaynak adlarında (hof-overview.js SOURCE_LABELS) "invoice" yoktu: ekranda vadeli fatura satırı ham "invoice" yazıyordu ve
//      Vade Takip'in "Fatura" süzgeç seçeneği boş adla çiziliyordu; PDF/Excel "Fatura (vadeli)" yazar. Plan §8.9: "İstemci SOURCE_LABELS'ındaki
//      eksik invoice etiketi kapatılır". Beklenen: sunucunun her Vade Takip kaynağının istemcide adı var ve ad sunucununkiyle aynı.
//   m6 Nakit Akış PDF'inin alt başlığı tek satıra sığdırılıp sonu "…" ile kesiliyordu ("… Gerçek Banka…"): başlangıç tanımı okunmuyordu.
//      Beklenen: alt başlığın tamamı PDF metninde.
//   m7 Vade Takip (ekran, PDF, Excel) hesaba atanmamış eski banka/POS satırlarını ("Hesabı Atanmamış (ileri tarihli)") banka görme yetkisi
//      olmayan, yalnız Kasa ve rapor yetkili kişiye de gösteriyordu. Plan §8.9 (Vade Takip / Zil / Takvim: banka kalemleri bank.view ile) ve
//      §9 madde 6 (banka rakamı bank.view ∨ overview.view): bu kişi Kasa'nın kendi ileri tarihli satırlarını görür, banka satırını görmez.
//      Nakit Akış zaten ANLIK DURUM yetkisi (overview.view) ister — §9/6 gereği banka rakamını görür; burada değişmez (denetlenir).
//
// TEST VERİSİ: eski banka satırları GERÇEK v2.0.23 kodu (git etiketi) API'sinden (bugünkü kod ileri tarihli banka satırı yazmaz); tarihler göreli,
// güncel kodda sahte saat (ders 13). Kâhin: bağımsız defter (aşağıda; programdan okunmaz).
// NASIL BOZARIM (önce yazıldı): yetkisiz kişi Kasa süzgeciyle / süzgeçsiz / PDF / Excel ile banka satırını görür mü; sources=legacy diye ister mi;
// yetkili kişi (avukat: bank.view) ve yönetici satırı hâlâ görür mü (aşırı düzeltme); Nakit Akış uç yetkisi değişti mi.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { pdfText, xlsxSheets } from "./banka-210-ortak.mjs";
import { CURRENT, bootVersion, tagsAvailable } from "./guvenilirlik/surumler.mjs";

const OLD = "v2.0.23";
const PASSWORD = "Kasa-Rapor-2026!";
const LEGACY = "Hesabı Atanmamış (ileri tarihli)";
const KASA = "Kasa (ileri tarihli)";
const pad = n => String(n).padStart(2, "0");
const base = new Date();
const day = offset => {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + offset, 12, 0, 0, 0);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const D0 = day(0);
const must = async (label, promise) => {
  const res = await promise;
  assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 400)}`);
  return res.data;
};
// Bağımsız defter: v2.0.23'te girilen ileri tarihli para hareketleri.
const LEDGER = { cash: [{ date: day(4), amount: 300 }], legacy: [{ date: day(6), amount: 1000 }] };

const ROOT = new URL("../", import.meta.url);
const read = file => readFileSync(new URL(file, ROOT), "utf8");
const objectOf = (src, name) => {
  const match = new RegExp(`const ${name} = (?:Object\\.freeze\\()?\\{([^}]*)\\}`).exec(src);
  assert.ok(match, `${name} bulunamadı`);
  return Object.fromEntries([...match[1].matchAll(/(\w+):\s*"([^"]*)"/g)].map(m => [m[1], m[2]]));
};

describe("m2 Vade Takip kaynak adları: istemci sunucuyla aynı (fatura dahil)", () => {
  it("sunucunun her kaynağının istemcide adı var; 'invoice' adı PDF/Excel'deki gibi", () => {
    const server = read("server/routes/overview.mjs");
    const client = read("client/assets/hof-overview.js");
    const sources = JSON.parse(/const DUE_SOURCES = (\[[^\]]*\])/.exec(server)[1]);
    const serverText = objectOf(server, "SOURCE_TEXT");
    const labels = objectOf(client, "SOURCE_LABELS");
    for (const source of sources) assert.ok(labels[source], `istemci SOURCE_LABELS'ta '${source}' adı yok (ekranda ham '${source}' yazar)`);
    assert.equal(labels.invoice, serverText.invoice, "fatura kaynak adı ekran ↔ PDF/Excel");
  });
});

const skip = !tagsAvailable([OLD]) && `${OLD} etiketi bu depoda yok (git fetch --tags)`;

describe("m6 + m7 Nakit Akış PDF alt başlığı ve Vade Takip banka satırı yetkisi (gerçek v2.0.23 verisi)", { skip }, () => {
  let root;
  let server;
  let admin;
  let kasa;
  let avukat;
  before(async () => {
    root = mkdtempSync(path.join(tmpdir(), "vade-yetki-"));
    const dirs = { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups") };
    const old = await bootVersion(OLD, dirs);
    try {
      const api = await old.login();
      const customer = await must("v2.0.23 müşteri", api.post("/api/workspace/accounts", { name: "Vade Müşterisi", type: "customer" }));
      const cashIn = await must("v2.0.23 çek (nakit)", api.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", amount: 300, issueDate: day(-3), dueDate: day(4), serialNo: "VY-1", accountId: customer.id }));
      await must("v2.0.23 çek NAKİT ileri tarihle tahsil", api.post(`/api/workspace/cheques/${cashIn.id}/actions`, { action: "collect", date: day(4), method: "cash", status: "portfolio" }));
      const bankIn = await must("v2.0.23 çek (banka)", api.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", amount: 1000, issueDate: day(-3), dueDate: day(6), serialNo: "VY-2", accountId: customer.id }));
      await must("v2.0.23 çek BANKAYA ileri tarihle tahsil", api.post(`/api/workspace/cheques/${bankIn.id}/actions`, { action: "collect", date: day(6), method: "bank", status: "portfolio" }));
    } finally {
      await old.close();
    }
    server = await bootVersion(CURRENT, { ...dirs, now: { time: D0 }, moneyStrict: false, gateVerify: false });
    admin = await server.login();
    await must("Ziraat hesabı", admin.post("/api/workspace/bank/accounts", { bankName: "Ziraat Bankası", name: "Ana TL Hesabı", kind: "demand", opening: { date: day(-5), amount: "10.000", confirmed: true } }));
    // Kasa ve rapor yetkili, banka yetkisiz kişi (özel rol): Vade Takip'i görür, Kasa kaynağını görür, Banka'yı görmez.
    const role = await must("özel rol", admin.post("/api/admin/roles", { name: "Kasa ve Rapor", permissions: ["accounts.view", "cash.view", "reports.view", "invoices.view"] }));
    await must("kasa kullanıcısı", admin.post("/api/admin/users", { username: "kasarapor", name: "Kasa Rapor", role: role.id, password: PASSWORD, mustChangePassword: false }));
    await must("avukat", admin.post("/api/admin/users", { username: "avukat1", name: "Avukat", role: "avukat", password: PASSWORD, mustChangePassword: false }));
    kasa = await server.login("kasarapor", PASSWORD);
    avukat = await server.login("avukat1", PASSWORD);
  });
  after(async () => {
    await server?.close().catch(() => {});
    if (root) rmSync(root, { recursive: true, force: true });
  });

  const rowsOf = data => data.rows.map(row => `${row.date} ${row.direction} ${row.amount} ${row.source}`).sort();
  const want = (list, source) => list.map(item => `${item.date} in ${item.amount} ${source}`);

  it("ön koşul: yönetici Vade Takip'te nakit ve hesapsız eski banka satırını görür (bağımsız defter)", async () => {
    const data = await must("yönetici Vade Takip", admin.get("/api/workspace/overview/vade-takip?preset=next30&sources=cash"));
    assert.deepEqual(rowsOf(data), [...want(LEDGER.cash, "cash"), ...want(LEDGER.legacy, "legacy")].sort());
  });

  it("m7 API: banka yetkisiz kişi Kasa satırını görür, hesapsız eski banka satırını görmez (süzgeçli ve süzgeçsiz)", async () => {
    const me = await must("kasarapor oturumu", kasa.get("/api/auth/me"));
    const permissions = me.user?.permissions || me.permissions || [];
    assert.ok(!permissions.includes("bank.view") && permissions.includes("cash.view") && permissions.includes("reports.view"), `ön koşul: yetkiler ${JSON.stringify(permissions)}`);
    for (const query of ["preset=next30&sources=cash", "preset=next30", "preset=open", "preset=next30&sources=cash,legacy"]) {
      const data = await must(`kasarapor Vade Takip ${query}`, kasa.get(`/api/workspace/overview/vade-takip?${query}`));
      assert.deepEqual(rowsOf(data).filter(row => !row.endsWith(" invoice")), want(LEDGER.cash, "cash"), `${query}: yalnız Kasa'nın ileri tarihli satırı`);
    }
  });

  it("m7 PDF ve Excel: banka yetkisiz kişinin dışa aktarımında da eski banka satırı yok", async () => {
    const pdf = await kasa.client.raw("GET", "/api/workspace/overview/vade-takip.pdf?preset=next30&sources=cash");
    assert.equal(pdf.status, 200);
    const text = pdfText(pdf.buffer).replace(/\s+/g, " ");
    assert.equal((text.match(/Hesabı Atanmamış/g) || []).length, 0, `PDF'te banka satırı: ${text.slice(0, 600)}`);
    assert.equal((text.match(/Kasa \(ileri tarihli\)/g) || []).length, 1, "PDF'te Kasa satırı bir kez");
    const xlsx = await kasa.client.raw("GET", "/api/workspace/overview/vade-takip.xlsx?preset=next30&sources=cash");
    assert.equal(xlsx.status, 200);
    const sheet = xlsxSheets(xlsx.buffer)["Vade Takip"] || [];
    const head = sheet.findIndex(cells => cells.includes("Kaynak"));
    const at = sheet[head]?.indexOf("Kaynak");
    assert.deepEqual(sheet.slice(head + 1).map(cells => cells[at]).filter(Boolean), [KASA], `Excel Kaynak: ${JSON.stringify(sheet.slice(0, 5))}`);
  });

  it("m7 aşırı düzeltme yok: banka yetkili avukat eski banka satırını görür; Nakit Akış ucu banka yetkisiz kişiye kapalı kalır", async () => {
    const data = await must("avukat Vade Takip", avukat.get("/api/workspace/overview/vade-takip?preset=next30&sources=cash"));
    assert.deepEqual(rowsOf(data), [...want(LEDGER.cash, "cash"), ...want(LEDGER.legacy, "legacy")].sort());
    assert.equal((await kasa.client.raw("GET", "/api/workspace/overview/nakit-akisi?preset=next30")).status, 403, "Nakit Akış overview.view ister (değişmedi)");
  });

  it("m6 Nakit Akış PDF alt başlığı kesilmez (başlangıç tanımı tam)", async () => {
    const pdf = await admin.client.raw("GET", "/api/workspace/overview/nakit-akisi.pdf?preset=next30&table=0");
    assert.equal(pdf.status, 200);
    const text = pdfText(pdf.buffer).replace(/\s+/g, " ");
    assert.ok(text.includes("Başlangıç: Nakit Kasa + Gerçek Banka (hesaba atanmamış eski hareketler girmez)"), `alt başlık kesik: ${text.slice(0, 500)}`);
    assert.ok(!/Gerçek Banka…/.test(text), "alt başlıkta '…' ile kesik metin");
    // Komşu (aynı PDF): özet kutusunun değeri de kesilmez — "En Düşük Tahmini Nakit ve Banka 10.000,00 TL (1…" tarihi yutuyordu.
    const flow = await must("Nakit Akış", admin.get("/api/workspace/overview/nakit-akisi?preset=next30&table=0"));
    const lowest = flow.lowest.date.split("-").reverse().join(".");
    assert.ok(text.includes(`(${lowest})`), `özet kutusu “En Düşük …” değerinin tarihi (${lowest}) kesik`);
    assert.ok(!/TL \(\d?…/.test(text), "özet kutusunda '…' ile kesik değer");
    // Ayrıca gerçek PDF okuyucusuyla (pdftotext; kurulu değilse atlanır).
    let tool = "";
    try {
      const file = path.join(root, "nakit.pdf");
      writeFileSync(file, pdf.buffer);
      tool = execFileSync("pdftotext", ["-layout", file, "-"], { encoding: "utf8" }).replace(/\s+/g, " ");
    } catch {
      tool = "";
    }
    if (tool) assert.ok(tool.includes("hesaba atanmamış eski hareketler girmez)"), `pdftotext: ${tool.slice(0, 500)}`);
  });
});
