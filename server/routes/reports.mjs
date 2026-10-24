// Dinamik raporlama uçları (v2.0.2). Rapor, seçilen oturumlardaki (varsayılan: hepsi) veriyi ortak omurgaya çevirip
// süzgeçlerle üretir; JSON (ekran), .xlsx, .pdf ve yazdırma görünümü için düz tablo döner.
import { HttpError, ok, readJson, sendBuffer, text } from "../lib/http.mjs";
import { caseCollections, caseCollectionsState } from "../lib/insight/case-collections.mjs";
import { analyzeColumns } from "../lib/insight/columns.mjs";
import { computeDeadlines, computeDues } from "../lib/insight/dues.mjs";
import { cariEkstre, dayText, flattenTable, nakitAkis, normalizeFilters, normalizeRecords, REPORT_KINDS, TABLE_AMOUNT_NOTE, tableNotes, vadeTakip } from "../lib/reports.mjs";
import { fromCents, roundMoney, toCents } from "../lib/money.mjs";
import { isoDay } from "../lib/plans.mjs";
import { createReportHeader } from "../lib/report-header.mjs";
import { reportFileBase, reportPdf, reportXlsx } from "../lib/report-files.mjs";
import { columnOrder } from "../lib/sources.mjs";
import { titleCase } from "../lib/text-case.mjs";
import { systemClock } from "../lib/clock.mjs";

// Raporlar ileriye bir yıl bakar (takvim ve bildirimler bu ay + 7 gün): açıkça tarihi yazılı ödeme ve sözler aralık
// seçilince görünür. Geçmiş için takvimin kuralı geçerlidir (90 gün; son tarihler 30 gün).
const AHEAD = Object.freeze({ aheadDays: 366, promiseDays: 366 });
// 2.4.4 U3 (uzman UI/UX 31f): raporun adı Raporlar penceresindeki sekme adıyla aynı (client/assets/hof-reports.js KINDS) — PDF/Excel başlığında ve dosya adında.
// 2.4.3'e kadar defter raporlarının adını taşıyordu ("Cari Ekstre", "Vade Takip", "Nakit Akış"); aynı penceredeki gerçek Cari Ekstre'yle karışıyordu.
export const TABLE_REPORT_TITLES = Object.freeze({ "cari-ekstre": "Tablodaki Kişiler", "vade-takip": "Tablodaki Vadeler", "nakit-akis": "Tablodaki Nakit Akışı" });
// Alt TOPLAM satırı (2.4.4 U3; kalıcı karar "her raporda alt TOPLAM satırı, ekran/PDF/Excel aynı"): bütün satırlardan, tutar ve sayı kolonları toplanır.
// Toplanmaz: Gün (vadeye kalan gün), özel alan kolonları (kullanıcının verisi). Bakiye kişi başına yürüyen bakiyedir; TOPLAM'da net bakiye (Borç − Alacak =
// özetteki Bakiye). Boş raporda TOPLAM yok. (2.4.5 madde 5: Nakit Akışı'nın yürüyen Birikimli / Beklenenle Birlikte kolonları kalktı.)
const NO_SUM = new Set(["days", "bakiye"]);
export function tableFooter(table) {
  const rows = table?.rows || [];
  if (!rows.length) return null;
  const footer = {};
  for (const column of table.columns) {
    if ((column.type !== "money" && column.type !== "number") || column.dynamic || NO_SUM.has(column.key)) continue;
    const values = rows.map(row => row[column.key]).filter(value => typeof value === "number" && Number.isFinite(value));
    if (!values.length) continue;
    // 31e C2: para kolonunda her satır önce kuruşa (ekranda, PDF'te ve Excel hücresinde görünen tutar), toplam kuruştan — özet ile TOPLAM satırı aynı
    // (kuruş altı hücrede — Excel formülü 333,3333333 — önceden ham değerler toplanıp yuvarlanıyor, özet 11.868,02 iken TOPLAM 11.868,03 çıkıyordu).
    footer[column.key] = column.type === "money" ? fromCents(values.reduce((sum, value) => sum + toCents(value), 0)) : values.reduce((sum, value) => sum + value, 0);
  }
  if (table.columns.some(column => column.key === "bakiye")) footer.bakiye = roundMoney((footer.borc || 0) - (footer.alacak || 0));
  const label = table.columns.find(column => !column.type && !column.dynamic);
  if (label) footer[label.key] = "TOPLAM";
  return footer;
}
const COUNT = new Intl.NumberFormat("tr-TR");
const MONEY = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** Özet (ekran, PDF ve Excel'in Özet sayfası aynı; 2.4.4 U3'e kadar ekranın kartları ile PDF'in özeti ayrı yazılıyordu, PDF'te "Net" yoktu). */
export function tableSummary(report) {
  const money = value => `${MONEY.format(value || 0)} TL`;
  const count = value => COUNT.format(value || 0);
  const totals = report.totals || {};
  // 2.4.5 madde 5: tablodan gelen tutar ve ondan program tahsilatı düşülerek bulunan bakiye "Muhasebe Kaydı Değil" adıyla (kolon başlıklarıyla aynı).
  if (report.kind === "cari-ekstre") return [["Cari", count(totals.caris)], [`Tablodaki Toplam Borç ${TABLE_AMOUNT_NOTE}`, money(totals.debit)], ["Toplam Tahsil Edilen", money(totals.credit)], [`Tablodaki Bakiye ${TABLE_AMOUNT_NOTE}`, money(totals.balance)], ...(totals.crossMatched ? [["Birden Çok Dosyada", count(totals.crossMatched)]] : [])];
  if (report.kind === "vade-takip") return [["Kalem", count(totals.count)], ["Gecikmiş", `${count(totals.overdue)} · ${money(totals.overdueAmount)}`], ["Yaklaşan / Bugün", count(totals.upcoming)], [`Tablodaki Toplam Tutar ${TABLE_AMOUNT_NOTE}`, money(totals.amount)], ...(totals.dormant ? [["Ödeme Kesilmiş Olabilir", count(totals.dormant)]] : [])];
  // 2.4.5 madde 5: Kasa giriş/çıkış/net bu raporda yok (Kasa, Kasa raporlarında; tablo tahmini Kasa ile aynı tabloda toplanmaz).
  return [[`Tablodan Beklenen Tahsilat ${TABLE_AMOUNT_NOTE}`, money(totals.expected)], ["Gerçekleşen Tahsilat", money(totals.collected)]];
}

