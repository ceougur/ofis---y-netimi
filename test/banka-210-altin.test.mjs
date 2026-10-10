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
// Tek fark izni: oluşturma saati (PDF/Excel damgası) ve 649'un adı — Aşama 4'te (Banka Fişi 649'a yazmaya başlayınca; bilerek güncellendi)
// Tekdüzen adı "Diğer Olağan Gelir ve Kârlar" (plan §3.11; tutarı aynı). Hesap Planı Mizanı PDF'inde adın uzunluğu kolon genişliğini,
// dolayısıyla satır kırılımını değiştirir (o PDF'te kırılım boşluk sayılır). Aşama 2'de (gözden geçirme D3) ad 2.0.26'daki gibi kalmıştı.
// Veri: (1) zincir fikstürü surum-2.0.26-zincir (2.0.16 → 2.0.26 gerçek sürüm koduyla, 4 şirket); (2) v2.0.26'nın KENDİ koduyla
// mutabakat motoruyla (test/mutabakat/motor.mjs) bu test sırasında üretilen veri: 120 güne yayılmış rastgele işlemler (Kasa, cari,
// stok, taksit, çek/senet, fatura, iade, iptal, transfer, dönem kilidi).
// NASIL BOZARIM: tek kaynak bir kaynağı (silinmiş carinin satırı, faturası olmayan peşin, stokta yön), sırayı (aynı damgalı satırlar),
// bir alanı (açıklama, işlemi yapan, düzenlenebilirlik), bir süzgeci (yol, tarih) ya da bir toplamı (bugün/bu ay, banka kutusu) farklı
// okursa bu test kırılır.
// K1 (iade kapanışı, 2.1.0; bilerek değişen görünüm): K1 iadesi olan carilerde faturaların ödeme durumunu (ANLIK DURUM'un fatura kutusu,
// Nakit Akış ve Vade Takip'in fatura kalemleri) bilerek değiştirdi. Birebir karşılaştırma K1 öncesi kapamayla yapılır (createApp legacyClosing:
// test/guvenilirlik/kapama-k1-oncesi.mjs, dondurulmuş kopya). Üçüncü kopya güncel kuralla açılır: fatura kapamasına bağlı üç görünüm dışındaki
// her yanıt yine 2.0.26 ile aynı; ödeme durumu değişen her fatura iadesi olan bir carinin, taksitliyse açığı kartın kalanı (kapama-k1-fark.mjs).
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { localDay, pdfText, unwrap, xlsxSheets } from "./banka-210-ortak.mjs";
import { fixtureExists, unpackFixture } from "./guvenilirlik/fikstur.mjs";
import { CURRENT, bootVersion, tagsAvailable } from "./guvenilirlik/surumler.mjs";
import { runReconciliation } from "./mutabakat/motor.mjs";
import { legacyBankBox, legacyBankPos } from "./guvenilirlik/defter-olgulari.mjs";
import { invoiceStates, k1Check } from "./guvenilirlik/kapama-k1-fark.mjs";
import { settleInvoices as settleK1Oncesi } from "./guvenilirlik/kapama-k1-oncesi.mjs";

const OLD = "v2.0.26";
const skip = tagsAvailable([OLD]) ? false : `${OLD} etiketi bu depoda yok (git fetch --tags)`;
const TODAY = localDay(0);
const MONTH = `${TODAY.slice(0, 7)}-01`;
const PAST = { from: localDay(-75), to: localDay(-8) };
const OLD_649 = "Diğer Olağan Gelirler (Kasaya Elle)";
const NEW_649 = "Diğer Olağan Gelir ve Kârlar";
const STAMP = /\d{2}\.\d{2}\.\d{4} \d{2}:\d{2}(:\d{2})?/g;

const norm649 = value => JSON.parse(JSON.stringify(value).split(OLD_649).join("649-AD").split(NEW_649).join("649-AD"));
const textNorm = value => value.replace(STAMP, "TARİH SAAT").split(OLD_649).join("649-AD").split(NEW_649).join("649-AD");
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

