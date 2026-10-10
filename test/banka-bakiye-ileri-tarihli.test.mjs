// 2.1.0 temel sürüm — Banka Bakiye Raporu'nda eski sürümden kalan İLERİ TARİHLİ hesapsız havale (ek iş D, 10.10.2026; kılavuz ajanının ekranı
// docs/kilavuz/ekran/k36-banka-raporu.jpg: "Bu Yıl" raporu Hesabı Atanmamış 1.500 derken Banka Genel Bakış aynı anda 0 diyordu).
//
// KARAR (plan §8.4 "Hesabı Atanmamış Eski Hareketler … bugüne kadar" (K10), §8.10 "Banka Bakiye Raporu: gerçek, bekleyen ve hesabı atanmamış
// ayrı", A13 / karar 42 "eski ileri tarihli satır … tarihi gelince atanır"; T4 kararı "Hesabı Atanmamış bugüne kadar"): rapor bakiyesi DÖNEM SONU
// İTİBARIYLA, ama dönem sonu bugünden sonraysa bugünden sonraki (tarihi gelmemiş) eski hareket bakiyeye ve giriş/çıkışa KARIŞMAZ; Genel Bakış'la
// aynı kuralla ayrı bilgi olarak özette görünür ("Tarihi Gelince Atanabilir": tutar; "Tarihi Gelmemiş Eski Hareket": sayı · ilk tarih; toplamlara
// girmez). TOPLAM = satırlar.
// Ekran, PDF ve Excel aynı.
//
// TEST VERİSİ: GERÇEK v2.0.23 kodu (git etiketi) API'sinden; tarihler göreli (D0 = bugün), güncel kodda sahte saat D0 (ders 13).
// Bağımsız beklenen: testin kendi defteri (LEGACY) ve kuralı; programdan okunmaz.
// NASIL BOZARIM / HER SÜZGEÇ (ders 11): dönem seçenekleri (Bu Yıl varsayılan, Bu Ay, Geçen Ay, Son 30 Gün, Tüm Zamanlar) + elle aralık (geleceğe
// uzanan, yalnız ilk ileri satırı kapsayan, geçmişte biten, tamamen gelecekte) × hesap grubu (Hesabı Atanmamış, Tümü, Gerçek Banka).
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { pdfText, xlsxSheets } from "./banka-210-ortak.mjs";
import { CURRENT, bootVersion, tagsAvailable } from "./guvenilirlik/surumler.mjs";