export function registerReportRoutes(router, { auth, store, dataset, profile, plans, company = () => null, now: clock = systemClock }) {
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
    // 31e A1: borcu birden çok sekmede olan dosya no → her sekme ayrı sayıldı; rapor bunu not olarak söyler (debt-column.mjs debtByRecord).
    const split = [];
    for (const session of sessions) {
      await dataset.withKey(session.key, async () => {
        const view = await dataset.view();
        // 31e C1: takvim BÜTÜN sekmelerden kurulur, Sekme süzgeci kalemlere ve kayıtlara SONRA uygulanır (2.4.3 yolu; lib/reports.mjs). Takvim yalnız seçili sekmelerden
        // kurulunca kaydın bütün tahsilatı o sekmenin kalemlerine sayılıyor, öbür sekme için yapılan tahsilat bu sekmenin kalemini kapatıyordu (aday 12–14).
        const tabs = (view.tabs || []).map(tab => tab.title).filter(Boolean);
        const rows = (view.rows || []).filter(row => !String(row.__hofKey || "").startsWith("free:"));
        if (!rows.length) return;
        const forced = profile.roles ? profile.roles() : null;
        const analyses = analyzeColumns(rows.slice(0, 5000), columnOrder(rows), { now, forced });
        // 31a F4: çok sekmeli tabloda her sekmenin kişi / tutar / kimlik kolonu kendi sekmesinden okunur (sekmeler farklı başlık taşır: Borçlu, Müşteri, Kiracı).
        const analyzeTab = scope => analyzeColumns(scope.slice(0, 5000), columnOrder(scope), { now, forced });
        const normalized = normalizeRecords({ rows, analyses, session: session.key, sessionName: session.name, tabs, analyzeTab });
        columnsBySession[session.key] = normalized.columns;
        for (const record of normalized.records) records.push(record);
        const keys = new Set(rows.map(row => row.__hofKey));
        // 2.4.4 (E8): takvimle aynı küme — kayıt tahsilatı + kayda bağlı carinin ve taksit kartının tahsilatı (lib/insight/case-collections.mjs).
        const payments = caseCollections(store, session.key, { plans: true }).filter(item => keys.has(item.caseKey));
        const settled = parseSettled(dataset.settingKey("dues.settled"));
        const dues = computeDues({ rows, tabs, payments, settled, now, forced, window: AHEAD });
        for (const item of dues.debtSplit || []) split.push({ ...item, session: session.key });
        // Taksit kartı olan kişinin (v2.0.8) tablodaki ödeme kalemleri ikinci kez sayılmaz (takvimle aynı kural).
        const carded = plans?.linkedCases ? plans.linkedCases(session.key) : new Set();
        for (const item of dues.dormant || []) if (!carded.has(item.caseKey)) dormant.push({ ...item, session: session.key, sessionName: session.name });
        for (const item of dues.items) if (item.promise || !carded.has(item.caseKey)) items.push({ ...item, carded: carded.has(item.caseKey), session: session.key, sessionName: session.name, tab: item.tab || String(rows.find(row => row.__hofKey === item.caseKey)?.__sheet || "") });
        for (const item of computeDeadlines({ rows, tabs, now, exclude: dues.sources, forced, aheadDays: AHEAD.aheadDays })) items.push({ ...item, session: session.key, sessionName: session.name, deadline: true });
      });
    }
    return { sessions: sessions.map(item => ({ key: item.key, name: item.name, rowCount: item.rowCount })), records, items, dormant, columnsBySession, split };
  }
  // Tüm oturumların takvimi önbellekte: oturumlar, tahsilatlar, taksit kartları ve gün değişmedikçe yeniden hesaplanmaz
  // (birleşik Vade takip ve Nakit akış her süzgeç değişiminde buradan okur).
  let cache = { key: "", value: null, pending: null };
  async function allCalendar(now = clock()) {
    const key = [now.toDateString(), paymentsState(), caseCollectionsState(store), plans?.fingerprint ? plans.fingerprint() : "", ...dataset.sessions().map(sessionState)].join("|");
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
    // Tablodaki Kişiler ve Nakit Akışı: kaydın tahsilatı takvimle AYNI küme — kayıt tahsilatı (eski) + kayda bağlı carinin tahsilatı (2.4.3 A2; 2.4.4 E8: zil ve
    // Tahsilat Takvimi'ndeki tahsilat cariye yazılır) + kayda (ya da kayda bağlı cariye) bağlı taksit kartının tahsilatı (31a F1/F5: Tablodan Aktar'ın karta
    // taşıdığı cari tahsilatı ve karta doğrudan girilen tahsilat; önceden rapordan düşüyordu). Bir para hareketi tek satırdadır (K11): iki kez sayılmaz.
    // Cari / kart tahsilatı bağın veri oturumunu (session) taşır; yalnız o sayfanın kaydına sayılır.
    const payments = [...store.all("SELECT case_key AS caseKey, amount, date, note FROM payments"), ...dataset.sessions().flatMap(item => caseCollections(store, item.key, { plans: true }).filter(row => row.session))];
    // 2.4.5 madde 5: Tablodaki Nakit Akışı Kasa defterini okumaz (2.4.4 31b MM6 / 31e Y1'deki Kasa giriş/çıkış kolonları kalktı; Kasa, Kasa raporlarında).
    return { ...data, payments };
  }

  async function build(kind, input, user) {
    if (!REPORT_KINDS.includes(kind)) throw new HttpError(400, "Bilinmeyen rapor türü.");
    const now = clock();
    const filters = normalizeFilters(input);
    const data = await backbone(filters, now);
    let report;
    if (kind === "cari-ekstre") report = cariEkstre({ records: data.records, payments: data.payments, filters, now });
    else if (kind === "vade-takip") report = vadeTakip({ records: data.records, items: data.items, dormant: data.dormant, filters, now });
    else report = nakitAkis({ items: data.items, payments: data.payments, filters, now });
    // 31e A1 / T1: sekme ve hesap notları — Tablodaki Kişiler kendi kayıtlarından, Vadeler ve Nakit Akışı takvimden (aynı kural).
    // Sekme süzgecinde not yalnız seçili sekmelerin ikisinde (ya da daha çoğunda) borcu olan dosya no için (Tablodaki Kişiler ile aynı).
    const inTabs = tab => !filters.tabs.length || filters.tabs.includes(tab);
    const split = (data.split || []).map(item => ({ ...item, tabs: item.tabs.filter(entry => inTabs(entry.tab)) })).filter(item => item.tabs.length > 1);
    if (kind !== "cari-ekstre") report = { ...report, notes: tableNotes({ split, overpaid: data.records.filter(record => record.overpaid && inTabs(record.tab)).length, unresolved: data.records.filter(record => (record.debtUnresolved || record.debtMissing) && inTabs(record.tab)) }) };
    // 2.4.4 U3: programın kolon adları başlık düzeninde (Yazım düzeni; lib/reports.mjs'te cümle düzeninde yazılı: "Beklenen tahsilat"); özel alan kolonları
    // kullanıcının verisidir, olduğu gibi. Alt TOPLAM satırı bütün satırlardan (ekran, PDF ve Excel bunu yazar).
    const columns = report.table.columns.map(column => (column.dynamic ? column : { ...column, label: titleCase(column.label) }));
    report = { ...report, table: { ...report.table, columns } };
    report.table.footer = tableFooter(report.table);
    // Süzgeç seçenekleri (Sekme, Durum) bütün sekmelerden (takvim süzülmeden kurulur; seçili sekmede öbürleri listeden düşmez).
    const tabs = [...new Set(data.records.map(record => record.tab).filter(Boolean))].sort((a, b) => a.localeCompare(b, "tr"));
    const statuses = [...new Set(data.records.map(record => record.status).filter(Boolean))].slice(0, 30);
    return { report, summary: tableSummary(report), filters: { ...filters, from: filters.from === null ? "" : new Date(filters.from).toISOString().slice(0, 10), to: filters.to === null ? "" : new Date(filters.to).toISOString().slice(0, 10) }, sessions: data.sessions, tabs, statuses, columnsBySession: data.columnsBySession, crossMatched: data.records.length ? [...new Set(data.records.map(record => record.cariKey).filter(Boolean))].length : 0 };
  }

  const subtitle = (filters, sessions) => {
    const parts = [];
    if (filters.from || filters.to) parts.push(`${filters.from ? dayText(Date.parse(filters.from)) : "başlangıç"} – ${filters.to ? dayText(Date.parse(filters.to)) : "bugün"}`);
    if (filters.cari) parts.push(`cari: ${filters.cari}`);
    if (filters.sessions.length) parts.push(`${filters.sessions.length} sayfa`);
    else if (sessions.length > 1) parts.push(`${sessions.length} sayfa birleşik`);
    return parts.join(" · ");
  };

  router.get("/api/workspace/reports/:kind", async ({ req, res, params, url }) => {
    const user = auth.requirePermission(req, "reports.view");
    const input = Object.fromEntries(url.searchParams.entries());
    for (const key of ["status", "sessions", "tabs"]) if (input[key]) input[key] = String(input[key]).split(",").map(item => item.trim()).filter(Boolean);
    ok(res, await build(text(params.kind), input, user));
  });

  // Şirket etiketi "001 · Unvan" (Rapor Merkezi'nin kuralı, routes/report-center.mjs companyLabel): PDF ve Excel başlık bloğunda.
  const office = () => store.setting("office.name", "");
  // 2.4.5 madde 6c: etiket ve Tabela Adı başlığı tek yardımcıda (lib/report-header.mjs; önceden üç rotada aynı kopya).
  const header = createReportHeader({ store, company: company });
  const companyLabel = header.companyLabel;

  // 2.4.4 U3: dışa aktarım programın öbür raporlarıyla AYNI üreticiden (lib/report-files.mjs — Rapor Merkezi ve Banka): başlık bloğu (şirket, rapor adı, kapsam,
  // oluşturma, hazırlayan), alt TOPLAM satırı, Excel'de Özet sayfası, dosya adı "<Rapor Adı> gg.aa.yyyy" YEREL günle (önceden toISOString: gece yarısından
  // sonra dünün UTC tarihi). PDF'te sığmayan özel alan kolonları bırakılır ve alt başlıkta söylenir (tamamı Excel'de); tutar hücresi bölünmez.
  router.post("/api/workspace/reports/:kind/export", async ({ req, res, params }) => {
    const user = auth.requirePermission(req, "reports.view");
    const body = await readJson(req);
    const kind = text(params.kind);
    const format = text(body.format) || "xlsx";
    if (format !== "xlsx" && format !== "pdf") throw new HttpError(400, "Biçim xlsx ya da pdf olmalı.");
    const result = await build(kind, body.filters || {}, user);
    const table = result.report.table;
    const flat = flattenTable(table);
    const title = TABLE_REPORT_TITLES[kind];
    const data = {
      title,
      // 31e: birleştirme / yetki notları PDF ve Excel'de de (alt başlık; Excel'in Özet sayfasında Kapsam).
      subtitle: [subtitle(result.filters, result.sessions), ...(result.report.notes || [])].filter(Boolean).join(" · "),
      headers: flat.headers,
      types: table.columns.map(column => column.type || ""),
      rows: flat.rows,
      footer: table.footer ? flattenTable({ columns: table.columns, rows: [table.footer] }).rows[0] : null,
      summary: result.summary,
      optional: table.columns.map((column, index) => (column.dynamic ? index : -1)).filter(index => index >= 0),
      optionalNote: count => `${count} özel alan kolonu sayfaya sığmadı (tamamı Excel'de)`,
    };
    const ctx = { now: clock(), companyLabel: companyLabel(), userName: user.display_name || user.username || "", brand: office() || "DestekOfis", header };
    const name = reportFileBase(title, isoDay(clock()));
    if (format === "xlsx") return sendBuffer(res, reportXlsx(data, ctx), { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", name: `${name}.xlsx` });
    return sendBuffer(res, reportPdf(data, ctx), { type: "application/pdf", name: `${name}.pdf`, inline: body.inline === true });
  });

  // Birleşik raporlar (routes/overview.mjs): tüm oturumların tablo takvimi.
  return { calendar: allCalendar };
}