// 2.1.0 Aşama 14 (bilerek değişen iki görünüm; plan §11.4, §10.5): yeni tarafta ANLIK DURUM'un Banka kutusu (K10: Gerçek Banka) ve Banka ve POS
// Hareketleri'nin iç hareket ayrımı (§3.4) 2.0.26 karşılığına aynı satırlardan çevrilir (test/guvenilirlik/defter-olgulari.mjs); K10 kabulü
// (Gerçek Banka + Hesabı Atanmamış = eski Banka / POS) ayrıca denetlenir. İç hareketi olan Banka ve POS Hareketleri dönemlerinin PDF/Excel'i
// eski dosyayla değil, aynı dönemin ekranıyla karşılaştırılır (özet ve açıklama biçimi bilerek değişti).
const k10Problems = [];
async function fetchOne(api, request, side = "eski") {
  if (request.kind === "json") {
    const response = unwrap(await api.client.get(request.url));
    let data = response.data;
    if (side === "yeni" && response.status === 200 && request.url.split("?")[0] === "/api/workspace/overview") {
      const { box, k10 } = await legacyBankBox(apiLike(api), data);
      if (k10 && k10.realBank + k10.unassigned !== k10.legacyAll) k10Problems.push(`K10: Gerçek Banka ${k10.realBank} + Hesabı Atanmamış ${k10.unassigned} ≠ eski Banka / POS ${k10.legacyAll}`);
      data = { ...data, cash: { ...data.cash, bank: box } };
    }
    if (side === "yeni" && response.status === 200 && request.url.includes("/report-center/banka-pos-hareketleri")) data = legacyBankPos(data);
    return { status: response.status, body: norm649(strip(data, request.drop || [])) };
  }
  const response = await api.client.raw("GET", request.url);
  if (response.status !== 200) return { status: response.status, body: response.data };
  // Hesap Planı Mizanı PDF'inde "Hesap Adı" kolonunun genişliği en uzun hesap adına göre (649'un yeni adı kısaldı): aynı metin
  // başka yerden satır kırar. Bu raporda satır kırılımı boşluğa indirgenir; sözcükler ve sıraları birebir karşılaştırılır.
  if (request.kind === "pdf") {
    const text = pdfText(response.buffer);
    // 2.1.0 Aşama 14: altıdan çok özet kutusu iki sıraya dizilir (Banka ve POS Hareketleri'nde 7–8 kutu; tek sırada tutar kesiliyordu) →
    // tablo sayfalara başka yerden bölünür ve uzun özet başlığı satır kırmaz. Bu raporda sayfa başlıkları (şirket · rapor, "Sayfa n / m", alt
    // başlık, kolon başlıkları) atılır ve satır kırılımı boşluğa indirgenir; sözcükler ve sıraları birebir karşılaştırılır.
    if (request.url.includes("/banka-pos-hareketleri/")) return { status: 200, body: textNorm(withoutPageHeads(text).replace(/\s+/g, " ")) };
    return { status: 200, body: textNorm(request.url.includes("/hesap-mizani/") ? text.replace(/\s+/g, " ") : text) };
  }
  const sheets = xlsxSheets(response.buffer);
  for (const rows of Object.values(sheets)) for (let k = rows.length - 1; k >= 0; k -= 1) if (rows[k][0] === "Hazırlanma") rows.splice(k, 1);
  return { status: 200, body: norm649(sheets) };
}

