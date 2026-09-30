// Dinamik raporlama uçları (v2.0.2). Rapor, seçilen oturumlardaki (varsayılan: hepsi) veriyi ortak omurgaya çevirip
// süzgeçlerle üretir; JSON (ekran), .xlsx, .pdf ve yazdırma görünümü için düz tablo döner.
import { HttpError, ok, readJson, sendBuffer, text } from "../lib/http.mjs";
import { analyzeColumns } from "../lib/insight/columns.mjs";
import { computeDeadlines, computeDues } from "../lib/insight/dues.mjs";
import { cariEkstre, dayText, flattenTable, nakitAkis, normalizeFilters, normalizeRecords, REPORT_KINDS, vadeTakip } from "../lib/reports.mjs";
import { tablePdf } from "../lib/report-pdf.mjs";
import { columnOrder } from "../lib/sources.mjs";
import { buildXlsx } from "../lib/xlsx-write.mjs";

// Raporlar ileriye bir yıl bakar (takvim ve bildirimler bu ay + 7 gün): açıkça tarihi yazılı ödeme ve sözler aralık
// seçilince görünür. Geçmiş için takvimin kuralı geçerlidir (90 gün; son tarihler 30 gün).
const AHEAD = Object.freeze({ aheadDays: 366, promiseDays: 366 });
const TITLES = { "cari-ekstre": "Cari ekstre", "vade-takip": "Vade takip", "nakit-akis": "Nakit akış" };
const ascii = value => String(value).replace(/[ıİşŞğĞçÇöÖüÜ]/g, char => ({ ı: "i", İ: "I", ş: "s", Ş: "S", ğ: "g", Ğ: "G", ç: "c", Ç: "C", ö: "o", Ö: "O", ü: "u", Ü: "U" })[char]);

