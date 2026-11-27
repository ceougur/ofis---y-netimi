#!/usr/bin/env node
// 2.5.1 D3 — GERÇEK VERİ (CLAUDE.md test kuralı: "eski sürüm verisi, o sürümün GERÇEK kodu çalıştırılıp API'sinden girilerek üretilir"; ders 17; tasarım §3.12 (c)).
// v2.5.0'ın GERÇEK kodu (`git worktree add --detach … v2.5.0`; ders 23, 54) 14 aylık veriyi (Aralık 2025 – Ocak 2027; 001 + 002) programın kendi API'siyle üretir; sonra YENİ kod
// aynı veri klasörünü açar (bekleyen göç varsa koşar) ve devir ön izlemesini (iş parçacığı) iki seçenekle hesaplar. Denetlenen:
//   - planın sorunları boş, bütün değişmezler tutar (kitap §6; 590 = Ç6 Dönem Net Kârı; 519 = 519; 153 = DSS; modül = defter);
//   - plan belirlenimli (iki koşu bayt bayt); iki seçenekte açık kalemler ve kuyruğa giren net aynı;
//   - DEVİRSİZ EŞDEĞER: her cari için gecikmiş(t) ve borç tarafı açık kalemleri (vade, kalan) devirli = devirsiz (t = K+1, K+2, 15.01, 20.01, 01.02, 01.03; test/fixtures/devir-d3-esdeger.mjs);
//   - hareket sayıları: ≤K + >K = toplam; 002'nin planı 001'in verisini saymaz.
// D3 TUR 2 (ZENGİN veri; varsayılan — tur 1'in yalın üreteci `--sade`): 001'e v2.5.0'ın API'siyle taksit kartı (açık, bitmiş, Borçta Kalsın — K'den önce / sonra, erken kapama),
// çek / senet (portföy, tahsil, ciro, ciro sonrası karşılıksız, karşılıksız, bankaya tahsile + tahsil / geri al, verilen + ödendi, sil + geri yükle), şüpheli (Şüpheliye Al, Karşılık,
// kısmi / tam Değersiz, Şüpheliden Çıkar), KDV Mahsup Fişi (bazı aylar atlanır) + Vergi Ödemesi, banka (havale, EFT, POS, kredi kartı, karttan ödeme, virman, kredi), iade faturası,
// bağlı tahsilat (K sonrası ≤K faturaya dahil), tahsilat sil + geri yükle, pasif cari, aynı adlı iki cari. Her isteğin yanıt kodu sayılır (ders 3). ≤K veri yazılınca Dönem Kilidi K,
// K sonrası adımlar kilitten sonra (S24 = A; devirsiz eşi "aynı kilitle"). Devirsiz eşdeğer bağ yönlendirmesiyle; kartlı / şüpheli cariler benzetim dışı (sayısı yazılır).
// Kullanım: node test/devir-d3-gercek-veri.mjs --eski <v2.5.0 kopyası> [--tohum 7] [--cari 300] [--sade]   (HUKUK_LICENSE_URL=http://127.0.0.1:9 — ders 30)
// Çıktı TAP benzeri ("ok N - …" / "not ok N - …") + sonunda "# tests / pass / fail"; çıkış kodu başarısızlıkta 1.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const argv = process.argv.slice(2);
const arg = (name, fallback) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : fallback);
const OLD = path.resolve(arg("--eski", ""));
const SEED = Number(arg("--tohum", "7"));
const PARTIES = Number(arg("--cari", "300"));
const NEW = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const NOW = "2027-01-20T12:00:00+03:00";
const K = "2026-12-31";
const root = mkdtempSync(path.join(tmpdir(), "d3-gercek-veri-"));
const dirs = { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups") };
let tests = 0;
let failed = 0;
const check = (ok, text) => {
  tests += 1;
  if (!ok) failed += 1;
  console.log(`${ok ? "ok" : "not ok"} ${tests} - ${text}`);
};
// Tohumlu üreteç (mulberry32): aynı tohum → aynı veri.
let state = SEED >>> 0;
const rand = () => {
  state = (state + 0x6d2b79f5) >>> 0;
  let t = state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pick = list => list[Math.floor(rand() * list.length)];
const between = (low, high) => low + Math.floor(rand() * (high - low + 1));
const pad = value => String(value).padStart(2, "0");
const unwrap = response => (response.data?.ok ? response.data.data : response.data);
const months = [];
for (let y = 2025, m = 12; y < 2027 || m <= 1; m += 1) {
  if (m > 12) {
    m = 1;
    y += 1;
  }
  months.push([y, m]);
  if (y === 2027 && m === 1) break;
}
const addDays = (day, n) => {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

// D3 tur 2 (görev iş 3): ZENGİN veri sınıfları — her isteğin yanıt kodu okunur (ders 3); 2xx = üretildi, 4xx = reddedildi (veri üretmez, sayılır), 5xx = koşu durur.
const produced = {};
const tally = (cls, status) => {
  const row = (produced[cls] ||= { ok: 0, ret: 0, ornekRet: "" });
  if (status >= 200 && status < 300) row.ok += 1;
  else row.ret += 1;
};
async function tryApi(cls, promise) {
  const res = await promise;
  tally(cls, res.status);
  if (res.status >= 500) throw new Error(`${cls}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
  if (res.status !== 200) {
    if (!produced[cls].ornekRet) produced[cls].ornekRet = `${res.status} ${String(res.data?.error || "").slice(0, 120)}`;
    return null;
  }
  return unwrap(res);
}
const NOW_DAY = "2027-01-20";
// Zengin üretim TAKVİM SIRASIYLA yazılır: sahte saat her olayın gününe ilerler (kayıt anı = olay günü; kilit izi karar (3) yazım anına bakar; mutabakat kapısı ileri tarihli hareketi reddeder
// — saat geri alınmaz). Takip adımları (evrak tahsili, kart tahsilatı / Borçta Kalsın kapanışı, şüpheli adımları, KDV mahsubu ve ödemesi) gününe göre sıralı bir AJANDADA bekler.
const START = "2025-12-01T08:00:00+03:00";
const LOCK_AT = "2027-01-01T00:30:00+03:00";
const SIMPLE = process.argv.includes("--sade");

async function generate(client, { q = "", parties = PARTIES, suppliers = 40, items = 20, perMonth = 1, rich = false, server = null }) {
  const ok = async (label, promise) => {
    const res = await promise;
    if (rich) tally(label, res.status);
    if (res.status !== 200) throw new Error(`${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
    return unwrap(res);
  };
  const customers = [];
  const vendors = [];
  const stock = [];
  for (let i = 0; i < parties; i += 1) customers.push((await ok("cari", client.post(`/api/workspace/accounts${q}`, { name: `Müşteri ${i + 1}`, type: "customer" }))).id);
  for (let i = 0; i < suppliers; i += 1) vendors.push((await ok("tedarikçi", client.post(`/api/workspace/accounts${q}`, { name: `Tedarikçi ${i + 1}`, type: "supplier" }))).id);
  for (let i = 0; i < items; i += 1) stock.push((await ok("ürün", client.post(`/api/workspace/stock${q}`, { name: `Ürün ${i + 1}`, unit: "Adet", unitPrice: String(between(20, 200)), openingQty: String(between(50, 400)), openingDate: "2025-12-01" }))).id);
  const pay = { cash: [], cheques: [], endorse: [], rest: "open" };
  let sales = 0;
  let lines = 0;
  // ---- ZENGİN kurulum (yalnız 001): banka hesapları, POS, kredi kartı, kredi, aynı adlı iki cari, pasif olacak cari ----
  const salesOf = new Map();
  const bank = {};
  let serial = 0;
  const store = server?.app?.store;
  const lastEntryId = account => store.get("SELECT id FROM account_entries WHERE account_id = ? ORDER BY rowid DESC LIMIT 1", account)?.id;
  let phase2 = false;
  let passive = "";
  const agenda = [];
  let agendaSeq = 0;
  const clockTo = day => {
    if (rich) server.clock.set(`${day}T09:00:00+03:00`);
  };
  // Takip adımı gününe ajandaya (boş tarih = yapılmaz; bugünden sonraysa da yapılmaz).
  const soon = (date, fn) => {
    if (date && date <= NOW_DAY) agenda.push({ date, seq: (agendaSeq += 1), fn });
  };
  async function runAgenda(until) {
    for (;;) {
      agenda.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.seq - b.seq));
      const next = agenda[0];
      if (!next || next.date > until) return;
      agenda.shift();
      clockTo(next.date);
      await next.fn();
    }
  }
  if (rich) {
    const opening = amount => ({ date: "2025-12-01", amount, confirmed: true });
    bank.z = (await tryApi("banka-hesabi", client.post("/api/workspace/bank/accounts", { bankName: "Ziraat Bankası", name: "Ziraat Vadesiz", kind: "demand", currency: "TRY", usePos: true, useCheque: true, useNote: true, opening: opening("50000") })))?.id;
    bank.g = (await tryApi("banka-hesabi", client.post("/api/workspace/bank/accounts", { bankName: "Garanti BBVA", name: "Garanti Vadesiz", kind: "demand", currency: "TRY", opening: opening("20000") })))?.id;
    bank.c = (await tryApi("banka-hesabi", client.post("/api/workspace/bank/accounts", { bankName: "Garanti BBVA", name: "Şirket Kartı", kind: "card", creditLimit: "100.000", opening: opening("0") })))?.id;
    bank.l = (await tryApi("banka-hesabi", client.post("/api/workspace/bank/accounts", { bankName: "Garanti BBVA", name: "Ticari Kredi", kind: "loan", currency: "TRY", opening: opening("0") })))?.id;
    await tryApi("pos-tanimi", client.post("/api/workspace/bank/pos", { name: "Mağaza POS", bankAccountId: bank.z, kind: "physical", providerKind: "bank", tax: "bsmv_incl", valorRule: "business", valorDays: 2, installmentPayout: "monthly", provisionDays: 0, refundCommission: "none", validFrom: "2025-12-01", rates: [{ installments: 1, rate: "2,5" }] }));
    bank.p = store.get("SELECT id FROM pos_terminals WHERE name = 'Mağaza POS'")?.id;
    soon("2025-12-10", () => tryApi("kredi-kullanimi", client.post("/api/workspace/bank/vouchers", { type: "loan_draw", accountId: bank.g, loanAccountId: bank.l, amount: "30000", date: "2025-12-10" })));
    // Aynı adlı iki cari (kimlikle ayrılır — test kuralı "aynı adlı iki kişi").
    customers.push((await ok("ayni-adli-cari", client.post(`/api/workspace/accounts${q}`, { name: "Müşteri 1", type: "customer", similarOk: true }))).id);
    customers.push((await ok("ayni-adli-cari", client.post(`/api/workspace/accounts${q}`, { name: "Müşteri 1", type: "customer", similarOk: true }))).id);
    // Pasif olacak cari: bakiyesi 0 (borç = tahsilat); pasife alma K'den sonra (aşağıda).
    passive = (await ok("pasif-adayi", client.post(`/api/workspace/accounts${q}`, { name: "Pasif Müşteri", type: "customer" }))).id;
    soon("2026-03-10", () => tryApi("pasif-hazirlik", client.post(`/api/workspace/accounts/${passive}/entries`, { kind: "debt", amount: "250", date: "2026-03-10", note: "Hizmet" })));
    soon("2026-04-10", () => tryApi("pasif-hazirlik", client.post(`/api/workspace/accounts/${passive}/entries`, { kind: "in", amount: "250", date: "2026-04-10", note: "Tahsilat" })));
  }
  for (const [y, m] of months) {
    if (rich && y === 2027 && !phase2) {
      // S24 = A (Ocak'ta devirden önce yazılmış bağ / karşılıksız K kilidiyle değerlendirilir; devirsiz eşi "aynı kilitle" — tasarım §3.12): ≤K veri bitince Dönem Kilidi K
      // (01.01.2027 00:30), K sonrası olaylar kilitten SONRA yazılır.
      await runAgenda(K);
      server.clock.set(LOCK_AT);
      await tryApi("donem-kilidi", client.put("/api/admin/period-lock", { lockedUntil: K }));
      await server.app.ledger.snapshots.runPending();
      phase2 = true;
    }
    const days = Array.from({ length: 28 }, (_, index) => `${y}-${pad(m)}-${pad(index + 1)}`).filter(day => day <= "2027-01-20");
    const events = [];
    if (rich) {
      const add = (kind, n) => {
        for (let i = 0; i < Math.round(n); i += 1) events.push({ kind, day: pick(days) });
      };
      add("linkpay", parties * 0.08);
      add("cheque_in", parties * 0.04);
      add("cheque_out", suppliers * 0.1);
      add("bank_in", parties * 0.06);
      add("bank_out", suppliers * 0.1);
      add("pos", parties * 0.04);
      add("card_buy", 2);
      add("card_pay", 1);
      add("transfer", 1);
      add("plan", parties * 0.02);
      add("doubtful", parties * 0.01);
      add("refund", parties * 0.02);
      add("delrestore", 1);
    }
    for (let i = 0; i < Math.round(parties * 0.4 * perMonth); i += 1) events.push({ kind: "sale", day: pick(days) });
    for (let i = 0; i < Math.round(suppliers * 0.5 * perMonth); i += 1) events.push({ kind: "purchase", day: pick(days) });
    for (let i = 0; i < Math.round(parties * 0.3 * perMonth); i += 1) events.push({ kind: "in", day: pick(days) });
    for (let i = 0; i < Math.round(suppliers * 0.3 * perMonth); i += 1) events.push({ kind: "out", day: pick(days) });
    for (let i = 0; i < Math.round(parties * 0.08 * perMonth); i += 1) events.push({ kind: "debt", day: pick(days) });
    for (let i = 0; i < 6; i += 1) events.push({ kind: "cash", day: pick(days) });
    // Satış belgeleri tarih sırasıyla (numara ↔ tarih kronolojisi); aynı gün içinde üretim sırası.
    events.sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
    for (const event of events) {
      const day = event.day;
      if (rich) {
        await runAgenda(day);
        clockTo(day);
      }
      if (rich && (await richEvent(event.kind, day))) {
        lines += 1;
        continue;
      }
      if (event.kind === "sale") {
        const due = rand() < 0.2 ? "" : addDays(day, pick([0, 15, 30, 45, 60, 90]));
        const customer = pick(customers);
        const sold = await ok("satış", client.post(`/api/workspace/invoices${q}`, { kind: "sale", accountId: customer, issueDate: day, lines: [{ itemId: pick(stock), name: "", qty: between(1, 5), unitPrice: between(50, 400), discountRate: 0, vatRate: pick([1, 10, 20]) }], payment: due ? { ...pay, dueDate: due } : pay, force: true, stockForce: true }));
        if (rich) {
          if (!salesOf.has(customer)) salesOf.set(customer, []);
          salesOf.get(customer).push({ id: sold.id, day });
        }
        sales += 1;
      } else if (event.kind === "purchase") {
        await ok("alış", client.post(`/api/workspace/invoices${q}`, { kind: "purchase", accountId: pick(vendors), number: `AL-${y}${pad(m)}-${lines}`, issueDate: day, lines: [{ itemId: pick(stock), name: "", qty: between(5, 30), unitPrice: between(15, 150), discountRate: 0, vatRate: 20 }], payment: rand() < 0.7 ? { ...pay, dueDate: addDays(day, pick([10, 30, 60])) } : pay, force: true }));
      } else if (event.kind === "in") {
        await ok("tahsilat", client.post(`/api/workspace/accounts/${pick(customers)}/entries${q}`, { kind: "in", amount: String(between(50, 1500)), date: day, note: "Tahsilat" }));
      } else if (event.kind === "out") {
        await ok("ödeme", client.post(`/api/workspace/accounts/${pick(vendors)}/entries${q}`, { kind: "out", amount: String(between(100, 2500)), date: day, note: "Ödeme", cashForce: true }));
      } else if (event.kind === "debt") {
        const due = rand() < 0.5 ? addDays(day, pick([10, 40, 70])) : "";
        await ok("borç yaz", client.post(`/api/workspace/accounts/${pick(customers)}/entries${q}`, { kind: "debt", amount: String(between(30, 600)), date: day, note: "Hizmet", ...(due ? { dueDate: due, ...(rand() < 0.5 ? { expectedDate: addDays(day, 5) } : {}) } : {}) }));
      } else {
        await ok("kasa", client.post(`/api/workspace/cash${q}`, { kind: rand() < 0.6 ? "in" : "out", amount: String(between(20, 300)), description: "Kasa", date: day, force: true, cashForce: true }));
      }
      lines += 1;
    }
    if (rich) {
      // KDV Mahsup Fişi: bazı aylar kesilir, bazıları atlanır (~%35); kesilende ödenecek KDV varsa ertesi ayın 26'sında Vergi Ödemesi (Kasa). Ocak 2027 ayı bitmedi — mahsup yok.
      const month = `${y}-${pad(m)}`;
      const next = m === 12 ? `${y + 1}-01` : `${y}-${pad(m + 1)}`;
      if (month < "2027-01" && rand() < 0.65) {
        soon(`${next}-05`, async () => {
          const done = await tryApi(month === "2026-12" ? "kdv-mahsup-aralik-k-sonrasi" : "kdv-mahsup", client.post("/api/workspace/tax/vat-offset", { month }));
          const payable = Number(done?.offset?.payableMinor) || 0;
          if (payable > 0) soon(`${next}-26`, () => tryApi("vergi-odemesi", client.post("/api/workspace/tax/payments", { way: "cash", taxType: "kdv", amount: String(payable / 100), date: `${next}-26`, cashForce: true, exceedOk: true })));
        });
      }
    }
  }
  if (rich) {
    await runAgenda(NOW_DAY);
    server.clock.set(NOW);
    // Pasif cari (hazırlığı kilitten önce, yukarıda): bakiyesi 0 olan müşteri K'den sonra pasife alınır.
    const cur = (await tryApi("pasif-oku", client.get(`/api/workspace/accounts/${passive}`))) || {};
    await tryApi("pasif-cari", client.put(`/api/workspace/accounts/${passive}`, { name: cur.name, type: cur.type, taxNo: cur.taxNo, partyKind: cur.partyKind, firstName: cur.firstName, familyName: cur.familyName, city: cur.city, district: cur.district, phone: cur.phone, status: "passive", similarOk: true, ...(cur.updatedAt ? { updatedAt: cur.updatedAt } : {}) }));
    customers.push(passive);
  }
  return { customers, vendors, stock, sales, lines };

  // Zengin olaylar (yalnız 001). true → olay işlendi.
  async function richEvent(kind, day) {
    const later = n => {
      const d = addDays(day, n);
      return d <= NOW_DAY ? d : "";
    };
    switch (kind) {
      case "linkpay": {
        // "Kapatılacak Fatura" ile bağlı tahsilat (bazıları K'den sonra ≤K faturaya — bağ yönlendirmesi sınıfı).
        const owners = [...salesOf.keys()];
        if (!owners.length) return true;
        const customer = pick(owners);
        const target = pick(salesOf.get(customer).filter(row => row.day <= day));
        if (!target) return true;
        await tryApi(day > K && target.day <= K ? "bagli-tahsilat-k-sonrasi-k-oncesi-faturaya" : "bagli-tahsilat", client.post(`/api/workspace/accounts/${customer}/entries`, { kind: "in", amount: String(between(50, 900)), date: day, note: "Bağlı tahsilat", invoiceId: target.id }));
        return true;
      }
      case "cheque_in": {
        const customer = pick(customers);
        const note = rand() < 0.3;
        const due = addDays(day, pick([20, 35, 60, 90]));
        const made = await tryApi(note ? "senet-alindi" : "cek-alindi", client.post("/api/workspace/cheques", { direction: "in", instrument: note ? "note" : "cheque", accountId: customer, amount: String(between(200, 2000)), issueDate: day, dueDate: due, serialNo: `GV-${(serial += 1)}`, bank: "Ziraat" }));
        if (!made?.id) return true;
        const act = (cls, body) => tryApi(cls, client.post(`/api/workspace/cheques/${made.id}/actions`, { method: "cash", cashForce: true, ...body }));
        const path = rand();
        const vendor = pick(vendors);
        const dueDay = due <= NOW_DAY ? due : "";
        if (path < 0.2) {
          await soon(dueDay, () => act("evrak-tahsil", { action: "collect", date: due }));
        } else if (path < 0.35) {
          const when = later(5);
          await soon(when, () => act("evrak-ciro", { action: "endorse", date: when, accountId: vendor }));
          // ciro edilmiş evrakın bir kısmı vadesinde karşılıksız döner
          const bounceDay = dueDay && when ? (dueDay > when ? dueDay : when) : "";
          if (rand() < 0.3) await soon(bounceDay, () => act("evrak-cirodan-karsiliksiz", { action: "bounce", date: bounceDay }));
        } else if (path < 0.45) {
          await soon(dueDay, () => act("evrak-karsiliksiz", { action: "bounce", date: due }));
        } else if (path < 0.65) {
          const given = later(3);
          await soon(given, async () => {
            if ((await act("evrak-tahsile-ver", { action: "bank-deposit", date: given, bankAccountId: bank.z })) && dueDay) await soon(dueDay, () => act("evrak-bankadan-tahsil", { action: "collect", date: due, method: "bank" }));
          });
        } else if (path < 0.75) {
          const given = later(3);
          const back = later(10);
          await soon(given, async () => {
            if ((await act("evrak-tahsile-ver", { action: "bank-deposit", date: given, bankAccountId: bank.z })) && back) await soon(back, () => act("evrak-bankadan-geri-al", { action: "bank-withdraw", date: back }));
          });
        } else if (path < 0.8) {
          // Sil + Silinenler'den geri yükle.
          if ((await tryApi("evrak-sil", client.del(`/api/workspace/cheques/${made.id}`))) !== null) await tryApi("evrak-geri-yukle", client.post("/api/admin/trash/restore", { id: `cheque:${made.id}` }));
        }
        return true;
      }
      case "cheque_out": {
        const due = addDays(day, pick([15, 30, 45]));
        const made = await tryApi("evrak-verildi", client.post("/api/workspace/cheques", { direction: "out", instrument: rand() < 0.2 ? "note" : "cheque", accountId: pick(vendors), amount: String(between(300, 2500)), issueDate: day, dueDate: due, serialNo: `GV-${(serial += 1)}`, bank: "Ziraat" }));
        if (made?.id && due <= NOW_DAY && rand() < 0.8) await soon(due, () => tryApi("evrak-odendi", client.post(`/api/workspace/cheques/${made.id}/actions`, { action: "pay", date: due, method: "cash", cashForce: true })));
        return true;
      }
      case "bank_in":
        await tryApi("havale-tahsilat", client.post(`/api/workspace/accounts/${pick(customers)}/entries`, { kind: "in", amount: String(between(100, 2000)), date: day, note: "Havale", method: "bank", bankAccountId: rand() < 0.6 ? bank.z : bank.g }));
        return true;
      case "bank_out":
        await tryApi("eft-odeme", client.post(`/api/workspace/accounts/${pick(vendors)}/entries`, { kind: "out", amount: String(between(100, 2500)), date: day, note: "EFT", method: "bank", bankAccountId: rand() < 0.6 ? bank.z : bank.g }));
        return true;
      case "pos":
        await tryApi("pos-tahsilat", client.post(`/api/workspace/accounts/${pick(customers)}/entries`, { kind: "in", amount: String(between(100, 1500)), date: day, note: "POS", method: "card", posId: bank.p, posInstallments: 1 }));
        return true;
      case "card_buy":
        await tryApi("kartla-odeme", client.post(`/api/workspace/accounts/${pick(vendors)}/entries`, { kind: "out", amount: String(between(100, 1200)), date: day, note: "Kart", method: "card", bankAccountId: bank.c }));
        return true;
      case "card_pay":
        await tryApi("kart-borcu-odeme", client.post("/api/workspace/bank/vouchers", { type: "card_payment", accountId: bank.z, cardAccountId: bank.c, amount: String(between(300, 1500)), date: day, similarOk: true, negativeOk: true }));
        return true;
      case "transfer":
        await tryApi("virman", client.post("/api/workspace/bank/transfers", { accountId: bank.z, toAccountId: bank.g, amount: String(between(500, 3000)), date: day, channel: "virman", description: "Virman" }));
        return true;
      case "plan": {
        // "Carinin Mevcut Borcunu Taksitlendir" kartı; tahsilatlar vadesinde; bir kısmı Borçta Kalsın ile kapanır (kapanış günü sahte saatle), bir kısmı erken tek tahsilatla biter.
        const owners = [...salesOf.keys()];
        if (!owners.length) return true;
        const customer = pick(owners);
        let total = between(200, 600) * 3;
        const body = () => ({ name: `Kart ${serial += 1}`, registeredOn: day, total: String(total), accountId: customer, mode: "auto", count: "3", firstDue: addDays(day, 30), coversBalance: true });
        let res = await client.post("/api/workspace/plans", body());
        if (res.status === 400) {
          // Program carinin taksitlendirilebilecek borcunu söyler; bir kez o kadarla (3'e bölünür, kuruşsuz) yeniden denenir. İlk ret sayılır.
          tally("taksit-karti-ilk-ret", res.status);
          const said = /borcu ([\d.]+,\d{2}) TL/.exec(String(res.data?.error || ""))?.[1];
          const debt = said ? Number(said.replace(/\./g, "").replace(",", ".")) : 0;
          total = Math.floor(debt / 3) * 3;
          if (total < 30) return true;
          res = await client.post("/api/workspace/plans", body());
        }
        tally("taksit-karti", res.status);
        const card = res.status === 200 ? unwrap(res) : null;
        const id = card?.id ?? card?.plan?.id;
        if (!id) return true;
        const fate = rand();
        let paid = 0;
        for (let k = 1; k <= 3; k += 1) {
          const due = addDays(day, 30 * k);
          if (due > NOW_DAY) break;
          if (fate < 0.15 && k === 1) {
            // erken kapatılmış: ilk vadede kalanın tamamı tek tahsilatla
            await soon(due, () => tryApi("taksit-erken-kapama", client.post(`/api/workspace/plans/${id}/entries`, { kind: "in", amount: String(total), date: due, method: "cash", cashForce: true, similarOk: true })));
            paid = total;
            break;
          }
          if (rand() < 0.75) {
            await soon(due, () => tryApi(k === 3 ? "taksit-son-tahsilat" : "taksit-tahsilati", client.post(`/api/workspace/plans/${id}/entries`, { kind: "in", amount: String(total / 3), date: due, method: "cash", cashForce: true, similarOk: true })));
            paid += total / 3;
          }
        }
        if (fate >= 0.15 && fate < 0.45 && paid < total) {
          const closeDay = later(between(40, 120));
          soon(closeDay, () => tryApi(closeDay > K ? "taksit-borcta-kalsin-k-sonrasi" : "taksit-borcta-kalsin", client.put(`/api/workspace/plans/${id}`, { status: "closed" })));
        }
        return true;
      }
      case "doubtful": {
        const owners = [...salesOf.keys()];
        if (!owners.length) return true;
        const customer = pick(owners);
        const r = await tryApi("supheliye-al", client.post(`/api/workspace/accounts/${customer}/doubtful`, { amount: String(between(100, 400)), date: day, reason: "other" }));
        const rid = r?.record?.id ?? r?.id;
        if (!rid) return true;
        // Şüpheli cari rastgele tahsilat / satış havuzundan çıkar (yoksa sonraki bağsız tahsilatlar 128'i K'den önce sıfırlıyor — duman koşusunda K'de açık şüpheli kalmadı);
        // yarısında K'den SONRA faturasına BAĞLI tahsilat (tur 1 DOĞRULANMADI (e) sınıfı).
        const docs = salesOf.get(customer) || [];
        customers.splice(customers.indexOf(customer), 1);
        salesOf.delete(customer);
        if (docs.length && rand() < 0.5) {
          const target = pick(docs);
          const when = `2027-01-${pad(between(2, 19))}`;
          soon(when, () => tryApi("supheli-bagli-tahsilat-k-sonrasi", client.post(`/api/workspace/accounts/${customer}/entries`, { kind: "in", amount: String(between(30, 150)), date: when, note: "Şüpheli tahsilatı", invoiceId: target.id })));
        }
        const step = (cls, path, body) => soon(body.date, () => tryApi(cls, client.post(`/api/workspace/accounts/${customer}/doubtful/${rid}/${path}`, body)));
        if (rand() < 0.5) await step("karsilik", "provision", { amount: "50", date: later(10) });
        const fate = rand();
        if (fate < 0.3) await step("degersiz-kismi", "write-off", { amount: "40", date: later(20) });
        else if (fate < 0.45) await step("degersiz-tam", "write-off", { amount: String(between(100, 400)), date: later(25) });
        else if (fate < 0.65) await step("supheliden-cikar", "release", { date: later(30) });
        return true;
      }
      case "refund": {
        const owners = [...salesOf.keys()];
        if (!owners.length) return true;
        const target = pick(salesOf.get(pick(owners)));
        const date = later(between(3, 20));
        if (!target || !date) return true;
        await soon(date, async () => {
          const doc = await tryApi("iade-oku", client.get(`/api/workspace/invoices/${target.id}`));
          const first = doc?.lines?.[0];
          if (first) await tryApi(date > K ? "iade-faturasi-k-sonrasi" : "iade-faturasi", client.post("/api/workspace/invoices", { kind: "sale_return", originalId: target.id, issueDate: date, lines: [{ originLineId: first.id, qty: 1 }], payment: {}, stockForce: true }));
        });
        return true;
      }
      case "delrestore": {
        // Tahsilat Sil + Silinenler'den geri yükle (aynı kayıt geri gelir).
        const customer = pick(customers);
        if (!(await tryApi("silinecek-tahsilat", client.post(`/api/workspace/accounts/${customer}/entries`, { kind: "in", amount: String(between(50, 500)), date: day, note: "Sil + geri yükle" })))) return true;
        const entryId = lastEntryId(customer);
        if ((await tryApi("hareket-sil", client.del(`/api/workspace/accounts/${customer}/entries/${entryId}?cashForce=1`))) !== null) {
          const trash = unwrap(await client.get("/api/admin/trash"));
          const item = (Array.isArray(trash) ? trash : trash?.items || []).find(x => x.ref === entryId || JSON.stringify(x).includes(entryId));
          await tryApi("hareket-geri-yukle", client.post("/api/admin/trash/restore", { id: item?.id || `account-entry:${entryId}`, cashForce: true }));
        }
        return true;
      }
      default:
        return false;
    }
  }
}

const oldHelpers = await import(pathToFileURL(path.join(OLD, "test/helpers.mjs")).href);
const newHelpers = await import(pathToFileURL(path.join(NEW, "test/helpers.mjs")).href);
const started = Date.now();
let server = await oldHelpers.startTestServer({ ...dirs, now: { time: SIMPLE ? NOW : START, fixed: true } });
let admin = await oldHelpers.loginAdmin(server);
const first = await generate(admin, { rich: !SIMPLE, server });
if (!SIMPLE) {
  // Üretilen sınıf sayıları (ders 3: reddedilen istek veri üretmez — ret sayısı ve ilk ret iletisi ayrıca).
  console.log(`# üretilen sınıflar (001): ${JSON.stringify(produced)}`);
  const db = server.app.store;
  const q1 = sql => db.get(sql)?.n ?? "okunamadı";
  console.log(`# veri tabanından (001): ${JSON.stringify({
    cari: q1("SELECT COUNT(*) AS n FROM accounts"), ayniAdli: q1("SELECT COUNT(*) AS n FROM (SELECT name FROM accounts GROUP BY name HAVING COUNT(*) > 1)"), pasif: q1("SELECT COUNT(*) AS n FROM accounts WHERE status = 'passive'"),
    kart: q1("SELECT COUNT(*) AS n FROM plans WHERE deleted_at IS NULL"), kartKapali: q1("SELECT COUNT(*) AS n FROM plans WHERE status = 'closed'"), kartKapaliKSonrasi: q1(`SELECT COUNT(*) AS n FROM plans WHERE status = 'closed' AND closed_at > '${K}'`),
    evrak: q1("SELECT COUNT(*) AS n FROM cheques WHERE deleted_at IS NULL"), evrakDurum: db.all("SELECT status, COUNT(*) AS n FROM cheques WHERE deleted_at IS NULL GROUP BY status").map(r => `${r.status}:${r.n}`).join(","),
    tahsilde: q1("SELECT COUNT(*) AS n FROM cheque_collections"), supheli: q1("SELECT COUNT(*) AS n FROM doubtful_receivables"), karsilik: q1("SELECT COUNT(*) AS n FROM doubtful_provisions"),
    kdvMahsup: q1("SELECT COUNT(*) AS n FROM vat_offsets WHERE status = 'active'"), iade: q1("SELECT COUNT(*) AS n FROM invoices WHERE kind = 'sale_return'"), bankaOlay: q1("SELECT COUNT(*) AS n FROM fin_events"),
    posKalem: q1("SELECT COUNT(*) AS n FROM pos_items"), bagliTahsilat: q1("SELECT COUNT(*) AS n FROM account_entries WHERE invoice_id <> ''"), kilit: db.get("SELECT value FROM settings WHERE key = 'ledger.lockedUntil'")?.value || "",
  })}`);
}
const created = unwrap(await admin.post("/api/companies", { name: "İkinci Şirket", select: false }));
const secondId = created?.id || created?.company?.id;
const second = await generate(admin, { q: `?hofCompany=${encodeURIComponent(secondId)}`, parties: Math.round(PARTIES / 3), suppliers: 10, items: 8 });
console.log(`# v2.5.0 verisi: 001 ${first.customers.length} müşteri + ${first.vendors.length} tedarikçi, ${first.lines} işlem; 002 ${second.lines} işlem; ${Math.round((Date.now() - started) / 1000)} sn`);
server.close();
await new Promise(resolve => setTimeout(resolve, 500));

// ---- YENİ kod ----
server = await newHelpers.startTestServer({ ...dirs, now: { time: NOW, fixed: true } });
admin = await newHelpers.loginAdmin(server);
const fixture = await import(pathToFileURL(path.join(NEW, "test/fixtures/devir-d3-esdeger.mjs")).href);
async function preview(body) {
  const res = await admin.post("/api/admin/devir/preview", body);
  if (res.status !== 200) return { state: "failed", error: res.data };
  for (;;) {
    const job = unwrap(await admin.get(`/api/admin/devir/preview/${unwrap(res).id}`));
    if (job.state !== "running") return job;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}
for (const [company, label, store] of [["sirket-001", "001", () => server.app.store], [secondId, "002", null]]) {
  const a = await preview({ company, cutoff: K, option: "borc-alacak" });
  const b = await preview({ company, cutoff: K, option: "borc-alacak" });
  const c = await preview({ company, cutoff: K, option: "sadece-bakiye" });
  check(a.state === "done" && b.state === "done" && c.state === "done", `${label}: üç ön izleme bitti (${a.state}/${b.state}/${c.state}) ${JSON.stringify(a.error || "").slice(0, 300)}`);
  if (a.state !== "done") continue;
  const plan = a.result.plan;
  check(plan.sorunlar.length === 0, `${label}: planın sorunu yok ${JSON.stringify(plan.sorunlar).slice(0, 400)}`);
  const broken = plan.degismezler.filter(row => !row.ok);
  check(broken.length === 0, `${label}: bütün değişmezler tutar (${plan.degismezler.length}) ${JSON.stringify(broken)}`);
  check(JSON.stringify(plan) === JSON.stringify(b.result.plan), `${label}: iki koşu bayt bayt aynı plan`);
  const stop = a.result.onDenetim.durdurur.map(row => row.kod);
  check(stop.length === 0, `${label}: ön denetimde DURDURUR yok (${stop.join(", ")})`);
  const sameOpen = plan.newYear.cariler.every(row => {
    const other = c.result.plan.newYear.cariler.find(item => item.cari === row.cari && item.hesap === row.hesap);
    return other && JSON.stringify(other.satirlar.filter(line => line.tur === "acik-kalem")) === JSON.stringify(row.satirlar.filter(line => line.tur === "acik-kalem")) && other.netMinor === row.netMinor;
  });
  check(sameOpen, `${label}: iki seçenekte açık kalemler ve net aynı`);
  const counts = plan.newYear.budama.filter(row => row.sinif === "B").every(row => row.kOncesi + row.kSonrasi === row.toplam);
  check(counts, `${label}: B tablolarında ≤K + >K = devir öncesi`);
  const s = plan.sayilar;
  console.log(`# ${label}: cari ${s.cariKarti} kart / ${s.cariAcilis} açılış · açık fatura satış ${s.acikFatura.satis} (${s.acikFatura.satisMinor / 100}) alış ${s.acikFatura.alis} · açık kalem ${s.acikKalem.borc} · stok ${s.stok.urun} ürün ${s.stok.degerMinor / 100} · kasa ${s.kasaMinor / 100} · Dönem Net Kârı ${plan.archive.donemSonucuMinor / 100} · hareket ≤K ${s.hareket.budanacak} >K ${s.hareket.tasinacak} · süre ${JSON.stringify(a.result.zamanlama)}`);
  if (!store) {
    check(!plan.newYear.cariler.some(row => first.customers.includes(row.cari)), "002: 001'in carileri planda yok");
    continue;
  }
  const eq = fixture.createEquivalence(store());
  const days = ["2027-01-01", "2027-01-02", "2027-01-15", "2027-01-20", "2027-02-01", "2027-03-01"];
  let compared = 0;
  const diffs = [];
  // Benzetimin kapsamı (test/fixtures/devir-d3-esdeger.mjs): ≤K taksit kartının yeni yıldaki taksitleri ve şüpheli kaydının yeni yıldaki ayırımı D4a'nın yazımıdır — o cariler
  // devirsiz eşdeğerin DIŞINDA (sayısı yazılır, rapor DENENMEYEN). K sonrası bağlar açık kaleme yönlendirilir (redirect — D4a şartı; tur 2).
  const outside = new Set([...plan.newYear.kartlar.map(row => row.cari), ...plan.newYear.supheli.map(row => row.cari)].filter(Boolean));
  console.log(`# ${label}: devirsiz eşdeğer dışında kalan cari ${outside.size} (kartlı / şüpheli); bağ listesi ${plan.newYear.baglar.length} (açık kaleme ${plan.newYear.baglar.filter(row => row.tur === "acik-kalem").length}, arşive ${plan.newYear.baglar.filter(row => row.tur === "arsiv-basvurusu").length}); evrak ${plan.newYear.evraklar.length} ${JSON.stringify(plan.sayilar.evrak)}; kart ${plan.newYear.kartlar.length}; şüpheli ${plan.newYear.supheli.length}; banka ${JSON.stringify(plan.sayilar.banka)}; vergi ${plan.newYear.vergi.length}`);
  for (const option of [a, c]) {
    for (const row of option.result.plan.newYear.cariler) {
      if (outside.has(row.cari)) continue;
      for (const out of eq.compare(row.cari, row, K, days, { redirect: !SIMPLE })) {
        compared += 1;
        if (out.devirli !== out.devirsiz || JSON.stringify(out.kalemDevirli) !== JSON.stringify(out.kalemDevirsiz) || out.sinceDevirli !== out.sinceDevirsiz) diffs.push({ cari: row.cari, ...out });
      }
    }
  }
  check(diffs.length === 0, `${label}: devirsiz eşdeğer — ${compared} karşılaştırma (cari × gün × seçenek), fark ${diffs.length} ${JSON.stringify(diffs.slice(0, 3)).slice(0, 600)}`);
}
server.close();
// Kendi geçici veri klasörü (mkdtemp; yalnız bu tam yol — ders 36): başarılı koşuda silinir, başarısızda incelemek için kalır.
await new Promise(resolve => setTimeout(resolve, 500));
if (!failed) rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
else console.log(`# veri klasörü (inceleme için kaldı): ${root}`);
console.log(`# tests ${tests}\n# pass ${tests - failed}\n# fail ${failed}`);
process.exit(failed ? 1 : 0);