const COLUMN_HEADS = ["Tarih", "Yol", "Kaynak", "Açıklama", "Giriş", "Çıkış", "Bakiye", "Giren"];
function withoutPageHeads(text) {
  const lines = text.split("\n");
  const out = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (/^Sayfa \d+ \/ \d+$/.test(lines[index])) {
      if (out.length && / · Banka ve POS Hareketleri$/.test(out.at(-1))) out.pop();
      if (/^Banka ve POS Hareketleri · /.test(lines[index + 1] || "")) index += 1;
      if (COLUMN_HEADS.every((head, k) => lines[index + 1 + k] === head)) index += COLUMN_HEADS.length;
      continue;
    }
    out.push(lines[index]);
  }
  return out.join("\n");
}
const apiLike = api => ({ get: async url => unwrap(await api.client.get(url)) });
const MONEY_CELL = /^−?(?:\d{1,3}(?:\.\d{3})*|\d+),\d{2} TL$/;
/** Banka ve POS Hareketleri'nin bu dönemi iç hareket içeriyor mu (yeni ekran)? İçeriyorsa PDF/Excel aynı dönemin ekranıyla karşılaştırılır. */
async function bankPosSelfCheck(api, request) {
  const json = unwrap(await api.client.get(request.url.replace(/\/(pdf|xlsx)(\?|$)/, "$2")));
  if (json.status !== 200 || !json.data.summary.some(([key]) => key === "Transfer Giriş")) return null;
  const cells = [...json.data.rows.flat(), ...(json.data.footer || [])].filter(cell => MONEY_CELL.test(String(cell)));
  const response = await api.client.raw("GET", request.url);
  if (request.kind === "pdf") {
    const text = pdfText(response.buffer).replace(/\s+/g, " ");
    return cells.filter(cell => !text.includes(cell)).map(cell => `PDF'te yok: ${cell}`);
  }
  const values = new Set(Object.values(xlsxSheets(response.buffer)).flat(2).map(value => (typeof value === "number" ? Math.round(value * 100) : value)));
  const minor = cell => Math.round(Number(String(cell).replace(/[^\d,−-]/g, "").replace(/\./g, "").replace(",", ".").replace("−", "-")) * 100);
  return cells.filter(cell => !values.has(minor(cell))).map(cell => `Excel'de yok: ${cell}`);
}

async function login(server, who) {
  return who === "staff" ? server.login("altin-muhasebe", "Altin-Muhasebe-2026!") : server.login();
}

