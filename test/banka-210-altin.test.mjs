// 2.1.0 — Aşama 2, Dilim 4: ALTIN TEST — tek kaynağa (moneyLines, K5) geçişten sonra kullanıcının gördüğü her para sayısı 2.0.26 ile
// SATIR SATIR AYNI (docs/BANKA-MODULU-PLAN.md §3.4, §12.3 Aşama 2 "Çalışıyor Mu", K11).
//
// Yöntem: aynı veri iki kopyaya açılır; birinde GERÇEK v2.0.26 kodu (git etiketi; tests/guvenilirlik/surumler.mjs), öbüründe bu dal
// (v20 göçünü kendisi uygular) aynı anda çalışır; ikisine aynı istekler gönderilir ve yanıtlar karşılaştırılır:
//   - Kasa penceresi JSON'u (yönetici ve Kasa'yı gören muhasebe kullanıcısı; nakit / tüm yollar / banka tarafı / havale / POS; tarih
//     aralıklı), Kasa Dökümü PDF'inin metni;
//   - Raporlar → Banka ve POS Hareketleri (yol süzgeçleriyle) ve Kasa raporları (Hareketler, Günlük, Kaynağa Göre, Aylık), Hesap Planı
//     Mizanı, Defter Mutabakatı: ekran JSON'u, PDF metni ve Excel sayfaları;
//   - ANLIK DURUM (Kasa bugün / bu ay, Banka / POS kutusu dahil), Nakit Akış Projeksiyonu, Vade Takip;
//   - Ana Defter (mizan + mutabakat) ve Mutabakat Testi'nin denetim listesi ("N denetim tamam" aynı kalır).
// Tek fark izni: oluşturma saati (PDF/Excel damgası). Gözden geçirme D3 (Aşama 2; bilerek güncellendi): 649'un adı Aşama 2'de değişmez —
// ad izni ve Hesap Planı Mizanı PDF'indeki satır kırılımı izni kaldırıldı (her metin birebir).
// Veri: (1) zincir fikstürü surum-2.0.26-zincir (2.0.16 → 2.0.26 gerçek sürüm koduyla, 4 şirket); (2) v2.0.26'nın KENDİ koduyla
// mutabakat motoruyla (test/mutabakat/motor.mjs) bu test sırasında üretilen veri: 120 güne yayılmış rastgele işlemler (Kasa, cari,
// stok, taksit, çek/senet, fatura, iade, iptal, transfer, dönem kilidi).
// NASIL BOZARIM: tek kaynak bir kaynağı (silinmiş carinin satırı, faturası olmayan peşin, stokta yön), sırayı (aynı damgalı satırlar),
// bir alanı (açıklama, işlemi yapan, düzenlenebilirlik), bir süzgeci (yol, tarih) ya da bir toplamı (bugün/bu ay, banka kutusu) farklı
// okursa bu test kırılır.
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { localDay, pdfText, unwrap, xlsxSheets } from "./banka-210-ortak.mjs";
import { fixtureExists, unpackFixture } from "./guvenilirlik/fikstur.mjs";
import { CURRENT, bootVersion, tagsAvailable } from "./guvenilirlik/surumler.mjs";
import { runReconciliation } from "./mutabakat/motor.mjs";

const OLD = "v2.0.26";
const skip = tagsAvailable([OLD]) ? false : `${OLD} etiketi bu depoda yok (git fetch --tags)`;
const TODAY = localDay(0);
const MONTH = `${TODAY.slice(0, 7)}-01`;
const PAST = { from: localDay(-75), to: localDay(-8) };
const STAMP = /\d{2}\.\d{2}\.\d{4} \d{2}:\d{2}(:\d{2})?/g;

const textNorm = value => value.replace(STAMP, "TARİH SAAT");
const strip = (value, keys) => {
  if (Array.isArray(value)) return value.map(item => strip(item, keys));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key)).map(([key, item]) => [key, strip(item, keys)]));
  return value;
};

