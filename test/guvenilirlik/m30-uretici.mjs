// 2.4.4 madde 30 (göç v2.4.3 → 2.4.4, ders 17): ESKİ SÜRÜMÜN GERÇEK KODUYLA, KENDİ API'sinden, gerçekçi hacimde veri üretir.
//
// Test kuralı (2.0.21, kullanıcı: "uydurma verilerle değil"): veri elle yazılmış kayıt düzeni değil; o sürümün git etiketindeki kodu
// (test/guvenilirlik/surumler.mjs bootVersion, ayrı kopya) aynı süreçte açılır ve kullanıcının arayüzden yaptığı işler o kodun HTTP
// uçlarına gönderilir. Her yanıt okunur (ders 3): 200 dışı yanıt hata fırlatır; bilinçli olarak reddedilmesi beklenen istek yoktur.
// Saat sahte ve akar (createClock; ders 13): çizelge bitiş gününden (varsayılan bugün) 13 ay önce başlar, her iş günü saat 09:00'a
// kurulur; bütün tarihler bu çizelgeden türer (sabit tarih yok).
//
// Kapsam (v2.4.3'ün desteklediği; sürüm daha eskiyse olmayan özellik atlanır — e-Belge ≥ 2.4.0, Vergi Ödemesi / KDV Mahsup ≥ 2.4.3):
//   iki şirket (001, 002); Excel'den binlerce cari ve tablo satırı (üç sekme: Borçlular, aynı dosya no'lu Ödeme Sözleri, aylık taksitli
//   Taksitler); stok kartları; iki banka hesabı (açılışlı, çek/senet tahsile uygun) + POS; Kasa açılışı; satış (hizmet/mal, peşin nakit/
//   havale/POS, açık, taksitli, faturanın kendi çeki/senedi), alış (gider/mal, ciro ile ödeme), satıştan/alıştan iade, iptal, kâğıt SMM;
//   7. aydan sonra e-Belge (sahte EDM): e-Arşiv Kes ve Gönder, Kes Sonra Gönder → Gönderilecekler / Tümünü Gönder, "Müşteri Fişi Olarak
//   Bırak" (bir kısmı sonra gönderilir), e-Arşiv iptali, e-Fatura (Mükellef Sorgula ile işaretli alıcı); cari tahsilat/ödeme (Kapatılacak
//   Fatura dahil), borç/alacak; Kasa nakit, Kasa ↔ Banka; Banka Fişi, bankalar arası transfer, POS aktarımı; çek/senet (portföy, Bankaya
//   Tahsile Ver → Tahsil, ciro, nakit tahsil, karşılıksız — faturanın kendi evrakı, Kapatılacak Fatura'lı ve bağsız evrak dahil — verilen
//   çek/senet ödemesi); cariye bağlı taksit kartları ve tahsilatları; kayıt tahsilatları + Tablodan Aktar; Vergi Ödemesi + aylık KDV Mahsup;
//   dönem kilidi (001); özel rollü kullanıcılar; üç ayda bir yedek (o sürümün Yedekle ucu).
import { writeFileSync } from "node:fs";
import path from "node:path";
import { createClock } from "../../server/lib/clock.mjs";
import { BUYER_VKN, OUR_VKN, vkn } from "../einvoice-mock.mjs";
import { rng } from "../mutabakat/motor.mjs";
import { CITY, EXPENSE, FIRST, LAST, SERVICE, SUPPLIER } from "./adlar.mjs";
import { bootVersion } from "./surumler.mjs";
import { findBackup } from "./uretici.mjs";

export const HACIM = {
  // kucuk: araç denemesi (birkaç dakika); buyuk: madde 30 kanıtı (gerçek müşteri tablosu boyunda).
  kucuk: { cari: [300, 120], rehber: [400, 150], soz: [60, 20], taksitSatir: [30, 10], gun: [3, 2], stok: 12 },
  buyuk: { cari: [3000, 800], rehber: [9200, 1500], soz: [600, 150], taksitSatir: [240, 60], gun: [9, 4], stok: 40 },
};
const MONTHS = 13;
const MONTH_NAMES = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
const pad = value => String(value).padStart(2, "0");
const iso = date => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const parse = day => new Date(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)), 12);
export const addDays = (day, n) => {
  const date = parse(day);
  date.setDate(date.getDate() + n);
  return iso(date);
};
const addMonths = (day, n) => {
  const date = parse(day);
  date.setMonth(date.getMonth() + n);
  return iso(date);
};
const trDay = day => `${day.slice(8, 10)}.${day.slice(5, 7)}.${day.slice(0, 4)}`;
const version3 = tag => tag.replace(/^v/, "").split(".").map(Number);
const atLeast = (tag, want) => {
  const [a, b] = [version3(tag), version3(want)];
  for (let i = 0; i < 3; i += 1) if (a[i] !== b[i]) return a[i] > b[i];
  return true;
};
/** Geçerli TCKN (denetim haneleriyle). */
export function tckn(seed) {
  const d = String(100000000 + (seed % 899999999)).split("").map(Number);
  if (d[0] === 0) d[0] = 1;
  const odd = d[0] + d[2] + d[4] + d[6] + d[8];
  const even = d[1] + d[3] + d[5] + d[7];
  const d10 = (((odd * 7 - even) % 10) + 10) % 10;
  const d11 = (d.reduce((s, x) => s + x, 0) + d10) % 10;
  return `${d.join("")}${d10}${d11}`;
}
/** Kayıt (tablo satırı) iki kişinin aynı adı taşıdığı durum da üretilir (test kuralı: "aynı adlı iki kişi"). */
const PEOPLE_PASSWORD = "Personel-2026!";

/**
 * @param {{ version: string, dataDir: string, backupDir: string, edmUrl: string, seed?: number, hacim?: keyof HACIM, endDay?: string,
 *   log?: (line: string) => void, appOptions?: object }} options
 * Dönüş: { manifest } — üretimin kendi kaydı (kim, ne, kaç); kâhin DEĞİL (beklenen sayılar eski sürümün kendi API'sinden okunur).
 */