/** İki sunucuya aynı istekleri gönderip yanıtları karşılaştırır; farkları döndürür. */
// K1'in bilerek değiştirdiği görünümler (fatura kapamasına bağlı): ANLIK DURUM (fatura kutusu), Nakit Akış ve Vade Takip (fatura kalemleri).
const K1_VIEWS = ["/api/workspace/overview", "/api/workspace/overview/nakit-akisi", "/api/workspace/overview/vade-takip"];
const k1View = url => K1_VIEWS.includes(url.split("?")[0]);
async function compare(oldServer, newServer, { companies, label, skip = () => false }) {
  const problems = [];
  let compared = 0;
  for (const company of companies) {
    for (const who of ["admin", "staff"]) {
      if (who === "staff" && company.id !== "sirket-001") continue; // personelin şirket yetkisi yalnız 001
      const a = await login(oldServer, who);
      const b = await login(newServer, who);
      // Şirket seçimi kullanıcı başına sunucuda saklanır: 001 de açıkça seçilir (K1 karşılaştırması aynı sunucuya ikinci kez girer).
      for (const api of [a, b]) assert.equal((await api.post("/api/companies/select", { id: company.id })).status, 200, `${company.code} seçilemedi`);
      for (const request of requests().filter(item => (item.who || "admin") === who && !skip(item.url))) {
        const where = `${label} · ${company.code} · ${who} · ${request.kind} ${request.url}`;
        if (request.kind !== "json" && request.url.includes("/banka-pos-hareketleri/")) {
          const self = await bankPosSelfCheck(b, request);
          if (self) {
            compared += 1;
            if (self.length) problems.push(`${where}: yeni dosya ekranla aynı değil: ${self.slice(0, 5).join("; ")}`);
            continue;
          }
        }
        const [left, right] = [await fetchOne(a, request), await fetchOne(b, request, "yeni")];
        compared += 1;
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
  problems.push(...k10Problems.splice(0));
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
  for (const side of ["eski", "yeni", "guncel"]) {
    cpSync(sourceData, dirs(side).dataDir, { recursive: true });
    cpSync(sourceBackups, dirs(side).backupDir, { recursive: true });
  }
  const oldServer = await bootVersion(OLD, { ...dirs("eski"), maxCompanies: 10 });
  const newServer = await bootVersion(CURRENT, { ...dirs("yeni"), maxCompanies: 10, legacyClosing: settleK1Oncesi });
  const currentServer = await bootVersion(CURRENT, { ...dirs("guncel"), maxCompanies: 10 });
  try {
    assert.equal(newServer.app.store.get("PRAGMA user_version").user_version, 20, "bu dal v20'de");
    assert.equal(oldServer.app.store.get("PRAGMA user_version").user_version, 19, "v2.0.26 v19'da");
    // Canlı Hata 2'nin açılış onarımı (iade + geri ödemeyle yanlış büyümüş kartı küçültür) bu dalın BİLEREK farklı gösterdiği tek veri durumudur:
    // onarılan kart Nakit Akış, Vade Takip ve taksit görünümlerinde 2.0.26'dan farklı olur. Karşılaştırma onarımsız veriyle anlamlıdır; motorun
    // rastgele sırası değişip veri böyle bir kart içerirse bu denetim farkın nedenini söyler (10.10.2026: yeni motor işlemleri sırayı değiştirince
    // FIS2026000000002'nin kartı 2.658,37 → 0 onarıldı ve Nakit Akış "plan:in" farkı olarak görünmüştü).
    for (const server of [newServer, currentServer]) {
      const repaired = server.app.store.all("SELECT entity_id, payload_json FROM audit_events WHERE type = 'plan.repaired'");
      assert.deepEqual(repaired, [], `${label}: açılış onarımı (Canlı Hata 2) kart değiştirdi — veri bu karşılaştırma için uygun değil (bilerek fark)`);
    }
    const result = await compare(oldServer, newServer, { companies, label });
    // K1 (güncel kural): fatura kapamasına bağlı üç görünüm dışındaki her yanıt 2.0.26 ile aynı; ödeme durumu farkı yalnız iadesi olan carilerde.
    const k1 = await compare(oldServer, currentServer, { companies, label: `${label} · K1 güncel kural`, skip: k1View });
    result.problems.push(...k1.problems);
    result.compared += k1.compared;
    result.k1Changed = 0;
    for (const company of companies) {
      const [legacyApi, currentApi] = [await newServer.login(), await currentServer.login()];
      for (const api of [legacyApi, currentApi]) assert.equal((await api.post("/api/companies/select", { id: company.id })).status, 200, `${company.code} seçilemedi`);
      const check = await k1Check(await invoiceStates(legacyApi), currentApi);
      result.k1Changed += check.changed.length;
      result.problems.push(...check.problems.map(text => `${label} · ${company.code} · K1: ${text}`));
    }
    return result;
  } finally {
    await oldServer.close();
    await newServer.close();
    await currentServer.close();
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
      const { problems, compared, k1Changed } = await sideBySide(fixture.dataDir, fixture.backupDir, "zincir", companies);
      console.log(`K1 zincir: durumu değişen belge ${k1Changed}; karşılaştırılan yanıt ${compared}`);
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
        // v2.0.26'da banka modülü yok: motorun banka ekseni kapalı (rastgele sıra eski motorla birebir aynı kalır).
        const report = await runReconciliation({ client: admin.client, seed: 210, operations: 260, verifyEvery: 100_000, reportEvery: 100_000, burst: 8, span: 120, bank: false });
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
      const { problems, compared, k1Changed } = await sideBySide(dataDir, backupDir, "motor", [{ id: "sirket-001", code: "001" }]);
      console.log(`K1 motor: durumu değişen belge ${k1Changed}; karşılaştırılan yanıt ${compared}`);
      assert.ok(compared >= 75, `karşılaştırılan yanıt sayısı ${compared}`);
      assert.deepEqual(problems, [], `${problems.length} fark:\n${problems.slice(0, 8).join("\n\n")}`);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