export function registerReportRoutes(router, { auth, store, dataset, profile, plans }) {
  const parseSettled = key => {
    try {
      const value = JSON.parse(store.setting(key, "{}") || "{}");
      return value && typeof value === "object" ? value : {};
    } catch {
      return {};
    }
  };

  const paymentsState = () => {
    const row = store.get("SELECT COUNT(*) AS count, COALESCE(MAX(COALESCE(updated_at, created_at)), '') AS at FROM payments");
    return `${row.count}/${row.at}`;
  };
  // Oturumun takvimi etkileyen her şeyi: veri ve analiz (profil parmak izi), elle kapatılan kalemler, sekme adları.
  const sessionState = session =>
    dataset.withKey(session.key, () => {
      const settled = store.setting(dataset.settingKey("dues.settled"), "") || "";
      const tabs = ["dataset.tabs.alias", "dataset.tabs.hidden"].map(name => store.setting(dataset.settingKey(name), "") || "").join("~");
      return [session.key, session.rowCount, session.recordCount, session.changedAt || "", profile.fingerprint ? profile.fingerprint() : "", `${settled.length}:${settled.slice(-64)}`, tabs].join(":");
    });

  /** Seçilen oturumların omurgası: kayıtlar, takvim kalemleri ve son tarihler (oturum adıyla). */
  async function calendar(filters, now) {
    const sessions = dataset.sessions().filter(item => !filters.sessions.length || filters.sessions.includes(item.key));
    const records = [];
    const items = [];
    const dormant = [];
    const columnsBySession = {};
    for (const session of sessions) {
      await dataset.withKey(session.key, async () => {
        const view = await dataset.view();
        const rows = (view.rows || []).filter(row => !String(row.__hofKey || "").startsWith("free:"));
        if (!rows.length) return;
        const tabs = (view.tabs || []).map(tab => tab.title).filter(Boolean);
        const forced = profile.roles ? profile.roles() : null;
        const analyses = analyzeColumns(rows.slice(0, 5000), columnOrder(rows), { now, forced });
        const normalized = normalizeRecords({ rows, analyses, session: session.key, sessionName: session.name, tabs });
        columnsBySession[session.key] = normalized.columns;
        for (const record of normalized.records) records.push(record);
        const keys = new Set(rows.map(row => row.__hofKey));
        const payments = store.all("SELECT case_key AS caseKey, amount, date, note FROM payments").filter(item => keys.has(item.caseKey));
        const settled = parseSettled(dataset.settingKey("dues.settled"));
        const dues = computeDues({ rows, tabs, payments, settled, now, forced, window: AHEAD });
        // Taksit kartı olan kişinin (v2.0.8) tablodaki ödeme kalemleri ikinci kez sayılmaz (takvimle aynı kural).
        const carded = plans?.linkedCases ? plans.linkedCases(session.key) : new Set();
        for (const item of dues.dormant || []) if (!carded.has(item.caseKey)) dormant.push({ ...item, session: session.key, sessionName: session.name });
        for (const item of dues.items) if (item.promise || !carded.has(item.caseKey)) items.push({ ...item, carded: carded.has(item.caseKey), session: session.key, sessionName: session.name, tab: item.tab || String(rows.find(row => row.__hofKey === item.caseKey)?.__sheet || "") });
        for (const item of computeDeadlines({ rows, tabs, now, exclude: dues.sources, forced, aheadDays: AHEAD.aheadDays })) items.push({ ...item, session: session.key, sessionName: session.name, deadline: true });
      });
    }
    return { sessions: sessions.map(item => ({ key: item.key, name: item.name, rowCount: item.rowCount })), records, items, dormant, columnsBySession };
  }
  // Tüm oturumların takvimi önbellekte: oturumlar, tahsilatlar, taksit kartları ve gün değişmedikçe yeniden hesaplanmaz
  // (birleşik Vade takip ve Nakit akış her süzgeç değişiminde buradan okur).
  let cache = { key: "", value: null, pending: null };
  async function allCalendar(now = new Date()) {
    const key = [now.toDateString(), paymentsState(), plans?.fingerprint ? plans.fingerprint() : "", ...dataset.sessions().map(sessionState)].join("|");
    if (cache.key === key && cache.value) return cache.value;
    if (cache.key === key && cache.pending) return cache.pending;
    const pending = calendar(normalizeFilters({}), now);
    cache = { key, value: null, pending };
    try {
      const value = await pending;
      if (cache.pending === pending) cache = { key, value, pending: null };
      return value;
    } catch (error) {
      if (cache.pending === pending) cache = { key: "", value: null, pending: null };
      throw error;
    }
  }
  async function backbone(filters, now) {
    const data = filters.sessions.length ? await calendar(filters, now) : await allCalendar(now);
    const payments = store.all("SELECT case_key AS caseKey, amount, date, note FROM payments");
    // Nakit akışta taksit kartı hareketleri de kasa giriş/çıkışıdır (v2.0.4).
    const cashEntries = [...store.all("SELECT kind, amount, date FROM cash_entries"), ...(plans?.cashEntries ? plans.cashEntries().map(entry => ({ kind: entry.kind, amount: entry.amount, date: entry.date })) : [])];
    return { ...data, payments, cashEntries };
  }

  async function build(kind, input) {
    if (!REPORT_KINDS.includes(kind)) throw new HttpError(400, "Bilinmeyen rapor türü.");
    const now = new Date();
    const filters = normalizeFilters(input);
    const data = await backbone(filters, now);
    let report;
    if (kind === "cari-ekstre") report = cariEkstre({ records: data.records, payments: data.payments, filters, now });
    else if (kind === "vade-takip") report = vadeTakip({ records: data.records, items: data.items, dormant: data.dormant, filters, now });
    else report = nakitAkis({ items: data.items, payments: data.payments, cashEntries: data.cashEntries, filters, now });
    const tabs = [...new Set(data.records.map(record => record.tab).filter(Boolean))].sort((a, b) => a.localeCompare(b, "tr"));
    const statuses = [...new Set(data.records.map(record => record.status).filter(Boolean))].slice(0, 30);
    return { report, filters: { ...filters, from: filters.from === null ? "" : new Date(filters.from).toISOString().slice(0, 10), to: filters.to === null ? "" : new Date(filters.to).toISOString().slice(0, 10) }, sessions: data.sessions, tabs, statuses, columnsBySession: data.columnsBySession, crossMatched: data.records.length ? [...new Set(data.records.map(record => record.cariKey).filter(Boolean))].length : 0 };
  }

  const subtitle = (filters, sessions) => {
    const parts = [];
    if (filters.from || filters.to) parts.push(`${filters.from ? dayText(Date.parse(filters.from)) : "başlangıç"} – ${filters.to ? dayText(Date.parse(filters.to)) : "bugün"}`);
    if (filters.cari) parts.push(`cari: ${filters.cari}`);
    if (filters.sessions.length) parts.push(`${filters.sessions.length} oturum`);
    else if (sessions.length > 1) parts.push(`${sessions.length} oturum birleşik`);
    return parts.join(" · ");
  };
  const summaryOf = report => {
    const money = value => `${new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value || 0)} TL`;
    if (report.kind === "cari-ekstre") return [["Cari", String(report.totals.caris)], ["Toplam Borç", money(report.totals.debit)], ["Toplam Alacak", money(report.totals.credit)], ["Bakiye", money(report.totals.balance)]];
    if (report.kind === "vade-takip") return [["Kalem", String(report.totals.count)], ["Gecikmiş", `${report.totals.overdue} · ${money(report.totals.overdueAmount)}`], ["Yaklaşan", String(report.totals.upcoming)], ["Toplam Tutar", money(report.totals.amount)]];
    return [["Beklenen Tahsilat", money(report.totals.expected)], ["Gerçekleşen Tahsilat", money(report.totals.collected)], ["Kasa Giriş", money(report.totals.cashIn)], ["Kasa Çıkış", money(report.totals.cashOut)]];
  };

  router.get("/api/workspace/reports/:kind", async ({ req, res, params, url }) => {
    auth.requirePermission(req, "reports.view");
    const input = Object.fromEntries(url.searchParams.entries());
    for (const key of ["status", "sessions", "tabs"]) if (input[key]) input[key] = String(input[key]).split(",").map(item => item.trim()).filter(Boolean);
    ok(res, await build(text(params.kind), input));
  });

  router.post("/api/workspace/reports/:kind/export", async ({ req, res, params }) => {
    const user = auth.requirePermission(req, "reports.view");
    const body = await readJson(req);
    const kind = text(params.kind);
    const format = text(body.format) || "xlsx";
    const result = await build(kind, body.filters || {});
    const flat = flattenTable(result.report.table);
    const stamp = new Date().toISOString().slice(0, 10);
    const title = TITLES[kind];
    if (format === "xlsx") {
      const columns = result.report.table.columns.map(column => column.key);
      const rows = result.report.table.rows.map(row => Object.fromEntries(result.report.table.columns.map(column => [column.key, column.type === "date" ? dayText(row[column.key]) : row[column.key] ?? ""])));
      const buffer = buildXlsx([{ name: title.slice(0, 31), columns, headers: flat.headers, rows }], { title: `${title} · DestekOfis` });
      return sendBuffer(res, buffer, { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", name: `${ascii(title)} ${stamp}.xlsx` });
    }
    if (format === "pdf") {
      const buffer = tablePdf({ title, subtitle: subtitle(result.filters, result.sessions), headers: flat.headers, rows: flat.rows, types: result.report.table.columns.map(column => column.type || ""), summary: summaryOf(result.report), officeName: store.setting("office.name", ""), userName: user.display_name || user.username || "" });
      return sendBuffer(res, buffer, { type: "application/pdf", name: `${ascii(title)} ${stamp}.pdf`, inline: body.inline === true });
    }
    throw new HttpError(400, "Biçim xlsx ya da pdf olmalı.");
  });

  // Birleşik raporlar (routes/overview.mjs): tüm oturumların tablo takvimi.
  return { calendar: allCalendar };
}