const OLD = "v2.0.23";
const BANK = "/api/workspace/bank";
const pad = n => String(n).padStart(2, "0");
const base = new Date();
const day = offset => {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + offset, 12, 0, 0, 0);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const D0 = day(0);
const [Y, M] = D0.split("-").map(Number);
const iso = (y, m, d) => new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10);
const dmy = text => text.split("-").reverse().join(".");
const must = async (label, promise) => {
  const res = await promise;
  assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 500)}`);
  return res.data;
};
const minorOf = cell => {
  if (cell === "" || cell === null || cell === undefined) return null;
  const text = String(cell).replace(/[^\d,.-]/g, "");
  return text ? Math.round(Number(text.replace(/\./g, "").replace(",", ".")) * 100) : null;
};

// Bağımsız defter: v2.0.23'te hesapsız (102.00) girilen havaleler (kuruş, işaretli).
const LEGACY = [
  { date: day(-2), minor: 25_000 },
  { date: day(5), minor: -40_000 },
  { date: day(10), minor: 100_000 },
];

async function seed(dirs) {
  const old = await bootVersion(OLD, dirs);
  try {
    const api = await old.login();
    const customer = await must("v2.0.23 müşteri", api.post("/api/workspace/accounts", { name: "Rapor Müşterisi", type: "customer" }));
    const supplier = await must("v2.0.23 tedarikçi", api.post("/api/workspace/accounts", { name: "Rapor Tedarikçisi", type: "supplier" }));
    await must("v2.0.23 geçmiş havale", api.post(`/api/workspace/accounts/${customer.id}/entries`, { kind: "in", amount: 250, date: day(-2), method: "bank" }));
    const out = await must("v2.0.23 verilen çek", api.post("/api/workspace/cheques", { direction: "out", instrument: "cheque", amount: 400, issueDate: day(-1), dueDate: day(5), serialNo: "BR-1", accountId: supplier.id }));
    await must("v2.0.23 verilen çek bankadan İLERİ TARİHLE", api.post(`/api/workspace/cheques/${out.id}/actions`, { action: "pay", date: day(5), method: "bank", status: "pending" }));
    const inc = await must("v2.0.23 alınan çek", api.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", amount: 1000, issueDate: day(-3), dueDate: day(10), serialNo: "BR-2", accountId: customer.id }));
    await must("v2.0.23 alınan çek bankaya İLERİ TARİHLE", api.post(`/api/workspace/cheques/${inc.id}/actions`, { action: "collect", date: day(10), method: "bank", status: "portfolio" }));
  } finally {
    await old.close();
  }
}

// Dönem seçenekleri (rapor ekranındakiler) ve elle aralıklar; from/to bağımsız hesap (presetRange'den okunmaz).
const RANGES = [
  { label: "varsayılan (Bu Yıl)", q: {}, from: iso(Y, 1, 1), to: iso(Y, 12, 31) },
  { label: "Bu Ay", q: { preset: "thisMonth" }, from: iso(Y, M, 1), to: iso(Y, M + 1, 0) },
  { label: "Geçen Ay", q: { preset: "lastMonth" }, from: iso(Y, M - 1, 1), to: iso(Y, M, 0) },
  { label: "Son 30 Gün", q: { preset: "last30" }, from: day(-30), to: D0 },
  { label: "Tüm Zamanlar", q: { preset: "all" }, from: "", to: D0 },
  { label: "geleceğe uzanan (D−10 … D+30)", q: { from: day(-10), to: day(30) }, from: day(-10), to: day(30) },
  { label: "yalnız ilk ileri satır (D−10 … D+7)", q: { from: day(-10), to: day(7) }, from: day(-10), to: day(7) },
  { label: "geçmişte biten (D−10 … D−3)", q: { from: day(-10), to: day(-3) }, from: day(-10), to: day(-3) },
  { label: "tamamen gelecekte (D+1 … D+30)", q: { from: day(1), to: day(30) }, from: day(1), to: day(30) },
];

const skip = !tagsAvailable([OLD]) && `${OLD} etiketi bu depoda yok (git fetch --tags)`;

describe("Banka Bakiye Raporu: ileri tarihli eski hesapsız havale bakiyeye karışmaz (gerçek v2.0.23 verisi)", { skip }, () => {
  let root;
  let server;
  let api;
  before(async () => {
    root = mkdtempSync(path.join(tmpdir(), "banka-bakiye-ileri-"));
    const dirs = { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups") };
    await seed(dirs);
    server = await bootVersion(CURRENT, { ...dirs, now: { time: D0 }, moneyStrict: false, gateVerify: false });
    api = await server.login();
    await must("Ziraat hesabı", api.post(`${BANK}/accounts`, { bankName: "Ziraat Bankası", name: "Ana TL Hesabı", kind: "demand", opening: { date: day(-5), amount: "10.000", confirmed: true } }));
  });
  after(async () => {
    await server?.close().catch(() => {});
    if (root) rmSync(root, { recursive: true, force: true });
  });
  const report = async query => must("Banka Bakiye Raporu", api.get(`/api/workspace/report-center/banka-bakiye?${new URLSearchParams(query)}`));
  const summaryOf = (data, key) => (data.summary || []).find(([name]) => name === key)?.[1];
  const col = (data, header) => data.headers.indexOf(header);

  it("Banka Genel Bakış: Hesabı Atanmamış 250 (bugüne kadar); ileri tarihli 2 satır (+600) ayrı", async () => {
    const summary = await must("Banka Genel Bakış", api.get(`${BANK}/summary`));
    assert.deepEqual([summary.unassigned.totalMinor, summary.unassigned.future?.count, summary.unassigned.future?.totalMinor], [25_000, 2, 60_000]);
  });

  for (const r of RANGES) {
    it(`${r.label}: Hesabı Atanmamış = dönem sonu ile bugünden hangisi önceyse o güne kadar; ileri tarihli ayrı bilgi; TOPLAM = satırlar`, async () => {
      const cut = r.to && r.to < D0 ? r.to : D0; // bakiyeye giren son gün
      const inBalance = LEGACY.filter(item => item.date <= cut);
      const ahead = LEGACY.filter(item => item.date > D0 && (!r.to || item.date <= r.to));
      const closing = inBalance.reduce((sum, item) => sum + item.minor, 0);
      const opening = inBalance.filter(item => r.from && item.date < r.from).reduce((sum, item) => sum + item.minor, 0);
      const period = inBalance.filter(item => !r.from || item.date >= r.from);
      const inMinor = period.filter(item => item.minor > 0).reduce((sum, item) => sum + item.minor, 0);
      const outMinor = 0 - period.filter(item => item.minor < 0).reduce((sum, item) => sum + item.minor, 0);
      for (const group of ["unassigned", "all", "real"]) {
        const tag = `${r.label} · ${group}`;
        const data = await report({ ...r.q, bankGroup: group });
        const row = data.rows.find(cells => cells[col(data, "Alt Hesap")] === "102.00");
        if (group === "real") assert.equal(row, undefined, `${tag}: Gerçek Banka grubunda 102.00 yok`);
        else if (!inBalance.length) assert.equal(row, undefined, `${tag}: dönem sonuna kadar hareket yok → satır yok (${JSON.stringify(row)})`);
        else {
          assert.ok(row, `${tag}: 102.00 satırı yok`);
          const got = header => minorOf(row[col(data, header)]);
          assert.deepEqual([got("Dönem Başı"), got("Giriş"), got("Çıkış"), got("Dönem Sonu")], [opening, inMinor, outMinor, closing], `${tag}: 102.00 sayıları (ileri tarihli satır bakiyeye ve giriş/çıkışa karışmaz)`);
        }
        if (inBalance.length) assert.equal(minorOf(summaryOf(data, "Hesabı Atanmamış Eski Hareketler")), closing, `${tag}: özet Hesabı Atanmamış`);
        if (group === "unassigned" && data.rows.length) {
          const sum = data.rows.reduce((total, cells) => total + minorOf(cells[col(data, "Dönem Sonu")]), 0);
          assert.equal(minorOf(data.footer?.[col(data, "Dönem Sonu")]), sum, `${tag}: TOPLAM = satırlar`);
        }
        const note = summaryOf(data, "Tarihi Gelince Atanabilir");
        if (ahead.length) {
          const total = ahead.reduce((acc, item) => acc + item.minor, 0);
          const detail = summaryOf(data, "Tarihi Gelmemiş Eski Hareket");
          assert.ok(note, `${tag}: ileri tarihli eski hareket ayrı bilgi yok (${JSON.stringify(data.summary)})`);
          assert.equal(minorOf(note), total, `${tag}: tutar (${note})`);
          assert.equal(detail, `${ahead.length} · ilk ${dmy(ahead[0].date)}`, `${tag}: sayı ve ilk tarih`);
        } else assert.deepEqual([note, summaryOf(data, "Tarihi Gelmemiş Eski Hareket")], [undefined, undefined], `${tag}: ileri tarihli bilgi olmamalı (${note})`);
      }
    });
  }

  it("Bu Yıl: rapor Hesabı Atanmamış = Banka Genel Bakış (aynı gün aynı sayı); PDF ve Excel ekranla aynı", async () => {
    const summary = await must("Banka Genel Bakış", api.get(`${BANK}/summary`));
    const data = await report({ bankGroup: "all" });
    assert.equal(minorOf(summaryOf(data, "Hesabı Atanmamış Eski Hareketler")), summary.unassigned.totalMinor, "rapor = Genel Bakış");
    const note = summaryOf(data, "Tarihi Gelince Atanabilir");
    const pdf = await api.client.raw("GET", "/api/workspace/report-center/banka-bakiye/pdf?bankGroup=all");
    assert.equal(pdf.status, 200);
    const text = pdfText(pdf.buffer).replace(/\s+/g, " ");
    const detail = summaryOf(data, "Tarihi Gelmemiş Eski Hareket");
    const at = text.indexOf("Tarihi Gelince Atanabilir");
    assert.ok(at >= 0 && text.includes(`Tarihi Gelince Atanabilir ${note}`) && text.includes(`Tarihi Gelmemiş Eski Hareket ${detail}`), `PDF özet: ${note} / ${detail} — PDF'te: ${at >= 0 ? text.slice(at, at + 160) : text.slice(0, 600)}`);
    const xlsx = await api.client.raw("GET", "/api/workspace/report-center/banka-bakiye/xlsx?bankGroup=all");
    assert.equal(xlsx.status, 200);
    const ozet = Object.fromEntries((xlsxSheets(xlsx.buffer)["Özet"] || []).map(([key, value]) => [key, value]));
    const cell = ozet["Tarihi Gelince Atanabilir"];
    assert.equal(typeof cell === "number" ? Math.round(cell * 100) : minorOf(cell), minorOf(note), `Excel Özet tutar (${cell})`);
    assert.equal(ozet["Tarihi Gelmemiş Eski Hareket"], detail, "Excel Özet sayı ve ilk tarih");
  });
});
