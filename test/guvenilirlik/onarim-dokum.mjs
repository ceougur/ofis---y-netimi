// 2.5.0 AH — açılış onarımının (repairOwnCards) eşdeğerlik dökümü. Verilen KOD kökünün createApp'i verilen veri klasörünü açar (açılışta onarım
// koşar); sonra programın kendisinden okunur: onarım sonucu (fixed / locked, sırasıyla), onarım ve kart küçültme izleri (plan.repaired, plan.trimmed;
// kimlik hariç), bütün kartlar ve taksitler, bütün faturaların ödeme durumu, cari listesi (bakiyeler, Geciken), Kasa, aday kartların kart görünümü
// ve Mutabakat Testi. Eski kod ↔ yeni kod aynı veri kopyasında aynı dökümü vermeli (test/acilis-onarimi-hiz-250.test.mjs,
// tools/acilis-onarimi-esdegerlik-250.mjs). Saat sahte ve durağan (ders 13, 22): verinin "bugün"ü öğlen, İstanbul.
import { createHash } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { ADMIN_PASSWORD, createClient } from "../helpers.mjs";

const LICENSE = { enforce: false, machineId: "0123456789abcdef0123456789abcdef" };
const unwrap = response => (response.data && typeof response.data === "object" && "ok" in response.data ? (response.data.ok ? response.data.data : response.data) : response.data);
const plain = value => JSON.parse(JSON.stringify(value ?? null));
export const CANDIDATE_SQL = `SELECT DISTINCT i.id, i.account_id AS accountId, i.try_payable AS tryPayable, i.plan_id AS planId FROM invoices i
      JOIN invoices r ON r.original_id = i.id AND r.kind = 'sale_return' AND r.status = 'issued'
      JOIN plans pl ON pl.id = i.plan_id AND pl.deleted_at IS NULL AND pl.status <> 'closed'
      WHERE i.status = 'issued' AND i.plan_id <> '' ORDER BY i.id`;

/** Kod kökünün createApp'iyle açar. root: depo kökü (server/app.mjs). */
export async function openWith(root, { dataDir, backupDir, today, overrides = {} }) {
  const { createApp } = await import(pathToFileURL(path.join(root, "server", "app.mjs")).href);
  const started = performance.now();
  const app = createApp({ dataDir, backupDir, logLevel: "silent", scheduleBackups: false, env: { HUKUK_ADMIN_PASSWORD: ADMIN_PASSWORD, HUKUK_DATASET_AUTOSYNC: "0" }, license: LICENSE, startLicenseTimers: false, integrityScan: false, analysisWorker: false, now: { time: `${today}T12:00:00+03:00`, fixed: true }, ...overrides });
  const openMs = performance.now() - started;
  return { app, openMs };
}

/**
 * Açılmış uygulamadan döküm. hash: büyük bölümler yalnız sayı + sha256 (100.000'lik veri). screen: aday başına toplu ↔ cari başına durum
 * karşılaştırması (onarımın elemesinin dayandığı değişmez; pahalı — cari başına yol, eski onarımın maliyeti).
 */
