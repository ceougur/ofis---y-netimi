// 2.4.4 U3 (uzman UI/UX 31f; kullanıcı adına 5 dk yetkisiyle 2.4.4'e alındı): Tablo raporlarının (Tablodaki Kişiler, Tablodaki Vadeler, Tablodaki Nakit
// Akışı) PDF / Excel'i KENDİ adını taşır, ekran / PDF / Excel'de alt TOPLAM satırı vardır (= satırlar), PDF'te tutar hücresi satır ortasından bölünmez,
// dosya adındaki tarih yerel gündür (programın öbür dışa aktarımlarının kuralı: report-files.mjs reportFileBase, "gg.aa.yyyy").
// Eski kodda (ad865f0; 2.4.3'te de) PDF başlığı ve dosya adı defter raporunun adıydı ("Cari Ekstre 2026-10-22.pdf" — gerçek Cari Ekstre'yle karışıyordu),
// TOPLAM satırı yoktu, 20 kolonlu tabloda tutarlar bölünüyordu ("36.00 / 0,00"), tarih UTC'ydi (toISOString).
//
// Nasıl bozulur? (işe başlarken yazıldı): 1 ad (başlık, Excel sayfası, dosya adı) · 2 TOPLAM yok / satırlarla eşleşmiyor / yürüyen tutar toplanıyor ·
// 3 her süzgeç (dönem, kişi, durum, sekme, sayfa, en az tutar, Ay/Hafta/Gün) ve boş sonuç · 4 çok özel alan kolonu → PDF'te bölünen tutar ve başlık ·
// 5 gece yarısından sonra dosya adı (yerel 00:25 = UTC dünkü gün) · 6 kolon adları başlık düzeninde, özel alan adları (kullanıcının verisi) olduğu gibi ·
// 7 ekran ↔ PDF özeti aynı · 8 yetkisiz kullanıcı.
//
// BEKLENEN (elle, tablonun kendi hücrelerinden; programın kodundan değil): Takip sayfası Ali Veli 1.234.567,89 · Ayşe Kara 250.000,00 · Mehmet Demir 15.500,50;
// Ali'ye 34.567,89 kayıt tahsilatı → Tablodaki Kişiler TOPLAM Borç 1.500.068,39 · Alacak 34.567,89 · Bakiye 1.465.500,50 (Borç − Alacak). İkinci sayfa Zeynep Ak
// 1.000,00 (ayrı süzgeç denemesi). Öbür raporlarda TOPLAM = satırların toplamı (bağımsız toplama) = özetteki toplam.
import "./fixtures/saat-dilimi-istanbul.mjs";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, describe, test } from "node:test";
import { createUser, loginAdmin, startTestServer } from "./helpers.mjs";
import { pdfText, xlsxSheets } from "./banka-210-ortak.mjs";

