// 2.4.4 madde 30: bir sürümün (eski ya da güncel) bir şirkette GÖSTERDİĞİ olgular — kullanıcının ekranda gördüğü uçlardan (arayüzün kullandığı
// HTTP API) ve veri dosyasının kopyasından. Göçten ÖNCE eski sürümün kendi koduyla, SONRA güncel kodla, AYNI sabit sahte saatte okunur; fark
// test/guvenilirlik/m30-fark.mjs'te sınıflanır (beklenen = eski sürümün kendi sayısı; fark testi, KANIT KURALI 2 "eski sürümün gerçek kodu").
//
// Tek tek: her cari (bakiye), mizan (her hesap), defter mutabakatı, Mutabakat Testi, Kasa (toplam, yol başına), her banka hesabı, her çek/senet
// (durum), her fatura (durum, numara, ETTN, e-Belge durumu, ödeme durumu, açık), e-Belge kartlarının iptal/gönder/bırak düğmeleri, Gönderilecekler,
// seri "sıradaki numara"lar, her taksit kartı, stok, ANLIK DURUM, rapor merkezinin bütün raporları (satır, TOPLAM, özet), tablo raporları (Tablodaki
// Kişiler, Vade Takip, Nakit Akışı), tahsilat takvimi (ödeme sözü), KDV mahsup fişleri, kullanıcı yetkileri; dosyadan şema sürümü, tablo sayımları,
// numara tabanı ayarı.
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { readZip } from "../../server/lib/zip.mjs";

