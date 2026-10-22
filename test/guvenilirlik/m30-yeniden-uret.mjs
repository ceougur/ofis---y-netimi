// 2.4.4 madde 30 bulgularının EN KISA yeniden üretimi, eski sürümün GERÇEK koduyla karşılaştırmalı (ders 6). Sahte saat (ders 13), sahte EDM, ders 30.
//   node --disable-warning=ExperimentalWarning test/guvenilirlik/m30-yeniden-uret.mjs [b1|b2|hepsi]
// B1 — Tahsilat Takvimi / ödeme sözü tutarı: tabloda "Toplam Borç" + "Ödenen" + "Kalan Borç" + "Ödeme Sözü" kolonları varken söz kaleminin tutarı
//      v2.4.3'te Toplam Borç, 2.4.4'te Kalan Borç (7d51d60, madde 5b; server/lib/insight/dues.mjs classifyColumns AMOUNT_REMAINING önceliği).
// B2 — yedek → e-Arşiv gönder + Müşteri Fişi Olarak Bırak → geri yükle → yeniden kes: yedekten sonra EDM'ye gitmiş e-Arşiv numarası ve verilmiş fiş numarası
//      geri yüklenen veride yeniden verilir (EDM 11048 reddi). İki sürümde de.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createClock } from "../../server/lib/clock.mjs";
import { resetEdmCaches } from "../../server/lib/einvoice/edm.mjs";
import { OUR_VKN, startMockEdm } from "../einvoice-mock.mjs";
import { ADMIN_PASSWORD } from "../helpers.mjs";
import { CURRENT, bootVersion } from "./surumler.mjs";

const which = process.argv[2] || "hepsi";
const pad = n => String(n).padStart(2, "0");
const now = new Date();
const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
const addDays = (day, n) => {
  const d = new Date(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)), 12);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const trDay = day => `${day.slice(8, 10)}.${day.slice(5, 7)}.${day.slice(0, 4)}`;