// Karşılaştırılan istekler. kind: json | pdf | xlsx; who: admin (hepsi) ya da staff (Kasa'yı gören personel).
function requests() {
  const out = [];
  const json = (url, opts = {}) => out.push({ kind: "json", url, ...opts });
  for (const who of ["admin", "staff"]) {
    for (const q of ["", "?method=all", "?method=noncash", "?method=bank", "?method=card", `?from=${PAST.from}&to=${PAST.to}`, `?method=all&from=${MONTH}&to=${TODAY}`, `?method=noncash&from=${PAST.from}`]) json(`/api/workspace/cash${q}`, { who });
    for (const q of ["", `?from=${PAST.from}&to=${PAST.to}`, "?method=noncash"]) out.push({ kind: "pdf", url: `/api/workspace/cash.pdf${q}`, who });
  }
  json("/api/workspace/overview", { drop: ["at"] });
  json("/api/workspace/overview/nakit-akisi");
  json(`/api/workspace/overview/nakit-akisi?preset=next90&overdue=1`);
  json(`/api/workspace/overview/vade-takip?sources=cash,plan,cheque,note,invoice`);
  json("/api/workspace/ledger");
  json("/api/workspace/ledger/integrity", { drop: ["durationMs", "log"] });
  const reports = {
    "banka-pos-hareketleri": ["", "?from=2000-01-01&to=2099-12-31", "?from=2000-01-01&to=2099-12-31&payMethod=bank", "?from=2000-01-01&to=2099-12-31&payMethod=card", `?from=${PAST.from}&to=${PAST.to}&payMethod=bank`, `?preset=thisMonth`],
    "kasa-hareketleri": ["", "?from=2000-01-01&to=2099-12-31", `?from=${PAST.from}&to=${PAST.to}`],
    "kasa-gunluk": ["", `?from=${PAST.from}&to=${PAST.to}`],
    "kasa-kaynak": ["", "?from=2000-01-01&to=2099-12-31"],
    "kasa-aylik": ["", "?from=2000-01-01&to=2099-12-31"],
    "hesap-mizani": ["?from=2000-01-01&to=2099-12-31"],
    "defter-mutabakati": [""],
  };
  for (const [id, variants] of Object.entries(reports)) {
    for (const q of variants) {
      json(`/api/workspace/report-center/${id}${q}`);
      out.push({ kind: "pdf", url: `/api/workspace/report-center/${id}/pdf${q}` });
      out.push({ kind: "xlsx", url: `/api/workspace/report-center/${id}/xlsx${q}` });
    }
  }
  return out;
}

async function fetchOne(api, request) {
  if (request.kind === "json") {
    const response = unwrap(await api.client.get(request.url));
    return { status: response.status, body: strip(response.data, request.drop || []) };
  }
  const response = await api.client.raw("GET", request.url);
  if (response.status !== 200) return { status: response.status, body: response.data };
  if (request.kind === "pdf") return { status: 200, body: textNorm(pdfText(response.buffer)) };
  const sheets = xlsxSheets(response.buffer);
  for (const rows of Object.values(sheets)) for (let k = rows.length - 1; k >= 0; k -= 1) if (rows[k][0] === "Hazırlanma") rows.splice(k, 1);
  return { status: 200, body: sheets };
}

async function login(server, who) {
  return who === "staff" ? server.login("altin-muhasebe", "Altin-Muhasebe-2026!") : server.login();
}

/** İki sunucuya aynı istekleri gönderip yanıtları karşılaştırır; farkları döndürür. */
async function compare(oldServer, newServer, { companies, label }) {
  const problems = [];
  let compared = 0;
  for (const company of companies) {
    for (const who of ["admin", "staff"]) {
      if (who === "staff" && company.id !== "sirket-001") continue; // personelin şirket yetkisi yalnız 001
      const a = await login(oldServer, who);
      const b = await login(newServer, who);
      if (company.id !== "sirket-001") {
        for (const api of [a, b]) assert.equal((await api.post("/api/companies/select", { id: company.id })).status, 200, `${company.code} seçilemedi`);
      }
      for (const request of requests().filter(item => (item.who || "admin") === who)) {
        const [left, right] = [await fetchOne(a, request), await fetchOne(b, request)];
        compared += 1;
        const where = `${label} · ${company.code} · ${who} · ${request.kind} ${request.url}`;
        if (left.status !== right.status) problems.push(`${where}: durum ${left.status} ≠ ${right.status}`);
        else {
          try {
            assert.deepStrictEqual(right.body, left.body);
          } catch (error) {
            problems.push(`${where}: ${String(error.message).slice(0, 1500)}`);
          }
        }
      }
    }
  }
  return { problems, compared };
}