export const cents = value => Math.round(Number(value || 0) * 100);
export const digest = value => createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 24);
const must = async (what, promise) => {
  const res = await promise;
  if (res.status !== 200) throw new Error(`${what}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
  return res.data;
};
const soft = async promise => {
  const res = await promise;
  return res.status === 200 ? res.data : { __status: res.status, __error: res.data?.error || res.data?.code || "" };
};
const pick = (obj, keys) => Object.fromEntries(keys.filter(key => obj && Object.hasOwn(obj, key)).map(key => [key, obj[key]]));

/** Seçili şirketin olguları (api: şirket kapsamlı). */
export async function companyFacts(api, { reportsFrom = "2000-01-01", reportsTo = "2099-12-31", detailCap = 2000 } = {}) {
  const out = {};
  // Cariler
  const accounts = [];
  for (let offset = 0; ; offset += 5000) {
    const page = await must("cari listesi", api.get(`/api/workspace/accounts?status=all&limit=5000&offset=${offset}`));
    accounts.push(...page.accounts);
    if (!page.hasMore) break;
  }
  out.accounts = Object.fromEntries(accounts.map(a => [a.id, { ref: a.refNo, name: a.name, type: a.type, status: a.status, balance: cents(a.balance), caseKey: a.caseKey || "", eInvoice: a.eInvoice || 0, eAlias: a.eAlias || "" }]));
  // Defter
  const ledger = await must("Ana Defter", api.get("/api/workspace/ledger"));
  out.trial = Object.fromEntries(ledger.trial.accounts.map(row => [String(row.code), { name: row.name, debit: cents(row.debit), credit: cents(row.credit), balance: cents(row.balance) }]));
  out.trialTotals = { debit: cents(ledger.trial.totals.debit), credit: cents(ledger.trial.totals.credit), difference: cents(ledger.trial.totals.difference) };
  out.reconciliation = Object.fromEntries(ledger.reconciliation.checks.map(row => [String(row.code), { ledger: cents(row.ledger), subledger: cents(row.subledger), ok: row.ok }]));
  const integrity = await must("Mutabakat Testi", api.get("/api/workspace/ledger/integrity"));
  out.integrity = { ok: integrity.ok ?? null, failures: (integrity.failures || []).map(item => `${item.code}|${cents(item.difference)}|${item.count ?? ""}`).sort(), checksOk: (integrity.checks || []).filter(item => item.ok).map(item => item.code).sort(), checksBad: (integrity.checks || []).filter(item => !item.ok).map(item => item.code).sort() };
  const lock = await must("dönem kilidi", api.get("/api/workspace/ledger/lock"));
  out.today = lock.today;
  out.lockedUntil = lock.lockedUntil || "";
  // Kasa
  const cashAll = await must("Kasa (tüm yollar)", api.get("/api/workspace/cash?method=all"));
  const cash = await must("Kasa", api.get("/api/workspace/cash"));
  // Sistemin yazdığı satırın (ör. açılışta / okumada kendiliğinden yapılan POS gün sonu) kimliği her açılışta yeniden üretilebilir: olay numarasıyla
  // karşılaştırılır (aday 9: 001'de ölçüm anında iki sürüm aynı BNK numaralı gün sonunu yazdı, yalnız üretilen kimlikler farklıydı).
  const cashRows = list => list.map(e => [e.source || "", e.actorId === "system" && e.eventNo ? `system:${e.eventNo}` : e.id, e.kind, cents(e.amount), e.date, e.method].join("|")).sort();
  // Sistemin yazdığı olaylar (POS valör kuyruğu, server/lib/bank/pos.mjs createPosQueue): geri yüklemeden sonra yeniden yazılırsa olay sayacı geri gitmediği
  // için (lib/company-backups.mjs EVENT_COUNTERS) yeni numara alır — iki sürümde de (aday 9 C9). Yedek tatbikatının karşılaştırması (m30-tatbikat stable)
  // bu olayları numarasız (tür + tarih) okur; göç farkı (m30-fark) numaralı özeti kullanır.
  const systemEvents = {};
  for (const e of cashAll.entries) if (e.actorId === "system" && e.eventNo) systemEvents[e.eventNo] = `${e.eventType || ""}|${e.date}`;
  const normRows = list => list.map(e => [e.source || "", e.actorId === "system" && e.eventNo ? `system:${e.eventType || ""}:${e.date}` : e.id, e.kind, cents(e.amount), e.date, e.method].join("|")).sort();
  out.cash = { totals: cashAll.totals, byMethod: cashAll.byMethod, allCount: cashAll.entries.length, allDigest: digest(cashRows(cashAll.entries)), allDigestNorm: digest(normRows(cashAll.entries)), systemEvents, window: cash.totals, windowCount: cash.entries.length, windowDigest: digest(cashRows(cash.entries)) };
  // Banka
  const banks = await soft(api.get("/api/workspace/bank/accounts"));
  out.bank = banks.__status ? banks : { accounts: Object.fromEntries((banks.accounts || []).map(a => [a.id, { name: `${a.bankName} · ${a.name}`, balance: a.balanceMinor, status: a.status }])), totals: banks.totals };
  const bsum = await soft(api.get("/api/workspace/bank/summary"));
  out.bankSummary = bsum.__status ? bsum : digest(bsum);
  // Çek / senet
  const cheques = [];
  for (let offset = 0; ; offset += 300) {
    const page = await must("çek/senet", api.get(`/api/workspace/cheques?limit=300&offset=${offset}`));
    cheques.push(...page.cheques);
    if (!page.hasMore) break;
  }
  out.cheques = Object.fromEntries(cheques.map(c => [c.id, { serial: c.serialNo, direction: c.direction, instrument: c.instrument, status: c.status, amount: cents(c.amount), accountId: c.accountId || "", invoiceId: c.invoiceId || "", planId: c.planId || "", deposited: Boolean(c.deposit || c.collection || c.depositedAt) }]));
  // Faturalar
  const inv = await must("faturalar", api.get("/api/workspace/invoices?tab=all&limit=10000"));
  out.invoiceTabs = inv.tabCounts || null;
  // 2.4.4 madde 30b (aday 9): geri yüklemeden sonraki tek seferlik uyarı — 2.4.3'te alan yok (null); normal göçte de çıkmamalı.
  out.restoreNotice = inv.restoreNotice ?? null;
  out.invoices = Object.fromEntries(inv.invoices.map(d => [d.id, { kind: d.kind, status: d.status, number: d.number, displayNo: d.displayNo, ettn: d.ettn, issueDate: d.issueDate, accountId: d.accountId, profile: d.profile, eStatus: d.eStatus || "", eUnsent: d.eUnsent ?? null, payable: cents(d.payableTotal), payState: d.payState, paid: cents(d.paid), open: cents(d.open), planId: d.planId || "", originalId: d.originalId || "" }]));
  const pending = await must("Gönderilecekler", api.get("/api/workspace/invoices?tab=pending&limit=1000"));
  out.pending = pending.invoices.map(d => d.id).sort();
  // e-Belge kartları: düğmeler ve iptal bilgisi (e-Belge profilli ya da bırakılmış belgeler).
  out.edocCards = {};
  const edocIds = inv.invoices.filter(d => d.profile !== "KAGIT" || d.eStatus).map(d => d.id).slice(0, detailCap);
  for (const id of edocIds) {
    const card = await must("fatura kartı", api.get(`/api/workspace/invoices/${id}`));
    const flags = Object.fromEntries(Object.entries(card).filter(([key, v]) => /^can[A-Z]/.test(key) && typeof v === "boolean"));
    out.edocCards[id] = { eStatus: card.eStatus || "", number: card.number, paperNo: card.paperNo || "", ...flags, cancelWindow: card.cancelWindow ?? null, cancelBlock: card.cancelBlock ?? null };
  }
  const settings = await must("Fatura Ayarları", api.get("/api/workspace/invoices/settings"));
  out.series = settings.series;
  out.nextNumbers = Object.fromEntries(Object.entries(settings.nextNumbers || {}).map(([key, v]) => [key, v?.number ?? v]));
  // Taksit kartları
  const plans = await must("taksit kartları", api.get("/api/workspace/plans"));
  out.plans = Object.fromEntries(plans.plans.map(p => [p.id, { accountId: p.accountId || "", name: p.name, total: cents(p.total), paid: cents(p.paid), remaining: cents(p.remaining), overdue: cents(p.overdue), status: p.status || "", importId: p.importId || "", caseKey: p.caseKey || "" }]));
  out.planTotals = Object.fromEntries(Object.entries(plans.totals || {}).map(([k, v]) => [k, typeof v === "number" && k !== "count" && k !== "overdueCount" ? cents(v) : v]));
  // Stok
  const stock = await must("stok", api.get("/api/workspace/stock?limit=5000"));
  out.stock = Object.fromEntries((stock.items || stock.stock || []).map(s => [s.id, { code: s.code, qty: Number(s.qty) }]));
  // ANLIK DURUM
  const overview = await must("ANLIK DURUM", api.get("/api/workspace/overview"));
  const { at, ...overviewStable } = overview;
  out.overview = overviewStable;
  // Rapor merkezi: bütün raporlar (cari seçimi isteyenler hariç).
  const list = await must("rapor listesi", api.get("/api/workspace/report-center"));
  out.reports = {};
  for (const item of list.reports) {
    if (item.accountRequired) continue;
    const report = await soft(api.get(`/api/workspace/report-center/${item.id}?from=${reportsFrom}&to=${reportsTo}`));
    if (report.__status) {
      out.reports[item.id] = { title: item.title, error: report };
      continue;
    }
    out.reports[item.id] = { title: report.title || item.title, headers: report.headers, total: report.total, footer: report.footer, summary: report.summary, rows: report.rows?.length <= 20000 ? report.rows : null, rowsDigest: digest(report.rows) };
  }
  // Tablo raporları (Tablodaki Kişiler = cari-ekstre, Vade Takip, Nakit Akışı) ve tahsilat takvimi.
  out.tableReports = {};
  for (const kind of ["cari-ekstre", "vade-takip", "nakit-akis"]) {
    const r = await soft(api.get(`/api/workspace/reports/${kind}?from=${reportsFrom}&to=${reportsTo}&limit=20000`));
    out.tableReports[kind] = r.__status ? r : { report: r.report, tabs: r.tabs, crossMatched: r.crossMatched };
  }
  // MM8 (aday 9): Yevmiye'nin BÜTÜN satırları (rapor merkezi ön izlemesi 200 satırla sınırlı; Excel çıktısı hepsini taşır). Gün başına satır kümesi
  // (sıradan bağımsız özet) ve madde sırası (işlem adları) — aynı gün sırasının değişmesi kümeyi değiştirmemeli.
  out.journal = api.bin ? await journalFacts(api, reportsFrom, reportsTo) : null;
  // Silinenler (E6, aday 9): göç çöp kutusuna dokunmamalı.
  const trash = await soft(api.get("/api/admin/trash"));
  const trashItems = trash.__status ? null : Array.isArray(trash) ? trash : trash.items || [];
  out.trash = trashItems ? { count: trashItems.length, byKind: trashItems.reduce((m, t) => ({ ...m, [t.kind]: (m[t.kind] || 0) + 1 }), {}), invoices: trashItems.filter(t => t.kind === "invoice").map(t => ({ id: t.id, title: t.title, restorable: t.restorable ?? null })).sort((a, b) => a.id.localeCompare(b.id)) } : trash;
  const dues = await soft(api.get("/api/workspace/dues"));
  out.dues = dues.__status ? dues : dues;
  const vat = await soft(api.get("/api/workspace/tax/vat-offset"));
  out.vatOffsets = vat.__status ? vat : (vat.offsets || []).map(o => pick(o, ["id", "month", "date", "outMinor", "inMinor", "carryInMinor", "carryOutMinor", "payableMinor", "status"]));
  const dataset = await soft(api.get("/api/workspace/dataset"));
  out.dataset = dataset.__status ? dataset : pick(dataset, ["hasData", "label", "rowCount", "tabs"]);
  const doubtful = await soft(api.get("/api/workspace/doubtful"));
  out.doubtful = doubtful.__status ? doubtful : digest(doubtful);
  return out;
}

/** Kurulum geneli: şirketler, kullanıcılar (rol + etkin yetkiler), roller. */
export async function installFacts(api) {
  const companies = await must("şirketler", api.get("/api/companies"));
  const users = await must("kullanıcılar", api.get("/api/admin/users"));
  const roles = await soft(api.get("/api/admin/roles"));
  const userList = Array.isArray(users) ? users : users.users || [];
  return {
    companies: companies.all.map(c => pick(c, ["id", "code", "name"])),
    users: Object.fromEntries(userList.map(u => [u.username, { role: u.role, active: u.active ?? u.status ?? null, permissions: [...(u.permissions || u.effectivePermissions || [])].sort(), grants: u.grants || null }])),
    roles: roles.__status ? roles : (Array.isArray(roles) ? roles : roles.roles || []).map(r => ({ id: r.id, name: r.name, permissions: [...(r.permissions || [])].sort() })),
  };
}

/** Veri dosyasının KOPYASINDAN (canlı dosyaya bağlanılmaz): şema sürümü, tablo listesi ve satır sayıları, numara tabanı, yetki ayarı. */
export function fileFacts(file) {
  const dir = mkdtempSync(path.join(tmpdir(), "m30-olgu-"));
  const copy = path.join(dir, "kopya.sqlite");
  try {
    copyFileSync(file, copy);
    if (existsSync(`${file}-wal`)) copyFileSync(`${file}-wal`, `${copy}-wal`);
    const db = new DatabaseSync(copy);
    try {
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(row => row.name);
      const counts = Object.fromEntries(tables.map(name => [name, db.prepare(`SELECT COUNT(*) AS n FROM "${name}"`).get().n]));
      const setting = key => {
        try {
          return db.prepare("SELECT value FROM settings WHERE key = ?").get(key)?.value ?? null;
        } catch {
          return null;
        }
      };
      return { version: db.prepare("PRAGMA user_version").get().user_version, integrity: db.prepare("PRAGMA integrity_check").get().integrity_check, tables, counts, numberFloor: setting("invoice.numberFloor"), lockedUntil: setting("ledger.lockedUntil") };
    } finally {
      db.close();
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const unxml = text => String(text).replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&amp;/g, "&");
const columnIndex = letters => [...letters].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
/** Excel çıktısının (xlsx) ilk sayfasının satırları (hücre metni ya da sayı değeri; boş hücre ""). */
export function xlsxRows(buffer) {
  const entries = readZip(buffer);
  const sheet = entries.find(e => /^xl\/worksheets\/sheet1\.xml$/.test(e.name));
  if (!sheet) throw new Error("xlsx: sheet1 yok");
  const xml = sheet.data.toString("utf8");
  const rows = [];
  for (const rowMatch of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells = [];
    for (const cell of rowMatch[1].matchAll(/<c r="([A-Z]+)\d+"[^>]*?(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const inner = cell[2] || "";
      const value = /<v>([\s\S]*?)<\/v>/.exec(inner)?.[1] ?? [...inner.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map(m => m[1]).join("");
      cells[columnIndex(cell[1])] = unxml(value);
    }
    rows.push(Array.from(cells, v => v ?? ""));
  }
  return rows;
}
async function journalFacts(api, from, to) {
  const res = await api.bin(`/api/workspace/report-center/yevmiye/xlsx?from=${from}&to=${to}`);
  if (res.status !== 200) return { __status: res.status };
  const rows = xlsxRows(res.buffer);
  const head = rows.findIndex(r => r[0] === "Tarih");
  const data = [];
  // Tarih hücresi Excel'de sayı (gün seri numarası) olarak yazılır (lib/xlsx-write.mjs typedCell) → gg.aa.yyyy.
  const dayText = v => {
    if (/^\d{2}\.\d{2}\.\d{4}$/.test(v)) return v;
    if (!/^\d{5}(\.\d+)?$/.test(v)) return null;
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(Number(v)) * 86400000);
    return `${String(d.getUTCDate()).padStart(2, "0")}.${String(d.getUTCMonth() + 1).padStart(2, "0")}.${d.getUTCFullYear()}`;
  };
  for (const r of rows.slice(head + 1)) {
    if (r[0] === "TOPLAM") break;
    const day = dayText(r[0]);
    if (day) data.push([day, ...r.slice(1, 6)]);
  }
  const byDate = {};
  let last = null;
  for (const r of data) {
    const day = (byDate[r[0]] ||= { n: 0, rows: [], order: [] });
    day.n += 1;
    day.rows.push(JSON.stringify(r));
    // madde: art arda aynı (tarih, işlem, açıklama) satırları
    const madde = `${r[0]}|${r[1]}|${r[2]}`;
    if (madde !== last) day.order.push(r[1]);
    last = madde;
  }
  const out = {};
  for (const [day, v] of Object.entries(byDate)) out[day] = { n: v.n, set: digest(v.rows.sort()), order: v.order };
  return { rows: data.length, header: rows[head] || null, days: out };
}