const must = async (what, promise) => {
  const res = await promise;
  if (res.status !== 200) throw new Error(`${what}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
  return res.data;
};
const flags = version => (version === CURRENT ? { edocEnabled: true, edocLive: true, esmmEnabled: true } : { edocEnabled: true, edocLive: true });
let tests = 0;
let fail = 0;
const result = (name, ok, detail) => {
  tests += 1;
  if (!ok) fail += 1;
  console.log(`${ok ? "✓" : "✗"} ${name} ${JSON.stringify(detail)}`);
};

async function b1(version) {
  const root = mkdtempSync(path.join(tmpdir(), "m30-b1-"));
  const clock = createClock({ time: new Date(`${today}T10:00:00`), fixed: true });
  const server = await bootVersion(version, { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" }, now: clock, ...flags(version) });
  try {
    const api = await server.login();
    const matrix = [["Dosya No", "Ad Soyad", "Telefon", "Toplam Borç", "Ödenen", "Kalan Borç", "Ödeme Sözü"], ["2026/00001", "Tülay Öz", "0555 111 22 33", "11500", "3900", "7600", trDay(addDays(today, 5))]];
    const staged = await must("tablo", api.post("/api/workspace/dataset/stage", { kind: "excel", fileName: "b1.xlsx", sheets: [{ name: "Borçlular", matrix }] }));
    await must("kaydet", api.post("/api/workspace/dataset/commit", { stageId: staged.stageId, mode: "replace" }));
    const dues = await must("takvim", api.get("/api/workspace/dues"));
    const item = dues.items.find(entry => entry.caseKey === "2026/00001");
    const vade = await must("Vade Takip", api.get(`/api/workspace/reports/vade-takip?from=2000-01-01&to=2099-12-31`));
    const akis = await must("Nakit Akışı", api.get(`/api/workspace/reports/nakit-akis?from=2000-01-01&to=2099-12-31`));
    return { version: version === CURRENT ? "2.4.4-aday" : version, commit: server.commit, sozTutari: item?.amount ?? null, borcKolonu: item?.debtColumn ?? "(alan yok)", vadeTakip: vade.report?.totals?.amount ?? null, nakitAkisBeklenen: akis.report?.totals?.expected ?? null };
  } finally {
    await server.close();
    rmSync(root, { recursive: true, force: true });
  }
}

async function b2(version) {
  const root = mkdtempSync(path.join(tmpdir(), "m30-b2-"));
  const clock = createClock({ time: new Date(`${today}T10:00:00`), fixed: false });
  resetEdmCaches();
  const edm = await startMockEdm();
  const boot = () => bootVersion(version, { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" }, now: clock, edocStatusPollMs: [10, 10], ...flags(version) });
  let server = await boot();
  try {
    let api = await server.login();
    await must("ayar", api.put("/api/workspace/invoices/settings", { seller: { name: "Deneme Ofis Ltd.", taxNo: OUR_VKN, taxOffice: "Çankaya", address: "Atatürk Blv. 1", district: "Çankaya", city: "Ankara" }, efatura: true, earsiv: true, integrator: { env: "test", baseUrl: edm.url, username: "edmkullanici", password: "Gizli-Parola-1", senderAlias: "urn:mail:defaultgb@deneme.com.tr" } }));
    const person = (await must("cari", api.post("/api/workspace/accounts", { name: "Ayşe Kaya", type: "customer", partyKind: "person", firstName: "Ayşe", familyName: "Kaya", taxNo: "10000000146", address: "Kordon 1", district: "Konak", city: "İzmir" }))).id;
    const sale = eSend => must(`satış ${eSend}`, api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: person, lines: [{ name: "Danışmanlık", qty: 1, unitPrice: 500, vatRate: 20 }], payment: { rest: "open" }, eSend }));
    await sale("now");
    const backup = await must("yedek", api.post("/api/admin/backups", { scope: "one", companyId: "sirket-001" }));
    const w2 = await sale("now");
    const w2card = await must("kart", api.get(`/api/workspace/invoices/${w2.id}`));
    const w2b = await sale("later");
    const w2fis = (await must("bırak", api.post(`/api/workspace/invoices/${w2b.id}/withdraw`, {}))).number;
    const restored = await must("geri yükle", api.post("/api/admin/backups/restore", { name: backup.name, company: "sirket-001", confirm: "001", password: ADMIN_PASSWORD }));
    if (restored.staged) {
      await server.close();
      server = await boot();
      api = await server.login();
    }
    const w3 = await sale("now").catch(error => ({ error: String(error.message).slice(0, 200) }));
    const w3card = w3.id ? await must("kart", api.get(`/api/workspace/invoices/${w3.id}`)) : null;
    const w3b = await sale("later");
    const w3fis = (await must("bırak", api.post(`/api/workspace/invoices/${w3b.id}/withdraw`, {}))).number;
    return { version: version === CURRENT ? "2.4.4-aday" : version, commit: server.commit, araDonemEArsiv: [w2card.number, w2card.eStatus], geriYuklemeSonrasiEArsiv: w3card ? [w3card.number, w3card.eStatus, String(w3card.eMessage || "").slice(0, 120)] : w3, araDonemFis: w2fis, geriYuklemeSonrasiFis: w3fis, edmAyniNumara: edm.state.sent.filter(item => item.id === w2card.number).length };
  } finally {
    await server.close();
    await edm.close();
    rmSync(root, { recursive: true, force: true });
  }
}

if (which === "b1" || which === "hepsi") {
  const old = await b1("v2.4.3");
  const cur = await b1(CURRENT);
  console.log(JSON.stringify({ b1: [old, cur] }));
  result("B1 yeniden üretildi: söz tutarı v2.4.3 Toplam Borç (11.500), 2.4.4 Kalan Borç (7.600)", old.sozTutari === 11500 && cur.sozTutari === 7600, { old, cur });
}
if (which === "b2" || which === "hepsi") {
  const old = await b2("v2.4.3");
  const cur = await b2(CURRENT);
  console.log(JSON.stringify({ b2: [old, cur] }));
  const reused = r => Array.isArray(r.geriYuklemeSonrasiEArsiv) && r.geriYuklemeSonrasiEArsiv[0] === r.araDonemEArsiv[0] && r.geriYuklemeSonrasiFis === r.araDonemFis;
  result("B2 yeniden üretildi: geri yüklemeden sonra ara dönemin e-Arşiv ve fiş numarası yeniden verilir (iki sürümde de)", reused(old) && reused(cur), { old, cur });
}
console.log(`# tests ${tests}\n# pass ${tests - fail}\n# fail ${fail}\n# cancelled 0\n# skipped 0\n# todo 0`);
process.exitCode = fail ? 1 : 0;