const NOW = "2026-10-23T00:25:00+03:00"; // yerel 23.10.2026 00:25 — UTC'de 22.10.2026 21:25
const pad = value => String(value).padStart(2, "0");
const localDay = (() => {
  const date = new Date(NOW);
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`;
})();
const TITLES = { "cari-ekstre": "Tablodaki Kişiler", "vade-takip": "Tablodaki Vadeler", "nakit-akis": "Tablodaki Nakit Akışı" };
const OLD = { "cari-ekstre": "Cari Ekstre", "vade-takip": "Vade Takip", "nakit-akis": "Nakit Akış" };
// Eski ad tek başına (yeni adın içindeki "Tablodaki Nakit Akışı" sayılmaz).
const oldTitle = kind => new RegExp(`(?<!Tablodaki )${OLD[kind]}(?!\\p{L})`, "u");
// Toplanmayan kolonlar: Gün (vadeye kalan), Birikimli ve Beklenenle Birlikte (yürüyen); Bakiye TOPLAM'da Borç − Alacak.
const NO_SUM = new Set(["days", "cumulative", "projected", "bakiye"]);
const r2 = value => Math.round((value + Number.EPSILON) * 100) / 100 || 0;
const money = value => new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
const moneyOf = text => {
  const match = /^(-)?((?:\d{1,3}(?:\.\d{3})*|\d+)),(\d{2})(?: TL)?$/.exec(String(text ?? "").trim());
  return match ? Number(`${match[1] || ""}${match[2].replace(/\./g, "")}.${match[3]}`) : null;
};
const EXTRA = ["TELEFON", "TC KİMLİK", "MAHKEME", "ESAS NO", "AVUKAT", "ŞEHİR", "İLÇE", "E-POSTA", "IBAN", "SÖZLEŞME NO", "ÜRÜN", "KOD", "NOT"];
const person = (no, name, amount, due, status, index) => [no, name, amount, due, status, `0532123456${index}`, `1234567890${index}`, "İstanbul 5. İcra Dairesi", `2026/12${index}4`, "Av. Selin Yıldız", "İstanbul", "Kadıköy", `kisi${index}@ornek.com.tr`, `TR33000610051978645784132${index}`, `SZL-2026-00012${index}`, "Buzdolabı", `KOD-A-000${index}`, "Takipte"];
const SHEET = [
  ["DOSYA NO", "AD SOYAD", "KALAN", "VADE", "DURUM", ...EXTRA],
  person("2026/001", "Ali Veli", "1.234.567,89", "10.10.2026", "Açık", 1),
  person("2026/002", "Ayşe Kara", "250.000,00", "15.11.2026", "Açık", 2),
  person("2026/003", "Mehmet Demir", "15.500,50", "20.12.2026", "Bekliyor", 3),
];

describe("2.4.4 U3 — Tablo raporları: kendi adı, alt TOPLAM satırı (ekran/PDF/Excel), bölünmeyen tutar, yerel gün", () => {
  let server;
  let admin;
  let first = "";
  let second = "";
  const get = async (kind, query = "") => {
    const res = await admin.get(`/api/workspace/reports/${kind}${query ? `?${query}` : ""}`);
    assert.equal(res.status, 200, `${kind} ${query}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
    return res.data.data;
  };
  const exportOf = async (kind, format, filters = {}, client = admin) => {
    const res = await client.raw("POST", `/api/workspace/reports/${kind}/export`, { body: JSON.stringify({ format, filters }), headers: { "content-type": "application/json" } });
    const name = decodeURIComponent(/filename\*=UTF-8''([^;]+)/.exec(res.headers.get("content-disposition") || "")?.[1] || "");
    return { ...res, name };
  };
  before(async () => {
    server = await startTestServer({ now: NOW });
    admin = await loginAdmin(server);
    const stage = async (fileName, sheets, mode, name) => {
      const staged = await admin.post("/api/workspace/dataset/stage", { kind: "excel", fileName, sheets });
      assert.equal(staged.status, 200, JSON.stringify(staged.data).slice(0, 300));
      const done = await admin.post("/api/workspace/dataset/commit", { stageId: staged.data.data.stageId, mode, ...(name ? { name } : {}) });
      assert.equal(done.status, 200, JSON.stringify(done.data).slice(0, 300));
    };
    await stage("Alacaklar.xlsx", [{ name: "Takip", matrix: SHEET }], "replace");
    await stage("Ikinci.xlsx", [{ name: "Sözler", matrix: [["DOSYA NO", "AD SOYAD", "KALAN", "VADE", "DURUM"], ["2026/101", "Zeynep Ak", "1.000,00", "05.11.2026", "Açık"]] }], "session", "İkinci Tablo");
    const pay = await admin.post(`/api/workspace/cases/${encodeURIComponent("2026/001")}/payments`, { amount: "34567.89", date: "2026-10-15", method: "cash" });
    assert.equal(pay.status, 200, JSON.stringify(pay.data).slice(0, 300));
    for (const [kind, amount] of [["in", "5000"], ["out", "1250.5"]]) assert.equal((await admin.post("/api/workspace/cash", { kind, amount, date: "2026-10-16", description: "Kasa hareketi" })).status, 200);
    const sessions = (await get("cari-ekstre")).sessions;
    second = sessions.find(item => item.name === "İkinci Tablo")?.key || "";
    first = sessions.find(item => item.name !== "İkinci Tablo")?.key || "";
    assert.ok(first && second, `iki sayfa: ${JSON.stringify(sessions)}`);
  });
  after(() => server?.close());

  // Rapor yanıtının TOPLAM satırı ({ kolon anahtarı: değer }) satırlardan bağımsız toplamla karşılaştırılır.
  const expectedFooter = table => {
    if (!table.rows.length) return null;
    const out = {};
    for (const column of table.columns) {
      if ((column.type !== "money" && column.type !== "number") || column.dynamic || NO_SUM.has(column.key)) continue;
      const values = table.rows.map(row => row[column.key]).filter(value => typeof value === "number");
      if (values.length) out[column.key] = r2(values.reduce((sum, value) => sum + value, 0));
    }
    if (table.columns.some(column => column.key === "bakiye")) out.bakiye = r2((out.borc || 0) - (out.alacak || 0));
    return out;
  };
  const checkFooter = (data, tag) => {
    const table = data.report.table;
    const expected = expectedFooter(table);
    if (!expected) {
      assert.equal(table.footer ?? null, null, `${tag}: boş sonuçta TOPLAM yok`);
      return;
    }
    assert.ok(table.footer, `${tag}: TOPLAM satırı yok (report.table.footer)`);
    assert.equal(table.footer[table.columns[0].key], "TOPLAM", `${tag}: TOPLAM etiketi ilk kolonda`);
    for (const [key, value] of Object.entries(expected)) assert.equal(r2(table.footer[key]), value, `${tag}: TOPLAM ${key} = satırların toplamı`);
    for (const key of ["days", "cumulative", "projected"]) assert.equal(table.footer[key] ?? null, null, `${tag}: "${key}" toplanmaz`);
    const sum = Object.fromEntries(data.summary.map(([label, value]) => [label, value]));
    // 2.4.5 madde 5 (bilerek): tablodan gelen tutarın özet adı "(Muhasebe Kaydı Değil)" der; Tablodaki Nakit Akışı'nda Kasa giriş / çıkış / Net yok.
    if (data.report.kind === "cari-ekstre") assert.deepEqual([moneyOf(sum["Tablodaki Toplam Borç (Muhasebe Kaydı Değil)"]), moneyOf(sum["Toplam Tahsil Edilen"]), moneyOf(sum["Tablodaki Bakiye (Muhasebe Kaydı Değil)"])], [expected.borc ?? 0, expected.alacak ?? 0, expected.bakiye], `${tag}: özet = TOPLAM`);
    if (data.report.kind === "vade-takip") assert.equal(moneyOf(sum["Tablodaki Toplam Tutar (Muhasebe Kaydı Değil)"]), expected.amount ?? 0, `${tag}: özet Toplam Tutar = TOPLAM`);
    if (data.report.kind === "nakit-akis") assert.deepEqual(data.summary.map(([label, value]) => [label, moneyOf(value)]), [["Tablodan Beklenen Tahsilat (Muhasebe Kaydı Değil)", expected.expected ?? 0], ["Gerçekleşen Tahsilat", expected.collected ?? 0]], `${tag}: özet = TOPLAM (Kasa satırı yok)`);
  };

  test("Tablodaki Kişiler: TOPLAM Borç / Alacak / Bakiye elle hesapla aynı; özet aynı", async () => {
    const data = await get("cari-ekstre", `from=2026-01-01&to=2026-12-31&sessions=${encodeURIComponent(first)}`);
    assert.deepEqual([data.report.table.footer?.borc, data.report.table.footer?.alacak, data.report.table.footer?.bakiye], [1500068.39, 34567.89, 1465500.5], `TOPLAM: ${JSON.stringify(data.report.table.footer)}`);
    checkFooter(data, "cari-ekstre Takip");
  });

  const COMBOS = {
    "cari-ekstre": [{}, { from: "2026-10-01", to: "2026-10-31" }, { from: "2026-11-01", to: "2026-12-31" }, { cari: "Ali" }, { status: "Açık" }, { tabs: "Takip" }, { sessions: "#2" }, { minAmount: "100000" }, { from: "2030-01-01", to: "2030-01-31" }],
    "vade-takip": [{}, { from: "2026-10-01", to: "2026-10-31" }, { from: "2026-11-01", to: "2026-12-31" }, { cari: "Ayşe" }, { status: "gecikmis" }, { status: "yaklasan" }, { tabs: "Sözler" }, { sessions: "#2" }, { minAmount: "100000" }, { cari: "Yok Böyle Biri" }],
    "nakit-akis": [{}, { granularity: "month", from: "2026-10-01", to: "2026-12-31" }, { granularity: "week", from: "2026-10-01", to: "2026-12-31" }, { granularity: "day", from: "2026-10-01", to: "2026-12-31" }, { tabs: "Takip", from: "2026-10-01", to: "2026-12-31" }, { sessions: "#2" }, { from: "2030-01-01", to: "2030-01-31" }],
  };
  const resolve = combo => Object.fromEntries(Object.entries(combo).map(([key, value]) => [key, value === "#2" ? second : value]));
  const queryOf = combo => Object.entries(resolve(combo)).map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join("&");
  const bodyOf = combo => {
    const filters = resolve(combo);
    for (const key of ["status", "sessions", "tabs"]) if (filters[key]) filters[key] = [filters[key]];
    return filters;
  };

  for (const kind of Object.keys(COMBOS)) {
    test(`${TITLES[kind]}: her süzgeç × ekran (JSON) / PDF / Excel — TOPLAM = satırlar, kendi adı, bölünmeyen tutar, yerel gün`, async () => {
      let seen = 0;
      for (const combo of COMBOS[kind]) {
        const tag = `${kind} ${JSON.stringify(combo)}`;
        const data = await get(kind, queryOf(combo));
        checkFooter(data, tag);
        if (data.report.table.rows.length) seen += 1;
        // Kolon adları başlık düzeninde (programın adları); özel alan kolonları kullanıcının verisi, olduğu gibi.
        for (const column of data.report.table.columns) if (column.dynamic) assert.ok(EXTRA.includes(column.label), `${tag}: özel alan adı değişmemeli: ${column.label}`);
        for (const column of data.report.table.columns.filter(column => !column.dynamic)) assert.ok(!/ [a-zçğıöşü]/.test(column.label.replace(/ (ve|ile|veya|ya|da|de|ki) /g, " ")), `${tag}: kolon adı başlık düzeninde değil: "${column.label}"`);
        // PDF: başlık ve dosya adı raporun kendi adı; satırlardaki ve TOPLAM'daki her tutar bölünmeden; özel alan kolonu sığmadıysa söylenir.
        const pdf = await exportOf(kind, "pdf", bodyOf(combo));
        assert.equal(pdf.status, 200, `${tag} PDF ${pdf.status}`);
        assert.equal(pdf.name, `${TITLES[kind]} ${localDay}.pdf`, `${tag}: PDF dosya adı`);
        const text = pdfText(pdf.buffer).replace(/\s+/g, " ");
        assert.ok(text.includes(TITLES[kind]), `${tag}: PDF başlığı "${TITLES[kind]}" yok`);
        assert.ok(!oldTitle(kind).test(text), `${tag}: PDF'te defter raporunun adı "${OLD[kind]}"`);
        const table = data.report.table;
        const moneyCols = table.columns.map((column, index) => (column.type === "money" ? index : -1)).filter(index => index >= 0);
        for (const row of table.rows) for (const index of moneyCols) {
          const value = row[table.columns[index].key];
          if (typeof value === "number") assert.ok(text.includes(money(value)), `${tag}: PDF'te tutar bölünmüş ya da yok: "${money(value)}" (${table.columns[index].label})`);
        }
        if (table.footer) {
          assert.ok(text.includes("TOPLAM"), `${tag}: PDF'te TOPLAM satırı yok`);
          for (const index of moneyCols) if (typeof table.footer[table.columns[index].key] === "number") assert.ok(text.includes(money(table.footer[table.columns[index].key])), `${tag}: PDF TOPLAM "${money(table.footer[table.columns[index].key])}" yok`);
        }
        for (const column of table.columns.filter(column => !column.dynamic)) assert.ok(text.includes(column.label), `${tag}: PDF kolon başlığı bölünmüş ya da yok: "${column.label}"`);
        const shownDynamic = table.columns.filter(column => column.dynamic && text.includes(column.label)).length;
        const dynamicCount = table.columns.filter(column => column.dynamic).length;
        if (shownDynamic < dynamicCount) assert.match(text, /özel alan kolonu sayfaya sığmadı \(tamamı Excel'de\)/, `${tag}: bırakılan özel alan kolonu söylenmeli`);
        // Özet PDF'te ekrandakiyle aynı.
        for (const [label, value] of data.summary) assert.ok(text.includes(label) && text.includes(value), `${tag}: PDF özeti "${label}: ${value}"`);
        // Excel: sayfa adı ve başlık bloğu raporun adı; başlık + satırlar + TOPLAM; TOPLAM hücreleri ekrandakiyle aynı; Özet sayfası.
        const xlsx = await exportOf(kind, "xlsx", bodyOf(combo));
        assert.equal(xlsx.status, 200, `${tag} Excel ${xlsx.status}`);
        assert.equal(xlsx.name, `${TITLES[kind]} ${localDay}.xlsx`, `${tag}: Excel dosya adı`);
        const sheets = xlsxSheets(xlsx.buffer);
        const sheet = sheets[TITLES[kind]];
        assert.ok(sheet, `${tag}: Excel sayfası "${TITLES[kind]}" yok: ${Object.keys(sheets).join(", ")}`);
        assert.ok(sheet.slice(0, 4).some(row => row.length === 1 && row[0] === TITLES[kind]), `${tag}: Excel başlık bloğunda rapor adı`);
        const head = sheet.findIndex(row => row.length > 1);
        assert.deepEqual(sheet[head], table.columns.map(column => column.label), `${tag}: Excel kolon başlıkları`);
        assert.equal(sheet.length - head, 1 + table.rows.length + (table.footer ? 1 : 0), `${tag}: Excel satır sayısı (başlık + satırlar + TOPLAM)`);
        if (table.footer) {
          const last = sheet[sheet.length - 1];
          assert.equal(last[0], "TOPLAM", `${tag}: Excel TOPLAM etiketi`);
          table.columns.forEach((column, index) => {
            if (typeof table.footer[column.key] === "number") assert.equal(r2(typeof last[index] === "number" ? last[index] : moneyOf(last[index])), r2(table.footer[column.key]), `${tag}: Excel TOPLAM ${column.label}`);
          });
        }
        assert.deepEqual((sheets["Özet"] || []).slice(-data.summary.length).map(row => row[0]), data.summary.map(([label]) => label), `${tag}: Excel özeti`);
      }
      assert.ok(seen >= 3, `${kind}: en az üç süzgeçte satır olmalı (${seen})`);
    });
  }

  test("PDF: 20 kolonlu Tablodaki Kişiler'de her tutar ve programın kolon başlıkları bölünmeden; bırakılan özel alan kolonu söylenir", async () => {
    const data = await get("cari-ekstre");
    const table = data.report.table;
    assert.equal(table.columns.length, 20, `kolon sayısı: ${table.columns.map(column => column.label).join(", ")}`);
    const text = pdfText((await exportOf("cari-ekstre", "pdf", {})).buffer).replace(/\s+/g, " ");
    for (const row of table.rows) for (const key of ["borc", "alacak", "bakiye"]) if (typeof row[key] === "number") assert.ok(text.includes(money(row[key])), `PDF'te tutar bölünmüş: "${money(row[key])}" (${key}, ${row.cari})`);
    for (const label of ["Cari", "Tarih", "Açıklama", "Kaynak", "Tablodaki Borç (Muhasebe Kaydı Değil)", "Tahsil Edilen", "Tablodaki Bakiye (Muhasebe Kaydı Değil)", "Durum"]) assert.ok(text.includes(label), `PDF kolon başlığı bölünmüş: "${label}"`);
    assert.match(text, /\d+ özel alan kolonu sayfaya sığmadı \(tamamı Excel'de\)/, "sığmayan özel alan kolonu alt başlıkta");
  });

  test("PDF başlığı, Excel sayfası ve dosya adı raporun kendi adı (defter raporunun adı değil)", async () => {
    for (const kind of Object.keys(TITLES)) {
      const pdf = await exportOf(kind, "pdf", {});
      const text = pdfText(pdf.buffer).replace(/\s+/g, " ");
      assert.ok(text.includes(TITLES[kind]) && !oldTitle(kind).test(text), `${kind}: PDF başlığı "${TITLES[kind]}" olmalı ("${OLD[kind]}" değil): ${text.slice(0, 160)}`);
      assert.ok(pdf.name.startsWith(`${TITLES[kind]} `), `${kind}: PDF dosya adı ${pdf.name}`);
      const xlsx = await exportOf(kind, "xlsx", {});
      assert.ok(xlsxSheets(xlsx.buffer)[TITLES[kind]], `${kind}: Excel sayfası "${TITLES[kind]}": ${Object.keys(xlsxSheets(xlsx.buffer)).join(", ")}`);
      assert.ok(xlsx.name.startsWith(`${TITLES[kind]} `), `${kind}: Excel dosya adı ${xlsx.name}`);
    }
  });

  test("istemcinin sekme adları (hof-reports.js KINDS) = sunucunun PDF/Excel adları (TABLE_REPORT_TITLES)", async () => {
    const { TABLE_REPORT_TITLES } = await import("../server/routes/reports.mjs");
    const source = readFileSync(new URL("../client/assets/hof-reports.js", import.meta.url), "utf8");
    const kinds = Object.fromEntries(source.split(/\r?\n/).map(line => /^\s*\["(cari-ekstre|vade-takip|nakit-akis)", "([^"]+)"/.exec(line)).filter(Boolean).map(match => [match[1], match[2]]));
    assert.deepEqual(kinds, TITLES, "istemcinin sekme adları");
    assert.deepEqual({ ...(TABLE_REPORT_TITLES || {}) }, TITLES, "sunucunun rapor adları (TABLE_REPORT_TITLES)");
  });

  test("PDF üreticisi (bütün raporlar): en büyük tutar satırların %10'unda kalsa da ve TOPLAM hücresi bölünmez", async () => {
    // 7 kolon, dikey sayfa: 6 boşluksuz kod kolonu + tutar. 30 satırın 29'u "1,00", biri "1.234.567,89"; TOPLAM "1.234.596,89" (kalın). Önceden tutar kolonu
    // p90 hücresine ("1,00") göre ölçülüyordu: büyük tutar ve TOPLAM iki satıra bölünüyordu.
    const { tablePdf } = await import("../server/lib/report-pdf.mjs");
    const rows = Array.from({ length: 30 }, (_, index) => [...Array.from({ length: 6 }, (__, col) => `KOD-${col}-${String(index).padStart(6, "0")}`), index === 14 ? "1.234.567,89" : "1,00"]);
    const text = pdfText(tablePdf({ title: "Deneme", headers: ["A", "B", "C", "D", "E", "F", "Tutar"], types: ["", "", "", "", "", "", "money"], rows, footer: ["TOPLAM", "", "", "", "", "", "1.234.596,89"] })).replace(/\s+/g, " ");
    assert.ok(text.includes("1.234.567,89"), "en büyük tutar bölünmüş");
    assert.ok(text.includes("1.234.596,89"), "TOPLAM tutarı bölünmüş");
  });

  test("dosya adı yerel gündür: yerel 00:25 (UTC'de dünkü gün) → bugünün tarihi", async () => {
    const date = new Date(NOW);
    const res = await exportOf("cari-ekstre", "pdf", {});
    assert.equal(res.name, `Tablodaki Kişiler ${localDay}.pdf`);
    if (date.getDate() !== date.getUTCDate()) assert.ok(!res.name.includes(`${pad(date.getUTCDate())}.${pad(date.getUTCMonth() + 1)}`), `UTC günü yazılmamalı: ${res.name}`);
  });

  test("yetkisiz kullanıcı (Tablo ve Personel Raporları yetkisi yok): ekran ve dışa aktarım 403", async () => {
    const staff = await createUser(server, admin, { username: "u3-personel", role: "personel" });
    assert.equal((await staff.get("/api/workspace/reports/cari-ekstre")).status, 403);
    assert.equal((await exportOf("cari-ekstre", "pdf", {}, staff)).status, 403);
  });
});