export async function dumpRepair(app, { hash = false, screen = false, password = ADMIN_PASSWORD } = {}) {
  const store = app.store;
  const out = {};
  const put = (key, value) => {
    const data = plain(value);
    out[key] = hash ? { n: Array.isArray(data) ? data.length : Object.keys(data || {}).length, sha256: createHash("sha256").update(JSON.stringify(data)).digest("hex") } : data;
  };
  out.repair = plain(app.context.ownCardRepair);
  put("izler", store.all("SELECT type, entity_id AS entityId, actor_id AS actorId, payload_json AS payload, created_at AS createdAt FROM audit_events WHERE type IN ('plan.repaired', 'plan.trimmed') ORDER BY rowid").map(row => ({ ...row, payload: JSON.parse(row.payload || "{}") })));
  put("kartlar", store.all("SELECT id, account_id AS accountId, total, status, deleted_at AS deletedAt, updated_at AS updatedAt FROM plans ORDER BY id"));
  put("taksitler", store.all("SELECT id, plan_id AS planId, seq, due_date AS dueDate, amount, updated_at AS updatedAt FROM plan_items ORDER BY id"));
  const invoices = app.context.invoices;
  const all = store.all("SELECT id, account_id AS accountId, try_payable AS tryPayable FROM invoices ORDER BY id");
  // Yalnız kararlı alanlar (sonraki sürümlerin eklediği alan dökümü kırmasın): tutar, ödenen, açık, fazla, durum, kart payı.
  // 2.5.0 Ç5-B: onarımın okuduğu durum KART / BAĞ DEFTERİdir (lib/invoice-settle.mjs; routes/invoices.mjs settledFor = cardLedgerState, toplu yolu repairScreen) — ekrandaki
  // fatura durumu artık Tek Yükümlülük Kuyruğu görünümü (paymentStates) ve bilerek değişti (S2, karar (1), S50). Eski kodda (cardLedgerState yok) paymentStates aynı kuraldır.
  const ledgerStates = invoices.cardLedgerState && invoices.repairScreen ? invoices.repairScreen(all.map(row => row.id)) : invoices.paymentStates(all);
  put("faturaDurumlari", [...ledgerStates].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([id, s]) => [id, { payable: s.payable, paid: s.paid, open: s.open, excess: s.excess ?? 0, state: s.state, coveredBy: s.coveredBy || {} }]));
  const candidates = store.all(CANDIDATE_SQL);
  out.aday = candidates.length;
  if (screen) {
    // Onarımın elemesi (repairScreen: adayların carileri, parça parça, toplu kapama kuralı) ↔ cari başına yol (paymentStates([satır]); eski onarımın okuması).
    if (!invoices.repairScreen) throw new Error("eleme denetimi yeni kod ister (repairScreen yok)");
    const batch = invoices.repairScreen(candidates.map(row => row.id));
    let differ = 0;
    const samples = [];
    for (const row of candidates) {
      const exact = invoices.cardLedgerState ? invoices.cardLedgerState(row) : invoices.paymentStates([row]).get(row.id);
      const a = batch.get(row.id);
      const same = Number(a?.open) === Number(exact?.open) && Number(a?.excess || 0) === Number(exact?.excess || 0);
      if (!same) {
        differ += 1;
        if (samples.length < 5) samples.push({ id: row.id, toplu: { open: a?.open, excess: a?.excess }, cariBasina: { open: exact?.open, excess: exact?.excess } });
      }
    }
    out.eleme = { aday: candidates.length, farkli: differ, ornek: samples };
  }
  const { port } = await app.listen(0, "127.0.0.1");
  const client = createClient(`http://127.0.0.1:${port}`);
  const login = await client.login("admin", password);
  if (login.status !== 200) throw new Error(`giriş ${login.status}`);
  const get = async url => {
    const res = await client.get(url);
    if (res.status !== 200) throw new Error(`${url}: ${res.status} ${JSON.stringify(res.data).slice(0, 200)}`);
    return unwrap(res);
  };
  const accounts = await get("/api/workspace/accounts?status=all&limit=100000");
  const rows = accounts.accounts || accounts.items || [];
  if (!rows.length) throw new Error("cari listesi boş okundu (ders 4)");
  // 2.5.0 Ç5-B: listenin `overdue`'su Tek Yükümlülük Kuyruğu'nun gecikmiş borcu oldu (B1, bilerek); onarım eşdeğerliği eski anlamlı alanı okur (overdueInstallments; eski kodda overdue).
  // 2.5.0 Ç5-B kapanış düzeltmesi (S129 = A): listenin `planRemaining`'i ve kartın `paid` / `remaining`'i GÖSTERİLEN sayı oldu (tek kuyruk; bilerek); onarım eşdeğerliği kartın
  // KENDİ hesabını okur (planOwnRemaining, ownPaid, ownRemaining; eski kodda planRemaining, paid, remaining).
  put("cariler", rows.map(row => ({ id: row.id, debit: row.debit, credit: row.credit, balance: row.balance, planRemaining: row.planOwnRemaining ?? row.planRemaining, overdue: row.overdueInstallments ?? row.overdue })));
  const cash = await get("/api/workspace/cash");
  if (!cash?.totals) throw new Error("Kasa okunamadı (ders 4)");
  out.kasa = plain({ in: cash.totals.in, out: cash.totals.out, balance: cash.totals.balance });
  const cards = [];
  for (const row of candidates) {
    const t = (await get(`/api/workspace/plans/${row.planId}`)).totals || {};
    // 2.5.0 Ç5-B: kartın `overdue`'su kuyruk kalanından (S50); onarım eşdeğerliği kartın kendi hesabını okur (ownOverdue; eski kodda overdue).
    cards.push({ planId: row.planId, total: t.total, paid: t.ownPaid ?? t.paid, remaining: t.ownRemaining ?? t.remaining, overdue: t.ownOverdue ?? t.overdue ?? 0 });
  }
  put("adayKartlar", cards);
  const integrity = await get("/api/workspace/ledger/integrity");
  out.mutabakat = { ok: integrity.ok, failures: (integrity.failures || []).map(item => item.code) };
  return out;
}

/** İki dökümün bölüm bölüm farkı (boş liste = aynı). */
export function diffDumps(a, b) {
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].filter(key => key !== "eleme");
  return keys.filter(key => JSON.stringify(a[key]) !== JSON.stringify(b[key])).map(key => ({ bolum: key, eski: JSON.stringify(a[key]).slice(0, 400), yeni: JSON.stringify(b[key]).slice(0, 400) }));
}