async function prepareStaff(server) {
  const admin = await server.login();
  const created = await admin.post("/api/admin/users", { username: "altin-muhasebe", name: "Altın Muhasebe", role: "muhasebe", password: "Altin-Muhasebe-2026!", mustChangePassword: false });
  assert.equal(created.status, 200, JSON.stringify(created.data).slice(0, 300));
}

async function sideBySide(sourceData, sourceBackups, label, companies) {
  const root = mkdtempSync(path.join(tmpdir(), "altin-210-"));
  const dirs = side => ({ dataDir: path.join(root, side, "data"), backupDir: path.join(root, side, "backups") });
  for (const side of ["eski", "yeni"]) {
    cpSync(sourceData, dirs(side).dataDir, { recursive: true });
    cpSync(sourceBackups, dirs(side).backupDir, { recursive: true });
  }
  const oldServer = await bootVersion(OLD, { ...dirs("eski"), maxCompanies: 10 });
  const newServer = await bootVersion(CURRENT, { ...dirs("yeni"), maxCompanies: 10 });
  try {
    assert.equal(newServer.app.store.get("PRAGMA user_version").user_version, 20, "bu dal v20'de");
    assert.equal(oldServer.app.store.get("PRAGMA user_version").user_version, 19, "v2.0.26 v19'da");
    return await compare(oldServer, newServer, { companies, label });
  } finally {
    await oldServer.close();
    await newServer.close();
    rmSync(root, { recursive: true, force: true });
  }
}