export async function generate({ version, dataDir, backupDir, edmUrl, seed = 7, hacim = "kucuk", endDay = iso(new Date()), log = () => {}, appOptions = {} }) {
  const V = HACIM[hacim];
  if (!V) throw new Error(`Bilinmeyen hacim: ${hacim}`);
  const R = rng(seed);
  const startDay = addMonths(endDay, -MONTHS);
  const clock = createClock({ time: parse(startDay), fixed: false });
  const setDay = day => clock.set(new Date(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)), 9, 0, 0));
  setDay(startDay);
  const hasEdoc = atLeast(version, "2.4.0");
  const hasTax = atLeast(version, "2.4.3");
  const server = await bootVersion(version, { dataDir, backupDir, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" }, now: clock, edocEnabled: true, edocLive: true, edocStatusPollMs: [10, 10], ...appOptions });
  const admin = await server.login();
  const manifest = { version, commit: server.commit, seed, hacim, startDay, endDay, companies: {}, counts: {}, refusals: {}, backups: [], users: [], timings: {} };
  const count = (key, n = 1) => (manifest.counts[key] = (manifest.counts[key] || 0) + n);
  let lastRequest = null;
  const t0 = performance.now();
  try {
    // ---------- şirketler ----------
    const second = await must("002 aç", admin.post("/api/companies", { name: "Yıldız Mali Müşavirlik ve Danışmanlık Ltd. Şti.", select: false }));
    const companies = [
      { key: "A", id: "sirket-001", code: "001", name: "Merkez Ticaret ve Danışmanlık A.Ş.", idx: 0 },
      { key: "B", id: second.company.id, code: second.company.code, name: second.company.name, idx: 1 },
    ];
    for (const company of companies) {
      // Son yazma isteği (ledger-integrity reddini yeniden üretmek için kaydedilir; aday 9).
      const raw = scoped(admin, company.id);
      company.api = { ...raw, post: (url, body) => ((lastRequest = { company: company.code, url, body }), raw.post(url, body)), put: (url, body) => ((lastRequest = { company: company.code, url, body }), raw.put(url, body)) };
      company.R = rng(seed * 100 + company.idx + 1);
      // Aday 9 eklentileri ayrı akışla (ana akışın çekimleri değişmesin): RT tablo çeşitleri (30a/E2/E3/U2), RD silme / Silinenler'den geri yükleme (E6).
      company.RT = rng(seed * 100 + company.idx + 71);
      company.RD = rng(seed * 100 + company.idx + 51);
      manifest.companies[company.key] = { id: company.id, code: company.code, name: company.name };
    }
    // 001'in adı (Ofis bilgisi) ve kullanıcılar (özel rol + kişiye özel yetki; Personel Özlük yetkisi bunlara açılmamalı — göç sonrası denetim).
    await must("001 adı", admin.put("/api/admin/office", { name: companies[0].name }));
    await must("001 şirket adı", admin.put("/api/companies/sirket-001", { name: companies[0].name }));
    const role = await must("rol", admin.post("/api/admin/roles", { name: "Tahsilat Sorumlusu", description: "Göç verisi", permissions: ["accounts.view", "accounts.collect", "accounts.manage", "plans.view", "plans.collect", "cash.view"] }));
    for (const user of [
      { username: "ayse", name: "Ayşe Fatura", role: "personel", grants: { add: ["invoices.view", "invoices.manage"], remove: [] } },
      { username: "mehmet", name: "Mehmet Muhasebe", role: "muhasebe", grants: { add: [], remove: ["cash.view"] } },
      { username: "zeynep", name: "Zeynep Tahsilat", role: role.id, grants: { add: [], remove: [] } },
    ]) {
      await must(`kullanıcı ${user.username}`, admin.post("/api/admin/users", { ...user, password: PEOPLE_PASSWORD, mustChangePassword: false }));
      manifest.users.push(user);
    }

    // ---------- açılış: her şirkette ----------
    for (const company of companies) await opening(company);
    manifest.timings.acilis = Math.round(performance.now() - t0);

    // ---------- 13 aylık çizelge ----------
    const edocFrom = addMonths(startDay, 7);
    const lockAt = addMonths(startDay, 10);
    const transferAt = addMonths(startDay, 9);
    let day = startDay;
    let month = startDay.slice(0, 7);
    let lastBackupMonth = "";
    while (day <= endDay) {
      const weekday = parse(day).getDay();
      if (weekday !== 0 && weekday !== 6) {
        setDay(day);
        const monthChanged = day.slice(0, 7) !== month;
        for (const company of companies) {
          if (hasEdoc && day >= edocFrom && !company.edoc) await enableEdoc(company, day);
          if (monthChanged) await monthStart(company, day, month);
          const n = V.gun[company.idx];
          for (let i = 0; i < n; i += 1) {
            try {
              await randomOp(company, day);
            } catch (error) {
              if (!error.integritySkip) throw error;
            }
          }
          await afterDay(company, day);
        }
        if (monthChanged) {
          month = day.slice(0, 7);
          // Üç ayda bir yedek (o sürümün Yedekle ucu, şirket başına).
          const m = Number(month.slice(5, 7));
          if (m % 3 === 0 && lastBackupMonth !== month) {
            lastBackupMonth = month;
            for (const company of companies) await backup(company, day);
          }
        }
        if (day >= transferAt && !companies[0].transferred) await tableTransfer(companies[0], day);
        if (day >= transferAt && !companies[1].transferred) await tableTransfer(companies[1], day);
        if (day >= lockAt && !companies[0].locked) {
          companies[0].locked = addMonths(day, -3);
          await must("dönem kilidi", companies[0].api.put("/api/admin/period-lock", { lockedUntil: companies[0].locked }));
          manifest.companies.A.lockedUntil = companies[0].locked;
        }
      }
      day = addDays(day, 1);
    }
    // Son gün: bekleyen e-Belge kuyruğu kısmen bırakılır (Gönderilecekler'de belge kalsın), son yedek.
    setDay(endDay);
    for (const company of companies) {
      // E6 (aday 9): serinin SON numarası silinip Silinenler'de kalır (2.4.3'te yeniden verilirdi; 2.4.4'te verilmiş sayılır) — makbuz kesilip hemen silinir.
      const last = await must("son makbuz", company.api.post("/api/workspace/invoices", { scenario: "smm", accountId: company.persons[0], issueDate: endDay, lines: [{ name: "Danışmanlık Ücreti", qty: 1, unitPrice: 1500, vatRate: 20 }], payment: { rest: "open" }, force: true, cashForce: true }));
      const gone = await must("son makbuzu sil", company.api.del(`/api/workspace/invoices/${last.id}?reason=${encodeURIComponent("Hatalı kesildi")}&force=1&cashForce=1`));
      company.deleted.push({ id: last.id, day: endDay, number: gone.number || last.number || "" });
      manifest.companies[company.key].lastDeleted = gone.number || last.number || "";
      count("fatura-silindi-son");
      await backup(company, endDay);
      const listed = await must("faturalar", company.api.get("/api/workspace/invoices?tab=all&limit=5000"));
      manifest.companies[company.key].invoices = listed.invoices.length;
    }
    manifest.timings.toplam = Math.round(performance.now() - t0);
    return { manifest, clock, server: { commit: server.commit } };
  } finally {
    await server.close();
  }

  // ======================================================================================================================
  async function opening(company) {
    const { api, R: r } = company;
    const isB = company.idx === 1;
    const seller = { name: company.name, partyKind: "company", taxNo: isB ? vkn(321654987) : OUR_VKN, taxOffice: isB ? "Konak" : "Çankaya", address: isB ? "Kıbrıs Şehitleri Cd. 12" : "Atatürk Blv. 1", district: isB ? "Konak" : "Çankaya", city: isB ? "İzmir" : "Ankara", email: isB ? "bilgi@yildiz.com.tr" : "bilgi@merkez.com.tr" };
    await must("satıcı", api.put("/api/workspace/invoices/settings", { seller }));
    // Kasa açılışı ve banka hesapları (açılışlı; çek/senet tahsile uygun; Ziraat POS kullanır).
    await must("Kasa açılışı", api.post("/api/workspace/cash/opening", { amount: isB ? "150.000" : "400.000", date: startDay }));
    const iban = (bank, no) => trIban(bank, no + company.idx * 1000);
    company.banks = [];
    for (const [bankName, code, amountText] of [["Ziraat Bankası", 10, "900.000"], ["Garanti BBVA", 62, "450.000"]]) {
      const made = await must(`banka ${bankName}`, api.post("/api/workspace/bank/accounts", { bankName, name: "Ana TL Hesabı", kind: "demand", currency: "TRY", iban: iban(code, 1234567), opening: { date: startDay, amount: amountText, confirmed: true }, useCheque: true, useNote: true }));
      company.banks.push(made.account || made);
    }
    const ziraat = company.banks[0].id;
    const ziraatRow = await must("hesap", api.get(`/api/workspace/bank/accounts/${ziraat}`));
    if (!ziraatRow.usePos) await must("POS Kullan", api.put(`/api/workspace/bank/accounts/${ziraat}`, { usePos: true }));
    const pos = await must("POS", api.post("/api/workspace/bank/pos", { name: "Ziraat Fiziki POS", bankAccountId: ziraat, kind: "physical", providerKind: "bank", tax: "bsmv_incl", valorRule: "business", valorDays: 2, installmentPayout: "monthly", provisionDays: 0, refundCommission: "none", merchantNo: `9${company.idx}123456`, terminalNo: `T00${company.idx + 1}`, validFrom: startDay, rates: [{ installments: 1, rate: "2,5" }, { installments: 3, rate: "3,5" }] }));
    company.pos = (pos.pos || pos).id;
    count("banka-hesabi", 2);
    count("pos", 1);
    // Cariler: Excel'den (müşteri tablosu boyunda), açılış bakiyeli bir kısmı; ayrıca e-Belge'ye hazır kişi carileri ve tedarikçiler.
    const n = V.cari[company.idx];
    const rows = [];
    for (let i = 1; i <= n; i += 1) {
      // %2: aynı ad soyad iki kez (farklı telefon) — test kuralı "aynı adlı iki kişi".
      const name = i > 10 && r.chance(0.02) ? rows[r.int(0, rows.length - 1)][1] : `${r.pick(FIRST)} ${r.pick(LAST)}`;
      rows.push([String(i), name, phone(r), r.pick(CITY), trDay(startDay), r.chance(0.25) ? String(r.int(2, 80) * 100) : ""]);
    }
    const imported = await must("cari yükle", api.post("/api/workspace/accounts/import", { matrix: [["Cari No", "Ad Soyad / Unvan", "Telefon", "Şehir", "Kayıt Tarihi", "Açılış Bakiyesi"], ...rows], headerAt: 0, roles: { 0: "seq", 1: "name", 2: "phone", 3: "city", 4: "registered", 5: "balance" }, mode: "skip", fileName: "cariler.xlsx" }));
    if (imported.created !== rows.length) throw new Error(`${company.code}: ${rows.length} cariden ${imported.created} açıldı`);
    count("cari-excel", imported.created);
    const all = [];
    for (let offset = 0; ; offset += 5000) {
      const page = await must("cari listesi", api.get(`/api/workspace/accounts?status=all&limit=5000&offset=${offset}`));
      all.push(...page.accounts);
      if (!page.hasMore) break;
    }
    company.customers = all.filter(item => item.type === "customer").map(item => item.id);
    company.names = new Map(all.map(item => [item.id, item.name]));
    // e-Belge'ye hazır kişi carileri (TCKN, il/ilçe/adres) ve bir e-Fatura mükellefi şirket (Mükellef Sorgula e-Belge açılınca).
    company.persons = [];
    for (let i = 0; i < 60; i += 1) {
      const first = r.pick(FIRST);
      const last = r.pick(LAST);
      const city = r.pick(CITY);
      const made = await must("kişi cari", api.post("/api/workspace/accounts", { name: `${first} ${last}`, type: "customer", partyKind: "person", firstName: first, familyName: last, taxNo: tckn(seed * 7919 + company.idx * 104729 + i * 31), address: `${r.pick(["Cumhuriyet", "Atatürk", "İstiklal", "Gazi"])} Cd. ${r.int(1, 99)}`, district: "Merkez", city, phone: phone(r), registeredOn: startDay }));
      company.persons.push(made.id);
    }
    const buyer = await must("e-Fatura alıcısı", api.post("/api/workspace/accounts", { name: isB ? "Ege Alıcı Ticaret A.Ş." : "Alıcı Ticaret A.Ş.", type: "customer", taxNo: BUYER_VKN, taxOffice: "Kavaklıdere", address: "Cinnah Cd. 10", district: "Çankaya", city: "Ankara", registeredOn: startDay }));
    company.buyer = buyer.id;
    company.suppliers = [];
    for (let i = 0; i < 12; i += 1) {
      const made = await must("tedarikçi", api.post("/api/workspace/accounts", { name: `${SUPPLIER[i % SUPPLIER.length]}${i >= SUPPLIER.length ? ` ${i}` : ""}`, type: "supplier", taxNo: vkn(400000000 + company.idx * 1000 + i), taxOffice: "Merkez", city: r.pick(CITY), registeredOn: startDay }));
      company.suppliers.push(made.id);
    }
    count("cari-elle", 73);
    // Stok kartları (açılış stoklu).
    company.items = [];
    for (let i = 1; i <= V.stok; i += 1) {
      const price = r.int(5, 120) * 10;
      const made = await must("stok", api.post("/api/workspace/stock", { kind: "goods", code: `STK-${company.code}-${pad(i)}`, name: `Ürün ${company.code}-${i}`, unit: "Adet", openingQty: String(r.int(200, 900)), unitPrice: String(price), salePrice: String(Math.round(price * 1.5)) }));
      company.items.push({ id: made.id, price });
    }
    count("stok-karti", V.stok);
    // Tablo (müşterinin Excel'i): üç sekme. Borçlular (dosya no, borç, ödenen, kalan, ödeme sözü); Ödeme Sözleri (aynı dosya no'lu satırlar —
    // 5c durumu); Taksitler (aylık taksit kolonları — Tablodan Aktar). Bir kısım cari kayda bağlı (caseKey).
    const rehber = [];
    for (let i = 1; i <= V.rehber[company.idx]; i += 1) {
      const borc = r.int(10, 400) * 100;
      const odenen = r.chance(0.4) ? r.int(0, Math.floor(borc / 200)) * 100 : 0;
      const soz = r.chance(0.3) ? trDay(addDays(endDay, r.int(-40, 40))) : "";
      rehber.push([`${2025 + (i % 2)}/${String(i).padStart(5, "0")}`, `${r.pick(FIRST)} ${r.pick(LAST)}`, phone(r), r.pick(CITY), trDay(addDays(startDay, r.int(0, 30))), String(borc), odenen ? String(odenen) : "", String(borc - odenen), soz]);
      // E2 (aday 9): satırların bir kısmında Kalan Borç hücresi boş (kural: Kalan boşsa Toplam).
      if (company.RT.chance(0.06)) rehber.at(-1)[7] = "";
    }
    const soz = [];
    for (let i = 0; i < V.soz[company.idx]; i += 1) {
      const src = rehber[r.int(0, rehber.length - 1)];
      soz.push([src[0], src[1], trDay(addDays(endDay, r.int(-60, 45))), String(r.int(5, 60) * 100)]);
    }
    const head = offset => {
      const date = parse(addMonths(startDay, offset));
      return `${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()} taksiti`;
    };
    const taksit = [];
    for (let i = 0; i < V.taksitSatir[company.idx]; i += 1) {
      const per = r.int(5, 40) * 100;
      const cols = [8, 9, 10, 11, 12, 13].map(() => String(per));
      taksit.push([`${r.pick(FIRST)} ${r.pick(LAST)}`, phone(r), ...cols, String(per * 6)]);
    }
    // E3 / U2 daraltma (aday 9): tek tutar sütunlu tablolar — okul servisi (Aylık Ücret + gün sütunu "Kalan Gün") ve aidat (Ödenecek + adet sütunu).
    const RT = company.RT;
    const servis = Array.from({ length: [120, 40][company.idx] }, () => [`${RT.pick(FIRST)} ${RT.pick(LAST)}`, phone(RT), RT.pick(["Atatürk İlkokulu", "Cumhuriyet Ortaokulu", "Fatih Anadolu Lisesi"]), String(RT.int(15, 60) * 100), String(RT.int(1, 30))]);
    const aidat = Array.from({ length: [80, 30][company.idx] }, (_, i) => [`AİD-${company.code}-${String(i + 1).padStart(4, "0")}`, `${RT.pick(FIRST)} ${RT.pick(LAST)}`, String(RT.int(4, 30) * 100), String(RT.int(1, 4))]);
    const sheets = [
      { name: "Borçlular", matrix: [["Dosya No", "Ad Soyad", "Telefon", "Şehir", "Kayıt Tarihi", "Toplam Borç", "Ödenen", "Kalan Borç", "Ödeme Sözü"], ...rehber] },
      { name: "Ödeme Sözleri", matrix: [["Dosya No", "Ad Soyad", "Söz Tarihi", "Söz Tutarı"], ...soz] },
      { name: "Taksitler", matrix: [["Ad Soyad", "Telefon", head(8), head(9), head(10), head(11), head(12), head(13), "Toplam"], ...taksit] },
      { name: "Servis Ücretleri", matrix: [["Ad Soyad", "Telefon", "Okul", "Aylık Ücret", "Kalan Gün"], ...servis] },
      { name: "Aidatlar", matrix: [["Dosya No", "Ad Soyad", "Ödenecek", "Daire Adedi"], ...aidat] },
    ];
    const staged = await must("tablo önizleme", api.post("/api/workspace/dataset/stage", { kind: "excel", fileName: "MUSTERILER.xlsx", sheets }));
    await must("tablo kaydet", api.post("/api/workspace/dataset/commit", { stageId: staged.stageId, mode: "replace" }));
    count("tablo-satiri", rehber.length + soz.length + taksit.length + servis.length + aidat.length);
    company.recordKeys = await recordKeys(api);
    count("tablo-kaydi", company.recordKeys.length);
    // Kayda bağlı cariler (caseKey): Borçlular'dan 25 kayıt.
    company.linked = [];
    const borclu = company.recordKeys.filter(item => item.tab === "Borçlular");
    for (let i = 0; i < Math.min(25, borclu.length); i += 1) {
      const rec = borclu[r.int(0, borclu.length - 1)];
      if (company.linked.some(item => item.key === rec.key)) continue;
      const made = await must("kayda bağlı cari", api.post("/api/workspace/accounts", { name: rec.name || `Kayıt ${rec.key}`, type: "customer", caseKey: rec.key, caseSource: rec.source || "", caseTitle: rec.name || "", registeredOn: startDay, phone: phone(r) }));
      company.linked.push({ key: rec.key, accountId: made.id });
    }
    count("cari-kayda-bagli", company.linked.length);
    company.cheques = { portfolio: [], deposited: [], endorsed: [], outPending: [] };
    company.invoices = { kagit: [], pending: [], withdrawn: [], sentToday: [], open: [], smm: [] };
    company.deleted = [];
    company.plans = [];
    company.supplierNo = 0;
  }

  async function enableEdoc(company, day) {
    const { api } = company;
    await must("e-Belge ayarı", api.put("/api/workspace/invoices/settings", { efatura: true, earsiv: true, integrator: { env: "test", baseUrl: edmUrl, username: "edmkullanici", password: "Gizli-Parola-1", senderAlias: `urn:mail:defaultgb@${company.idx ? "yildiz" : "merkez"}.com.tr` } }));
    const checked = await must("Mükellef Sorgula", api.post("/api/workspace/invoices/check-user", { taxNo: BUYER_VKN, accountId: company.buyer }));
    if (!checked.registered) throw new Error(`${company.code}: Mükellef Sorgula alıcıyı işaretlemedi`);
    company.edoc = day;
    manifest.companies[company.key].edocFrom = day;
    count("edoc-acildi");
  }

  // Ay başı: önceki ayın KDV Mahsup Fişi ve KDV ödemesi (bankadan), Banka Fişi (masraf), bankalar arası transfer, Muhtasar (Kasa'dan).
  async function monthStart(company, day, prevMonth) {
    const { api, R: r } = company;
    await must("Banka Fişi masraf", api.post("/api/workspace/bank/vouchers", { type: "fee", accountId: company.banks[0].id, date: day, amount: tr(r.int(500, 4000)), feeType: "eft", tax: "bsmv_incl", similarOk: true, negativeOk: true }));
    await must("bankalar arası", api.post("/api/workspace/bank/transfers", { accountId: company.banks[0].id, toAccountId: company.banks[1].id, amount: tr(r.int(50, 300) * 10000), date: day, similarOk: true, negativeOk: true }));
    count("banka-fisi");
    count("banka-transfer");
    if (!hasTax) return;
    const preview = await must("KDV mahsup ön izleme", api.get(`/api/workspace/tax/vat-offset?month=${prevMonth}`));
    if (preview.preview?.allowed) {
      const made = await must("KDV mahsup", api.post("/api/workspace/tax/vat-offset", { month: prevMonth, note: "Ay sonu KDV mahsubu" }));
      count("kdv-mahsup");
      const payable = Number(made.offset?.payableMinor || 0);
      if (payable > 0) {
        await must("KDV ödemesi", api.post("/api/workspace/tax/payments", { way: "bank", taxType: "kdv", accountId: company.banks[0].id, amount: tr(payable), date: day, exceedOk: true, similarOk: true, negativeOk: true }));
        count("vergi-odemesi-kdv");
      }
    } else count("kdv-mahsup-yok");
    await must("Muhtasar (Kasa)", api.post("/api/workspace/tax/payments", { way: "cash", taxType: "muhtasar", amount: tr(r.int(300, 2500) * 100), lateAmount: r.chance(0.2) ? tr(r.int(500, 3000)) : "", date: day, exceedOk: true, cashForce: true }));
    count("vergi-odemesi-muhtasar");
  }

  async function afterDay(company, day) {
    // POS valörü gelen kalemlerin bankaya aktarımı (Şimdi Aktar) — kullanıcının günlük işi.
    await must("POS aktar", company.api.post("/api/workspace/bank/settle", {}));
    // Vadesi gelen portföy evrakı: Bankaya Tahsile Ver / nakit tahsil / ciro / karşılıksız; tahsildeki evrak: Tahsil / karşılıksız.
    const { api, R: r } = company;
    const due = company.cheques.portfolio.filter(item => item.dueDate <= day);
    for (const item of due.slice(0, 3)) {
      company.cheques.portfolio = company.cheques.portfolio.filter(x => x.id !== item.id);
      // Faturası iptal edilen evrak (faturanın kendi evrakı) faturayla birlikte silinir; portföyde olmayan atlanır.
      const now = await api.get(`/api/workspace/cheques/${item.id}`);
      if (now.status === 404 || now.data?.status !== "portfolio") {
        count("evrak-portfoyde-degil-atlandi");
        continue;
      }
      const roll = r.next();
      if (roll < 0.4) {
        await must("Bankaya Tahsile Ver", api.post(`/api/workspace/cheques/${item.id}/actions`, { action: "bank-deposit", date: day, bankAccountId: company.banks[r.int(0, 1)].id }));
        company.cheques.deposited.push({ ...item, at: day });
        count("evrak-tahsile-ver");
      } else if (roll < 0.6) {
        await must("nakit tahsil", api.post(`/api/workspace/cheques/${item.id}/actions`, { action: "collect", date: day, method: "cash" }));
        count("evrak-nakit-tahsil");
      } else if (roll < 0.82) {
        await must("ciro", api.post(`/api/workspace/cheques/${item.id}/actions`, { action: "endorse", date: day, accountId: r.pick(company.suppliers) }));
        company.cheques.endorsed.push({ ...item, at: day });
        count("evrak-ciro");
      } else {
        await must("karşılıksız", api.post(`/api/workspace/cheques/${item.id}/actions`, { action: "bounce", date: day, note: "Karşılıksız çıktı" }));
        count(`evrak-karsiliksiz-${item.origin}`);
      }
    }
    for (const item of company.cheques.deposited.filter(x => addDays(x.at, 3) <= day).slice(0, 3)) {
      company.cheques.deposited = company.cheques.deposited.filter(x => x.id !== item.id);
      if (r.chance(0.88)) {
        await must("tahsildeki evrak tahsil", api.post(`/api/workspace/cheques/${item.id}/actions`, { action: "collect", date: day }));
        count("evrak-bankadan-tahsil");
      } else {
        await must("tahsildeki evrak karşılıksız", api.post(`/api/workspace/cheques/${item.id}/actions`, { action: "bounce", date: day, note: "Bankadan karşılıksız döndü" }));
        count(`evrak-karsiliksiz-tahsilde-${item.origin}`);
      }
    }
    // Ciro edilen evrakın bir kısmı sonradan karşılıksız döner (tedarikçiden geri gelir).
    for (const item of company.cheques.endorsed.filter(x => addDays(x.at, 10) <= day).slice(0, 1)) {
      company.cheques.endorsed = company.cheques.endorsed.filter(x => x.id !== item.id);
      if (r.chance(0.15)) {
        await must("cirodan karşılıksız", api.post(`/api/workspace/cheques/${item.id}/actions`, { action: "bounce", date: day, note: "Ciro edilen çek karşılıksız döndü" }));
        count(`evrak-karsiliksiz-cirodan-${item.origin}`);
      }
    }
    // Verilen evrak vadesinde ödenir.
    for (const item of company.cheques.outPending.filter(x => x.dueDate <= day).slice(0, 2)) {
      company.cheques.outPending = company.cheques.outPending.filter(x => x.id !== item.id);
      await must("verilen evrak ödendi", api.post(`/api/workspace/cheques/${item.id}/actions`, { action: "pay", date: day, method: item.instrument === "note" ? "cash" : "bank", cashForce: true, negativeOk: true }));
      count("evrak-verilen-odendi");
    }
    // e-Belge: Gönderilecekler'deki belgelerin bir kısmı ertesi gün gönderilir; bir kısmı "Müşteri Fişi Olarak Bırak"; bırakılanın bir kısmı
    // sonra e-Belge olarak gönderilir (2.4.3'te fiş numarası seriden ayrılır — v32'nin taradığı durum).
    if (company.edoc) {
      // Gönderilecekler (sunucunun listesi; GİB sıra kuralı: eskiden yeniye). Eskiden başlanır: gönder / bırak; "beklet" denince o ve
      // sonrakiler bekler (daha yenisi gönderilemez). Bazı günler Tümünü Gönder.
      const listed = await must("Gönderilecekler", api.get("/api/workspace/invoices?tab=pending&limit=500"));
      // Yalnız gönderilmeyi bekleyen ("waiting") belgeler: iptal edilmiş numarasız belge ve e-Belge durumu "none" olan alıştan iade de listede görünür ama
      // bırakılamaz (aday 9 koşusunda 409 "invoice-not-waiting").
      const queue = listed.invoices.filter(x => x.issueDate < day && x.status === "issued" && x.eStatus === "waiting").sort((a, b) => (a.issueDate + a.issueTime).localeCompare(b.issueDate + b.issueTime));
      if (queue.length && r.chance(0.25)) {
        const turn = await sendAll(api, must);
        count("ebelge-tumunu-gonder");
        count("ebelge-tumunu-gonder-belge", turn.filter(item => item.ok).length);
      } else {
        for (const doc of queue.slice(0, 4)) {
          const roll = r.next();
          if (roll < 0.55) {
            await must("gönder", api.post(`/api/workspace/invoices/${doc.id}/send`, {}));
            count("ebelge-sonra-gonderildi");
          } else if (roll < 0.9) {
            const left = await must(`Müşteri Fişi Olarak Bırak ${doc.id} ${doc.status}/${doc.eStatus}/${doc.issueDate}`, api.post(`/api/workspace/invoices/${doc.id}/withdraw`, {}));
            company.invoices.withdrawn.push({ id: doc.id, number: left.number, day });
            count("ebelge-birakildi");
            // Bırakılan belgenin bir kısmı hemen e-Belge olarak gönderilir (2.4.3'te fiş numarası seriden ayrılır — v32'nin taradığı durum).
            if (r.chance(0.35)) {
              await must("bırakılanı gönder", api.post(`/api/workspace/invoices/${doc.id}/send`, {}));
              count("ebelge-birakilan-gonderildi");
              company.invoices.withdrawn.at(-1).sent = true;
            }
          } else break;
        }
      }
      // Bugün gönderilen e-Arşiv'lerin bir kısmı aynı gün iptal (EDM'de, 8 gün içinde).
      for (const doc of company.invoices.sentToday.splice(0)) {
        if (!r.chance(0.06)) continue;
        await must("e-Arşiv iptal", api.post(`/api/workspace/invoices/${doc.id}/cancel`, { reason: "Müşteri vazgeçti" }));
        company.invoices.open = company.invoices.open.filter(x => x.id !== doc.id);
        count("ebelge-iptal");
      }
    }
    // E6 (aday 9): kâğıt fatura / Müşteri Fişi / SMM silme (Silinenler'e) ve bir kısmının Silinenler'den geri yüklenmesi — o sürümün kendi uçları.
    await deleteStep(company, day);
  }

  async function deleteStep(company, day) {
    const { api, RD } = company;
    const refused = (what, res) => {
      count(`${what}-reddedildi-${res.status}`);
      manifest.deleteRefusals = [...(manifest.deleteRefusals || []), { company: company.code, day, what, status: res.status, message: String(res.data?.error || res.data?.message || JSON.stringify(res.data)).slice(0, 240) }];
      if (res.status !== 409) throw new Error(`${version} ${what}: ${res.status} ${JSON.stringify(res.data).slice(0, 400)}`);
    };
    if (RD.chance(0.08)) {
      const open = x => x.day > (company.locked || "0000");
      const pools = [
        company.invoices.kagit.filter(x => x.day === day && !x.used && !x.returned && !x.plan && !x.own),
        company.invoices.withdrawn.filter(x => !x.sent && !x.deleted && open(x)),
        company.invoices.smm.filter(x => x.day === day && !x.deleted),
      ].filter(list => list.length);
      if (pools.length) {
        const doc = RD.pick(RD.pick(pools));
        doc.deleted = true;
        doc.used = true;
        const res = await api.del(`/api/workspace/invoices/${doc.id}?reason=${encodeURIComponent("Hatalı kesildi")}&force=1&cashForce=1`);
        manifest.requests = (manifest.requests || 0) + 1;
        if (res.status === 200) {
          company.invoices.open = company.invoices.open.filter(x => x.id !== doc.id);
          company.deleted.push({ id: doc.id, day, number: res.data?.number || "" });
          count("fatura-silindi");
        } else refused("fatura-silme", res);
      }
    }
    if (company.deleted.length && RD.chance(0.03)) {
      const listed = await must("Silinenler", api.get("/api/admin/trash"));
      const items = (Array.isArray(listed) ? listed : listed.items || []).filter(item => item.kind === "invoice" && String(item.id).startsWith("trash:"));
      if (items.length) {
        const item = RD.pick(items);
        const res = await api.post("/api/admin/trash/restore", { id: item.id });
        manifest.requests += 1;
        if (res.status === 200) count("fatura-silinenlerden-geri-yuklendi");
        else refused("fatura-geri-yukleme", res);
      }
    }
  }

  async function randomOp(company, day) {
    const r = company.R;
    const roll = r.next();
    if (roll < 0.3) return sale(company, day);
    if (roll < 0.4) return purchase(company, day);
    if (roll < 0.43) return returnOrCancel(company, day);
    if (roll < 0.47 + (company.idx ? 0.08 : 0)) return smm(company, day);
    if (roll < 0.65) return collection(company, day);
    if (roll < 0.71) return supplierPayment(company, day);
    if (roll < 0.77) return cashOp(company, day);
    if (roll < 0.84) return chequeIn(company, day);
    if (roll < 0.86) return chequeOut(company, day);
    if (roll < 0.91) return planOp(company, day);
    if (roll < 0.96) return casePayment(company, day);
    return stockOp(company, day);
  }

  // Satış: kâğıt dönemde FIS serisi; e-Belge açıldıktan sonra kişiye e-Arşiv (Kes ve Gönder / Kes, Sonra Gönder), mükellefe e-Fatura.
  async function sale(company, day) {
    const { api, R: r } = company;
    const goods = r.chance(0.35);
    const lines = goods
      ? Array.from({ length: r.int(1, 3) }, () => {
          const item = r.pick(company.items);
          return { itemId: item.id, qty: r.int(1, 6), unitPrice: Math.round(item.price * 1.5), vatRate: 20 };
        })
      : Array.from({ length: r.int(1, 2) }, () => ({ name: r.pick(SERVICE), qty: r.int(1, 4), unitPrice: r.int(10, 900) * 10, vatRate: r.pick([20, 20, 10, 1]) }));
    const gross = lines.reduce((sum, line) => sum + line.qty * line.unitPrice * (1 + line.vatRate / 100), 0);
    const edoc = Boolean(company.edoc);
    const toBuyer = edoc && r.chance(0.18);
    const accountId = edoc ? (toBuyer ? company.buyer : r.pick(company.persons)) : r.chance(0.15) ? r.pick(company.persons) : r.pick(company.customers);
    const p = r.next();
    let payment;
    let origin = "";
    if (p < 0.4) payment = { rest: "open" };
    else if (p < 0.58) payment = { cash: [cashLine(company, Math.floor(gross * r.int(20, 60)) / 100, r.pick(["cash", "bank", "card"]))], rest: "open" };
    else if (p < 0.68) payment = { cash: [cashLine(company, Math.round(gross * 100) / 100, r.pick(["cash", "card"]))], rest: "open" };
    else if (p < 0.8) payment = { rest: "installments", installments: { count: r.int(2, 6), firstDue: addDays(day, 30), everyMonths: 1 } };
    else {
      // Faturanın kendi evrakı (çek ya da senet; UX18/F6 — karşılıksız dönerse fatura yeniden açılır mı?).
      origin = "fatura";
      const instrument = r.chance(0.7) ? "cheque" : "note";
      payment = { cheques: [{ instrument, amount: Math.floor(gross * r.int(30, 100)) / 100, dueDate: addDays(day, r.int(5, 60)), serialNo: `FE-${company.code}-${day}-${r.int(1000, 9999)}`, bank: instrument === "cheque" ? r.pick(["Ziraat", "İş Bankası", "Akbank", "Vakıfbank"]) : "" }], rest: "open" };
    }
    const eSend = edoc ? (r.chance(0.6) ? "now" : "later") : undefined;
    const made = await must(`satış ${day}`, api.post("/api/workspace/invoices", { scenario: goods ? "goods_sale" : "service_sale", accountId, issueDate: day, lines, payment, force: true, cashForce: true, ...(eSend ? { eSend } : {}) }));
    count(edoc ? (toBuyer ? "fatura-efatura" : "fatura-earsiv") : "fatura-kagit");
    if (payment.rest === "installments") count("fatura-taksitli");
    if (origin) {
      count("fatura-kendi-evraki");
      const cheque = await chequeOfInvoice(api, made.id);
      if (cheque) company.cheques.portfolio.push({ id: cheque.id, dueDate: cheque.dueDate, amount: cheque.amount, origin: "fatura" });
    }
    if (edoc) {
      if (eSend !== "later" && !toBuyer) company.invoices.sentToday.push({ id: made.id });
    } else company.invoices.kagit.push({ id: made.id, day, accountId, total: gross, paid: p >= 0.4, plan: payment.rest === "installments", own: Boolean(origin) });
    if (payment.rest === "open" && p < 0.4) company.invoices.open.push({ id: made.id, accountId, day });
  }

  async function purchase(company, day) {
    const { api, R: r } = company;
    company.supplierNo += 1;
    const supplier = r.pick(company.suppliers);
    const goods = r.chance(0.4);
    const lines = goods
      ? [{ itemId: r.pick(company.items).id, qty: r.int(10, 60), unitPrice: r.int(5, 80) * 10, vatRate: 20 }]
      : [{ name: r.pick(EXPENSE), qty: 1, unitPrice: r.int(10, 900) * 10, vatRate: 20, expenseCode: "other" }];
    const gross = lines.reduce((sum, line) => sum + line.qty * line.unitPrice * 1.2, 0);
    const p = r.next();
    let payment = { rest: "open" };
    const fits = company.cheques.portfolio.filter(item => item.amount && item.amount <= gross);
    if (p < 0.35) payment = { cash: [cashLine(company, Math.min(gross, r.int(1, 40) * 50), r.pick(["cash", "bank"]))], rest: "open" };
    else if (p < 0.5 && fits.length && (await api.get(`/api/workspace/cheques/${fits[0].id}`)).data?.status === "portfolio") {
      // Alış faturasının ödemesinde portföydeki müşteri çekini ciro (faturayla ciro).
      const item = fits[0];
      company.cheques.portfolio = company.cheques.portfolio.filter(x => x.id !== item.id);
      payment = { endorse: [item.id], rest: "open" };
      company.cheques.endorsed.push({ ...item, at: day });
      count("evrak-faturayla-ciro");
    }
    const made = await must(`alış ${day}`, api.post("/api/workspace/invoices", { scenario: goods ? "goods_purchase" : "expense_purchase", accountId: supplier, number: `ALS-${company.code}-${company.supplierNo}`, issueDate: day, lines, payment, force: true, cashForce: true, negativeOk: true }));
    count("fatura-alis");
    if (goods && r.chance(0.08)) {
      await must("alıştan iade", api.post("/api/workspace/invoices", { kind: "purchase_return", originalId: made.id, number: `ALI-${company.code}-${company.supplierNo}`, issueDate: day, ...(company.edoc ? { returnRef: `ALS${`${company.code}${company.supplierNo}`.padStart(13, "0")}` } : {}), lines: [{ originLineId: made.lines[0].id, qty: 1 }], payment: {}, force: true }));
      count("fatura-alistan-iade");
    }
  }

  async function returnOrCancel(company, day) {
    const { api, R: r } = company;
    const recent = company.invoices.kagit.filter(x => x.day === day && !x.used);
    if (recent.length && r.chance(0.4)) {
      const doc = recent[0];
      doc.used = true;
      await must("kâğıt fatura iptali", api.post(`/api/workspace/invoices/${doc.id}/cancel`, { reason: "Hatalı kesildi", force: true, cashForce: true }));
      company.invoices.open = company.invoices.open.filter(x => x.id !== doc.id);
      count("fatura-kagit-iptal");
      return;
    }
    const older = company.invoices.kagit.filter(x => !x.used && !x.returned && x.day >= (company.locked || "0000"));
    if (!older.length || company.edoc) return sale(company, day);
    const doc = r.pick(older);
    doc.returned = true;
    const full = await must("asıl fatura", api.get(`/api/workspace/invoices/${doc.id}`));
    const line = full.lines?.[0];
    if (!line) return;
    await must("satıştan iade", api.post("/api/workspace/invoices", { kind: "sale_return", originalId: doc.id, issueDate: day, lines: [{ originLineId: line.id, qty: 1 }], payment: {}, force: true, cashForce: true }));
    count("fatura-satistan-iade");
  }

  async function smm(company, day) {
    const { api, R: r } = company;
    const accountId = r.chance(0.5) ? r.pick(company.suppliers.length ? company.customers : company.persons) : r.pick(company.persons);
    const fee = r.int(10, 200) * 100;
    const pay = r.chance(0.5) ? { cash: [cashLine(company, Math.floor(fee * r.int(20, 90)) / 100, r.pick(["cash", "bank"]))], rest: "open" } : { rest: "open" };
    const made = await must("SMM", api.post("/api/workspace/invoices", { scenario: "smm", accountId, issueDate: day, lines: [{ name: r.pick(["Danışmanlık Ücreti", "Mali Müşavirlik Ücreti", "Avukatlık Ücreti"]), qty: 1, unitPrice: fee, vatRate: 20 }], payment: pay, force: true, cashForce: true }));
    count("smm-kagit");
    company.invoices.smm.push({ id: made.id, day });
  }

  async function collection(company, day) {
    const { api, R: r } = company;
    const method = r.pick(["cash", "cash", "bank", "card"]);
    // Kapatılacak Fatura: açık faturalardan biri (aynı cari).
    let accountId = r.chance(0.6) && company.invoices.open.length ? null : r.pick(company.customers);
    let invoiceId;
    if (!accountId) {
      const doc = r.pick(company.invoices.open);
      accountId = doc.accountId;
      if (r.chance(0.5)) invoiceId = doc.id;
    }
    if (!invoiceId && r.chance(0.08) && company.linked.length) accountId = r.pick(company.linked).accountId;
    const body = { kind: "in", amount: amount(r, 50, 6000), date: day, method, note: "Tahsilat", ...(invoiceId ? { invoiceId } : {}), ...methodRef(company, method), similarOk: true };
    if (r.chance(0.05)) {
      await must("borç yaz", api.post(`/api/workspace/accounts/${accountId}/entries`, { kind: "debt", amount: amount(r, 100, 8000), date: day, note: "Borç kaydı" }));
      count("cari-borc");
      return;
    }
    // Aday 9 koşusunda v2.4.3 bir tahsilatı 409 "ledger-integrity" (Kapanmış dönem değişemez) ile reddetti: ayrıntı kaydedilir (yeniden üretmek için;
    // ders 3 — sayılır, başarı yazılmaz), üretim sürer. Başka her ret üretimi durdurur.
    const res = await api.post(`/api/workspace/accounts/${accountId}/entries`, body);
    manifest.requests = (manifest.requests || 0) + 1;
    if (res.status === 409 && res.data?.code === "ledger-integrity") {
      count("tahsilat-reddedildi-ledger-integrity");
      manifest.integrityRefusals = [...(manifest.integrityRefusals || []), { what: "tahsilat", company: company.code, day, request: { company: company.code, url: `/api/workspace/accounts/${accountId}/entries`, body }, failures: res.data.failures, error: res.data.error }];
      return;
    }
    if (res.status !== 200) throw new Error(`${version} tahsilat: ${res.status} ${JSON.stringify(res.data).slice(0, 600)}`);
    count(`cari-tahsilat-${method}${invoiceId ? "-kapatilacak" : ""}`);
  }

  async function supplierPayment(company, day) {
    const { api, R: r } = company;
    const method = r.pick(["cash", "bank", "bank"]);
    await must("tedarikçiye ödeme", api.post(`/api/workspace/accounts/${r.pick(company.suppliers)}/entries`, { kind: "out", amount: amount(r, 100, 9000), date: day, method, note: "Tedarikçiye ödeme", ...methodRef(company, method), cashForce: true, negativeOk: true, similarOk: true }));
    count(`cari-odeme-${method}`);
  }

  async function cashOp(company, day) {
    const { api, R: r } = company;
    const x = r.next();
    if (x < 0.35) {
      await must("Kasa giriş", api.post("/api/workspace/cash", { kind: "in", amount: amount(r, 20, 2500), date: day, description: "Elden tahsilat" }));
      count("kasa-giris");
    } else if (x < 0.75) {
      await must("Kasa çıkış", api.post("/api/workspace/cash", { kind: "out", amount: amount(r, 20, 1800), date: day, description: "Ofis gideri", cashForce: true }));
      count("kasa-cikis");
    } else {
      const direction = r.chance(0.6) ? "to-bank" : "to-cash";
      await must("Kasa ↔ Banka", api.post("/api/workspace/cash/transfer", { direction, amount: String(r.int(5, 60) * 100), date: day, description: direction === "to-bank" ? "Kasadan bankaya" : "Bankadan kasaya", bankAccountId: company.banks[r.int(0, 1)].id, cashForce: true, negativeOk: true }));
      count(`kasa-banka-${direction}`);
    }
  }

  // Alınan evrak (cari carinin; bir kısmı Kapatılacak Fatura'lı — 2.4.3'te bu alan evrakta yoktu, alınır; bağsız evrak).
  async function chequeIn(company, day) {
    const { api, R: r } = company;
    const instrument = r.chance(0.75) ? "cheque" : "note";
    const accountId = company.invoices.open.length && r.chance(0.6) ? r.pick(company.invoices.open).accountId : r.pick(company.customers);
    const made = await must("evrak al", api.post("/api/workspace/cheques", { direction: "in", instrument, amount: String(r.int(5, 120) * 100), issueDate: day, dueDate: addDays(day, r.int(3, 75)), accountId, serialNo: `AE-${company.code}-${day}-${r.int(10000, 99999)}`, bank: instrument === "cheque" ? r.pick(["Ziraat", "Garanti", "Yapı Kredi", "Halkbank"]) : "" }));
    company.cheques.portfolio.push({ id: made.id, dueDate: made.dueDate || addDays(day, 30), amount: Number(made.amount) || 0, origin: "bagsiz" });
    count(`evrak-alindi-${instrument}`);
  }

  async function chequeOut(company, day) {
    const { api, R: r } = company;
    const instrument = r.chance(0.7) ? "cheque" : "note";
    const made = await must("evrak ver", api.post("/api/workspace/cheques", { direction: "out", instrument, amount: String(r.int(5, 80) * 100), issueDate: day, dueDate: addDays(day, r.int(5, 60)), accountId: r.pick(company.suppliers), serialNo: `VE-${company.code}-${day}-${r.int(10000, 99999)}`, ...(instrument === "cheque" ? { bank: "Ziraat", bankAccountId: company.banks[0].id } : {}) }));
    company.cheques.outPending.push({ id: made.id, dueDate: made.dueDate, instrument });
    count(`evrak-verildi-${instrument}`);
  }

  // Cariye bağlı taksit kartı ve tahsilatları (nakit / havale / POS).
  async function planOp(company, day) {
    const { api, R: r } = company;
    if (!company.plans.length || r.chance(0.3)) {
      const accountId = r.pick(company.customers);
      const total = r.int(6, 60) * 1000;
      const made = await must("taksit kartı", api.post("/api/workspace/plans", { accountId, name: company.names.get(accountId), total: String(total), mode: "auto", count: r.int(3, 12), firstDue: addDays(day, 30), registeredOn: day }));
      company.plans.push({ id: made.id, total, paid: 0 });
      count("taksit-karti");
      return;
    }
    const plan = r.pick(company.plans);
    const pay = Math.min(plan.total - plan.paid, r.int(5, 30) * 100);
    if (pay <= 0) return;
    plan.paid += pay;
    const method = r.pick(["cash", "bank", "card"]);
    await must("taksit tahsilatı", api.post(`/api/workspace/plans/${plan.id}/entries`, { kind: "in", amount: String(pay), date: day, method, ...methodRef(company, method), similarOk: true }));
    count(`taksit-tahsilat-${method}`);
  }

  // Kayıt kartından tahsilat (2.4.3'te arayüzde var; 2.4.4'te kalkar) — ödeme sözlü / aynı dosya no iki sekmede olan kayıtlara da.
  async function casePayment(company, day) {
    const { api, R: r } = company;
    const pool = company.recordKeys.filter(item => item.tab !== "Taksitler" || !company.transferred);
    if (!pool.length) return;
    const rec = r.chance(0.5) && company.dupKeys?.length ? { key: r.pick(company.dupKeys), name: "" } : r.pick(pool);
    const method = r.pick(["cash", "cash", "bank"]);
    await must("kayıt tahsilatı", api.post(`/api/workspace/cases/${encodeURIComponent(rec.key)}/payments`, { amount: String(r.int(1, 30) * 100), date: day, method, note: "Kayıt tahsilatı", caseTitle: rec.name || "", ...methodRef(company, method), similarOk: true }));
    count(`kayit-tahsilati-${method}`);
  }

  async function stockOp(company, day) {
    const { api, R: r } = company;
    const item = r.pick(company.items);
    if (r.chance(0.5)) {
      await must("stok girişi", api.post(`/api/workspace/stock/${item.id}/moves`, { kind: "in", qty: String(r.int(5, 50)), unitPrice: String(item.price), pay: "none", date: day }));
      count("stok-giris");
    } else {
      const method = r.pick(["cash", "card"]);
      await must("stok satışı", api.post(`/api/workspace/stock/${item.id}/moves`, { kind: "out", qty: String(r.int(1, 3)), unitPrice: String(Math.round(item.price * 1.5)), pay: "cash", method, ...methodRef(company, method), date: day, force: true }));
      count(`stok-satis-${method}`);
    }
  }

  // Tablodan Aktar: Taksitler sekmesinin kayıtlarının yarısı (önce bir kısmına kayıt tahsilatı girilir — taşınır).
  async function tableTransfer(company, day) {
    const { api, R: r } = company;
    company.transferred = day;
    const taksit = company.recordKeys.filter(item => item.tab === "Taksitler");
    for (const rec of taksit.slice(0, Math.ceil(taksit.length / 4))) {
      await must("kayıt tahsilatı (aktarım öncesi)", api.post(`/api/workspace/cases/${encodeURIComponent(rec.key)}/payments`, { amount: String(r.int(2, 20) * 100), date: day, method: "cash", note: "Peşinat", caseTitle: rec.name || "" }));
      count("kayit-tahsilati-aktarim-oncesi");
    }
    const preview = await must("Tablodan Aktar ön izleme", api.get("/api/workspace/plans/from-table"));
    const keys = (preview.records || []).filter(item => item.selected).map(item => item.key);
    const chosen = keys.filter((_, index) => index % 2 === 0);
    if (!chosen.length) {
      count("tablodan-aktar-bos");
      return;
    }
    const result = await must("Tablodan Aktar", api.post("/api/workspace/plans/from-table", { keys: chosen, fingerprint: preview.fingerprint }));
    count("tablodan-aktar-kart", result.created ?? chosen.length);
    count("tablodan-aktar-tasinan-tahsilat", result.paymentsMoved || 0);
    // aktarılan kartlara birkaç tahsilat
    const plans = await must("kartlar", api.get("/api/workspace/plans"));
    for (const plan of plans.plans.filter(item => item.importId === result.importId).slice(0, 10)) company.plans.push({ id: plan.id, total: Number(plan.total) || 0, paid: Number(plan.paid) || 0 });
    // aynı dosya no iki sekmede olan kayıtlar (5c durumu)
    company.dupKeys = [...new Set(company.recordKeys.filter(item => item.tab === "Ödeme Sözleri").map(item => item.key))].filter(key => company.recordKeys.some(item => item.key === key && item.tab === "Borçlular"));
  }

  async function backup(company, day) {
    const result = await must(`yedek ${company.code}`, admin.post("/api/admin/backups", { scope: "one", companyId: company.id }));
    const file = findBackup(backupDir, result.name);
    manifest.backups.push({ company: company.key, companyId: company.id, day, name: result.name, path: file ? path.relative(backupDir, file) : null });
    count("yedek");
  }

  // ---------- yardımcılar ----------
  function cashLine(company, value, method) {
    return { amount: Math.max(1, Math.round(value * 100) / 100), method, ...methodRef(company, method) };
  }
  function methodRef(company, method) {
    if (method === "bank") return { bankAccountId: company.banks[company.R.int(0, 1)].id };
    if (method === "card") return { posId: company.pos };
    return {};
  }
  async function must(what, promise) {
    const response = await promise;
    manifest.requests = (manifest.requests || 0) + 1;
    if (response.status === 409 && response.data?.code === "ledger-integrity") {
      // Aday 9 koşusunda v2.4.3 POS'lu bazı işlemleri "Kapanmış dönem değişemez" diye reddetti (Hiçbir değişiklik yazılmadı). Ayrıntı + istek kaydedilir
      // (ders 3: sayılır, başarı yazılmaz); M30_ILK_RET=1 ise üretim ilk retle durur (veri reddin hemen öncesindeki hâlde kalır — yeniden üretme).
      count("ledger-integrity-reddi");
      manifest.integrityRefusals = [...(manifest.integrityRefusals || []), { what, day: clock().toISOString(), request: lastRequest, failures: response.data.failures, error: response.data.error }];
      if (process.env.M30_ILK_RET === "1") {
        writeFileSync(path.join(dataDir, "..", "ilk-ret.json"), `${JSON.stringify(manifest.integrityRefusals.at(-1), null, 1)}\n`);
        throw new Error(`${version} ${what}: ilk ledger-integrity reddi (M30_ILK_RET) — ${path.join(dataDir, "..", "ilk-ret.json")}`);
      }
      throw Object.assign(new Error(`${what}: ledger-integrity`), { integritySkip: true });
    }
    if (response.status !== 200) {
      manifest.refusals[what] = (manifest.refusals[what] || 0) + 1;
      throw new Error(`${version} ${what}: ${response.status} ${JSON.stringify(response.data).slice(0, 600)}`);
    }
    return response.data;
  }
}

function trIban(bankCode, account) {
  // TR + 2 denetim + 5 banka + 1 rezerv + 16 hesap (ISO 13616 mod 97).
  const bban = `${String(bankCode).padStart(5, "0")}0${String(account).padStart(16, "0")}`;
  const numeric = `${bban}2927` + "00"; // T=29 R=27
  let rem = 0;
  for (const ch of numeric) rem = (rem * 10 + Number(ch)) % 97;
  return `TR${String(98 - rem).padStart(2, "0")}${bban}`;
}
const phone = r => `05${r.int(30, 59)} ${r.int(100, 999)} ${String(r.int(0, 99)).padStart(2, "0")} ${String(r.int(0, 99)).padStart(2, "0")}`;
const amount = (r, min, max) => String(Math.round((min + r.next() * (max - min)) * 100) / 100).replace(".", ",");
const tr = minor => `${Math.trunc(minor / 100)},${String(Math.abs(minor) % 100).padStart(2, "0")}`;

/** Seçili şirketi her istekte hofCompany ile adresleyen api (iki şirket aynı oturumda; arayüzün şirket bağlamı gibi). */
export function scoped(api, companyId) {
  const add = url => `${url}${url.includes("?") ? "&" : "?"}hofCompany=${encodeURIComponent(companyId)}`;
  return { get: url => api.get(add(url)), post: (url, body) => api.post(add(url), body), put: (url, body) => api.put(add(url), body), del: (url, body) => api.del(add(url), body), bin: url => api.client.raw("GET", add(url)), client: api.client, raw: api };
}

/**
 * Gönderilecekler → Tümünü Gönder, arayüzün yaptığı gibi: { all: true } + imleç (after) ile tur tur, kalan kalmayana / imleç ilerlemeyene kadar
 * (client/assets/hof-invoices.js runSend). Not: 22.10.2026 madde 30 büyük verisi bu yardımcıdan ÖNCE üretildi; o üretimde Tümünü Gönder gövdesi {}
 * idi (sunucu hiçbir belgeyi seçmez) — bekleyenler tek tek gönderildi ya da bekledi (NOT.md).
 */
export async function sendAll(api, must) {
  const results = [];
  const seen = new Set();
  let cursor = null;
  for (let turn = 0; turn < 200; turn += 1) {
    const result = await must("Tümünü Gönder", api.post("/api/workspace/invoices/send-pending", cursor ? { all: true, after: cursor } : { all: true }));
    for (const item of result.results || []) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      results.push(item);
    }
    const moved = Boolean(result.cursor) && JSON.stringify(result.cursor) !== JSON.stringify(cursor);
    cursor = result.cursor || cursor;
    if (result.stopped || !result.remaining || !moved) break;
  }
  return results;
}

/** Tablo kayıtları (anahtar, sekme, ad) — arayüzün kullandığı tRPC ucundan. */
export async function recordKeys(api) {
  const res = await api.get(`/api/trpc/sheets.getRows?input=${encodeURIComponent(JSON.stringify({ json: {} }))}`);
  const rows = res.data?.result?.data?.json?.rows || [];
  return rows.map(row => ({ key: row.__hofKey, tab: row.__sheet || "", name: row["Ad Soyad"] || "", source: row.__hofSource || "" })).filter(item => item.key);
}

async function chequeOfInvoice(api, invoiceId) {
  const doc = await api.get(`/api/workspace/invoices/${invoiceId}`);
  const list = doc.data?.cheques || doc.data?.payment?.cheques || [];
  const first = list[0];
  if (first?.id) return { id: first.id, dueDate: first.dueDate, amount: Number(first.amount) || 0 };
  return null;
}