describe("altın test: v2.0.26 ile bu dal aynı veride aynı Kasa, Banka ve POS, ANLIK DURUM, Ana Defter ve raporları gösterir", { skip }, () => {
  it("zincir fikstürü surum-2.0.26-zincir (2.0.16 → 2.0.26 gerçek sürüm koduyla, 4 şirket)", { timeout: 600_000 }, async () => {
    assert.ok(fixtureExists("surum-2.0.26-zincir"), "fikstür yok");
    const fixture = unpackFixture("surum-2.0.26-zincir");
    try {
      // Kasa'yı gören personel (muhasebe) v2.0.26'nın kendi API'siyle eklenir; iki kopya da aynı veriyle başlar.
      const prep = await bootVersion(OLD, { dataDir: fixture.dataDir, backupDir: fixture.backupDir, maxCompanies: 10 });
      let companies;
      try {
        await prepareStaff(prep);
        companies = (await (await prep.login()).get("/api/companies")).data.companies.map(({ id, code }) => ({ id, code }));
      } finally {
        await prep.close();
      }
      assert.ok(companies.length >= 4, `şirketler: ${JSON.stringify(companies)}`);
      const { problems, compared } = await sideBySide(fixture.dataDir, fixture.backupDir, "zincir", companies);
      assert.ok(compared >= 280, `karşılaştırılan yanıt sayısı ${compared}`);
      assert.deepEqual(problems, [], `${problems.length} fark:\n${problems.slice(0, 8).join("\n\n")}`);
    } finally {
      fixture.cleanup();
    }
  });

  it("v2.0.26'nın kendi koduyla üretilen veri (mutabakat motoru: 120 güne yayılmış 260 rastgele işlem, dönem kilidi, iade/iptal)", { timeout: 900_000 }, async () => {
    const root = mkdtempSync(path.join(tmpdir(), "altin-210-motor-"));
    const dataDir = path.join(root, "data");
    const backupDir = path.join(root, "backups");
    try {
      const old = await bootVersion(OLD, { dataDir, backupDir });
      try {
        await prepareStaff(old);
        const admin = await old.login();
        const report = await runReconciliation({ client: admin.client, seed: 210, operations: 260, verifyEvery: 100_000, reportEvery: 100_000, burst: 8, span: 120 });
        assert.ok(report.operations >= 260, JSON.stringify(report.byKind));
        // Görünürlük kuralları için v2.0.26'nın kendi API'siyle: tahsilatı olan cari ve taksit kartı silinir, peşinli fatura iptal edilir,
        // stokta havaleyle peşin satış (tek kaynak bunları 2.0.26'daki modül tanımları gibi düşürmeli / tutmalı).
        const ok = async (label, promise) => {
          const res = await promise;
          assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
          return res.data;
        };
        const day = TODAY; // motorun dönem kilidi ve fatura serisinin tarih sırası: bugün
        const gone = await ok("cari", admin.post("/api/workspace/accounts", { name: "Altın Silinen Cari", type: "customer", registeredOn: localDay(-10) }));
        await ok("tahsilat", admin.post(`/api/workspace/accounts/${gone.id}/entries`, { kind: "in", amount: "321", date: day, method: "cash" }));
        await ok("havale", admin.post(`/api/workspace/accounts/${gone.id}/entries`, { kind: "in", amount: "654", date: day, method: "bank" }));
        const plan = await ok("kart", admin.post("/api/workspace/plans", { name: "Altın Silinen Kart", total: "900", mode: "auto", count: 3, firstDue: day, registeredOn: localDay(-10), accountId: gone.id }));
        await ok("taksit tahsilatı", admin.post(`/api/workspace/plans/${plan.id}/entries`, { kind: "in", amount: "300", date: day, method: "card" }));
        const service = await ok("hizmet", admin.post("/api/workspace/stock", { kind: "service", code: "ALT-HZM", name: "Altın Hizmet", unit: "Adet", salePrice: "500" }));
        const buyer = await ok("alıcı", admin.post("/api/workspace/accounts", { name: "Altın Fatura Carisi", type: "customer", registeredOn: localDay(-10) }));
        const doc = await ok("fatura", admin.post("/api/workspace/invoices", { scenario: "service_sale", accountId: buyer.id, issueDate: day, lines: [{ itemId: service.id, qty: 1, unitPrice: 500, vatRate: 0 }], payment: { cash: [{ amount: 200, method: "cash" }, { amount: 100, method: "bank" }], rest: "open", dueDate: day } }));
        await ok("fatura iptal", admin.post(`/api/workspace/invoices/${doc.id}/cancel`, { reason: "Altın test", cashForce: true }));
        const goods = await ok("ürün", admin.post("/api/workspace/stock", { name: "Altın Ürün", code: "ALT-URN", unit: "Adet", unitPrice: 10, salePrice: 30 }));
        await ok("stok girişi", admin.post(`/api/workspace/stock/${goods.id}/moves`, { kind: "in", qty: "10", pay: "none", date: day }));
        await ok("peşin satış", admin.post(`/api/workspace/stock/${goods.id}/moves`, { kind: "out", qty: "2", unitPrice: "30", pay: "cash", method: "bank", date: day }));
        await ok("kart sil", admin.del(`/api/workspace/plans/${plan.id}?cashForce=1`));
        await ok("cari sil", admin.del(`/api/workspace/accounts/${gone.id}?cashForce=1`));
        const count = table => old.app.store.get(`SELECT COUNT(*) AS n FROM ${table}`).n;
        const money = ["payments", "cash_entries", "account_entries", "plan_entries", "stock_moves", "cheque_events"].reduce((sum, table) => sum + count(table), 0);
        assert.ok(money >= 150 && count("invoices") >= 10, `gerçekçi hacim: para tablosu satırı ${money}, fatura ${count("invoices")} (${JSON.stringify(report.byKind)})`);
      } finally {
        await old.close();
      }
      const { problems, compared } = await sideBySide(dataDir, backupDir, "motor", [{ id: "sirket-001", code: "001" }]);
      assert.ok(compared >= 75, `karşılaştırılan yanıt sayısı ${compared}`);
      assert.deepEqual(problems, [], `${problems.length} fark:\n${problems.slice(0, 8).join("\n\n")}`);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
